import { useState } from "react";
import { SPOTS, type CityId } from "@/lib/streetgrid/data";
import { type Spot, SPOT_RARITY_ORDER, getSpotRarityVisual } from "@/lib/streetgrid/spots";
import { Navigation, MapPin, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "ВСЕ" },
  ...SPOT_RARITY_ORDER.map((r) => ({
    id: r,
    label: getSpotRarityVisual(r).label,
  })),
] as const;

export function SpotsPanel({
  city,
  onSelectSpot,
  onRouteTo,
}: {
  city: CityId;
  onSelectSpot?: (spot: Spot) => void;
  onRouteTo?: (coords: [number, number], name: string) => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const byCity = city === "all" ? SPOTS : SPOTS.filter((s) => s.city === city);
  const list = filter === "all" ? byCity : byCity.filter((s) => s.rarity === filter);

  return (
    <div className="p-4 space-y-3 pb-24">
      <div className="mb-1">
        <h2 className="font-display text-xl font-black">СПОТЫ</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Точки на карте с наградами · нажмите, чтобы открыть
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const color = f.id === "all" ? undefined : getSpotRarityVisual(f.id as Spot["rarity"]).color;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 h-9 px-3 rounded-xl text-[10px] font-bold tracking-wider transition border",
                active
                  ? "bg-primary/20 border-primary/40 text-foreground"
                  : "glass border-white/5 text-muted-foreground",
              )}
              style={active && color ? { borderColor: `${color}66`, color } : undefined}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          Спотов не найдено. Добавьте свой с карты!
        </div>
      )}

      {list.map((s) => (
        <SpotCard key={s.id} spot={s} onSelect={onSelectSpot} onRouteTo={onRouteTo} />
      ))}
    </div>
  );
}

function SpotCard({
  spot,
  onSelect,
  onRouteTo,
}: {
  spot: Spot;
  onSelect?: (s: Spot) => void;
  onRouteTo?: (coords: [number, number], name: string) => void;
}) {
  const visual = getSpotRarityVisual(spot.rarity);

  return (
    <article
      onClick={() => onSelect?.(spot)}
      className="glass rounded-2xl overflow-hidden animate-float-up cursor-pointer hover:border transition border border-white/5"
      style={{ borderColor: `${visual.color}22` }}
    >
      <div
        className="h-24 grid place-items-center text-5xl relative"
        style={{
          background: `linear-gradient(135deg, ${visual.color}18 0%, transparent 70%)`,
        }}
      >
        <span>{spot.icon}</span>
        <div
          className="absolute top-2 right-2 rounded-full px-2.5 py-1 text-[9px] font-black tracking-widest border"
          style={{
            color: visual.color,
            borderColor: `${visual.color}55`,
            background: `${visual.color}15`,
          }}
        >
          {visual.label}
        </div>
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-display font-black text-base">{spot.name}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{spot.description}</p>
        <div className="flex flex-wrap gap-3 text-[11px] pt-1">
          <span className="flex items-center gap-1 font-bold" style={{ color: visual.color }}>
            <Trophy className="h-3 w-3" /> +{spot.reward.xp} XP
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" /> {spot.participants}
          </span>
          <span className="text-muted-foreground">{spot.owner}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/5">
          <span className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {spot.city.toUpperCase()}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onRouteTo?.(spot.coords, spot.name); }}
            className="font-bold tracking-wider flex items-center gap-1 hover:opacity-80 transition"
            style={{ color: visual.color }}
          >
            <Navigation className="h-3 w-3" /> ПОЕХАЛИ →
          </button>
        </div>
      </div>
    </article>
  );
}
