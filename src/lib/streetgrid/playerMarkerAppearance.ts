/** Re-export — player transition engine is the single source of truth. */
export {
  PLAYER_TRANSITION_MS,
  PLAYER_SCALE_ENTER,
  PLAYER_SCALE_EXIT,
  PLAYER_SCALE_VISIBLE,
  PLAYER_CLUSTER_HANDOFF_SCALE,
  MARKER_APPEARANCE_MS,
  MARKER_SCALE_ENTER,
  MARKER_SCALE_EXIT,
  MARKER_SCALE_VISIBLE,
  CLUSTER_HANDOFF_SCALE,
  playerTransitionEaseOut,
  markerAppearanceEaseOut,
  PlayerTransitionEngine,
  PlayerMarkerAppearanceController,
  getSharedPlayerTransitionEngine,
  getSharedPlayerMarkerAppearanceController,
  resetSharedPlayerTransitionEngine,
  resetSharedPlayerMarkerAppearanceController,
  isPlayerMarkerInViewport,
  syncPlayerMarkerViewport,
} from "@/lib/streetgrid/playerTransitionEngine";

export type {
  PlayerTransitionTarget,
  MarkerAppearanceTarget,
} from "@/lib/streetgrid/playerTransitionEngine";
