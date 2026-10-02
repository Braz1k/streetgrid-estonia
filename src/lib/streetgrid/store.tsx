import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { CITIES, ME, MEETS, compactCarSpecifications, readBuildHistory } from "./data";
import type { UserProfile, Car, Meet, SosSignal, SosStatus, CityId } from "./data";
import { mediaSrc, normalizeStoredMedia, readProfileImage, readStoredPhotos, type StoredMedia } from "./media";
import { readNicknameColor, type NicknameColorId } from "./nickname";
import { SPOTS } from "./spots";
import {
  DEFAULT_OWNED,
  DEFAULT_PLAYER_PROGRESS,
  syncLevelVehicleUnlocks,
  type PlayerProgress,
  type VehicleProgress,
  type OwnedVehicle,
  type VehicleRarity,
} from "./vehicles";
import {
  DEFAULT_REPUTATION,
  mergeAchievementCount,
  type ReputationProgress,
} from "./reputation";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DriverStatus =
  | "Круиз"
  | "На кортах"
  | "Занят"
  | "Нужен заезд"
  | "На споте";

export type NavProvider = "google" | "waze" | "apple";
export type Language    = "ru" | "et" | "en";

export const NEON_ACCENTS = [
  { id: "cyan", label: "CYAN", value: "#00E5FF" },
  { id: "ice", label: "ICE BLUE", value: "#38BDF8" },
  { id: "blue", label: "BLUE", value: "#3B82F6" },
  { id: "violet", label: "VIOLET", value: "#8B5CF6" },
  { id: "pink", label: "PINK", value: "#EC4899" },
  { id: "magenta", label: "MAGENTA", value: "#F000FF" },
  { id: "lime", label: "LIME", value: "#84CC16" },
  { id: "green", label: "GREEN", value: "#00FF88" },
  { id: "amber", label: "AMBER", value: "#FFB800" },
] as const;

export type NeonAccentId = (typeof NEON_ACCENTS)[number]["id"];

export type Settings = {
  showPatrols:   boolean;
  showBots:      boolean;
  notifSos:     boolean;
  notifMeets:    boolean;
  notifPatrols:  boolean;
  defaultNav:    NavProvider;
  language:      Language;
  neon:          NeonAccentId;
};

type StoreProfile = Omit<Pick<UserProfile, "handle" | "avatar" | "status" | "car" | "rarity">, "status" | "car"> & {
  status: DriverStatus;
  car: Car | null;
  location: string;
  joinedAt: string | null;
  backgroundImage: StoredMedia | null;
  nicknameColor: NicknameColorId;
};

type StoredProfileCore = Omit<StoreProfile, "location" | "joinedAt">;

const DRIVER_STATUSES: DriverStatus[] = ["Круиз", "На кортах", "Занят", "Нужен заезд", "На споте"];
const VEHICLE_RARITIES: VehicleRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "admin",
  "developer",
];

const CAR_STORAGE_KEY      = "sg-car-id";
const PROGRESS_STORAGE_KEY = "sg-vehicle-progress";
const PLAYER_PROGRESS_KEY  = "sg-player-progress";
const REPUTATION_STORAGE_KEY = "sg-reputation";
const VISITED_SPOTS_KEY    = "sg-visited-spots";
const PROFILE_STORAGE_KEY  = "sg-profile";
const LEGACY_CAR_STORAGE_KEY = "sg-selected-car-id";
const ACTIVITY_STORAGE_KEY = "sg-activity";
export const MEET_RSVP_STORAGE_KEY = "sg-meet-rsvp";
const USER_MEETS_STORAGE_KEY = "sg-user-meets";
const NEON_STORAGE_KEY = "sg-neon";
const CAR_DEFAULT_ID       = "bmw_m3";

export type SpotVisitActivity = {
  id: string;
  type: "spot_visit";
  createdAt: number;
  payload: {
    spotId: string;
    name: string;
    coords: [number, number];
  };
};

