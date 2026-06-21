export type SpotRarity = "common" | "rare" | "epic" | "legendary";

export type SpotReward = {
  xp: number;
  label: string;
};

export type Spot = {
  id: string;
  city: Exclude<import("./data").CityId, "all">;
  name: string;
  description: string;
  rarity: SpotRarity;
  coords: [number, number];
  icon: string;
  reward: SpotReward;
  owner: string;
  participants: number;
  userAdded?: boolean;
};

export const SPOT_RARITY_ORDER: SpotRarity[] = ["common", "rare", "epic", "legendary"];

export const SPOT_RARITY_VISUAL: Record<
  SpotRarity,
  { label: string; color: string; glow: string; pulse: boolean }
> = {
  common: {
    label: "COMMON",
    color: "#00f0ff",
    glow: "0 0 14px rgba(0,240,255,0.65),0 0 32px rgba(0,240,255,0.32),inset 0 0 8px rgba(0,240,255,0.12)",
    pulse: false,
  },
  rare: {
    label: "RARE",
    color: "#3399ff",
    glow: "0 0 14px rgba(51,153,255,0.7),0 0 34px rgba(51,153,255,0.35),inset 0 0 8px rgba(51,153,255,0.12)",
    pulse: true,
  },
  epic: {
    label: "EPIC",
    color: "#bb44ff",
    glow: "0 0 16px rgba(187,68,255,0.75),0 0 38px rgba(187,68,255,0.38),inset 0 0 10px rgba(187,68,255,0.14)",
    pulse: true,
  },
  legendary: {
    label: "LEGENDARY",
    color: "#ffcc33",
    glow: "0 0 18px rgba(255,204,51,0.85),0 0 42px rgba(255,204,51,0.45),inset 0 0 12px rgba(255,204,51,0.18)",
    pulse: true,
  },
};

export function getSpotRarityVisual(rarity: SpotRarity) {
  return SPOT_RARITY_VISUAL[rarity];
}

export const SPOTS: Spot[] = [
  // ── Tallinn ──────────────────────────────────────────────────────────────────
  {
    id: "s1", city: "tallinn", name: "Patarei Sea Fortress", rarity: "rare",
    coords: [59.452, 24.738],
    description: "Брутальные стены старой крепости. Идеальный фон для авто-сессий на закате.",
    icon: "📸",
    reward: { xp: 120, label: "Фото-челлендж · закат" },
    owner: "@drift_king", participants: 3,
  },
  {
    id: "s2", city: "tallinn", name: "Linnahall Rooftop", rarity: "legendary",
    coords: [59.448, 24.751],
    description: "Заброшенный советский монолит. Лучший спот для ночных съёмок и брутальных кадров.",
    icon: "🌃",
    reward: { xp: 350, label: "Ночной рейд · легенда города" },
    owner: "STREETGRID", participants: 12,
  },
  {
    id: "s8", city: "tallinn", name: "Türisalu Cliff", rarity: "legendary",
    coords: [59.395, 24.382],
    description: "30-метровый обрыв с видом на залив. Драматичные кадры, особенно в туман.",
    icon: "🌫️",
    reward: { xp: 400, label: "Cliff Run · эпичный кадр" },
    owner: "@retro_wave", participants: 5,
  },
  {
    id: "s3", city: "tallinn", name: "Hesburger Lasnamäe", rarity: "common",
    coords: [59.430, 24.825],
    description: "Огромная парковка, открыт 24/7. Точка сбора по пятницам.",
    icon: "🍔",
    reward: { xp: 40, label: "Meet & Chill" },
    owner: "@grid_runner", participants: 18,
  },
  {
    id: "s4", city: "tallinn", name: "Reval Café Ülemiste", rarity: "common",
    coords: [59.413, 24.797],
    description: "Кофейня с большой парковкой. Wi-Fi, розетки, понимающий персонал.",
    icon: "☕",
    reward: { xp: 35, label: "Coffee Cruise" },
    owner: "@jdm_soul", participants: 6,
  },
  {
    id: "s5", city: "tallinn", name: "Aqua Wash Mustamäe", rarity: "common",
    coords: [59.401, 24.69],
    description: "6 боксов самообслуживания, осмос, активная пена, тёплая вода.",
    icon: "💦",
    reward: { xp: 25, label: "Clean Ride" },
    owner: "STREETGRID", participants: 2,
  },
  {
    id: "s6", city: "tallinn", name: "Pirita Coastal Loop", rarity: "epic",
    coords: [59.470, 24.823],
    description: "Набережная с длинными прямыми и видом на залив. Ночной круиз — must.",
    icon: "🌊",
    reward: { xp: 220, label: "Coastal Night Run" },
    owner: "@pirita_crew", participants: 9,
  },
  {
    id: "s7", city: "tallinn", name: "Kalamaja Brick Alley", rarity: "rare",
    coords: [59.444, 24.734],
    description: "Узкие улочки старого порта. Идеально для stance и детальных кадров.",
    icon: "🧱",
    reward: { xp: 95, label: "Old Town Frames" },
    owner: "@stance_lord", participants: 4,
  },
  // ── Tartu ────────────────────────────────────────────────────────────────────
  {
    id: "s9", city: "tartu", name: "Lõunakeskus Parking", rarity: "common",
    coords: [58.358, 26.692],
    description: "Большой паркинг ТЦ. По вечерам стихийные сходки молодёжи.",
    icon: "🅿️",
    reward: { xp: 30, label: "Parking Meet" },
    owner: "@raadi_boy", participants: 14,
  },
  {
    id: "s10", city: "tartu", name: "Raadi Airfield", rarity: "epic",
    coords: [58.408, 26.756],
    description: "Старый аэродром. Прямые полосы, отличное место для дрэга и фотосессий.",
    icon: "✈️",
    reward: { xp: 280, label: "Runway Sprint" },
    owner: "STREETGRID", participants: 7,
  },
  // ── Pärnu ────────────────────────────────────────────────────────────────────
  {
    id: "s11", city: "parnu", name: "Rannaparkla", rarity: "rare",
    coords: [58.378, 24.494],
    description: "Пляжная парковка. Главная точка тусовки летом по выходным.",
    icon: "🏖️",
    reward: { xp: 110, label: "Beach Grid" },
    owner: "@beach_runner", participants: 22,
  },
  {
    id: "s12", city: "parnu", name: "Porsche Ring Pärnu", rarity: "legendary",
    coords: [58.420, 24.471],
    description: "Знаменитое тестовое кольцо. Обзорная точка снаружи — святыня для petrolheads.",
    icon: "🏁",
    reward: { xp: 500, label: "Ring Pilgrimage" },
    owner: "STREETGRID", participants: 8,
  },
];
