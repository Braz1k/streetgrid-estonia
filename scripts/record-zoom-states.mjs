/**
 * Records Phase 4 zoom-state transitions (clusters → avatars → 3D cars).
 * Requires: dev server on :5173, `npx playwright install chromium`
 */
import { chromium } from "playwright";
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.SG_DEV_URL ?? "http://localhost:5174";
const OUT_DIR = join(process.cwd(), "public");
const OUT_FILE = join(OUT_DIR, "phase4-zoom-states.webm");
const VIDEO_DIR = join(process.cwd(), "videos");

await mkdir(VIDEO_DIR, { recursive: true });
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: { dir: VIDEO_DIR, size: { width: 390, height: 844 } },
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForSelector(".mapboxgl-canvas", { timeout: 45_000 });
await page.waitForTimeout(3500);

const canvas = page.locator(".mapboxgl-canvas").first();
const box = await canvas.boundingBox();
if (!box) throw new Error("Map canvas not found");

const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);

// Overview — clusters only (zoom < 12)
for (let i = 0; i < 5; i++) {
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(400);
}
await page.waitForTimeout(1200);

// Zoom in — crossfade clusters → avatars (11.75–12.25), then avatars + badges (12–15)
for (let i = 0; i < 14; i++) {
  await page.mouse.wheel(0, -320);
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1200);

// Continue — crossfade avatars → 3D cars (15–16), then 3D only (>16)
for (let i = 0; i < 8; i++) {
  await page.mouse.wheel(0, -320);
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1200);

// Zoom back out — reverse transition
for (let i = 0; i < 18; i++) {
  await page.mouse.wheel(0, 380);
  await page.waitForTimeout(450);
}
await page.waitForTimeout(800);

const videoPath = await page.video().path();
await context.close();
await browser.close();

await copyFile(videoPath, OUT_FILE);
console.log(`Video saved: ${OUT_FILE}`);
