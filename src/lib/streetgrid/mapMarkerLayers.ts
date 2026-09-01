/** Semantic overlay layers for Mapbox HTML markers. */
export const MAP_MARKER_LAYER = {
  poi: "poi",
  player: "player",
} as const;

export type MapMarkerLayer = (typeof MAP_MARKER_LAYER)[keyof typeof MAP_MARKER_LAYER];

/**
 * Tags an HTML marker without introducing another DOM wrapper.
 * Future POI categories can share the POI layer while players remain separate.
 */
export function tagMapMarkerLayer<T extends HTMLElement>(element: T, layer: MapMarkerLayer): T {
  element.dataset.markerLayer = layer;
  return element;
}
