import { useEffect, useState } from "react";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { getPlayerLevel, getXpBarPercent, XP_PER_LEVEL } from "@/lib/streetgrid/vehicles";

export function usePlayerProgress() {
  const { selectedCarId, getOwnedVehicle, vehicleProgress } = useStreetGrid();
  const owned = getOwnedVehicle(selectedCarId);
  const level = owned?.level ?? getPlayerLevel(vehicleProgress);
  const currentXP = owned?.xp ?? 0;
  const requiredXP = XP_PER_LEVEL;
  const xpPct = getXpBarPercent(currentXP);

  const [xpBar, setXpBar] = useState(xpPct);
  useEffect(() => {
    const id = requestAnimationFrame(() => setXpBar(xpPct));
    return () => cancelAnimationFrame(id);
  }, [xpPct]);

  return { level, currentXP, requiredXP, xpPct, xpBar };
}

/** XP bar row — sits below LVL • XP% with breathing room. */
export function HeaderXpBar({ xpBar }: { xpBar: number }) {
  return (
    <div className="sg-header__xp min-w-0">
      <div className="sg-xp-bar-track w-full">
        <div className="sg-xp-bar-fill" style={{ width: `${xpBar}%` }} />
      </div>
    </div>
  );
}
