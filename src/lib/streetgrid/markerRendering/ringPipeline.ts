import type { CSSProperties } from "react";
import { RARITY_META, normalizeVehicleRarity, type VehicleRarity } from "../vehicles";
import {
  MARKER_RING_GEOMETRY,
  MARKER_STYLE,
} from "./constants";
import {
  buildUniformRingStyle,
  getPlayerRingColors,
  getSelfRingColors,
  getUniformPlayerRingClasses,
  resolveSelfRingStyle,
  resolveUniformPlayerRingStyle,
} from "./uniformRingRenderer";

export type { RarityAnimation } from "../vehicles";
export type RingVariant = "player" | "self" | "spot" | "card";

export type RarityGlowSpec = {
  border: string;
  glowColor: string;
  innerGlow: number;
  outerGlow: number;
  shadow: number;
  animation: import("../vehicles").RarityAnimation;
  pulse: boolean;
};

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

/** Color-only ring vars — delegates to uniform ring renderer. */
function buildUniformRingColorVars(
  border: string,
  glowColor: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return buildUniformRingStyle(border, glowColor, extra);
}

/** Uniform drop shadow — identical for every map marker. */
export function buildMarkerRingShadow(): string {
  return MARKER_RING_GEOMETRY.dropShadow;
}

/** @deprecated Use buildMarkerRingShadow — kept for self shim compat. */
export function buildSelfMarkerRingShadow(): string {
  return buildMarkerRingShadow();
}

/** Structured box-shadow — UI surfaces. Geometry locked; only glow hue varies. */
export function buildRarityShadow(color: string): string {
  const intensity = MARKER_RING_GEOMETRY.outerGlow;
  const [r, g, b] = parseHexColor(color);
  const blurNear = 8 + intensity * 18;
  const blurFar = 20 + intensity * 32;
  const shadowLift = 1 + MARKER_RING_GEOMETRY.innerGlow * 2;
  const shadowBlur = 4 + MARKER_RING_GEOMETRY.innerGlow * 8;
  const shadowAlpha = 0.26 + MARKER_RING_GEOMETRY.innerGlow * 0.14;

  return [
    `0 0 ${blurNear.toFixed(1)}px rgba(${r}, ${g}, ${b}, ${(intensity * 0.58).toFixed(3)})`,
    `0 0 ${blurFar.toFixed(1)}px rgba(${r}, ${g}, ${b}, ${(intensity * 0.3).toFixed(3)})`,
    `0 ${shadowLift.toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(0, 0, 0, ${shadowAlpha.toFixed(3)})`,
    "inset 0 0 0 0.5px rgba(255, 255, 255, 0.07)",
  ].join(", ");
}

export function getGlowSpecCssVars(spec: {
  border: string;
  glowColor: string;
  innerGlow?: number;
  outerGlow?: number;
  shadow?: number;
  extra?: Record<string, string>;
}): Record<string, string> {
  return buildUniformRingColorVars(spec.border, spec.glowColor, spec.extra);
}

export function getRarityGlowSpec(rarity: VehicleRarity): RarityGlowSpec {
  const { border, glowColor } = getPlayerRingColors(rarity);
  const meta = RARITY_META[normalizeVehicleRarity(rarity)];
  return {
    border,
    glowColor,
    innerGlow: MARKER_RING_GEOMETRY.innerGlow,
    outerGlow: MARKER_RING_GEOMETRY.outerGlow,
    shadow: MARKER_RING_GEOMETRY.innerGlow,
    animation: meta.animation,
    pulse: meta.pulse,
  };
}

export function getRarityRingCssVars(
  rarity: VehicleRarity,
): Record<string, string> {
  const { border, glowColor, color } = getPlayerRingColors(rarity);
  return buildUniformRingColorVars(border, glowColor, { "--rarity-color": color });
}

export function getSelfRingCssVars(): Record<string, string> {
  const { border, glowColor, color } = getSelfRingColors();
  return buildUniformRingStyle(border, glowColor, { "--rarity-color": color });
}

