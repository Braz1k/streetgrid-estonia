import { useState } from "react";
import { Bell, Settings } from "lucide-react";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { SettingsModal } from "./SettingsModal";

export function Header() {
  const { profile } = useStreetGrid();
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 glass-strong border-b border-white/5">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 grid place-items-center rounded-lg bg-primary/15 border border-primary/40 text-glow-red">
            <span className="font-display text-xs font-black text-primary">SG</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-nitro animate-pulse-ring" />
          </div>
          <div>
            <h1 className="font-display text-sm font-black leading-none">
              STREET<span className="text-primary text-glow-red">GRID</span>
            </h1>
            <p className="text-[9px] text-muted-foreground tracking-widest mt-0.5">
              {profile.handle.toUpperCase()} · {profile.status.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="h-8 w-8 grid place-items-center rounded-lg glass hover:bg-white/5 transition">
            <Bell className="h-3.5 w-3.5 text-foreground/80" />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Открыть настройки"
            className="h-8 w-8 grid place-items-center rounded-lg glass hover:bg-white/5 hover:border-accent/40 transition"
          >
            <Settings className="h-3.5 w-3.5 text-foreground/80" />
          </button>
          <div className="h-8 w-8 grid place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/40 text-[10px] font-bold">
            {profile.avatar}
          </div>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
