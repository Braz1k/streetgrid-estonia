/** @deprecated Import from @/lib/streetgrid/markerRendering */
export {
  MARKER_STYLE,
  MARKER_SELF_AVATAR_PX,
  SELF_STYLE,
  ONLINE_BADGE,
  MARKER_ANIMATION,
  buildRarityShadow,
  getGlowSpecCssVars,
  getRarityAnimationClass,
  getRarityBoxShadow,
  getRarityGlowSpec,
  getRarityRingClass,
  getRarityRingCssProperties,
  getRarityRingCssVars,
  getRarityUiBorder,
  getSelfRingCssVars,
  resolveMarkerRingStyle,
} from "./markerRendering";

export type { RarityAnimation, RarityGlowSpec } from "./markerRendering";

import type { CSSProperties } from "react";
import type { VehicleRarity } from "./vehicles";
import {
  MARKER_STYLE,
  MARKER_RING_GEOMETRY,
  MARKER_SELF_AVATAR_PX,
  SELF_STYLE,
  SELF_GLOW,
  ONLINE_BADGE,
  getRarityAnimationClass,
  getRarityRingClass,
  getRarityRingCssProperties,
  getSelfRingCssVars,
} from "./markerRendering";

/** @deprecated Use MARKER_STYLE.avatarPx */
export const MARKER_AVATAR_PX = MARKER_STYLE.avatarPx;
export const MARKER_SELF_SCALE = MARKER_STYLE.selfScale;
export const MARKER_RING_PX = MARKER_STYLE.ringPx;
export const MARKER_SELF_RING_PX = MARKER_STYLE.selfRingPx;
export const MARKER_ONLINE_PX = ONLINE_BADGE.sizePx;
export const MARKER_ONLINE_BORDER_PX = ONLINE_BADGE.borderPx;

export const SELF_MARKER_GOLD = SELF_STYLE.gold;
export const SELF_MARKER_GOLD_DEEP = SELF_STYLE.goldDeep;
export const SELF_MARKER_GOLD_LIGHT = SELF_STYLE.goldLight;
export const SELF_MARKER_GRADIENT = SELF_STYLE.gradient;
export const SELF_MARKER_RING = {
  border: SELF_STYLE.gold,
  glowColor: SELF_GLOW.warmColor,
  innerGlow: MARKER_RING_GEOMETRY.innerGlow,
  outerGlow: MARKER_RING_GEOMETRY.outerGlow,
  shadow: MARKER_RING_GEOMETRY.dropShadow,
} as const;

export function getPlayerRarityRingStyle(rarity: VehicleRarity): CSSProperties {
  return getRarityRingCssProperties(rarity);
}

export function getSelfMarkerRingStyle(): CSSProperties {
  return getSelfRingCssVars() as CSSProperties;
}

export function getPlayerRarityRingClass(rarity: VehicleRarity): string {
  return getRarityRingClass(rarity);
}

export function getPlayerRarityAnimationClass(rarity: VehicleRarity): string | undefined {
  return getRarityAnimationClass(rarity);
}
