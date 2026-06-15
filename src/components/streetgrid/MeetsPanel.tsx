import { useMemo, useState } from "react";
import { MEETS, type CityId } from "@/lib/streetgrid/data";
import { Calendar, MapPin, Users, Plus, Check, Navigation } from "lucide-react";

export function MeetsPanel({ city, onRouteTo }: { city: CityId; onRouteTo?: (coords: [number, number], name: string) => void }) {
  const list = useMemo(
    () => (city === "all" ? MEETS : MEETS.filter((m) => m.city === city)),
    [city],
  );
  const [going, setGoing] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(MEETS.map((m) => [m.id, m.going])),
  );

  const toggle = (id: string) => {
    setGoing((g) => {
      const next = !g[id];
      setCounts((c) => ({ ...c, [id]: (c[id] ?? 0) + (next ? 1 : -1) }));
      return { ...g, [id]: next };
    });
  };

  return (
    <div className="p-4 space-y-3 pb-24">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="font-display text-xl font-black">МИТЫ</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Сходки и события рядом</p>
        </div>
        <button className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs tracking-wider glow-red flex items-center gap-2 active:scale-95 transition">
          <Plus className="h-4 w-4" /> СОЗДАТЬ
        </button>
      </div>

      {list.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          В этом регионе пока нет митов. Создайте первый!
        </div>
      )}

      {list.map((m) => (
        <article key={m.id} className="glass rounded-2xl overflow-hidden animate-float-up">
          <div className="h-28 bg-gradient-to-br from-primary/30 via-surface-2 to-accent/20 grid place-items-center text-5xl relative">
            <span>{m.cover}</span>
            <div className="absolute top-2 right-2 glass-strong rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest">
              {m.time.toUpperCase()}
            </div>
          </div>
          <div className="p-4 space-y-2.5">
            <h3 className="font-display font-black text-base leading-tight">{m.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>
            <div className="flex items-center gap-3 text-[11px] text-foreground/70">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{m.location}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-accent" />{m.time.split(",")[1]?.trim() ?? m.time}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Users className="h-4 w-4 text-nitro" />
                <span className="font-bold">{counts[m.id]}</span>
                <span className="text-muted-foreground">едут</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onRouteTo?.(m.coords, m.title)}
                  className="px-3 h-9 rounded-xl glass border border-accent/40 text-accent text-[11px] font-bold tracking-wider flex items-center gap-1.5 active:scale-95 transition"
                >
                  <Navigation className="h-3 w-3" /> ПОЕХАЛИ
                </button>
                <button
                  onClick={() => toggle(m.id)}
                  className={`px-3 h-9 rounded-xl text-[11px] font-bold tracking-wider transition active:scale-95 flex items-center gap-1.5 ${
                    going[m.id]
                      ? "bg-nitro/20 border border-nitro/50 text-nitro glow-nitro"
                      : "bg-primary text-primary-foreground glow-red"
                  }`}
                >
                  {going[m.id] ? <><Check className="h-3.5 w-3.5" />ЕДУ</> : "ПРИЕДУ"}
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
