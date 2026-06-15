// Mock data for STREETGRID. Estonia-wide.
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
  { id: "all", name: "Вся Эстония", short: "EST", coords: [58.8, 25.5], zoom: 7 },
  { id: "tallinn", name: "Таллинн", short: "TLN", coords: [59.437, 24.7536], zoom: 12 },
  { id: "tartu", name: "Тарту", short: "TRT", coords: [58.378, 26.729], zoom: 12 },
  { id: "parnu", name: "Пярну", short: "PNU", coords: [58.385, 24.497], zoom: 13 },
  { id: "narva", name: "Нарва", short: "NRV", coords: [59.379, 28.196], zoom: 13 },
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

export type SpotType = "photo" | "friendly" | "wash" | "parking" | "landmark";

export type Spot = {
  id: string;
  city: Exclude<CityId, "all">;
  name: string;
  type: SpotType;
  coords: [number, number];
  description: string;
  photo: string;
  rating: number;
  reviews: number;
  userAdded?: boolean;
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
    id: "u1", handle: "@drift_king", avatar: "DK", status: "moving",
    location: [59.441, 24.745],
    car: { make: "Nissan", model: "Silvia S15", year: 2000, hp: 380, specs: ["SR20DET", "GReddy Coilovers", "Work Meister"], photos: ["🚙"] },
  },
  {
    id: "u2", handle: "@stance_lord", avatar: "SL", status: "spot",
    location: [59.434, 24.762],
    car: { make: "Audi", model: "A4 B8", year: 2014, hp: 320, specs: ["Air Lift 3P", "Rotiform LAS-R", "APR Stage 1"], photos: ["🚗"] },
  },
  {
    id: "u3", handle: "@jdm_soul", avatar: "JS", status: "moving",
    location: [59.428, 24.74],
    car: { make: "Honda", model: "Civic EK9", year: 1999, hp: 220, specs: ["B18C Swap", "Skunk2", "Spoon Sports"], photos: ["🏎️"] },
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

export const SPOTS: Spot[] = [
  // Tallinn
  {
    id: "s1", city: "tallinn", name: "Patarei Sea Fortress", type: "photo",
    coords: [59.452, 24.738],
    description: "Брутальные стены старой крепости. Идеальный фон для авто-сессий на закате.",
    photo: "📸", rating: 4.8, reviews: 34,
  },
  {
    id: "s2", city: "tallinn", name: "Linnahall Rooftop (Горхолл)", type: "photo",
    coords: [59.448, 24.751],
    description: "Заброшенный советский монолит. Лучший спот для ночных съёмок и брутальных кадров.",
    photo: "🌃", rating: 4.9, reviews: 67,
  },
  {
    id: "s8", city: "tallinn", name: "Türisalu Cliff (Обрыв)", type: "photo",
    coords: [59.395, 24.382],
    description: "30-метровый обрыв с видом на залив. Драматичные кадры, особенно в туман.",
    photo: "🌫️", rating: 4.9, reviews: 28,
  },
  {
    id: "s3", city: "tallinn", name: "Hesburger Lasnamäe", type: "friendly",
    coords: [59.430, 24.825],
    description: "Огромная парковка, открыт 24/7. Точка сбора по пятницам.",
    photo: "🍔", rating: 4.3, reviews: 89,
  },
  {
    id: "s4", city: "tallinn", name: "Reval Café Ülemiste", type: "friendly",
    coords: [59.413, 24.797],
    description: "Кофейня с большой парковкой. Wi-Fi, розетки, понимающий персонал.",
    photo: "☕", rating: 4.6, reviews: 41,
  },
  {
    id: "s5", city: "tallinn", name: "Aqua Wash Mustamäe", type: "wash",
    coords: [59.401, 24.69],
    description: "6 боксов самообслуживания, осмос, активная пена, тёплая вода.",
    photo: "💦", rating: 4.7, reviews: 152,
  },
  // Tartu
  {
    id: "s9", city: "tartu", name: "Lõunakeskus Parking", type: "parking",
    coords: [58.358, 26.692],
    description: "Большой паркинг ТЦ. По вечерам стихийные сходки молодёжи.",
    photo: "🅿️", rating: 4.4, reviews: 56,
  },
  {
    id: "s10", city: "tartu", name: "Raadi Airfield", type: "landmark",
    coords: [58.408, 26.756],
    description: "Старый аэродром. Прямые полосы, отличное место для дрэга и фотосессий.",
    photo: "✈️", rating: 4.8, reviews: 73,
  },
  // Pärnu
  {
    id: "s11", city: "parnu", name: "Rannaparkla", type: "parking",
    coords: [58.378, 24.494],
    description: "Пляжная парковка. Главная точка тусовки летом по выходным.",
    photo: "🏖️", rating: 4.6, reviews: 102,
  },
  {
    id: "s12", city: "parnu", name: "Porsche Ring Pärnu", type: "landmark",
    coords: [58.420, 24.471],
    description: "Знаменитое тестовое кольцо. Закрытая трасса, но обзорная точка снаружи доступна.",
    photo: "🏁", rating: 4.7, reviews: 45,
  },
];

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
