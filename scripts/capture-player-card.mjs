/** Capture Phase 5 player card screenshots. */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.SG_DEV_URL ?? "http://localhost:5174";
const OUT = join(process.cwd(), "public", "screenshots");

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForSelector(".mapboxgl-canvas", { timeout: 45_000 });
await page.waitForTimeout(2500);

// Dismiss GPS overlay if present
const skipGps = page.getByRole("button", { name: /пропустить|skip|continue/i });
if (await skipGps.count()) {
  await skipGps.first().click().catch(() => {});
  await page.waitForTimeout(500);
}

const canvas = page.locator(".mapboxgl-canvas").first();
const box = await canvas.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(350);
  }
}
await page.waitForTimeout(1200);

// Tap first tappable player marker
const marker = page.locator(".sg-player-marker-mount--tappable").first();
await marker.waitFor({ state: "visible", timeout: 15_000 });
const mbox = await marker.boundingBox();
if (mbox) {
  await page.mouse.click(mbox.x + mbox.width / 2, mbox.y + mbox.height * 0.35);
} else {
  await marker.click({ force: true });
}
await page.waitForSelector(".sg-player-card", { timeout: 10_000 });
await page.waitForTimeout(600);

await page.screenshot({ path: join(OUT, "phase5-player-card-full.png"), fullPage: false });

const card = page.locator(".sg-player-card");
await card.screenshot({ path: join(OUT, "phase5-player-card-sheet.png") });

console.log("Saved:", join(OUT, "phase5-player-card-full.png"));
console.log("Saved:", join(OUT, "phase5-player-card-sheet.png"));

await browser.close();
