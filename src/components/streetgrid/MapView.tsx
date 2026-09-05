import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  USERS, SPOTS, MEETS, ME, getCity,
  type UserProfile,
  type SosSignal, type CityId,
} from "@/lib/streetgrid/data";
import { type Spot, getSpotRarityVisual } from "@/lib/streetgrid/spots";
import {
  applyRarityRingVars,
  getMarkerRingClasses,
  shouldShowRadarPulse,
} from "@/lib/streetgrid/markerRendering";
import { RARITY_META } from "@/lib/streetgrid/vehicles";
import {
  getVehicleLayerOpacity,
  presenceDisplayLerpFactor,
} from "@/lib/streetgrid/avatarVehicleTransition";
import { levelBadgeGate } from "@/lib/streetgrid/markerPresenceAnimator";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { VEHICLE_CATALOG, getPlayerLevel, getRarityRank, getVehicleById, getVehicleColorForSeed } from "@/lib/streetgrid/vehicles";
import type { VehicleDefinition } from "@/lib/streetgrid/vehicles";
import {
  Plus, Clock,
  Route as RouteIcon, Search, X,
} from "lucide-react";
import { MapActionStack } from "./MapActionStack";
import { PlayerCardSheet } from "./PlayerCardSheet";
import type { NavMode } from "@/lib/streetgrid/navMode";
import { SosModal, type SosPayload } from "./SosModal";
import { AddSpotModal } from "./AddSpotModal";
import { SpotDetailPanel } from "./SpotDetailPanel";
import { getPlayerAvatarUrl } from "@/lib/streetgrid/avatars";
import type { PlayerMarkerProps } from "./playerMarkerUtils";
import {
  resetSharedPlayerMarkerAppearanceController,
} from "@/lib/streetgrid/playerMarkerAppearance";
import {
  mountPlayerMarker,
  unmountAllPlayerMarkers,
  unmountPlayerMarker,
  updatePlayerMarkerProps,
  updatePlayerMarkersZoom,
  applyPlayerPresenceOpacity,
  applyPlayerMarkerZIndex,
  syncMountedPlayerMarkerViewport,
  type MountedPlayerMarker,
} from "./playerMarkerMount";
import {
  CAMERA_DURATION_MAX_MS,
  MapCameraController,
  type MapPadding,
} from "@/lib/streetgrid/mapCamera";
import { MAP_MARKER_LAYER, tagMapMarkerLayer } from "@/lib/streetgrid/mapMarkerLayers";
import {
  assignDemoPlayersToCities,
  buildRoadAwareDemoPositions,
  type AppCoordinate,
  type DemoCityId,
} from "@/lib/streetgrid/roadAwarePositioning";

mapboxgl.accessToken =
  "pk.eyJ1IjoiMTEtMTEiLCJhIjoiY21xZTRrejF6MTdqNjJxcXpob2Fqc2c4OSJ9.JZTGEp-_QhQASnJTniUohQ";

// app stores [lat, lng]; Mapbox expects [lng, lat]
const toLngLat = ([lat, lng]: [number, number]): [number, number] => [lng, lat];

const CITY_COORDS: Record<CityId, { center: [number, number]; zoom: number }> = {
  all:     { center: [25.0136, 58.5953], zoom: 7 },
  tallinn: { center: [24.7536, 59.4370], zoom: 13 },
  tartu:   { center: [26.7290, 58.3780], zoom: 13 },
  parnu:   { center: [24.5004, 58.3859], zoom: 13 },
  narva:   { center: [28.1790, 59.3797], zoom: 13 },
};

const ROUTE_GLOW = "#00f3ff";
const ROUTE_LINE = "#00f3ff";

const WAZE_ZOOM    = 16.5;
const WAZE_PITCH   = 60;
/** Overhead route-preview framing — not the Waze driving camera. */
const ROUTE_PREVIEW_PITCH = 0;

type Props = {
  city: CityId;
  onOpenGarage: (userId: string) => void;
  focusSpot?: { id: string; ts: number } | null;
  routeRequest?: { coords: [number, number]; name: string; ts: number } | null;
};

type Bot = {
  id: string; name: string; car: string; emoji: string;
  coords: [number, number]; city: DemoCityId; patrol?: boolean;
};

const DEMO_BOT_CITIES: Record<"b1" | "b2" | "b3" | "patrol", DemoCityId> = {
  b1: "tallinn",
  b2: "tartu",
  b3: "parnu",
  patrol: "narva",
};

type ActiveRoute = {
  name: string; distanceKm: number; durationMin: number;
};

type RoutePhase = "preview" | "navigating";

type MarkerRole = "user_regular" | "user_friend" | "club" | "party" | "legend" | "sos";

const MARKER_THEMES: Record<MarkerRole, { border: string; glow: string; pulse: boolean }> = {
  user_regular: { border: "#00ff88", glow: "0 0 14px rgba(0,255,136,0.75),0 0 36px rgba(0,255,136,0.38),inset 0 0 8px rgba(0,255,136,0.12)", pulse: false },
  user_friend:  { border: "#3399ff", glow: "0 0 14px rgba(51,153,255,0.75),0 0 36px rgba(51,153,255,0.38),inset 0 0 8px rgba(51,153,255,0.12)", pulse: false },
  club:         { border: "#dd44ff", glow: "0 0 16px rgba(221,68,255,0.8),0 0 40px rgba(221,68,255,0.42),inset 0 0 10px rgba(221,68,255,0.15)", pulse: true  },
  party:        { border: "#ff7722", glow: "0 0 16px rgba(255,119,34,0.8),0 0 40px rgba(255,119,34,0.42),inset 0 0 10px rgba(255,119,34,0.15)", pulse: true  },
  legend:       { border: "#ffdd33", glow: "0 0 16px rgba(255,221,51,0.8),0 0 40px rgba(255,221,51,0.42),inset 0 0 10px rgba(255,221,51,0.15)", pulse: false },
  sos:          { border: "#ff0033", glow: "0 0 8px rgba(255,0,51,0.45),0 0 22px rgba(255,0,51,0.24)", pulse: true  },
};

function distKm(a: [number, number], b: [number, number]): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function getOnlinePlayersForMap(): UserProfile[] {
  return USERS.filter((u) => u.id !== ME.id && u.status !== "offline");
}

function playersToGeoJson(users: UserProfile[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: users.map((u) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: toLngLat(u.location) },
      properties: {
        id: u.id,
        rarity: u.rarity,
        rarity_rank: getRarityRank(u.rarity),
      },
    })),
  };
}

type UserLocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  timestamp: number;
};

type UserLocation = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  timestamp: number | null;
  status: "idle" | "active";
};

function validateLocationFix(next: UserLocationFix): boolean {
  return (
    Number.isFinite(next.latitude) &&
    Number.isFinite(next.longitude) &&
    Math.abs(next.latitude) <= 90 &&
    Math.abs(next.longitude) <= 180 &&
    Number.isFinite(next.accuracy) &&
    next.accuracy > 0
  );
}

function getValidLocationFix(location: UserLocation): UserLocationFix | null {
  if (
    location.status !== "active" ||
    location.latitude == null ||
    location.longitude == null ||
    location.accuracy == null ||
    location.timestamp == null
  ) {
    return null;
  }
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    heading: location.heading,
    timestamp: location.timestamp,
  };
}

const IDLE_USER_LOCATION: UserLocation = {
  latitude: ME.location[0],
  longitude: ME.location[1],
  accuracy: null,
  heading: null,
  timestamp: null,
  status: "idle",
};

const routeBtnHtml = (id: string) =>
  `<button data-route="${id}" style="margin-top:6px;background:#00f0ff;color:#001;padding:5px 10px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px">🧭 ПОЕХАЛИ</button>`;

