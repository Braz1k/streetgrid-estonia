import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  USERS, SPOTS, MEETS, ME, getCity,
  type SosSignal, type Spot, type SpotType, type CityId,
} from "@/lib/streetgrid/data";
import { useStreetGrid } from "@/lib/streetgrid/store";
import {
  Layers, Crosshair, Siren, Plus, Clock,
  Route as RouteIcon, Search, ChevronUp, X,
} from "lucide-react";
import { SosModal, type SosPayload } from "./SosModal";
import { AddSpotModal } from "./AddSpotModal";

mapboxgl.accessToken =
  "pk.eyJ1IjoiMTEtMTEiLCJhIjoiY21xZTRrejF6MTdqNjJxcXpob2Fqc2c4OSJ9.JZTGEp-_QhQASnJTniUohQ";

// app stores [lat, lng]; Mapbox expects [lng, lat]
const toLngLat = ([lat, lng]: [number, number]): [number, number] => [lng, lat];

const ROUTE_GLOW = "#00f0ff";
const ROUTE_LINE = "#00ffff";

// ─── Waze camera constants ────────────────────────────────────────────────────
//
// PADDING MATH (Mapbox): center_y = top + (H − top − bottom) / 2
//   top:350, H=800 → 350 + (800-350)/2 = 575px from top ≈ 72 % ✓  (car in bottom third)
//   bottom:280 →  (800-280)/2 = 260px from top ≈ 32 % ✗  (car in top third)
// → top:350 is the only way to get the car at the bottom third.
//
const WAZE_ZOOM    = 15;
const WAZE_PITCH   = 65;   // strong 3D tilt; matched by CSS rotateX on the car marker
const WAZE_PADDING = { top: 350, bottom: 0, left: 0, right: 0 } as const;

// ─── Garage cars ──────────────────────────────────────────────────────────────

type GarageCar = {
  id: string;
  emoji: string;
  name: string;
  shortName: string;
  description: string;
  color: string;
};

