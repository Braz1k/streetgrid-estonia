import { useEffect, useState } from "react";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { getPlayerLevel, getXpBarPercent } from "@/lib/streetgrid/vehicles";

export function usePlayerProgress() {
  const { selectedCarId, getOwnedVehicle, vehicleProgress } = useStreetGrid();
  const owned = getOwnedVehicle(selectedCarId);
  const level = owned?.level ?? getPlayerLevel(vehicleProgress);
  const xp    = owned?.xp ?? 0;
  const xpPct = getXpBarPercent(xp);

  const [xpBar, setXpBar] = useState(xpPct);
  useEffect(() => {
    const id = requestAnimationFrame(() => setXpBar(xpPct));
    return () => cancelAnimationFrame(id);
  }, [xpPct]);

  return { level, xpPct, xpBar };
}

/** XP bar + percent — third row of compact header. */
export function HeaderXpBar({ xpBar, xpPct }: { xpBar: number; xpPct: number }) {
  return (
    <div className="sg-header__xp flex items-center gap-1.5 min-w-0">
      <div className="sg-xp-bar-track flex-1 min-w-0">
        <div className="sg-xp-bar-fill" style={{ width: `${xpBar}%` }} />
      </div>
      <span className="sg-xp-level-line shrink-0 text-[8px] font-display font-black tracking-wide text-accent/80">
        {xpPct}%
      </span>
    </div>
  );
}
