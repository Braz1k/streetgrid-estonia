import { createRoot, type Root } from "react-dom/client";
import mapboxgl from "mapbox-gl";
import {
  PlayerClusterMarker,
  type PlayerClusterMarkerProps,
} from "./PlayerClusterMarker";

export type MountedPlayerCluster = {
  marker: mapboxgl.Marker;
  container: HTMLDivElement;
  root: Root;
  props: PlayerClusterMarkerProps;
};

export function mountPlayerClusterMarker(
  map: mapboxgl.Map,
  coords: [number, number],
  props: PlayerClusterMarkerProps,
  onClick: () => void,
): MountedPlayerCluster {
  const container = document.createElement("div");
  container.className = "sg-player-cluster-mount";
  const root = createRoot(container);
  const entry: MountedPlayerCluster = { marker: null!, container, root, props };

  const render = (p: PlayerClusterMarkerProps) => {
    root.render(<PlayerClusterMarker {...p} />);
  };
  render(props);

  container.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });

  const marker = new mapboxgl.Marker({ element: container, anchor: "center" })
    .setLngLat(coords)
    .addTo(map);

  entry.marker = marker;
  return entry;
}

export function updatePlayerClusterMarker(
  entry: MountedPlayerCluster,
  props: PlayerClusterMarkerProps,
) {
  entry.props = props;
  entry.root.render(<PlayerClusterMarker {...props} />);
}

/** Brief scale-out before map zoom — animated cluster expand. */
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
  window.setTimeout(finish, 480);
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
