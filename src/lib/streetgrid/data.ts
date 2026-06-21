// Mock data for STREETGRID. Estonia-wide.
import { DEFAULT_REPUTATION, mockReputation, type ReputationProgress } from "./reputation";
import type { VehicleRarity } from "./vehicles";

export const TALLINN: [number, number] = [59.437, 24.7536];

export type CityId = "all" | "tallinn" | "tartu" | "parnu" | "narva";

export type City = {
  id: CityId;
  name: string;
  short: string;
  coords: [number, number];
  zoom: number;
};

export const CITIES: City[] = [
  { id: "all", name: "Вся Эстония", short: "EST", coords: [58.8, 25.5], zoom: 7.2 },
  { id: "tallinn", name: "Таллинн", short: "TLN", coords: [59.437, 24.7536], zoom: 11.8 },
  { id: "tartu", name: "Тарту", short: "TRT", coords: [58.378, 26.729], zoom: 11.8 },
  { id: "parnu", name: "Пярну", short: "PNU", coords: [58.385, 24.497], zoom: 11.8 },
  { id: "narva", name: "Нарва", short: "NRV", coords: [59.379, 28.196], zoom: 11.8 },
];

export const getCity = (id: CityId) => CITIES.find((c) => c.id === id) ?? CITIES[0];

export const navUrl = ([lat, lng]: [number, number]) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export type Car = {
  make: string;
  model: string;
  year: number;
  hp: number;
  specs: string[];
  photos: string[];
};

export type UserProfile = {
  id: string;
  handle: string;
  avatar: string;
  status: "spot" | "moving" | "offline";
  location: [number, number];
  level: number;
  rarity: VehicleRarity;
  reputation: ReputationProgress;
  car: Car;
};

export type Meet = {
  id: string;
  city: Exclude<CityId, "all">;
  title: string;
  location: string;
  coords: [number, number];
  time: string;
  description: string;
  organizer: string;
  going: number;
  cover: string;
};

export type Route = {
  id: string;
  name: string;
  distance: string;
  duration: string;
  rating: number;
  type: "Coast" | "Night" | "Twisty" | "Highway";
  description: string;
  path: [number, number][];
  cover: string;
};

export type SosType = "battery" | "fuel" | "tire" | "tow" | "other";

export type SosSignal = {
  id: string;
  type: SosType;
  label: string;
  note?: string;
  user: string;
  coords: [number, number];
  time: string;
};

export const ME: UserProfile = {
  id: "me",
  handle: "@nightrider",
  avatar: "NR",
  status: "spot",
  location: [59.437, 24.7536],
  level: 4,
  rarity: "rare",
  reputation: DEFAULT_REPUTATION,
  car: {
    make: "BMW",
    model: "M3 E92",
    year: 2011,
    hp: 480,
    specs: ["KW V3 Coilovers", "Akrapovic Evolution", "VRSF Charge Pipe", "BC Forged Wheels 19\"", "Stage 2 Tune"],
    photos: ["🚗", "🏎️", "🛞"],
  },
};

