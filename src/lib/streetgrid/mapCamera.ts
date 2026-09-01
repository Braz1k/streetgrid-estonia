import mapboxgl from "mapbox-gl";
import type { NavMode } from "./navMode";

export type MapPadding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/** Cinematic camera timing — 350–600 ms scaled by move magnitude. */
export const CAMERA_DURATION_MIN_MS = 350;
export const CAMERA_DURATION_MAX_MS = 600;

/** @deprecated Use CAMERA_DURATION_MIN_MS */
export const CAMERA_DURATION_MS = CAMERA_DURATION_MIN_MS;
export const CAMERA_DURATION_MIN = CAMERA_DURATION_MIN_MS;
export const CAMERA_DURATION_DEFAULT = CAMERA_DURATION_MIN_MS;
export const CAMERA_DURATION_MAX = CAMERA_DURATION_MAX_MS;
export const CAMERA_DURATION_FOLLOW = CAMERA_DURATION_MIN_MS;
export const CAMERA_DURATION_DRIVE = CAMERA_DURATION_MAX_MS;
export const CAMERA_DURATION_CITY = CAMERA_DURATION_MAX_MS;
export const CAMERA_DURATION_INITIAL = CAMERA_DURATION_MAX_MS;

/** Follow mode — player sits ~42% from top (slightly below visual center). */
export const FOLLOW_PLAYER_Y_RATIO = 0.42;

export function cameraEaseOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}

/** @deprecated Use cameraEaseOut */
export function cameraEaseInOut(t: number): number {
  return cameraEaseOut(t);
}

export function clampCameraDuration(ms: number): number {
  return Math.max(CAMERA_DURATION_MIN_MS, Math.min(CAMERA_DURATION_MAX_MS, Math.round(ms)));
}

function parseCssPx(value: string, fallback: number): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseCssLength(value: string, fallback: number): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.endsWith("px")) return parseCssPx(trimmed, fallback);
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

export type CameraPaddingContext = {
  searchOpen?: boolean;
  playerSheetOpen?: boolean;
  routeBanner?: boolean;
  navMode?: NavMode;
  clusterMembers?: number;
};

export type ViewportSize = { width: number; height: number };

function readViewportSize(): ViewportSize {
  return {
    width: window.innerWidth || 390,
    height: window.innerHeight || 844,
  };
}

/**
 * Dynamic safe-area padding from shell chrome.
 * Biases the visible map frame so follow targets sit at ~42% viewport height.
 */
export function computeDynamicPadding(
  ctx: CameraPaddingContext = {},
  viewport: ViewportSize = readViewportSize(),
): MapPadding {
  const root = getComputedStyle(document.documentElement);
  const topUi = parseCssLength(root.getPropertyValue("--sg-top-ui-height"), 140);
  const tabBar = parseCssLength(root.getPropertyValue("--sg-tabbar-height"), 52);
  const side = parseCssPx(root.getPropertyValue("--sg-map-camera-side-pad"), 28);
  const fabGutter = parseCssPx(root.getPropertyValue("--sg-map-fab-gutter"), 56);
  const searchHeight = parseCssPx(root.getPropertyValue("--sg-map-search-height"), 48);
  const searchTrackBottom = parseCssPx(root.getPropertyValue("--sg-map-search-track-bottom"), 70);

  let top = topUi + 10;
  let bottom = tabBar + searchTrackBottom + searchHeight * 0.45 + 14;
  let left = side;
  let right = Math.max(side, fabGutter);

  if (ctx.routeBanner) top += 52;
  if (ctx.searchOpen) bottom += searchHeight + 88;
  if (ctx.playerSheetOpen) bottom += 200;

  const clusterMembers = ctx.clusterMembers ?? 0;
  if (clusterMembers > 1) {
    const clusterPad = Math.min(40, 10 + Math.sqrt(clusterMembers) * 7);
    top += clusterPad * 0.35;
    bottom += clusterPad;
    left += clusterPad * 0.25;
    right += clusterPad * 0.25;
  }

  // Visual center: player ~42% from top → extra bottom inset in follow modes.
  if (ctx.navMode === "FOLLOW" || ctx.navMode === "DRIVE") {
    const followBias = Math.max(24, Math.round(viewport.height * (0.5 - FOLLOW_PLAYER_Y_RATIO)));
    bottom += followBias;
    if (ctx.navMode === "DRIVE") {
      bottom += Math.round(followBias * 0.35);
      top += 12;
    }
  }

  return {
    top: Math.round(top),
    bottom: Math.round(bottom),
    left: Math.round(left),
    right: Math.round(right),
  };
}

