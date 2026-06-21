/** Multi-zoom presence — social layer (markers) ↔ driving layer (3D vehicles). */

/** Far band: avatar markers only. */
export const PLAYER_FAR_MAX_ZOOM = 12.999;
/** Social mid band: avatar + 2D vehicle icon + level. */
export const PLAYER_DETAILED_MIN_ZOOM = 13;
/** Full social visibility up to and including this zoom. */
export const PLAYER_SOCIAL_FULL_ZOOM = 15;

/** Marker fade-out / 3D fade-in band (zoom 15→16 ≈ 200–300ms pinch). */
export const PRESENCE_CROSSFADE_START = 15;
export const PRESENCE_CROSSFADE_END = 16;

function crossfadeT(zoom: number): number {
  if (zoom <= PRESENCE_CROSSFADE_START) return 0;
  if (zoom >= PRESENCE_CROSSFADE_END) return 1;
  return (
    (zoom - PRESENCE_CROSSFADE_START) /
    (PRESENCE_CROSSFADE_END - PRESENCE_CROSSFADE_START)
  );
}

/** HTML player markers — full ≤15, fade 15→16, gone >16. */
export function getAvatarMarkerOpacity(zoom: number): number {
  return 1 - crossfadeT(zoom);
}

/** Three.js vehicle — none ≤15, fade in 15→16, full >16. */
export function getVehicleLayerOpacity(zoom: number): number {
  return crossfadeT(zoom);
}

/** 2D vehicle icon on marker — visible zoom 13–15, fades with marker 15→16. */
export function getVehicleIconOpacity(zoom: number): number {
  if (zoom < PLAYER_DETAILED_MIN_ZOOM) return 0;
  return getAvatarMarkerOpacity(zoom);
}

export function isAvatarMarkerVisible(zoom: number): boolean {
  return zoom < PRESENCE_CROSSFADE_END;
}

export function showsPlayerLevel(zoom: number): boolean {
  return (
    zoom >= PLAYER_DETAILED_MIN_ZOOM &&
    zoom <= PRESENCE_CROSSFADE_START
  );
}

// Legacy aliases
export const AVATAR_VEHICLE_CROSSFADE_START = PRESENCE_CROSSFADE_START;
export const AVATAR_VEHICLE_CROSSFADE_END = PRESENCE_CROSSFADE_END;
