import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  getMarkerRarityStyles,
  type VehicleRarity,
} from "@/lib/streetgrid/vehicles";

export type PlayerClusterMarkerProps = {
  count: number;
  rarity: VehicleRarity;
  avatarUrls: string[];
  expanding?: boolean;
};

/** 10+ players → avatar stack + count badge; 2–9 → count badge only. */
export const STACK_MIN_COUNT = 10;

export function PlayerClusterMarker({
  count,
  rarity,
  avatarUrls,
  expanding = false,
}: PlayerClusterMarkerProps) {
  const rarityStyle = getMarkerRarityStyles(rarity) as CSSProperties;
  const showStack = count >= STACK_MIN_COUNT && avatarUrls.length > 0;
  const stack = avatarUrls.slice(0, 3);

  return (
    <button
      type="button"
      className={cn(
        "sg-player-cluster",
        `sg-player-cluster--${rarity}`,
        showStack && "sg-player-cluster--stacked",
        expanding && "sg-player-cluster--expand",
      )}
      style={rarityStyle}
      aria-label={`${count} players`}
    >
      <span className="sg-player-cluster__glow" aria-hidden />
      <span className="sg-player-cluster__ring">
        {showStack ? (
          <span className="sg-player-cluster__stack">
            {stack.map((url, i) => (
              <img
                key={`${url}-${i}`}
                src={url}
                alt=""
                className="sg-player-cluster__avatar"
                style={{ zIndex: stack.length - i }}
                draggable={false}
              />
            ))}
          </span>
        ) : (
          <span className="sg-player-cluster__badge">{count}</span>
        )}
        {showStack && (
          <span className="sg-player-cluster__count">{count}</span>
        )}
      </span>
    </button>
  );
}
