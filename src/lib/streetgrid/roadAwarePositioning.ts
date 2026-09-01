/** App coordinates are stored as [latitude, longitude]. */
export type AppCoordinate = [number, number];
export type DemoCityId = "tallinn" | "tartu" | "parnu" | "narva";

export type DemoPositionAssignment = {
  id: string;
  city: DemoCityId;
};

export type GeolocationPermissionState = PermissionState | "unsupported" | "unavailable";

export type RawBrowserPosition = {
  coordinate: AppCoordinate;
  accuracyMeters: number;
  timestamp: number;
  heading: number;
  source: "browser-geolocation";
};

export type UserDisplayPosition = {
  coordinate: AppCoordinate;
  rawCoordinate: AppCoordinate;
  accuracyMeters: number;
  timestamp: number;
  heading: number;
  source: "raw-browser" | "road-matched";
  snapDistanceMeters?: number;
};

type OsrmNearestResponse = {
  code?: string;
  waypoints?: Array<{
    location?: [number, number];
    distance?: number;
    name?: string;
  }>;
};

type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{
    geometry?: {
      type?: "LineString";
      coordinates?: Array<[number, number]>;
    };
  }>;
};

const OSRM_BASE_URL = "https://router.project-osrm.org";
const MAX_DISPLAY_SNAP_METERS = 80;

export async function getGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  if (!navigator.permissions?.query) return "unsupported";
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    return "unavailable";
  }
}

export function logGeolocationDiagnostic(event: string, details: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info(`[StreetGrid geolocation] ${event}`, details);
}

/**
 * Presentation-only nearest-road lookup using the same public OSRM service
 * already used for driving routes. The raw browser coordinate is retained.
 */
