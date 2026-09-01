// ─── Vehicle progression catalog ─────────────────────────────────────────────
// Single source of truth for 3D map vehicles, garage progression, and unlocks.

export type VehicleRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic"
  | "admin"
  | "developer";

/** How a vehicle is unlocked. Achievement type reserved for future use. */
export type UnlockRequirement =
  | { type: "starter" }
  | { type: "level"; level: number }
  | { type: "distance"; km: number }
  | { type: "spots"; count: number }
  | { type: "achievement"; achievementId: string; label: string };

/** Placeholder for future achievement system — not implemented yet. */
export type AchievementRef = {
  id: string;
  label: string;
  description?: string;
};

export type VehicleDefinition = {
  id: string;
  emoji: string;
  name: string;
  shortName: string;
  description: string;
  color: string;
  modelPath: string;
  rarity: VehicleRarity;
  unlock: UnlockRequirement;
  /** Achievement IDs that relate to this vehicle (unlock or mastery). */
  relatedAchievementIds?: string[];
  /** Base stats shown in vehicle details. */
  stats: { power: number; handling: number; style: number };
};

export type OwnedVehicle = {
  vehicleId: string;
  level: number;
  xp: number;
  acquiredAt: number;
};

export type VehicleProgress = {
  owned: OwnedVehicle[];
  /** Reserved — populated when achievement system ships. */
  completedAchievementIds: string[];
};

// ─── Rarity presentation ─────────────────────────────────────────────────────

export type Rarity = VehicleRarity;

export const RARITY_ORDER: VehicleRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "admin",
  "developer",
];

/** Canonical STREETGRID rarity colors — markers, garage, UI. */
export const RARITY_COLORS: Record<VehicleRarity, string> = {
  common: "#949494",
  uncommon: "#28D85B",
  rare: "#00E5FF",
  epic: "#A855F7",
  legendary: "#FFCC00",
  mythic: "#EF4444",
  admin: "#FFFFFF",
  developer: "#FF8800",
};

export type RarityAnimation = "none" | "breathe" | "pulse" | "shimmer";

export type RarityMeta = {
  label: string;
  color: string;
  border: string;
  glowColor: string;
  /** @deprecated Ring geometry is uniform — use MARKER_RING_GEOMETRY. Kept for spot/UI compat. */
  innerGlow: number;
  /** @deprecated Ring geometry is uniform — use MARKER_RING_GEOMETRY. */
  outerGlow: number;
  /** @deprecated Ring geometry is uniform — use MARKER_RING_GEOMETRY. */
  shadow: number;
  animation: RarityAnimation;
  /** Expanding radar rings (spots, high tiers). */
  pulse: boolean;
};

/** Locked ring presentation for COMMON → MYTHIC — only hue varies on map rings. */
const UNIFORM_RING_PRESENTATION = {
  innerGlow: 0.14,
  outerGlow: 0.1,
  shadow: 0.1,
} as const;

export const RARITY_META: Record<VehicleRarity, RarityMeta> = {
  common: {
    label: "Common",
    color: RARITY_COLORS.common,
    border: RARITY_COLORS.common,
    glowColor: RARITY_COLORS.common,
    ...UNIFORM_RING_PRESENTATION,
    animation: "none",
    pulse: false,
  },
  uncommon: {
    label: "Uncommon",
    color: RARITY_COLORS.uncommon,
    border: RARITY_COLORS.uncommon,
    glowColor: RARITY_COLORS.uncommon,
    ...UNIFORM_RING_PRESENTATION,
    animation: "none",
    pulse: false,
  },
  rare: {
    label: "Rare",
    color: RARITY_COLORS.rare,
    border: RARITY_COLORS.rare,
    glowColor: RARITY_COLORS.rare,
    ...UNIFORM_RING_PRESENTATION,
    animation: "breathe",
    pulse: true,
  },
  epic: {
    label: "Epic",
    color: RARITY_COLORS.epic,
    border: RARITY_COLORS.epic,
    glowColor: RARITY_COLORS.epic,
    ...UNIFORM_RING_PRESENTATION,
    animation: "breathe",
    pulse: true,
  },
  legendary: {
    label: "Legendary",
    color: RARITY_COLORS.legendary,
    border: RARITY_COLORS.legendary,
    glowColor: RARITY_COLORS.legendary,
    ...UNIFORM_RING_PRESENTATION,
    animation: "pulse",
    pulse: true,
  },
  mythic: {
    label: "Mythic",
    color: RARITY_COLORS.mythic,
    border: RARITY_COLORS.mythic,
    glowColor: RARITY_COLORS.mythic,
    ...UNIFORM_RING_PRESENTATION,
    animation: "pulse",
    pulse: true,
  },
  admin: {
    label: "Admin",
    color: RARITY_COLORS.admin,
    border: RARITY_COLORS.admin,
    glowColor: RARITY_COLORS.admin,
    ...UNIFORM_RING_PRESENTATION,
    animation: "shimmer",
    pulse: true,
  },
  developer: {
    label: "Developer",
    color: RARITY_COLORS.developer,
    border: RARITY_COLORS.developer,
    glowColor: RARITY_COLORS.developer,
    ...UNIFORM_RING_PRESENTATION,
    animation: "pulse",
    pulse: true,
  },
};

const VEHICLE_RARITIES = new Set<string>(RARITY_ORDER);

/** Map legacy / unknown rarity strings to a valid tier. */
export function normalizeVehicleRarity(rarity: string): VehicleRarity {
  if (rarity === "immortal") return "admin";
  if (VEHICLE_RARITIES.has(rarity)) return rarity as VehicleRarity;
  return "common";
}

