import { createRoot, type Root } from "react-dom/client";
import mapboxgl from "mapbox-gl";
import { PlayerMarker } from "./playerMarker/PlayerMarker";
import type { PlayerMarkerProps } from "./playerMarkerUtils";
import {
  getSharedPlayerMarkerAppearanceController,
  resetSharedPlayerMarkerAppearanceController,
  syncPlayerMarkerViewport,
  PLAYER_TRANSITION_MS,
} from "@/lib/streetgrid/playerTransitionEngine";
import { PLAYER_MARKER_Z, SELF_MARKER_Z } from "@/lib/streetgrid/playerCluster";
import {
  getPlayerMarkerRepresentation,
  type PlayerMarkerRepresentationState,
} from "@/lib/streetgrid/playerMarkerRepresentation";
import { MAP_MARKER_LAYER, tagMapMarkerLayer } from "@/lib/streetgrid/mapMarkerLayers";

let markerOpacityCounter = 0;

export type MountedPlayerMarker = {
  marker: mapboxgl.Marker;
  container: HTMLDivElement;
  stage: HTMLDivElement;
  visual: HTMLDivElement;
  root: Root;
  props: PlayerMarkerProps;
  userId?: string;
  painted: boolean;
  lastShowLevel?: boolean;
  lastAvatarT?: number;
  lastRepresentation?: PlayerMarkerRepresentationState;
  appearanceId: string;
  isUnmounting: boolean;
  finalized?: boolean;
};

function appearanceTargetId(entry: { userId?: string; appearanceId: string }): string {
  return entry.userId ? `player:${entry.userId}` : entry.appearanceId;
}

export function applyPlayerMarkerZIndex(marker: mapboxgl.Marker, isSelf = false) {
  marker.getElement().style.zIndex = String(isSelf ? SELF_MARKER_Z : PLAYER_MARKER_Z);
}

function registerAppearance(entry: MountedPlayerMarker) {
  getSharedPlayerMarkerAppearanceController().register({
    id: appearanceTargetId(entry),
    container: entry.container,
    visual: entry.visual,
    isSelf: entry.props.isCurrentUser === true,
  });
}

function unregisterAppearance(entry: MountedPlayerMarker) {
  getSharedPlayerMarkerAppearanceController().unregister(appearanceTargetId(entry));
}

function renderMarkerContent(entry: MountedPlayerMarker) {
  if (entry.painted) return;
  entry.root.render(
    <PlayerMarker {...entry.props} showLevel={entry.props.isCurrentUser !== true} />,
  );
  entry.painted = true;
}

function applyMarkerRepresentation(entry: MountedPlayerMarker, zoom: number) {
  const isSelf = entry.props.isCurrentUser === true;
  const { state, avatarT, scale, showLevel } = getPlayerMarkerRepresentation(zoom, isSelf);

  if (entry.lastRepresentation !== state) {
    entry.container.dataset.representation = state;
    entry.lastRepresentation = state;
  }

  if (entry.lastShowLevel !== showLevel) {
    entry.container.dataset.showLevel = showLevel ? "1" : "0";
    entry.lastShowLevel = showLevel;
  }

  entry.stage.style.setProperty("--sg-marker-zoom-scale", scale.toFixed(4));

  if (isSelf) {
    if (entry.lastAvatarT !== 1) {
      entry.lastAvatarT = 1;
      entry.container.style.setProperty("--sg-player-avatar-t", "1");
    }
    return;
  }

  const nextAvatarT = Number(avatarT.toFixed(4));
  if (entry.lastAvatarT === nextAvatarT) return;
  entry.lastAvatarT = nextAvatarT;
  entry.container.style.setProperty("--sg-player-avatar-t", String(nextAvatarT));
}

/** Viewport + representation update — no opacity coupling to CarLayer fade. */
export function applyPlayerPresenceOpacity(entries: MountedPlayerMarker[], zoom: number) {
  const appearance = getSharedPlayerMarkerAppearanceController();

  for (const entry of entries) {
    applyMarkerRepresentation(entry, zoom);
    appearance.setZoomOpacity(appearanceTargetId(entry), 1);
  }
}

function primeMarkerAppearance(entry: MountedPlayerMarker) {
  renderMarkerContent(entry);
  const id = appearanceTargetId(entry);
  const engine = getSharedPlayerMarkerAppearanceController();
  engine.setZoomFactor(id, 1);
  if (entry.props.isCurrentUser) {
    engine.enterViewport(id);
  }
}

