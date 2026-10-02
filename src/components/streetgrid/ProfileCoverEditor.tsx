import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Save, Trash2, X } from "lucide-react";
import {
  defaultMediaPosition,
  heroFrameAspect,
  mediaPosition,
  mediaSrc,
  type MediaAsset,
  type StoredMedia,
} from "@/lib/streetgrid/media";
import { NICKNAME_COLORS, type NicknameColorId } from "@/lib/streetgrid/nickname";
import { compressCarPhoto } from "./GarageSectionEditor";
import { MediaPositionEditor } from "./MediaPositionEditor";
import { PositionedImage } from "./PositionedImage";

type Props = {
  open: boolean;
  backgroundImage: StoredMedia | null;
  nicknameColor: NicknameColorId;
  onClose: () => void;
  onSave: (backgroundImage: StoredMedia | null, nicknameColor: NicknameColorId) => void;
};

export function ProfileCoverEditor({ open, backgroundImage, nicknameColor, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<StoredMedia | null>(backgroundImage);
  const [nickname, setNickname] = useState<NicknameColorId>(nicknameColor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positioning, setPositioning] = useState<{ src: string; position: ReturnType<typeof mediaPosition> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aspectRatio = heroFrameAspect();

  useEffect(() => {
    if (!open) return;
    const main = document.querySelector(".sg-app-shell main");
    if (!(main instanceof HTMLElement)) return;
    const previous = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setDraft(backgroundImage);
    setNickname(nicknameColor);
    setPositioning(null);
    setBusy(false);
    setError(null);
  }, [open, backgroundImage, nicknameColor]);

  if (!open) return null;

  const draftSrc = mediaSrc(draft);

  const openFrame = (src: string, position = defaultMediaPosition()) => {
    setPositioning({ src, position });
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Выберите изображение");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      openFrame(await compressCarPhoto(file));
    } catch {
      setError("Не удалось обработать фото");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmFrame = (position: MediaAsset["position"]) => {
    if (!positioning) return;
    setDraft({ src: positioning.src, position });
    setPositioning(null);
  };

  const overlay = (
    <div onClick={onClose} className="sg-car-edit-overlay">
      <div
        onClick={(event) => event.stopPropagation()}
        className="sg-car-edit-modal glass-strong animate-float-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-cover-title"
      >
        <div className="sg-car-edit-header">
          <div className="sg-car-edit-header__copy">
            <h2 id="sg-cover-title" className="sg-car-edit-title font-display font-black">ПРОФИЛЬНЫЙ ФОН</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Фото для верхней части профиля</p>
          </div>
          <button type="button" onClick={onClose} className="sg-car-edit-close h-9 w-9 grid place-items-center rounded-full glass" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="sg-car-edit-form">
          <div className="sg-cover-preview" style={{ aspectRatio }}>
            {draft && draftSrc ? (
              <button
                type="button"
                className="sg-media-reframe"
                aria-label="Изменить кадр"
                onClick={() => openFrame(draftSrc, mediaPosition(draft))}
              >
                <PositionedImage media={draft} alt="Текущая обложка профиля" />
              </button>
            ) : (
              <span>Фон не задан</span>
            )}
          </div>
          <div className="sg-cover-actions">
            <button type="button" className="sg-cover-action" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus aria-hidden /> ИЗМЕНИТЬ
            </button>
            <button type="button" className="sg-cover-action" disabled={!draft || busy} onClick={() => setDraft(null)}>
              <Trash2 aria-hidden /> УДАЛИТЬ
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Выбрать фото обложки"
            onChange={(event) => void choose(event.target.files?.[0])}
          />
          {error && <p className="sg-cover-error">{error}</p>}
          <div className="sg-car-edit-field">
            <span className="text-[10px] tracking-widest text-muted-foreground">ЦВЕТ НИКНЕЙМА</span>
            <div className="sg-nick-swatches" role="radiogroup" aria-label="Цвет никнейма">
              {NICKNAME_COLORS.map((color) => {
                const selected = nickname === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={color.label}
                    title={color.label}
                    className={selected ? "is-selected" : undefined}
                    style={{ background: color.value, color: color.value }}
                    onClick={() => setNickname(color.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="sg-car-edit-actions">
          <button type="button" onClick={onClose} className="sg-car-edit-cancel">ОТМЕНА</button>
          <button
            type="button"
            className="sg-car-edit-save bg-accent text-accent-foreground"
            disabled={busy}
            onClick={() => onSave(draft, nickname)}
          >
            <Save className="h-4 w-4" /> СОХРАНИТЬ
          </button>
        </div>
      </div>
    </div>
  );

  const shell = document.querySelector(".sg-app-shell");
  return (
    <>
      {shell ? createPortal(overlay, shell) : overlay}
      {positioning && (
        <MediaPositionEditor
          src={positioning.src}
          aspectRatio={aspectRatio}
          position={positioning.position}
          onCancel={() => setPositioning(null)}
          onConfirm={confirmFrame}
        />
      )}
    </>
  );
}