/** @deprecated Use computeDynamicPadding */
export function measureMapPadding(_container: HTMLElement): MapPadding {
  return computeDynamicPadding();
}

/** @deprecated Use computeDynamicPadding via MapCameraController */
export function getMapPaddingForMap(_map: mapboxgl.Map): MapPadding {
  return computeDynamicPadding();
}

export function applyMapPadding(map: mapboxgl.Map, padding: MapPadding) {
  map.setPadding(padding);
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export type FollowCameraGate = {
  lastCenter: { lat: number; lng: number } | null;
  lastAtMs: number;
};

export function createFollowCameraGate(): FollowCameraGate {
  return { lastCenter: null, lastAtMs: 0 };
}

export function shouldApplyFollowCamera(
  gate: FollowCameraGate,
  lat: number,
  lng: number,
  opts: { minIntervalMs?: number; minMoveMeters?: number; force?: boolean } = {},
): boolean {
  if (opts.force) return true;
  const minIntervalMs = opts.minIntervalMs ?? 480;
  const minMoveMeters = opts.minMoveMeters ?? 6;
  const now = Date.now();
  if (!gate.lastCenter) return true;

  const moved = distanceMeters(gate.lastCenter, { lat, lng });
  const elapsed = now - gate.lastAtMs;
  if (elapsed >= minIntervalMs && moved >= minMoveMeters) return true;
  if (moved >= minMoveMeters * 2.8) return true;
  return false;
}

export function recordFollowCamera(gate: FollowCameraGate, lat: number, lng: number) {
  gate.lastCenter = { lat, lng };
  gate.lastAtMs = Date.now();
}

/** Offset map center ahead of the player in movement direction. */
export function lookAheadCenter(
  lng: number,
  lat: number,
  headingDeg: number,
  navMode: NavMode,
): [number, number] {
  if (navMode === "FREE") return [lng, lat];

  const meters = navMode === "DRIVE" ? 78 : 32;
  const bearing = ((headingDeg % 360) + 360) % 360;
  const rad = (bearing * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(latRad);

  const dNorth = meters * Math.cos(rad);
  const dEast = meters * Math.sin(rad);

  return [lng + dEast / mPerDegLng, lat + dNorth / mPerDegLat];
}

function boundsKey(bounds: mapboxgl.LngLatBoundsLike): string {
  const b =
    bounds instanceof mapboxgl.LngLatBounds
      ? bounds
      : new mapboxgl.LngLatBounds(bounds as [[number, number], [number, number]]);
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return [sw.lng.toFixed(5), sw.lat.toFixed(5), ne.lng.toFixed(5), ne.lat.toFixed(5)].join("|");
}

function paddingKey(p: MapPadding): string {
  return `${p.top}|${p.bottom}|${p.left}|${p.right}`;
}

function lngLatKey(lng: number, lat: number): string {
  return `${lng.toFixed(5)}|${lat.toFixed(5)}`;
}

function bearingDelta(a: number, b: number): number {
  return Math.abs((((b - a + 540) % 360) - 180));
}

function computeMoveDurationMs(
  map: mapboxgl.Map,
  target: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
  },
  minMs = CAMERA_DURATION_MIN_MS,
  maxMs = CAMERA_DURATION_MAX_MS,
): number {
  const center = map.getCenter();
  const dist =
    target.center != null
      ? distanceMeters(
          { lat: center.lat, lng: center.lng },
          { lat: target.center[1], lng: target.center[0] },
        )
      : 0;
  const zoomDelta = target.zoom != null ? Math.abs(target.zoom - map.getZoom()) : 0;
  const bearingChange =
    target.bearing != null ? bearingDelta(map.getBearing(), target.bearing) : 0;
  const pitchDelta = target.pitch != null ? Math.abs(target.pitch - map.getPitch()) : 0;

  const distFactor = Math.min(1, dist / 900) * 180;
  const zoomFactor = Math.min(1, zoomDelta / 4) * 120;
  const bearingFactor = Math.min(1, bearingChange / 90) * 80;
  const pitchFactor = Math.min(1, pitchDelta / 45) * 60;

  return clampCameraDuration(minMs + distFactor + zoomFactor + bearingFactor + pitchFactor);
}

type CameraPriority = "follow" | "adjust" | "navigate" | "fit";

type PendingMove = {
  priority: CameraPriority;
  run: () => void;
};

type CameraMoveOptions = {
  onProgrammatic?: (active: boolean) => void;
  duration?: number;
  force?: boolean;
  priority?: CameraPriority;
};

function markProgrammatic(
  map: mapboxgl.Map,
  durationMs: number,
  onProgrammatic?: (active: boolean) => void,
) {
  onProgrammatic?.(true);
  let cleared = false;
  const clear = () => {
    if (cleared) return;
    cleared = true;
    onProgrammatic?.(false);
  };
  map.once("moveend", clear);
  window.setTimeout(clear, durationMs + 80);
}

/**
 * Single authoritative map camera — one animation at a time, coalesced intents,
 * dynamic padding, throttled follow, deduped fitBounds.
 */
export class MapCameraController {
  private map: mapboxgl.Map | null = null;
  private padding: MapPadding = { top: 0, bottom: 0, left: 0, right: 0 };
  private paddingCtxKey = "";
  private paddingContextStore: CameraPaddingContext = {};
  private followGate = createFollowCameraGate();
  private lastFitKey = "";
  private lastFitAtMs = 0;
  private lastFlyKey = "";
  private lastFlyAtMs = 0;
  private animating = false;
  private activePriority: CameraPriority | null = null;
  private pending: PendingMove | null = null;
  private boundMoveStart: (() => void) | null = null;
  private boundMoveEnd: (() => void) | null = null;
  onProgrammatic?: (active: boolean) => void;

  attach(map: mapboxgl.Map) {
    this.map = map;
    this.boundMoveStart = () => {
      this.animating = true;
    };
    this.boundMoveEnd = () => {
      this.animating = false;
      this.activePriority = null;
      this.flushPending();
    };
    map.on("movestart", this.boundMoveStart);
    map.on("moveend", this.boundMoveEnd);
  }

  detach() {
    const map = this.map;
    if (map && this.boundMoveStart) map.off("movestart", this.boundMoveStart);
    if (map && this.boundMoveEnd) map.off("moveend", this.boundMoveEnd);
    this.map = null;
    this.animating = false;
    this.activePriority = null;
    this.pending = null;
    this.boundMoveStart = null;
    this.boundMoveEnd = null;
  }

  getPadding(): MapPadding {
    return this.padding;
  }

  private viewportSize(): ViewportSize {
    const map = this.map;
    if (!map) return readViewportSize();
    const el = map.getContainer();
    return {
      width: el.clientWidth || window.innerWidth,
      height: el.clientHeight || window.innerHeight,
    };
  }

  /** Recompute padding from shell chrome; apply on next move unless forced. */
  syncPadding(ctx: CameraPaddingContext = {}, force = false): MapPadding {
    if (Object.keys(ctx).length > 0) {
      this.paddingContextStore = { ...this.paddingContextStore, ...ctx };
    }
    const merged = this.paddingContextStore;
    const next = computeDynamicPadding(merged, this.viewportSize());
    const key = paddingKey(next) + JSON.stringify(merged);
    if (!force && key === this.paddingCtxKey) return this.padding;

    this.padding = next;
    this.paddingCtxKey = key;

    if (this.map && (force || !this.animating)) {
      applyMapPadding(this.map, next);
    }
    return next;
  }

  setPaddingContext(ctx: CameraPaddingContext) {
    this.syncPadding(ctx, true);
  }

  private flushPending() {
    if (!this.pending || this.animating) return;
    const next = this.pending;
    this.pending = null;
    next.run();
  }

  private scheduleOrRun(priority: CameraPriority, force: boolean | undefined, run: () => void) {
    if (this.animating && !force) {
      if (!this.pending || priorityRank(priority) >= priorityRank(this.pending.priority)) {
        this.pending = { priority, run };
      }
      return;
    }
    run();
  }

  private startMove(
    priority: CameraPriority,
    durationMs: number,
    fn: () => void,
    opts?: CameraMoveOptions,
  ) {
    const map = this.map;
    if (!map) return;

    this.scheduleOrRun(priority, opts?.force, () => {
      this.activePriority = priority;
      this.animating = true;
      applyMapPadding(map, this.padding);
      markProgrammatic(map, durationMs, opts?.onProgrammatic ?? this.onProgrammatic);
      fn();
    });
  }

  easeTo(options: mapboxgl.EaseToOptions & CameraMoveOptions) {
    const map = this.map;
    if (!map) return;

    const { onProgrammatic, duration, force, priority = "navigate", ...rest } = options;
    const target = {
      center: rest.center as [number, number] | undefined,
      zoom: rest.zoom,
      bearing: rest.bearing,
      pitch: rest.pitch,
    };
    const durationMs = duration ?? computeMoveDurationMs(map, target);

    if (!force && this.isDuplicateEase(map, target)) return;

    this.startMove(
      priority,
      durationMs,
      () => {
        map.easeTo({
          ...rest,
          padding: rest.padding ?? this.padding,
          duration: durationMs,
          easing: rest.easing ?? cameraEaseOut,
          essential: rest.essential ?? true,
        });
      },
      { onProgrammatic, force },
    );
  }

  flyTo(options: mapboxgl.FlyToOptions & CameraMoveOptions) {
    const map = this.map;
    if (!map) return;

    const { onProgrammatic, duration, force, priority = "navigate", ...rest } = options;
    const target = {
      center: rest.center as [number, number] | undefined,
      zoom: rest.zoom,
      bearing: rest.bearing,
      pitch: rest.pitch,
    };
    const durationMs = duration ?? computeMoveDurationMs(map, target, CAMERA_DURATION_MAX_MS * 0.85, CAMERA_DURATION_MAX_MS);

    if (!force && this.isDuplicateFly(target)) return;

    this.startMove(
      priority,
      durationMs,
      () => {
        map.flyTo({
          ...rest,
          padding: rest.padding ?? this.padding,
          duration: durationMs,
          easing: rest.easing ?? cameraEaseOut,
          essential: rest.essential ?? true,
        });
      },
      { onProgrammatic, force },
    );
  }

  fitBounds(
    bounds: mapboxgl.LngLatBoundsLike,
    options: mapboxgl.FitBoundsOptions & CameraMoveOptions & { dedupeMs?: number } = {},
  ) {
    const map = this.map;
    if (!map) return;

    const pad = (options.padding ?? this.padding) as MapPadding;
    const maxZoom = options.maxZoom ?? 18;
    const fitKey = `${boundsKey(bounds)}|${paddingKey(pad)}|${maxZoom.toFixed(2)}`;
    const now = Date.now();
    const dedupeMs = options.dedupeMs ?? 1400;

    if (!options.force && fitKey === this.lastFitKey && now - this.lastFitAtMs < dedupeMs) {
      return;
    }

    this.lastFitKey = fitKey;
    this.lastFitAtMs = now;

    const { onProgrammatic, duration, force, dedupeMs: _d, priority = "fit", ...rest } = options;
    const durationMs = duration ?? CAMERA_DURATION_MAX_MS;

    this.startMove(
      priority,
      durationMs,
      () => {
        map.fitBounds(bounds, {
          ...rest,
          padding: pad,
          duration: durationMs,
          easing: rest.easing ?? cameraEaseOut,
          maxZoom,
          linear: false,
        });
      },
      { onProgrammatic, force },
    );
  }

  /** GPS follow — throttled, look-ahead, single ease per tick, no zoom micro-steps. */
  followPlayer(
    lat: number,
    lng: number,
    heading: number,
    navMode: NavMode,
    opts: CameraMoveOptions & { minIntervalMs?: number } = {},
  ) {
    const map = this.map;
    if (!map || navMode === "FREE") return;

    if (
      !opts.force &&
      !shouldApplyFollowCamera(this.followGate, lat, lng, {
        minIntervalMs: opts.minIntervalMs ?? 480,
      })
    ) {
      return;
    }

    const center = lookAheadCenter(lng, lat, heading, navMode);
    const padding = this.syncPadding({ ...this.paddingContextStore, navMode }, false);

    const currentZoom = map.getZoom();
    const targetZoom = navMode === "DRIVE" ? 18 : currentZoom;
    const targetPitch = navMode === "DRIVE" ? 65 : map.getPitch();
    const targetBearing = navMode === "DRIVE" ? heading : map.getBearing();

    const followTarget = {
      center,
      zoom: targetZoom,
      pitch: targetPitch,
      bearing: targetBearing,
    };

    if (!opts.force && this.isDuplicateFollow(map, followTarget)) return;

    const durationMs = computeMoveDurationMs(
      map,
      followTarget,
      CAMERA_DURATION_MIN_MS,
      navMode === "DRIVE" ? CAMERA_DURATION_MAX_MS : CAMERA_DURATION_MIN_MS + 80,
    );

    this.startMove(
      "follow",
      durationMs,
      () => {
        map.easeTo({
          center,
          zoom: targetZoom,
          pitch: targetPitch,
          bearing: targetBearing,
          padding,
          duration: durationMs,
          easing: cameraEaseOut,
          essential: true,
        });
      },
      { onProgrammatic: opts.onProgrammatic, force: opts.force },
    );

    recordFollowCamera(this.followGate, lat, lng);
  }

  /** After user pinch-zoom in follow modes — one recentre, deduped against GPS follow. */
  recenterAfterGesture(
    lat: number,
    lng: number,
    heading: number,
    navMode: NavMode,
    opts: CameraMoveOptions = {},
  ) {
    const gate = this.followGate;
    const elapsed = Date.now() - gate.lastAtMs;
    if (!opts.force && elapsed < 280) return;
    this.followPlayer(lat, lng, heading, navMode, { ...opts, force: true, minIntervalMs: 0 });
  }

  /** Gentle pitch restore — never interrupts navigation or fit animations. */
  ensurePitch(targetPitch: number, opts: CameraMoveOptions = {}) {
    const map = this.map;
    if (!map || this.animating) return;
    const current = map.getPitch();
    if (Math.abs(current - targetPitch) < 4) return;

    this.easeTo({
      pitch: targetPitch,
      duration: CAMERA_DURATION_MIN_MS,
      priority: "adjust",
      force: opts.force,
      onProgrammatic: opts.onProgrammatic,
    });
  }

  resetFollowGate() {
    this.followGate = createFollowCameraGate();
  }

  fitClusterMembers(
    members: Array<{ location: [number, number] }>,
    toLngLat: (loc: [number, number]) => [number, number],
    maxZoom: number,
    opts: CameraMoveOptions = {},
  ) {
    const map = this.map;
    if (!map || members.length === 0) return;

    this.syncPadding({
      ...this.paddingContextStore,
      clusterMembers: members.length,
    });

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const m of members) {
      const [lng, lat] = toLngLat(m.location);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    const padLng = members.length === 1 ? 0.0006 : Math.min(0.003, 0.0008 * Math.sqrt(members.length));
    const padLat = padLng;

    if (members.length === 1) {
      const currentZoom = map.getZoom();
      const targetZoom = Math.min(currentZoom + 0.65, maxZoom);
      const [lng, lat] = toLngLat(members[0].location);
      this.easeTo({
        center: [lng, lat],
        zoom: targetZoom,
        padding: this.padding,
        priority: "fit",
        onProgrammatic: opts.onProgrammatic,
        force: opts.force,
      });
      return;
    }

    this.fitBounds(
      [
        [minLng - padLng, minLat - padLat],
        [maxLng + padLng, maxLat + padLat],
      ],
      {
        padding: this.padding,
        maxZoom,
        priority: "fit",
        onProgrammatic: opts.onProgrammatic,
        force: opts.force,
      },
    );
  }

  private isDuplicateFly(target: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
  }): boolean {
    if (target.center == null) return false;
    const key = `${lngLatKey(target.center[0], target.center[1])}|${(target.zoom ?? 0).toFixed(2)}`;
    const now = Date.now();
    if (key === this.lastFlyKey && now - this.lastFlyAtMs < 700) return true;
    this.lastFlyKey = key;
    this.lastFlyAtMs = now;
    return false;
  }

  private isDuplicateEase(
    map: mapboxgl.Map,
    target: {
      center?: [number, number];
      zoom?: number;
      bearing?: number;
      pitch?: number;
    },
  ): boolean {
    if (target.center == null && target.zoom == null && target.pitch == null) return false;
    const center = map.getCenter();
    if (target.center != null) {
      const moved = distanceMeters(
        { lat: center.lat, lng: center.lng },
        { lat: target.center[1], lng: target.center[0] },
      );
      if (moved < 4) {
        if (target.zoom == null || Math.abs(map.getZoom() - target.zoom) < 0.08) {
          if (target.pitch == null || Math.abs(map.getPitch() - target.pitch) < 2) return true;
        }
      }
    } else if (target.pitch != null && Math.abs(map.getPitch() - target.pitch) < 2) {
      return true;
    }
    return false;
  }

  private isDuplicateFollow(
    map: mapboxgl.Map,
    target: {
      center: [number, number];
      zoom: number;
      pitch: number;
      bearing: number;
    },
  ): boolean {
    const center = map.getCenter();
    const moved = distanceMeters(
      { lat: center.lat, lng: center.lng },
      { lat: target.center[1], lng: target.center[0] },
    );
    return (
      moved < 3 &&
      Math.abs(map.getZoom() - target.zoom) < 0.06 &&
      Math.abs(map.getPitch() - target.pitch) < 1.5 &&
      bearingDelta(map.getBearing(), target.bearing) < 2
    );
  }
}

