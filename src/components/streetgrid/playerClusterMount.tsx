import { createRoot, type Root } from "react-dom/client";
import mapboxgl from "mapbox-gl";
import { getClusterVisualExpandT } from "@/lib/streetgrid/avatarVehicleTransition";
import {
  CLUSTER_TRANSITION_MS,
  CLUSTER_SCALE_HIDDEN,
  type ClusterTransitionController,
} from "@/lib/streetgrid/clusterTransitionController";
import { CLUSTER_MARKER_Z } from "@/lib/streetgrid/playerCluster";
import { MAP_MARKER_LAYER, tagMapMarkerLayer } from "@/lib/streetgrid/mapMarkerLayers";
import {
  PlayerClusterMarker,
  type PlayerClusterMarkerProps,
} from "./PlayerClusterMarker";

/** Tap cluster → smooth zoom + expand (ms). */
export const CLUSTER_ZOOM_MS = 320;
export const CLUSTER_EXPAND_MS = 320;

export type MountedPlayerCluster = {
  marker: mapboxgl.Marker;
  container: HTMLDivElement;
  stage: HTMLDivElement;
  root: Root;
  props: PlayerClusterMarkerProps;
  /** Stable cluster id from ClusterManager. */
  key: string;
  painted: boolean;
  isUnmounting: boolean;
  finalized?: boolean;
  lastVisualExpandT?: number;
};

function renderClusterContent(entry: MountedPlayerCluster) {
  entry.root.render(<PlayerClusterMarker {...entry.props} />);
  entry.painted = true;
}

export function mountPlayerClusterMarker(
  map: mapboxgl.Map,
  key: string,
  coords: [number, number],
  props: PlayerClusterMarkerProps,
  onClick: () => void,
  initialZoomOpacity: number,
  zoom?: number,
  transitions?: ClusterTransitionController,
): MountedPlayerCluster {
  const container = document.createElement("div");
  container.className = "sg-player-cluster-mount";
  tagMapMarkerLayer(container, MAP_MARKER_LAYER.player);

  const stage = document.createElement("div");
  stage.className = "sg-player-cluster-mount__stage";
  container.appendChild(stage);

  const root = createRoot(stage);
  const visualExpandT = zoom != null ? getClusterVisualExpandT(zoom) : 0;
  const entry: MountedPlayerCluster = {
    marker: null!,
    container,
    stage,
    root,
    props: { ...props, visualExpandT },
    key,
    painted: false,
    isUnmounting: false,
    lastVisualExpandT: visualExpandT,
  };

  renderClusterContent(entry);

  container.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });

  const marker = new mapboxgl.Marker({ element: container, anchor: "center" })
    .setLngLat(coords)
    .addTo(map);

  marker.getElement().style.zIndex = String(CLUSTER_MARKER_Z);
  entry.marker = marker;

  if (transitions) {
    transitions.registerCluster({ clusterId: key, container, stage });
    container.style.setProperty("--presence-opacity", "0");
    stage.style.transform = `translateZ(0) scale(${CLUSTER_SCALE_HIDDEN})`;
    transitions.setClusterZoomOpacity(key, initialZoomOpacity);
  } else {
    container.style.setProperty("--presence-opacity", String(initialZoomOpacity));
    stage.style.transform = "translateZ(0) scale(1)";
  }

  return entry;
}

function updateClusterVisualExpand(entry: MountedPlayerCluster, zoom: number) {
  const visualExpandT = getClusterVisualExpandT(zoom);
  if (entry.lastVisualExpandT === visualExpandT) return;
  entry.lastVisualExpandT = visualExpandT;
  entry.props = { ...entry.props, visualExpandT };
  renderClusterContent(entry);
}

export function updatePlayerClusterMarker(
  entry: MountedPlayerCluster,
  props: PlayerClusterMarkerProps,
  coords?: [number, number],
  zoom?: number,
) {
  const changed =
    entry.props.count !== props.count ||
    (entry.props.previewAvatars?.join("|") ?? "") !==
      (props.previewAvatars?.join("|") ?? "");

  entry.props = {
    ...props,
    visualExpandT:
      zoom != null ? getClusterVisualExpandT(zoom) : entry.props.visualExpandT,
  };

  if (changed || zoom != null) {
    renderClusterContent(entry);
  }

  if (coords) entry.marker.setLngLat(coords);
  if (zoom != null) entry.lastVisualExpandT = getClusterVisualExpandT(zoom);
}

export function updatePlayerClusterMarkersZoom(
  entries: Record<string, MountedPlayerCluster>,
  zoom: number,
) {
  for (const entry of Object.values(entries)) {
    updateClusterVisualExpand(entry, zoom);
  }
}

/** Brief scale-out before map zoom — tap expand only. */
export function animatePlayerClusterExpand(
  entry: MountedPlayerCluster,
  onDone: () => void,
) {
  entry.stage.classList.add("sg-player-cluster-mount__stage--tap-expand");

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    entry.stage.classList.remove("sg-player-cluster-mount__stage--tap-expand");
    onDone();
  };

  const onEnd = (e: AnimationEvent) => {
    if (e.animationName === "sg-player-cluster-tap-expand") finish();
  };
  entry.stage.addEventListener("animationend", onEnd, { once: true });
  window.setTimeout(finish, CLUSTER_EXPAND_MS + 40);
}

function finalizeClusterUnmount(entry: MountedPlayerCluster) {
  if (entry.finalized) return;
  entry.finalized = true;
  entry.root.unmount();
  entry.marker.remove();
}

/** After transition controller reports hidden — no CSS exit snap. */
export function unmountPlayerClusterMarker(entry: MountedPlayerCluster) {
  if (entry.isUnmounting) return;
  entry.isUnmounting = true;
  entry.container.style.pointerEvents = "none";
  window.setTimeout(() => finalizeClusterUnmount(entry), CLUSTER_TRANSITION_MS + 20);
}

export function unmountAllPlayerClusterMarkers(
  entries: Record<string, MountedPlayerCluster>,
) {
  for (const entry of Object.values(entries)) {
    unmountPlayerClusterMarker(entry);
  }
}