// ─── Procedural 3D car (fallback when .glb is not present) ────────────────────
//
// Car front = +Z axis.  Each car ID produces a DIFFERENT body shape.
// Common materials are shared; addWheels() helper stamps 4 wheels+rims.
//
function createProceduralCar(carId: string, colorHex: string): THREE.Group {
  const group  = new THREE.Group();
  const color  = new THREE.Color(colorHex);
  const bodyM  = new THREE.MeshPhongMaterial({ color, shininess: 130, specular: new THREE.Color(0x445566) });
  const glassM = new THREE.MeshPhongMaterial({ color: 0x88aacc, transparent: true, opacity: 0.65, shininess: 220 });
  const darkM  = new THREE.MeshPhongMaterial({ color: 0x111122 });
  const wheelM = new THREE.MeshPhongMaterial({ color: 0x222233 });
  const rimM   = new THREE.MeshPhongMaterial({ color: 0xbbbbcc, shininess: 200 });
  const hlM    = new THREE.MeshPhongMaterial({ color: 0xffffaa, emissive: new THREE.Color(0xffff44), emissiveIntensity: 0.9 });
  const tlM    = new THREE.MeshPhongMaterial({ color: 0xff2222, emissive: new THREE.Color(0xff0000), emissiveIntensity: 0.7 });

  // Stamp 4 wheels at ±trackW, ±wb/2, height yW
  const addWheels = (trackW: number, wb: number, r: number, yW: number) => {
    const wGeo = new THREE.CylinderGeometry(r, r, 0.22, 20);
    const rGeo = new THREE.CylinderGeometry(r * 0.56, r * 0.56, 0.24, 10);
    for (const [wx, wz] of [[trackW, wb/2], [trackW, -wb/2], [-trackW, wb/2], [-trackW, -wb/2]] as [number,number][]) {
      const w = new THREE.Mesh(wGeo, wheelM); w.rotation.z = Math.PI / 2; w.position.set(wx, yW, wz); group.add(w);
      const ri = new THREE.Mesh(rGeo, rimM);  ri.rotation.z = Math.PI / 2; ri.position.set(wx, yW, wz); group.add(ri);
    }
  };

  // ── hippie_van ── tall boxy van ─────────────────────────────────────────────
  if (carId === "hippie_van") {
    // Main box — tall, wide, long
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.3, 5.4), bodyM);
    body.position.y = 1.25;
    group.add(body);
    // Large windshield
    const wsh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 0.09), glassM);
    wsh.position.set(0, 1.95, 2.72); group.add(wsh);
    // Side windows (two rows)
    for (const sx of [-1.09, 1.09]) {
      const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 1.4), glassM);
      w1.position.set(sx, 1.9, 0.9); group.add(w1);
      const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.68, 0.95), glassM);
      w2.position.set(sx, 1.85, -0.75); group.add(w2);
    }
    // Rear window
    const rw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.85, 0.08), glassM);
    rw.position.set(0, 1.85, -2.72); group.add(rw);
    // Headlights
    for (const sx of [0.72, -0.72]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.13), hlM);
      h.position.set(sx, 1.05, 2.78); group.add(h);
    }
    // Taillights
    for (const sx of [0.72, -0.72]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.11), tlM);
      t.position.set(sx, 1.05, -2.78); group.add(t);
    }
    // Grille
    const gr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.11), darkM);
    gr.position.set(0, 0.65, 2.78); group.add(gr);
    addWheels(1.12, 3.1, 0.44, 0.44);

  // ── retro_racer ── low racing bolide with wings ─────────────────────────────
  } else if (carId === "retro_racer") {
    // Ultra-low body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.36, 4.7), bodyM);
    body.position.y = 0.3; group.add(body);
    // Nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.26, 1.1), bodyM);
    nose.position.set(0, 0.26, 2.9); group.add(nose);
    // Open cockpit
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.44, 1.45), bodyM);
    cockpit.position.set(0, 0.7, -0.25); group.add(cockpit);
    // Tiny windscreen
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.28, 0.07), glassM);
    ws.position.set(0, 0.86, 0.45); ws.rotation.x = 0.62; group.add(ws);
    // Front wing — wide flat slab
    const fw = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.09, 0.72), bodyM);
    fw.position.set(0, 0.2, 2.65); group.add(fw);
    for (const sx of [1.65, -1.65]) { // front end-plates
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.33, 0.72), bodyM);
      ep.position.set(sx, 0.33, 2.65); group.add(ep);
    }
    // Rear wing main + pillars + end-plates
    const rw = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.1, 0.58), bodyM);
    rw.position.set(0, 1.06, -2.3); group.add(rw);
    for (const sx of [0.9, -0.9]) {
      const rp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.54, 0.13), bodyM);
      rp.position.set(sx, 0.8, -2.3); group.add(rp);
    }
    for (const sx of [1.35, -1.35]) {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.56, 0.58), bodyM);
      ep.position.set(sx, 0.8, -2.3); group.add(ep);
    }
    // Diffuser
    const diff = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.24, 0.52), darkM);
    diff.position.set(0, 0.13, -2.76); group.add(diff);
    // Exhaust pipes (chrome)
    const chrome = new THREE.MeshPhongMaterial({ color: 0xddddee, shininess: 300 });
    for (const sx of [0.36, -0.36]) {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.62, 10), chrome);
      ex.rotation.x = Math.PI / 2; ex.position.set(sx, 0.42, -2.6); group.add(ex);
    }
    // Headlights
    for (const sx of [0.38, -0.38]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.11), hlM);
      h.position.set(sx, 0.38, 2.38); group.add(h);
    }
    // Taillights
    for (const sx of [0.38, -0.38]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.09), tlM);
      t.position.set(sx, 0.38, -2.38); group.add(t);
    }
    addWheels(1.12, 2.85, 0.37, 0.37);

  // ── tesla_neon ── sleek fastback with neon underglow ────────────────────────
  } else if (carId === "tesla_neon") {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.58, 4.2), bodyM);
    hull.position.y = 0.44; group.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.62, 2.35), bodyM);
    cabin.position.set(0, 1.06, -0.18); group.add(cabin);
    // Panoramic windshield
    const wsh = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.56, 0.09), glassM);
    wsh.position.set(0, 1.08, 1.0); wsh.rotation.x = 0.36; group.add(wsh);
    // Sloping fastback rear glass
    const rg = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.62, 0.09), glassM);
    rg.position.set(0, 1.04, -1.44); rg.rotation.x = -0.54; group.add(rg);
    // Side windows
    for (const sx of [-0.88, 0.88]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 1.9), glassM);
      w.position.set(sx, 1.16, -0.2); group.add(w);
    }
    // Neon underglow strip (emissive with car color)
    const glowM = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 1.4 });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.07, 4.22), glowM);
    strip.position.y = 0.09; group.add(strip);
    // Blade headlights (Tesla-style thin bar)
    const bladeM = new THREE.MeshPhongMaterial({ color: 0xeeeeff, emissive: new THREE.Color(0xaaaaff), emissiveIntensity: 1.1 });
    const hl = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.07, 0.13), bladeM);
    hl.position.set(0, 0.66, 2.12); group.add(hl);
    // Taillights
    for (const sx of [0.6, -0.6]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.1), tlM);
      t.position.set(sx, 0.54, -2.12); group.add(t);
    }
    addWheels(1.01, 2.72, 0.35, 0.35);

  // ── bmw_m3 (default) ── classic sport sedan ─────────────────────────────────
  } else {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.62, 4.1), bodyM);
    hull.position.y = 0.46; group.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.76, 2.05), bodyM);
    cabin.position.set(0, 1.18, -0.1); group.add(cabin);
    const wsh = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.6, 0.07), glassM);
    wsh.position.set(0, 1.14, 0.9); wsh.rotation.x = 0.45; group.add(wsh);
    const rg = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.56, 0.07), glassM);
    rg.position.set(0, 1.12, -1.2); rg.rotation.x = -0.38; group.add(rg);
    for (const sx of [-0.9, 0.9]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 1.68), glassM);
      w.position.set(sx, 1.22, -0.1); group.add(w);
    }
    // Twin kidney grille (BMW signature)
    for (const gx of [0.32, -0.32]) {
      const kg = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.3, 0.1), darkM);
      kg.position.set(gx, 0.52, 2.1); group.add(kg);
    }
    // M-badge stripe (accent)
    const stripeM = new THREE.MeshPhongMaterial({ color: new THREE.Color(colorHex), emissive: color, emissiveIntensity: 0.3 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 4.12), stripeM);
    stripe.position.y = 0.78; group.add(stripe);
    // Headlights
    for (const sx of [0.58, -0.58]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.17, 0.11), hlM);
      h.position.set(sx, 0.56, 2.1); group.add(h);
    }
    // Taillights
    for (const sx of [0.58, -0.58]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.1), tlM);
      t.position.set(sx, 0.56, -2.1); group.add(t);
    }
    addWheels(1.04, 2.84, 0.35, 0.35);
  }

  return group;
}