export type MeetVisitActivity = {
  id: string;
  type: "meet_visit";
  createdAt: number;
  payload: {
    meetId: string;
    title: string;
    coords: [number, number];
  };
};

export type ActivityItem = SpotVisitActivity | MeetVisitActivity;

type MeetVisitInput = MeetVisitActivity["payload"];

type SpotVisitSnapshot = {
  name: string;
  coords: [number, number];
};

export const STREETGRID_STORAGE_KEYS = [
  PROFILE_STORAGE_KEY,
  PLAYER_PROGRESS_KEY,
  PROGRESS_STORAGE_KEY,
  CAR_STORAGE_KEY,
  REPUTATION_STORAGE_KEY,
  VISITED_SPOTS_KEY,
  LEGACY_CAR_STORAGE_KEY,
  ACTIVITY_STORAGE_KEY,
  MEET_RSVP_STORAGE_KEY,
  USER_MEETS_STORAGE_KEY,
  NEON_STORAGE_KEY,
] as const;

function socialLocationFromMeSeed(): string {
  const [lat, lng] = ME.location;
  const country = CITIES.find((city) => city.id === "all");
  const city = CITIES.find(
    (row) => row.id !== "all" && row.coords[0] === lat && row.coords[1] === lng,
  );
  if (city && country) return `${city.name}, ${country.name}`;
  return city?.name ?? "";
}

function createDefaultProfile(): StoreProfile {
  return {
    handle: ME.handle,
    avatar: ME.avatar,
    status: "Круиз",
    rarity: ME.rarity,
    location: socialLocationFromMeSeed(),
    joinedAt: null,
    backgroundImage: null,
    nicknameColor: "white",
    car: {
      ...ME.car,
      specs: [...ME.car.specs],
      photos: [...ME.car.photos],
    },
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStoredCar(value: unknown): value is Car {
  if (!value || typeof value !== "object") return false;
  const car = value as Partial<Car>;
  return (
    typeof car.make === "string" &&
    typeof car.model === "string" &&
    typeof car.year === "number" &&
    Number.isFinite(car.year) &&
    typeof car.hp === "number" &&
    Number.isFinite(car.hp) &&
    isStringArray(car.specs) &&
    Array.isArray(car.photos) &&
    car.photos.every((item) => normalizeStoredMedia(item) !== null)
  );
}

function isStoredProfile(value: unknown): value is StoredProfileCore {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<StoredProfileCore>;
  return (
    typeof row.handle === "string" &&
    typeof row.avatar === "string" &&
    typeof row.status === "string" &&
    DRIVER_STATUSES.includes(row.status as DriverStatus) &&
    typeof row.rarity === "string" &&
    VEHICLE_RARITIES.includes(row.rarity as VehicleRarity) &&
    (row.car === null || isStoredCar(row.car))
  );
}

function readStoredLocation(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const location = value.trim();
  return location || null;
}

function readStoredJoinedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const joinedAt = value.trim();
  return joinedAt || null;
}

function readStoredPhoto(value: unknown): StoredMedia | null {
  const media = readProfileImage(value);
  return media && mediaSrc(media) ? media : null;
}

function loadProfile(): StoreProfile {
  const defaults = createDefaultProfile();
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredProfile(parsed)) {
        const extras = parsed as StoredProfileCore & {
          location?: unknown;
          joinedAt?: unknown;
          backgroundImage?: unknown;
          coverPhoto?: unknown;
          nicknameColor?: unknown;
        };
        const location = readStoredLocation(extras.location) ?? defaults.location;
        const joinedAt = readStoredJoinedAt(extras.joinedAt);
        const backgroundImage = readStoredPhoto(extras.backgroundImage ?? extras.coverPhoto);
        const nicknameColor = readNicknameColor(extras.nicknameColor);
        if (parsed.car === null) {
          return {
            handle: parsed.handle,
            avatar: parsed.avatar,
            status: parsed.status,
            rarity: parsed.rarity,
            location,
            joinedAt,
            backgroundImage,
            nicknameColor,
            car: null,
          };
        }
        const storedCar = parsed.car as Car & { specifications?: unknown; buildHistory?: unknown; photo?: unknown };
        const specifications = compactCarSpecifications(storedCar.specifications);
        const buildHistory = readBuildHistory(storedCar.buildHistory);
        const photo = readStoredPhoto(storedCar.photo);
        return {
          handle: parsed.handle,
          avatar: parsed.avatar,
          status: parsed.status,
          rarity: parsed.rarity,
          location,
          joinedAt,
          backgroundImage,
          nicknameColor,
          car: {
            make: parsed.car.make,
            model: parsed.car.model,
            year: parsed.car.year,
            hp: parsed.car.hp,
            specs: [...parsed.car.specs],
            photos: readStoredPhotos(parsed.car.photos),
            ...(photo ? { photo } : {}),
            ...(specifications ? { specifications } : {}),
            ...(buildHistory ? { buildHistory } : {}),
          },
        };
      }
    }
  } catch { /* noop */ }
  return defaults;
}

