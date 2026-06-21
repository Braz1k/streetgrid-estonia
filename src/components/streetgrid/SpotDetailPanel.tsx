import { Navigation, Users, Trophy, X } from "lucide-react";
import type { Spot } from "@/lib/streetgrid/spots";
import { getSpotRarityVisual } from "@/lib/streetgrid/spots";
import { cn } from "@/lib/utils";

type Props = {
  spot: Spot | null;
  onClose: () => void;
  onRoute: (coords: [number, number], name: string) => void;
};

const RARITY_PANEL: Record<Spot["rarity"], string> = {
  common:    "border-[#00f0ff]/40 shadow-[0_0_32px_rgba(0,240,255,0.12)]",
  rare:      "border-[#3399ff]/45 shadow-[0_0_32px_rgba(51,153,255,0.14)]",
  epic:      "border-[#bb44ff]/45 shadow-[0_0_36px_rgba(187,68,255,0.16)]",
  legendary: "border-[#ffcc33]/50 shadow-[0_0_40px_rgba(255,204,51,0.2)]",
};

const RARITY_BADGE: Record<Spot["rarity"], string> = {
  common:    "bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/40",
  rare:      "bg-[#3399ff]/15 text-[#3399ff] border-[#3399ff]/40",
  epic:      "bg-[#bb44ff]/15 text-[#bb44ff] border-[#bb44ff]/40",
  legendary: "bg-[#ffcc33]/15 text-[#ffcc33] border-[#ffcc33]/45",
};

export function SpotDetailPanel({ spot, onClose, onRoute }: Props) {
  if (!spot) return null;

  const visual = getSpotRarityVisual(spot.rarity);

  return (
    <div
      className="absolute bottom-[58px] left-0 right-0 z-[650] pointer-events-auto animate-float-up"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "glass-strong rounded-t-3xl border-t p-5 pb-10 max-h-[58vh] overflow-y-auto",
          RARITY_PANEL[spot.rarity],
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-14 w-14 shrink-0 rounded-2xl grid place-items-center text-2xl border-2"
              style={{
                borderColor: visual.color,
                boxShadow: `0 0 20px ${visual.color}44`,
                background: "rgba(8,10,18,0.9)",
              }}
            >
              {spot.icon}
            </div>
            <div className="min-w-0">
              <span
                className={cn(
                  "inline-block text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full border mb-1.5",
                  RARITY_BADGE[spot.rarity],
                )}
              >
                {visual.label}
              </span>
              <h2 className="font-display font-black text-lg leading-tight truncate">{spot.name}</h2>
              {spot.userAdded && (
                <span className="text-[10px] text-muted-foreground">Добавлено игроками</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 shrink-0 grid place-items-center rounded-full glass border border-white/10"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{spot.description}</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="glass rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground mb-1">
              <Trophy className="h-3 w-3" style={{ color: visual.color }} />
              НАГРАДА
            </div>
            <div className="text-sm font-black" style={{ color: visual.color }}>
              +{spot.reward.xp} XP
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{spot.reward.label}</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground mb-1">
              <Users className="h-3 w-3" style={{ color: visual.color }} />
              УЧАСТНИКИ
            </div>
            <div className="text-sm font-black">{spot.participants}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">сейчас на споте</div>
          </div>
        </div>

        <div className="glass rounded-xl px-3 py-2.5 mb-4 border border-white/5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">Владелец</span>
          <span className="font-bold">{spot.owner}</span>
        </div>

        <button
          onClick={() => onRoute(spot.coords, spot.name)}
          className="w-full h-12 rounded-xl font-black text-sm tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition"
          style={{
            background: `${visual.color}22`,
            color: visual.color,
            border: `1px solid ${visual.color}66`,
            boxShadow: `0 0 20px ${visual.color}22`,
          }}
        >
          <Navigation className="h-4 w-4" />
          ПОЕХАЛИ
        </button>
      </div>
    </div>
  );
}
