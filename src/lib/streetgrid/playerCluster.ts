import type mapboxgl from "mapbox-gl";

import { MARKER_FRAME_PX, MARKER_STYLE } from "./markerRendering/constants";

/** Player cluster V2 — density tiers, smooth size scaling. */

export const CLUSTER_MARKER_Z = 1;
export const PLAYER_MARKER_Z = 3;
export const SELF_MARKER_Z = 10;

/** Self marker footprint — frame + YOU badge clearance. */
export const SELF_MARKER_DIAMETER_PX =
  MARKER_FRAME_PX + MARKER_STYLE.pinYouGapPx + 4;

export type ClusterTier = "cyan" | "purple" | "orange" | "red";

const TIER_ACCENT: Record<ClusterTier, string> = {
  cyan: "rgba(0, 229, 255, 0.55)",
  purple: "rgba(168, 85, 247, 0.58)",
  orange: "rgba(255, 136, 51, 0.6)",
  red: "rgba(255, 68, 84, 0.62)",
};

/** 1–10 cyan · 11–25 purple · 26–50 orange · 50+ red */
export function getClusterTier(count: number): ClusterTier {
  if (count > 50) return "red";
  if (count >= 26) return "orange";
  if (count >= 11) return "purple";
  return "cyan";
}

export function getClusterTierAccent(count: number): string {
  return TIER_ACCENT[getClusterTier(count)];
}

/** @deprecated Use getClusterTierAccent — kept for legacy cluster styles. */
export function getClusterTierStyles(count: number) {
  const accent = getClusterTierAccent(count);
  return { color: accent, glow: accent, ring: accent };
}

/** Density-based cluster diameter tiers (px) — premium compact 44–52. */
export const CLUSTER_SIZE_TIERS = [
  { min: 2, max: 4, px: 44 },
  { min: 5, max: 9, px: 46 },
  { min: 10, max: 19, px: 48 },
  { min: 20, max: 39, px: 50 },
  { min: 40, max: Number.POSITIVE_INFINITY, px: 52 },
] as const;

export const CLUSTER_SIZE_MIN_PX = 44;
export const CLUSTER_SIZE_MAX_PX = 52;

/** Tier lookup — 2–4 → 44px … 40+ → 52px. */
export function getClusterTierSizePx(count: number): number {
  const c = Math.max(2, count);
  for (const tier of CLUSTER_SIZE_TIERS) {
    if (c >= tier.min && c <= tier.max) return tier.px;
  }
  return CLUSTER_SIZE_MAX_PX;
}

/** Smooth diameter for overlap tests (includes visual expand when provided). */
export function getClusterDiameterPx(count: number, visualExpandT = 0): number {
  const base = getClusterTierSizePx(count);
  const expandScale = 1 + visualExpandT * 0.04;
  return Math.round(base * expandScale);
}

/** Centered count label — exact up to 12, suffixed above, capped at 99+. */
export function formatClusterCount(count: number): string {
  const c = Math.max(2, Math.floor(count));
  if (c >= 100) return "99+";
  if (c > 12) return `${c}+`;
  return String(c);
}

/** Premium cluster — soft cyan halo (visual only). */
export const CLUSTER_GLOW_CYAN = "rgba(0, 229, 255, 0.32)";

/** Outer ring — scales with disc diameter. */
export function getClusterBorderPx(diameter: number): number {
  return Math.max(1.25, Math.round(diameter * 0.034 * 10) / 10);
}

/** Inner accent ring inset + stroke. */
export function getClusterAccentInsetPx(diameter: number): number {
  return Math.max(2, Math.round(diameter * 0.068));
}

export function getClusterAccentBorderPx(diameter: number): number {
  return Math.max(0.75, Math.round(diameter * 0.023 * 10) / 10);
}

export function getClusterCountFontPx(count: number, diameter: number): number {
  if (count >= 100) return Math.round(diameter * 0.21);
  if (count > 12) return Math.round(diameter * 0.25);
  return Math.round(diameter * 0.3);
}

export function getClusterAvatarPx(diameter: number): number {
  return Math.max(12, Math.round(diameter * 0.22));
}

export function getClusterPlayersLabelFontPx(diameter: number): number {
  return Math.max(7, Math.round(diameter * 0.13));
}

/** True when cluster disc would overlap the current-user marker on screen. */
export function clusterOverlapsSelfMarker(
  map: mapboxgl.Map,
  clusterCoords: [number, number],
  selfCoords: [number, number],
  count: number,
): boolean {
  const clusterPt = map.project(clusterCoords);
  const selfPt = map.project(selfCoords);
  const clusterRadius = getClusterDiameterPx(count) / 2 + 10;
  const selfRadius = SELF_MARKER_DIAMETER_PX / 2 + 8;
  const minDist = clusterRadius + selfRadius;
  const dx = clusterPt.x - selfPt.x;
  const dy = clusterPt.y - selfPt.y;
  return dx * dx + dy * dy < minDist * minDist;
}