export const USERS: UserProfile[] = [
  {
    id: "u1", handle: "@drift_king", avatar: "DK", status: "moving", level: 8, rarity: "epic", reputation: mockReputation("night_driver"),
    location: [59.441, 24.745],
    car: { make: "Nissan", model: "Silvia S15", year: 2000, hp: 380, specs: ["SR20DET", "GReddy Coilovers", "Work Meister"], photos: ["🚙"] },
  },
  {
    id: "u2", handle: "@stance_lord", avatar: "SL", status: "spot", level: 6, rarity: "rare", reputation: mockReputation("street_hunter"),
    location: [59.434, 24.762],
    car: { make: "Audi", model: "A4 B8", year: 2014, hp: 320, specs: ["Air Lift 3P", "Rotiform LAS-R", "APR Stage 1"], photos: ["🚗"] },
  },
  {
    id: "u3", handle: "@jdm_soul", avatar: "JS", status: "moving", level: 5, rarity: "rare", reputation: mockReputation("cruiser"),
    location: [59.428, 24.74],
    car: { make: "Honda", model: "Civic EK9", year: 1999, hp: 220, specs: ["B18C Swap", "Skunk2", "Spoon Sports"], photos: ["🏎️"] },
  },
  {
    id: "u4", handle: "@neon_cruise", avatar: "NC", status: "moving", level: 7, rarity: "epic", reputation: mockReputation("street_hunter"),
    location: [59.439, 24.751],
    car: { make: "BMW", model: "335i F30", year: 2015, hp: 340, specs: ["M Performance", "Akrapovic", "BBS CH-R"], photos: ["🚗"] },
  },
  {
    id: "u5", handle: "@turbo_ghost", avatar: "TG", status: "spot", level: 9, rarity: "legendary", reputation: mockReputation("road_king"),
    location: [59.435, 24.748],
    car: { make: "Mitsubishi", model: "Lancer Evo X", year: 2010, hp: 420, specs: ["4B11T", "Tein Flex Z", "Enkei RPF1"], photos: ["🏎️"] },
  },
  {
    id: "u6", handle: "@midnight_rx", avatar: "MR", status: "moving", level: 4, rarity: "common", reputation: mockReputation("driver"),
    location: [59.432, 24.756],
    car: { make: "Mazda", model: "RX-7 FD", year: 1995, hp: 280, specs: ["13B-REW", "HKS", "Volk TE37"], photos: ["🚙"] },
  },
  {
    id: "u7", handle: "@grid_runner", avatar: "GR", status: "spot", level: 3, rarity: "common", reputation: mockReputation("driver"),
    location: [59.444, 24.758],
    car: { make: "Volkswagen", model: "Golf GTI Mk7", year: 2017, hp: 245, specs: ["APR Stage 1", "Bilstein B16", "Rotiform"], photos: ["🚗"] },
  },
  {
    id: "u8", handle: "@v8_nomad", avatar: "VN", status: "moving", level: 11, rarity: "legendary", reputation: mockReputation("road_king"),
    location: [59.430, 24.765],
    car: { make: "Ford", model: "Mustang GT", year: 2018, hp: 460, specs: ["Roush Supercharger", "MagneRide", "Shelby Wheels"], photos: ["🏎️"] },
  },
  {
    id: "u9", handle: "@euro_low", avatar: "EL", status: "spot", level: 5, rarity: "rare", reputation: mockReputation("cruiser"),
    location: [59.438, 24.742],
    car: { make: "Mercedes", model: "C63 AMG W204", year: 2012, hp: 457, specs: ["KW V3", "Remus Exhaust", "HRE P40"], photos: ["🚗"] },
  },
  {
    id: "u10", handle: "@track_rat", avatar: "TR", status: "moving", level: 10, rarity: "mythic", reputation: mockReputation("legend"),
    location: [59.426, 24.752],
    car: { make: "Porsche", model: "Cayman GT4", year: 2016, hp: 385, specs: ["PCCB", "Sport Chrono", "Michelin PS4S"], photos: ["🏎️"] },
  },
  {
    id: "u11", handle: "@city_slip", avatar: "CS", status: "moving", level: 2, rarity: "common", reputation: mockReputation("rookie"),
    location: [59.440, 24.768],
    car: { make: "Toyota", model: "GR86", year: 2023, hp: 228, specs: ["HKS Supercharger", "Tein", "Enkei"], photos: ["🚙"] },
  },
  {
    id: "u12", handle: "@boosted_bee", avatar: "BB", status: "spot", level: 6, rarity: "rare", reputation: mockReputation("cruiser"),
    location: [59.433, 24.739],
    car: { make: "Subaru", model: "WRX STI", year: 2019, hp: 310, specs: ["Cobb Stage 2", "Invidia", "Work Emotion"], photos: ["🚗"] },
  },
  {
    id: "u13", handle: "@retro_wave", avatar: "RW", status: "moving", level: 7, rarity: "epic", reputation: mockReputation("street_hunter"),
    location: [59.445, 24.749],
    car: { make: "Toyota", model: "Supra A80", year: 1998, hp: 320, specs: ["2JZ-GTE", "HKS T04Z", "Volk CE28"], photos: ["🏎️"] },
  },
  {
    id: "u14", handle: "@silent_type", avatar: "ST", status: "spot", level: 4, rarity: "common", reputation: mockReputation("driver"),
    location: [59.431, 24.747],
    car: { make: "Tesla", model: "Model 3 Performance", year: 2022, hp: 450, specs: ["Track Mode", "Lowering Links", "Vossen"], photos: ["🚗"] },
  },
  {
    id: "u15", handle: "@nitro_nova", avatar: "NN", status: "moving", level: 8, rarity: "epic", reputation: mockReputation("night_driver"),
    location: [59.436, 24.760],
    car: { make: "BMW", model: "M2 G87", year: 2023, hp: 460, specs: ["M Performance", "Akrapovic", "BBS FI-R"], photos: ["🏎️"] },
  },
  {
    id: "u16", handle: "@old_school", avatar: "OS", status: "offline", level: 5, rarity: "rare", reputation: mockReputation("driver"),
    location: [59.450, 24.780],
    car: { make: "BMW", model: "E30 M3", year: 1989, hp: 200, specs: ["S14", "Bilstein", "BBS RS"], photos: ["🚙"] },
  },
  {
    id: "u17", handle: "@pirita_crew", avatar: "PC", status: "moving", level: 6, rarity: "rare", reputation: mockReputation("cruiser"),
    location: [59.442, 24.754],
    car: { make: "Audi", model: "RS3 8V", year: 2018, hp: 400, specs: ["APR Stage 2", "Milltek", "Rotiform"], photos: ["🚗"] },
  },
  {
    id: "u18", handle: "@hex_hunter", avatar: "HH", status: "spot", level: 3, rarity: "common", reputation: mockReputation("rookie"),
    location: [59.429, 24.758],
    car: { make: "Mini", model: "Cooper S JCW", year: 2020, hp: 231, specs: ["JCW Brakes", "Bilstein", "OZ Racing"], photos: ["🚙"] },
  },
  {
    id: "u19", handle: "@lane_king", avatar: "LK", status: "moving", level: 9, rarity: "legendary", reputation: mockReputation("road_king"),
    location: [59.437, 24.746],
    car: { make: "Lamborghini", model: "Huracán", year: 2017, hp: 610, specs: ["Novitec", "Capristo", "Forgiato"], photos: ["🏎️"] },
  },
  {
    id: "u20", handle: "@grid_captain", avatar: "GC", status: "spot", level: 12, rarity: "mythic", reputation: mockReputation("legend"),
    location: [59.434, 24.755],
    car: { make: "Nissan", model: "GT-R R35", year: 2015, hp: 545, specs: ["AMS Alpha", "Bilstein", "Rays TE37"], photos: ["🚗"] },
  },
  {
    id: "u21", handle: "@after_dark", avatar: "AD", status: "moving", level: 5, rarity: "common", reputation: mockReputation("driver"),
    location: [59.438, 24.764],
    car: { make: "Hyundai", model: "i30 N", year: 2021, hp: 280, specs: ["N Performance", "Michelin PS4S", "OZ"], photos: ["🚙"] },
  },
  {
    id: "u22", handle: "@coast_line", avatar: "CL", status: "offline", level: 7, rarity: "epic", reputation: mockReputation("night_driver"),
    location: [59.470, 24.823],
    car: { make: "BMW", model: "M4 G82", year: 2022, hp: 510, specs: ["M Performance", "Akrapovic", "HRE"], photos: ["🏎️"] },
  },
];

