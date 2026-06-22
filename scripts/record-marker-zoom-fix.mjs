/**
 * Records marker stability during pinch zoom (post flicker-fix).
 * Before fix reference: public/phase4-zoom-states.webm
 */
import { chromium } from "playwright";
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.SG_DEV_URL ?? "http://localhost:5175";
const OUT = join(process.cwd(), "public", "marker-zoom-after-fix.webm");
const VIDEO_DIR = join(process.cwd(), "videos");

await mkdir(VIDEO_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: { dir: VIDEO_DIR, size: { width: 390, height: 844 } },
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForSelector(".mapboxgl-canvas", { timeout: 45_000 });
await page.waitForTimeout(2500);

const canvas = page.locator(".mapboxgl-canvas").first();
const box = await canvas.boundingBox();
if (!box) throw new Error("Map canvas not found");

const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);

// Slow pinch through all zoom bands — stress-test opacity transitions
for (let pass = 0; pass < 2; pass++) {
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(280);
  }
  await page.waitForTimeout(600);
  for (let i = 0; i < 18; i++) {
    await page.mouse.wheel(0, -280);
    await page.waitForTimeout(280);
  }
  await page.waitForTimeout(600);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(280);
  }
  await page.waitForTimeout(800);
}

const videoPath = await page.video().path();
await context.close();
await browser.close();

await copyFile(videoPath, OUT);
console.log(`Video saved: ${OUT}`);
