/**
 * Cluster ↔ player transition controller — 220ms ease-out, GPU opacity + transform only.
 */

import {
  getSharedPlayerMarkerAppearanceController,
} from "@/lib/streetgrid/playerMarkerAppearance";

export const CLUSTER_TRANSITION_MS = 220;
export const CLUSTER_SCALE_VISIBLE = 1;
export const CLUSTER_SCALE_HIDDEN = 0.92;

export function clusterEaseOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}

export type ClusterDomTarget = {
  clusterId: string;
  container: HTMLElement;
  stage: HTMLElement;
};

type ClusterPhase = "visible" | "hidden" | "to-visible" | "to-hidden";

type ClusterVisualState = {
  clusterId: string;
  container: HTMLElement;
  stage: HTMLElement;
  phase: ClusterPhase;
  animStart: number;
  animFrom: number;
  animTo: number;
  membership: number;
  zoomOpacity: number;
  onHidden: Array<() => void>;
  hiddenFired: boolean;
};

function playerId(userId: string): string {
  return `player:${userId}`;
}

function applyClusterDom(state: ClusterVisualState, now: number) {
  let m = state.membership;
  if (state.phase === "to-visible" || state.phase === "to-hidden") {
    const t = clusterEaseOut(Math.min(1, (now - state.animStart) / CLUSTER_TRANSITION_MS));
    m = state.animFrom + (state.animTo - state.animFrom) * t;
    state.membership = m;

    if (now - state.animStart >= CLUSTER_TRANSITION_MS) {
      state.membership = state.animTo;
      m = state.animTo;
      state.phase = state.animTo >= 0.99 ? "visible" : "hidden";
      if (state.phase === "hidden") fireClusterHidden(state);
    }
  }

  const scale =
    CLUSTER_SCALE_HIDDEN + (CLUSTER_SCALE_VISIBLE - CLUSTER_SCALE_HIDDEN) * m;
  const opacity = m * state.zoomOpacity;

  state.container.style.setProperty("--presence-opacity", String(opacity));
  state.stage.style.transform = `translateZ(0) scale(${scale})`;
  state.container.style.pointerEvents = opacity > 0.04 ? "auto" : "none";
}

function fireClusterHidden(state: ClusterVisualState) {
  if (state.hiddenFired) return;
  state.hiddenFired = true;
  for (const cb of state.onHidden) cb();
  state.onHidden.length = 0;
}

function clusterKey(id: string): string {
  return `cluster:${id}`;
}

export class ClusterTransitionController {
  private clusters = new Map<string, ClusterVisualState>();
  private rafId: number | null = null;

  reset() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clusters.clear();
  }

  registerCluster(target: ClusterDomTarget) {
    const key = clusterKey(target.clusterId);
    const existing = this.clusters.get(key);
    if (existing) {
      existing.container = target.container;
      existing.stage = target.stage;
      return;
    }

    target.container.style.setProperty("--presence-opacity", "0");
    target.stage.style.transform = `translateZ(0) scale(${CLUSTER_SCALE_HIDDEN})`;

    this.clusters.set(key, {
      clusterId: target.clusterId,
      container: target.container,
      stage: target.stage,
      phase: "hidden",
      animStart: 0,
      animFrom: 0,
      animTo: 0,
      membership: 0,
      zoomOpacity: 0,
      onHidden: [],
      hiddenFired: false,
    });
  }

  unregisterCluster(clusterId: string) {
    this.clusters.delete(clusterKey(clusterId));
    this.maybeStop();
  }

  setClusterZoomOpacity(clusterId: string, opacity: number) {
    const state = this.clusters.get(clusterKey(clusterId));
    if (!state) return;
    state.zoomOpacity = Math.max(0, Math.min(1, opacity));
    applyClusterDom(state, performance.now());
    this.ensureRunning();
  }

  /** Cluster forming — disc fades in while players fade out. */
  formCluster(clusterId: string, memberIds: readonly string[]) {
    const appearance = getSharedPlayerMarkerAppearanceController();
    for (const userId of memberIds) {
      appearance.setClusterMembership(playerId(userId), true);
    }
    this.animateCluster(clusterId, 1);
  }

  /** Cluster dissolving — disc fades out while players fade in. */
  dissolveCluster(clusterId: string, memberIds: readonly string[]) {
    const appearance = getSharedPlayerMarkerAppearanceController();
    for (const userId of memberIds) {
      appearance.setClusterMembership(playerId(userId), false);
    }
    this.animateCluster(clusterId, 0);
  }

  /** Additional members merged into an existing visible cluster. */
  mergeMembers(memberIds: readonly string[]) {
    const appearance = getSharedPlayerMarkerAppearanceController();
    for (const userId of memberIds) {
      appearance.setClusterMembership(playerId(userId), true);
    }
    this.ensureRunning();
  }

  primeClusterEnter(clusterId: string, zoomOpacity: number) {
    const state = this.clusters.get(clusterKey(clusterId));
    if (!state) return;
    state.zoomOpacity = zoomOpacity;
    state.phase = "to-visible";
    state.animStart = performance.now();
    state.animFrom = 0;
    state.animTo = 1;
    state.hiddenFired = false;
    this.ensureRunning();
  }

  whenClusterHidden(clusterId: string, cb: () => void) {
    const state = this.clusters.get(clusterKey(clusterId));
    if (!state) {
      cb();
      return;
    }
    if (state.phase === "hidden" && state.membership <= 0.01) {
      cb();
      return;
    }
    state.onHidden.push(cb);
    state.hiddenFired = false;
    this.ensureRunning();
  }

  setPlayerZoomOpacity(userId: string, opacity: number) {
    getSharedPlayerMarkerAppearanceController().setZoomOpacity(
      playerId(userId),
      opacity,
    );
  }

  private animateCluster(clusterId: string, target: number) {
    const state = this.clusters.get(clusterKey(clusterId));
    if (!state) return;

    const current =
      state.phase === "visible" ? 1 : state.phase === "hidden" ? 0 : state.membership;

    if (Math.abs(current - target) < 0.01 && state.phase !== "to-visible" && state.phase !== "to-hidden") {
      return;
    }

    state.phase = target >= 0.5 ? "to-visible" : "to-hidden";
    state.animStart = performance.now();
    state.animFrom = current;
    state.animTo = target;
    state.hiddenFired = false;
    this.ensureRunning();
  }

  private ensureRunning() {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private maybeStop() {
    if (this.clusters.size === 0 && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (now: number) => {
    let active = false;
    for (const state of this.clusters.values()) {
      if (state.phase === "to-visible" || state.phase === "to-hidden") active = true;
      applyClusterDom(state, now);
      if (state.onHidden.length > 0) active = true;
    }
    this.rafId = active ? requestAnimationFrame(this.tick) : null;
  };
}

let shared: ClusterTransitionController | null = null;

export function getSharedClusterTransitionController(): ClusterTransitionController {
  if (!shared) shared = new ClusterTransitionController();
  return shared;
}

export function resetSharedClusterTransitionController() {
  shared?.reset();
  shared = null;
}
