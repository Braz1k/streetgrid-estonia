import type mapboxgl from "mapbox-gl";

/**
 * Player marker transition engine — viewport enter/leave, zoom factor, cluster handoff.
 * GPU composited opacity + transform only · 220ms ease-out · stable marker identity.
 */

export const PLAYER_TRANSITION_MS = 220;
export const PLAYER_SCALE_ENTER = 0.9;
export const PLAYER_SCALE_EXIT = 0.94;
export const PLAYER_SCALE_VISIBLE = 1;
/** Cluster ↔ avatar handoff scale (matches cluster disc). */
export const PLAYER_CLUSTER_HANDOFF_SCALE = 0.92;

/** Legacy aliases — shared with markerAnimation.ts */
export const MARKER_APPEARANCE_MS = PLAYER_TRANSITION_MS;
export const MARKER_SCALE_ENTER = PLAYER_SCALE_ENTER;
export const MARKER_SCALE_EXIT = PLAYER_SCALE_EXIT;
export const MARKER_SCALE_VISIBLE = PLAYER_SCALE_VISIBLE;
export const CLUSTER_HANDOFF_SCALE = PLAYER_CLUSTER_HANDOFF_SCALE;

/** Screen-space hysteresis — prevents edge flicker while panning. */
const VIEWPORT_ENTER_MARGIN_PX = 40;
const VIEWPORT_EXIT_MARGIN_PX = 64;

export function playerTransitionEaseOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}

/** @deprecated Use playerTransitionEaseOut */
export const markerAppearanceEaseOut = playerTransitionEaseOut;

export type PlayerTransitionTarget = {
  id: string;
  container: HTMLElement;
  visual: HTMLElement;
  isSelf?: boolean;
  alwaysVisible?: boolean;
};

/** @deprecated Use PlayerTransitionTarget */
export type MarkerAppearanceTarget = PlayerTransitionTarget;

type ChannelPhase = "idle" | "animating";

