import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  defaultMediaPosition,
  layoutMedia,
  mediaFrameStyle,
  normalizePosition,
  shiftMediaPosition,
  type MediaPosition,
} from "@/lib/streetgrid/media";

type Props = {
  src: string;
  aspectRatio: number;
  position: MediaPosition;
  onCancel: () => void;
  onConfirm: (position: MediaPosition) => void;
};

const SCALE_MIN = 1;
const SCALE_MAX = 3;
const SCALE_STEP = 0.08;

export function MediaPositionEditor({ src, aspectRatio, position, onCancel, onConfirm }: Props) {
  const [frame, setFrame] = useState<MediaPosition>(() => normalizePosition(position));
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const live = useRef(frame);
  const naturalRef = useRef(natural);
  naturalRef.current = natural;
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);
  onCancelRef.current = onCancel;
  onConfirmRef.current = onConfirm;

  const apply = (next: MediaPosition) => {
    const normalized = normalizePosition(next);
    live.current = normalized;
    setFrame(normalized);
  };

  const layout = layoutMedia(stageSize.w, stageSize.h, natural.w, natural.h, frame);

  useEffect(() => {
    const img = stageRef.current?.querySelector("img");
    if (img?.complete && img.naturalWidth) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
  }, [src]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setStageSize({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    const pointers = new Map<number, { x: number; y: number }>();
    let gesture:
      | { kind: "drag"; id: number; x: number; y: number; origin: MediaPosition; overflowX: number; overflowY: number }
      | { kind: "pinch"; dist: number; origin: MediaPosition }
      | null = null;

    const overflowAt = (origin: MediaPosition) => {
      const box = node.getBoundingClientRect();
      const placed = layoutMedia(box.width, box.height, naturalRef.current.w, naturalRef.current.h, origin);
      return { overflowX: placed?.overflowX ?? 0, overflowY: placed?.overflowY ?? 0 };
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      apply(normalizePosition({ ...live.current, scale: live.current.scale + delta }));
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      try {
        node.setPointerCapture(event.pointerId);
      } catch {
        /* Pointer capture is unavailable for some lost pointers. */
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        gesture = {
          kind: "pinch",
          dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          origin: live.current,
        };
        return;
      }
      const overflow = overflowAt(live.current);
      gesture = {
        kind: "drag",
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        origin: live.current,
        overflowX: overflow.overflowX,
        overflowY: overflow.overflowY,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId) || !gesture) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (gesture.kind === "pinch" && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        apply(normalizePosition({ ...gesture.origin, scale: gesture.origin.scale * (dist / gesture.dist) }));
        return;
      }
      if (gesture.kind === "drag" && gesture.id === event.pointerId && pointers.size === 1) {
        apply(shiftMediaPosition(
          gesture.origin,
          event.clientX - gesture.x,
          event.clientY - gesture.y,
          gesture.overflowX,
          gesture.overflowY,
        ));
      }
    };

    const endPointer = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) gesture = null;
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", endPointer);
    node.addEventListener("pointercancel", endPointer);
    return () => {
      observer.disconnect();
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", endPointer);
      node.removeEventListener("pointercancel", endPointer);
    };
  }, []);

  const overlay = (
    <div className="sg-car-edit-overlay sg-media-editor" onClick={() => onCancelRef.current()}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="sg-car-edit-modal glass-strong animate-float-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-media-editor-title"
      >
        <div className="sg-car-edit-header">
          <div className="sg-car-edit-header__copy">
            <h2 id="sg-media-editor-title" className="sg-car-edit-title font-display font-black">ИЗМЕНИТЬ ФОТО</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Переместите фото и измените масштаб</p>
          </div>
        </div>
        <div className="sg-car-edit-form">
          <div
            ref={stageRef}
            className="sg-media-editor__stage"
            style={{ aspectRatio }}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(event) => {
                const img = event.currentTarget;
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              style={layout ? mediaFrameStyle(layout) : {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
          <div className="sg-media-editor__zoom">
            <button
              type="button"
              aria-label="Уменьшить"
              onClick={() => apply({ ...live.current, scale: live.current.scale - SCALE_STEP })}
            >
              −
            </button>
            <input
              type="range"
              min={SCALE_MIN}
              max={SCALE_MAX}
              step={0.01}
              value={frame.scale}
              aria-label="Масштаб"
              onChange={(event) => apply({ ...live.current, scale: Number(event.target.value) })}
            />
            <button
              type="button"
              aria-label="Увеличить"
              onClick={() => apply({ ...live.current, scale: live.current.scale + SCALE_STEP })}
            >
              +
            </button>
          </div>
          <button type="button" className="sg-media-editor__reset" onClick={() => apply(defaultMediaPosition())}>
            СБРОСИТЬ
          </button>
        </div>
        <div className="sg-car-edit-actions">
          <button type="button" className="sg-car-edit-cancel" onClick={() => onCancelRef.current()}>ОТМЕНА</button>
          <button type="button" className="sg-car-edit-save bg-accent text-accent-foreground" onClick={() => onConfirmRef.current(live.current)}>
            ГОТОВО
          </button>
        </div>
      </div>
    </div>
  );

  const shell = document.querySelector(".sg-app-shell");
  return shell ? createPortal(overlay, shell) : overlay;
}
