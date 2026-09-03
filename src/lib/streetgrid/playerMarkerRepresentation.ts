import {
  getOtherPlayerAvatarT,
  PLAYER_POINT_TO_AVATAR_END,
  PLAYER_POINT_ZOOM_MAX,
} from "@/lib/streetgrid/avatarVehicleTransition";
import { levelBadgeGate } from "@/lib/streetgrid/markerPresenceAnimator";
import { MARKER_FRAME_PX, MARKER_STYLE } from "@/lib/streetgrid/markerRendering/constants";

const PLAYER_MARKER_MIN_SCALE = 0.46;
const PLAYER_MARKER_MAX_SCALE = 1;
const SELF_MARKER_MIN_SCALE = 0.68;
const MARKER_SCALE_MIN_ZOOM = 7;
const MARKER_SCALE_MAX_ZOOM = 17;
/** Compact disc stays 8px; scale is relative to the current avatar frame. */
const COMPACT_POINT_SCALE = 8 / MARKER_FRAME_PX;

/** Named zoom representation — descriptive only; visuals still use avatarT / scale / showLevel. */
export type PlayerMarkerRepresentationState = "point" | "avatar" | "full";

export type PlayerMarkerRepresentation = {
  state: PlayerMarkerRepresentationState;
  avatarT: number;
  scale: number;
  showLevel: boolean;
};

/**
 * Existing compact / avatar / full bands:
 * point  → zoom ≤ PLAYER_POINT_ZOOM_MAX (12)
 * avatar → PLAYER_POINT_ZOOM_MAX < zoom < PLAYER_POINT_TO_AVATAR_END
 * full   → zoom ≥ PLAYER_POINT_TO_AVATAR_END (14.5)
 * YOU never uses compact-point representation.
 */
export function getPlayerMarkerRepresentationState(
  zoom: number,
  isSelf = false,
): PlayerMarkerRepresentationState {
  if (isSelf) {
    return zoom >= PLAYER_POINT_TO_AVATAR_END ? "full" : "avatar";
  }
  if (zoom <= PLAYER_POINT_ZOOM_MAX) return "point";
  if (zoom >= PLAYER_POINT_TO_AVATAR_END) return "full";
  return "avatar";
}

/** Existing zoom scale — other players blend compact 8px → avatar; YOU never compact. */
export function getPlayerMarkerZoomScale(zoom: number, isSelf = false): number {
  const normalized = Math.max(
    0,
    Math.min(1, (zoom - MARKER_SCALE_MIN_ZOOM) / (MARKER_SCALE_MAX_ZOOM - MARKER_SCALE_MIN_ZOOM)),
  );
  const smooth = normalized * normalized * (3 - 2 * normalized);
  const minimum = isSelf ? SELF_MARKER_MIN_SCALE : PLAYER_MARKER_MIN_SCALE;
  const avatarScale = minimum + (PLAYER_MARKER_MAX_SCALE - minimum) * smooth;
  if (isSelf) return avatarScale * MARKER_STYLE.selfScale;

  const avatarT = getOtherPlayerAvatarT(zoom);
  return COMPACT_POINT_SCALE + (avatarScale - COMPACT_POINT_SCALE) * avatarT;
}

/**
 * Single zoom → representation mapping for HTML player markers.
 * Delegates to existing helpers; does not introduce new thresholds.
 */
export function getPlayerMarkerRepresentation(
  zoom: number,
  isSelf = false,
): PlayerMarkerRepresentation {
  const avatarT = isSelf ? 1 : getOtherPlayerAvatarT(zoom);
  const scale = getPlayerMarkerZoomScale(zoom, isSelf);
  const showLevel = levelBadgeGate.update(zoom) && !isSelf;
  const state = getPlayerMarkerRepresentationState(zoom, isSelf);
  return { state, avatarT, scale, showLevel };
}
