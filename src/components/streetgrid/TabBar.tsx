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
    <nav className="sg-tabbar" aria-label="Main">
      <div className="sg-tabbar__row">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={cn("sg-tab-btn", isActive && "sg-tab-btn--active")}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="sg-tab-btn__icon" strokeWidth={1.75} aria-hidden />
              <span className="sg-tab-btn__label">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
