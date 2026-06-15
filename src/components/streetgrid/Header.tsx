import { useState } from "react";
import { Bell, Settings } from "lucide-react";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { SettingsModal } from "./SettingsModal";

export function Header() {
  const { profile } = useStreetGrid();
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 glass-strong border-b border-white/5">
      <div className="flex items-center justify-between px-4 pt-3 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 grid place-items-center rounded-xl bg-primary/15 border border-primary/40 text-glow-red">
            <span className="font-display text-sm font-black text-primary">SG</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-nitro animate-pulse-ring" />
          </div>
          <div>
            <h1 className="font-display text-base font-black leading-none">
              STREET<span className="text-primary text-glow-red">GRID</span>
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-widest mt-0.5">
              {profile.handle.toUpperCase()} · {profile.status.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-9 w-9 grid place-items-center rounded-xl glass hover:bg-white/5 transition">
            <Bell className="h-4 w-4 text-foreground/80" />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Открыть настройки"
            className="h-9 w-9 grid place-items-center rounded-xl glass hover:bg-white/5 hover:border-accent/40 transition"
          >
            <Settings className="h-4 w-4 text-foreground/80" />
          </button>
          <div className="h-9 w-9 grid place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/40 text-xs font-bold">
            {profile.avatar}
          </div>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
