import type { CSSProperties } from "react";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZOOM_AVATAR_MIN } from "@/lib/streetgrid/avatarVehicleTransition";
import {
  getMarkerRarityStyles,
  type VehicleRarity,
} from "@/lib/streetgrid/vehicles";

export type PlayerMarkerZoomBand = "far" | "medium" | "near" | "hidden";

export type PlayerMarkerProps = {
  avatar: string;
  nickname: string;
  level: number;
  rarity: VehicleRarity;
  vehicleColor: string;
  isOnline: boolean;
  isCurrentUser?: boolean;
  zoomBand?: PlayerMarkerZoomBand;
  /** 0–1 opacity for 2D vehicle icon (social mid-band). */
  vehicleIconOpacity?: number;
  /** Level badge — visible zoom 12–15. */
  showLevel?: boolean;
};

export function getPlayerMarkerZoom(zoom: number): PlayerMarkerZoomBand {
  if (zoom >= ZOOM_AVATAR_MIN) return "medium";
  return "far";
}

/** Premium pin marker — avatar, rarity ring, tail, level, online. */
export function PlayerMarker({
  avatar,
  nickname,
  level,
  rarity,
  vehicleColor,
  isOnline,
  isCurrentUser = false,
  zoomBand = "far",
  vehicleIconOpacity = 0,
  showLevel = true,
}: PlayerMarkerProps) {
  if (zoomBand === "hidden") return null;

  const rarityStyle = (
    isCurrentUser ? undefined : getMarkerRarityStyles(rarity)
  ) as CSSProperties | undefined;
  const showVehicleIcon = vehicleIconOpacity > 0.02;

  return (
    <div
      className={cn(
        "sg-player-marker",
        !isCurrentUser && `sg-player-marker--${rarity}`,
        isCurrentUser && "sg-player-marker--self",
        showVehicleIcon && "sg-player-marker--with-vehicle",
      )}
      style={rarityStyle}
    >
      <div className="sg-player-marker__body">
        <div className="sg-player-marker__pin">
          {isCurrentUser && (
            <span className="sg-player-marker__you" aria-label="You">
              YOU
            </span>
          )}
          <span className="sg-player-marker__glow" aria-hidden />
          {isCurrentUser && (
            <span className="sg-player-marker__gold-ring" aria-hidden />
          )}
          <div className="sg-player-marker__photo-wrap">
            <img
              src={avatar}
              alt=""
              className="sg-player-marker__photo"
              draggable={false}
              width={92}
              height={92}
            />
            {isOnline && (
              <span className="sg-player-marker__online" title="Online" />
            )}
            {showLevel && (
              <span
                className={cn(
                  "sg-player-marker__level",
                  level >= 10 && "sg-player-marker__level--wide",
                  isCurrentUser && "sg-player-marker__level--self",
                )}
                title={`Level ${level}`}
                aria-label={`Level ${level}`}
              >
                {level}
              </span>
            )}
          </div>
          <span className="sg-player-marker__tail" aria-hidden>
            <span className="sg-player-marker__tail-tip" />
          </span>
        </div>

        {showVehicleIcon && (
          <span
            className="sg-player-marker__vehicle"
            style={{
              opacity: vehicleIconOpacity,
              color: vehicleColor,
              borderColor: `${vehicleColor}88`,
              boxShadow: `0 0 6px ${vehicleColor}33`,
            }}
            aria-hidden
          >
            <Car className="sg-player-marker__vehicle-icon" strokeWidth={2.5} />
          </span>
        )}
      </div>
    </div>
  );
}
