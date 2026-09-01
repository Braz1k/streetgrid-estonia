import { memo, type CSSProperties } from "react";
import {
  formatClusterCount,
  getClusterBorderPx,
  getClusterCountFontPx,
  getClusterDiameterPx,
} from "@/lib/streetgrid/playerCluster";

export type PlayerClusterMarkerProps = {
  count: number;
  /** @deprecated Visual redesign — count-only disc; kept for mount API compat. */
  previewAvatars?: string[];
  /** 0–1 visual expand during zoom 13–14. */
  visualExpandT?: number;
};

/** Premium STREETGRID cluster — dark glass disc, cyan glow, centered count. */
export const PlayerClusterMarker = memo(function PlayerClusterMarker({
  count,
  visualExpandT = 0,
}: PlayerClusterMarkerProps) {
  const diameter = getClusterDiameterPx(count, visualExpandT);
  const countFont = getClusterCountFontPx(count, diameter);
  const border = getClusterBorderPx(diameter);

  const clusterStyle = {
    "--cluster-size": `${diameter}px`,
    "--cluster-border": `${border}px`,
    "--cluster-count-font": `${countFont}px`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className="sg-player-cluster"
      style={clusterStyle}
      aria-label={`${count} players in cluster`}
    >
      <span className="sg-player-cluster__disc">
        <span className="sg-player-cluster__count">{formatClusterCount(count)}</span>
      </span>
    </button>
  );
});
