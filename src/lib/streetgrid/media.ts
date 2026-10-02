export type MediaPosition = {
  x: number;
  y: number;
  scale: number;
};

export type MediaAsset = {
  src: string;
  position: MediaPosition;
};

/** Legacy uploads are plain strings. New uploads keep the original source plus a normalized frame. */
export type StoredMedia = string | MediaAsset;

export const DEFAULT_MEDIA_POSITION: MediaPosition = { x: 50, y: 50, scale: 1 };

export const MEDIA_ASPECT = {
  car: 1.88,
  gallery: 1.88,
  history: 1.35,
} as const;

const POSITION_SCALE_MAX = 3;

export function defaultMediaPosition(): MediaPosition {
  return { x: DEFAULT_MEDIA_POSITION.x, y: DEFAULT_MEDIA_POSITION.y, scale: DEFAULT_MEDIA_POSITION.scale };
}

export function heroFrameAspect(): number {
  if (typeof document === "undefined") return 430 / 230;
  const shell = document.querySelector(".sg-app-shell");
  const width = shell instanceof HTMLElement ? shell.clientWidth : 0;
  const short = typeof window !== "undefined" && window.matchMedia("(max-width: 370px)").matches;
  const height = short ? 216 : 230;
  return width > 0 ? width / height : 430 / 230;
}

function isImageUrl(value: string): boolean {
  return /^(https?:\/\/|data:image\/|blob:|\/)/i.test(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizePosition(value: unknown): MediaPosition {
  const row = value && typeof value === "object" ? value as Partial<MediaPosition> : {};
  const x = typeof row.x === "number" ? row.x : Number.NaN;
  const y = typeof row.y === "number" ? row.y : Number.NaN;
  const scale = typeof row.scale === "number" ? row.scale : Number.NaN;
  return {
    x: Number.isFinite(x) ? clamp(x, 0, 100) : DEFAULT_MEDIA_POSITION.x,
    y: Number.isFinite(y) ? clamp(y, 0, 100) : DEFAULT_MEDIA_POSITION.y,
    scale: Number.isFinite(scale) ? clamp(scale, 1, POSITION_SCALE_MAX) : DEFAULT_MEDIA_POSITION.scale,
  };
}

/** Keep emoji and URL strings as-is. Accept `{ src, position }` without rewriting legacy values. */
export function normalizeStoredMedia(value: unknown): StoredMedia | null {
  if (typeof value === "string") {
    const photo = value.trim();
    return photo.length > 0 ? photo : null;
  }
  if (!value || typeof value !== "object") return null;
  const row = value as { src?: unknown; position?: unknown };
  if (typeof row.src !== "string") return null;
  const src = row.src.trim();
  if (!isImageUrl(src)) return null;
  return { src, position: normalizePosition(row.position) };
}

export function mediaSrc(value: StoredMedia | null | undefined): string | null {
  if (!value) return null;
  const raw = typeof value === "string" ? value.trim() : value.src.trim();
  return isImageUrl(raw) ? raw : null;
}

export function mediaPosition(value: StoredMedia | null | undefined): MediaPosition {
  if (value && typeof value === "object") return normalizePosition(value.position);
  return defaultMediaPosition();
}

export function readStoredPhotos(value: unknown): StoredMedia[] {
  if (!Array.isArray(value)) return [];
  const photos: StoredMedia[] = [];
  for (const item of value) {
    const media = normalizeStoredMedia(item);
    if (media) photos.push(media);
  }
  return photos;
}

export function readProfileImage(value: unknown): StoredMedia | null {
  const media = normalizeStoredMedia(value);
  if (!media || !mediaSrc(media)) return null;
  return media;
}

export type MediaFrameLayout = {
  width: number;
  height: number;
  left: number;
  top: number;
  overflowX: number;
  overflowY: number;
};

/** Cover-fit the image in the frame, then place the focal point. x/y stay 0–100 at every width. */
export function layoutMedia(
  frameWidth: number,
  frameHeight: number,
  imageWidth: number,
  imageHeight: number,
  position: MediaPosition,
): MediaFrameLayout | null {
  if (frameWidth < 1 || frameHeight < 1 || imageWidth < 1 || imageHeight < 1) return null;
  const frame = normalizePosition(position);
  const cover = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const width = imageWidth * cover * frame.scale;
  const height = imageHeight * cover * frame.scale;
  const overflowX = Math.max(0, width - frameWidth);
  const overflowY = Math.max(0, height - frameHeight);
  return {
    width,
    height,
    left: -overflowX * (frame.x / 100),
    top: -overflowY * (frame.y / 100),
    overflowX,
    overflowY,
  };
}

/** Finger movement in pixels, converted to the normalized focal point. The image follows the pointer. */
export function shiftMediaPosition(
  origin: MediaPosition,
  dx: number,
  dy: number,
  overflowX: number,
  overflowY: number,
): MediaPosition {
  const frame = normalizePosition(origin);
  return normalizePosition({
    x: overflowX > 0.5 ? frame.x - (dx / overflowX) * 100 : frame.x,
    y: overflowY > 0.5 ? frame.y - (dy / overflowY) * 100 : frame.y,
    scale: frame.scale,
  });
}

export function mediaFrameStyle(layout: MediaFrameLayout): {
  position: "absolute";
  left: number;
  top: number;
  right: "auto";
  bottom: "auto";
  width: number;
  height: number;
  maxWidth: "none";
  objectFit: "fill";
} {
  return {
    position: "absolute",
    left: layout.left,
    top: layout.top,
    right: "auto",
    bottom: "auto",
    width: layout.width,
    height: layout.height,
    maxWidth: "none",
    objectFit: "fill",
  };
}
