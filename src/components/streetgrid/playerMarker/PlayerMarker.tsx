import { memo } from "react";
import { MarkerRenderer } from "@/lib/streetgrid/markerRendering";
import type { PlayerMarkerProps } from "../playerMarkerUtils";

/** Player map marker — inherits unified MarkerRenderer pipeline. */
export const PlayerMarker = memo(function PlayerMarker(props: PlayerMarkerProps) {
  return (
    <MarkerRenderer
      avatar={props.avatar}
      rarity={props.rarity}
      isSelf={props.isCurrentUser}
      isOnline={props.isOnline}
      isFriend={props.isFriend}
      level={props.level}
      showLevel={props.showLevel}
    />
  );
});
