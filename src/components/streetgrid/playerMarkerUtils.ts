import type { VehicleRarity } from "@/lib/streetgrid/vehicles";

export type PlayerMarkerProps = {
  avatar: string;
  nickname: string;
  level: number;
  rarity: VehicleRarity;
  vehicleColor: string;
  isOnline: boolean;
  isCurrentUser?: boolean;
  /** Level badge visibility is gated via mount `data-show-level`. */
  showLevel?: boolean;
  /** Future-ready — friend badge slot. */
  isFriend?: boolean;
};