// ─── Three.js Custom Layer ─────────────────────────────────────────────────────
//
// Implements Mapbox CustomLayerInterface.
// renderingMode:'3d' composites correctly with 3D buildings.
//
// Rotation math (heading in degrees, clockwise from north):
//   rotateX(π/2)  → stands Y-up model on the map surface
//   rotateY(θ)    → θ = heading*π/180 turns the car to face the heading direction
//   proof: front vector (0,0,1) → rotateY(θ) → (sinθ, 0, cosθ)
//          → rotateX(π/2) → (sinθ, -cosθ, 0)
//          → scale(s,-s,s) → (sinθ·s, cosθ·s, 0)  [mercator +X=east, +Y=north]
//          θ=0  → (0, s, 0)  = north ✓
//          θ=π/2→ (s, 0, 0)  = east  ✓
//
// Fixed visual boost on top of Mapbox's meter scale — world-locked, zoom-independent.
const CAR_MODEL_SCALE = 1.55;
const CAR_TARGET_LENGTH_M = 4.0;

/** Scale any vehicle mesh so its largest axis equals CAR_TARGET_LENGTH_M. */
function normalizeVehicleModel(model: THREE.Object3D, targetLengthM = CAR_TARGET_LENGTH_M) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) model.scale.setScalar(targetLengthM / maxDim);
}

// Vehicle navigation glow — local metres (model normalised to ~4 m length).
// Glow is parented inside carContentGroup so it moves/rotates with the vehicle.
const CAR_LENGTH_M        = CAR_TARGET_LENGTH_M;
const GLOW_OUTER_RADIUS_M = CAR_LENGTH_M * 1.75; // large soft halo
const GLOW_INNER_RADIUS_M = CAR_LENGTH_M * 0.38; // small bright core
const GLOW_OUTER_OPACITY  = 0.25;                // 0.2–0.3 soft outer
const GLOW_INNER_OPACITY  = 0.38;                // bright inner core
const GLOW_COLOR          = 0x00f3ff;

/** Canvas radial gradient for outer halo or bright inner core. */
function createVehicleGlowTexture(variant: "outer" | "inner"): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  if (variant === "outer") {
    grad.addColorStop(0,    "rgba(0, 243, 255, 0.55)");
    grad.addColorStop(0.35, "rgba(0, 243, 255, 0.28)");
    grad.addColorStop(0.7,  "rgba(0, 243, 255, 0.08)");
    grad.addColorStop(1,    "rgba(0, 243, 255, 0)");
  } else {
    grad.addColorStop(0,    "rgba(200, 255, 255, 0.95)");
    grad.addColorStop(0.4,  "rgba(0, 243, 255, 0.55)");
    grad.addColorStop(1,    "rgba(0, 243, 255, 0)");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function createVehicleGlowMesh(radius: number, variant: "outer" | "inner", renderOrder: number): THREE.Mesh {
  const baseOpacity = variant === "outer" ? GLOW_OUTER_OPACITY : GLOW_INNER_OPACITY;
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshBasicMaterial({
      map:         createVehicleGlowTexture(variant),
      color:       GLOW_COLOR,
      transparent: true,
      opacity:     baseOpacity,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  mesh.renderOrder = renderOrder;
  mesh.userData.isVehicleGlowPart = true;
  mesh.userData.glowVariant = variant;
  return mesh;
}

/** Dual-layer cyan glow — child of the vehicle render group, below the mesh. */
function createVehicleGlow(): {
  group:     THREE.Group;
  outerGlow: THREE.Mesh;
  innerGlow: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.userData.isVehicleGlow = true;
  const outerGlow = createVehicleGlowMesh(GLOW_OUTER_RADIUS_M, "outer", -2);
  const innerGlow = createVehicleGlowMesh(GLOW_INNER_RADIUS_M, "inner", -1);
  group.add(outerGlow, innerGlow);
  return { group, outerGlow, innerGlow };
}

class CarLayer {
  readonly id            = "user-car-3d";
  readonly type          = "custom" as const;
  readonly renderingMode = "3d"     as const;

  private _map!:          mapboxgl.Map;
  private renderer!:      THREE.WebGLRenderer;
  private scene!:         THREE.Scene;
  private camera!:        THREE.Camera;
  private carGroup!:           THREE.Group;
  private carContentGroup!:    THREE.Group;
  private carModelGroup!:      THREE.Group;
  private vehicleGlowGroup!:   THREE.Group;
  private vehicleOuterGlow!:   THREE.Mesh;
  private vehicleInnerGlow!:   THREE.Mesh;
  private smoothHeading = 0;
  private glowPulsePhase  = 0;
  private currentCarId:   string;

  private readonly cars:       VehicleDefinition[];
  private readonly userLocationRef: { current: UserLocation };
  private _lastOpacity = -1;
  private _displayOpacity = 0;

  constructor(
    initialCarId: string,
    cars:         VehicleDefinition[],
    userLocationRef: { current: UserLocation },
  ) {
    this.currentCarId = initialCarId;
    this.cars         = cars;
    this.userLocationRef = userLocationRef;
  }

  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
    this._map = map;

    // Share Mapbox's WebGL context — autoClear must be false
    this.renderer = new THREE.WebGLRenderer({
      canvas:    map.getCanvas() as HTMLCanvasElement,
      context:   gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear        = false;
    this.renderer.shadowMap.enabled = false;

    this.scene  = new THREE.Scene();
    this.camera = new THREE.Camera();

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 2.8);
    sun.position.set(100, 80, 60);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6688ff, 0.9);
    fill.position.set(-80, 60, -60);
    this.scene.add(fill);

    this.carGroup = new THREE.Group();
    this.carContentGroup = new THREE.Group();
    this.carModelGroup   = new THREE.Group();
    const glow = createVehicleGlow();
    this.vehicleGlowGroup = glow.group;
    this.vehicleOuterGlow = glow.outerGlow;
    this.vehicleInnerGlow = glow.innerGlow;
    // Glow lives inside the vehicle render group — moves/rotates with the body.
    this.carContentGroup.add(this.vehicleGlowGroup);
    this.carContentGroup.add(this.carModelGroup);
    this.carGroup.add(this.carContentGroup);
    this.scene.add(this.carGroup);

    this.loadCar(this.currentCarId);
  }

  private getCar(id: string): VehicleDefinition {
    return this.cars.find(c => c.id === id) ?? this.cars[0];
  }

  loadCar(carId: string) {
    this.currentCarId = carId;
    const car         = this.getCar(carId);
    const loader      = new GLTFLoader();

    loader.load(
      car.modelPath,
      (gltf) => {
        this.carModelGroup.clear();
        const model = gltf.scene;
        normalizeVehicleModel(model);
        this.carModelGroup.add(model);
        this._alignGlowToVehicle();
        this._map.triggerRepaint();
      },
      undefined,
      () => {
        // .glb not found → procedural fallback (always available)
        this.carModelGroup.clear();
        const model = createProceduralCar(car.id, car.color);
        normalizeVehicleModel(model);
        this.carModelGroup.add(model);
        this._alignGlowToVehicle();
        this._map.triggerRepaint();
      },
    );
  }

  swapCar(carId: string) {
    if (carId !== this.currentCarId) this.loadCar(carId);
  }

  /** Centre glow under the vehicle mesh bbox (XZ). */
  private _alignGlowToVehicle() {
    const box = new THREE.Box3().setFromObject(this.carModelGroup);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    this.vehicleGlowGroup.position.set(center.x, 0, center.z);
  }

  /** Subtle pulse on glow opacity and outer radius. */
  private _updateGlowPulse(zoomOpacity: number) {
    this.glowPulsePhase += 0.04;
    const pulse = 0.88 + 0.12 * Math.sin(this.glowPulsePhase);

    const outerMat = this.vehicleOuterGlow.material as THREE.MeshBasicMaterial;
    const innerMat = this.vehicleInnerGlow.material as THREE.MeshBasicMaterial;

    outerMat.opacity = zoomOpacity * GLOW_OUTER_OPACITY * pulse;
    innerMat.opacity = zoomOpacity * GLOW_INNER_OPACITY * (0.92 + 0.08 * pulse);

    const outerScale = 0.96 + 0.04 * pulse;
    this.vehicleOuterGlow.scale.set(outerScale, outerScale, 1);
    this.vehicleInnerGlow.scale.set(0.94 + 0.06 * pulse, 0.94 + 0.06 * pulse, 1);
  }

  // Avatars fade 13→15; 3D vehicle crossfades in (same band).
  private _getZoomOpacity(zoom: number): number {
    return getVehicleLayerOpacity(zoom);
  }

  render(_gl: WebGLRenderingContext, matrix: number[]) {
    const location = this.userLocationRef.current;
    const lat = location.latitude;
    const lng = location.longitude;
    const hasLocation =
      lat != null &&
      lng != null;
    const zoom    = this._map.getZoom();
    const target  = hasLocation ? this._getZoomOpacity(zoom) : 0;
    const lerp    = presenceDisplayLerpFactor();
    this._displayOpacity += (target - this._displayOpacity) * lerp;
    const opacity = this._displayOpacity;

    // Apply opacity to Three.js materials — guarded by delta check so we don't
    // traverse the entire mesh tree every frame when opacity is stable.
    if (Math.abs(opacity - this._lastOpacity) > 0.005) {
      this._lastOpacity = opacity;
      this.carGroup.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        if ((obj as THREE.Mesh).userData.isVehicleGlowPart) return;
        const mats = Array.isArray((obj as THREE.Mesh).material)
          ? ((obj as THREE.Mesh).material as THREE.Material[])
          : [(obj as THREE.Mesh).material as THREE.Material];
        mats.forEach((m) => { m.opacity = opacity; m.transparent = opacity < 1.0; });
      });
    }
    const glowVisible = opacity > 0;
    this.vehicleGlowGroup.visible = glowVisible;
    if (glowVisible) this._updateGlowPulse(opacity);

    // Avatar marker visible below crossfade — skip WebGL draw when fully faded.
    if (opacity <= 0.0 || lat == null || lng == null) return;

    // Smooth heading interpolation — Waze-style gradual turn
    const targetHeading = location.heading ?? this.smoothHeading;
    const dh          = ((targetHeading - this.smoothHeading + 540) % 360) - 180;
    this.smoothHeading = (this.smoothHeading + dh * 0.12 + 360) % 360;

    const mercator   = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
    const scale      = mercator.meterInMercatorCoordinateUnits() * CAR_MODEL_SCALE;

    const headingRad  = (this.smoothHeading * Math.PI) / 180;
    const modelMatrix = new THREE.Matrix4()
      .makeTranslation(mercator.x, mercator.y, mercator.z)
      .scale(new THREE.Vector3(scale, -scale, scale))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
      .multiply(new THREE.Matrix4().makeRotationY(headingRad));

    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(modelMatrix);

    this.renderer.resetState();

    // ── Depth-buffer clear ────────────────────────────────────────────────────
    // Mapbox has already written 3-D building geometry into the depth buffer.
    // resetState() re-enables depth testing, so without this clear the car
    // fragments that sit "inside" a building fail the depth test and are
    // discarded → car invisible behind tall buildings.
    //
    // Clearing ONLY the depth buffer (not colour) before Three.js renders means:
    //   • The car never gets clipped by building geometry (always visible).
    //   • Three.js still uses depth testing for the car's *own* geometry, so
    //     back-of-car remains behind front-of-car (self-occlusion is correct).
    //   • The car layer is last in the Mapbox stack, so no subsequent WebGL
    //     layers are harmed by the now-cleared depth values.
    //
    // This is the approach Mapbox's own custom-layer examples recommend for
    // user-location indicators that must always be on top.
    const gl = this.renderer.getContext() as WebGLRenderingContext;
    gl.clear(gl.DEPTH_BUFFER_BIT);

    this.renderer.render(this.scene, this.camera);
    this._map.triggerRepaint(); // continuous repaint drives smooth heading lerp
  }

  onRemove() {
    this.carGroup.clear();
    this.scene.clear();
    // Don't dispose the renderer — it shares Mapbox's GL context
  }
}

