import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  getMarkerRarityStyles,
  type VehicleRarity,
} from "@/lib/streetgrid/vehicles";

export type PlayerClusterMarkerProps = {
  count: number;
  rarity: VehicleRarity;
  /** Up to 3 avatar URLs — shown when count ≥ 10. */
  previewAvatars?: string[];
  expanding?: boolean;
};

function clusterVariant(count: number): "count" | "stack" {
  return count >= 10 ? "stack" : "count";
}

/** Premium STREETGRID cluster — count (2–9) or count + avatar stack (10+). */
export function PlayerClusterMarker({
  count,
  rarity,
  previewAvatars = [],
  expanding = false,
}: PlayerClusterMarkerProps) {
  const rarityStyle = getMarkerRarityStyles(rarity) as CSSProperties;
  const variant = clusterVariant(count);
  const avatars = previewAvatars.slice(0, 3);

  return (
    <button
      type="button"
      className={cn(
        "sg-player-cluster",
        `sg-player-cluster--${rarity}`,
        `sg-player-cluster--${variant}`,
        expanding && "sg-player-cluster--expand",
      )}
      style={rarityStyle}
      aria-label={`${count} players nearby`}
    >
      <span className="sg-player-cluster__glow" aria-hidden />

      {variant === "count" ? (
        <span className="sg-player-cluster__disc">
          <span className="sg-player-cluster__count">{count}</span>
        </span>
      ) : (
        <span className="sg-player-cluster__stack">
          <span className="sg-player-cluster__avatars" aria-hidden>
            {avatars.map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={src}
                alt=""
                className="sg-player-cluster__avatar"
                draggable={false}
                width={56}
                height={56}
                style={{ zIndex: avatars.length - i }}
              />
            ))}
          </span>
          <span className="sg-player-cluster__count">{count}</span>
        </span>
      )}
    </button>
  );
}
