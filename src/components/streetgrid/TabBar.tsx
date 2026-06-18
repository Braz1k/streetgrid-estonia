import { Map, Users, Car, Route as RouteIcon, MapPin, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "map" | "meets" | "garage" | "routes" | "spots" | "chat";

const TABS: { id: TabId; label: string; icon: typeof Map }[] = [
  { id: "map", label: "КАРТА", icon: Map },
  { id: "meets", label: "МИТЫ", icon: Users },
  { id: "garage", label: "ГАРАЖ", icon: Car },
  { id: "routes", label: "МАРШРУТЫ", icon: RouteIcon },
  { id: "spots", label: "СПОТЫ", icon: MapPin },
  { id: "chat", label: "ЧАТ", icon: MessageSquare },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-50 glass-strong border-t border-white/[0.06] backdrop-blur-xl">
      <div className="grid grid-cols-6 px-0.5 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                "sg-tab-btn flex flex-col items-center gap-0.5 py-1 rounded-lg transition-all relative",
                isActive ? "sg-tab-btn--active" : "sg-tab-btn--idle",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-all",
                  isActive
                    ? "text-white stroke-white"
                    : "text-muted-foreground/55 stroke-muted-foreground/55 fill-none",
                )}
                strokeWidth={isActive ? 2 : 1.25}
                fill={isActive ? "currentColor" : "none"}
                fillOpacity={isActive ? 0.15 : 0}
              />
              <span
                className={cn(
                  "text-[8px] font-bold tracking-wider leading-none",
                  isActive
                    ? "text-white drop-shadow-[0_0_10px_rgba(255,0,85,0.5)]"
                    : "text-muted-foreground/50",
                )}
              >
                {isActive ? "◉" : "○"} {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
