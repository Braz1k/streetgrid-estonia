/** GPS camera mode — single source of truth for map navigation behavior. */
export type NavMode = "FREE" | "FOLLOW" | "DRIVE";

/**
 * State machine (tap cycles forward):
 *
 *   FREE ──tap──▶ FOLLOW ──tap──▶ DRIVE ──tap──▶ FREE
 *
 * FREE   — user owns camera; GPS updates vehicle only
 * FOLLOW — camera recentres on vehicle; pitch/bearing free
 * DRIVE  — full Waze: zoom 18, pitch 65, heading bearing, padding
 */
export const NAV_MODE_CYCLE: Record<NavMode, NavMode> = {
  FREE:   "FOLLOW",
  FOLLOW: "DRIVE",
  DRIVE:  "FREE",
};

export const NAV_MODE_ARIA: Record<NavMode, string> = {
  FREE:   "Центрировать на машине",
  FOLLOW: "Включить режим движения",
  DRIVE:  "Отключить слежение",
};

export function nextNavMode(current: NavMode): NavMode {
  return NAV_MODE_CYCLE[current];
}
