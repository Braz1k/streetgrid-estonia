/** Multi-zoom presence — clusters ↔ avatars ↔ 3D vehicles. */

export const ZOOM_CLUSTER_ONLY_MAX = 12;
export const CLUSTER_EXPAND_START = 13;
export const CLUSTER_EXPAND_END = 15;

export const ZOOM_AVATAR_MIN = 12;
export const ZOOM_AVATAR_SOCIAL_FULL = 13;
export const ZOOM_AVATAR_MAX = 15;

/** Hysteresis — cluster mode vs player mode (prevents flicker during pinch). */
export const HYST_CLUSTER_MODE_MAX = 12.5;
export const HYST_AVATAR_MODE_MIN = 14.5;

/** Crossfade avatars → 3D cars (unchanged band). */
export const AVATAR_3D_FADE_START = 13;
export const AVATAR_3D_FADE_END = 15;

export const PRESENCE_CROSSFADE_START = AVATAR_3D_FADE_START;
export const PRESENCE_CROSSFADE_END = AVATAR_3D_FADE_END;

/** Screen-space merge radius — wide when clustered, tight when expanded. */
export const CLUSTER_MERGE_RADIUS_WIDE = 52;
export const CLUSTER_MERGE_RADIUS_TIGHT = 26;

/** Cluster ↔ individual crossfade band (zoom 13 → 15). */
export const CLUSTER_EXPAND_FADE_START = CLUSTER_EXPAND_START;
export const CLUSTER_EXPAND_FADE_END = CLUSTER_EXPAND_END;

/** Opacity + scale transition (~300ms rAF lerp, spring-like handoff). */
export const PRESENCE_TRANSITION_MS = 300;

/** Cluster visual expand band — zoom 13 → 14 (before full individual at ≥15). */
export const CLUSTER_VISUAL_EXPAND_START = 13;
export const CLUSTER_VISUAL_EXPAND_END = 14;

/** Scale at opacity 0 / 1 during cluster ↔ player handoff. */
export const PRESENCE_SCALE_MIN = 0.85;
export const PRESENCE_SCALE_MAX = 1;

/** Legacy aliases */
export const ZOOM_CLUSTER_AVATAR_FADE_START = HYST_CLUSTER_MODE_MAX;
export const ZOOM_CLUSTER_AVATAR_FADE_END = HYST_AVATAR_MODE_MIN;
export const HYST_CLUSTER_AVATAR_SHOW_MIN = HYST_AVATAR_MODE_MIN;
export const HYST_CLUSTER_AVATAR_HIDE_MAX = HYST_CLUSTER_MODE_MAX;
export const PLAYER_FAR_MAX_ZOOM = ZOOM_CLUSTER_ONLY_MAX - 0.001;
export const PLAYER_DETAILED_MIN_ZOOM = HYST_AVATAR_MODE_MIN;
export const PLAYER_NEAR_MIN_ZOOM = ZOOM_AVATAR_MAX;
export const PLAYER_SOCIAL_FULL_ZOOM = HYST_AVATAR_MODE_MIN;
export const AVATAR_VEHICLE_CROSSFADE_START = AVATAR_3D_FADE_START;
export const AVATAR_VEHICLE_CROSSFADE_END = AVATAR_3D_FADE_END;

export type PresenceDisplayMode = "cluster" | "avatar";

