import { createRoot, type Root } from "react-dom/client";
import mapboxgl from "mapbox-gl";
import {
  PlayerMarker,
  getPlayerMarkerZoom,
  type PlayerMarkerProps,
} from "./PlayerMarker";
import {
  getAvatarMarkerOpacity,
  getVehicleIconOpacity,
} from "@/lib/streetgrid/avatarVehicleTransition";

export type MountedPlayerMarker = {
  marker: mapboxgl.Marker;
  container: HTMLDivElement;
  root: Root;
  props: PlayerMarkerProps;
};

function renderMarker(entry: MountedPlayerMarker, zoom: number) {
  const opacity = getAvatarMarkerOpacity(zoom);
  const zoomBand = getPlayerMarkerZoom(zoom);
  entry.root.render(
    <PlayerMarker
      {...entry.props}
      zoomBand={zoomBand}
      vehicleIconOpacity={getVehicleIconOpacity(zoom)}
    />,
  );
  entry.container.style.opacity = String(opacity);
  entry.container.style.visibility = opacity <= 0 ? "hidden" : "visible";
  entry.container.style.pointerEvents = opacity <= 0.02 ? "none" : "auto";
}

export function updatePlayerMarkerProps(
  entry: MountedPlayerMarker,
  props: PlayerMarkerProps,
  zoom: number,
) {
  entry.props = props;
  renderMarker(entry, zoom);
}

export function mountPlayerMarker(
  map: mapboxgl.Map,
  coords: [number, number],
  props: PlayerMarkerProps,
  popup?: mapboxgl.Popup,
): MountedPlayerMarker {
  const container = document.createElement("div");
  container.className = "sg-player-marker-mount";
  const root = createRoot(container);
  const entry: MountedPlayerMarker = { marker: null!, container, root, props };

  renderMarker(entry, map.getZoom());

  const marker = new mapboxgl.Marker({ element: container, anchor: "center" })
    .setLngLat(coords);
  if (popup) marker.setPopup(popup);
  marker.addTo(map);
  entry.marker = marker;

  return entry;
}

export function updatePlayerMarkersZoom(entries: MountedPlayerMarker[], zoom: number) {
  for (const entry of entries) renderMarker(entry, zoom);
}

export function unmountPlayerMarker(entry: MountedPlayerMarker) {
  entry.root.unmount();
  entry.marker.remove();
}

export function unmountAllPlayerMarkers(entries: MountedPlayerMarker[]) {
  for (const entry of entries) unmountPlayerMarker(entry);
}