function persistProfile(profile: StoreProfile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch { /* noop */ }
}

function loadVehicleProgress(): VehicleProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as VehicleProgress;
  } catch { /* noop */ }
  return { owned: DEFAULT_OWNED, completedAchievementIds: [] };
}

function persistVehicleProgress(progress: VehicleProgress) {
  try { localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress)); } catch { /* noop */ }
}

function isPlayerProgress(value: unknown): value is PlayerProgress {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<PlayerProgress>;
  return (
    typeof row.level === "number" &&
    Number.isInteger(row.level) &&
    row.level >= 1 &&
    typeof row.xp === "number" &&
    Number.isFinite(row.xp) &&
    row.xp >= 0
  );
}

function persistPlayerProgress(progress: PlayerProgress) {
  try {
    localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify({
      level: progress.level,
      xp: progress.xp,
    }));
  } catch { /* noop */ }
}

function loadPlayerProgress(): PlayerProgress {
  let progress: PlayerProgress = { ...DEFAULT_PLAYER_PROGRESS };
  try {
    const raw = localStorage.getItem(PLAYER_PROGRESS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isPlayerProgress(parsed)) progress = { level: parsed.level, xp: parsed.xp };
    }
  } catch { /* noop */ }
  persistPlayerProgress(progress);
  return progress;
}

function loadSyncedVehicleProgress(playerLevel: number): VehicleProgress {
  const loaded = loadVehicleProgress();
  const synced = syncLevelVehicleUnlocks(loaded, playerLevel);
  if (synced !== loaded) persistVehicleProgress(synced);
  return synced;
}

function loadEquippedId(progress: VehicleProgress): string {
  try {
    const id = localStorage.getItem(CAR_STORAGE_KEY) ?? CAR_DEFAULT_ID;
    if (progress.owned.some((o) => o.vehicleId === id)) return id;
  } catch { /* noop */ }
  return progress.owned[0]?.vehicleId ?? CAR_DEFAULT_ID;
}

