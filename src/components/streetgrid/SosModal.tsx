import { useEffect, useState } from "react";
import { BatteryWarning, Disc, Fuel, Truck, X, MapPin, Loader2, Siren } from "lucide-react";

export type SosPreset = "battery" | "fuel" | "tire" | "tow";

export type SosPayload = {
  preset: SosPreset | null;
  label: string;
  note: string;
  coords: [number, number];
};

type Props = {
  open: boolean;
  fallbackCoords: [number, number];
  onClose: () => void;
  onSubmit: (p: SosPayload) => void;
};

const PRESETS: { id: SosPreset; icon: typeof BatteryWarning; title: string; sub: string }[] = [
  { id: "battery", icon: BatteryWarning, title: "Сел аккумулятор", sub: "Нужно прикурить" },
  { id: "fuel", icon: Fuel, title: "Закончилось топливо", sub: "Нужна канистра" },
  { id: "tire", icon: Disc, title: "Прокол колеса", sub: "Нужен домкрат / запаска" },
  { id: "tow", icon: Truck, title: "Нужен буксир", sub: "Эвакуатор / трос" },
];

export function SosModal({ open, fallbackCoords, onClose, onSubmit }: Props) {
  const [preset, setPreset] = useState<SosPreset | null>(null);
  const [note, setNote] = useState("");
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "ok" | "fallback">("idle");

  useEffect(() => {
    if (!open) return;
    setPreset(null);
    setNote("");
    setCoords(null);
    setGeoState("loading");
    if (!("geolocation" in navigator)) {
      setCoords(fallbackCoords);
      setGeoState("fallback");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords([pos.coords.latitude, pos.coords.longitude]);
        setGeoState("ok");
      },
      () => {
        setCoords(fallbackCoords);
        setGeoState("fallback");
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
    );
  }, [open, fallbackCoords]);

  if (!open) return null;

  const canSend = !!coords && (preset !== null || note.trim().length > 3);

  const submit = () => {
    if (!coords) return;
    const presetLabel = PRESETS.find((p) => p.id === preset)?.title;
    const label = presetLabel ?? note.trim();
    onSubmit({ preset, label, note: note.trim(), coords });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-md grid place-items-end sm:place-items-center animate-float-up"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] glass-strong rounded-t-3xl sm:rounded-3xl p-5 border-t border-primary/40 max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: "0 -20px 60px -10px rgba(255,31,31,0.35)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/15 border border-primary/40 grid place-items-center animate-pulse-ring">
              <Siren className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-black text-primary text-glow-red leading-none">
                SOS · ПОМОЩЬ
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                Сигнал увидят водители рядом
              </p>
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full glass">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Geo status */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 mb-4">
          {geoState === "loading" ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : (
            <MapPin className="h-4 w-4 text-primary" />
          )}
          <div className="flex-1">
            <div className="text-xs font-bold">
              {geoState === "loading" && "Определяем геопозицию..."}
              {geoState === "ok" && "Ваша геопозиция определена"}
              {geoState === "fallback" && "Гео недоступно — используем последнюю точку"}
            </div>
            {coords && (
              <div className="text-[10px] text-muted-foreground font-mono">
                LAT {coords[0].toFixed(5)} · LNG {coords[1].toFixed(5)}
              </div>
            )}
          </div>
        </div>

        {/* Presets */}
        <div className="text-[10px] tracking-widest text-muted-foreground mb-2">
          ВЫБЕРИТЕ ПРОБЛЕМУ
        </div>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {PRESETS.map(({ id, icon: Icon, title, sub }) => {
            const active = preset === id;
            return (
              <button
                key={id}
                onClick={() => setPreset(active ? null : id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition active:scale-[0.98] text-left ${
                  active
                    ? "bg-primary/15 border-primary/60 glow-red"
                    : "glass border-white/10 hover:border-primary/40"
                }`}
              >
                <div
                  className={`h-10 w-10 grid place-items-center rounded-xl border ${
                    active
                      ? "bg-primary/25 border-primary/60 text-primary"
                      : "bg-primary/10 border-primary/30 text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{title}</div>
                  <div className="text-[11px] text-muted-foreground">{sub}</div>
                </div>
                {active && (
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Custom */}
        <div className="text-[10px] tracking-widest text-muted-foreground mb-2">
          СВОЙ ВАРИАНТ
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Если вашей проблемы нет в списке, опишите её здесь..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:bg-white/10 transition resize-none mb-4"
        />

        {/* Submit */}
        <button
          disabled={!canSend}
          onClick={submit}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-red-700 font-display font-black text-base tracking-widest text-white glow-red active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
        >
          🆘 ОТПРАВИТЬ СИГНАЛ SOS
        </button>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Маркер появится на общей карте · сообщение уйдёт в SOS-чат
        </p>
      </div>
    </div>
  );
}