const GARAGE_CARS: GarageCar[] = [
  { id: "bmw_m3",      emoji: "🚗",  name: "BMW M3 E92",      shortName: "BMW M3",  description: "480 л.с. · Stage 2 Tune · KW V3",           color: "#0af"    },
  { id: "tesla_neon",  emoji: "⚡",   name: "Tesla Neon X",    shortName: "Tesla",   description: "Электрогонщик · Silent Mode · 0–100 в 2.4 с", color: "#00ff88" },
  { id: "retro_racer", emoji: "🏎️",  name: "Retro Racer '69", shortName: "Ретро",   description: "Muscle Car · 1969 · V8 Big Block",             color: "#ffcc00" },
  { id: "hippie_van",  emoji: "🚐",   name: "Hippie Van",      shortName: "Хиппи",   description: "Peace & Love · Slow & Groovy",                 color: "#ff6600" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  city: CityId;
  onOpenGarage: (userId: string) => void;
  focusSpot?: { id: string; ts: number } | null;
  routeRequest?: { coords: [number, number]; name: string; ts: number } | null;
};

type Bot = {
  id: string; name: string; car: string; emoji: string;
  coords: [number, number]; patrol?: boolean;
};

type ActiveRoute = {
  name: string; distanceKm: number; durationMin: number;
};

const SPOT_VISUAL: Record<SpotType, { emoji: string }> = {
  photo: { emoji: "📸" }, wash: { emoji: "💦" }, friendly: { emoji: "☕" },
  parking: { emoji: "🅿️" }, landmark: { emoji: "📍" },
};

type MarkerRole = "user_regular" | "user_friend" | "club" | "party" | "legend" | "sos";

const MARKER_THEMES: Record<MarkerRole, { border: string; glow: string; pulse: boolean }> = {
  user_regular: { border: "#00ff66", glow: "0 0 12px rgba(0,255,102,0.65),0 0 32px rgba(0,255,102,0.3)",   pulse: false },
  user_friend:  { border: "#0066ff", glow: "0 0 12px rgba(0,102,255,0.65),0 0 32px rgba(0,102,255,0.3)",   pulse: false },
  club:         { border: "#cc00ff", glow: "0 0 12px rgba(204,0,255,0.65),0 0 32px rgba(204,0,255,0.3)",   pulse: true  },
  party:        { border: "#ff6600", glow: "0 0 12px rgba(255,102,0,0.65),0 0 32px rgba(255,102,0,0.3)",   pulse: true  },
  legend:       { border: "#ffcc00", glow: "0 0 12px rgba(255,204,0,0.65),0 0 32px rgba(255,204,0,0.3)",   pulse: false },
  sos:          { border: "#ff0033", glow: "0 0 14px rgba(255,0,51,0.75),0 0 36px rgba(255,0,51,0.4)",     pulse: true  },
};

const SPOT_ROLE: Record<SpotType, MarkerRole> = {
  photo: "club", friendly: "user_friend", wash: "club",
  parking: "user_regular", landmark: "legend",
};

function userRole(id: string): MarkerRole {
  return id === "u2" ? "user_friend" : "user_regular";
}

const routeBtnHtml = (id: string) =>
  `<button data-route="${id}" style="margin-top:6px;background:#00f0ff;color:#001;padding:5px 10px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px">🧭 ПОЕХАЛИ</button>`;

// ─── Marker helpers ───────────────────────────────────────────────────────────

/**
 * Waze-style CSS 3D car marker.
 *
 * The `perspective` parent gives depth context.
 * The inner `.waze-car-plate` applies `rotateX(65deg)` so the flat icon lies
 * flush on the pitched map surface (pitch 65° ≡ rotateX 65°).
 * The map's own `bearing` rotates the scene so the car always faces forward —
 * no need for a separate rotateZ here.
 */
function makeWazeCarEl(emoji: string, color: string): HTMLDivElement {
  const outer = document.createElement("div");
  outer.style.cssText = [
    "perspective:300px;",
    "width:72px;height:72px;",
    "display:flex;align-items:flex-end;justify-content:center;",
    "padding-bottom:6px;",
  ].join("");

  const plate = document.createElement("div");
  plate.className = "waze-car-plate";
  plate.style.cssText = [
    "width:56px;height:56px;border-radius:12px;",
    "transform:rotateX(65deg);",
    "transform-style:preserve-3d;",
    "will-change:transform;",
    "display:flex;align-items:center;justify-content:center;",
    "font-size:28px;line-height:1;",
    "background:rgba(4,8,22,0.93);",
    `border:3px solid ${color};`,
    `box-shadow:0 0 22px ${color}dd,0 0 44px ${color}66,inset 0 0 10px ${color}22;`,
    "transition:border-color 0.25s,box-shadow 0.25s;",
  ].join("");
  plate.textContent = emoji;

  outer.appendChild(plate);
  return outer;
}

function makeMarkerEl(
  html: string, role: MarkerRole, size = 36,
  extraStyle: Partial<CSSStyleDeclaration> = {},
): HTMLDivElement {
  const theme = MARKER_THEMES[role];
  const wrap  = document.createElement("div");
  wrap.className = "sg-marker-wrap";
  wrap.style.width  = `${size}px`;
  wrap.style.height = `${size}px`;

  if (theme.pulse) {
    wrap.classList.add("sg-marker-pulse");
    for (const delay of ["", " sg-marker-pulse-ring--delay"]) {
      const ring = document.createElement("span");
      ring.className = `sg-marker-pulse-ring${delay}`;
      ring.style.setProperty("--pulse-color", theme.border);
      wrap.appendChild(ring);
    }
  }

  const el = document.createElement("div");
  el.className = `sg-marker${role === "sos" ? " sg-marker--sos" : ""}`;
  el.style.width       = `${size}px`;
  el.style.height      = `${size}px`;
  el.style.fontSize    = `${Math.round(size * 0.5)}px`;
  el.style.borderColor = theme.border;
  el.style.boxShadow   = theme.glow;
  Object.assign(el.style, extraStyle);
  el.innerHTML = html;
  wrap.appendChild(el);
  return wrap;
}

function makeClusterEl(count: number): HTMLDivElement {
  const size = count < 5 ? 44 : count < 20 ? 52 : 60;
  const el   = document.createElement("div");
  el.className = "sg-cluster-marker";
  Object.assign(el.style, {
    width: `${size}px`, height: `${size}px`, borderRadius: "50%",
    background: "rgba(8,10,20,0.88)", border: "2px solid #00f0ff",
    boxShadow: "0 0 12px rgba(0,240,255,0.65),0 0 28px rgba(0,240,255,0.35),inset 0 0 8px rgba(0,240,255,0.15)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: "800", fontSize: "13px", cursor: "pointer", userSelect: "none",
  });
  el.textContent = String(count);
  return el;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapView({ city, onOpenGarage, focusSpot, routeRequest }: Props) {
  const { profile, settings, pushChat } = useStreetGrid();

  const containerRef         = useRef<HTMLDivElement>(null);
  const mapRef               = useRef<mapboxgl.Map | null>(null);
  const featureMarkersRef    = useRef<mapboxgl.Marker[]>([]);
  const spotMarkersRef       = useRef<Record<string, mapboxgl.Marker>>({});
  const botMarkersRef        = useRef<mapboxgl.Marker[]>([]);
  const sosMarkersRef        = useRef<mapboxgl.Marker[]>([]);
  const spotRenderCleanupRef = useRef<(() => void) | null>(null);
  // Live-update the car marker plate without recreating the whole marker
  const carPlateRef          = useRef<HTMLDivElement | null>(null);
  // Heading tracking — kept in refs to avoid stale closures in watchPosition
  const headingRef           = useRef<number>(0);
  const prevPosRef           = useRef<[number, number] | null>(null);
  const selectedCarIdRef     = useRef<string>(GARAGE_CARS[0].id);

  const [ready,         setReady]         = useState(false);
  const [sosOpen,       setSosOpen]       = useState(false);
  const [addOpen,       setAddOpen]       = useState(false);
  const [signals,       setSignals]       = useState<SosSignal[]>([]);
  const [userSpots,     setUserSpots]     = useState<Spot[]>([]);
  const [activeRoute,   setActiveRoute]   = useState<ActiveRoute | null>(null);
  const [layers,        setLayers]        = useState({ users: true, spots: true, meets: true });
  const [bots,          setBots]          = useState<Bot[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string>(GARAGE_CARS[0].id);
  const [carSheetOpen,  setCarSheetOpen]  = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);

  const cityObj      = getCity(city);
  const allSpots     = [...SPOTS, ...userSpots];
  const visibleSpots = city === "all" ? allSpots : allSpots.filter((s) => s.city === city);
  const visibleMeets = city === "all" ? MEETS : MEETS.filter((m) => m.city === city);
  const selectedCar  = GARAGE_CARS.find((c) => c.id === selectedCarId) ?? GARAGE_CARS[0];

  // Keep ref in sync so watchPosition callback reads the latest value
  useEffect(() => { selectedCarIdRef.current = selectedCarId; }, [selectedCarId]);

  // ── Live car plate update — no marker recreation needed ──────────────────────
  useEffect(() => {
    const plate = carPlateRef.current;
    if (!plate) return;
    plate.textContent = selectedCar.emoji;
    plate.style.borderColor = selectedCar.color;
    plate.style.boxShadow   = `0 0 22px ${selectedCar.color}dd,0 0 44px ${selectedCar.color}66,inset 0 0 10px ${selectedCar.color}22`;
  }, [selectedCarId, selectedCar.emoji, selectedCar.color]);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container:          containerRef.current,
      style:              "mapbox://styles/mapbox/dark-v11",
      center:             toLngLat(ME.location),
      zoom:               WAZE_ZOOM,
      pitch:              WAZE_PITCH,   // hard-set at init
      bearing:            0,
      antialias:          true,
      attributionControl: false,
    });

    map.on("load", () => {
      // ── Apply Waze viewport padding immediately ────────────────────────────
      // MUST be called after load; padding persists across camera moves.
      map.setPadding(WAZE_PADDING);

      // ── Re-enforce pitch/padding whenever Mapbox tries to reset them ───────
      // Some SDK versions reset pitch to 0 on certain interactions;
      // this guard ensures Waze perspective is always restored.
      map.on("pitchend", () => {
        if (map.getPitch() < WAZE_PITCH - 5) {
          map.easeTo({ pitch: WAZE_PITCH, duration: 400 });
        }
      });

      // ── 3-D buildings ──────────────────────────────────────────────────────
      try {
        const styleLayers = map.getStyle().layers ?? [];
        const labelLayer  = styleLayers.find(
          (l) => l.type === "symbol" && (l.layout as { "text-field"?: unknown })?.["text-field"],
        );
        map.addLayer(
          {
            id: "3d-buildings", source: "composite", "source-layer": "building",
            filter: ["==", "extrude", "true"], type: "fill-extrusion", minzoom: 14,
            paint: {
              "fill-extrusion-color":   "#1a1f2e",
              "fill-extrusion-height":  ["get", "height"],
              "fill-extrusion-base":    ["get", "min_height"],
              "fill-extrusion-opacity": 0.78,
            },
          },
          labelLayer?.id,
        );
      } catch { /* style not yet available */ }

      // ── Label visibility ───────────────────────────────────────────────────
      const FORCE_VISIBLE = ["road-label", "settlement-label", "settlement-subdivision-label", "water-label"];
      map.getStyle().layers?.forEach((l) => {
        if (l.id.includes("poi")) {
          map.setLayoutProperty(l.id, "visibility", "none");
        } else if (FORCE_VISIBLE.some((k) => l.id.includes(k))) {
          map.setLayoutProperty(l.id, "visibility", "visible");
        }
      });

      // ── Route source + layers ──────────────────────────────────────────────
      map.addSource("sg-route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "sg-route-glow", type: "line", source: "sg-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ROUTE_GLOW, "line-width": 14, "line-opacity": 0.35, "line-blur": 5 },
      });
      map.addLayer({
        id: "sg-route-line", type: "line", source: "sg-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ROUTE_LINE, "line-width": 5.5, "line-opacity": 1 },
      });

      // ── Spot clustering source ─────────────────────────────────────────────
      map.addSource("spots", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true, clusterMaxZoom: 14, clusterRadius: 50,
      });

      setReady(true);
    });

    map.touchPitch.enable();
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Geolocation watchPosition: updates heading + rotates map bearing ─────────
  //
  // The map BEARING is set to the user's heading so the road ahead is always
  // "up" on screen, exactly like Waze. The CSS rotateX(65deg) on the car
  // marker aligns it with the pitched map surface — no additional rotateZ
  // needed because the bearing handles orientation.
  //
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading } = pos.coords;
        let h: number | null = heading;

        // Compute bearing from position delta when device heading is unavailable
        if ((h == null || isNaN(h)) && prevPosRef.current) {
          const [pLat, pLng] = prevPosRef.current;
          const dLat = latitude - pLat;
          const dLng = longitude - pLng;
          if (Math.hypot(dLat, dLng) > 0.00005) {
            h = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
          }
        }
        prevPosRef.current = [latitude, longitude];

        if (h != null && !isNaN(h)) {
          headingRef.current = h;

          // Smoothly rotate the map to match heading — this is the Waze "bearing lock"
          mapRef.current?.easeTo({
            bearing:  h,
            pitch:    WAZE_PITCH,      // re-enforce pitch on every heading update
            duration: 600,
          });
        }
      },
      () => { /* geolocation denied — heading stays 0, pitch stays WAZE_PITCH */ },
      { enableHighAccuracy: true, maximumAge: 400 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []); // mount-only; all live values read via refs

  // ── Fly to city / Waze mode on tab switch ────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    if (city === "tallinn" || city === "all") {
      // Waze mode — car at bottom, road ahead fills top, bearing = heading
      map.setPadding(WAZE_PADDING);
      map.flyTo({
        center:   toLngLat(ME.location),
        zoom:     WAZE_ZOOM,
        pitch:    WAZE_PITCH,
        bearing:  headingRef.current,
        duration: 2000,
        essential: true,
      });
    } else {
      // City overview — flat look, no bottom-third offset
      map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      map.flyTo({
        center:   toLngLat(cityObj.coords),
        zoom:     cityObj.zoom,
        pitch:    WAZE_PITCH,
        bearing:  0,
        duration: 2000,
        essential: true,
      });
    }
  }, [city, ready, cityObj.coords, cityObj.zoom]);

  // ── Bots simulation ─────────────────────────────────────────────────────────
  useEffect(() => {
    const base = cityObj.coords;
    const r    = city === "all" ? 0.5 : 0.012;
    const init: Bot[] = [
      { id: "b1", name: "Никита",  car: "BMW M4",       emoji: "🏎️", coords: [base[0] + r,       base[1] + r] },
      { id: "b2", name: "Артур",   car: "Toyota Supra", emoji: "🚗", coords: [base[0] - r,       base[1] + r * 0.6] },
      { id: "b3", name: "Кристи",  car: "Subaru WRX",   emoji: "🚙", coords: [base[0] + r * 0.4, base[1] - r] },
    ];
    setBots(init);
    const tick = setInterval(() => {
      setBots((prev) => prev.map((b) => ({
        ...b,
        coords: [
          b.coords[0] + (Math.random() - 0.5) * r * 0.25,
          b.coords[1] + (Math.random() - 0.5) * r * 0.25,
        ] as [number, number],
      })));
    }, 2500);
    const patrolTick = setInterval(() => {
      setBots((prev) => {
        if (prev.some((b) => b.patrol)) return prev.filter((b) => !b.patrol);
        return [...prev, {
          id: "patrol", name: "Патруль", car: "Politsei", emoji: "🚓", patrol: true,
          coords: [
            base[0] + (Math.random() - 0.5) * r * 1.5,
            base[1] + (Math.random() - 0.5) * r * 1.5,
          ] as [number, number],
        }];
      });
    }, 15000);
    return () => { clearInterval(tick); clearInterval(patrolTick); };
  }, [city, cityObj.coords]);

  // ── Route drawing ────────────────────────────────────────────────────────────
  const setRouteGeoJson = useCallback((geometry: GeoJSON.LineString | null) => {
    (mapRef.current?.getSource("sg-route") as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: geometry ? [{ type: "Feature", properties: {}, geometry }] : [],
    });
  }, []);

  const fitRouteBounds = useCallback((coords: [number, number][]) => {
    if (coords.length < 2) return;
    const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
    mapRef.current?.fitBounds(bounds, {
      padding: { top: 140, bottom: 180, left: 60, right: 60 },
      pitch: WAZE_PITCH, bearing: headingRef.current, duration: 1400, essential: true,
    });
  }, []);

  const runRouteTo = useCallback(async (dest: [number, number], name: string) => {
    const [oLng, oLat] = toLngLat(ME.location);
    const [dLng, dLat] = toLngLat(dest);
    try {
      const url  = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
      const json = await fetch(url).then((r) => r.json());
      const route = json?.routes?.[0];
      if (!route) throw new Error("no route");
      setRouteGeoJson(route.geometry);
      fitRouteBounds(route.geometry.coordinates);
      setActiveRoute({ name, distanceKm: route.distance / 1000, durationMin: route.duration / 60 });
    } catch {
      const geo: GeoJSON.LineString = { type: "LineString", coordinates: [[oLng, oLat], [dLng, dLat]] };
      setRouteGeoJson(geo);
      fitRouteBounds(geo.coordinates as [number, number][]);
      const dx = (dLng - oLng) * 111 * Math.cos((oLat * Math.PI) / 180);
      const dy = (dLat - oLat) * 111;
      const km = Math.sqrt(dx * dx + dy * dy);
      setActiveRoute({ name, distanceKm: km, durationMin: km * 1.2 });
    }
  }, [fitRouteBounds, setRouteGeoJson]);

  const clearRoute   = useCallback(() => { setRouteGeoJson(null); setActiveRoute(null); }, [setRouteGeoJson]);
  const triggerRoute = useCallback((c: [number, number], n: string) => runRouteTo(c, n), [runRouteTo]);

  // ── Feature markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    featureMarkersRef.current.forEach((m) => m.remove());
    featureMarkersRef.current = [];
    carPlateRef.current = null;

    // ME — CSS 3D car marker
    if (city === "tallinn" || city === "all") {
      const el = makeWazeCarEl(selectedCar.emoji, selectedCar.color);
      // Store reference to inner plate for live colour/emoji updates
      carPlateRef.current = el.querySelector(".waze-car-plate") as HTMLDivElement | null;

      const m = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(toLngLat(ME.location))
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setHTML(
          `<b>${profile.handle}</b><br/>${selectedCar.name}`,
        ))
        .addTo(map);
      featureMarkersRef.current.push(m);
    }

    // Other users
    if (layers.users && (city === "tallinn" || city === "all")) {
      USERS.forEach((u) => {
        const popup = new mapboxgl.Popup({ offset: 22 }).setHTML(
          `<div><b>${u.handle}</b><br/>${u.car.year} ${u.car.make} ${u.car.model}<br/>` +
          `<i>${u.status === "moving" ? "В движении" : "На споте"}</i><br/>` +
          `<button data-garage="${u.id}" style="margin-top:6px;background:#FF3B30;color:#fff;border:none;padding:5px 10px;border-radius:6px;font-weight:bold;cursor:pointer">Открыть гараж</button></div>`,
        );
        popup.on("open", () => setTimeout(() => {
          document.querySelector<HTMLButtonElement>(`button[data-garage="${u.id}"]`)
            ?.addEventListener("click", () => onOpenGarage(u.id));
        }, 0));
        const m = new mapboxgl.Marker({
          element: makeMarkerEl(u.status === "moving" ? "🏎️" : "🅿️", userRole(u.id)),
        }).setLngLat(toLngLat(u.location)).setPopup(popup).addTo(map);
        featureMarkersRef.current.push(m);
      });
    }

    // Meets
    if (layers.meets) {
      visibleMeets.forEach((mt) => {
        const popup = new mapboxgl.Popup({ offset: 22 }).setHTML(
          `<b>${mt.title}</b><br/>${mt.time}<br/>📍 ${mt.location}<br/>👥 ${mt.going} едут${routeBtnHtml(`meet-${mt.id}`)}`,
        );
        popup.on("open", () => setTimeout(() => {
          document.querySelector<HTMLButtonElement>(`button[data-route="meet-${mt.id}"]`)
            ?.addEventListener("click", () => triggerRoute(mt.coords, mt.title));
        }, 0));
        const m = new mapboxgl.Marker({ element: makeMarkerEl(mt.cover, "party") })
          .setLngLat(toLngLat(mt.coords)).setPopup(popup).addTo(map);
        featureMarkersRef.current.push(m);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.users, layers.meets, ready, city, visibleMeets.length, onOpenGarage, profile.handle, profile.status, triggerRoute, selectedCarId]);

  // ── Spots: GeoJSON clustering + dynamic HTML markers ───────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    spotRenderCleanupRef.current?.();
    spotRenderCleanupRef.current = null;

    const source = map.getSource("spots") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const spotsById: Record<string, Spot> = {};
    visibleSpots.forEach((s) => { spotsById[s.id] = s; });

    source.setData({
      type: "FeatureCollection",
      features: layers.spots
        ? visibleSpots.map((s) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: toLngLat(s.coords) },
            properties: { id: s.id },
          }))
        : [],
    });

    const clearSpotMarkers = () => {
      Object.values(spotMarkersRef.current).forEach((m) => m.remove());
      spotMarkersRef.current = {};
    };

    const renderSpotMarkers = () => {
      if (!map.isStyleLoaded()) return;
      clearSpotMarkers();
      if (!layers.spots) return;

      const features = map.querySourceFeatures("spots");
      const seen = new Set<string>();

      for (const feature of features) {
        const props = feature.properties;
        if (!props) continue;
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];

        if (props.point_count != null) {
          const clusterId = props.cluster_id as number;
          const key = `cluster-${clusterId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const el = makeClusterEl(Number(props.point_count));
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom == null) return;
              map.easeTo({ center: coords, zoom: zoom + 0.5, duration: 600 });
            });
          });
          spotMarkersRef.current[key] = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(map);
          continue;
        }

        const id = String(props.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const spot = spotsById[id];
        if (!spot) continue;

        const v = SPOT_VISUAL[spot.type];
        const popup = new mapboxgl.Popup({ offset: 22 }).setHTML(
          `<b>${spot.name}</b>${spot.userAdded ? " 🆕" : ""}<br/>${spot.description}<br/>★ ${spot.rating} (${spot.reviews})${routeBtnHtml(`spot-${id}`)}`,
        );
        popup.on("open", () => setTimeout(() => {
          document.querySelector<HTMLButtonElement>(`button[data-route="spot-${id}"]`)
            ?.addEventListener("click", () => triggerRoute(spot.coords, spot.name));
        }, 0));
        spotMarkersRef.current[id] = new mapboxgl.Marker({
          element: makeMarkerEl(spot.photo || v.emoji, SPOT_ROLE[spot.type]),
        }).setLngLat(coords).setPopup(popup).addTo(map);
      }
    };

    const onSourceData = (e: mapboxgl.MapSourceDataEvent) => {
      if (e.sourceId === "spots" && e.isSourceLoaded) renderSpotMarkers();
    };
    map.on("moveend", renderSpotMarkers);
    map.on("zoomend", renderSpotMarkers);
    map.on("sourcedata", onSourceData);
    renderSpotMarkers();

    spotRenderCleanupRef.current = () => {
      map.off("moveend", renderSpotMarkers);
      map.off("zoomend", renderSpotMarkers);
      map.off("sourcedata", onSourceData);
      clearSpotMarkers();
    };
    return () => spotRenderCleanupRef.current?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.spots, ready, city, visibleSpots, triggerRoute]);

  // ── Bot markers ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    botMarkersRef.current.forEach((m) => m.remove());
    botMarkersRef.current = [];
    if (!layers.users || !settings.showBots) return;
    bots.forEach((b) => {
      if (b.patrol && !settings.showPatrols) return;
      const m = new mapboxgl.Marker({ element: makeMarkerEl(b.emoji, b.patrol ? "sos" : "user_regular", 34) })
        .setLngLat(toLngLat(b.coords))
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML(
          `<b>${b.name}</b><br/>${b.car}${b.patrol ? '<br/><i style="color:#ff3b30">⚠ Патруль рядом</i>' : ""}`,
        ))
        .addTo(map);
      botMarkersRef.current.push(m);
    });
  }, [bots, layers.users, settings.showBots, settings.showPatrols, ready]);

  // ── SOS markers ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    sosMarkersRef.current.forEach((m) => m.remove());
    sosMarkersRef.current = [];
    signals.forEach((sig) => {
      const popup = new mapboxgl.Popup({ offset: 24 }).setHTML(
        `<b style="color:#ff3b30">🆘 SOS</b><br/><b>${sig.label}</b>${sig.note ? `<br/><i>"${sig.note}"</i>` : ""}<br/>${sig.user} · ${sig.time}${routeBtnHtml(`sos-${sig.id}`)}`,
      );
      popup.on("open", () => setTimeout(() => {
        document.querySelector<HTMLButtonElement>(`button[data-route="sos-${sig.id}"]`)
          ?.addEventListener("click", () => triggerRoute(sig.coords, "SOS · " + sig.label));
      }, 0));
      sosMarkersRef.current.push(
        new mapboxgl.Marker({ element: makeMarkerEl("🆘", "sos", 44) })
          .setLngLat(toLngLat(sig.coords)).setPopup(popup).addTo(map),
      );
    });
  }, [signals, ready, triggerRoute]);

  // ── Focus spot ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!focusSpot || !ready) return;
    const target = [...SPOTS, ...userSpots].find((s) => s.id === focusSpot.id);
    if (!target) return;
    mapRef.current?.flyTo({
      center: toLngLat(target.coords), zoom: 16,
      pitch: WAZE_PITCH, bearing: headingRef.current,
      duration: 1600, essential: true,
    });
    setTimeout(() => {
      const m = spotMarkersRef.current[target.id];
      if (m && !m.getPopup()?.isOpen()) m.togglePopup();
    }, 1200);
  }, [focusSpot, ready, userSpots]);

  // ── External route request ───────────────────────────────────────────────────
  useEffect(() => {
    if (!routeRequest || !ready) return;
    runRouteTo(routeRequest.coords, routeRequest.name);
  }, [routeRequest, ready, runRouteTo]);

  // ── Recenter to Waze mode ─────────────────────────────────────────────────────
  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setPadding(WAZE_PADDING);
    map.flyTo({
      center:   toLngLat(ME.location),
      zoom:     WAZE_ZOOM,
      pitch:    WAZE_PITCH,
      bearing:  headingRef.current,
      duration: 1500,
      essential: true,
    });
  };

  // ── SOS submit ───────────────────────────────────────────────────────────────
  const handleSosSubmit = ({ preset, label, note, coords }: SosPayload) => {
    const time = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    const sig: SosSignal = {
      id: String(Date.now()), type: preset ?? "other", label,
      note: note || undefined, user: profile.handle, coords, time,
    };
    setSignals((s) => [...s, sig]);
    setTimeout(() => mapRef.current?.flyTo({
      center: toLngLat(coords), zoom: 16,
      pitch: WAZE_PITCH, bearing: headingRef.current,
      duration: 1200, essential: true,
    }), 100);
    const targetCity = city === "all" ? "tallinn" : city;
    pushChat({
      city: targetCity, user: profile.handle,
      text: `🆘 ${profile.handle} нужна помощь: ${label}${note && preset ? ` — ${note}` : ""} · [Посмотреть на карте]`,
      time, sos: true,
    });
    setSosOpen(false);
  };

  // ── Add spot ─────────────────────────────────────────────────────────────────
  const handleAddSpot = (data: { type: SpotType; name: string; description: string }) => {
    const center = mapRef.current?.getCenter();
    const coords: [number, number] = center ? [center.lat, center.lng] : cityObj.coords;
    const v = SPOT_VISUAL[data.type];
    setUserSpots((s) => [...s, {
      id: `us_${Date.now()}`, city: city === "all" ? "tallinn" : city,
      name: data.name, type: data.type, coords,
      description: data.description, photo: v.emoji,
      rating: 0, reviews: 0, userAdded: true,
    }]);
    setAddOpen(false);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative sg-map-wrap h-full">
      <div ref={containerRef} className="sg-map h-full w-full" />

      {/* ── Navigation overlay ── */}
      {activeRoute && (
        <div className="absolute top-3 left-3 right-14 z-[600] glass-strong rounded-2xl px-3 py-2.5 flex items-center gap-2 animate-float-up border border-accent/20 shadow-[0_0_24px_rgba(0,240,255,0.15)]">
          <div className="h-9 w-9 shrink-0 grid place-items-center rounded-xl bg-accent/15 text-accent">
            <RouteIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-[9px] text-muted-foreground tracking-widest uppercase">Навигатор</div>
            <div className="text-xs font-bold text-foreground truncate">{activeRoute.name}</div>
            <div className="flex items-center gap-3 text-xs font-bold mt-0.5">
              <span className="text-accent shrink-0">{activeRoute.distanceKm.toFixed(1)} км</span>
              <span className="flex items-center gap-1 text-foreground/90 shrink-0">
                <Clock className="h-3 w-3" />
                {Math.round(activeRoute.durationMin)} мин
              </span>
            </div>
          </div>
          <button
            onClick={clearRoute}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-bold tracking-wide text-foreground/80 hover:bg-primary/25 transition whitespace-nowrap"
          >
            Сбросить
          </button>
        </div>
      )}

      {/* ── Top-right controls ── */}
      <div className="absolute top-3 right-3 z-[600] flex flex-col gap-1.5">
        <button
          onClick={() => setLayers((l) => ({ ...l, users: !l.users }))}
          title="Слои"
          className={`h-9 w-9 grid place-items-center rounded-xl glass-strong transition ${
            layers.users ? "text-accent/90" : "text-muted-foreground/40"
          }`}
        >
          <Layers className="h-4 w-4" />
        </button>
        <button
          onClick={recenter}
          title="Вернуться к машине"
          className="h-9 w-9 grid place-items-center rounded-xl glass-strong text-accent/70 hover:text-accent transition"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>

      {/* ── Bottom Waze bar (above tab bar) ── */}
      <div className="absolute bottom-[62px] left-0 right-0 z-[600] flex flex-col gap-2 px-3">

        {/* Row 1 – Plus · Car pill · SOS */}
        <div className="flex items-end gap-2">
          <button
            onClick={() => setAddOpen(true)}
            aria-label="Добавить спот"
            className="h-12 w-12 shrink-0 rounded-full bg-accent grid place-items-center glow-cyan active:scale-95 transition shadow-lg"
          >
            <Plus className="h-5 w-5 text-accent-foreground" />
          </button>

          {/* Car selector pill */}
          <button
            onClick={() => setCarSheetOpen(true)}
            className="flex-1 min-w-0 glass-strong rounded-2xl px-3 py-2 flex items-center gap-2.5 active:opacity-80 transition border border-white/10"
            style={{ borderColor: `${selectedCar.color}33` }}
          >
            <span
              className="shrink-0 w-3 h-3 rounded-full"
              style={{ background: selectedCar.color, boxShadow: `0 0 8px ${selectedCar.color}` }}
            />
            <span className="text-xl shrink-0 leading-none">{selectedCar.emoji}</span>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-[9px] text-muted-foreground leading-none tracking-wider uppercase">
                CSS 3D · pitch {WAZE_PITCH}°
              </div>
              <div className="text-xs font-bold truncate mt-0.5">{selectedCar.name}</div>
            </div>
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>

          {/* SOS */}
          <div className="shrink-0 flex flex-col items-center gap-0.5">
            <button
              onClick={() => setSosOpen(true)}
              aria-label="SOS"
              className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-red-800 grid place-items-center glow-red animate-pulse-ring active:scale-95 transition shadow-lg"
            >
              <Siren className="h-5 w-5 text-white" />
            </button>
            <span className="text-[9px] font-black tracking-widest text-primary leading-none">SOS</span>
          </div>
        </div>

        {/* Row 2 – Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full glass-strong rounded-full px-4 py-3 flex items-center gap-3 active:opacity-80 transition border border-white/10 shadow-lg"
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground flex-1 text-left">Куда едем?</span>
          <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold shrink-0 border border-accent/30">
            GO
          </span>
        </button>
      </div>

      {/* ── Garage bottom sheet ── */}
      {carSheetOpen && (
        <div className="fixed inset-0 z-[800]" onClick={() => setCarSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl p-5 pb-10 animate-float-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold tracking-wider uppercase">Гараж</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Выбери машину — маркер на карте обновится мгновенно
                </p>
              </div>
              <button
                onClick={() => setCarSheetOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg glass text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {GARAGE_CARS.map((car) => {
              const active = selectedCarId === car.id;
              return (
                <button
                  key={car.id}
                  onClick={() => { setSelectedCarId(car.id); setCarSheetOpen(false); }}
                  className={`flex items-center gap-3 w-full p-3.5 rounded-2xl mb-2 transition text-left ${
                    active ? "border" : "glass border border-white/5 hover:border-white/15"
                  }`}
                  style={active ? {
                    background:   `${car.color}18`,
                    borderColor:  `${car.color}55`,
                    boxShadow:    `0 0 18px ${car.color}1a`,
                  } : {}}
                >
                  {/* Preview: CSS 3D mini card */}
                  <div
                    className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{
                      background: active ? `${car.color}28` : "rgba(255,255,255,0.05)",
                      boxShadow:  active ? `0 0 14px ${car.color}55` : "none",
                      transform:  "perspective(120px) rotateX(30deg)",
                      border:     `2px solid ${active ? car.color : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {car.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{car.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{car.description}</div>
                    <div className="text-[10px] mt-1" style={{ color: `${car.color}bb` }}>
                      CSS 3D · rotateX({WAZE_PITCH}°) · bearing-lock
                    </div>
                  </div>
                  {active && (
                    <span
                      className="text-[10px] font-black shrink-0 px-2.5 py-1 rounded-full"
                      style={{ color: car.color, background: `${car.color}22`, border: `1px solid ${car.color}55` }}
                    >
                      ✓ В ИГРЕ
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Search bottom sheet ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-[800]" onClick={() => setSearchOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl p-5 pb-10 max-h-[72vh] overflow-y-auto animate-float-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 glass rounded-full px-3 py-2.5 flex items-center gap-2 border border-white/10">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Куда едем?</span>
              </div>
              <button
                onClick={() => setSearchOpen(false)}
                className="h-9 w-9 grid place-items-center rounded-xl glass border border-white/10 text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {visibleSpots.length > 0 && (
              <>
                <div className="text-[9px] text-muted-foreground tracking-widest uppercase mb-2">Споты рядом</div>
                {visibleSpots.slice(0, 6).map((spot) => (
                  <div key={spot.id} className="flex items-center gap-3 glass rounded-2xl px-3 py-2.5 mb-2 border border-white/5">
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => {
                        setSearchOpen(false);
                        mapRef.current?.flyTo({
                          center: toLngLat(spot.coords), zoom: 16,
                          pitch: WAZE_PITCH, bearing: headingRef.current,
                          duration: 1600, essential: true,
                        });
                      }}
                    >
                      <span className="text-xl shrink-0">{SPOT_VISUAL[spot.type].emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{spot.name}</div>
                        <div className="text-[10px] text-muted-foreground">★ {spot.rating} · {spot.description.slice(0, 30)}…</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setSearchOpen(false); triggerRoute(spot.coords, spot.name); }}
                      className="shrink-0 text-[10px] bg-accent/20 text-accent border border-accent/30 px-2.5 py-1 rounded-full font-bold hover:bg-accent/30 transition"
                    >GO</button>
                  </div>
                ))}
              </>
            )}

            {visibleMeets.length > 0 && (
              <>
                <div className="text-[9px] text-muted-foreground tracking-widest uppercase mb-2 mt-4">Митапы</div>
                {visibleMeets.map((mt) => (
                  <div key={mt.id} className="flex items-center gap-3 glass rounded-2xl px-3 py-2.5 mb-2 border border-white/5">
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => {
                        setSearchOpen(false);
                        mapRef.current?.flyTo({
                          center: toLngLat(mt.coords), zoom: 15,
                          pitch: WAZE_PITCH, bearing: headingRef.current,
                          duration: 1600, essential: true,
                        });
                      }}
                    >
                      <span className="text-xl shrink-0">{mt.cover}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{mt.title}</div>
                        <div className="text-[10px] text-muted-foreground">{mt.time} · 👥 {mt.going} едут</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setSearchOpen(false); triggerRoute(mt.coords, mt.title); }}
                      className="shrink-0 text-[10px] bg-accent/20 text-accent border border-accent/30 px-2.5 py-1 rounded-full font-bold hover:bg-accent/30 transition"
                    >GO</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <SosModal open={sosOpen} fallbackCoords={ME.location} onClose={() => setSosOpen(false)} onSubmit={handleSosSubmit} />
      <AddSpotModal open={addOpen} onClose={() => setAddOpen(false)} onSubmit={handleAddSpot} />
    </div>
  );
}
