import mapboxgl from "mapbox-gl";
import type { NavMode } from "./navMode";

export type MapPadding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/** Bumped whenever the DRIVE camera implementation changes. A live controller without this was created before the change. */
export const DRIVE_CAMERA_REVISION = "drive-real-2026-10-01";

export type CameraWriteRecord = {
  at: number;
  method: string;
  mapId: string;
  navMode: string;
  routePhase: string | null;
  center: string;
  zoom: number;
  pitch: number;
  bearing: number;
  purpose: string;
};

const cameraWrites: CameraWriteRecord[] = [];
let mapSerial = 0;
let controllerSerial = 0;
const mapIds = new WeakMap<object, string>();
const controllerIds = new WeakMap<object, string>();

export function mapInstanceId(map: object | null | undefined): string {
  if (!map) return "none";
  let id = mapIds.get(map);
  if (!id) {
    mapSerial += 1;
    id = `map-${mapSerial}`;
    mapIds.set(map, id);
  }
  return id;
}

export function cameraControllerId(controller: object | null | undefined): string {
  if (!controller) return "none";
  let id = controllerIds.get(controller);
  if (!id) {
    controllerSerial += 1;
    id = `cam-${controllerSerial}`;
    controllerIds.set(controller, id);
  }
  return id;
}

export function recentCameraWrites(): CameraWriteRecord[] {
  return cameraWrites.slice(-8);
}

export function recordCameraWrite(entry: CameraWriteRecord) {
  cameraWrites.push(entry);
  if (cameraWrites.length > 40) cameraWrites.shift();
}

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

  // FOLLOW keeps the player slightly above the geometric center.
  if (ctx.navMode === "FOLLOW") {
    const followBias = Math.max(24, Math.round(viewport.height * (0.5 - FOLLOW_PLAYER_Y_RATIO)));
    bottom += followBias;
  }

  // DRIVE looks at a point ahead of the vehicle. Place that point high enough
  // that the vehicle itself sits in the lower-center of the viewport.
  if (ctx.navMode === "DRIVE") {
    const vehicleY = viewport.height * 0.75;
    const aheadPx = Math.min(180, Math.max(110, Math.round(viewport.height * 0.2)));
    const centerY = Math.max(top + 24, vehicleY - aheadPx);
    const focalBottom = viewport.height - top - 2 * (centerY - top);
    bottom = Math.max(bottom, Math.round(focalBottom));
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
  lastHeading: number | null;
  lastAtMs: number;
};

export function createFollowCameraGate(): FollowCameraGate {
  return { lastCenter: null, lastAtMs: 0, lastHeading: null };
}

function headingDelta(a: number, b: number): number {
  return Math.abs(shortestSignedDelta(a, b));
}

function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Signed turn in (-180, 180]. 359° → 1° is +2°, not −358°. */
function shortestSignedDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** DRIVE rotation rate. A right angle finishes in about half a second. */
const DRIVE_HEADING_DEG_PER_SEC = 220;
const DRIVE_HEADING_MAX_STEP_S = 0.05;

function advanceDriveHeading(shown: number, target: number, fromMs: number, nowMs: number): number {
  const dt = Math.min(DRIVE_HEADING_MAX_STEP_S, Math.max(0.008, (nowMs - fromMs) / 1000));
  const delta = shortestSignedDelta(shown, target);
  const step = Math.min(Math.abs(delta), DRIVE_HEADING_DEG_PER_SEC * dt);
  if (Math.abs(delta) - step <= 0.05) return normalizeHeading(target);
  return normalizeHeading(shown + Math.sign(delta) * step);
}

export function shouldApplyFollowCamera(
  gate: FollowCameraGate,
  lat: number,
  lng: number,
  opts: { minIntervalMs?: number; minMoveMeters?: number; force?: boolean; heading?: number } = {},
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
  if (
    opts.heading != null &&
    gate.lastHeading != null &&
    elapsed >= minIntervalMs &&
    headingDelta(gate.lastHeading, opts.heading) >= 6
  ) {
    return true;
  }
  return false;
}