export const MEETS: Meet[] = [
  {
    id: "m1", city: "tallinn", title: "NIGHT GRID — Pirita Coastal",
    location: "Pirita Tee Parking", coords: [59.470, 24.823],
    time: "Сегодня, 22:00",
    description: "Ночная сходка у моря. JDM, Euro, Stance — все приветствуются. Бэп, фото, чилл.",
    organizer: "@drift_king", going: 47,
    cover: "🌃",
  },
  {
    id: "m2", city: "tallinn", title: "Cars & Coffee Tallinn",
    location: "Telliskivi Creative City", coords: [59.440, 24.738],
    time: "Сб, 10:00",
    description: "Утренний митап с кофе. Семейная атмосфера, классика и современный тюнинг.",
    organizer: "@stance_lord", going: 128,
    cover: "☕",
  },
  {
    id: "m6", city: "tallinn", title: "Ülemiste City Meet",
    location: "Ülemiste City, Lõõtsa", coords: [59.420, 24.795],
    time: "Пт, 20:00",
    description: "Сходка в бизнес-квартале. Огни небоскрёбов, гладкий асфальт, идеально для фото.",
    organizer: "@stance_lord", going: 64,
    cover: "🌆",
  },
  {
    id: "m3", city: "parnu", title: "Track Day — Pärnu Ring",
    location: "Pärnu Ring Circuit", coords: [58.395, 24.503],
    time: "Вс, 09:00",
    description: "Открытая трасса. Сессии по 20 мин. Шлем обязателен. €60 entry.",
    organizer: "@jdm_soul", going: 32,
    cover: "🏁",
  },
  {
    id: "m4", city: "parnu", title: "Rannaparkla Sunset",
    location: "Rannaparkla (Пляжная парковка)", coords: [58.378, 24.494],
    time: "Сб, 19:30",
    description: "Закатная сходка у моря. Громкие выхлопы запрещены — рядом отдыхающие.",
    organizer: "@drift_king", going: 41,
    cover: "🌅",
  },
  {
    id: "m5", city: "tartu", title: "Raadi Airfield Meet",
    location: "Raadi Airfield, Tartu", coords: [58.408, 26.756],
    time: "Сб, 18:00",
    description: "Большая сходка на старом аэродроме. Drag-заезды на ¼ мили, шоу-зона, бургеры.",
    organizer: "@jdm_soul", going: 87,
    cover: "✈️",
  },
];

