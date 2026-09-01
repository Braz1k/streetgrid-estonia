import { memo } from "react";
import { cn } from "@/lib/utils";
import type { VehicleRarity } from "@/lib/streetgrid/vehicles";
import { MarkerBadgeLayer, type MarkerBadgeConfig } from "./MarkerBadges";
import { MarkerRing } from "./MarkerRing";

export type MarkerRendererProps = {
  avatar: string;
  rarity: VehicleRarity;
  isSelf?: boolean;
  isOnline?: boolean;
  isFriend?: boolean;
  level?: number;
  showLevel?: boolean;
  extraBadges?: Pick<MarkerBadgeConfig, "developer" | "club" | "vip">;
};

/**
 * Player marker — one construction for every tier:
 * glow → ring → avatar → online → optional badges (YOU / level / …)
 */
export const MarkerRenderer = memo(function MarkerRenderer({
  avatar,
  rarity,
  isSelf = false,
  isOnline = false,
  isFriend = false,
  level = 1,
  showLevel = false,
  extraBadges = {},
}: MarkerRendererProps) {
  const badges: MarkerBadgeConfig = {
    online: isOnline,
    friend: isFriend,
    level,
    you: isSelf,
    ...extraBadges,
  };

  return (
    <div className={cn("sg-marker", isSelf && "sg-marker--self")}>
      <MarkerRing
        rarity={rarity}
        isSelf={isSelf}
        badges={
          <MarkerBadgeLayer badges={badges} showLevel={showLevel} isSelf={isSelf} />
        }
      >
        <img src={avatar} alt="" className="sg-marker__photo" draggable={false} />
      </MarkerRing>
    </div>
  );
});
