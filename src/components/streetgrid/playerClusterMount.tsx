import { createRoot, type Root } from "react-dom/client";
import mapboxgl from "mapbox-gl";
import {
  getClusterDisplayOpacity,
  type PresenceOpacities,
} from "@/lib/streetgrid/avatarVehicleTransition";
import {
  PlayerClusterMarker,
  type PlayerClusterMarkerProps,
} from "./PlayerClusterMarker";

/** Tap cluster → smooth zoom (ms). */
export const CLUSTER_ZOOM_MS = 250;
export const CLUSTER_EXPAND_MS = 250;

export type MountedPlayerCluster = {
  marker: mapboxgl.Marker;
  container: HTMLDivElement;
  root: Root;
  props: PlayerClusterMarkerProps;
  key: string;
  painted: boolean;
};

export function mountPlayerClusterMarker(
  map: mapboxgl.Map,
  key: string,
  coords: [number, number],
  props: PlayerClusterMarkerProps,
  onClick: () => void,
  opacities?: PresenceOpacities,
): MountedPlayerCluster {
  const container = document.createElement("div");
  container.className = "sg-player-cluster-mount";
  const root = createRoot(container);
  const entry: MountedPlayerCluster = {
    marker: null!,
    container,
    root,
    props,
    key,
    painted: false,
  };

  root.render(<PlayerClusterMarker {...props} />);
  entry.painted = true;

  container.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });

  const marker = new mapboxgl.Marker({ element: container, anchor: "center" })
    .setLngLat(coords)
    .addTo(map);

  entry.marker = marker;
  applyClusterMountOpacity(
    entry,
    opacities ? getClusterDisplayOpacity(opacities) : 1,
  );
  requestAnimationFrame(() => {
    container.classList.add("sg-player-cluster-mount--ready");
  });
  return entry;
}

function applyClusterMountOpacity(entry: MountedPlayerCluster, clusterOpacity: number) {
  entry.container.style.opacity = String(clusterOpacity);
  entry.container.style.pointerEvents = clusterOpacity > 0.04 ? "auto" : "none";
}

export function updatePlayerClusterMarkersZoom(
  entries: Record<string, MountedPlayerCluster>,
  opacities: PresenceOpacities,
) {
  const clusterOp = getClusterDisplayOpacity(opacities);
  for (const entry of Object.values(entries)) {
    applyClusterMountOpacity(entry, clusterOp);
  }
}

export function updatePlayerClusterMarker(
  entry: MountedPlayerCluster,
  props: PlayerClusterMarkerProps,
  coords?: [number, number],
) {
  const changed =
    entry.props.count !== props.count ||
    entry.props.rarity !== props.rarity ||
    entry.props.expanding !== props.expanding ||
    (entry.props.previewAvatars?.join("|") ?? "") !== (props.previewAvatars?.join("|") ?? "");

  if (changed) {
    entry.props = props;
    entry.root.render(<PlayerClusterMarker {...props} />);
  }

  if (coords) entry.marker.setLngLat(coords);
}

/** Brief scale-out before map zoom — ~260ms. */
export function animatePlayerClusterExpand(
  entry: MountedPlayerCluster,
  onDone: () => void,
) {
  const next = { ...entry.props, expanding: true };
  entry.props = next;
  entry.root.render(<PlayerClusterMarker {...next} />);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone();
  };

  const onEnd = (e: AnimationEvent) => {
    if (e.animationName === "sg-player-cluster-expand") finish();
  };
  entry.container.addEventListener("animationend", onEnd);
  window.setTimeout(finish, CLUSTER_EXPAND_MS + 40);
}

export function unmountPlayerClusterMarker(entry: MountedPlayerCluster) {
  entry.root.unmount();
  entry.marker.remove();
}

export function unmountAllPlayerClusterMarkers(
  entries: Record<string, MountedPlayerCluster>,
) {
  for (const entry of Object.values(entries)) {
    unmountPlayerClusterMarker(entry);
  }
}
