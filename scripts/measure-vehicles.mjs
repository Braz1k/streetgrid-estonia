/**
 * Measures normalised vehicle bounding boxes (same logic as MapView).
 * Run: node scripts/measure-vehicles.mjs
 */
import * as THREE from "three";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = 4.0;

// Minimal copies of procedural dims — full port would be huge; measure raw groups via dynamic import isn't available.
// Instead parse MapView for car IDs and use known procedural max dims from code audit + GLTF via gltf loader.

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function bboxReport(label, obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  return {
    label,
    x: +size.x.toFixed(2),
    y: +size.y.toFixed(2),
    z: +size.z.toFixed(2),
    max: +Math.max(size.x, size.y, size.z).toFixed(2),
  };
}

function normalize(model, target = TARGET) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) model.scale.setScalar(target / maxDim);
}

async function measureGltf(path, label) {
  const loader = new GLTFLoader();
  const buf = readFileSync(join(__dirname, "..", "public", path.replace(/^\//, "")));
  const gltf = await new Promise((res, rej) => {
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", res, rej);
  });
  const before = bboxReport(`${label} (raw GLTF)`, gltf.scene);
  normalize(gltf.scene);
  const after = bboxReport(`${label} (normalised)`, gltf.scene);
  return { before, after };
}

// Procedural approximations — max axis before normalisation (from geometry audit)
const PROC_RAW = {
  bmw_m3:       { x: 1.95, y: 1.5,  z: 4.12, label: "BMW procedural" },
  tesla_neon:   { x: 1.92, y: 1.2,  z: 4.22, label: "Tesla Neon X" },
  retro_racer:  { x: 3.3,  y: 1.2,  z: 5.5,  label: "Retro Racer" },
  hippie_van:   { x: 2.15, y: 2.5,  z: 5.56, label: "Hippie Van" },
};

console.log("=== Vehicle scale calibration ===\n");
console.log(`Target max axis: ${TARGET} m`);
console.log(`CAR_MODEL_SCALE candidates: 1.4, 1.5, 1.6\n`);

console.log("Procedural fallbacks (pre-normalisation → post):");
for (const [id, d] of Object.entries(PROC_RAW)) {
  const rawMax = Math.max(d.x, d.y, d.z);
  const factor = TARGET / rawMax;
  console.log(`  ${d.label}: raw max ${rawMax.toFixed(2)} m → scale ×${factor.toFixed(3)} → ${TARGET} m`);
}

console.log("\nGLTF BMW:");
try {
  const { before, after } = await measureGltf("/models/low_poly_bmw_g80_m3.glb", "BMW M3 GLTF");
  console.log(`  raw:  ${before.x}×${before.y}×${before.z} m (max ${before.max})`);
  console.log(`  norm: ${after.x}×${after.y}×${after.z} m (max ${after.max})`);
} catch (e) {
  console.log("  (GLTF load skipped:", e.message, ")");
}

console.log("\nEffective world size at DRIVE zoom 18 (Tallinn ~59.4°N):");
const lat = 59.437;
const mercatorScale = (156543.03392 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, 18);
for (const s of [1.4, 1.5, 1.6]) {
  const metersPerUnit = mercatorScale * s;
  const pxApprox = (TARGET * metersPerUnit) / mercatorScale; // relative
  console.log(`  scale ${s}: ~${(TARGET * s).toFixed(2)} m visual length (${((TARGET * s) / 4.8 * 100).toFixed(0)}% of typical lane width)`);
}
