import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Plus, Trash2, X, Save } from "lucide-react";
import {
  BUILD_HISTORY_PHOTO_LIMIT,
  BUILD_HISTORY_TYPE_LABEL,
  BUILD_HISTORY_TYPES,
  CAR_SPECIFICATION_KEYS,
  compactCarSpecifications,
  readBuildHistory,
  sortBuildHistory,
  type BuildHistoryType,
  type Car,
  type CarSpecificationKey,
} from "@/lib/streetgrid/data";
import {
  MEDIA_ASPECT,
  defaultMediaPosition,
  mediaPosition,
  mediaSrc,
  type MediaAsset,
  type MediaPosition,
  type StoredMedia,
} from "@/lib/streetgrid/media";
import { MediaPositionEditor } from "./MediaPositionEditor";
import { PositionedImage } from "./PositionedImage";

export type GarageSection = "car" | "photos" | "mods" | "specs" | "history";

const SPEC_EDITOR_FIELDS: { key: CarSpecificationKey; label: string }[] = [
  { key: "engine", label: "ДВИГАТЕЛЬ" },
  { key: "fuel", label: "ТОПЛИВО" },
  { key: "displacement", label: "ОБЪЁМ" },
  { key: "cylinders", label: "ЦИЛИНДРЫ" },
  { key: "induction", label: "НАДДУВ" },
  { key: "drivetrain", label: "ПРИВОД" },
  { key: "transmission", label: "КОРОБКА" },
  { key: "torque", label: "КРУТЯЩИЙ МОМЕНТ" },
  { key: "zeroTo100", label: "0–100 КМ/Ч" },
  { key: "topSpeed", label: "МАКС. СКОРОСТЬ" },
];

function emptySpecDraft(): Record<CarSpecificationKey, string> {
  return Object.fromEntries(CAR_SPECIFICATION_KEYS.map((key) => [key, ""])) as Record<CarSpecificationKey, string>;
}

function specDraftFromCar(car: Car): Record<CarSpecificationKey, string> {
  const draft = emptySpecDraft();
  const saved = car.specifications;
  if (!saved) return draft;
  for (const key of CAR_SPECIFICATION_KEYS) draft[key] = saved[key] ?? "";
  return draft;
}

const MAX_CAR_PHOTOS = 6;
const PHOTO_MAX_EDGE = 1200;
const PHOTO_TARGET_BYTES = 450 * 1024;

const SECTION_COPY: Record<GarageSection, { title: string; hint: string }> = {
  car: { title: "МОЙ АВТО", hint: "Марка, модель, год и мощность" },
  photos: { title: "ГАЛЕРЕЯ", hint: "Фото автомобиля" },
  mods: { title: "МОДИФИКАЦИИ", hint: "Список доработок" },
  specs: { title: "ХАРАКТЕРИСТИКИ", hint: "Технические характеристики" },
  history: { title: "БИЛД / ИСТОРИЯ", hint: "История проекта" },
};

type ModRow = { id: string; text: string };

let modSeq = 0;