// ─── HTML marker helpers ──────────────────────────────────────────────────────

type MarkerOpts = {
  extraStyle?: Partial<CSSStyleDeclaration>;
};

function makeMarkerEl(
  html: string, role: MarkerRole, size = 36,
  opts: MarkerOpts = {},
): HTMLDivElement {
  const theme = MARKER_THEMES[role];
  const wrap  = document.createElement("div");
  wrap.className = "sg-marker-wrap";
  if (role === "sos") wrap.classList.add("sg-marker-wrap--sos");
  wrap.style.width  = `${size}px`;
  wrap.style.height = `${size}px`;
  wrap.style.setProperty("--marker-accent", theme.border);

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
  Object.assign(el.style, opts.extraStyle ?? {});
  el.innerHTML = html;
  wrap.appendChild(el);
  return wrap;
}

function makeSpotMarkerEl(spot: Spot, onClick: () => void): HTMLDivElement {
  const meta = RARITY_META[spot.rarity];
  const wrap   = document.createElement("div");
  wrap.className = "sg-rarity-marker sg-rarity-marker--spot sg-spot-float";
  tagMapMarkerLayer(wrap, MAP_MARKER_LAYER.poi);

  if (shouldShowRadarPulse(spot.rarity)) {
    for (const delay of ["", " sg-marker-ring__radar--delay sg-rarity-ring__radar--delay"]) {
      const ring = document.createElement("span");
      ring.className = `sg-marker-ring__radar sg-rarity-ring__radar${delay}`;
      ring.style.setProperty("--rarity-border", meta.border);
      wrap.appendChild(ring);
    }
  }

  const core = document.createElement("button");
  core.type = "button";
  core.className = getMarkerRingClasses(spot.rarity, { variant: "spot" }).join(" ");
  applyRarityRingVars(core, spot.rarity);
  core.textContent = spot.icon;
  core.title = spot.name;
  core.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
  wrap.appendChild(core);

  return wrap;
}

function userToMarkerProps(u: UserProfile): PlayerMarkerProps {
  return {
    avatar: getPlayerAvatarUrl(u),
    nickname: u.handle,
    level: u.level,
    rarity: u.rarity,
    vehicleColor: getVehicleColorForSeed(u.id),
    isOnline: u.status !== "offline",
    isCurrentUser: false,
  };
}

function selfToMarkerProps(
  handle: string,
  rarity: UserProfile["rarity"],
  level: number,
  vehicleColor: string,
): PlayerMarkerProps {
  return {
    avatar: getPlayerAvatarUrl({ id: "me", handle }),
    nickname: handle,
    level,
    rarity,
    vehicleColor,
    isOnline: true,
    isCurrentUser: true,
  };
}

function makeClusterEl(count: number): HTMLDivElement {
  const size = count < 5 ? 44 : count < 20 ? 52 : 60;
  const el   = document.createElement("div");
  el.className = "sg-cluster-marker sg-cluster-live";
  el.style.width  = `${size}px`;
  el.style.height = `${size}px`;
  el.textContent  = String(count);
  return el;
}

// ─── Nav mode ─────────────────────────────────────────────────────────────────
// Controls how the GPS recenter button behaves. Cycles FREE → FOLLOW → DRIVE.
// FREE  — user owns the camera; GPS does not interfere
// FOLLOW — camera centres on car each tick; pitch & bearing freely adjustable
// DRIVE  — full Waze: pitch 65, bearing = heading, car in lower third (WAZE_PADDING)
// NavMode type + cycle live in @/lib/streetgrid/navMode

// ─── Component ────────────────────────────────────────────────────────────────

