// ─── Vehicle progression catalog ─────────────────────────────────────────────
// Single source of truth for 3D map vehicles, garage progression, and unlocks.

export type VehicleRarity = "common" | "rare" | "epic" | "legendary" | "mythic";

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
  "common", "rare", "epic", "legendary", "mythic",
];

export const RARITY_META: Record<
  VehicleRarity,
  { label: string; color: string; border: string; glow: string }
> = {
  common:    { label: "Common",    color: "#A0A0A0", border: "#A0A0A044", glow: "0 0 12px rgba(160,160,160,0.28)" },
  rare:      { label: "Rare",      color: "#00D8FF", border: "#00D8FF55", glow: "0 0 14px rgba(0,216,255,0.35)" },
  epic:      { label: "Epic",      color: "#B347FF", border: "#B347FF55", glow: "0 0 16px rgba(179,71,255,0.4)" },
  legendary: { label: "Legendary", color: "#FF9A00", border: "#FF9A0055", glow: "0 0 18px rgba(255,154,0,0.45)" },
  mythic:    { label: "Mythic",    color: "#FF355E", border: "#FF355E66", glow: "0 0 22px rgba(255,53,94,0.55)" },
};

export function getRarityRank(rarity: VehicleRarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function rarityFromRank(rank: number): VehicleRarity {
  const idx = Math.max(0, Math.min(Math.round(rank), RARITY_ORDER.length - 1));
  return RARITY_ORDER[idx] ?? "common";
}

/** Subtle map-marker tints — same palette as garage, toned down for P1 readability. */
export function getMarkerRarityStyles(rarity: VehicleRarity): Record<string, string> {
  const { color } = RARITY_META[rarity];
  return {
    "--rarity-color":       color,
    "--rarity-glow":        `${color}2b`,
    "--rarity-shadow-soft": `0 0 9px ${color}40, 0 0 18px ${color}18`,
    "--rarity-tail-glow":   `${color}28`,
  };
}

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
  { vehicleId: "bmw_m3", level: 4, xp: 328, acquiredAt: Date.now() - 86400000 * 30 },
];

/** XP needed to complete one level (bar fills 0→100% within level). */
export const XP_PER_LEVEL = 400;

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