export function getRarityRank(rarity: VehicleRarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function rarityFromRank(rank: number): VehicleRarity {
  const idx = Math.max(0, Math.min(Math.round(rank), RARITY_ORDER.length - 1));
  return RARITY_ORDER[idx] ?? "common";
}

/** Premium map-marker tokens — delegates to unified rarity rendering. */
export { getMarkerRarityStyles } from "./rarityRendering";

export function getVehicleColorForSeed(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) | 0;
  return VEHICLE_CATALOG[Math.abs(h) % VEHICLE_CATALOG.length].color;
}

export function getVehicleById(id: string): VehicleDefinition | undefined {
  return VEHICLE_CATALOG.find((v) => v.id === id);
}

export function getHighestVehicleRarity(progress: VehicleProgress): VehicleRarity {
  let best = 0;
  for (const o of progress.owned) {
    const v = getVehicleById(o.vehicleId);
    if (v) best = Math.max(best, RARITY_ORDER.indexOf(v.rarity));
  }
  return RARITY_ORDER[best] ?? "common";
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const VEHICLE_CATALOG: VehicleDefinition[] = [
  {
    id: "bmw_m3", emoji: "🚗", name: "BMW M3 Competition", shortName: "BMW M3",
    description: "480 л.с. · Stage 2 Tune · KW V3", color: "#00aaff",
    modelPath: "/models/low_poly_bmw_g80_m3.glb",
    rarity: "common", unlock: { type: "starter" },
    stats: { power: 480, handling: 82, style: 78 },
  },
  {
    id: "tesla_neon", emoji: "⚡", name: "Tesla Neon X", shortName: "Tesla",
    description: "Электрогонщик · Silent Mode · 0–100 в 2.4 с", color: "#00ff88",
    modelPath: "/models/tesla_neon.glb",
    rarity: "rare", unlock: { type: "level", level: 3 },
    stats: { power: 620, handling: 88, style: 85 },
  },
  {
    id: "retro_racer", emoji: "🏎️", name: "Retro Racer '69", shortName: "Ретро",
    description: "Muscle Car · 1969 · V8 Big Block", color: "#ffcc00",
    modelPath: "/models/retro_racer.glb",
    rarity: "epic", unlock: { type: "achievement", achievementId: "first_meet", label: "Посетить первый мит" },
    relatedAchievementIds: ["first_meet"],
    stats: { power: 450, handling: 70, style: 92 },
  },
  {
    id: "hippie_van", emoji: "🚐", name: "Hippie Van", shortName: "Хиппи",
    description: "Peace & Love · Slow & Groovy", color: "#ff6600",
    modelPath: "/models/hippie_van.glb",
    rarity: "rare", unlock: { type: "distance", km: 50 },
    stats: { power: 180, handling: 55, style: 95 },
  },
  {
    id: "phantom_gt", emoji: "👻", name: "Phantom GT", shortName: "Phantom",
    description: "Twin-Turbo V8 · Carbon Monocoque · Track Pack", color: "#e8e8ff",
    modelPath: "/models/phantom_gt.glb",
    rarity: "legendary", unlock: { type: "level", level: 10 },
    stats: { power: 720, handling: 94, style: 88 },
  },
  {
    id: "neon_demon", emoji: "🔥", name: "Neon Demon", shortName: "Demon",
    description: "Nitro Overdrive · Full Carbon · Limited Edition", color: "#ff0055",
    modelPath: "/models/neon_demon.glb",
    rarity: "mythic",
    unlock: { type: "achievement", achievementId: "night_king", label: "Король ночи" },
    relatedAchievementIds: ["night_king", "nitro_master"],
    stats: { power: 900, handling: 96, style: 99 },
  },
];

export const DEFAULT_OWNED: OwnedVehicle[] = [
  { vehicleId: "bmw_m3", level: 4, xp: 3250, acquiredAt: Date.now() - 86400000 * 30 },
];

/** XP needed to complete one level (bar fills 0→100% within level). */
export const XP_PER_LEVEL = 5000;

/** Progress toward next level, 0–100. */
export function getXpBarPercent(xpInLevel: number): number {
  return Math.min(100, Math.max(0, Math.round((xpInLevel / XP_PER_LEVEL) * 100)));
}

export function formatUnlockRequirement(unlock: UnlockRequirement): string {
  switch (unlock.type) {
    case "starter":     return "Стартовый автомобиль";
    case "level":       return `Достигни уровня ${unlock.level}`;
    case "distance":    return `Проедь ${unlock.km} км`;
    case "spots":       return `Посети ${unlock.count} спотов`;
    case "achievement": return unlock.label;
  }
}

export function isVehicleUnlocked(
  vehicle: VehicleDefinition,
  progress: VehicleProgress,
  playerLevel: number,
): boolean {
  if (progress.owned.some((o) => o.vehicleId === vehicle.id)) return true;
  switch (vehicle.unlock.type) {
    case "starter":
      return true;
    case "level":
      return playerLevel >= vehicle.unlock.level;
    case "achievement":
      return progress.completedAchievementIds.includes(vehicle.unlock.achievementId);
    case "distance":
    case "spots":
      return false; // tracked by future progression hooks
  }
}

/** Highest level among owned vehicles — used for level-gated unlocks. */
export function getPlayerLevel(progress: VehicleProgress): number {
  if (progress.owned.length === 0) return 1;
  return Math.max(...progress.owned.map((o) => o.level));
}
