/**
 * Unified marker rendering pipeline — single source for map presence markers.
 */

export {
  MARKER_STYLE,
  MARKER_RING_GLOW,
  MARKER_RING_GEOMETRY,
  MARKER_FRAME_PX,
  MARKER_ANIMATION,
  SELF_STYLE,
  SELF_GLOW,
  ONLINE_BADGE,
  MARKER_BADGE,
  MARKER_SELF_AVATAR_PX,
} from "./constants";

export {
  PLAYER_RING_RARITIES,
  UNIFORM_RING_GEOMETRY,
  buildUniformRingStyle,
  getPlayerRingColors,
  resolveUniformPlayerRingStyle,
  resolveSelfRingStyle,
  getUniformPlayerRingClasses,
  getSelfRingColors,
  isPlayerRingRarity,
} from "./uniformRingRenderer";
export type { PlayerRingRarity } from "./uniformRingRenderer";
export type { MarkerBadgeSlot } from "./constants";

export {
  buildMarkerRingShadow,
  buildSelfMarkerRingShadow,
  buildRarityShadow,
  getGlowSpecCssVars,
  getRarityGlowSpec,
  getRarityRingCssVars,
  getSelfRingCssVars,
  resolveMarkerRingStyle,
  getRarityRingCssProperties,
  applyRarityRingVars,
  getRarityRingClass,
  getRarityAnimationClass,
  getMarkerRingClasses,
  getRarityBoxShadow,
  getRarityUiBorder,
  getMarkerRarityStyles,
  shouldShowRadarPulse,
} from "./ringPipeline";
export type { RarityGlowSpec, RingVariant } from "./ringPipeline";

export { MarkerRing } from "./MarkerRing";
export type { MarkerRingProps } from "./MarkerRing";

export {
  MarkerYouBadge,
  MarkerOnlineBadge,
  MarkerFriendBadge,
  MarkerLevelBadge,
  MarkerDeveloperBadge,
  MarkerClubBadge,
  MarkerVipBadge,
  MarkerBadgeLayer,
} from "./MarkerBadges";
export type { MarkerBadgeConfig } from "./MarkerBadges";

export { MarkerRenderer } from "./MarkerRenderer";
export type { MarkerRendererProps } from "./MarkerRenderer";

/** Rarity tier metadata — canonical import for marker + UI surfaces. */
export {
  RARITY_META,
  RARITY_ORDER,
  RARITY_COLORS,
  normalizeVehicleRarity,
} from "../vehicles";
export type { VehicleRarity, RarityMeta, RarityAnimation } from "../vehicles";
