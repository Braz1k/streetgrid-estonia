import { CITIES, type CityId } from "@/lib/streetgrid/data";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: CityId;
  onChange: (id: CityId) => void;
};

export function CitySelector({ value, onChange }: Props) {
  return (
    <div className="sticky top-[64px] z-40 glass-strong border-b border-white/5">
      <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar">
        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
        {CITIES.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              className={cn(
                "shrink-0 h-8 px-3 rounded-lg text-[10px] font-bold tracking-wider transition flex items-center gap-1.5",
                active
                  ? "bg-primary text-primary-foreground glow-red"
                  : "glass text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-[9px] opacity-70">{c.short}</span>
              <span>{c.name.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