type PlayerTransitionState = {
  id: string;
  container: HTMLElement;
  visual: HTMLElement;
  alwaysVisible: boolean;
  viewport: number;
  viewportTarget: number;
  viewportPhase: ChannelPhase;
  viewportAnimStart: number;
  viewportAnimFrom: number;
  zoomFactor: number;
  cluster: number;
  clusterTarget: number;
  clusterPhase: ChannelPhase;
  clusterAnimStart: number;
  clusterAnimFrom: number;
  clusterHandoff: boolean;
  inCluster: boolean;
  inViewport: boolean;
  exitCallbacks: Array<() => void>;
  exitFired: boolean;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function isExitingViewport(state: PlayerTransitionState): boolean {
  return (
    state.viewportTarget < 0.5 ||
    (state.viewportPhase === "animating" && state.viewportAnimFrom > state.viewportTarget)
  );
}

function scaleForState(state: PlayerTransitionState): number {
  if (state.clusterHandoff && state.clusterPhase === "animating") {
    return (
      PLAYER_CLUSTER_HANDOFF_SCALE +
      (PLAYER_SCALE_VISIBLE - PLAYER_CLUSTER_HANDOFF_SCALE) * state.cluster
    );
  }

  if (isExitingViewport(state)) {
    return (
      PLAYER_SCALE_EXIT + (PLAYER_SCALE_VISIBLE - PLAYER_SCALE_EXIT) * state.viewport
    );
  }

  return (
    PLAYER_SCALE_ENTER + (PLAYER_SCALE_VISIBLE - PLAYER_SCALE_ENTER) * state.viewport
  );
}

function applyTransitionVisual(state: PlayerTransitionState, now: number) {
  animateChannel(
    now,
    state.viewportTarget,
    state.viewportPhase,
    state.viewportAnimStart,
    state.viewportAnimFrom,
    (v) => {
      state.viewport = v;
    },
    (p) => {
      state.viewportPhase = p;
    },
    () => {
      if (state.viewport <= 0.01) fireExitCallbacks(state);
    },
  );

  animateChannel(
    now,
    state.clusterTarget,
    state.clusterPhase,
    state.clusterAnimStart,
    state.clusterAnimFrom,
    (v) => {
      state.cluster = v;
    },
    (p) => {
      state.clusterPhase = p;
    },
    () => {
      if (state.cluster >= 0.99) state.clusterHandoff = false;
    },
  );

  const opacity = clamp01(state.viewport * state.zoomFactor * state.cluster);
  const scale = scaleForState(state);

  state.container.style.setProperty("--presence-opacity", String(opacity));
  state.visual.style.transform = `translateZ(0) scale(${scale})`;

  const interactive =
    opacity > 0.04 &&
    !state.inCluster &&
    state.inViewport &&
    state.container.classList.contains("sg-player-marker-mount--tappable");
  state.container.style.pointerEvents = interactive ? "auto" : "none";

  if (state.alwaysVisible && state.viewport >= 0.99 && opacity > 0.5) {
    state.container.classList.add("sg-player-marker-mount--self-visible");
  } else {
    state.container.classList.remove("sg-player-marker-mount--self-visible");
  }
}

function animateChannel(
  now: number,
  target: number,
  phase: ChannelPhase,
  animStart: number,
  animFrom: number,
  setValue: (v: number) => void,
  setPhase: (p: ChannelPhase) => void,
  onComplete: () => void,
) {
  if (phase !== "animating") return;

  const elapsed = now - animStart;
  const t = playerTransitionEaseOut(Math.min(1, elapsed / PLAYER_TRANSITION_MS));
  const v = animFrom + (target - animFrom) * t;
  setValue(v);

  if (elapsed >= PLAYER_TRANSITION_MS) {
    setValue(target);
    setPhase("idle");
    onComplete();
  }
}

function fireExitCallbacks(state: PlayerTransitionState) {
  if (state.exitFired) return;
  state.exitFired = true;
  for (const cb of state.exitCallbacks) cb();
  state.exitCallbacks.length = 0;
}

function primeHiddenDom(container: HTMLElement, visual: HTMLElement) {
  container.style.setProperty("--presence-opacity", "0");
  visual.style.transform = `translateZ(0) scale(${PLAYER_SCALE_ENTER})`;
  visual.style.willChange = "transform";
}

function beginViewportAnim(state: PlayerTransitionState, target: number) {
  if (state.alwaysVisible && target === 0) return;

  const current = state.viewport;
  if (Math.abs(current - target) < 0.008 && state.viewportPhase === "idle") {
    state.viewportTarget = target;
    state.viewport = target;
    return;
  }
  if (state.viewportTarget === target && state.viewportPhase === "animating") return;

  state.viewportTarget = target;
  state.viewportAnimStart = performance.now();
  state.viewportAnimFrom = current;
  state.viewportPhase = "animating";
  if (target > 0) state.exitFired = false;
}

function beginClusterAnim(state: PlayerTransitionState, target: number) {
  const current = state.cluster;
  if (Math.abs(current - target) < 0.008 && state.clusterPhase === "idle") {
    state.clusterTarget = target;
    state.cluster = target;
    return;
  }
  if (state.clusterTarget === target && state.clusterPhase === "animating") return;

  state.clusterTarget = target;
  state.clusterAnimStart = performance.now();
  state.clusterAnimFrom = current;
  state.clusterPhase = "animating";
}

/** Production player transition engine — never remount, never snap visible. */
export class PlayerTransitionEngine {
  private states = new Map<string, PlayerTransitionState>();
  private rafId: number | null = null;

  reset() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.states.clear();
  }

  register(target: PlayerTransitionTarget) {
    const existing = this.states.get(target.id);
    if (existing) {
      existing.container = target.container;
      existing.visual = target.visual;
      existing.alwaysVisible = target.alwaysVisible === true || target.isSelf === true;
      return;
    }

    primeHiddenDom(target.container, target.visual);

    const alwaysVisible = target.alwaysVisible === true || target.isSelf === true;
    this.states.set(target.id, {
      id: target.id,
      container: target.container,
      visual: target.visual,
      alwaysVisible,
      viewport: 0,
      viewportTarget: 0,
      viewportPhase: "idle",
      viewportAnimStart: 0,
      viewportAnimFrom: 0,
      zoomFactor: 0,
      cluster: 1,
      clusterTarget: 1,
      clusterPhase: "idle",
      clusterAnimStart: 0,
      clusterAnimFrom: 1,
      clusterHandoff: false,
      inCluster: false,
      inViewport: false,
      exitCallbacks: [],
      exitFired: false,
    });
  }

  unregister(id: string) {
    this.states.delete(id);
    this.maybeStop();
  }

  isInViewport(id: string): boolean {
    return this.states.get(id)?.inViewport ?? false;
  }

  enterViewport(id: string) {
    const state = this.states.get(id);
    if (!state) return;
    state.inViewport = true;
    if (!state.inCluster) beginViewportAnim(state, 1);
    this.ensureRunning();
  }

  exitViewport(id: string, onComplete?: () => void) {
    const state = this.states.get(id);
    if (!state) {
      onComplete?.();
      return;
    }
    if (state.alwaysVisible) {
      onComplete?.();
      return;
    }
    if (onComplete) {
      state.exitCallbacks.push(onComplete);
      state.exitFired = false;
    }
    state.inViewport = false;
    beginViewportAnim(state, 0);
    this.ensureRunning();
  }

  enter(id: string) {
    this.enterViewport(id);
  }

  exit(id: string, onComplete?: () => void) {
    this.exitViewport(id, onComplete);
  }

  setZoomFactor(id: string, factor: number) {
    const state = this.states.get(id);
    if (!state) return;
    state.zoomFactor = clamp01(factor);
    this.ensureRunning();
  }

  setZoomOpacity(id: string, opacity: number) {
    this.setZoomFactor(id, opacity);
  }

  setClusterMembership(id: string, inCluster: boolean) {
    const state = this.states.get(id);
    if (!state) return;
    if (state.inCluster === inCluster) return;

    state.inCluster = inCluster;
    state.clusterHandoff = true;

    if (inCluster) {
      beginClusterAnim(state, 0);
      beginViewportAnim(state, 0);
    } else if (state.inViewport && state.zoomFactor > 0.02) {
      beginClusterAnim(state, 1);
      beginViewportAnim(state, 1);
    } else {
      beginClusterAnim(state, 1);
    }

    this.ensureRunning();
  }

  setClusterHidden(id: string, hidden: boolean) {
    this.setClusterMembership(id, hidden);
  }

  private ensureRunning() {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private maybeStop() {
    if (this.states.size === 0 && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (now: number) => {
    let active = false;

    for (const state of this.states.values()) {
      if (state.viewportPhase === "animating" || state.clusterPhase === "animating") {
        active = true;
      }
      applyTransitionVisual(state, now);
      if (state.exitCallbacks.length > 0 && state.viewport <= 0.01 && state.viewportPhase === "idle") {
        active = true;
      }
    }

    this.rafId = active ? requestAnimationFrame(this.tick) : null;
  };
}

export function isPlayerMarkerInViewport(
  map: mapboxgl.Map,
  lngLat: [number, number],
  marginPx: number,
): boolean {
  const point = map.project(lngLat);
  const canvas = map.getCanvas();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  return (
    point.x >= -marginPx &&
    point.x <= w + marginPx &&
    point.y >= -marginPx &&
    point.y <= h + marginPx
  );
}

export function syncPlayerMarkerViewport(
  engine: PlayerTransitionEngine,
  map: mapboxgl.Map,
  entries: ReadonlyArray<{
    marker: mapboxgl.Marker;
    props: { isCurrentUser?: boolean };
    userId?: string;
    appearanceId: string;
  }>,
  targetId: (entry: { userId?: string; appearanceId: string }) => string,
) {
  for (const entry of entries) {
    if (entry.props.isCurrentUser) continue;

    const id = targetId(entry);
    const ll = entry.marker.getLngLat();
    const wasIn = engine.isInViewport(id);
    const margin = wasIn ? VIEWPORT_EXIT_MARGIN_PX : VIEWPORT_ENTER_MARGIN_PX;
    const visible = isPlayerMarkerInViewport(map, [ll.lng, ll.lat], margin);

    if (visible) engine.enterViewport(id);
    else engine.exitViewport(id);
  }
}

let sharedEngine: PlayerTransitionEngine | null = null;

export function getSharedPlayerTransitionEngine(): PlayerTransitionEngine {
  if (!sharedEngine) sharedEngine = new PlayerTransitionEngine();
  return sharedEngine;
}

export function resetSharedPlayerTransitionEngine() {
  sharedEngine?.reset();
  sharedEngine = null;
}

/** @deprecated Use PlayerTransitionEngine */
export class PlayerMarkerAppearanceController extends PlayerTransitionEngine {}

export function getSharedPlayerMarkerAppearanceController(): PlayerTransitionEngine {
  return getSharedPlayerTransitionEngine();
}

export function resetSharedPlayerMarkerAppearanceController() {
  resetSharedPlayerTransitionEngine();
}
