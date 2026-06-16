import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  USERS, SPOTS, MEETS, ME, getCity,
  type SosSignal, type Spot, type SpotType, type CityId,
} from "@/lib/streetgrid/data";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { Layers, Crosshair, Siren, Plus, Clock, Route as RouteIcon } from "lucide-react";
import { SosModal, type SosPayload } from "./SosModal";
import { AddSpotModal } from "./AddSpotModal";

mapboxgl.accessToken =
  "pk.eyJ1IjoiMTEtMTEiLCJhIjoiY21xZTRrejF6MTdqNjJxcXpob2Fqc2c4OSJ9.JZTGEp-_QhQASnJTniUohQ";

// app stores [lat, lng]; Mapbox expects [lng, lat]
const toLngLat = ([lat, lng]: [number, number]): [number, number] => [lng, lat];

const ROUTE_GLOW = "#00f0ff";
const ROUTE_LINE = "#00ffff";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  city: CityId;
  onOpenGarage: (userId: string) => void;
  focusSpot?: { id: string; ts: number } | null;
  routeRequest?: { coords: [number, number]; name: string; ts: number } | null;
};

type Bot = {
  id: string;
  name: string;
  car: string;
  emoji: string;
  coords: [number, number];
  patrol?: boolean;
};

type ActiveRoute = {
  name: string;
  distanceKm: number;
  durationMin: number;
};

const SPOT_VISUAL: Record<SpotType, { emoji: string }> = {
  photo:    { emoji: "📸" },
  wash:     { emoji: "💦" },
  friendly: { emoji: "☕" },
  parking:  { emoji: "🅿️" },
  landmark: { emoji: "📍" },
};

type MarkerRole = "user_regular" | "user_friend" | "club" | "party" | "legend" | "sos";

const MARKER_THEMES: Record<MarkerRole, { border: string; glow: string; pulse: boolean }> = {
  user_regular: { border: "#00ff66", glow: "0 0 12px rgba(0,255,102,0.65), 0 0 32px rgba(0,255,102,0.3)",   pulse: false },
  user_friend:  { border: "#0066ff", glow: "0 0 12px rgba(0,102,255,0.65), 0 0 32px rgba(0,102,255,0.3)",   pulse: false },
  club:         { border: "#cc00ff", glow: "0 0 12px rgba(204,0,255,0.65), 0 0 32px rgba(204,0,255,0.3)", pulse: true  },
  party:        { border: "#ff6600", glow: "0 0 12px rgba(255,102,0,0.65), 0 0 32px rgba(255,102,0,0.3)",  pulse: true  },
  legend:       { border: "#ffcc00", glow: "0 0 12px rgba(255,204,0,0.65), 0 0 32px rgba(255,204,0,0.3)",  pulse: false },
  sos:          { border: "#ff0033", glow: "0 0 14px rgba(255,0,51,0.75), 0 0 36px rgba(255,0,51,0.4)",     pulse: true  },
};

const SPOT_ROLE: Record<SpotType, MarkerRole> = {
  photo:    "club",
  friendly: "user_friend",
  wash:     "club",
  parking:  "user_regular",
  landmark: "legend",
};

function userRole(id: string): MarkerRole {
  return id === "u2" ? "user_friend" : "user_regular";
}

const routeBtnHtml = (id: string) =>
  `<button data-route="${id}" style="margin-top:6px;background:#00f0ff;color:#001;padding:5px 10px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px">🧭 ПОЕХАЛИ</button>`;