export async function matchBrowserPositionToRoad(
  raw: RawBrowserPosition,
  signal?: AbortSignal,
): Promise<UserDisplayPosition> {
  const [lat, lng] = raw.coordinate;
  const rawDisplay: UserDisplayPosition = {
    coordinate: raw.coordinate,
    rawCoordinate: raw.coordinate,
    accuracyMeters: raw.accuracyMeters,
    timestamp: raw.timestamp,
    heading: raw.heading,
    source: "raw-browser",
  };

  try {
    const response = await fetch(`${OSRM_BASE_URL}/nearest/v1/driving/${lng},${lat}?number=1`, {
      signal,
    });
    if (!response.ok) throw new Error(`OSRM nearest returned ${response.status}`);

    const body = (await response.json()) as OsrmNearestResponse;
    const match = body.code === "Ok" ? body.waypoints?.[0] : undefined;
    const location = match?.location;
    const distance = match?.distance;

    if (
      !location ||
      distance == null ||
      !Number.isFinite(distance) ||
      distance > MAX_DISPLAY_SNAP_METERS
    ) {
      logGeolocationDiagnostic("road match rejected", {
        source: "raw-browser",
        rawLatitude: lat,
        rawLongitude: lng,
        snapDistanceMeters: distance ?? null,
        maximumSnapMeters: MAX_DISPLAY_SNAP_METERS,
      });
      return rawDisplay;
    }

    return {
      ...rawDisplay,
      coordinate: [location[1], location[0]],
      source: "road-matched",
      snapDistanceMeters: distance,
    };
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      logGeolocationDiagnostic("road match unavailable", {
        source: "raw-browser",
        rawLatitude: lat,
        rawLongitude: lng,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return rawDisplay;
  }
}

/*
 * These are population-hub search anchors, not road coordinates. OSRM turns
 * each corridor into a drivable road geometry before any demo marker is shown.
 */
const DRIVING_CORRIDORS_BY_CITY: Record<DemoCityId, AppCoordinate[][]> = {
  tallinn: [
    [
      [59.4308, 24.6401],
      [59.437, 24.7536],
      [59.4401, 24.8805],
    ],
    [
      [59.3847, 24.6855],
      [59.4235, 24.721],
      [59.4695, 24.8305],
    ],
    [
      [59.405, 24.657],
      [59.4215, 24.793],
      [59.432, 24.902],
    ],
  ],
  tartu: [
    [
      [58.374, 26.665],
      [58.378, 26.729],
      [58.385, 26.79],
    ],
    [
      [58.337, 26.723],
      [58.378, 26.729],
      [58.42, 26.715],
    ],
  ],
  parnu: [
    [
      [58.381, 24.445],
      [58.3859, 24.5004],
      [58.393, 24.56],
    ],
    [
      [58.351, 24.508],
      [58.3859, 24.5004],
      [58.423, 24.493],
    ],
  ],
  narva: [
    [
      [59.369, 28.105],
      [59.38, 28.145],
      [59.39, 28.165],
    ],
    [
      [59.35, 28.12],
      [59.37, 28.14],
      [59.395, 28.13],
    ],
  ],
};

const DEMO_CITY_SLOTS: DemoCityId[] = [
  "tallinn",
  "tallinn",
  "tallinn",
  "tallinn",
  "tallinn",
  "tallinn",
  "tallinn",
  "tallinn",
  "tallinn",
  "tartu",
  "tartu",
  "tartu",
  "tartu",
  "tartu",
  "parnu",
  "parnu",
  "parnu",
  "narva",
  "narva",
  "narva",
];

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function fetchDrivingCorridor(
  anchors: AppCoordinate[],
  signal?: AbortSignal,
): Promise<AppCoordinate[]> {
  const coordinates = anchors.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const response = await fetch(
    `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
    { signal },
  );
  if (!response.ok) throw new Error(`OSRM route returned ${response.status}`);

  const body = (await response.json()) as OsrmRouteResponse;
  const route = body.code === "Ok" ? body.routes?.[0]?.geometry?.coordinates : undefined;
  if (!route?.length) throw new Error("OSRM returned no driving geometry");
  return route.map(([lng, lat]) => [lat, lng]);
}

function pointAtFraction(points: AppCoordinate[], fraction: number): AppCoordinate {
  const distances = points.slice(1).map((point, index) => {
    const [lat1, lng1] = points[index];
    const [lat2, lng2] = point;
    const meanLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
    const northMeters = (lat2 - lat1) * 111_320;
    const eastMeters = (lng2 - lng1) * 111_320 * Math.cos(meanLat);
    return Math.hypot(northMeters, eastMeters);
  });
  const total = distances.reduce((sum, distance) => sum + distance, 0);
  const target = total * fraction;
  let travelled = 0;

  for (let index = 0; index < distances.length; index += 1) {
    const segment = distances[index];
    if (travelled + segment >= target) {
      const progress = segment === 0 ? 0 : (target - travelled) / segment;
      const [lat1, lng1] = points[index];
      const [lat2, lng2] = points[index + 1];
      return [lat1 + (lat2 - lat1) * progress, lng1 + (lng2 - lng1) * progress];
    }
    travelled += segment;
  }

  return points[points.length - 1];
}

/**
 * Builds deterministic demo locations directly from drivable route geometry.
 * Fractions are intentionally grouped to form several natural concentrations.
 */
export async function buildTallinnRoadAwareDemoPositions(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<Record<string, AppCoordinate>> {
  return buildRoadAwareDemoPositions(
    ids.map((id) => ({ id, city: "tallinn" })),
    signal,
  );
}

export function assignDemoPlayersToCities(ids: readonly string[]): DemoPositionAssignment[] {
  return [...ids]
    .sort((a, b) => stableHash(a) - stableHash(b))
    .map((id, index) => ({
      id,
      city: DEMO_CITY_SLOTS[index % DEMO_CITY_SLOTS.length],
    }));
}

export async function buildRoadAwareDemoPositions(
  assignments: readonly DemoPositionAssignment[],
  signal?: AbortSignal,
): Promise<Record<string, AppCoordinate>> {
  const concentrationCenters = [0.18, 0.48, 0.78];
  const activeCities = [...new Set(assignments.map(({ city }) => city))];
  const corridorsByCity = Object.fromEntries(
    await Promise.all(
      activeCities.map(async (city) => [
        city,
        await Promise.all(
          DRIVING_CORRIDORS_BY_CITY[city].map((anchors) => fetchDrivingCorridor(anchors, signal)),
        ),
      ]),
    ),
  ) as Record<DemoCityId, AppCoordinate[][]>;

  return Object.fromEntries(
    assignments.map(({ id, city }) => {
      const hash = stableHash(id);
      const corridors = corridorsByCity[city];
      const corridorIndex = hash % corridors.length;
      const center = concentrationCenters[(hash >>> 5) % concentrationCenters.length];
      const jitter = (((hash >>> 11) % 1000) / 1000 - 0.5) * 0.12;
      const fraction = Math.min(0.94, Math.max(0.06, center + jitter));
      return [id, pointAtFraction(corridors[corridorIndex], fraction)];
    }),
  );
}