export { getUniformPlayerRingClasses } from "./uniformRingRenderer";

/** Resolve ring CSS vars for any marker variant. */
export function resolveMarkerRingStyle(
  rarity: VehicleRarity,
  opts: { isSelf?: boolean; variant?: RingVariant } = {},
): CSSProperties {
  const { isSelf = false, variant = "player" } = opts;

  if (isSelf) {
    return resolveSelfRingStyle();
  }

  const style: Record<string, string> =
    variant === "player"
      ? ({ ...resolveUniformPlayerRingStyle(rarity) } as Record<string, string>)
      : getRarityRingCssVars(rarity);

  if (variant === "card") {
    style["--rarity-ring-width"] = `${MARKER_STYLE.cardRingPx}px`;
    style["--rarity-glow-inner-inset"] = `${MARKER_STYLE.cardGlowInsetPx}px`;
    style["--rarity-glow-bloom-inset"] = `${MARKER_STYLE.cardOuterInsetPx}px`;
    style["--rarity-glow-inset"] = `${MARKER_STYLE.cardGlowInsetPx}px`;
    style["--rarity-outer-inset"] = `${MARKER_STYLE.cardOuterInsetPx}px`;
  }

  return style as CSSProperties;
}

export function getRarityRingCssProperties(
  rarity: VehicleRarity,
): CSSProperties {
  return getRarityRingCssVars(rarity) as CSSProperties;
}

export function applyRarityRingVars(
  el: HTMLElement,
  rarity: VehicleRarity,
): void {
  for (const [key, value] of Object.entries(getRarityRingCssVars(rarity))) {
    el.style.setProperty(key, value);
  }
}

/** @deprecated Player rings use getUniformPlayerRingClasses — no per-tier modifiers. */
export function getRarityRingClass(_rarity: VehicleRarity): string {
  return getUniformPlayerRingClasses().join(" ");
}

export function getRarityAnimationClass(
  rarity: VehicleRarity,
): string | undefined {
  const anim = RARITY_META[normalizeVehicleRarity(rarity)].animation;
  if (anim === "none") return undefined;
  return `sg-marker-ring--anim-${anim} sg-rarity-ring--anim-${anim}`;
}

/** Ring class list — player tiers share one renderer; spot/card add variant modifiers. */
export function getMarkerRingClasses(
  rarity: VehicleRarity,
  opts: { isSelf?: boolean; variant?: RingVariant } = {},
): string[] {
  const { variant = "player" } = opts;

  if (variant === "player") {
    return [...getUniformPlayerRingClasses()];
  }

  const classes = ["sg-marker-ring", "sg-rarity-ring"];
  const anim = getRarityAnimationClass(rarity);
  if (anim) classes.push(anim);

  if (variant === "spot") {
    classes.push("sg-marker-ring--spot", "sg-rarity-ring--spot");
  }
  if (variant === "card") {
    classes.push("sg-marker-ring--card", "sg-rarity-ring--card");
  }

  return classes;
}

export function getRarityBoxShadow(rarity: VehicleRarity): string {
  return buildRarityShadow(getPlayerRingColors(rarity).glowColor);
}

export function getRarityUiBorder(rarity: VehicleRarity): string {
  return `${RARITY_META[normalizeVehicleRarity(rarity)].color}55`;
}

/** @deprecated Use getRarityRingCssVars */
export function getMarkerRarityStyles(
  rarity: VehicleRarity,
): Record<string, string> {
  const tier = normalizeVehicleRarity(rarity);
  const vars = getRarityRingCssVars(tier);
  return {
    "--rarity-color": vars["--rarity-color"],
    "--rarity-glow": `${RARITY_META[tier].color}14`,
    "--rarity-shadow-soft": vars["--rarity-shadow"],
    "--rarity-tail-glow": `0 1px 3px ${RARITY_META[tier].color}28`,
  };
}

/** Radar pulse rings for spot / high-tier markers. */
export function shouldShowRadarPulse(rarity: VehicleRarity): boolean {
  return RARITY_META[normalizeVehicleRarity(rarity)].pulse;
}
