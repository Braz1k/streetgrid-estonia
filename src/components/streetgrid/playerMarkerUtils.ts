import type { VehicleRarity } from "@/lib/streetgrid/vehicles";
import {
  ZOOM_AVATAR_MIN,
  HYST_AVATAR_MODE_MIN,
} from "@/lib/streetgrid/avatarVehicleTransition";

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
  /** Level badge visibility is gated via mount `data-show-level`. */
  showLevel?: boolean;
  /** Future-ready — friend badge slot. */
  isFriend?: boolean;
};

export function getPlayerMarkerZoom(zoom: number): PlayerMarkerZoomBand {
  if (zoom >= HYST_AVATAR_MODE_MIN) return "medium";
  if (zoom >= ZOOM_AVATAR_MIN) return "far";
  return "far";
}
