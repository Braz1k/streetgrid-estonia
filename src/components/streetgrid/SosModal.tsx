import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const noteText = note.trim();
  const selected = PRESETS.find((p) => p.id === preset);
  const overlayRoot =
    document.querySelector(".sg-app-shell") ?? document.body;

  const submit = () => {
    if (!coords) return;
    const presetLabel = selected?.title;
    const label = presetLabel ?? noteText;
    onSubmit({ preset, label, note: noteText, coords });
  };

  return createPortal(
    <div className="sg-sos-overlay" onClick={onClose} role="presentation">
      <div
        className="sg-sos-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-sos-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sg-sos-dialog__head">
          <div className="sg-sos-dialog__brand">
            <span className="sg-sos-dialog__badge" aria-hidden>
              <Siren className="sg-sos-dialog__badge-icon" strokeWidth={1.9} />
            </span>
            <div className="sg-sos-dialog__titles">
              <h2 id="sg-sos-title" className="sg-sos-dialog__title">SOS</h2>
              <p className="sg-sos-dialog__sub">Сигнал увидят водители рядом</p>
            </div>
          </div>
          <button
            type="button"
            className="sg-sos-dialog__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X className="sg-sos-dialog__close-icon" />
          </button>
        </header>

        <section className="sg-sos-dialog__geo">
          {geoState === "loading" ? (
            <Loader2 className="sg-sos-dialog__geo-icon animate-spin" />
          ) : (
            <MapPin className="sg-sos-dialog__geo-icon" />
          )}
          <div className="sg-sos-dialog__geo-copy">
            <div className="sg-sos-dialog__geo-status">
              {geoState === "loading" && "Определяем геопозицию..."}
              {geoState === "ok" && "Ваша геопозиция определена"}
              {geoState === "fallback" && "Гео недоступно — используем последнюю точку"}
            </div>
            {coords && (
              <div className="sg-sos-dialog__geo-coords">
                LAT {coords[0].toFixed(5)} · LNG {coords[1].toFixed(5)}
              </div>
            )}
          </div>
        </section>

        <div className="sg-sos-dialog__label">ВЫБЕРИТЕ ПРОБЛЕМУ</div>
        <div className="sg-sos-dialog__presets">
          {PRESETS.map(({ id, icon: Icon, title, sub }) => {
            const active = preset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPreset(active ? null : id)}
                className={`sg-sos-preset${active ? " sg-sos-preset--active" : ""}`}
                aria-pressed={active}
              >
                <span className="sg-sos-preset__icon">
                  <Icon className="sg-sos-preset__glyph" />
                </span>
                <span className="sg-sos-preset__text">
                  <span className="sg-sos-preset__title">{title}</span>
                  <span className="sg-sos-preset__sub">{sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="sg-sos-dialog__label">СВОЙ ВАРИАНТ</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Если вашей проблемы нет в списке, опишите её здесь..."
          rows={2}
          className="sg-sos-dialog__note"
        />

        <button
          type="button"
          disabled={!canSend}
          onClick={submit}
          className="sg-sos-dialog__submit"
        >
          ОТПРАВИТЬ СИГНАЛ
        </button>
        <p className="sg-sos-dialog__hint">
          Маркер появится на общей карте · сообщение уйдёт в SOS-чат
        </p>
      </div>
    </div>,
    overlayRoot,
  );
}
