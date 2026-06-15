import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ME, type Car, type CityId } from "./data";

export type NavProvider = "google" | "waze" | "apple";
export type Language = "ru" | "et" | "en";
export type DriverStatus = "Круиз" | "На кортах" | "Занят" | "Нужен заезд" | "На споте";

export type Profile = {
  handle: string;
  realName: string;
  avatar: string;
  status: DriverStatus;
  car: Car;
};

export type Settings = {
  defaultNav: NavProvider;
  showPatrols: boolean;
  showBots: boolean;
  notifSos: boolean;
  notifMeets: boolean;
  notifPatrols: boolean;
  language: Language;
};

export type ChatInjection = {
  city: Exclude<CityId, "all">;
  user: string;
  text: string;
  time: string;
  ts: number;
  sos?: boolean;
};

type Ctx = {
  profile: Profile;
  updateProfile: (p: Partial<Profile>) => void;
  updateCar: (c: Partial<Car>) => void;
  settings: Settings;
  updateSettings: (s: Partial<Settings>) => void;
  chatInjections: ChatInjection[];
  pushChat: (c: Omit<ChatInjection, "ts">) => void;
};

const StreetGridCtx = createContext<Ctx | null>(null);

export function StreetGridProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile>({
    handle: "Nikita Ivanov",
    realName: "Nikita Ivanov",
    avatar: ME.avatar,
    status: "На споте",
    car: ME.car,
  });
  const [settings, setSettingsState] = useState<Settings>({
    defaultNav: "google",
    showPatrols: true,
    showBots: true,
    notifSos: true,
    notifMeets: true,
    notifPatrols: true,
    language: "ru",
  });
  const [chatInjections, setChat] = useState<ChatInjection[]>([]);

  const updateProfile = useCallback(
    (p: Partial<Profile>) => setProfileState((prev) => ({ ...prev, ...p })),
    [],
  );
  const updateCar = useCallback(
    (c: Partial<Car>) => setProfileState((prev) => ({ ...prev, car: { ...prev.car, ...c } })),
    [],
  );
  const updateSettings = useCallback(
    (s: Partial<Settings>) => setSettingsState((prev) => ({ ...prev, ...s })),
    [],
  );
  const pushChat = useCallback(
    (c: Omit<ChatInjection, "ts">) => setChat((prev) => [...prev, { ...c, ts: Date.now() }]),
    [],
  );

  return (
    <StreetGridCtx.Provider
      value={{ profile, updateProfile, updateCar, settings, updateSettings, chatInjections, pushChat }}
    >
      {children}
    </StreetGridCtx.Provider>
  );
}

export function useStreetGrid() {
  const ctx = useContext(StreetGridCtx);
  if (!ctx) throw new Error("StreetGridProvider missing");
  return ctx;
}

export function navUrlFor(provider: NavProvider, [lat, lng]: [number, number]) {
  if (provider === "waze") return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  if (provider === "apple") return `https://maps.apple.com/?daddr=${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