export type PresenceOpacities = {
  cluster: number;
  avatar: number;
  vehicle: number;
  mode: PresenceDisplayMode;
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (x <= edge0) return 0;
  if (x >= edge1) return 1;
  const t = (x - edge0) / (edge1 - edge0);
  return t * t * (3 - 2 * t);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Stateful zoom controller.
 * Hysteresis on display mode prevents cluster ↔ avatar flicker during pinch.
 * Opacity-only handoffs — never drive mount/unmount from zoom ticks.
 */
export class PlayerPresenceZoomState {
  private displayMode: PresenceDisplayMode = "cluster";

  reset() {
    this.displayMode = "cluster";
  }

  getDisplayMode(): PresenceDisplayMode {
    return this.displayMode;
  }

  isClusterMode(): boolean {
    return this.displayMode === "cluster";
  }

  isAvatarMode(): boolean {
    return this.displayMode === "avatar";
  }

  /** Call once per zoom tick before reading opacities. */
  update(zoom: number): PresenceOpacities {
    if (zoom >= HYST_AVATAR_MODE_MIN) this.displayMode = "avatar";
    else if (zoom <= HYST_CLUSTER_MODE_MAX) this.displayMode = "cluster";

    const avatar3dHandoff = smoothstep(AVATAR_3D_FADE_START, AVATAR_3D_FADE_END, zoom);
    const socialPresence = 1 - avatar3dHandoff;
    const expandT = getClusterExpandT(zoom);
    const clusterOp = clamp01(socialPresence * expandT);

    if (this.displayMode === "cluster") {
      return {
        mode: "cluster",
        cluster: clusterOp,
        avatar: clamp01(socialPresence),
        vehicle: clamp01(avatar3dHandoff),
      };
    }

    return {
      mode: "avatar",
      cluster: clusterOp,
      avatar: clamp01(socialPresence),
      vehicle: clamp01(avatar3dHandoff),
    };
  }

  getClusterRadius(): number {
    return this.displayMode === "cluster" ? CLUSTER_MERGE_RADIUS_WIDE : CLUSTER_MERGE_RADIUS_TIGHT;
  }

  shouldSyncClustersOnPan(zoom: number): boolean {
    this.update(zoom);
    return this.displayMode === "cluster";
  }
}

let sharedPresenceState = new PlayerPresenceZoomState();

export function setSharedPlayerPresenceZoomState(state: PlayerPresenceZoomState) {
  sharedPresenceState = state;
}

export function getSharedPlayerPresenceZoomState(): PlayerPresenceZoomState {
  return sharedPresenceState;
}

export function getClusterLayerOpacity(zoom: number, state = sharedPresenceState): number {
  return state.update(zoom).cluster;
}

/** Cluster markers — cluster band opacity only (never max with avatar). */
export function getClusterDisplayOpacity(opacities: PresenceOpacities): number {
  return opacities.cluster;
}

/** 1 = clusters visible, 0 = individual players (≤12 … ≥15 crossfade). */
export function getClusterExpandT(zoom: number): number {
  if (zoom <= ZOOM_CLUSTER_ONLY_MAX) return 1;
  if (zoom >= CLUSTER_EXPAND_END) return 0;
  if (zoom < CLUSTER_EXPAND_START) return 1;
  const t = (zoom - CLUSTER_EXPAND_START) / (CLUSTER_EXPAND_END - CLUSTER_EXPAND_START);
  const s = t * t * (3 - 2 * t);
  return 1 - s;
}

/** 0 = clusters only, 1 = individuals revealed. */
export function getClusterIndividualRevealT(zoom: number): number {
  return 1 - getClusterExpandT(zoom);
}

/** Visual cluster expand progress during zoom 13–14 (disc scale). */
export function getClusterVisualExpandT(zoom: number): number {
  if (zoom <= CLUSTER_VISUAL_EXPAND_START) return 0;
  if (zoom >= CLUSTER_VISUAL_EXPAND_END) return 1;
  const t =
    (zoom - CLUSTER_VISUAL_EXPAND_START) /
    (CLUSTER_VISUAL_EXPAND_END - CLUSTER_VISUAL_EXPAND_START);
  return t * t * (3 - 2 * t);
}

/** Interpolate merge radius during cluster ↔ individual handoff. */
export function getClusterMergeRadiusForZoom(
  zoom: number,
  state?: PlayerPresenceZoomState,
): number {
  const s = state ?? sharedPresenceState;
  s.update(zoom);
  const expandT = getClusterExpandT(zoom);
  const wide = CLUSTER_MERGE_RADIUS_WIDE;
  const tight = CLUSTER_MERGE_RADIUS_TIGHT;
  return wide * expandT + tight * (1 - expandT);
}

/** Map presence opacity → scale (0.85 at hidden, 1.0 at full). */
export function presenceScaleFromOpacity(opacity: number): number {
  const o = clamp01(opacity);
  return PRESENCE_SCALE_MIN + (PRESENCE_SCALE_MAX - PRESENCE_SCALE_MIN) * o;
}

/** Cluster mount scale — 1.0 visible → 0.88 hidden (reverse handoff). */
export function presenceClusterScaleFromOpacity(opacity: number): number {
  const o = clamp01(opacity);
  return 0.88 + 0.12 * o;
}

export function getAvatarMarkerOpacity(zoom: number, state = sharedPresenceState): number {
  return state.update(zoom).avatar;
}

export function getVehicleLayerOpacity(zoom: number, state = sharedPresenceState): number {
  return state.update(zoom).vehicle;
}

export function getCombinedPresenceOpacity(zoom: number, state = sharedPresenceState): number {
  const op = state.update(zoom);
  return Math.max(op.cluster, op.avatar, op.vehicle);
}

export function getVehicleIconOpacity(_zoom: number): number {
  return 0;
}

export function isAvatarMarkerVisible(zoom: number, state = sharedPresenceState): boolean {
  return getAvatarMarkerOpacity(zoom, state) > 0.02;
}

export function isClusterLayerVisible(zoom: number, state = sharedPresenceState): boolean {
  return getClusterLayerOpacity(zoom, state) > 0.02;
}

export const ZOOM_LEVEL_BADGE_MIN = 15;

/** Level badge hysteresis — show ≥ 15.0, hide ≤ 14.6. */
export const HYST_LEVEL_BADGE_SHOW_MIN = 15.0;
export const HYST_LEVEL_BADGE_HIDE_MAX = 14.6;

/** Avatar prominence hysteresis — show ≥ 14.2, hide ≤ 13.8. */
export const HYST_AVATAR_SHOW_MIN = 14.2;
export const HYST_AVATAR_HIDE_MAX = 13.8;

/** Other players: compact point when zoomed out, full avatar after expand. */
export const PLAYER_POINT_ZOOM_MAX = ZOOM_CLUSTER_ONLY_MAX;
export const PLAYER_POINT_TO_AVATAR_START = CLUSTER_EXPAND_START;
export const PLAYER_POINT_TO_AVATAR_END = HYST_AVATAR_MODE_MIN;

/** 1 = compact point, 0 = full avatar. Current-user markers must ignore this. */
export function getOtherPlayerPointT(zoom: number): number {
  if (zoom <= PLAYER_POINT_ZOOM_MAX) return 1;
  if (zoom >= PLAYER_POINT_TO_AVATAR_END) return 0;
  if (zoom < PLAYER_POINT_TO_AVATAR_START) return 1;
  const t =
    (zoom - PLAYER_POINT_TO_AVATAR_START) /
    (PLAYER_POINT_TO_AVATAR_END - PLAYER_POINT_TO_AVATAR_START);
  const s = t * t * (3 - 2 * t);
  return 1 - s;
}

/** 0 = compact point, 1 = full avatar. Inverse of getOtherPlayerPointT. */
export function getOtherPlayerAvatarT(zoom: number): number {
  return 1 - getOtherPlayerPointT(zoom);
}

export function showsPlayerLevel(zoom: number): boolean {
  return zoom >= ZOOM_LEVEL_BADGE_MIN;
}

export function getClusterRadiusForZoom(zoom: number, state = sharedPresenceState): number {
  state.update(zoom);
  return state.getClusterRadius();
}

export function presenceDisplayLerpFactor(): number {
  return 1 - Math.exp(-1 / (PRESENCE_TRANSITION_MS / (1000 / 60)));
}