function priorityRank(p: CameraPriority): number {
  switch (p) {
    case "adjust":
      return 0;
    case "follow":
      return 1;
    case "fit":
      return 2;
    case "navigate":
      return 3;
    default:
      return 0;
  }
}

/** Legacy helpers — route through controller constants. */
export function smoothFlyTo(
  map: mapboxgl.Map,
  options: mapboxgl.FlyToOptions & { onProgrammatic?: (active: boolean) => void },
) {
  const duration = computeMoveDurationMs(map, {
    center: options.center as [number, number] | undefined,
    zoom: options.zoom,
    bearing: options.bearing,
    pitch: options.pitch,
  });
  markProgrammatic(map, duration, options.onProgrammatic);
  map.flyTo({
    ...options,
    duration,
    easing: options.easing ?? cameraEaseOut,
    essential: options.essential ?? true,
  });
}

export function smoothEaseTo(
  map: mapboxgl.Map,
  options: mapboxgl.EaseToOptions & { onProgrammatic?: (active: boolean) => void },
) {
  const duration = computeMoveDurationMs(map, {
    center: options.center as [number, number] | undefined,
    zoom: options.zoom,
    bearing: options.bearing,
    pitch: options.pitch,
  });
  markProgrammatic(map, duration, options.onProgrammatic);
  map.easeTo({
    ...options,
    duration,
    easing: options.easing ?? cameraEaseOut,
    essential: options.essential ?? true,
  });
}

export function smoothFitBounds(
  map: mapboxgl.Map,
  bounds: mapboxgl.LngLatBoundsLike,
  options: mapboxgl.FitBoundsOptions & { onProgrammatic?: (active: boolean) => void },
) {
  markProgrammatic(map, CAMERA_DURATION_MAX_MS, options.onProgrammatic);
  map.fitBounds(bounds, {
    ...options,
    duration: options.duration ?? CAMERA_DURATION_MAX_MS,
    easing: options.easing ?? cameraEaseOut,
  });
}
