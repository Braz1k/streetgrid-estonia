import { useEffect, useState } from "react";
import { CITIES, type CityId } from "@/lib/streetgrid/data";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: CityId;
  onChange: (id: CityId) => void;
};

function usePartyCountdown(initialSeconds = 271) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    const tick = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(tick);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function CitySelector({ value, onChange }: Props) {
  const partyEta = usePartyCountdown();

  return (
    <div className="sticky top-[48px] z-40 glass-strong border-b border-white/5">
      <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 overflow-x-auto no-scrollbar">
        <MapPin className="h-3 w-3 text-primary shrink-0" />
        {CITIES.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              className={cn(
                "shrink-0 h-7 px-2.5 rounded-md text-[9px] font-bold tracking-wide transition flex items-center gap-1",
                active
                  ? "bg-primary text-primary-foreground glow-red"
                  : "glass text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-[8px] opacity-70">{c.short}</span>
              <span className="whitespace-nowrap">{c.name.toUpperCase()}</span>
            </button>
          );
        })}
      </div>

      <div className="px-2.5 sm:px-3 py-1 border-t border-white/[0.04] bg-black/25">
        <p className="text-[9px] sm:text-[10px] font-mono tracking-wide text-foreground/75 whitespace-nowrap overflow-x-auto no-scrollbar flex items-center gap-2 sm:gap-3">
          <span className="text-[#00ff66] drop-shadow-[0_0_6px_rgba(0,255,102,0.55)] shrink-0">
            ● Онлайн: 147
          </span>
          <span className="text-foreground/30 shrink-0">|</span>
          <span className="shrink-0">🏁 Гонят: 32</span>
          <span className="text-foreground/30 shrink-0">|</span>
          <span className="shrink-0">🔥 Спотов: 8</span>
          <span className="text-foreground/30 shrink-0">|</span>
          <span className="text-accent/90 shrink-0 drop-shadow-[0_0_5px_rgba(0,240,255,0.35)]">
            🎉 Party через {partyEta}
          </span>
        </p>
      </div>
    </div>
  );
}
