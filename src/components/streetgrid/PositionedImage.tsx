import { useEffect, useRef, useState } from "react";
import { layoutMedia, mediaFrameStyle, mediaPosition, mediaSrc, type MediaFrameLayout, type StoredMedia } from "@/lib/streetgrid/media";

type Props = {
  media: StoredMedia;
  alt: string;
  className?: string;
};

/** Renders a stored photo with its saved focal point. Legacy strings stay centered at scale 1. */
export function PositionedImage({ media, alt, className }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [layout, setLayout] = useState<MediaFrameLayout | null>(null);
  const src = mediaSrc(media);
  const position = mediaPosition(media);

  useEffect(() => {
    const img = imgRef.current;
    const parent = img?.parentElement;
    if (!img || !parent || !src) return;
    const measure = () => {
      setLayout(layoutMedia(parent.clientWidth, parent.clientHeight, img.naturalWidth, img.naturalHeight, position));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    img.addEventListener("load", measure);
    return () => {
      observer.disconnect();
      img.removeEventListener("load", measure);
    };
  }, [src, position.x, position.y, position.scale]);

  if (!src) return null;
  return (
    <img
      ref={imgRef}
      className={className ? `${className} sg-positioned-image` : "sg-positioned-image"}
      src={src}
      alt={alt}
      draggable={false}
      style={layout ? mediaFrameStyle(layout) : undefined}
    />
  );
}
