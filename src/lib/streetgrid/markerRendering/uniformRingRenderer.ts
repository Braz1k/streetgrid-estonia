import type { CSSProperties } from "react";
import {
  RARITY_COLORS,
  normalizeVehicleRarity,
  type VehicleRarity,
} from "../vehicles";
import {
  MARKER_ANIMATION,
  MARKER_RING_GEOMETRY,
  MARKER_RING_GLOW,
  MARKER_STYLE,
  SELF_GLOW,
  SELF_STYLE,
} from "./constants";

/** Map player tiers — identical ring geometry, color-only variance. */
export const PLAYER_RING_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
] as const;

export type PlayerRingRarity = (typeof PLAYER_RING_RARITIES)[number];

const PLAYER_RING_SET = new Set<string>(PLAYER_RING_RARITIES);

export function isPlayerRingRarity(rarity: string): rarity is PlayerRingRarity {
  return PLAYER_RING_SET.has(rarity);
}

/** Locked geometry — every player rarity ring shares these exactly. */
export const UNIFORM_RING_GEOMETRY = {
  photoDiameterPx: MARKER_STYLE.avatarPx,
  gapPx: MARKER_STYLE.gapPx,
  borderWidthPx: MARKER_RING_GEOMETRY.ringWidthPx,
  frameDiameterPx:
    MARKER_STYLE.avatarPx +
    2 * (MARKER_RING_GEOMETRY.ringWidthPx + MARKER_STYLE.gapPx),
  innerRadiusPx: MARKER_STYLE.avatarPx / 2,
  outerRadiusPx:
    (MARKER_STYLE.avatarPx +
      2 * (MARKER_RING_GEOMETRY.ringWidthPx + MARKER_STYLE.gapPx)) /
    2,
  glowRadiusPx: MARKER_STYLE.glowRadiusPx,
  glowInsetPx: MARKER_RING_GEOMETRY.glowInsetPx,
  outerGlowInsetPx: MARKER_RING_GEOMETRY.outerInsetPx,
  innerGlowIntensity: MARKER_RING_GEOMETRY.innerGlow,
  outerGlowIntensity: MARKER_RING_GEOMETRY.outerGlow,
  dropShadow: MARKER_RING_GEOMETRY.dropShadow,
  shadowSoftness: 0.35,
  transitionDurationMs: MARKER_ANIMATION.appearanceMs,
  transitionTiming: MARKER_ANIMATION.easeOut,
} as const;

const UNIFORM_RING_CLASS = ["sg-marker-ring", "sg-rarity-ring"] as const;

function parseHexColor(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbaFromHex(hex: string, alpha: number): string {
  const [r, g, b] = parseHexColor(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

/**
 * Three-layer VisionOS-style glow — inner · main · bloom.
 * Color-only variance; all alphas capped below 0.40.
 */
function buildLayeredGlowVars(glowColor: string): Record<string, string> {
  const g = MARKER_RING_GLOW;

  const mainGlowShadow = [
    `0 0 ${g.mainBlurNearPx}px ${rgbaFromHex(glowColor, g.mainNear)}`,
    `0 0 ${g.mainBlurMidPx}px ${rgbaFromHex(glowColor, g.mainMid)}`,
    `0 0 ${g.mainBlurFarPx}px ${rgbaFromHex(glowColor, g.mainFar)}`,
  ].join(", ");
  const playerGlowShadow = [
    `0 0 4px ${rgbaFromHex(glowColor, 0.16)}`,
    `0 0 7px ${rgbaFromHex(glowColor, 0.06)}`,
  ].join(", ");

  return {
    "--rarity-glow-active": "1",
    "--rarity-glow-inner-inset": `${g.innerInsetPx}px`,
    "--rarity-glow-inner-opacity": String(g.innerLayerOpacity),
    "--rarity-inner-c0": rgbaFromHex(glowColor, g.innerPeak),
    "--rarity-inner-c1": rgbaFromHex(glowColor, g.innerMid),
    "--rarity-inner-c2": rgbaFromHex(glowColor, g.innerEdge),
    "--rarity-glow-main": mainGlowShadow,
    "--sg-player-glow": playerGlowShadow,
    "--rarity-glow-bloom-inset": `${g.bloomInsetPx}px`,
    "--rarity-glow-bloom-opacity": String(g.bloomLayerOpacity),
    "--rarity-bloom-c0": rgbaFromHex(glowColor, g.bloomPeak),
    "--rarity-bloom-c1": rgbaFromHex(glowColor, g.bloomMid),
    "--rarity-outer-opacity": String(g.bloomLayerOpacity),
    "--rarity-outer-c0": rgbaFromHex(glowColor, g.bloomPeak),
  };
}

function geometryCssVars(): Record<string, string> {
  const g = UNIFORM_RING_GEOMETRY;
  return {
    "--sg-marker-photo": `${g.photoDiameterPx}px`,
    "--sg-marker-ring": `${g.borderWidthPx}px`,
    "--sg-marker-gap": `${g.gapPx}px`,
    "--sg-marker-avatar": `${g.frameDiameterPx}px`,
    "--sg-marker-glow-inset": `${g.glowInsetPx}px`,
    "--rarity-ring-width": `${g.borderWidthPx}px`,
    "--rarity-glow-inset": `${MARKER_RING_GLOW.innerInsetPx}px`,
    "--rarity-outer-inset": `${MARKER_RING_GLOW.bloomInsetPx}px`,
    "--rarity-shadow": g.dropShadow,
    "--sg-player-ring-shadow": "0 1px 3px rgba(0, 0, 0, 0.28)",
    "--sg-ring-transition-duration": `${g.transitionDurationMs}ms`,
    "--sg-ring-transition-timing": g.transitionTiming,
  };
}

/** Color-only CSS vars — border + glow hue; geometry is always shared. */
export function buildUniformRingStyle(
  borderColor: string,
  glowColor: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "--rarity-border": borderColor,
    ...geometryCssVars(),
    ...buildLayeredGlowVars(glowColor),
    ...extra,
  };
}

/** Resolve border + glow for a player ring tier. */
export function getPlayerRingColors(rarity: VehicleRarity): {
  border: string;
  glowColor: string;
  color: string;
} {
  const tier = normalizeVehicleRarity(rarity);
  const color = RARITY_COLORS[tier];
  return { border: color, glowColor: color, color };
}

/** Self marker — same geometry and shadow; only border + glow hue differ. */
export function getSelfRingColors(): {
  border: string;
  glowColor: string;
  color: string;
} {
  return {
    border: SELF_STYLE.gold,
    glowColor: SELF_GLOW.warmColor,
    color: SELF_STYLE.gold,
  };
}

/** Single ring renderer — COMMON through MYTHIC (and other tiers via same geometry). */
export function resolveUniformPlayerRingStyle(
  rarity: VehicleRarity,
): CSSProperties {
  const { border, glowColor, color } = getPlayerRingColors(rarity);
  return {
    ...buildUniformRingStyle(border, glowColor, { "--rarity-color": color }),
  } as CSSProperties;
}

export function resolveSelfRingStyle(): CSSProperties {
  const { border, glowColor, color } = getSelfRingColors();
  return {
    ...buildUniformRingStyle(border, glowColor, { "--rarity-color": color }),
  } as CSSProperties;
}

/** Class list for player map rings — no per-tier modifiers. */
export function getUniformPlayerRingClasses(): readonly string[] {
  return UNIFORM_RING_CLASS;
}
