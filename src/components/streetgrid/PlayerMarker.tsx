import type { CSSProperties } from "react";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRESENCE_CROSSFADE_END,
  PLAYER_DETAILED_MIN_ZOOM,
} from "@/lib/streetgrid/avatarVehicleTransition";
import {
  getMarkerRarityStyles,
  RARITY_META,
  type VehicleRarity,
} from "@/lib/streetgrid/vehicles";

export type PlayerMarkerZoomBand = "far" | "medium" | "hidden";

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
};

export function getPlayerMarkerZoom(zoom: number): PlayerMarkerZoomBand {
  if (zoom >= PRESENCE_CROSSFADE_END) return "hidden";
  if (zoom >= PLAYER_DETAILED_MIN_ZOOM) return "medium";
  return "far";
}

/** Circular identity marker — avatar, rarity ring, optional 2D vehicle icon. */
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
}: PlayerMarkerProps) {
  if (zoomBand === "hidden") return null;

  const medium = zoomBand === "medium";
  const label = nickname.startsWith("@") ? nickname : `@${nickname}`;
  const meta = RARITY_META[rarity];
  const rarityStyle = getMarkerRarityStyles(rarity) as CSSProperties;
  const showLevel = medium;
  const showSelfNickname = isCurrentUser && medium;
  const showVehicleIcon = vehicleIconOpacity > 0.02;

  return (
    <div
      className={cn(
        "sg-player-marker",
        `sg-player-marker--${rarity}`,
        `sg-player-marker--${zoomBand}`,
        isCurrentUser && "sg-player-marker--self",
        showVehicleIcon && "sg-player-marker--with-vehicle",
      )}
      style={rarityStyle}
    >
      <div className="sg-player-marker__body">
        <span className="sg-player-marker__glow" aria-hidden />
        {isCurrentUser && <span className="sg-player-marker__gold-ring" aria-hidden />}
        <div className="sg-player-marker__photo-wrap">
          <img
            src={avatar}
            alt=""
            className="sg-player-marker__photo"
            draggable={false}
          />
          {isOnline && (
            <span className="sg-player-marker__online" title="Online" />
          )}
          {showLevel && (
            <span
              className="sg-player-marker__level"
              style={{ color: meta.color, borderColor: `${meta.color}88` }}
            >
              {level}
            </span>
          )}
        </div>
        {showVehicleIcon && (
          <span
            className="sg-player-marker__vehicle"
            style={{
              opacity: vehicleIconOpacity,
              color: vehicleColor,
              borderColor: `${vehicleColor}88`,
              boxShadow: `0 0 10px ${vehicleColor}44`,
            }}
            aria-hidden
          >
            <Car className="sg-player-marker__vehicle-icon" strokeWidth={2.5} />
          </span>
        )}
      </div>

      {showSelfNickname && (
        <span className="sg-player-marker__nickname">{label}</span>
      )}
    </div>
  );
}
