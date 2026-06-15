import { useState } from "react";
import { SPOTS, type Spot, type CityId } from "@/lib/streetgrid/data";
import { Star, MapPin, Camera, Coffee, Droplets, Navigation, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "ВСЕ", icon: MapPin },
  { id: "photo", label: "ФОТО", icon: Camera },
  { id: "friendly", label: "АВТО-ФРЕНДЛИ", icon: Coffee },
  { id: "wash", label: "МОЙКИ", icon: Droplets },
  { id: "parking", label: "ПАРКОВКИ", icon: Square },
] as const;

export function SpotsPanel({ city, onSelectSpot, onRouteTo }: { city: CityId; onSelectSpot?: (spot: Spot) => void; onRouteTo?: (coords: [number, number], name: string) => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const byCity = city === "all" ? SPOTS : SPOTS.filter((s) => s.city === city);
  const list = filter === "all" ? byCity : byCity.filter((s) => s.type === filter);

  return (
    <div className="p-4 space-y-3 pb-24">
      <div className="mb-1">
        <h2 className="font-display text-xl font-black">СЕКРЕТНЫЕ СПОТЫ</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Локации для авто-сессий · нажмите карточку, чтобы открыть на карте</p>
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 h-9 px-3 rounded-xl text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition",
                active ? "bg-primary text-primary-foreground glow-red" : "glass text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {f.label}
            </button>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          Спотов не найдено. Добавьте свой с карты!
        </div>
      )}

      {list.map((s) => <SpotCard key={s.id} spot={s} onSelect={onSelectSpot} onRouteTo={onRouteTo} />)}
    </div>
  );
}

function SpotCard({ spot, onSelect, onRouteTo }: { spot: Spot; onSelect?: (s: Spot) => void; onRouteTo?: (coords: [number, number], name: string) => void }) {
  const accent =
    spot.type === "photo" ? "from-accent/20 border-accent/30 text-accent" :
    spot.type === "wash" ? "from-nitro/20 border-nitro/30 text-nitro" :
    "from-primary/20 border-primary/30 text-primary";
  return (
    <article
      onClick={() => onSelect?.(spot)}
      className="glass rounded-2xl overflow-hidden animate-float-up cursor-pointer hover:border hover:border-accent/40 transition"
    >
      <div className={`h-24 bg-gradient-to-br ${accent} to-transparent grid place-items-center text-5xl relative`}>
        <span>{spot.photo}</span>
        <div className="absolute top-2 right-2 glass-strong rounded-full px-2.5 py-1 text-[10px] font-bold flex items-center gap-1">
          <Star className="h-3 w-3 fill-nitro text-nitro" /> {spot.rating || "—"}
        </div>
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-display font-black text-base">{spot.name}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{spot.description}</p>
        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/5">
          <span className="text-muted-foreground">{spot.reviews} отзывов</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRouteTo?.(spot.coords, spot.name); }}
            className="text-accent font-bold tracking-wider flex items-center gap-1 hover:text-accent/80 transition"
          >
            <Navigation className="h-3 w-3" /> ПОЕХАЛИ →
          </button>
        </div>
      </div>
    </article>
  );
}

