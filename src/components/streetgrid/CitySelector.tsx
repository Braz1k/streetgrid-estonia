import { CITIES, type CityId } from "@/lib/streetgrid/data";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: CityId;
  onChange: (id: CityId) => void;
};

export function CitySelector({ value, onChange }: Props) {

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

    </div>
  );
}