function makeMarkerEl(
  html: string,
  role: MarkerRole,
  size = 36,
  extraStyle: Partial<CSSStyleDeclaration> = {},
): HTMLDivElement {
  const theme = MARKER_THEMES[role];
  const wrap = document.createElement("div");
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
  const el = document.createElement("div");
  el.className = "sg-cluster-marker";
  Object.assign(el.style, {
    width:           `${size}px`,
    height:          `${size}px`,
    borderRadius:    "50%",
    background:      "rgba(8,10,20,0.88)",
    border:          "2px solid #00f0ff",
    boxShadow:       "0 0 12px rgba(0,240,255,0.65), 0 0 28px rgba(0,240,255,0.35), inset 0 0 8px rgba(0,240,255,0.15)",
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    color:           "#ffffff",
    fontWeight:      "800",
    fontSize:        "13px",
    cursor:          "pointer",
    userSelect:      "none",
  });
  el.textContent = String(count);
  return el;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapView({ city, onOpenGarage, focusSpot, routeRequest }: Props) {
  const { profile, settings, pushChat } = useStreetGrid();

  const containerRef       = useRef<HTMLDivElement>(null);
  const mapRef             = useRef<mapboxgl.Map | null>(null);
  const featureMarkersRef     = useRef<mapboxgl.Marker[]>([]);
  const spotMarkersRef        = useRef<Record<string, mapboxgl.Marker>>({});
  const botMarkersRef         = useRef<mapboxgl.Marker[]>([]);
  const sosMarkersRef         = useRef<mapboxgl.Marker[]>([]);
  const spotRenderCleanupRef  = useRef<(() => void) | null>(null);

  const [ready,       setReady]       = useState(false);
  const [sosOpen,     setSosOpen]     = useState(false);
  const [addOpen,     setAddOpen]     = useState(false);
  const [signals,     setSignals]     = useState<SosSignal[]>([]);
  const [userSpots,   setUserSpots]   = useState<Spot[]>([]);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [layers,      setLayers]      = useState({ users: true, spots: true, meets: true });
  const [bots,        setBots]        = useState<Bot[]>([]);

  const cityObj      = getCity(city);
  const allSpots     = [...SPOTS, ...userSpots];
  const visibleSpots = city === "all" ? allSpots : allSpots.filter((s) => s.city === city);
  const visibleMeets = city === "all" ? MEETS : MEETS.filter((m) => m.city === city);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: toLngLat(cityObj.coords),
      zoom: cityObj.zoom,
      pitch: 60,
      bearing: -15,
      antialias: true,
      attributionControl: false,
    });

    map.on("load", () => {
      // 3-D buildings
      try {
        const styleLayers = map.getStyle().layers ?? [];
        const labelLayer  = styleLayers.find(
          (l) => l.type === "symbol" && (l.layout as { "text-field"?: unknown })?.["text-field"],
        );
        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color":   "#1a1f2e",
              "fill-extrusion-height":  ["get", "height"],
              "fill-extrusion-base":    ["get", "min_height"],
              "fill-extrusion-opacity": 0.75,
            },
          },
          labelLayer?.id,
        );
      } catch { /* style not loaded */ }

      // POI → hide; key text labels → force visible
      const FORCE_VISIBLE = ["road-label", "settlement-label", "settlement-subdivision-label", "water-label"];
      map.getStyle().layers?.forEach((l) => {
        if (l.id.includes("poi")) {
          map.setLayoutProperty(l.id, "visibility", "none");
        } else if (FORCE_VISIBLE.some((k) => l.id.includes(k))) {
          map.setLayoutProperty(l.id, "visibility", "visible");
        }
      });

      // Route sources & layers (glow + solid line)
      map.addSource("sg-route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "sg-route-glow",
        type: "line",
        source: "sg-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ROUTE_GLOW, "line-width": 14, "line-opacity": 0.35, "line-blur": 5 },
      });
      map.addLayer({
        id: "sg-route-line",
        type: "line",
        source: "sg-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ROUTE_LINE, "line-width": 5.5, "line-opacity": 1 },
      });

      // GeoJSON source for HTML-based spot clustering (no circle/symbol layers)
      map.addSource("spots", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      setReady(true);
    });

    mapRef.current = map;

    // Keep 3D pitch stable while panning after geo flyTo (no snap-to-flat)
    map.touchPitch.enable();

    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fly to city ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    mapRef.current?.flyTo({
      center:   toLngLat(cityObj.coords),
      zoom:     cityObj.zoom,
      pitch:    60,
      bearing:  -15,
      duration: 2000,
      essential: true,
    });
  }, [city, ready, cityObj.coords, cityObj.zoom]);

  // ── Bots simulation ─────────────────────────────────────────────────────────
  useEffect(() => {
    const base = cityObj.coords;
    const r    = city === "all" ? 0.5 : 0.012;
    const init: Bot[] = [
      { id: "b1", name: "Никита",  car: "BMW M4",        emoji: "🏎️", coords: [base[0] + r,        base[1] + r] },
      { id: "b2", name: "Артур",   car: "Toyota Supra",  emoji: "🚗", coords: [base[0] - r,        base[1] + r * 0.6] },
      { id: "b3", name: "Кристи",  car: "Subaru WRX",    emoji: "🚙", coords: [base[0] + r * 0.4,  base[1] - r] },
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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  // makeMarkerEl / makeClusterEl / routeBtnHtml are module-level helpers above

  // ── Route drawing ────────────────────────────────────────────────────────────
  const setRouteGeoJson = useCallback((geometry: GeoJSON.LineString | null) => {
    const src = mapRef.current?.getSource("sg-route") as mapboxgl.GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: geometry ? [{ type: "Feature", properties: {}, geometry }] : [],
    });
  }, []);

  const fitRouteBounds = useCallback((coords: [number, number][]) => {
    if (coords.length < 2) return;
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(coords[0], coords[0]),
    );
    mapRef.current?.fitBounds(bounds, {
      padding: { top: 120, bottom: 120, left: 60, right: 60 },
      pitch:   60,
      bearing: -10,
      duration: 1400,
      essential: true,
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

  const clearRoute = useCallback(() => {
    setRouteGeoJson(null);
    setActiveRoute(null);
  }, [setRouteGeoJson]);

  const triggerRoute = useCallback((coords: [number, number], name: string) => {
    runRouteTo(coords, name);
  }, [runRouteTo]);

  // ── Feature markers (ME, users, meets — not spots) ───────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    featureMarkersRef.current.forEach((m) => m.remove());
    featureMarkersRef.current = [];

    // ME
    if (city === "tallinn" || city === "all") {
      const m = new mapboxgl.Marker({ element: makeMarkerEl("📍", "user_friend", 42) })
        .setLngLat(toLngLat(ME.location))
        .setPopup(new mapboxgl.Popup({ offset: 22 }).setHTML(`<b>${profile.handle}</b><br/>${profile.status}`))
        .addTo(map);
      featureMarkersRef.current.push(m);
    }

    // Other users
    if (layers.users && (city === "tallinn" || city === "all")) {
      USERS.forEach((u) => {
        const popup = new mapboxgl.Popup({ offset: 22 }).setHTML(
          `<div><b>${u.handle}</b><br/>${u.car.year} ${u.car.make} ${u.car.model}<br/><i>${u.status === "moving" ? "В движении" : "На споте"}</i><br/><button data-garage="${u.id}" style="margin-top:6px;background:#FF3B30;color:#fff;border:none;padding:5px 10px;border-radius:6px;font-weight:bold;cursor:pointer">Открыть гараж</button></div>`,
        );
        popup.on("open", () => setTimeout(() => {
          document.querySelector<HTMLButtonElement>(`button[data-garage="${u.id}"]`)
            ?.addEventListener("click", () => onOpenGarage(u.id));
        }, 0));
        const m = new mapboxgl.Marker({
          element: makeMarkerEl(u.status === "moving" ? "🏎️" : "🅿️", userRole(u.id)),
        })
          .setLngLat(toLngLat(u.location)).setPopup(popup).addTo(map);
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
  }, [layers.users, layers.meets, ready, city, visibleMeets.length, onOpenGarage, profile.handle, profile.status, triggerRoute]);

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

        // Cluster → custom HTML bubble
        if (props.point_count != null) {
          const clusterId = props.cluster_id as number;
          const key = `cluster-${clusterId}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const count = Number(props.point_count);
          const el = makeClusterEl(count);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom == null) return;
              map.easeTo({ center: coords, zoom: zoom + 0.5, duration: 600 });
            });
          });

          const marker = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(map);
          spotMarkersRef.current[key] = marker;
          continue;
        }

        // Single spot → original neon HTML icon
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

        const marker = new mapboxgl.Marker({
          element: makeMarkerEl(spot.photo || v.emoji, SPOT_ROLE[spot.type]),
        })
          .setLngLat(coords).setPopup(popup).addTo(map);
        spotMarkersRef.current[id] = marker;
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
      const m = new mapboxgl.Marker({
        element: makeMarkerEl(b.emoji, b.patrol ? "sos" : "user_regular", 34),
      })
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
      const m = new mapboxgl.Marker({ element: makeMarkerEl("🆘", "sos", 44) })
        .setLngLat(toLngLat(sig.coords)).setPopup(popup).addTo(map);
      sosMarkersRef.current.push(m);
    });
  }, [signals, ready, triggerRoute]);

  // ── Focus spot externally ────────────────────────────────────────────────────
  useEffect(() => {
    if (!focusSpot || !ready) return;
    const target = [...SPOTS, ...userSpots].find((s) => s.id === focusSpot.id);
    if (!target) return;
    mapRef.current?.flyTo({ center: toLngLat(target.coords), zoom: 15, pitch: 60, bearing: -10, duration: 1600, essential: true });
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

  // ── Map controls ─────────────────────────────────────────────────────────────
  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getZoom() < 14) {
      // Overview → juicy 3D close-up on user
      map.flyTo({
        center:    toLngLat(ME.location),
        zoom:      16.5,
        pitch:     50,
        bearing:   0,
        duration:  2000,
        essential: true,
      });
    } else {
      // Close-up → back to city overview, flat horizon
      map.flyTo({
        center:    toLngLat(cityObj.coords),
        zoom:      cityObj.zoom,
        pitch:     0,
        bearing:   0,
        duration:  2000,
        essential: true,
      });
    }
  };

  // ── SOS submit ───────────────────────────────────────────────────────────────
  const handleSosSubmit = ({ preset, label, note, coords }: SosPayload) => {
    const time = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    const sig: SosSignal = { id: String(Date.now()), type: preset ?? "other", label, note: note || undefined, user: profile.handle, coords, time };
    setSignals((s) => [...s, sig]);
    setTimeout(() => mapRef.current?.flyTo({ center: toLngLat(coords), zoom: 15, pitch: 60, bearing: -10, duration: 1200, essential: true }), 100);
    const targetCity = city === "all" ? "tallinn" : city;
    pushChat({ city: targetCity, user: profile.handle, text: `🆘 ${profile.handle} нужна помощь: ${label}${note && preset ? ` — ${note}` : ""} · [Посмотреть на карте]`, time, sos: true });
    setSosOpen(false);
  };

  // ── Add spot ─────────────────────────────────────────────────────────────────
  const handleAddSpot = (data: { type: SpotType; name: string; description: string }) => {
    const center = mapRef.current?.getCenter();
    const coords: [number, number] = center ? [center.lat, center.lng] : cityObj.coords;
    const v = SPOT_VISUAL[data.type];
    setUserSpots((s) => [...s, {
      id: `us_${Date.now()}`,
      city: city === "all" ? "tallinn" : city,
      name: data.name, type: data.type, coords,
      description: data.description, photo: v.emoji,
      rating: 0, reviews: 0, userAdded: true,
    }]);
    setAddOpen(false);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative sg-map-wrap">
      <div ref={containerRef} className="sg-map h-[calc(100vh-210px)] w-full" />

      {/* Navigation overlay — full width top */}
      {activeRoute && (
        <div className="absolute top-3 left-3 right-3 z-[600] glass-strong rounded-2xl px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 animate-float-up border border-accent/20 shadow-[0_0_24px_rgba(0,240,255,0.15)]">
          <div className="h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-accent/15 text-accent glow-cyan">
            <RouteIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase">Навигатор</div>
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
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-2.5 sm:px-3 py-2 text-[10px] sm:text-[11px] font-bold tracking-wide text-foreground/90 hover:bg-primary/25 hover:border-accent/30 transition whitespace-nowrap"
          >
            Сбросить маршрут
          </button>
        </div>
      )}

      {/* Layer & recenter buttons — left side, below possible nav overlay */}
      <div className="absolute top-20 left-3 z-[600] flex flex-col gap-2">
        <button
          onClick={() => setLayers((l) => ({ ...l, users: !l.users }))}
          className={`h-10 w-10 grid place-items-center rounded-xl glass-strong transition ${layers.users ? "text-primary glow-red" : "text-muted-foreground"}`}
        >
          <Layers className="h-4 w-4" />
        </button>
        <button
          onClick={recenter}
          className="h-10 w-10 grid place-items-center rounded-xl glass-strong text-accent"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>

      {/* Add Spot button — bottom left */}
      <button
        onClick={() => setAddOpen(true)}
        className="absolute bottom-9 left-4 z-[600] h-14 w-14 rounded-full bg-accent grid place-items-center glow-cyan active:scale-95 transition"
        aria-label="Добавить спот"
      >
        <Plus className="h-7 w-7 text-accent-foreground" />
      </button>

      {/* SOS button — bottom right, lifted to avoid Mapbox attribution */}
      <div className="absolute bottom-9 right-4 z-[600] flex flex-col items-center gap-1">
        <button
          onClick={() => setSosOpen(true)}
          className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-red-800 grid place-items-center glow-red animate-pulse-ring active:scale-95 transition"
          aria-label="SOS"
        >
          <Siren className="h-7 w-7 text-white" />
        </button>
        <span className="text-[10px] font-black tracking-widest text-primary leading-none">SOS</span>
      </div>

      <SosModal
        open={sosOpen}
        fallbackCoords={ME.location}
        onClose={() => setSosOpen(false)}
        onSubmit={handleSosSubmit}
      />
      <AddSpotModal open={addOpen} onClose={() => setAddOpen(false)} onSubmit={handleAddSpot} />
    </div>
  );
}
