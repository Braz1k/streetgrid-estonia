/** @deprecated Import MARKER_ANIMATION from @/lib/streetgrid/markerRendering */
export { MARKER_ANIMATION, MARKER_STYLE } from "./markerRendering/constants";
export {
  PLAYER_TRANSITION_MS as MARKER_APPEARANCE_MS,
  PLAYER_SCALE_ENTER as MARKER_SCALE_ENTER,
  PLAYER_SCALE_EXIT as MARKER_SCALE_EXIT,
  PLAYER_TRANSITION_MS as MARKER_APPEAR_MS,
  PLAYER_TRANSITION_MS as MARKER_EXIT_MS,
} from "./playerTransitionEngine";

import { MARKER_ANIMATION } from "./markerRendering/constants";

export const MARKER_APPEAR_EASING = MARKER_ANIMATION.easeOut;
export const MARKER_SELF_BREATHE_CYCLE_S = MARKER_ANIMATION.selfBreatheCycleS;
export const MARKER_ONLINE_PULSE_CYCLE_S = MARKER_ANIMATION.onlinePulseCycleS;
export const MARKER_APPEAR_ANIM = MARKER_ANIMATION.appearAnim;
export const MARKER_EXIT_ANIM = MARKER_ANIMATION.exitAnim;
export const CLUSTER_APPEAR_ANIM = MARKER_ANIMATION.clusterAppearAnim;
export const CLUSTER_EXIT_ANIM = MARKER_ANIMATION.clusterExitAnim;
export const CLUSTER_APPEAR_MS = 220;
export const CLUSTER_EXIT_MS = 220;
export const CLUSTER_PRESENCE_MS = 220;
export const CLUSTER_MEMBERSHIP_MS = 220;
