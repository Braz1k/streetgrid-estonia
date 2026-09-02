/**
 * Central marker design tokens — single source for all map presence markers.
 */

/** Layout + ring geometry (player markers) — compact V2 (~17% smaller footprint). */
export const MARKER_STYLE = {
  /** Visible avatar photo diameter. */
  avatarPx: 35,
  /** Self marker footprint vs other players — applied through existing zoom scale. */
  selfScale: 0.91,
  ringPx: 2,
  /** @deprecated Self uses identical ring — kept for compat. */
  selfRingPx: 2,
  gapPx: 1.25,
  glowRadiusPx: 4,
  glowInsetPx: -4,
  /** @deprecated Self uses identical glow — kept for compat. */
  selfGlowInsetPx: -4,
  outerInsetPx: -4,
  /** @deprecated Self uses identical outer glow — kept for compat. */
  selfOuterInsetPx: -4,
  dropShadow: "0 2px 6px rgba(0,0,0,.35)",
  fill: "#080a12",
  photoScale: 1,
  pinYouGapPx: 7,
  defaultOnlineOffsetPct: 28,
  selfOnlineOffsetPct: 28,
  cardRingPx: 2.5,
  cardGlowInsetPx: -8,
  cardOuterInsetPx: -12,
  spotShellPx: 42,
  spotRingInsetPx: 4,
} as const;

/** V2 — identical glow intensity for every rarity (color-only variance). */
export const MARKER_RING_GLOW = {
  /** Layer peak alphas — each stays below 0.40. */
  innerPeak: 0.32,
  innerMid: 0.18,
  innerEdge: 0.07,
  mainNear: 0.24,
  mainMid: 0.16,
  mainFar: 0.09,
  bloomPeak: 0.11,
  bloomMid: 0.05,
  /** Pseudo-element layer opacity caps. */
  innerLayerOpacity: 1,
  bloomLayerOpacity: 0.38,
  /** Glow spread insets — visual only, never affects ring box size. */
  innerInsetPx: -3,
  mainBlurNearPx: 4,
  mainBlurMidPx: 10,
  mainBlurFarPx: 18,
  bloomInsetPx: -11,
  radiusPx: MARKER_STYLE.glowRadiusPx,
  dropShadow: MARKER_STYLE.dropShadow,
  /** @deprecated Use layered tokens above. */
  inner: 0.14,
  outer: 0.1,
} as const;

/** Locked ring geometry — every player marker shares these exactly. */
export const MARKER_RING_GEOMETRY = {
  ringWidthPx: MARKER_STYLE.ringPx,
  glowInsetPx: MARKER_STYLE.glowInsetPx,
  outerInsetPx: MARKER_STYLE.outerInsetPx,
  innerGlow: MARKER_RING_GLOW.innerPeak,
  outerGlow: MARKER_RING_GLOW.bloomPeak,
  dropShadow: MARKER_RING_GLOW.dropShadow,
} as const;

/** Timings + easing — viewport, ring tier, badges, mount layer. */
export const MARKER_ANIMATION = {
  appearanceMs: 220,
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  selfBreatheCycleS: 4,
  onlinePulseCycleS: 5,
  ringBreatheCycleS: 3.2,
  ringPulseCycleS: 2.6,
  ringShimmerCycleS: 2.4,
  radarCycleS: 2.6,
  radarDelayS: 1.3,
  spotFloatCycleS: 4.8,
  selfGoldGlowCycleS: 5.2,
  appearAnim: "sg-marker-appear",
  exitAnim: "sg-marker-exit",
  clusterAppearAnim: "sg-cluster-appear",
  clusterExitAnim: "sg-cluster-exit",
} as const;

/** Self marker — premium gold; identical geometry to all player rings. */
export const SELF_STYLE = {
  gold: "#ffcc00",
  goldDeep: "#c99400",
  goldLight: "#ffe566",
  goldHighlight: "#fff8e7",
  glowColor: "#f0c858",
  /** Rich multi-stop ring border gradient. */
  ringGradient:
    "linear-gradient(160deg, #fffef6 0%, #ffe566 11%, #ffcc00 34%, #e6b800 56%, #b8860b 78%, #ffe082 100%)",
  /** @deprecated Use ringGradient */
  gradient:
    "linear-gradient(160deg, #fffef6 0%, #ffe566 11%, #ffcc00 34%, #e6b800 56%, #b8860b 78%, #ffe082 100%)",
  youGradient: "linear-gradient(180deg, #fff8e0 0%, #ffcc00 46%, #c99400 100%)",
  youBorder: "rgba(255, 220, 120, 0.52)",
} as const;

/** Warm self glow — slightly richer than standard tiers, still under 40% alpha. */
export const SELF_GLOW = {
  warmColor: "#f0c858",
  innerPeak: 0.34,
  innerMid: 0.19,
  innerEdge: 0.08,
  mainNear: 0.26,
  mainMid: 0.17,
  mainFar: 0.1,
  bloomPeak: 0.12,
  bloomMid: 0.06,
  bloomLayerOpacity: 0.36,
  dropShadow:
    "0 3px 10px rgba(0, 0, 0, 0.38), 0 1px 3px rgba(240, 200, 88, 0.24)",
} as const;

/** Online presence dot — identical on every marker, no animation. */
export const ONLINE_BADGE = {
  sizePx: 7,
  borderPx: 1.25,
  color: "#28D85B",
  borderColor: "#0a0e14",
  highlight: "rgba(255, 255, 255, 0.48)",
  glowShadow: "0 0 4px rgba(40, 216, 91, 0.3)",
} as const;

/** Badge slot registry — future: developer, club, vip. */
export type MarkerBadgeSlot =
  | "you"
  | "online"
  | "level"
  | "friend"
  | "developer"
  | "club"
  | "vip";

export const MARKER_BADGE = {
  you: { slot: "top", zIndex: 6, className: "sg-marker-badge--you" },
  online: { slot: "br", zIndex: 4, className: "sg-marker-badge--online" },
  level: { slot: "bl", zIndex: 5, className: "sg-marker-badge--level" },
  friend: { slot: "tl", zIndex: 5, className: "sg-marker-badge--friend" },
  developer: { slot: "tr", zIndex: 5, className: "sg-marker-badge--developer" },
  club: { slot: "tr", zIndex: 5, className: "sg-marker-badge--club" },
  vip: { slot: "tl", zIndex: 5, className: "sg-marker-badge--vip" },
} as const satisfies Record<
  MarkerBadgeSlot,
  { slot: string; zIndex: number; className: string }
>;

/** Derived geometry helpers. */
export const MARKER_FRAME_PX =
  MARKER_STYLE.avatarPx + 2 * (MARKER_STYLE.ringPx + MARKER_STYLE.gapPx);

export const MARKER_SELF_AVATAR_PX = MARKER_STYLE.avatarPx;