function loadReputationProgress(): ReputationProgress {
  try {
    const raw = localStorage.getItem(REPUTATION_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ReputationProgress;
  } catch { /* noop */ }
  return DEFAULT_REPUTATION;
}

function loadVisitedSpotIds(): string[] {
  try {
    const raw = localStorage.getItem(VISITED_SPOTS_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* noop */ }
  return [];
}

function persistReputation(p: ReputationProgress) {
  try { localStorage.setItem(REPUTATION_STORAGE_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

function persistVisitedSpots(ids: string[]) {
  try { localStorage.setItem(VISITED_SPOTS_KEY, JSON.stringify(ids)); } catch { /* noop */ }
}

function isCoordPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function isActivityItem(value: unknown): value is ActivityItem {
  if (!value || typeof value !== "object") return false;
  const row = value as { id?: unknown; type?: unknown; createdAt?: unknown; payload?: unknown };
  if (typeof row.id !== "string" || row.id.trim().length === 0) return false;
  if (typeof row.createdAt !== "number" || !Number.isFinite(row.createdAt)) return false;
  if (!row.payload || typeof row.payload !== "object") return false;
  const payload = row.payload as Record<string, unknown>;
  if (row.type === "spot_visit") {
    return (
      typeof payload.spotId === "string" &&
      payload.spotId.trim().length > 0 &&
      typeof payload.name === "string" &&
      payload.name.trim().length > 0 &&
      isCoordPair(payload.coords)
    );
  }
  if (row.type === "meet_visit") {
    return (
      typeof payload.meetId === "string" &&
      payload.meetId.trim().length > 0 &&
      typeof payload.title === "string" &&
      payload.title.trim().length > 0 &&
      isCoordPair(payload.coords)
    );
  }
  return false;
}

function loadActivity(): ActivityItem[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isActivityItem);
  } catch {
    return [];
  }
}

function persistActivity(items: ActivityItem[]) {
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(items));
  } catch { /* noop */ }
}

const USER_MEET_CITIES = new Set<Exclude<CityId, "all">>(["tallinn", "tartu", "parnu", "narva"]);
const STATIC_MEET_IDS = new Set(MEETS.map((meet) => meet.id));

function isUserMeet(value: unknown): value is Meet {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Meet>;
  return (
    typeof row.id === "string" &&
    row.id.trim().length > 0 &&
    !STATIC_MEET_IDS.has(row.id) &&
    typeof row.city === "string" &&
    USER_MEET_CITIES.has(row.city as Exclude<CityId, "all">) &&
    typeof row.title === "string" &&
    row.title.trim().length > 0 &&
    typeof row.location === "string" &&
    row.location.trim().length > 0 &&
    isCoordPair(row.coords) &&
    typeof row.time === "string" &&
    row.time.trim().length > 0 &&
    typeof row.description === "string" &&
    typeof row.organizer === "string" &&
    row.organizer.trim().length > 0 &&
    typeof row.going === "number" &&
    Number.isFinite(row.going) &&
    row.going >= 0 &&
    typeof row.cover === "string" &&
    row.cover.trim().length > 0 &&
    (row.createdBy == null || row.createdBy === "self")
  );
}

function loadUserMeets(): Meet[] {
  try {
    const raw = localStorage.getItem(USER_MEETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const meets: Meet[] = [];
    for (const row of parsed) {
      if (!isUserMeet(row) || seen.has(row.id)) continue;
      seen.add(row.id);
      meets.push({
        ...row,
        id: row.id.trim(),
        title: row.title.trim(),
        location: row.location.trim(),
        time: row.time.trim(),
        description: row.description.trim(),
        organizer: row.organizer.trim(),
        cover: row.cover.trim(),
        coords: [row.coords[0], row.coords[1]],
        createdBy: "self",
      });
    }
    return meets;
  } catch {
    return [];
  }
}

function persistUserMeets(meets: Meet[]) {
  try {
    localStorage.setItem(USER_MEETS_STORAGE_KEY, JSON.stringify(meets));
  } catch { /* noop */ }
}

function removeMeetRsvp(meetId: string) {
  try {
    const raw = localStorage.getItem(MEET_RSVP_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    if (!Object.prototype.hasOwnProperty.call(parsed, meetId)) return;
    const next = { ...(parsed as Record<string, unknown>) };
    delete next[meetId];
    localStorage.setItem(MEET_RSVP_STORAGE_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

export type CreateMeetInput = {
  title: string;
  description: string;
  location: string;
  time: string;
  coords: [number, number];
  city: Exclude<CityId, "all">;
};

function resolveSpotVisitPayload(
  spotId: string,
  snapshot?: SpotVisitSnapshot,
): SpotVisitActivity["payload"] | null {
  const catalog = SPOTS.find((spot) => spot.id === spotId);
  const name = snapshot?.name.trim() || catalog?.name;
  const coords = snapshot && isCoordPair(snapshot.coords) ? snapshot.coords : catalog?.coords;
  if (!name || !isCoordPair(coords)) return null;
  return { spotId, name, coords: [coords[0], coords[1]] };
}

export type ChatInjection = {
  ts:    number;
  city:  string;
  user:  string;
  text:  string;
  time:  string;
  sos?:  boolean;
};

type StreetGridStore = {
  profile:            StoreProfile;
  updateProfile:      (patch: Partial<StoreProfile>) => void;
  updateCar:          (car: Car | null) => void;
  settings:           Settings;
  updateSettings:     (patch: Partial<Settings>) => void;
  chatInjections:     ChatInjection[];
  pushChat:           (msg: Omit<ChatInjection, "ts">) => void;
  /** Player level and in-level XP. Source for level-gated vehicle unlocks. */
  playerProgress:     PlayerProgress;
  /** Equipped vehicle on the map. */
  selectedCarId:      string;
  setSelectedCarId:   (id: string) => void;
  /** Vehicle progression — owned fleet, levels, future achievements. */
  vehicleProgress:    VehicleProgress;
  equipVehicle:       (id: string) => void;
  getOwnedVehicle:    (id: string) => OwnedVehicle | undefined;
  isVehicleOwned:     (id: string) => boolean;
  /** Social rank — distance, events, spots, achievements. */
  reputationProgress: ReputationProgress;
  getEffectiveReputation: () => ReputationProgress;
  addDrivingDistance: (km: number) => void;
  activity:           ActivityItem[];
  userMeets:          Meet[];
  createUserMeet:     (input: CreateMeetInput) => boolean;
  deleteUserMeet:     (meetId: string) => boolean;
  recordSpotVisit:    (spotId: string, snapshot?: SpotVisitSnapshot) => void;
  recordMeetVisit:    (visit: MeetVisitInput) => void;
  recordEvent:        () => void;
  /** Session SOS list — survives MapView remount; not persisted. */
  sosSignals:         SosSignal[];
  selectedSos:        SosSignal | null;
  addSosSignal:       (sig: SosSignal) => void;
  updateSosStatus:    (id: string, status: SosStatus) => void;
  setSelectedSos:     (sig: SosSignal | null) => void;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  showPatrols:  true,
  showBots:     true,
  notifSos:     true,
  notifMeets:   true,
  notifPatrols: false,
  defaultNav:   "google",
  language:     "ru",
  neon:         "cyan",
};

function isNeonAccentId(value: unknown): value is NeonAccentId {
  return typeof value === "string" && NEON_ACCENTS.some((color) => color.id === value);
}

function neonAccentValue(id: NeonAccentId): string {
  return NEON_ACCENTS.find((color) => color.id === id)?.value ?? "#00E5FF";
}

function loadNeonAccent(): NeonAccentId {
  try {
    const raw = localStorage.getItem(NEON_STORAGE_KEY);
    if (isNeonAccentId(raw)) return raw;
  } catch { /* noop */ }
  return "cyan";
}

function applyNeonAccent(id: NeonAccentId) {
  if (typeof document === "undefined") return;
  const color = neonAccentValue(id);
  const root = document.documentElement;
  root.style.setProperty("--sg-cyan", color);
  root.style.setProperty("--accent", color);
}

function persistNeonAccent(id: NeonAccentId) {
  try { localStorage.setItem(NEON_STORAGE_KEY, id); } catch { /* noop */ }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const StreetGridContext = createContext<StreetGridStore | null>(null);

export function StreetGridProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StoreProfile>(loadProfile);
  const [activity, setActivity] = useState<ActivityItem[]>(loadActivity);
  const [userMeets, setUserMeets] = useState<Meet[]>(loadUserMeets);

  const [settings, setSettings]               = useState<Settings>(() => {
    const neon = loadNeonAccent();
    applyNeonAccent(neon);
    return { ...DEFAULT_SETTINGS, neon };
  });
  const [chatInjections, setChatInjections]   = useState<ChatInjection[]>([]);
  const [playerProgress]                        = useState<PlayerProgress>(loadPlayerProgress);
  const [vehicleProgress, setVehicleProgress]   = useState<VehicleProgress>(() =>
    loadSyncedVehicleProgress(loadPlayerProgress().level),
  );
  const [reputationProgress, setReputationProgress] = useState<ReputationProgress>(loadReputationProgress);
  const visitedSpotsRef = useRef<string[]>(loadVisitedSpotIds());
  const [selectedCarId, setSelectedCarIdState]  = useState<string>(() =>
    loadEquippedId(loadVehicleProgress()),
  );
  const [sosSignals, setSosSignals]             = useState<SosSignal[]>([]);
  const [selectedSos, setSelectedSosState]      = useState<SosSignal | null>(null);

  useEffect(() => {
    persistProfile(profile);
  }, [profile]);

  useEffect(() => {
    persistActivity(activity);
  }, [activity]);

  useEffect(() => {
    persistUserMeets(userMeets);
  }, [userMeets]);

  useEffect(() => {
    applyNeonAccent(settings.neon);
    persistNeonAccent(settings.neon);
  }, [settings.neon]);

  useEffect(() => {
    setVehicleProgress((prev) => {
      const next = syncLevelVehicleUnlocks(prev, playerProgress.level);
      if (next === prev) return prev;
      persistVehicleProgress(next);
      return next;
    });
  }, [playerProgress.level]);

  const updateProfile = useCallback((patch: Partial<StoreProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
  }, []);

  const updateCar = useCallback((car: Car | null) => {
    setProfile((p) => ({ ...p, car }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const pushChat = useCallback((msg: Omit<ChatInjection, "ts">) => {
    setChatInjections((prev) => [...prev, { ...msg, ts: Date.now() }]);
  }, []);

  const setSelectedCarId = useCallback((id: string) => {
    try { localStorage.setItem(CAR_STORAGE_KEY, id); } catch { /* noop */ }
    setSelectedCarIdState(id);
  }, []);

  const getOwnedVehicle = useCallback(
    (id: string) => vehicleProgress.owned.find((o) => o.vehicleId === id),
    [vehicleProgress.owned],
  );

  const isVehicleOwned = useCallback(
    (id: string) => vehicleProgress.owned.some((o) => o.vehicleId === id),
    [vehicleProgress.owned],
  );

  const equipVehicle = useCallback((id: string) => {
    if (!vehicleProgress.owned.some((o) => o.vehicleId === id)) return;
    setSelectedCarId(id);
  }, [vehicleProgress.owned, setSelectedCarId]);

  const getEffectiveReputation = useCallback((): ReputationProgress => {
    return mergeAchievementCount(
      reputationProgress,
      vehicleProgress.completedAchievementIds,
    );
  }, [reputationProgress, vehicleProgress.completedAchievementIds]);

  const addDrivingDistance = useCallback((km: number) => {
    if (km <= 0 || !Number.isFinite(km)) return;
    setReputationProgress((prev) => {
      const next = { ...prev, distanceKm: prev.distanceKm + km };
      persistReputation(next);
      return next;
    });
  }, []);

  const recordSpotVisit = useCallback((spotId: string, snapshot?: SpotVisitSnapshot) => {
    if (visitedSpotsRef.current.includes(spotId)) return;
    visitedSpotsRef.current = [...visitedSpotsRef.current, spotId];
    persistVisitedSpots(visitedSpotsRef.current);
    setReputationProgress((prev) => {
      const next = { ...prev, spots: prev.spots + 1 };
      persistReputation(next);
      return next;
    });
    const payload = resolveSpotVisitPayload(spotId, snapshot);
    if (!payload) return;
    const createdAt = Date.now();
    setActivity((prev) => [
      {
        id: `spot_visit:${payload.spotId}:${createdAt}`,
        type: "spot_visit",
        createdAt,
        payload,
      },
      ...prev,
    ]);
  }, []);

  const createUserMeet = useCallback((input: CreateMeetInput): boolean => {
    const title = input.title.trim();
    const location = input.location.trim();
    const time = input.time.trim();
    const description = input.description.trim();
    const organizer = profile.handle.trim();
    if (!title || !location || !time || !organizer) return false;
    if (!USER_MEET_CITIES.has(input.city) || !isCoordPair(input.coords)) return false;
    const meet: Meet = {
      id: `um_${Date.now().toString(36)}`,
      city: input.city,
      title,
      location,
      coords: [input.coords[0], input.coords[1]],
      time,
      description,
      organizer,
      going: 1,
      cover: "🌃",
      createdBy: "self",
    };
    setUserMeets((prev) => (prev.some((item) => item.id === meet.id) ? prev : [meet, ...prev]));
    return true;
  }, [profile.handle]);

  const deleteUserMeet = useCallback((meetId: string): boolean => {
    const id = meetId.trim();
    if (!id || STATIC_MEET_IDS.has(id)) return false;
    const owned = userMeets.some((meet) => meet.id === id && meet.createdBy === "self");
    if (!owned) return false;
    setUserMeets((prev) => prev.filter((meet) => meet.id !== id));
    removeMeetRsvp(id);
    return true;
  }, [userMeets]);

  const recordMeetVisit = useCallback((visit: MeetVisitInput) => {
    const meetId = visit.meetId.trim();
    const title = visit.title.trim();
    if (!meetId || !title || !isCoordPair(visit.coords)) return;
    setActivity((prev) => {
      if (prev.some((item) => item.type === "meet_visit" && item.payload.meetId === meetId)) return prev;
      return [
        {
          id: `meet_visit:${meetId}`,
          type: "meet_visit",
          createdAt: Date.now(),
          payload: { meetId, title, coords: [visit.coords[0], visit.coords[1]] },
        },
        ...prev,
      ];
    });
  }, []);

  const recordEvent = useCallback(() => {
    setReputationProgress((prev) => {
      const next = { ...prev, events: prev.events + 1 };
      persistReputation(next);
      return next;
    });
  }, []);

  const addSosSignal = useCallback((sig: SosSignal) => {
    setSosSignals((s) => [...s, sig]);
  }, []);

  const updateSosStatus = useCallback((id: string, status: SosStatus) => {
    setSosSignals((list) => list.map((sig) => (sig.id === id ? { ...sig, status } : sig)));
    setSelectedSosState((cur) => (cur?.id === id ? null : cur));
  }, []);

  const setSelectedSos = useCallback((sig: SosSignal | null) => {
    setSelectedSosState(sig);
  }, []);

  return (
    <StreetGridContext.Provider
      value={{
        profile, updateProfile, updateCar,
        settings, updateSettings,
        chatInjections, pushChat,
        playerProgress,
        selectedCarId, setSelectedCarId,
        vehicleProgress, equipVehicle, getOwnedVehicle, isVehicleOwned,
        reputationProgress, getEffectiveReputation,
        activity,
        userMeets, createUserMeet, deleteUserMeet,
        addDrivingDistance, recordSpotVisit, recordMeetVisit, recordEvent,
        sosSignals, selectedSos, addSosSignal, updateSosStatus, setSelectedSos,
      }}
    >
      {children}
    </StreetGridContext.Provider>
  );
}

export function useStreetGrid(): StreetGridStore {
  const ctx = useContext(StreetGridContext);
  if (!ctx) throw new Error("useStreetGrid must be used inside StreetGridProvider");
  return ctx;
}
