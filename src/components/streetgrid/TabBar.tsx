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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[480px] glass-strong border-t border-white/5">
      <div className="grid grid-cols-6 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-1.5 rounded-lg transition-all relative",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground/80"
              )}
            >
              {isActive && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary glow-red" />
              )}
              <Icon className={cn("h-4 w-4 transition-transform", isActive && "scale-110")} />
              <span className="text-[9px] font-bold tracking-wider">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
