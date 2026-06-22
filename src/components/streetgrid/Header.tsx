import { useState } from "react";
import { Bell, Settings } from "lucide-react";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { SettingsModal } from "./SettingsModal";
import { HeaderXpBar, usePlayerProgress } from "./PlayerProgressBlock";

export function Header() {
  const { profile } = useStreetGrid();
  const { level, xpPct, xpBar } = usePlayerProgress();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="sg-header sticky top-0 z-50 glass-strong border-b border-white/5">
      <div className="sg-header__inner flex items-center gap-2 px-3 sm:px-4">
        <div className="sg-header__logo relative h-6 w-6 shrink-0 grid place-items-center rounded-md bg-primary/15 border border-primary/40 text-glow-red">
          <span className="font-display text-[8px] font-black text-primary">SG</span>
          <span className="absolute -bottom-0.5 -right-0.5 h-1 w-1 rounded-full bg-nitro animate-pulse-ring" />
        </div>

        <div className="sg-header__body flex-1 min-w-0">
          <h1 className="font-display text-[11px] font-black leading-none tracking-tight">
            STREET<span className="text-primary text-glow-red">GRID</span>
          </h1>
          <p className="text-[10px] font-semibold text-accent/90 truncate leading-none">
            {profile.handle}
          </p>
          <p className="sg-header__stats sg-xp-level-line text-[8px] font-display font-black tracking-wider text-accent/85 leading-none">
            LVL {level}
            <span className="text-muted-foreground/45 mx-1">•</span>
            {xpPct}%
          </p>
          <HeaderXpBar xpBar={xpBar} />
        </div>

        <div className="sg-header__actions flex items-center gap-0.5 shrink-0 self-center">
          <button
            type="button"
            aria-label="Уведомления"
            className="h-6 w-6 grid place-items-center rounded-md glass hover:bg-white/5 transition"
          >
            <Bell className="h-3 w-3 text-foreground/80" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Открыть настройки"
            className="h-6 w-6 grid place-items-center rounded-md glass hover:bg-white/5 hover:border-accent/40 transition"
          >
            <Settings className="h-3 w-3 text-foreground/80" />
          </button>
          <div className="h-6 w-6 grid place-items-center rounded-md bg-gradient-to-br from-primary to-primary/40 text-[8px] font-bold">
            {profile.avatar}
          </div>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