function nextModId() {
  modSeq += 1;
  return `mod-${modSeq}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.startsWith("data:image/")) resolve(result);
      else reject(new Error("read"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read"));
    reader.readAsDataURL(file);
  });
}

function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export async function compressCarPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not-image");
  if (file.size <= PHOTO_TARGET_BYTES && /image\/(jpeg|jpg|png|webp)/i.test(file.type)) {
    return await readFileAsDataUrl(file);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  try {
    const sourceLongest = Math.max(bitmap.width, bitmap.height);
    if (!bitmap.width || !bitmap.height) throw new Error("empty");

    const paint = (longest: number) => {
      const scale = Math.min(1, longest / sourceLongest);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.fillStyle = "#0c0e14";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      return canvas;
    };

    let longest = Math.min(sourceLongest, PHOTO_MAX_EDGE);
    let canvas = paint(longest);
    let quality = 0.82;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (!dataUrl.startsWith("data:image/jpeg")) throw new Error("jpeg");

    while (dataUrlBytes(dataUrl) > PHOTO_TARGET_BYTES && quality > 0.55) {
      quality = Math.round((quality - 0.08) * 100) / 100;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    while (dataUrlBytes(dataUrl) > PHOTO_TARGET_BYTES && longest > 640) {
      longest = Math.round(longest * 0.8);
      canvas = paint(longest);
      dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    }

    return dataUrl;
  } finally {
    bitmap.close();
  }
}

type HistoryDraft = {
  id: string;
  date: string;
  type: BuildHistoryType;
  title: string;
  description: string;
  photos: StoredMedia[];
};

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function nextHistoryId(): string {
  const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `bh_${uuid}`;
}

function historyDraftsFromCar(car: Car): HistoryDraft[] {
  return sortBuildHistory(car.buildHistory ?? []).map((entry) => ({
    id: entry.id,
    date: entry.date,
    type: entry.type,
    title: entry.title,
    description: entry.description ?? "",
    photos: [...(entry.photos ?? [])],
  }));
}

function blankHistoryDraft(): HistoryDraft {
  return {
    id: nextHistoryId(),
    date: todayIsoDate(),
    type: "modification",
    title: "",
    description: "",
    photos: [],
  };
}

function historyDraftError(draft: HistoryDraft): string | null {
  if (!draft.date) return "Укажите дату";
  if (!draft.title.trim()) return "Укажите название";
  return null;
}

type Props = {
  section: GarageSection | null;
  car: Car;
  historyIntent?: string | null;
  onClose: () => void;
  onSave: (car: Car) => void;
  onDelete?: () => void;
};

function storedPrimaryPhoto(car: Car): StoredMedia | null {
  if (!car.photo) return null;
  return mediaSrc(car.photo) ? car.photo : null;
}

function mediaKey(photo: StoredMedia): string {
  return mediaSrc(photo) ?? (typeof photo === "string" ? photo : "photo");
}

export function GarageSectionEditor({ section, car, historyIntent = null, onClose, onSave, onDelete }: Props) {
  const [make, setMake] = useState(car.make);
  const [model, setModel] = useState(car.model);
  const [year, setYear] = useState(String(car.year));
  const [hp, setHp] = useState(String(car.hp));
  const [primaryPhoto, setPrimaryPhoto] = useState<StoredMedia | null>(() => storedPrimaryPhoto(car));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photos, setPhotos] = useState<StoredMedia[]>(() => car.photos.slice(0, MAX_CAR_PHOTOS));
  const [mods, setMods] = useState<ModRow[]>(() => car.specs.map((text) => ({ id: nextModId(), text })));
  const [specDraft, setSpecDraft] = useState<Record<CarSpecificationKey, string>>(() => specDraftFromCar(car));
  const [historyDraft, setHistoryDraft] = useState<HistoryDraft[]>(() => historyDraftsFromCar(car));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [historyFieldError, setHistoryFieldError] = useState<string | null>(null);
  const [historyPhotoBusyId, setHistoryPhotoBusyId] = useState<string | null>(null);
  const [historyPhotoError, setHistoryPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [positioning, setPositioning] = useState<{
    src: string;
    aspectRatio: number;
    position: MediaPosition;
    commit: (asset: MediaAsset) => void;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const primaryFileRef = useRef<HTMLInputElement>(null);
  const historyFileRef = useRef<HTMLInputElement>(null);
  const historyPhotoTarget = useRef<string | null>(null);
  const historyIntentRef = useRef(historyIntent);
  historyIntentRef.current = historyIntent;

  useEffect(() => {
    if (!section) return;
    const main = document.querySelector(".sg-app-shell main");
    if (!(main instanceof HTMLElement)) return;
    const previous = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = previous;
    };
  }, [section]);

  useEffect(() => {
    if (!section) return;
    setMake(car.make);
    setModel(car.model);
    setYear(String(car.year));
    setHp(String(car.hp));
    setPrimaryPhoto(storedPrimaryPhoto(car));
    setConfirmDelete(false);
    setPhotos(car.photos.slice(0, MAX_CAR_PHOTOS));
    setMods(car.specs.map((text) => ({ id: nextModId(), text })));
    setSpecDraft(specDraftFromCar(car));
    const drafts = historyDraftsFromCar(car);
    const intent = historyIntentRef.current;
    if (section === "history" && intent === "add") {
      const created = blankHistoryDraft();
      setHistoryDraft([created, ...drafts]);
      setEditingId(created.id);
    } else {
      setHistoryDraft(drafts);
      setEditingId(section === "history" && intent && drafts.some((entry) => entry.id === intent) ? intent : null);
    }
    setPendingDeleteId(null);
    setHistoryFieldError(null);
    setHistoryPhotoBusyId(null);
    setHistoryPhotoError(null);
    setPhotoBusy(false);
    setPhotoError(null);
    setPositioning(null);
  }, [section, car]);

  if (!section) return null;

  const atPhotoLimit = photos.length >= MAX_CAR_PHOTOS;
  const copy = SECTION_COPY[section];

  const stageFile = async (
    file: File,
    aspectRatio: number,
    commit: (asset: MediaAsset) => void,
    fail: (message: string) => void,
  ) => {
    if (!file.type.startsWith("image/")) {
      fail("Выберите изображение");
      return;
    }
    const src = await compressCarPhoto(file);
    setPositioning({ src, aspectRatio, position: defaultMediaPosition(), commit });
  };

  const stageExisting = (media: StoredMedia, aspectRatio: number, commit: (asset: MediaAsset) => void) => {
    const src = mediaSrc(media);
    if (!src) return;
    setPositioning({ src, aspectRatio, position: mediaPosition(media), commit });
  };

  const choosePrimary = async (file: File) => {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await stageFile(file, MEDIA_ASPECT.car, (asset) => setPrimaryPhoto(asset), setPhotoError);
    } catch {
      setPhotoError("Не удалось обработать фото");
    } finally {
      setPhotoBusy(false);
      if (primaryFileRef.current) primaryFileRef.current.value = "";
    }
  };

  const addPhoto = async (file: File) => {
    if (atPhotoLimit || photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await stageFile(
        file,
        MEDIA_ASPECT.gallery,
        (asset) => setPhotos((prev) => (prev.length >= MAX_CAR_PHOTOS ? prev : [...prev, asset])),
        setPhotoError,
      );
    } catch {
      setPhotoError("Не удалось обработать фото");
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = () => {
    if (section === "car") {
      const nextMake = make.trim() || car.make;
      const nextModel = model.trim() || car.model;
      if (!nextMake || !nextModel) return;
      onSave({
        ...car,
        make: nextMake,
        model: nextModel,
        year: Number(year) || car.year,
        hp: Number(hp) || car.hp,
        photo: primaryPhoto,
      });
    } else if (section === "photos") {
      onSave({ ...car, photos: photos.slice(0, MAX_CAR_PHOTOS) });
    } else if (section === "mods") {
      onSave({
        ...car,
        specs: mods.map((row) => row.text.trim()).filter(Boolean),
      });
    } else if (section === "specs") {
      const specifications = compactCarSpecifications(specDraft);
      if (specifications) {
        onSave({ ...car, specifications });
      } else {
        const rest = { ...car };
        delete rest.specifications;
        onSave(rest);
      }
    } else {
      const invalid = historyDraft.find((entry) => historyDraftError(entry));
      if (invalid) {
        setEditingId(invalid.id);
        setHistoryFieldError(invalid.id);
        return;
      }
      const buildHistory = readBuildHistory(historyDraft);
      if (buildHistory) {
        onSave({ ...car, buildHistory });
      } else {
        const rest = { ...car };
        delete rest.buildHistory;
        onSave(rest);
      }
    }
    onClose();
  };

  const updateHistory = (id: string, patch: Partial<HistoryDraft>) => {
    setHistoryDraft((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
    if (historyFieldError === id) setHistoryFieldError(null);
  };

  const addHistoryPhoto = async (entryId: string, file: File) => {
    const entry = historyDraft.find((item) => item.id === entryId);
    if (!entry || entry.photos.length >= BUILD_HISTORY_PHOTO_LIMIT || historyPhotoBusyId) return;
    if (!file.type.startsWith("image/")) {
      setHistoryPhotoError("Выберите изображение");
      return;
    }
    setHistoryPhotoBusyId(entryId);
    setHistoryPhotoError(null);
    try {
      await stageFile(
        file,
        MEDIA_ASPECT.history,
        (asset) => setHistoryDraft((prev) => prev.map((item) => {
          if (item.id !== entryId || item.photos.length >= BUILD_HISTORY_PHOTO_LIMIT) return item;
          return { ...item, photos: [...item.photos, asset] };
        })),
        setHistoryPhotoError,
      );
    } catch {
      setHistoryPhotoError("Не удалось обработать фото");
    } finally {
      setHistoryPhotoBusyId(null);
    }
  };

  const shell = document.querySelector(".sg-app-shell");
  const overlay = (
    <div
      onClick={onClose}
      className="sg-car-edit-overlay"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="sg-car-edit-modal glass-strong animate-float-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-garage-section-title"
      >
        <div className="sg-car-edit-header">
          <div className="sg-car-edit-header__copy">
            <h2 id="sg-garage-section-title" className="sg-car-edit-title font-display font-black">{copy.title}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{copy.hint}</p>
          </div>
          <button type="button" onClick={onClose} className="sg-car-edit-close h-9 w-9 grid place-items-center rounded-full glass" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="sg-car-edit-form">
          {section === "car" && (
            <>
              <div className="sg-car-edit-grid">
                <Field label="МАРКА">
                  <input value={make} onChange={(event) => setMake(event.target.value)} className={fieldInputCls} />
                </Field>
                <Field label="МОДЕЛЬ">
                  <input value={model} onChange={(event) => setModel(event.target.value)} className={fieldInputCls} />
                </Field>
              </div>
              <div className="sg-car-edit-grid">
                <Field label="ГОД">
                  <input
                    value={year}
                    onChange={(event) => setYear(event.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    className={fieldInputCls}
                  />
                </Field>
                <Field label="МОЩНОСТЬ (HP)">
                  <input
                    value={hp}
                    onChange={(event) => setHp(event.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    className={fieldInputCls}
                  />
                </Field>
              </div>
              <div className="sg-car-photo">
                <span className="text-[10px] tracking-widest text-muted-foreground">ФОТО АВТО</span>
                <div className="sg-car-photo__preview">
                  {primaryPhoto && mediaSrc(primaryPhoto) ? (
                    <button
                      type="button"
                      className="sg-media-reframe"
                      aria-label="Изменить кадр"
                      onClick={() => stageExisting(primaryPhoto, MEDIA_ASPECT.car, (asset) => setPrimaryPhoto(asset))}
                    >
                      <PositionedImage media={primaryPhoto} alt="Фото автомобиля" />
                    </button>
                  ) : (
                    <span>Фото не добавлено</span>
                  )}
                </div>
                <div className="sg-car-photo__actions">
                  <button
                    type="button"
                    className="sg-car-photo__change"
                    disabled={photoBusy}
                    onClick={() => primaryFileRef.current?.click()}
                  >
                    <ImagePlus aria-hidden /> {primaryPhoto ? "ИЗМЕНИТЬ ФОТО" : "ДОБАВИТЬ ФОТО"}
                  </button>
                  {primaryPhoto && (
                    <button
                      type="button"
                      className="sg-car-photo__remove"
                      aria-label="Удалить фото автомобиля"
                      disabled={photoBusy}
                      onClick={() => {
                        setPrimaryPhoto(null);
                        setPhotoError(null);
                      }}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  )}
                </div>
                <input
                  ref={primaryFileRef}
                  type="file"
                  accept="image/*"
                  className="sg-car-edit-file"
                  aria-label="Фото автомобиля"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void choosePrimary(file);
                  }}
                />
                {photoError && <span className="sg-car-edit-photos__error">{photoError}</span>}
              </div>
              {onDelete && (
                confirmDelete ? (
                  <div className="sg-history-confirm" role="alertdialog" aria-labelledby="sg-delete-car-title">
                    <p id="sg-delete-car-title">Удалить автомобиль?</p>
                    <p>Данные этого автомобиля будут удалены из вашего Garage.</p>
                    <div>
                      <button type="button" onClick={() => setConfirmDelete(false)}>ОТМЕНА</button>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete();
                          onClose();
                        }}
                      >
                        УДАЛИТЬ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="sg-car-delete" onClick={() => setConfirmDelete(true)}>
                    УДАЛИТЬ АВТО
                  </button>
                )
              )}
            </>
          )}

          {section === "photos" && (
            <div className="sg-car-edit-field">
              <div className="sg-car-edit-photos__head">
                <span className="text-[10px] tracking-widest text-muted-foreground">ФОТО</span>
                {atPhotoLimit && <span className="sg-car-edit-photos__limit">МАКС. 6 ФОТО</span>}
              </div>
              <div className="sg-car-edit-photos">
                {photos.map((photo, index) => (
                  <div
                    key={`${index}-${mediaKey(photo).slice(-24)}`}
                    className={`sg-car-edit-photo${index === 0 ? " is-primary" : ""}`}
                  >
                    {mediaSrc(photo) ? (
                      <button
                        type="button"
                        className="sg-media-reframe"
                        aria-label={`Изменить кадр фото ${index + 1}`}
                        onClick={() => stageExisting(photo, MEDIA_ASPECT.gallery, (asset) => {
                          setPhotos((prev) => prev.map((item, itemIndex) => (itemIndex === index ? asset : item)));
                        })}
                      >
                        <PositionedImage media={photo} alt="" />
                      </button>
                    ) : (
                      <span className="sg-car-edit-photo__emoji">{typeof photo === "string" ? photo : ""}</span>
                    )}
                    {index === 0 && <span className="sg-car-edit-photo__primary">ОСНОВНОЕ</span>}
                    <button
                      type="button"
                      className="sg-car-edit-photo__remove"
                      aria-label={`Удалить фото ${index + 1}`}
                      onClick={() => {
                        setPhotos((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
                        setPhotoError(null);
                      }}
                    >
                      <X aria-hidden />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="sg-car-edit-photo-add"
                  disabled={atPhotoLimit || photoBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus aria-hidden />
                  <span>{photoBusy ? "..." : "ДОБАВИТЬ"}</span>
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sg-car-edit-file"
                aria-label="Добавить фото автомобиля"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void addPhoto(file);
                }}
              />
              {photoError && <span className="sg-car-edit-photos__error">{photoError}</span>}
            </div>
          )}

          {section === "specs" && (
            <div className="sg-car-edit-grid">
              {SPEC_EDITOR_FIELDS.map((field) => (
                <Field key={field.key} label={field.label}>
                  <input
                    value={specDraft[field.key]}
                    onChange={(event) => {
                      const text = event.target.value;
                      setSpecDraft((prev) => ({ ...prev, [field.key]: text }));
                    }}
                    className={fieldInputCls}
                  />
                </Field>
              ))}
            </div>
          )}

          {section === "mods" && (
            <div className="sg-car-edit-field">
              <div className="sg-car-edit-mods">
                {mods.length === 0 && (
                  <p className="sg-car-edit-mods__empty">Модификации пока не добавлены</p>
                )}
                {mods.map((row, index) => (
                  <div className="sg-car-edit-mod" key={row.id}>
                    <input
                      value={row.text}
                      aria-label={`Модификация ${index + 1}`}
                      onChange={(event) => {
                        const text = event.target.value;
                        setMods((prev) => prev.map((item) => (item.id === row.id ? { ...item, text } : item)));
                      }}
                      className={fieldInputCls}
                    />
                    <button
                      type="button"
                      className="sg-car-edit-mod__remove"
                      aria-label={`Удалить модификацию ${index + 1}`}
                      onClick={() => setMods((prev) => prev.filter((item) => item.id !== row.id))}
                    >
                      <X aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="sg-car-edit-mod-add"
                onClick={() => setMods((prev) => [...prev, { id: nextModId(), text: "" }])}
              >
                <Plus aria-hidden /> ДОБАВИТЬ
              </button>
            </div>
          )}

          {section === "history" && (
            <div className="sg-car-edit-field">
              <button
                type="button"
                className="sg-history-add"
                onClick={() => {
                  const created = blankHistoryDraft();
                  setHistoryDraft((prev) => [created, ...prev]);
                  setEditingId(created.id);
                  setPendingDeleteId(null);
                  setHistoryFieldError(null);
                }}
              >
                <Plus aria-hidden /> ДОБАВИТЬ СОБЫТИЕ
              </button>
              {historyDraft.length === 0 && (
                <p className="sg-history-empty">История проекта пока пуста.</p>
              )}
              <div className="sg-history-list">
                {historyDraft.map((entry) => {
                  const open = editingId === entry.id;
                  const confirming = pendingDeleteId === entry.id;
                  return (
                    <article className="sg-history-card" key={entry.id}>
                      <div className="sg-history-card__head">
                        <span className="sg-history-card__badge">{BUILD_HISTORY_TYPE_LABEL[entry.type]}</span>
                        <time dateTime={entry.date}>{entry.date}</time>
                        {!open && (
                          <button
                            type="button"
                            className="sg-history-card__edit"
                            aria-label={`Редактировать ${entry.title || "запись"}`}
                            onClick={() => {
                              setEditingId(entry.id);
                              setPendingDeleteId(null);
                            }}
                          >
                            EDIT
                          </button>
                        )}
                      </div>
                      {!open && <strong className="sg-history-card__title">{entry.title || "Без названия"}</strong>}
                      {open && (
                        <div className="sg-history-fields">
                          <Field label="ДАТА">
                            <input
                              type="date"
                              value={entry.date}
                              onChange={(event) => updateHistory(entry.id, { date: event.target.value })}
                              className={`${fieldInputCls} sg-history-date`}
                            />
                          </Field>
                          <div className="sg-car-edit-field">
                            <span className="text-[10px] tracking-widest text-muted-foreground block mb-1.5">ТИП</span>
                            <div className="sg-history-types" role="group" aria-label="Тип события">
                              {BUILD_HISTORY_TYPES.map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  aria-pressed={entry.type === type}
                                  className={entry.type === type ? "is-active" : undefined}
                                  onClick={() => updateHistory(entry.id, { type })}
                                >
                                  {BUILD_HISTORY_TYPE_LABEL[type]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <Field label="НАЗВАНИЕ">
                            <input
                              value={entry.title}
                              onChange={(event) => updateHistory(entry.id, { title: event.target.value })}
                              className={fieldInputCls}
                            />
                          </Field>
                          <Field label="ОПИСАНИЕ">
                            <textarea
                              value={entry.description}
                              rows={4}
                              onChange={(event) => updateHistory(entry.id, { description: event.target.value })}
                              className="sg-car-edit-input sg-history-description"
                            />
                          </Field>
                          <div className="sg-car-edit-field">
                            <div className="sg-car-edit-photos__head">
                              <span className="text-[10px] tracking-widest text-muted-foreground">ФОТО</span>
                              {entry.photos.length >= BUILD_HISTORY_PHOTO_LIMIT && (
                                <span className="sg-car-edit-photos__limit">МАКС. {BUILD_HISTORY_PHOTO_LIMIT} ФОТО</span>
                              )}
                            </div>
                            <div className="sg-history-photos">
                              {entry.photos.map((photo, index) => (
                                <div className="sg-history-photo" key={`${entry.id}-${index}`}>
                                  {mediaSrc(photo) ? (
                                    <button
                                      type="button"
                                      className="sg-media-reframe"
                                      aria-label={`Изменить кадр фото события ${index + 1}`}
                                      onClick={() => stageExisting(photo, MEDIA_ASPECT.history, (asset) => {
                                        updateHistory(entry.id, {
                                          photos: entry.photos.map((item, photoIndex) => (photoIndex === index ? asset : item)),
                                        });
                                      })}
                                    >
                                      <PositionedImage media={photo} alt="" />
                                    </button>
                                  ) : (
                                    <span>{typeof photo === "string" ? photo : ""}</span>
                                  )}
                                  <button
                                    type="button"
                                    aria-label={`Удалить фото события ${index + 1}`}
                                    onClick={() => updateHistory(entry.id, {
                                      photos: entry.photos.filter((_, photoIndex) => photoIndex !== index),
                                    })}
                                  >
                                    <X aria-hidden />
                                  </button>
                                </div>
                              ))}
                              {entry.photos.length < BUILD_HISTORY_PHOTO_LIMIT && (
                                <button
                                  type="button"
                                  className="sg-history-photo-add"
                                  disabled={historyPhotoBusyId === entry.id}
                                  onClick={() => {
                                    historyPhotoTarget.current = entry.id;
                                    historyFileRef.current?.click();
                                  }}
                                >
                                  <ImagePlus aria-hidden />
                                  <span>{historyPhotoBusyId === entry.id ? "..." : "ФОТО"}</span>
                                </button>
                              )}
                            </div>
                          </div>
                          {historyFieldError === entry.id && historyDraftError(entry) && (
                            <span className="sg-car-edit-photos__error">{historyDraftError(entry)}</span>
                          )}
                        </div>
                      )}
                      {confirming ? (
                        <div className="sg-history-confirm" role="dialog" aria-label="Удалить запись?">
                          <p>Удалить запись?</p>
                          <div>
                            <button type="button" onClick={() => setPendingDeleteId(null)}>ОТМЕНА</button>
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryDraft((prev) => prev.filter((item) => item.id !== entry.id));
                                setPendingDeleteId(null);
                                if (editingId === entry.id) setEditingId(null);
                              }}
                            >
                              УДАЛИТЬ
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="sg-history-delete"
                          aria-label={`Удалить ${entry.title || "запись"}`}
                          onClick={() => setPendingDeleteId(entry.id)}
                        >
                          УДАЛИТЬ
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              <input
                ref={historyFileRef}
                type="file"
                accept="image/*"
                className="sg-car-edit-file"
                aria-label="Добавить фото события"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  const entryId = historyPhotoTarget.current;
                  event.target.value = "";
                  historyPhotoTarget.current = null;
                  if (file && entryId) void addHistoryPhoto(entryId, file);
                }}
              />
              {historyPhotoError && <span className="sg-car-edit-photos__error">{historyPhotoError}</span>}
            </div>
          )}
        </div>

        <div className="sg-car-edit-actions">
          <button type="button" onClick={onClose} className="sg-car-edit-cancel">
            ОТМЕНА
          </button>
          <button type="button" onClick={save} className="sg-car-edit-save bg-accent text-accent-foreground">
            <Save className="h-4 w-4" /> СОХРАНИТЬ
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {shell ? createPortal(overlay, shell) : overlay}
      {positioning && (
        <MediaPositionEditor
          src={positioning.src}
          aspectRatio={positioning.aspectRatio}
          position={positioning.position}
          onCancel={() => setPositioning(null)}
          onConfirm={(position) => {
            positioning.commit({ src: positioning.src, position });
            setPositioning(null);
          }}
        />
      )}
    </>
  );
}

const fieldInputCls =
  "sg-car-edit-input bg-white/5 border border-white/10 rounded-xl px-3 text-sm outline-none focus:border-accent/60 focus:bg-white/10 transition h-10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="sg-car-edit-field block">
      <span className="text-[10px] tracking-widest text-muted-foreground block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