export function recordFollowCamera(
  gate: FollowCameraGate,
  lat: number,
  lng: number,
  heading?: number,
) {
  gate.lastCenter = { lat, lng };
  gate.lastAtMs = Date.now();
  if (heading != null && Number.isFinite(heading)) gate.lastHeading = heading;
}

/** DRIVE tilt. 62° keeps the horizon in view without dropping the 3D frame. */
const DRIVE_VIEW_PITCH = 62;

/** Offset map center ahead of the player in movement direction. */
export function lookAheadCenter(
  lng: number,
  lat: number,
  headingDeg: number,
  navMode: NavMode,
  metersOverride?: number,
): [number, number] {
  if (navMode === "FREE") return [lng, lat];

  const meters = metersOverride ?? (navMode === "DRIVE" ? 42 : 32);
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
  routePhase?: string | null;
};

export type DriveCameraTrace = {
  operation: "jumpTo" | "easeTo" | "skipped";
  reason: string;
  navMode: "DRIVE";
  routePhase: string | null;
  player: { latitude: number; longitude: number };
  target: { latitude: number; longitude: number };
  centerBefore: { latitude: number; longitude: number };
  centerAfter: { latitude: number; longitude: number };
  bearing: number;
  pitch: number;
  zoom: number;
  padding: MapPadding;
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
  /** Ignore the moveend Mapbox fires synchronously while stopping the previous ease. */
  private ignoreMoveEnd = 0;
  /** DRIVE owns the map until navigation ends or the user takes the camera. */
  private driveLock = false;
  private driveAnchor: { lat: number; lng: number; heading: number } | null = null;
  private driveLookAheadM = 42;
  /** Heading currently applied to both bearing and look-ahead. */
  private driveShownHeading: number | null = null;
  private driveHeadingTarget: number | null = null;
  private driveHeadingSpin = 0;
  private driveHeadingStamp = 0;

  releaseDrive() {
    this.cancelHeadingSpin();
    this.driveLock = false;
    this.driveAnchor = null;
    this.driveLookAheadM = 42;
    this.driveShownHeading = null;
    this.driveHeadingTarget = null;
  }

  isDriveOwned() {
    return this.driveLock;
  }

  /** Take the camera before any preview fit or padding jump can write again. */
  claimDrive() {
    this.cancelHeadingSpin();
    this.driveLock = true;
    this.pending = null;
    const map = this.map;
    if (!map) return;
    this.ignoreMoveEnd++;
    try {
      if (map.isMoving()) map.stop();
    } finally {
      this.ignoreMoveEnd--;
    }
  }

  driveLookAheadMeters() {
    return this.driveLookAheadM;
  }
  private activePriority: CameraPriority | null = null;
  private pending: PendingMove | null = null;
  private boundMoveStart: (() => void) | null = null;
  private boundMoveEnd: (() => void) | null = null;
  onProgrammatic?: (active: boolean) => void;
  readonly revision = DRIVE_CAMERA_REVISION;

  attachedMap(): mapboxgl.Map | null {
    return this.map;
  }

  attach(map: mapboxgl.Map) {
    const previous = this.map;
    console.info("[DRIVE-REAL] CAMERA_ATTACH", {
      controllerId: cameraControllerId(this),
      revision: this.revision,
      mapId: mapInstanceId(map),
      previousMapId: mapInstanceId(previous),
      replaced: previous != null && previous !== map,
    });
    this.map = map;
    this.boundMoveStart = () => {
      this.animating = true;
    };
    this.boundMoveEnd = () => {
      if (this.ignoreMoveEnd > 0) return;
      this.animating = false;
      this.activePriority = null;
      this.flushPending();
      this.reassertDriveCamera();
    };
    map.on("movestart", this.boundMoveStart);
    map.on("moveend", this.boundMoveEnd);
  }

  detach() {
    const map = this.map;
    console.info("[DRIVE-REAL] CAMERA_DETACH", {
      controllerId: cameraControllerId(this),
      mapId: mapInstanceId(map),
    });
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

    if (ctx.navMode && ctx.navMode !== "DRIVE") this.releaseDrive();

    const moving = this.animating || !!this.map?.isMoving();
    // setPadding is jumpTo(). During DRIVE that stops the follow and shifts
    // the geographic center away from the player. Padding is applied only
    // inside the DRIVE jump/ease.
    const driveOwnsPadding = this.driveLock || merged.navMode === "DRIVE";
    if (this.map && !moving && !driveOwnsPadding) {
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
      this.ignoreMoveEnd++;
      try {
        markProgrammatic(map, durationMs, opts?.onProgrammatic ?? this.onProgrammatic);
        fn();
      } finally {
        this.ignoreMoveEnd--;
      }
      this.animating = true;
    });
  }

  easeTo(options: mapboxgl.EaseToOptions & CameraMoveOptions) {
    const map = this.map;
    if (!map || this.driveLock) return;

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

  flyTo(options: mapboxgl.FlyToOptions & CameraMoveOptions): boolean {
    const map = this.map;
    if (!map || this.driveLock) return false;

    const { onProgrammatic, duration, force, priority = "navigate", ...rest } = options;
    const target = {
      center: rest.center as [number, number] | undefined,
      zoom: rest.zoom,
      bearing: rest.bearing,
      pitch: rest.pitch,
    };
    const durationMs = duration ?? computeMoveDurationMs(map, target, CAMERA_DURATION_MAX_MS * 0.85, CAMERA_DURATION_MAX_MS);

    if (!force && this.isDuplicateFly(target)) return false;

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
    return true;
  }

  fitBounds(
    bounds: mapboxgl.LngLatBoundsLike,
    options: mapboxgl.FitBoundsOptions & CameraMoveOptions & { dedupeMs?: number } = {},
  ) {
    const map = this.map;
    if (!map || this.driveLock) return;

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
  ): DriveCameraTrace | undefined {
    const map = this.map;
    if (navMode === "DRIVE") {
      const center = map?.getCenter();
      console.info("[DRIVE-REAL] followPlayer", {
        controllerId: cameraControllerId(this),
        revision: this.revision,
        mapId: mapInstanceId(map),
        displayLocation: { latitude: lat, longitude: lng },
        target: (() => {
          const ahead = lookAheadCenter(lng, lat, heading, "DRIVE");
          return { latitude: ahead[1], longitude: ahead[0] };
        })(),
        navMode,
        routePhase: opts.routePhase ?? null,
        mapCenter: center ? { latitude: center.lat, longitude: center.lng } : null,
        zoom: map?.getZoom() ?? null,
        pitch: map?.getPitch() ?? null,
        bearing: map?.getBearing() ?? null,
        skipped: !map ? "no-map" : null,
      });
    }
    if (!map || navMode === "FREE") return;

    if (navMode !== "DRIVE") {
      this.followFreeOrFollow(map, lat, lng, heading, navMode, opts);
      return;
    }

    return this.followDrive(map, lat, lng, heading, opts);
  }

  private followDrive(
    map: mapboxgl.Map,
    lat: number,
    lng: number,
    heading: number,
    opts: CameraMoveOptions & { minIntervalMs?: number },
  ): DriveCameraTrace {
    this.driveLock = true;
    this.pending = null;

    const padding = this.syncPadding({ ...this.paddingContextStore, navMode: "DRIVE" }, false);
    const before = map.getCenter();
    const centerBefore = { latitude: before.lat, longitude: before.lng };
    const zoom = map.getZoom();
    const pitch = map.getPitch();
    const bearing = map.getBearing();
    const headingPending =
      this.driveShownHeading == null ||
      headingDelta(this.driveShownHeading, heading) >= 0.8 ||
      (this.driveHeadingTarget != null && headingDelta(this.driveShownHeading, this.driveHeadingTarget) >= 0.35);
    const bearingOff = headingDelta(bearing, heading) >= 0.8;
    const aimed = this.driveShownHeading ?? heading;
    const provisional = lookAheadCenter(lng, lat, aimed, "DRIVE", this.driveLookAheadM);
    const target = { latitude: provisional[1], longitude: provisional[0] };
    const gapM = distanceMeters(
      { lat: before.lat, lng: before.lng },
      { lat: provisional[1], lng: provisional[0] },
    );
    // A lost frame still jumps. A heading change steps instead of jumping the whole turn.
    const frameOff = gapM > 48 || zoom < 17 || pitch < 55;
    const mustMove = gapM > 8 || frameOff || bearingOff || headingPending;

    const traceBase = {
      navMode: "DRIVE" as const,
      routePhase: opts.routePhase ?? null,
      player: { latitude: lat, longitude: lng },
      target,
      centerBefore,
      bearing,
      pitch,
      zoom,
      padding: map.getPadding() as MapPadding,
    };

    if (!opts.force && !mustMove) {
      if (
        !shouldApplyFollowCamera(this.followGate, lat, lng, {
          minIntervalMs: opts.minIntervalMs ?? 420,
          minMoveMeters: 4,
          heading,
        })
      ) {
        return this.traceDrive(map, { ...traceBase, operation: "skipped", reason: "throttle" });
      }
      if (
        this.isDuplicateFollow(map, {
          center: provisional,
          zoom: 18,
          pitch: DRIVE_VIEW_PITCH,
          bearing: aimed,
        })
      ) {
        return this.traceDrive(map, { ...traceBase, operation: "skipped", reason: "duplicate-frame" });
      }
    }

    const shown = this.presentDriveHeading(heading, !!opts.force);
    this.driveAnchor = { lat, lng, heading: shown };
    const placedCenter = lookAheadCenter(lng, lat, shown, "DRIVE", this.driveLookAheadM);
    const catchingUp =
      this.driveHeadingTarget != null && headingDelta(shown, this.driveHeadingTarget) > 0.35;
    const compose = opts.force || (frameOff && !catchingUp);
    const operation = catchingUp && !compose ? "easeTo" : compose ? "jumpTo" : "easeTo";
    const reason = catchingUp && !compose ? "heading-turn" : frameOff ? "camera-far-from-player" : "player-moved";
    const placed = compose
      ? this.composeDriveFrame(map, lng, lat, shown, padding)
      : { center: placedCenter, lookAheadM: this.driveLookAheadM };
    if (!compose) {
      this.writeDriveFollowFrame(map, placed.center, shown, padding, catchingUp ? 40 : CAMERA_DURATION_MAX_MS);
      if (catchingUp) this.kickHeadingSpin();
    }
    const screen = this.playerScreen(map, lng, lat);
    requestAnimationFrame(() => {
      const after = map.getCenter();
      console.info("[DRIVE-REAL] CAMERA_AFTER_WRITE", {
        mapId: mapInstanceId(map),
        mapCenter: { latitude: after.lat, longitude: after.lng },
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
        heading: shown,
        headingTarget: this.driveHeadingTarget,
        lookAheadM: this.driveLookAheadM,
        playerScreen: this.playerScreen(map, lng, lat),
        type: operation,
      });
    });
    recordFollowCamera(this.followGate, lat, lng, shown);
    return this.traceDrive(map, {
      ...traceBase,
      target: { latitude: placed.center[1], longitude: placed.center[0] },
      operation,
      reason,
      bearing: screen ? shown : bearing,
    });
  }

  /** Adopt the target at once, or move one shortest-angle step toward it. */
  private presentDriveHeading(target: number, immediate: boolean): number {
    const next = normalizeHeading(target);
    this.driveHeadingTarget = next;
    if (immediate || this.driveShownHeading == null) {
      this.cancelHeadingSpin();
      this.driveShownHeading = next;
      this.driveHeadingStamp = performance.now();
      return next;
    }
    const now = performance.now();
    this.driveShownHeading = advanceDriveHeading(this.driveShownHeading, next, this.driveHeadingStamp, now);
    this.driveHeadingStamp = now;
    return this.driveShownHeading;
  }

  private cancelHeadingSpin() {
    if (!this.driveHeadingSpin) return;
    cancelAnimationFrame(this.driveHeadingSpin);
    this.driveHeadingSpin = 0;
  }

  /** Keep bearing and look-ahead on the same heading until the turn finishes. */
  private kickHeadingSpin() {
    if (this.driveHeadingSpin) return;
    const tick = () => {
      this.driveHeadingSpin = 0;
      const map = this.map;
      const anchor = this.driveAnchor;
      if (
        !this.driveLock ||
        !map ||
        !anchor ||
        this.driveShownHeading == null ||
        this.driveHeadingTarget == null
      ) {
        return;
      }
      const now = performance.now();
      const shown = advanceDriveHeading(this.driveShownHeading, this.driveHeadingTarget, this.driveHeadingStamp, now);
      this.driveHeadingStamp = now;
      this.driveShownHeading = shown;
      anchor.heading = shown;
      const center = lookAheadCenter(anchor.lng, anchor.lat, shown, "DRIVE", this.driveLookAheadM);
      this.writeDriveFollowFrame(map, center, shown, this.padding, 40);
      if (headingDelta(shown, this.driveHeadingTarget) > 0.35) {
        this.driveHeadingSpin = requestAnimationFrame(tick);
      }
    };
    this.driveHeadingSpin = requestAnimationFrame(tick);
  }

  private writeDriveFollowFrame(
    map: mapboxgl.Map,
    center: [number, number],
    heading: number,
    padding: MapPadding,
    duration: number,
  ) {
    const write = {
      type: "easeTo",
      targetCenter: { latitude: center[1], longitude: center[0] },
      bearing: heading,
      headingTarget: this.driveHeadingTarget,
      pitch: DRIVE_VIEW_PITCH,
      zoom: 18,
      lookAheadM: this.driveLookAheadM,
      mapId: mapInstanceId(map),
      controllerId: cameraControllerId(this),
      revision: this.revision,
    };
    console.info("[DRIVE-REAL] ACTUAL_CAMERA_WRITE", write);
    console.info("[DRIVE-REAL] CAMERA_WRITE", write);
    this.ignoreMoveEnd++;
    try {
      map.easeTo({
        center,
        zoom: 18,
        pitch: DRIVE_VIEW_PITCH,
        bearing: heading,
        padding,
        duration,
        easing: cameraEaseOut,
        essential: true,
      });
      this.animating = true;
    } finally {
      this.ignoreMoveEnd--;
    }
  }

  /** Place the camera so map.project(player) sits near 75% of the viewport height. */
  private composeDriveFrame(
    map: mapboxgl.Map,
    lng: number,
    lat: number,
    heading: number,
    padding: MapPadding,
  ): { center: [number, number]; lookAheadM: number } {
    const el = map.getContainer();
    const height = el.clientHeight || window.innerHeight || 844;
    this.ignoreMoveEnd++;
    try {
      let lookAheadM = this.driveLookAheadM || 40;
      let center = lookAheadCenter(lng, lat, heading, "DRIVE", lookAheadM);
      let placed = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        map.jumpTo({
          center,
          zoom: 18,
          pitch: DRIVE_VIEW_PITCH,
          bearing: heading,
          padding,
        });
        const yPercent = map.project([lng, lat]).y / height;
        if (yPercent >= 0.72 && yPercent <= 0.75) {
          placed = true;
          break;
        }
        const delta = (0.735 - yPercent) * 160;
        lookAheadM = Math.max(12, Math.min(130, lookAheadM + delta));
        center = lookAheadCenter(lng, lat, heading, "DRIVE", lookAheadM);
      }
      if (!placed) {
        map.jumpTo({
          center,
          zoom: 18,
          pitch: DRIVE_VIEW_PITCH,
          bearing: heading,
          padding,
        });
      }
      this.driveLookAheadM = lookAheadM;
      this.animating = false;
      const screen = this.playerScreen(map, lng, lat);
      console.info("[DRIVE-REAL] ACTUAL_CAMERA_WRITE", {
        type: "jumpTo",
        targetCenter: { latitude: center[1], longitude: center[0] },
        bearing: heading,
        pitch: DRIVE_VIEW_PITCH,
        zoom: 18,
        lookAheadM,
        playerScreen: screen,
        mapId: mapInstanceId(map),
        controllerId: cameraControllerId(this),
        revision: this.revision,
      });
      return { center, lookAheadM };
    } finally {
      this.ignoreMoveEnd--;
    }
  }

  private playerScreen(map: mapboxgl.Map, lng: number, lat: number) {
    const el = map.getContainer();
    const width = el.clientWidth || window.innerWidth || 1;
    const height = el.clientHeight || window.innerHeight || 1;
    const point = map.project([lng, lat]);
    return {
      width,
      height,
      x: point.x,
      y: point.y,
      yPercent: point.y / height,
    };
  }

  private traceDrive(
    map: mapboxgl.Map,
    trace: Omit<DriveCameraTrace, "centerAfter">,
  ): DriveCameraTrace {
    const after = map.getCenter();
    const full: DriveCameraTrace = {
      ...trace,
      centerAfter: { latitude: after.lat, longitude: after.lng },
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      zoom: map.getZoom(),
      padding: map.getPadding() as MapPadding,
    };
    console.info("[StreetGrid DRIVE camera]", {
      displayLocation: full.player,
      cameraTarget: full.target,
      mapCenter: full.centerAfter,
      mapCenterBefore: full.centerBefore,
      bearing: full.bearing,
      pitch: full.pitch,
      zoom: full.zoom,
      padding: full.padding,
      navMode: full.navMode,
      routePhase: full.routePhase,
      calledJumpTo: full.operation === "jumpTo",
      calledEaseTo: full.operation === "easeTo",
      skipped: full.operation === "skipped" ? full.reason : null,
    });
    return full;
  }

  /** If a preview fit or padding jump left the lens away from the player, put it back. */
  private reasserting = false;
  private reassertDriveCamera() {
    if (this.reasserting) return;
    const map = this.map;
    const anchor = this.driveAnchor;
    if (!this.driveLock || !map || !anchor || map.isMoving()) return;
    const center = lookAheadCenter(anchor.lng, anchor.lat, anchor.heading, "DRIVE", this.driveLookAheadM);
    const gapM = distanceMeters(
      { lat: map.getCenter().lat, lng: map.getCenter().lng },
      { lat: center[1], lng: center[0] },
    );
    if (
      this.driveHeadingTarget != null &&
      this.driveShownHeading != null &&
      headingDelta(this.driveShownHeading, this.driveHeadingTarget) > 0.35
    ) {
      return;
    }
    if (gapM <= 48 && map.getZoom() >= 17 && map.getPitch() >= 55) return;
    this.reasserting = true;
    try {
      this.followDrive(map, anchor.lat, anchor.lng, anchor.heading, { force: true });
    } finally {
      this.reasserting = false;
    }
  }

  private followFreeOrFollow(
    map: mapboxgl.Map,
    lat: number,
    lng: number,
    heading: number,
    navMode: NavMode,
    opts: CameraMoveOptions & { minIntervalMs?: number },
  ) {
    if (opts.force) this.pending = null;

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
    const targetZoom = currentZoom;
    const targetPitch = map.getPitch();
    const targetBearing = map.getBearing();
    const followTarget = { center, zoom: targetZoom, pitch: targetPitch, bearing: targetBearing };

    if (!opts.force && this.isDuplicateFollow(map, followTarget)) return;

    const durationMs = computeMoveDurationMs(
      map,
      followTarget,
      CAMERA_DURATION_MIN_MS,
      CAMERA_DURATION_MIN_MS + 80,
    );

    this.startMove(
      "follow",
      durationMs,
      () => {
        recordFollowCamera(this.followGate, lat, lng);
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
