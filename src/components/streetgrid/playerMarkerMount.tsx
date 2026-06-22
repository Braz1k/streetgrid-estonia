import { createRoot, type Root } from "react-dom/client";
import mapboxgl from "mapbox-gl";
import {
  PlayerMarker,
  getPlayerMarkerZoom,
  type PlayerMarkerProps,
} from "./PlayerMarker";
import {
  getVehicleIconOpacity,
  showsPlayerLevel,
  type PresenceOpacities,
} from "@/lib/streetgrid/avatarVehicleTransition";

export type MountedPlayerMarker = {
  marker: mapboxgl.Marker;
  container: HTMLDivElement;
  root: Root;
  props: PlayerMarkerProps;
  userId?: string;
  /** Skip enter animation after first paint. */
  painted: boolean;
  lastShowLevel?: boolean;
  lastZoomBand?: ReturnType<typeof getPlayerMarkerZoom>;
};

function renderMarkerContent(entry: MountedPlayerMarker, zoom: number) {
  const zoomBand = getPlayerMarkerZoom(zoom);
  const showLevel = showsPlayerLevel(zoom);

  const needsRender =
    !entry.painted ||
    entry.lastShowLevel !== showLevel ||
    entry.lastZoomBand !== zoomBand;

  if (needsRender) {
    entry.root.render(
      <PlayerMarker
        {...entry.props}
        zoomBand={zoomBand}
        showLevel={showLevel}
        vehicleIconOpacity={getVehicleIconOpacity(zoom)}
      />,
    );
    entry.painted = true;
    entry.lastShowLevel = showLevel;
    entry.lastZoomBand = zoomBand;
  }
}

/** Opacity on every zoom tick; re-render only when level badge band changes. */
export function refreshPlayerMarkersOnZoom(
  entries: MountedPlayerMarker[],
  zoom: number,
  opacities: PresenceOpacities,
) {
  for (const entry of entries) {
    renderMarkerContent(entry, zoom);
    applyMarkerOpacity(entry, opacities.avatar);
  }
}

function applyMarkerOpacity(entry: MountedPlayerMarker, avatarOpacity: number) {
  entry.container.style.opacity = String(avatarOpacity);
  const interactive = avatarOpacity > 0.04 && entry.container.classList.contains("sg-player-marker-mount--tappable");
  entry.container.style.pointerEvents = interactive ? "auto" : "none";
}

function renderMarker(entry: MountedPlayerMarker, zoom: number, opacities: PresenceOpacities) {
  renderMarkerContent(entry, zoom);
  applyMarkerOpacity(entry, opacities.avatar);
}

export function updatePlayerMarkerProps(
  entry: MountedPlayerMarker,
  props: PlayerMarkerProps,
  zoom: number,
  opacities: PresenceOpacities,
) {
  entry.props = props;
  entry.painted = false;
  renderMarker(entry, zoom, opacities);
}

export type MountPlayerMarkerOptions = {
  onTap?: () => void;
  popup?: mapboxgl.Popup;
  userId?: string;
};

export function mountPlayerMarker(
  map: mapboxgl.Map,
  coords: [number, number],
  props: PlayerMarkerProps,
  options?: mapboxgl.Popup | MountPlayerMarkerOptions,
  opacities?: PresenceOpacities,
): MountedPlayerMarker {
  const opts: MountPlayerMarkerOptions =
    options instanceof mapboxgl.Popup ? { popup: options } : (options ?? {});

  const container = document.createElement("div");
  container.className = "sg-player-marker-mount";
  if (opts.onTap) container.classList.add("sg-player-marker-mount--tappable");
  const root = createRoot(container);
  const entry: MountedPlayerMarker = {
    marker: null!,
    container,
    root,
    props,
    userId: opts.userId,
    painted: false,
  };

  const zoom = map.getZoom();
  const op = opacities ?? { cluster: 0, avatar: 1, vehicle: 0 };
  renderMarker(entry, zoom, op);

  if (opts.onTap) {
    container.addEventListener("click", (e) => {
      e.stopPropagation();
      opts.onTap!();
    });
  }

  requestAnimationFrame(() => {
    container.classList.add("sg-player-marker-mount--ready");
  });

  const marker = new mapboxgl.Marker({ element: container, anchor: "bottom" })
    .setLngLat(coords);
  if (opts.popup) marker.setPopup(opts.popup);
  marker.addTo(map);
  entry.marker = marker;

  return entry;
}

export function updatePlayerMarkersZoom(
  entries: MountedPlayerMarker[],
  zoom: number,
  opacities: PresenceOpacities,
) {
  for (const entry of entries) renderMarker(entry, zoom, opacities);
}

export function applyPlayerMarkersOpacity(
  entries: MountedPlayerMarker[],
  opacities: PresenceOpacities,
) {
  for (const entry of entries) applyMarkerOpacity(entry, opacities.avatar);
}

export function unmountPlayerMarker(entry: MountedPlayerMarker) {
  entry.root.unmount();
  entry.marker.remove();
}

export function unmountAllPlayerMarkers(entries: MountedPlayerMarker[]) {
  for (const entry of entries) unmountPlayerMarker(entry);
}