export function syncMountedPlayerMarkerViewport(map: mapboxgl.Map, entries: MountedPlayerMarker[]) {
  syncPlayerMarkerViewport(
    getSharedPlayerMarkerAppearanceController(),
    map,
    entries,
    appearanceTargetId,
  );
}

export function updatePlayerMarkerProps(
  entry: MountedPlayerMarker,
  props: PlayerMarkerProps,
  zoom: number,
) {
  const propsChanged =
    entry.props.avatar !== props.avatar ||
    entry.props.nickname !== props.nickname ||
    entry.props.level !== props.level ||
    entry.props.rarity !== props.rarity ||
    entry.props.vehicleColor !== props.vehicleColor ||
    entry.props.isOnline !== props.isOnline ||
    entry.props.isCurrentUser !== props.isCurrentUser;

  entry.props = props;
  if (propsChanged) {
    entry.painted = false;
    renderMarkerContent(entry);
  }
  applyMarkerRepresentation(entry, zoom);
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
): MountedPlayerMarker {
  const opts: MountPlayerMarkerOptions =
    options instanceof mapboxgl.Popup ? { popup: options } : (options ?? {});

  const container = document.createElement("div");
  container.className = "sg-player-marker-mount";
  tagMapMarkerLayer(container, MAP_MARKER_LAYER.player);
  container.dataset.showLevel = "0";
  if (opts.onTap) container.classList.add("sg-player-marker-mount--tappable");
  if (props.isCurrentUser) container.classList.add("sg-player-marker-mount--self");

  const stage = document.createElement("div");
  stage.className = "sg-player-marker-mount__stage";

  const visual = document.createElement("div");
  visual.className = "sg-player-marker-mount__visual";
  stage.appendChild(visual);
  container.appendChild(stage);

  const root = createRoot(visual);
  const appearanceId = `player:anon:${++markerOpacityCounter}`;
  const entry: MountedPlayerMarker = {
    marker: null!,
    container,
    stage,
    visual,
    root,
    props,
    userId: opts.userId,
    painted: false,
    appearanceId,
    isUnmounting: false,
  };

  registerAppearance(entry);

  const zoom = map.getZoom();
  primeMarkerAppearance(entry);
  applyMarkerRepresentation(entry, zoom);

  if (opts.onTap) {
    container.addEventListener("click", (e) => {
      e.stopPropagation();
      opts.onTap!();
    });
  }

  const marker = new mapboxgl.Marker({ element: container, anchor: "bottom" }).setLngLat(coords);
  if (opts.popup) marker.setPopup(opts.popup);
  marker.addTo(map);
  applyPlayerMarkerZIndex(marker, props.isCurrentUser === true);
  entry.marker = marker;

  return entry;
}

export function updatePlayerMarkersZoom(entries: MountedPlayerMarker[], zoom: number) {
  for (const entry of entries) {
    applyMarkerRepresentation(entry, zoom);
  }
}

export function applyPlayerMarkersOpacity(entries: MountedPlayerMarker[]) {
  const appearance = getSharedPlayerMarkerAppearanceController();
  for (const entry of entries) {
    appearance.setZoomOpacity(appearanceTargetId(entry), 1);
  }
}

function finalizeUnmount(entry: MountedPlayerMarker) {
  if (entry.finalized) return;
  entry.finalized = true;
  unregisterAppearance(entry);
  entry.root.unmount();
  entry.marker.remove();
}

export function unmountPlayerMarker(entry: MountedPlayerMarker) {
  if (entry.isUnmounting) return;
  entry.isUnmounting = true;
  entry.container.style.pointerEvents = "none";
  entry.container.classList.remove("sg-player-marker-mount--self-visible");

  const id = appearanceTargetId(entry);
  getSharedPlayerMarkerAppearanceController().exit(id, () => {
    finalizeUnmount(entry);
  });
  window.setTimeout(() => finalizeUnmount(entry), PLAYER_TRANSITION_MS + 40);
}

export function unmountAllPlayerMarkers(entries: MountedPlayerMarker[]) {
  for (const entry of entries) unmountPlayerMarker(entry);
}

export { getPlayerMarkerRepresentation };
export { getPlayerMarkerZoomScale } from "@/lib/streetgrid/playerMarkerRepresentation";
export { resetSharedPlayerMarkerAppearanceController };
