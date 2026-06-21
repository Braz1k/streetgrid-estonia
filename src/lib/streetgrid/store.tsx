import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { ME } from "./data";
import type { UserProfile, Car } from "./data";
import {
  DEFAULT_OWNED,
  type VehicleProgress,
  type OwnedVehicle,
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

export type Settings = {
  showPatrols:   boolean;
  showBots:      boolean;
  notifSos:      boolean;
  notifMeets:    boolean;
  notifPatrols:  boolean;
  defaultNav:    NavProvider;
  language:      Language;
};

const CAR_STORAGE_KEY      = "sg-car-id";
const PROGRESS_STORAGE_KEY = "sg-vehicle-progress";
const REPUTATION_STORAGE_KEY = "sg-reputation";
const VISITED_SPOTS_KEY    = "sg-visited-spots";
const CAR_DEFAULT_ID       = "bmw_m3";

function loadVehicleProgress(): VehicleProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as VehicleProgress;
  } catch { /* noop */ }
  return { owned: DEFAULT_OWNED, completedAchievementIds: [] };
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

export type ChatInjection = {
  ts:    number;
  city:  string;
  user:  string;
  text:  string;
  time:  string;
  sos?:  boolean;
};

type StoreProfile = Pick<UserProfile, "handle" | "avatar" | "status" | "car" | "rarity">;

type StreetGridStore = {
  profile:            StoreProfile;
  updateProfile:      (patch: Partial<StoreProfile>) => void;
  updateCar:          (car: Car) => void;
  settings:           Settings;
  updateSettings:     (patch: Partial<Settings>) => void;
  chatInjections:     ChatInjection[];
  pushChat:           (msg: Omit<ChatInjection, "ts">) => void;
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
  recordSpotVisit:    (spotId: string) => void;
  recordEvent:        () => void;
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
};

// ─── Context ──────────────────────────────────────────────────────────────────

const StreetGridContext = createContext<StreetGridStore | null>(null);

export function StreetGridProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StoreProfile>({
    handle: ME.handle,
    avatar: ME.avatar,
    status: "Круиз",
    car:    ME.car,
    rarity: ME.rarity,
  });

  const [settings, setSettings]               = useState<Settings>(DEFAULT_SETTINGS);
  const [chatInjections, setChatInjections]   = useState<ChatInjection[]>([]);
  const [vehicleProgress, setVehicleProgress]   = useState<VehicleProgress>(loadVehicleProgress);
  const [reputationProgress, setReputationProgress] = useState<ReputationProgress>(loadReputationProgress);
  const visitedSpotsRef = useRef<string[]>(loadVisitedSpotIds());
  const [selectedCarId, setSelectedCarIdState]  = useState<string>(() =>
    loadEquippedId(loadVehicleProgress()),
  );

  const updateProfile = useCallback((patch: Partial<StoreProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
  }, []);

  const updateCar = useCallback((car: Car) => {
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

  const recordSpotVisit = useCallback((spotId: string) => {
    if (visitedSpotsRef.current.includes(spotId)) return;
    visitedSpotsRef.current = [...visitedSpotsRef.current, spotId];
    persistVisitedSpots(visitedSpotsRef.current);
    setReputationProgress((prev) => {
      const next = { ...prev, spots: prev.spots + 1 };
      persistReputation(next);
      return next;
    });
  }, []);

  const recordEvent = useCallback(() => {
    setReputationProgress((prev) => {
      const next = { ...prev, events: prev.events + 1 };
      persistReputation(next);
      return next;
    });
  }, []);

  return (
    <StreetGridContext.Provider
      value={{
        profile, updateProfile, updateCar,
        settings, updateSettings,
        chatInjections, pushChat,
        selectedCarId, setSelectedCarId,
        vehicleProgress, equipVehicle, getOwnedVehicle, isVehicleOwned,
        reputationProgress, getEffectiveReputation,
        addDrivingDistance, recordSpotVisit, recordEvent,
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