export function MapView({ city, onOpenGarage, focusSpot, routeRequest }: Props) {
  const { settings, pushChat, selectedCarId, profile, vehicleProgress, recordSpotVisit, recordEvent } = useStreetGrid();

  const containerRef         = useRef<HTMLDivElement>(null);
  const mapRef               = useRef<mapboxgl.Map | null>(null);
  const wazePaddingRef       = useRef<MapPadding>({ top: 0, bottom: 0, left: 0, right: 0 });
  const cameraRef            = useRef(new MapCameraController());
  const featureMarkersRef    = useRef<mapboxgl.Marker[]>([]);
  const playerMarkersRef     = useRef<MountedPlayerMarker[]>([]);
  const playerRenderCleanupRef  = useRef<(() => void) | null>(null);
  const selfMarkerRef        = useRef<MountedPlayerMarker | null>(null);
  const spotMarkersRef       = useRef<Record<string, mapboxgl.Marker>>({});
  const botMarkersRef        = useRef<MountedPlayerMarker[]>([]);
  const sosMarkersRef        = useRef<mapboxgl.Marker[]>([]);
  const spotRenderCleanupRef = useRef<(() => void) | null>(null);
  // 3D car layer — created in map.on('load'), swapped on garage selection
  const carLayerRef          = useRef<CarLayer | null>(null);
  const userLocationRef = useRef<UserLocation>({ ...IDLE_USER_LOCATION });
  const hasInitializedCityCameraRef = useRef(false);
  // Heading tracking — kept in refs to avoid stale closures
  const headingRef           = useRef<number>(0);

  const [ready,         setReady]         = useState(false);
  const [sosOpen,       setSosOpen]       = useState(false);
  const [addOpen,       setAddOpen]       = useState(false);
  const [signals,       setSignals]       = useState<SosSignal[]>([]);
  const [userSpots,     setUserSpots]     = useState<Spot[]>([]);
  const [selectedSpot,  setSelectedSpot]  = useState<Spot | null>(null);
  const onSpotSelectRef = useRef<(s: Spot) => void>(() => {});
  onSpotSelectRef.current = (s) => setSelectedSpot(s);
  const [activeRoute,   setActiveRoute]   = useState<ActiveRoute | null>(null);
  const [routePhase,    setRoutePhase]    = useState<RoutePhase | null>(null);
  const [layers,        setLayers]        = useState({ users: true, spots: true, meets: true });
  const [bots,          setBots]          = useState<Bot[]>([]);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<UserProfile | null>(null);
  const [playerToast,    setPlayerToast]    = useState<string | null>(null);
  const [userLocation, setUserLocation] =
    useState<UserLocation>({ ...IDLE_USER_LOCATION });
  const [demoRoadPositions, setDemoRoadPositions] =
    useState<Record<string, AppCoordinate>>({});
  const commitUserLocation = useCallback((next: UserLocation) => {
    userLocationRef.current = next;
    setUserLocation(next);
  }, []);
  // Set to true around programmatic easeTo/flyTo so gesture listeners don't
  // accidentally flip navMode to FREE during our own animations.
  const isProgrammaticRef = useRef(false);
  const onOpenGarageRef = useRef(onOpenGarage);
  onOpenGarageRef.current = onOpenGarage;
  const onPlayerTapRef = useRef<(user: UserProfile) => void>(() => {});
  onPlayerTapRef.current = (user) => {
    setSelectedPlayer(user);
    setNavMode("FREE");
  };

  // Navigation mode — single source of truth for all GPS camera behavior.
  // FREE   — GPS updates BMW position; camera stays where the user left it
  // FOLLOW — camera recentres on car each GPS tick; pitch/bearing user-controlled
  // DRIVE  — full Waze: pitch 65, heading bearing, zoom 18, car in lower third
  const [navMode, setNavMode] = useState<NavMode>("FREE");
  // Ref mirror lets mount-only closures (zoom / gesture event handlers) always
  // read the latest navMode without stale-closure issues.
  const navModeRef = useRef<NavMode>("FREE");
  useEffect(() => {
    navModeRef.current = navMode;
  }, [navMode]);

  // Whether 3D building fill-extrusion layers are visible.
  const [showBuildings, setShowBuildings] = useState(true);

  const syncMapPadding = useCallback(() => {
    const map = mapRef.current;
    const camera = cameraRef.current;
    if (!map) return wazePaddingRef.current;
    const next = camera.syncPadding({
      searchOpen,
      playerSheetOpen: selectedPlayer != null,
      routeBanner: activeRoute != null,
      navMode,
    });
    wazePaddingRef.current = next;
    return next;
  }, [searchOpen, selectedPlayer, activeRoute, navMode]);
  const syncMapPaddingRef = useRef(syncMapPadding);
  syncMapPaddingRef.current = syncMapPadding;

  const cityObj      = getCity(city);
  const allSpots     = [...SPOTS, ...userSpots];
  const visibleSpots = city === "all" ? allSpots : allSpots.filter((s) => s.city === city);
  const visibleMeets = city === "all" ? MEETS : MEETS.filter((m) => m.city === city);
  // ── Garage selection → swap 3D model ─────────────────────────────────────────
  useEffect(() => {
    carLayerRef.current?.swapCar(selectedCarId);
  }, [selectedCarId, ready]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      syncMapPadding();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncMapPadding, ready]);

  // ── Init map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container:          containerRef.current,
      style:              "mapbox://styles/mapbox/dark-v11",
      // Map-first: always start at Tallinn overview regardless of GPS state.
      // GPS arrival will flyTo the user's real position via the reactive effect.
      center:             [24.7536, 59.437],
      zoom:               12,
      pitch:              45,
      bearing:            0,
      antialias:          true,
      attributionControl: false,
      // Mouse-wheel zoom always centres on the map centre, not the cursor
      scrollZoom:         { around: "center" },
    });

    map.on("load", () => {
      cameraRef.current.attach(map);
      cameraRef.current.onProgrammatic = (v) => {
        isProgrammaticRef.current = v;
      };

      // Map framing — dynamic safe-area padding (mapCamera.ts)
      syncMapPadding();
      // Wrapped in try/catch so an absent file or unsupported API never crashes the map.
      // The Three.js CarLayer below loads the same path independently via GLTFLoader.
      try {
        (map as any).addModel("user-car-model-g80", "/models/low_poly_bmw_g80_m3.glb");
      } catch {
        // addModel not available in this Mapbox version, or file not found — safe to ignore
      }

      // Pre-register the GLB asset with Mapbox's native model system (GL JS ≥ 3.0).
      map.setFog({
        color:          "rgb(10, 12, 20)",
        "high-color":   "rgb(22, 26, 40)",
        "horizon-blend": 0.04,
        "space-color":  "rgb(6, 8, 14)",
        "star-intensity": 0,
        range:          [0.8, 12],
      });

      // Re-enforce pitch if user pinch-zooms it away
      map.on("pitchend", () => {
        if (navModeRef.current === "DRIVE" && !isProgrammaticRef.current) {
          cameraRef.current.ensurePitch(WAZE_PITCH);
        }
      });

      // 3-D buildings
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
      } catch { /* style not yet fully loaded */ }

      // Label visibility
      const FORCE_VISIBLE = ["road-label", "settlement-label", "settlement-subdivision-label", "water-label"];
      map.getStyle().layers?.forEach((l) => {
        if (l.id.includes("poi")) {
          map.setLayoutProperty(l.id, "visibility", "none");
        } else if (FORCE_VISIBLE.some((k) => l.id.includes(k))) {
          map.setLayoutProperty(l.id, "visibility", "visible");
        }
      });

      // Route source + layers
      map.addSource("sg-route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "sg-route-glow", type: "line", source: "sg-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ROUTE_GLOW, "line-width": 18, "line-opacity": 0.4, "line-blur": 6 },
      });
      map.addLayer({
        id: "sg-route-line", type: "line", source: "sg-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color":             ROUTE_LINE,
          "line-width":             6,
          "line-opacity":           1,
          // Makes the line self-illuminate in dark style + respect 3-D perspective at high pitch
          "line-emissive-strength": 1.0,
        } as any,
      });

      // Spot clustering source
      map.addSource("spots", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true, clusterMaxZoom: 14, clusterRadius: 50,
      });

      map.addSource("players", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        // Individual HTML player markers — no Mapbox player clustering.
        cluster: false,
      });

      // ── 3D car layer (Three.js custom layer) ───────────────────────────────
      const layer = new CarLayer(
        VEHICLE_CATALOG[0].id,
        VEHICLE_CATALOG,
        userLocationRef,
      );
      carLayerRef.current = layer;
      map.addLayer(layer as unknown as mapboxgl.CustomLayerInterface);

      setReady(true);
    });

    // ── Gesture listeners ──────────────────────────────────────────────────────
    // Drag / pitch / rotate hand camera ownership to the user (EXPLORING).
    // Zoom is excluded: pinch-zoom changes the zoom level while the zoom
    // listener below keeps the centre locked on the car during FOLLOW mode.
    // isProgrammaticRef prevents our own easeTo/flyTo calls from firing these.
    // Any user-initiated drag, pitch, or rotate → hand camera back to FREE.
    // isProgrammaticRef prevents our own animations from triggering this.
    const onUserGesture = () => {
      if (!isProgrammaticRef.current) {
        navModeRef.current = "FREE";
        setNavMode("FREE");
      }
    };
    map.on("dragstart",   onUserGesture);
    map.on("pitchstart",  onUserGesture);
    map.on("rotatestart", onUserGesture);
    map.on("zoomstart",   onUserGesture);

    map.touchPitch.enable();
    mapRef.current = map;

    return () => {
      cameraRef.current.detach();
      map.remove();
      mapRef.current    = null;
      carLayerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep one browser geolocation subscription alive for the MapView lifetime.
  // GPS updates move YOU/BMW only; camera movement remains an explicit action.
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, heading } = position.coords;
        const fix: UserLocationFix = {
          latitude,
          longitude,
          accuracy,
          heading: heading != null && Number.isFinite(heading) ? heading : null,
          timestamp: position.timestamp,
        };
        if (!validateLocationFix(fix)) return;

        const next: UserLocation = {
          ...fix,
          heading: fix.heading ?? userLocationRef.current.heading,
          status: "active",
        };
        if (next.heading != null) headingRef.current = next.heading;
        commitUserLocation(next);
        mapRef.current?.triggerRepaint();
      },
      () => {
        // Keep the watcher alive after transient errors, including TIMEOUT.
        // The last accepted user location remains unchanged.
      },
      {
        enableHighAccuracy: true,
        timeout: 5_000,
        maximumAge: 400,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [commitUserLocation]);

  useEffect(() => {
    if (!ready) return;
    syncMapPadding();
  }, [ready, syncMapPadding]);

  // ── Fly to city on chip tap ───────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (!hasInitializedCityCameraRef.current) {
      hasInitializedCityCameraRef.current = true;
      return;
    }
    const target = CITY_COORDS[city];
    navModeRef.current = "FREE";
    setNavMode("FREE");
    syncMapPaddingRef.current();
    cameraRef.current.flyTo({
      center: target.center,
      zoom: target.zoom,
      pitch: city === "all" ? 0 : 45,
      bearing: 0,
    });
  }, [city, ready]);

  // ── Buildings visibility ──────────────────────────────────────────────────────
  // Toggles all fill-extrusion (3D building) layers in the Mapbox style.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const visibility = showBuildings ? "visible" : "none";
    try {
      map.getStyle().layers.forEach((layer) => {
        if (layer.type === "fill-extrusion" || layer.id.toLowerCase().includes("building")) {
          map.setLayoutProperty(layer.id, "visibility", visibility);
        }
      });
    } catch {
      // Style may not be ready on very first render — change will be applied on
      // the next ready transition.
    }
  }, [showBuildings, ready]);

  // ── Road-aware demo population ────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) {
      setDemoRoadPositions({});
      return;
    }

    const controller = new AbortController();
    const userAssignments = assignDemoPlayersToCities(
      getOnlinePlayersForMap().map((user) => user.id),
    );
    const botAssignments = Object.entries(DEMO_BOT_CITIES).map(([id, botCity]) => ({
      id,
      city: botCity,
    }));
    const assignments = [
      ...userAssignments,
      ...botAssignments,
    ];

    void buildRoadAwareDemoPositions(assignments, controller.signal)
      .then((positions) => {
        if (controller.signal.aborted) return;
        setDemoRoadPositions(positions);
        if (import.meta.env.DEV) {
          console.info(
            `[StreetGrid roads] ${Object.keys(positions).length} deterministic multi-city demo positions loaded from OSRM driving geometry.`,
          );
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setDemoRoadPositions({});
        console.error(
          "[StreetGrid roads] Demo players hidden because drivable road geometry could not be loaded.",
          error,
        );
      });

    return () => controller.abort();
  }, [ready]);

  // ── Bots simulation ───────────────────────────────────────────────────────────
  useEffect(() => {
    const required = ["b1", "b2", "b3"] as const;
    if (required.some((id) => !demoRoadPositions[id])) {
      setBots([]);
      return;
    }

    const init: Bot[] = [
      { id: "b1", name: "Никита", car: "BMW M4", emoji: "🏎️", city: DEMO_BOT_CITIES.b1, coords: demoRoadPositions.b1 },
      { id: "b2", name: "Артур", car: "Toyota Supra", emoji: "🚗", city: DEMO_BOT_CITIES.b2, coords: demoRoadPositions.b2 },
      { id: "b3", name: "Кристи", car: "Subaru WRX", emoji: "🚙", city: DEMO_BOT_CITIES.b3, coords: demoRoadPositions.b3 },
    ];
    setBots(init);

    const patrolTick = setInterval(() => {
      setBots((prev) => {
        if (prev.some((b) => b.patrol)) return prev.filter((b) => !b.patrol);
        const patrolPosition = demoRoadPositions.patrol;
        if (!patrolPosition) return prev;
        return [...prev, {
          id: "patrol", name: "Патруль", car: "Politsei", emoji: "🚓", patrol: true,
          city: DEMO_BOT_CITIES.patrol,
          coords: patrolPosition,
        }];
      });
    }, 15000);
    return () => clearInterval(patrolTick);
  }, [demoRoadPositions]);

  // ── Route drawing ─────────────────────────────────────────────────────────────
  const setRouteGeoJson = useCallback((geometry: GeoJSON.LineString | null) => {
    (mapRef.current?.getSource("sg-route") as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: geometry ? [{ type: "Feature", properties: {}, geometry }] : [],
    });
  }, []);

  const fitRouteBounds = useCallback((coords: [number, number][]) => {
    if (coords.length < 2) return;
    setNavMode("FREE");
    const map = mapRef.current;
    if (!map) return;
    syncMapPadding();
    const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
    cameraRef.current.fitBounds(bounds, {
      pitch: ROUTE_PREVIEW_PITCH,
      bearing: 0,
    });
  }, [syncMapPadding]);

  const runRouteTo = useCallback(async (dest: [number, number], name: string) => {
    // Routing starts from raw browser GPS; never from a demo/default position.
    const rawOrigin = getValidLocationFix(userLocationRef.current);
    if (!rawOrigin) {
      setPlayerToast("Нужна GPS-позиция, чтобы начать маршрут");
      window.setTimeout(() => setPlayerToast(null), 2400);
      return;
    }
    const [oLng, oLat] = toLngLat([rawOrigin.latitude, rawOrigin.longitude]);
    const [dLng, dLat] = toLngLat(dest);
    try {
      const url  = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
      const json = await fetch(url).then((r) => r.json());
      const route = json?.routes?.[0];
      if (!route) throw new Error("no route");
      setRouteGeoJson(route.geometry);
      setNavMode("FREE");
      setRoutePhase("preview");
      fitRouteBounds(route.geometry.coordinates);
      setActiveRoute({ name, distanceKm: route.distance / 1000, durationMin: route.duration / 60 });
    } catch {
      const geo: GeoJSON.LineString = { type: "LineString", coordinates: [[oLng, oLat], [dLng, dLat]] };
      setRouteGeoJson(geo);
      setNavMode("FREE");
      setRoutePhase("preview");
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
    setRoutePhase(null);
  }, [setRouteGeoJson]);
  const triggerRoute = useCallback((c: [number, number], n: string) => runRouteTo(c, n), [runRouteTo]);

  const showPlayerToast = useCallback((msg: string) => {
    setPlayerToast(msg);
    window.setTimeout(() => setPlayerToast(null), 2400);
  }, []);

  const validUserLocation = getValidLocationFix(userLocation);
  const myLocation = validUserLocation
    ? [validUserLocation.latitude, validUserLocation.longitude] as AppCoordinate
    : null;
  const hasUserDisplayPosition = validUserLocation != null;

  const selectedPlayerDistance = selectedPlayer && myLocation
    ? distKm(myLocation, selectedPlayer.location)
    : null;
  // ── Live players: mount once, compact/avatar on zoom, positions on pan ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const source = map.getSource("players") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    playerRenderCleanupRef.current?.();
    playerRenderCleanupRef.current = null;

    const onlineUsers = getOnlinePlayersForMap().flatMap((user) => {
      const roadPosition = demoRoadPositions[user.id];
      return roadPosition ? [{ ...user, location: roadPosition }] : [];
    });

    source.setData(
      layers.users ? playersToGeoJson(onlineUsers) : { type: "FeatureCollection", features: [] },
    );

    const clearPlayerMarkers = () => {
      unmountAllPlayerMarkers(playerMarkersRef.current);
      playerMarkersRef.current = [];
    };

    if (!layers.users) {
      clearPlayerMarkers();
      return;
    }

    const applyPresenceOpacities = () => {
      const zoom = map.getZoom();
      applyPlayerPresenceOpacity(playerMarkersRef.current, zoom);
      syncMountedPlayerMarkerViewport(map, playerMarkersRef.current);
      for (const entry of playerMarkersRef.current) {
        applyPlayerMarkerZIndex(entry.marker, false);
      }
      if (selfMarkerRef.current) {
        applyPlayerMarkerZIndex(selfMarkerRef.current.marker, true);
      }
    };

    /** Mount every online player once — positions update on pan; never unmount on zoom. */
    const syncAvatarMarkers = () => {
      const zoom = map.getZoom();
      const byUserId = new Map(
        playerMarkersRef.current
          .filter((e) => e.userId)
          .map((e) => [e.userId!, e] as const),
      );

      for (const user of onlineUsers) {
        const coords = toLngLat(user.location);
        const existing = byUserId.get(user.id);
        if (existing) {
          existing.marker.setLngLat(coords);
          updatePlayerMarkerProps(existing, userToMarkerProps(user), zoom);
          byUserId.delete(user.id);
          continue;
        }
        playerMarkersRef.current.push(
          mountPlayerMarker(
            map,
            coords,
            userToMarkerProps(user),
            { userId: user.id, onTap: () => onPlayerTapRef.current(user) },
          ),
        );
      }

      for (const stale of byUserId.values()) {
        unmountPlayerMarker(stale);
        playerMarkersRef.current = playerMarkersRef.current.filter((e) => e !== stale);
      }
    };

    levelBadgeGate.reset(map.getZoom());

    const onZoom = () => {
      applyPresenceOpacities();
    };

    let lastPanCenter = map.getCenter();

    const onMoveEnd = () => {
      const center = map.getCenter();
      const panChanged =
        Math.abs(center.lng - lastPanCenter.lng) > 1e-5 ||
        Math.abs(center.lat - lastPanCenter.lat) > 1e-5;
      if (panChanged) {
        lastPanCenter = center;
        syncAvatarMarkers();
      }
      applyPresenceOpacities();
    };

    syncAvatarMarkers();
    applyPresenceOpacities();
    syncMountedPlayerMarkerViewport(map, playerMarkersRef.current);

    map.on("moveend", onMoveEnd);
    map.on("zoom", onZoom);

    playerRenderCleanupRef.current = () => {
      map.off("moveend", onMoveEnd);
      map.off("zoom", onZoom);
      resetSharedPlayerMarkerAppearanceController();
      clearPlayerMarkers();
    };

    return () => playerRenderCleanupRef.current?.();
  }, [layers.users, ready, city, demoRoadPositions]);

  // ── Current user marker — mount once after a real GPS fix, then move in place ─
  useEffect(() => {
    const map = mapRef.current;
    const fix = getValidLocationFix(userLocationRef.current);
    if (!map || !ready || !fix || selfMarkerRef.current) {
      return;
    }

    const props = selfToMarkerProps(
      profile.handle,
      profile.rarity,
      getPlayerLevel(vehicleProgress),
      getVehicleById(selectedCarId)?.color ?? getVehicleColorForSeed("me"),
    );
    selfMarkerRef.current = mountPlayerMarker(
      map,
      [fix.longitude, fix.latitude],
      props,
    );
    applyPlayerMarkerZIndex(selfMarkerRef.current.marker, true);

    const onZoom = () => {
      if (!selfMarkerRef.current) return;
      applyPlayerPresenceOpacity([selfMarkerRef.current], map.getZoom());
    };
    map.on("zoom", onZoom);
    onZoom();

    return () => {
      map.off("zoom", onZoom);
      if (selfMarkerRef.current) {
        unmountPlayerMarker(selfMarkerRef.current);
        selfMarkerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- marker props update below
  }, [ready, hasUserDisplayPosition]);

  useEffect(() => {
    const map = mapRef.current;
    const entry = selfMarkerRef.current;
    const fix = getValidLocationFix(userLocation);
    if (!map || !ready || !entry || !fix) {
      return;
    }

    entry.marker.setLngLat([fix.longitude, fix.latitude]);
    applyPlayerMarkerZIndex(entry.marker, true);
    updatePlayerMarkerProps(
      entry,
      selfToMarkerProps(
        profile.handle,
        profile.rarity,
        getPlayerLevel(vehicleProgress),
        getVehicleById(selectedCarId)?.color ?? getVehicleColorForSeed("me"),
      ),
      map.getZoom(),
    );
  }, [ready, profile.handle, profile.rarity, vehicleProgress, selectedCarId, userLocation]);

  // ── Feature markers (meets) ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    featureMarkersRef.current.forEach((m) => m.remove());
    featureMarkersRef.current = [];

    // Meets
    if (layers.meets) {
      visibleMeets.forEach((mt) => {
        const popup = new mapboxgl.Popup({ offset: 22 }).setHTML(
          `<b>${mt.title}</b><br/>${mt.time}<br/>📍 ${mt.location}<br/>👥 ${mt.going} едут${routeBtnHtml(`meet-${mt.id}`)}`,
        );
        popup.on("open", () => setTimeout(() => {
          document.querySelector<HTMLButtonElement>(`button[data-route="meet-${mt.id}"]`)
            ?.addEventListener("click", () => {
              recordEvent();
              triggerRoute(mt.coords, mt.title);
            });
        }, 0));
        const m = new mapboxgl.Marker({ element: makeMarkerEl(mt.cover, "party") })
          .setLngLat(toLngLat(mt.coords)).setPopup(popup).addTo(map);
        featureMarkersRef.current.push(m);
      });
    }
  }, [layers.meets, ready, city, visibleMeets.length, triggerRoute, recordEvent]);

  // ── Spots: GeoJSON clustering + dynamic HTML markers ─────────────────────────
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
          tagMapMarkerLayer(el, MAP_MARKER_LAYER.poi);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom == null) return;
              setNavMode("FREE");
              syncMapPadding();
              const currentZoom = map.getZoom();
              const targetZoom = Math.min(zoom + 0.35, currentZoom + 0.65);
              cameraRef.current.easeTo({
                center: coords,
                zoom: targetZoom,
              });
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

        const el = makeSpotMarkerEl(spot, () => onSpotSelectRef.current(spot));
        spotMarkersRef.current[id] = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(coords)
          .addTo(map);
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

  // ── Bot markers (avatar identity markers) ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    unmountAllPlayerMarkers(botMarkersRef.current);
    botMarkersRef.current = [];

    if (!layers.users || !settings.showBots) return;

    const zoom = map.getZoom();
    bots.forEach((b) => {
      if (b.patrol && !settings.showPatrols) return;
      const popup = new mapboxgl.Popup({ offset: 24, className: "sg-player-popup-wrap" })
        .setHTML(
          `<b>${b.name}</b><br/>${b.car}${b.patrol ? '<br/><i style="color:#ff3b30">⚠ Патруль рядом</i>' : ""}`,
        );
      const entry = mountPlayerMarker(
        map,
        toLngLat(b.coords),
        {
          avatar: getPlayerAvatarUrl({ id: b.id, handle: b.name }),
          nickname: `@${b.name.toLowerCase().replace(/\s+/g, "_")}`,
          level: b.patrol ? 1 : 3,
          rarity: b.patrol ? "rare" : "common",
          vehicleColor: getVehicleColorForSeed(b.id),
          isOnline: true,
          isCurrentUser: false,
        },
        { popup },
      );
      botMarkersRef.current.push(entry);
    });
    updatePlayerMarkersZoom(botMarkersRef.current, zoom);
    syncMountedPlayerMarkerViewport(map, botMarkersRef.current);

    const onZoom = () => {
      applyPlayerPresenceOpacity(botMarkersRef.current, map.getZoom());
      syncMountedPlayerMarkerViewport(map, botMarkersRef.current);
    };
    map.on("zoom", onZoom);
    map.on("moveend", onZoom);

    return () => {
      map.off("zoom", onZoom);
      map.off("moveend", onZoom);
      unmountAllPlayerMarkers(botMarkersRef.current);
      botMarkersRef.current = [];
    };
  }, [bots, layers.users, settings.showBots, settings.showPatrols, ready]);

  // ── SOS markers ───────────────────────────────────────────────────────────────
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

  // ── Focus spot ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!focusSpot || !ready) return;
    const target = [...SPOTS, ...userSpots].find((s) => s.id === focusSpot.id);
    if (!target) return;
    setNavMode("FREE");
    syncMapPadding();
    cameraRef.current.flyTo({
      center: toLngLat(target.coords),
      zoom: WAZE_ZOOM,
      pitch: WAZE_PITCH,
      bearing: headingRef.current,
    });
    setTimeout(() => setSelectedSpot(target), CAMERA_DURATION_MAX_MS);
  }, [focusSpot, ready, userSpots, syncMapPadding]);

  // ── External route request ─────────────────────────────────────────────────
  useEffect(() => {
    if (!routeRequest || !ready) return;
    runRouteTo(routeRequest.coords, routeRequest.name);
  }, [routeRequest, ready, runRouteTo]);

  // ── Current-location button ──────────────────────────────────────────────────
  const cycleNavMode = () => {
    const map = mapRef.current;
    if (!map) return;

    const centerOnLocation = (location: UserLocationFix) => {
      navModeRef.current = "FREE";
      setNavMode("FREE");
      cameraRef.current.syncPadding({ navMode: "FREE" });
      cameraRef.current.flyTo({
        center: [location.longitude, location.latitude],
        zoom: Math.min(18, Math.max(map.getZoom(), 16.5)),
        pitch: map.getPitch(),
        bearing: location.heading ?? map.getBearing(),
        force: true,
      });
    };

    const knownLocation = getValidLocationFix(userLocationRef.current);
    if (knownLocation) centerOnLocation(knownLocation);
  };

  // ── SOS submit ────────────────────────────────────────────────────────────────
  const handleSosSubmit = ({ preset, label, note, coords }: SosPayload) => {
    const time = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    const sig: SosSignal = {
      id: String(Date.now()), type: preset ?? "other", label,
      note: note || undefined, user: profile.handle, coords, time,
    };
    setSignals((s) => [...s, sig]);
    setNavMode("FREE");
    setTimeout(() => {
      if (!mapRef.current) return;
      syncMapPadding();
      cameraRef.current.flyTo({
        center: toLngLat(coords),
        zoom: WAZE_ZOOM,
        pitch: WAZE_PITCH,
        bearing: headingRef.current,
      });
    }, 100);
    const targetCity = city === "all" ? "tallinn" : city;
    pushChat({
      city: targetCity, user: profile.handle,
      text: `🆘 ${profile.handle} нужна помощь: ${label}${note && preset ? ` — ${note}` : ""} · [Посмотреть на карте]`,
      time, sos: true,
    });
    setSosOpen(false);
  };

  // ── Add spot ──────────────────────────────────────────────────────────────────
  const handleAddSpot = (data: { name: string; description: string }) => {
    const center = mapRef.current?.getCenter();
    const coords: [number, number] = center ? [center.lat, center.lng] : cityObj.coords;
    setUserSpots((s) => [...s, {
      id: `us_${Date.now()}`, city: city === "all" ? "tallinn" : city,
      name: data.name, description: data.description, rarity: "common", coords,
      icon: "📍",
      reward: { xp: 20, label: "Community Spot" },
      owner: profile.handle,
      participants: 1,
      userAdded: true,
    }]);
    setAddOpen(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="sg-map-wrap">
      <div ref={containerRef} className="sg-map" />

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
          <div className="flex shrink-0 items-center gap-1.5">
            {routePhase === "preview" && (
              <button
                type="button"
                onClick={() => setRoutePhase("navigating")}
                className="rounded-xl bg-accent px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-accent-foreground hover:bg-accent/90 transition whitespace-nowrap"
              >
                ПОЕХАЛИ
              </button>
            )}
            <button
              onClick={clearRoute}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-bold tracking-wide text-foreground/80 hover:bg-primary/25 transition whitespace-nowrap"
            >
              Сбросить
            </button>
          </div>
        </div>
      )}

      {/* ── Top-right controls removed — map FABs limited to compass · SOS · add ── */}

      {/* ── Bottom-right action stack — compass · SOS ── */}
      <MapActionStack
        navMode={navMode}
        onNavClick={cycleNavMode}
        buildingsVisible={showBuildings}
        onBuildingsClick={() => setShowBuildings((visible) => !visible)}
        sosOpen={sosOpen}
        onSosClick={() => setSosOpen(true)}
      />

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Добавить спот"
        className="sg-map-fab sg-map-fab--add"
      >
        <Plus className="sg-map-fab__add-icon" strokeWidth={2.5} />
      </button>

      <div className="sg-map-search-track">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="sg-map-search"
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground flex-1 text-left">Куда едем?</span>
          <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold shrink-0 border border-accent/30">
            GO
          </span>
        </button>
      </div>

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
                {visibleSpots.slice(0, 6).map((spot) => {
                  const visual = getSpotRarityVisual(spot.rarity);
                  return (
                  <div key={spot.id} className="flex items-center gap-3 glass rounded-2xl px-3 py-2.5 mb-2 border border-white/5">
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => {
                        setSearchOpen(false);
                        setSelectedSpot(spot);
                        setNavMode("FREE");
                        syncMapPadding();
                        cameraRef.current.flyTo({
                          center: toLngLat(spot.coords),
                          zoom: WAZE_ZOOM,
                          pitch: WAZE_PITCH,
                          bearing: headingRef.current,
                        });
                      }}
                    >
                      <span className="text-xl shrink-0">{spot.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{spot.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span style={{ color: visual.color }}>{visual.label}</span>
                          {" · "}+{spot.reward.xp} XP
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setSearchOpen(false); triggerRoute(spot.coords, spot.name); }}
                      className="shrink-0 text-[10px] bg-accent/20 text-accent border border-accent/30 px-2.5 py-1 rounded-full font-bold hover:bg-accent/30 transition"
                    >GO</button>
                  </div>
                  );
                })}
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
                        setNavMode("FREE");
                        syncMapPadding();
                        cameraRef.current.flyTo({
                          center: toLngLat(mt.coords),
                          zoom: WAZE_ZOOM,
                          pitch: WAZE_PITCH,
                          bearing: headingRef.current,
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

      <SosModal open={sosOpen} fallbackCoords={myLocation ?? ME.location} onClose={() => setSosOpen(false)} onSubmit={handleSosSubmit} />
      <SpotDetailPanel
        spot={selectedSpot}
        onClose={() => setSelectedSpot(null)}
        onRoute={(coords, name) => {
          if (selectedSpot) recordSpotVisit(selectedSpot.id);
          setSelectedSpot(null);
          triggerRoute(coords, name);
        }}
      />

      <PlayerCardSheet
        user={selectedPlayer}
        distanceKm={selectedPlayerDistance}
        onClose={() => setSelectedPlayer(null)}
        onViewProfile={(userId) => {
          setSelectedPlayer(null);
          onOpenGarage(userId);
        }}
        onInvite={(user) => {
          pushChat({
            city: "tallinn",
            user: "SYSTEM",
            text: `Meetup invite sent to ${user.handle}`,
            time: "now",
          });
          showPlayerToast(`Meetup invite sent to ${user.handle}`);
        }}
        onRoute={(coords, name) => {
          setSelectedPlayer(null);
          triggerRoute(coords, name);
        }}
        onAddFriend={(user) => {
          pushChat({
            city: "tallinn",
            user: "SYSTEM",
            text: `${user.handle} added to friends`,
            time: "now",
          });
          showPlayerToast(`${user.handle} added to friends`);
          recordEvent();
        }}
      />

      {playerToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[900] px-4 py-2.5 rounded-full glass-strong border border-white/10 text-xs font-bold shadow-lg pointer-events-none animate-float-up">
          {playerToast}
        </div>
      )}

      <AddSpotModal open={addOpen} onClose={() => setAddOpen(false)} onSubmit={handleAddSpot} />
    </div>
  );
}