export const ROUTES: Route[] = [
  {
    id: "r1", name: "Pirita Coastline Cruise",
    distance: "18 км", duration: "25 мин", rating: 4.9, type: "Coast",
    description: "Извилистая прибрежная дорога вдоль Балтики. Закатные виды, минимум трафика после 21:00.",
    path: [[59.437, 24.7536], [59.470, 24.823], [59.495, 24.85], [59.510, 24.87]],
    cover: "🌊",
  },
  {
    id: "r2", name: "Old Town Night Loop",
    distance: "8 км", duration: "15 мин", rating: 4.6, type: "Night",
    description: "Ночная петля вокруг Старого города. Подсветка, брусчатка, атмосфера.",
    path: [[59.437, 24.7536], [59.4372, 24.7453], [59.441, 24.7409], [59.439, 24.7565]],
    cover: "🌙",
  },
  {
    id: "r3", name: "Lahemaa Twisties",
    distance: "62 км", duration: "1ч 10м", rating: 5.0, type: "Twisty",
    description: "Извилистые трассы через национальный парк. Идеально для драйва выходного дня.",
    path: [[59.437, 24.7536], [59.55, 25.3], [59.6, 25.85]],
    cover: "🌲",
  },
];

export type { Spot, SpotRarity, SpotReward } from "./spots";
export { SPOTS, SPOT_RARITY_ORDER, SPOT_RARITY_VISUAL, getSpotRarityVisual } from "./spots";
export type { VehicleRarity, Rarity } from "./vehicles";
export { RARITY_META, RARITY_ORDER, getMarkerRarityStyles, getHighestVehicleRarity } from "./vehicles";
export type { RankId, ReputationProgress, RankDefinition } from "./reputation";
export {
  RANKS, REPUTATION_WEIGHTS, DEFAULT_REPUTATION,
  computeReputationScore, getRankFromProgress, getRankFromScore,
  getNextRank, getRankProgressPercent, mergeAchievementCount, mockReputation,
} from "./reputation";

export const INITIAL_CHAT_BY_CITY: Record<Exclude<CityId, "all">, { user: string; text: string; time: string }[]> = {
  tallinn: [
    { user: "@drift_king", text: "Кто на Пирите сегодня?", time: "21:42" },
    { user: "@stance_lord", text: "Буду через 20", time: "21:43" },
    { user: "@jdm_soul", text: "Беру кофе, пишите заказы 👀", time: "21:45" },
  ],
  tartu: [
    { user: "@raadi_boy", text: "Завтра на Раади собираемся, кто едет?", time: "20:10" },
    { user: "@tartu_st", text: "Я с E46, буду", time: "20:12" },
  ],
  parnu: [
    { user: "@beach_runner", text: "Rannaparkla сегодня живая", time: "19:55" },
    { user: "@pnu_mx5", text: "Еду на Miata, 5 минут 🏎️", time: "19:57" },
  ],
  narva: [
    { user: "@border_drift", text: "На набережной 3 машины", time: "22:01" },
  ],
};

export const INITIAL_CHAT = INITIAL_CHAT_BY_CITY.tallinn;
