import { X } from "lucide-react";

// ─── Car data ─────────────────────────────────────────────────────────────────

export type SelectableCar = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  color: string;       // neon accent color
  bodyColor: string;   // actual car paint color for the SVG
};

export const SELECTABLE_CARS: SelectableCar[] = [
  {
    id:          "bmw_m3",
    name:        "BMW M3 Competition",
    shortName:   "BMW M3",
    description: "480 л.с. · Stage 2 Tune · KW V3",
    color:       "#ff3355",
    bodyColor:   "#cc1133",
  },
  {
    id:          "subaru_wrx",
    name:        "Subaru WRX STI",
    shortName:   "Subaru WRX",
    description: "Раллийный · 4WD · турбо · 300 л.с.",
    color:       "#2299ff",
    bodyColor:   "#0055cc",
  },
  {
    id:          "nissan_gtr",
    name:        "Nissan GT-R R35",
    shortName:   "GT-R",
    description: "Суперкар · Godzilla · 570 л.с.",
    color:       "#ffcc00",
    bodyColor:   "#ccaa00",
  },
  {
    id:          "mitsu_evo",
    name:        "Mitsubishi Evo X",
    shortName:   "Evo X",
    description: "JDM-легенда · 4G63T · 4WD",
    color:       "#00dd66",
    bodyColor:   "#009944",
  },
  {
    id:          "audi_rs4",
    name:        "Audi RS4 Avant",
    shortName:   "Audi RS4",
    description: "Премиум · Quattro · V6 2.9T",
    color:       "#cccccc",
    bodyColor:   "#999999",
  },
];

const LS_KEY = "sg-selected-car-id";

export function getSavedCarId(): string {
  try {
    const saved = localStorage.getItem(LS_KEY);
    return SELECTABLE_CARS.some((c) => c.id === saved)
      ? (saved as string)
      : SELECTABLE_CARS[0].id;
  } catch {
    return SELECTABLE_CARS[0].id;
  }
}

export function saveCarId(id: string): void {
  try { localStorage.setItem(LS_KEY, id); } catch { /* noop */ }
}

// ─── SVG top-view car helper ──────────────────────────────────────────────────
//
// Returns an inline SVG string of a car viewed from directly above.
// Front of car = top of SVG.
// With Mapbox pitchAlignment:'map' and pitch 60°, the natural perspective
// foreshortening makes the SVG look like a 3D car viewed from above/behind.
//
export function makeCarSvg(bodyColor: string, accentColor: string): string {
  const glass = "rgba(160,215,255,0.55)";
  const hl    = "rgba(255,255,190,0.92)";   // headlights
  const tl    = "rgba(255,55,55,0.92)";     // tail lights
  const roofDark = "rgba(0,0,0,0.28)";

  return `<svg width="40" height="64" viewBox="0 0 40 64" xmlns="http://www.w3.org/2000/svg">
    <!-- ground shadow -->
    <ellipse cx="20" cy="60" rx="14" ry="3.5" fill="rgba(0,0,0,0.32)"/>
    <!-- body -->
    <rect x="4" y="5"  width="32" height="53" rx="10" fill="${bodyColor}"/>
    <!-- body highlight stripe -->
    <rect x="18" y="5" width="4"  height="53" rx="2"  fill="rgba(255,255,255,0.08)"/>
    <!-- roof / cabin -->
    <rect x="8"  y="18" width="24" height="22" rx="6" fill="${roofDark}"/>
    <!-- windshield -->
    <rect x="9"  y="19" width="22" height="9"  rx="3" fill="${glass}"/>
    <!-- rear window -->
    <rect x="9"  y="30" width="22" height="7"  rx="2" fill="${glass}" opacity="0.65"/>
    <!-- front headlights -->
    <rect x="5"  y="6"  width="8"  height="3"  rx="1.5" fill="${hl}"/>
    <rect x="27" y="6"  width="8"  height="3"  rx="1.5" fill="${hl}"/>
    <!-- front DRL strip -->
    <rect x="6"  y="10" width="28" height="2"  rx="1" fill="${accentColor}" opacity="0.7"/>
    <!-- rear lights -->
    <rect x="5"  y="54" width="8"  height="3"  rx="1.5" fill="${tl}"/>
    <rect x="27" y="54" width="8"  height="3"  rx="1.5" fill="${tl}"/>
    <!-- side mirrors -->
    <rect x="1"  y="22" width="4"  height="6"  rx="2" fill="${bodyColor}"/>
    <rect x="35" y="22" width="4"  height="6"  rx="2" fill="${bodyColor}"/>
  </svg>`;
}

// ─── Mapbox HTML marker element ───────────────────────────────────────────────

export function makeCarMarkerEl(car: SelectableCar): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "width:40px;height:64px;",
    `filter:drop-shadow(0 0 6px ${car.color}) drop-shadow(0 0 14px ${car.color}66);`,
    "pointer-events:auto;cursor:pointer;",
    "transition:filter 0.35s;",
  ].join("");
  wrap.innerHTML = makeCarSvg(car.bodyColor, car.color);
  return wrap;
}

// ─── Car selection sheet component ───────────────────────────────────────────

type CarSelectorProps = {
  selectedCarId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function CarSelector({ selectedCarId, onSelect, onClose }: CarSelectorProps) {
  return (
    <div className="fixed inset-0 z-[800]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-5 pb-10 animate-float-up"
        style={{ background: "rgba(8,10,22,0.96)", backdropFilter: "blur(20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold tracking-wider uppercase text-foreground">Гараж</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Выбранная машина отображается на карте
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground transition"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Car list */}
        <div className="flex flex-col gap-2">
          {SELECTABLE_CARS.map((car) => {
            const active = selectedCarId === car.id;
            return (
              <button
                key={car.id}
                onClick={() => onSelect(car.id)}
                className="flex items-center gap-3 w-full p-3.5 rounded-2xl transition-all text-left active:scale-[0.98]"
                style={
                  active
                    ? {
                        background:  `${car.color}14`,
                        border:      `1.5px solid ${car.color}55`,
                        boxShadow:   `0 0 20px ${car.color}1a`,
                      }
                    : {
                        background:  "rgba(255,255,255,0.04)",
                        border:      "1.5px solid rgba(255,255,255,0.06)",
                      }
                }
              >
                {/* Mini car preview */}
                <div
                  className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{
                    background: active ? `${car.color}18` : "rgba(255,255,255,0.04)",
                    border:     `1.5px solid ${active ? car.color : "rgba(255,255,255,0.07)"}`,
                    boxShadow:  active ? `0 0 14px ${car.color}44` : "none",
                  }}
                >
                  {/* Mini SVG top-view of the car */}
                  <div
                    className="scale-[0.6] origin-center"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: makeCarSvg(car.bodyColor, car.color) }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground">{car.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{car.description}</div>
                  {/* Color dot row */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: car.bodyColor, boxShadow: `0 0 6px ${car.color}` }}
                    />
                    <span className="text-[10px]" style={{ color: `${car.color}cc` }}>
                      {car.shortName}
                    </span>
                  </div>
                </div>

                {/* Status badge */}
                {active ? (
                  <span
                    className="text-[10px] font-black shrink-0 px-2.5 py-1 rounded-full"
                    style={{
                      color:      car.color,
                      background: `${car.color}20`,
                      border:     `1px solid ${car.color}55`,
                    }}
                  >
                    ✓ В ИГРЕ
                  </span>
                ) : (
                  <span className="text-[10px] font-medium shrink-0 px-2.5 py-1 rounded-full text-muted-foreground"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    ВЫБРАТЬ
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
