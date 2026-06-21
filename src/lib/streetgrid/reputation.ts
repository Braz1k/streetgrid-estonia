export type RankId =
  | "rookie"
  | "driver"
  | "cruiser"
  | "street_hunter"
  | "night_driver"
  | "road_king"
  | "legend";

export type ReputationProgress = {
  distanceKm: number;
  events: number;
  spots: number;
  achievements: number;
};

export type RankDefinition = {
  id: RankId;
  label: string;
  shortLabel: string;
  minScore: number;
  color: string;
};

/** Score weights — distance, events, spots, achievements. */
export const REPUTATION_WEIGHTS = {
  distanceKm:   2,
  events:       80,
  spots:        45,
  achievements: 120,
} as const;

export const RANKS: RankDefinition[] = [
  { id: "rookie",        label: "Rookie",        shortLabel: "RO", minScore: 0,    color: "#8899aa" },
  { id: "driver",        label: "Driver",        shortLabel: "DR", minScore: 150,  color: "#00f0ff" },
  { id: "cruiser",       label: "Cruiser",       shortLabel: "CR", minScore: 400,  color: "#3399ff" },
  { id: "street_hunter", label: "Street Hunter", shortLabel: "SH", minScore: 750,  color: "#bb44ff" },
  { id: "night_driver",  label: "Night Driver",  shortLabel: "ND", minScore: 1200, color: "#6644ff" },
  { id: "road_king",     label: "Road King",     shortLabel: "RK", minScore: 2000, color: "#ffaa22" },
  { id: "legend",        label: "Legend",        shortLabel: "LG", minScore: 3500, color: "#ffcc33" },
];

export const DEFAULT_REPUTATION: ReputationProgress = {
  distanceKm: 142,
  events: 4,
  spots: 12,
  achievements: 1,
};

export function computeReputationScore(p: ReputationProgress): number {
  return (
    p.distanceKm   * REPUTATION_WEIGHTS.distanceKm +
    p.events       * REPUTATION_WEIGHTS.events +
    p.spots        * REPUTATION_WEIGHTS.spots +
    p.achievements * REPUTATION_WEIGHTS.achievements
  );
}

export function getRankFromScore(score: number): RankDefinition {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (score >= r.minScore) rank = r;
  }
  return rank;
}

export function getRankFromProgress(p: ReputationProgress): RankDefinition {
  return getRankFromScore(computeReputationScore(p));
}

export function getNextRank(rank: RankDefinition): RankDefinition | null {
  const idx = RANKS.findIndex((r) => r.id === rank.id);
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

/** Progress toward next rank, 0–100. Legend returns 100. */
export function getRankProgressPercent(p: ReputationProgress): number {
  const score = computeReputationScore(p);
  const rank  = getRankFromScore(score);
  const next  = getNextRank(rank);
  if (!next) return 100;
  const span = next.minScore - rank.minScore;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((score - rank.minScore) / span) * 100)));
}

export function mergeAchievementCount(
  p: ReputationProgress,
  completedIds: string[],
): ReputationProgress {
  return {
    ...p,
    achievements: Math.max(p.achievements, completedIds.length),
  };
}

/** Build mock progress tuned to a target rank for NPC profiles. */
export function mockReputation(target: RankId): ReputationProgress {
  const presets: Record<RankId, ReputationProgress> = {
    rookie:        { distanceKm: 12,  events: 0, spots: 1,  achievements: 0 },
    driver:        { distanceKm: 45,  events: 1, spots: 3,  achievements: 0 },
    cruiser:       { distanceKm: 88,  events: 2, spots: 6,  achievements: 0 },
    street_hunter: { distanceKm: 160, events: 3, spots: 10, achievements: 1 },
    night_driver:  { distanceKm: 240, events: 5, spots: 14, achievements: 1 },
    road_king:     { distanceKm: 420, events: 8, spots: 22, achievements: 2 },
    legend:        { distanceKm: 680, events: 12, spots: 35, achievements: 4 },
  };
  return presets[target];
}
