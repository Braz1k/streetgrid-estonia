import { ROUTES } from "@/lib/streetgrid/data";
import { Star, Navigation, Clock, Route as RouteIcon, Play } from "lucide-react";

export function RoutesPanel() {
  return (
    <div className="p-4 space-y-3 pb-24">
      <div className="mb-1">
        <h2 className="font-display text-xl font-black">КРУИЗ-МАРШРУТЫ</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Лучшие дороги для драйва</p>
      </div>

      {ROUTES.map((r) => (
        <article key={r.id} className="glass rounded-2xl overflow-hidden animate-float-up">
          <div className="h-24 bg-gradient-to-br from-accent/20 via-surface-2 to-primary/10 relative grid place-items-center">
            <span className="text-5xl">{r.cover}</span>
            <div className="absolute top-2 left-2 glass-strong rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest text-accent border border-accent/30">
              {r.type.toUpperCase()}
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1 glass-strong rounded-full px-2.5 py-1 text-[10px] font-bold">
              <Star className="h-3 w-3 fill-nitro text-nitro" /> {r.rating}
            </div>
          </div>
          <div className="p-4 space-y-2">
            <h3 className="font-display font-black text-base">{r.name}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1"><RouteIcon className="h-3 w-3 text-primary" />{r.distance}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-accent" />{r.duration}</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Navigation className="h-3 w-3" />{r.path.length} точек</span>
              </div>
              <button className="h-9 px-3 rounded-xl bg-accent text-accent-foreground font-bold text-xs tracking-wider glow-cyan flex items-center gap-1.5 active:scale-95 transition">
                <Play className="h-3 w-3 fill-current" /> СТАРТ
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
