import type { Map as MapboxMap } from "mapbox-gl";

/**
 * Night STREETGRID palette overlays on Mapbox dark-v11.
 * Paint only. Does not add/remove/reorder layers.
 */
const LAND = "hsl(222, 18%, 10%)";
const PARK = "hsl(148, 34%, 13%)";
const AGRICULTURE = "hsl(95, 22%, 12%)";
const SAND = "hsl(36, 18%, 14%)";
const WATER = "hsl(208, 52%, 13%)";
const WATERWAY = "hsl(208, 44%, 17%)";
const BUILDING_2D = "hsl(226, 18%, 11%)";
const ROAD = "hsl(220, 10%, 32%)";
const ROAD_PATH = "hsl(220, 8%, 26%)";
const WATER_LABEL = "hsl(205, 28%, 62%)";

function setPaint(map: MapboxMap, layerId: string, property: string, value: unknown) {
  if (!map.getLayer(layerId)) return;
  try {
    map.setPaintProperty(layerId, property, value as never);
  } catch {
    // Layer exists but does not accept this paint property.
  }
}

export function applyStreetgridMapPaint(map: MapboxMap) {
  setPaint(map, "land", "background-color", LAND);

  setPaint(map, "national-park", "fill-color", PARK);
  setPaint(map, "landuse", "fill-color", [
    "match",
    ["get", "class"],
    ["wood", "grass", "scrub", "park", "pitch"],
    PARK,
    "agriculture",
    AGRICULTURE,
    "sand",
    SAND,
    "glacier",
    WATERWAY,
    LAND,
  ]);

  setPaint(map, "water", "fill-color", WATER);
  setPaint(map, "waterway", "line-color", WATERWAY);

  setPaint(map, "building", "fill-color", BUILDING_2D);
  setPaint(map, "land-structure-polygon", "fill-color", LAND);
  setPaint(map, "land-structure-line", "line-color", LAND);

  setPaint(map, "road-simple", "line-color", ROAD);
  setPaint(map, "bridge-simple", "line-color", ROAD);
  setPaint(map, "tunnel-simple", "line-color", ROAD);

  setPaint(map, "road-path", "line-color", ROAD_PATH);
  setPaint(map, "road-pedestrian", "line-color", ROAD_PATH);
  setPaint(map, "bridge-path", "line-color", ROAD_PATH);
  setPaint(map, "bridge-pedestrian", "line-color", ROAD_PATH);

  setPaint(map, "water-line-label", "text-color", WATER_LABEL);
  setPaint(map, "water-point-label", "text-color", WATER_LABEL);
  setPaint(map, "waterway-label", "text-color", WATER_LABEL);
}
