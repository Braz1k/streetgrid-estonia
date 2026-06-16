import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { ME } from "./data";
import type { UserProfile, Car } from "./data";

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

export type ChatInjection = {
  ts:    number;
  city:  string;
  user:  string;
  text:  string;
  time:  string;
  sos?:  boolean;
};

type StoreProfile = Pick<UserProfile, "handle" | "avatar" | "status" | "car">;

type StreetGridStore = {
  profile:        StoreProfile;
  updateProfile:  (patch: Partial<StoreProfile>) => void;
  updateCar:      (car: Car) => void;
  settings:       Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  chatInjections: ChatInjection[];
  pushChat:       (msg: Omit<ChatInjection, "ts">) => void;
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
    status: "spot",
    car:    ME.car,
  });

  const [settings, setSettings]           = useState<Settings>(DEFAULT_SETTINGS);
  const [chatInjections, setChatInjections] = useState<ChatInjection[]>([]);

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

  return (
    <StreetGridContext.Provider
      value={{ profile, updateProfile, updateCar, settings, updateSettings, chatInjections, pushChat }}
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
