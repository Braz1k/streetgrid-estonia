import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
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

// ─── Waze camera constants ─────────────────────────────────────────────────────
//
// pitch:60  zoom:16.5  padding.top:410  → car sits firmly in the lower third,
// road ahead fills the upper two-thirds — matches reference images exactly.
//
const WAZE_ZOOM    = 16.5;
const WAZE_PITCH   = 60;
const WAZE_PADDING = { top: 410, bottom: 0, left: 0, right: 0 } as const;

// ─── Garage cars ───────────────────────────────────────────────────────────────

type GarageCar = {
  id: string;
  emoji: string;
  name: string;
  shortName: string;
  description: string;
  color: string;
  modelPath: string; // path to .glb in /public; procedural fallback used if missing
};

const GARAGE_CARS: GarageCar[] = [
  {
    id: "bmw_m3", emoji: "🚗", name: "BMW M3 Competition", shortName: "BMW M3",
    description: "480 л.с. · Stage 2 Tune · KW V3", color: "#00aaff",
    modelPath: "/models/low_poly_bmw_g80_m3.glb",
  },
  {
    id: "tesla_neon", emoji: "⚡", name: "Tesla Neon X", shortName: "Tesla",
    description: "Электрогонщик · Silent Mode · 0–100 в 2.4 с", color: "#00ff88",
    modelPath: "/models/tesla_neon.glb",
  },
  {
    id: "retro_racer", emoji: "🏎️", name: "Retro Racer '69", shortName: "Ретро",
    description: "Muscle Car · 1969 · V8 Big Block", color: "#ffcc00",
    modelPath: "/models/retro_racer.glb",
  },
  {
    id: "hippie_van", emoji: "🚐", name: "Hippie Van", shortName: "Хиппи",
    description: "Peace & Love · Slow & Groovy", color: "#ff6600",
    modelPath: "/models/hippie_van.glb",
  },
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
class CarLayer {
  readonly id            = "user-car-3d";
  readonly type          = "custom" as const;
  readonly renderingMode = "3d"     as const;

  private _map!:          mapboxgl.Map;
  private renderer!:      THREE.WebGLRenderer;
  private scene!:         THREE.Scene;
  private camera!:        THREE.Camera;
  private carGroup!:      THREE.Group;
  private smoothHeading = 0;
  private currentCarId:   string;

  private readonly cars:       GarageCar[];
  private readonly posRef:     { current: [number, number] };
  private readonly headingRef: { current: number };
  private _lastOpacity = -1; // cached so material traversal only runs when opacity changes

  constructor(
    initialCarId: string,
    cars:         GarageCar[],
    posRef:       { current: [number, number] },
    headingRef:   { current: number },
  ) {
    this.currentCarId = initialCarId;
    this.cars         = cars;
    this.posRef       = posRef;
    this.headingRef   = headingRef;
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
    this.scene.add(this.carGroup);

    this.loadCar(this.currentCarId);
  }

  private getCar(id: string): GarageCar {
    return this.cars.find(c => c.id === id) ?? this.cars[0];
  }

  loadCar(carId: string) {
    this.currentCarId = carId;
    const car         = this.getCar(carId);
    const loader      = new GLTFLoader();

    loader.load(
      car.modelPath,
      (gltf) => {
        this.carGroup.clear();
        const model = gltf.scene;
        // Normalise GLTF model to ~4 m length
        const box  = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) model.scale.setScalar(4 / maxDim);
        this.carGroup.add(model);
        this._map.triggerRepaint();
      },
      undefined,
      () => {
        // .glb not found → procedural fallback (always available)
        this.carGroup.clear();
        this.carGroup.add(createProceduralCar(car.id, car.color));
        this._map.triggerRepaint();
      },
    );
  }

  swapCar(carId: string) {
    if (carId !== this.currentCarId) this.loadCar(carId);
  }

  // ── Zoom-adaptive helpers ─────────────────────────────────────────────────

  // Scale multiplier — mirrors the model-scale breakpoints the user sees.
  // At zoom 14 the model is 6× its normalised 4 m size (=24 m, very visible
  // on city overview); shrinks to real-car proportions by zoom 19.
  private _getZoomScale(zoom: number): number {
    if (zoom <= 14) return 6.0;
    if (zoom <= 16) return 6.0 + (zoom - 14) / 2 * (2.5 - 6.0); // lerp 6.0→2.5
    if (zoom <= 18) return 2.5 + (zoom - 16) / 2 * (0.8 - 2.5); // lerp 2.5→0.8
    if (zoom <= 19) return 0.8 + (zoom - 18) / 1 * (0.4 - 0.8); // lerp 0.8→0.4
    return 0.4;
  }

  // 3D model fades in zoom 14.8 → 15.2 (mirrors circle fade-out below).
  // Below 14.8: invisible — circle marker has full responsibility.
  // Above 15.2: fully opaque — circle has finished fading out.
  private _getZoomOpacity(zoom: number): number {
    if (zoom <= 14.8) return 0.0;
    if (zoom >= 15.2) return 1.0;
    return (zoom - 14.8) / 0.4; // linear 0→1 across the 0.4-zoom window
  }

  render(_gl: WebGLRenderingContext, matrix: number[]) {
    const zoom    = this._map.getZoom();
    const opacity = this._getZoomOpacity(zoom);

    // Apply opacity to Three.js materials — guarded by delta check so we don't
    // traverse the entire mesh tree every frame when opacity is stable.
    if (Math.abs(opacity - this._lastOpacity) > 0.005) {
      this._lastOpacity = opacity;
      this.carGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mats = Array.isArray((obj as THREE.Mesh).material)
            ? ((obj as THREE.Mesh).material as THREE.Material[])
            : [(obj as THREE.Mesh).material as THREE.Material];
          mats.forEach((m) => { m.opacity = opacity; m.transparent = opacity < 1.0; });
        }
      });
    }

    // Circle marker takes over below zoom 15 — skip WebGL draw entirely.
    if (opacity <= 0.0) return;

    // Smooth heading interpolation — Waze-style gradual turn
    const dh          = ((this.headingRef.current - this.smoothHeading + 540) % 360) - 180;
    this.smoothHeading = (this.smoothHeading + dh * 0.12 + 360) % 360;

    const [lat, lng] = this.posRef.current;
    const mercator   = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
    const rawS       = mercator.meterInMercatorCoordinateUnits();
    const s          = rawS * this._getZoomScale(zoom); // zoom-compensated scale

    const headingRad  = (this.smoothHeading * Math.PI) / 180;
    const modelMatrix = new THREE.Matrix4()
      .makeTranslation(mercator.x, mercator.y, mercator.z)
      .scale(new THREE.Vector3(s, -s, s))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
      .multiply(new THREE.Matrix4().makeRotationY(headingRad));

    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(modelMatrix);

    this.renderer.resetState();
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
  // 3D car layer — created in map.on('load'), swapped on garage selection
  const carLayerRef          = useRef<CarLayer | null>(null);
  // GPS position updated in watchPosition; read each frame by CarLayer.render
  const carPositionRef       = useRef<[number, number]>(ME.location);
  // Heading tracking — kept in refs to avoid stale closures
  const headingRef           = useRef<number>(0);
  const prevPosRef           = useRef<[number, number] | null>(null);

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
  // Follow mode — when true the camera locks onto the user's GPS position.
  // Gesture interactions (drag / zoom / pitch) flip this to false so the user
  // can freely explore the map. Tapping the crosshair button restores it.
  const [isFollowing, setIsFollowing] = useState(true);
  // Ref mirror so mount-only closures (watchPosition, map event handlers)
  // always read the latest value without stale-closure bugs.
  const isFollowingRef = useRef(true);

  const cityObj      = getCity(city);
  const allSpots     = [...SPOTS, ...userSpots];
  const visibleSpots = city === "all" ? allSpots : allSpots.filter((s) => s.city === city);
  const visibleMeets = city === "all" ? MEETS : MEETS.filter((m) => m.city === city);
  const selectedCar  = GARAGE_CARS.find((c) => c.id === selectedCarId) ?? GARAGE_CARS[0];

  // ── Garage selection → swap 3D model ─────────────────────────────────────────
  useEffect(() => {
    carLayerRef.current?.swapCar(selectedCarId);
  }, [selectedCarId, ready]);

  // ── Init map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container:          containerRef.current,
      style:              "mapbox://styles/mapbox/dark-v11",
      center:             toLngLat(ME.location),
      zoom:               WAZE_ZOOM,
      pitch:              WAZE_PITCH,
      bearing:            0,
      antialias:          true,
      attributionControl: false,
    });

    map.on("load", () => {
      // Pre-register the GLB asset with Mapbox's native model system (GL JS ≥ 3.0).
      // Wrapped in try/catch so an absent file or unsupported API never crashes the map.
      // The Three.js CarLayer below loads the same path independently via GLTFLoader.
      try {
        (map as any).addModel("user-car-model-g80", "/models/low_poly_bmw_g80_m3.glb");
      } catch {
        // addModel not available in this Mapbox version, or file not found — safe to ignore
      }

      // Waze camera padding — persists across all camera moves
      map.setPadding(WAZE_PADDING);

      // Re-enforce pitch if user pinch-zooms it away
      map.on("pitchend", () => {
        if (map.getPitch() < WAZE_PITCH - 5) {
          map.easeTo({ pitch: WAZE_PITCH, duration: 400 });
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
        paint: { "line-color": ROUTE_GLOW, "line-width": 14, "line-opacity": 0.35, "line-blur": 5 },
      });
      map.addLayer({
        id: "sg-route-line", type: "line", source: "sg-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ROUTE_LINE, "line-width": 5.5, "line-opacity": 1 },
      });

      // Spot clustering source
      map.addSource("spots", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true, clusterMaxZoom: 14, clusterRadius: 50,
      });

      // ── User position source + far-zoom circle marker ────────────────────────
      //
      // A lightweight GeoJSON Point source that is updated on every GPS fix
      // (see watchPosition below).  The circle layer is visible at zoom < 16
      // and fades out exactly as the 3D model fades in (zoom 15→16), so the
      // user is always visible whether they're zoomed out or in navigation mode.
      //
      map.addSource("user-position-source", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Point", coordinates: toLngLat(ME.location) },
          properties: {},
        },
      });

      map.addLayer({
        id:     "user-avatar-far-layer",
        type:   "circle",
        source: "user-position-source",
        paint: {
          "circle-radius":          14,
          "circle-color":           "#ff0055",
          "circle-stroke-width":    2,
          "circle-stroke-color":    "#ffffff",
          // Keep the dot upright in viewport space so it doesn't stretch at pitch
          "circle-pitch-alignment": "viewport",
          // Mirror the 3D model's fade-in: circle disappears zoom 14.8 → 15.2
          "circle-opacity": [
            "interpolate", ["linear"], ["zoom"],
            14.8, 1.0,
            15.2, 0.0,
          ] as any,
          "circle-stroke-opacity": [
            "interpolate", ["linear"], ["zoom"],
            14.8, 1.0,
            15.2, 0.0,
          ] as any,
        } as any,
      });

      // ── 3D car layer (Three.js custom layer) ───────────────────────────────
      const layer = new CarLayer(
        GARAGE_CARS[0].id, GARAGE_CARS, carPositionRef, headingRef,
      );
      carLayerRef.current = layer;
      map.addLayer(layer as unknown as mapboxgl.CustomLayerInterface);

      setReady(true);
    });

    // Detect user-initiated map movements (touch / mouse) via originalEvent.
    // Programmatic moves (easeTo / flyTo) have no originalEvent, so they won't
    // accidentally turn off follow mode.  Guard with the ref so setIsFollowing is
    // only called once per gesture, not on every animation frame.
    map.on("move", (e) => {
      if ((e as mapboxgl.MapMouseEvent).originalEvent && isFollowingRef.current) {
        isFollowingRef.current = false;
        setIsFollowing(false);
      }
    });

    map.touchPitch.enable();
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current    = null;
      carLayerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Geolocation: GPS position + heading → 3D layer + camera ──────────────────
  //
  // carPositionRef is read every frame by CarLayer.render (no React re-render needed).
  // headingRef drives smooth rotation inside the Three.js render loop.
  // easeTo follows the user with Waze bearing-lock; padding keeps the model
  // in the lower third at all times.
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

        // Update position ref — CarLayer.render reads this every frame
        carPositionRef.current = [latitude, longitude];

        // Keep the far-zoom circle marker in sync with GPS position
        (mapRef.current?.getSource("user-position-source") as mapboxgl.GeoJSONSource | undefined)
          ?.setData({ type: "Feature", geometry: { type: "Point", coordinates: [longitude, latitude] }, properties: {} });

        // Only update heading when we have a valid value
        if (h != null && !isNaN(h)) headingRef.current = h;

        // Follow camera only when the user has not manually panned/zoomed away.
        // isFollowingRef is written synchronously by gesture listeners and the
        // recenter button, so it is always up-to-date inside this closure.
        if (isFollowingRef.current) {
          mapRef.current?.easeTo({
            center:   [longitude, latitude],
            zoom:     WAZE_ZOOM,
            bearing:  headingRef.current,
            pitch:    WAZE_PITCH,
            padding:  WAZE_PADDING,
            duration: 1000,
          });
        }
      },
      () => { /* geolocation denied — position stays at ME.location */ },
      { enableHighAccuracy: true, maximumAge: 400 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []); // mount-only; live values via refs

  // ── Fly to city / Waze mode on tab switch ─────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    if (city === "tallinn" || city === "all") {
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

  // ── Bots simulation ───────────────────────────────────────────────────────────
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

  // ── Route drawing ─────────────────────────────────────────────────────────────
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

  // ── Feature markers (other users + meets) ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    featureMarkersRef.current.forEach((m) => m.remove());
    featureMarkersRef.current = [];

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
  }, [layers.users, layers.meets, ready, city, visibleMeets.length, onOpenGarage, profile.handle, triggerRoute]);

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

  // ── Bot markers ───────────────────────────────────────────────────────────────
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
    mapRef.current?.flyTo({
      center: toLngLat(target.coords), zoom: WAZE_ZOOM,
      pitch: WAZE_PITCH, bearing: headingRef.current,
      duration: 1600, essential: true,
    });
    setTimeout(() => {
      const m = spotMarkersRef.current[target.id];
      if (m && !m.getPopup()?.isOpen()) m.togglePopup();
    }, 1200);
  }, [focusSpot, ready, userSpots]);

  // ── External route request ─────────────────────────────────────────────────
  useEffect(() => {
    if (!routeRequest || !ready) return;
    runRouteTo(routeRequest.coords, routeRequest.name);
  }, [routeRequest, ready, runRouteTo]);

  // ── Recenter to Waze mode ─────────────────────────────────────────────────────
  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    // Re-enable camera follow BEFORE the flyTo so the next GPS tick also
    // stays locked. Write the ref synchronously; the state update schedules
    // a React re-render for the button visual.
    isFollowingRef.current = true;
    setIsFollowing(true);
    map.setPadding(WAZE_PADDING);
    // Fly to the live GPS position, not the static initial location
    const [lat, lng] = carPositionRef.current;
    map.flyTo({
      center:   [lng, lat],
      zoom:     WAZE_ZOOM,
      pitch:    WAZE_PITCH,
      bearing:  headingRef.current,
      duration: 1500,
      essential: true,
    });
  };

  // ── SOS submit ────────────────────────────────────────────────────────────────
  const handleSosSubmit = ({ preset, label, note, coords }: SosPayload) => {
    const time = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    const sig: SosSignal = {
      id: String(Date.now()), type: preset ?? "other", label,
      note: note || undefined, user: profile.handle, coords, time,
    };
    setSignals((s) => [...s, sig]);
    setTimeout(() => mapRef.current?.flyTo({
      center: toLngLat(coords), zoom: WAZE_ZOOM,
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

  // ── Add spot ──────────────────────────────────────────────────────────────────
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

  // ─── Render ───────────────────────────────────────────────────────────────────
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
          className={`h-9 w-9 grid place-items-center rounded-xl glass-strong transition ${
            isFollowing ? "text-accent" : "text-muted-foreground/50 hover:text-accent"
          }`}
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>

      {/* ── Bottom Waze bar ── */}
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
                3D Model · pitch {WAZE_PITCH}°
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
                  Выбери машину — 3D-модель на карте обновится мгновенно
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
                    background:  `${car.color}18`,
                    borderColor: `${car.color}55`,
                    boxShadow:   `0 0 18px ${car.color}1a`,
                  } : {}}
                >
                  {/* 3D perspective preview */}
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
                      Three.js 3D · GLTF + процедурный фоллбек
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
                          center: toLngLat(spot.coords), zoom: WAZE_ZOOM,
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
                          center: toLngLat(mt.coords), zoom: WAZE_ZOOM,
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
