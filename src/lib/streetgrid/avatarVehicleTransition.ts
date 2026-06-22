/** Multi-zoom presence — clusters ↔ avatars ↔ 3D vehicles. */

/** Below ~12: clusters dominate. Avatars ramp in 11.75→12.25. */
export const ZOOM_CLUSTER_ONLY_MAX = 12;
export const ZOOM_AVATAR_MIN = 12;

/** Full avatar band ends where 3D handoff begins. */
export const ZOOM_AVATAR_SOCIAL_FULL = 13;
export const ZOOM_AVATAR_MAX = 15;

/** Crossfade clusters → avatars (~300ms pinch around zoom 12). */
export const ZOOM_CLUSTER_AVATAR_FADE_START = 11.75;
export const ZOOM_CLUSTER_AVATAR_FADE_END = 12.25;

/** Crossfade avatars → 3D cars — zoom 13→15 (opacity overlap, no hysteresis). */
export const AVATAR_3D_FADE_START = 13;
export const AVATAR_3D_FADE_END = 15;

/** Legacy aliases — same band as avatar ↔ 3D crossfade. */
export const PRESENCE_CROSSFADE_START = AVATAR_3D_FADE_START;
export const PRESENCE_CROSSFADE_END = AVATAR_3D_FADE_END;

/** Cluster merge radius hysteresis (mount stability only — not opacity). */
export const HYST_CLUSTER_AVATAR_SHOW_MIN = 12.15;
export const HYST_CLUSTER_AVATAR_HIDE_MAX = 11.85;

/** CSS / marker transition target (250–350ms). */
export const PRESENCE_TRANSITION_MS = 300;

/** Legacy aliases */
export const PLAYER_FAR_MAX_ZOOM = ZOOM_CLUSTER_ONLY_MAX - 0.001;
export const PLAYER_DETAILED_MIN_ZOOM = ZOOM_AVATAR_MIN;
export const PLAYER_NEAR_MIN_ZOOM = ZOOM_AVATAR_MAX;
export const PLAYER_SOCIAL_FULL_ZOOM = ZOOM_AVATAR_SOCIAL_FULL;
export const AVATAR_VEHICLE_CROSSFADE_START = AVATAR_3D_FADE_START;
export const AVATAR_VEHICLE_CROSSFADE_END = AVATAR_3D_FADE_END;

export type PresenceOpacities = {
  cluster: number;
  avatar: number;
  vehicle: number;
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
 * Stateful zoom controller — hysteresis applies to cluster merge radius only.
 * Opacity is pure smoothstep (no sudden hide/show at band edges).
 */
export class PlayerPresenceZoomState {
  private wideClusterRadius = true;

  reset() {
    this.wideClusterRadius = true;
  }

  /** Call once per zoom tick before reading opacities. */
  update(zoom: number): PresenceOpacities {
    if (zoom >= HYST_CLUSTER_AVATAR_SHOW_MIN) this.wideClusterRadius = false;
    if (zoom <= HYST_CLUSTER_AVATAR_HIDE_MAX) this.wideClusterRadius = true;

    const clusterAvatarIn = smoothstep(
      ZOOM_CLUSTER_AVATAR_FADE_START,
      ZOOM_CLUSTER_AVATAR_FADE_END,
      zoom,
    );

    const avatar3dHandoff = smoothstep(AVATAR_3D_FADE_START, AVATAR_3D_FADE_END, zoom);
    const socialPresence = 1 - avatar3dHandoff;

    return {
      cluster: clamp01((1 - clusterAvatarIn) * socialPresence),
      avatar: clamp01(clusterAvatarIn * socialPresence),
      vehicle: clamp01(avatar3dHandoff),
    };
  }

  getClusterRadius(): number {
    return this.wideClusterRadius ? 110 : 48;
  }

  shouldSyncClustersOnPan(zoom: number): boolean {
    return zoom < AVATAR_3D_FADE_END;
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

/** Overlap clusters stay visible through the avatar band (city-scale overcrowding). */
export function getClusterDisplayOpacity(opacities: PresenceOpacities): number {
  return Math.max(opacities.cluster, opacities.avatar);
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

export function showsPlayerLevel(zoom: number): boolean {
  return zoom >= ZOOM_AVATAR_MIN && zoom < AVATAR_3D_FADE_END;
}

export function getClusterRadiusForZoom(zoom: number, state = sharedPresenceState): number {
  state.update(zoom);
  return state.getClusterRadius();
}

/** ~300ms exponential smoothing factor at 60fps (CarLayer display lerp). */
export function presenceDisplayLerpFactor(): number {
  return 1 - Math.exp(-1 / (PRESENCE_TRANSITION_MS / (1000 / 60)));
}
