import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CITIES, MEETS, type CityId, type Meet } from "@/lib/streetgrid/data";
import { MEET_RSVP_STORAGE_KEY, useStreetGrid, type CreateMeetInput } from "@/lib/streetgrid/store";
import { Calendar, MapPin, Users, Plus, Check, Navigation, X } from "lucide-react";

const STATIC_MEET_IDS = new Set(MEETS.map((meet) => meet.id));

function knownMeetIds(userMeets: Meet[]): Set<string> {
  const ids = new Set(STATIC_MEET_IDS);
  for (const meet of userMeets) ids.add(meet.id);
  return ids;
}

function loadMeetRsvp(userMeets: Meet[]): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(MEET_RSVP_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const ids = knownMeetIds(userMeets);
    const going: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (ids.has(id) && value === true) going[id] = true;
    }
    return going;
  } catch {
    return {};
  }
}

function persistMeetRsvp(going: Record<string, boolean>, userMeets: Meet[]) {
  const ids = knownMeetIds(userMeets);
  const stored: Record<string, true> = {};
  for (const [id, value] of Object.entries(going)) {
    if (value === true && ids.has(id)) stored[id] = true;
  }
  try {
    localStorage.setItem(MEET_RSVP_STORAGE_KEY, JSON.stringify(stored));
  } catch { /* noop */ }
}

function cityForMeet(filter: CityId, coords: [number, number]): Exclude<CityId, "all"> {
  if (filter !== "all") return filter;
  let best: Exclude<CityId, "all"> = "tallinn";
  let bestScore = Infinity;
  for (const row of CITIES) {
    if (row.id === "all") continue;
    const dLat = row.coords[0] - coords[0];
    const dLng = row.coords[1] - coords[1];
    const score = dLat * dLat + dLng * dLng;
    if (score < bestScore) {
      best = row.id;
      bestScore = score;
    }
  }
  return best;
}

function formatMeetTime(value: string): string | null {
  const date = new Date(value);
  if (!value.trim() || Number.isNaN(date.getTime())) return null;
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${days[date.getDay()]}, ${hours}:${minutes}`;
}

function parseCoord(value: string, limit: number): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const number = Number(trimmed);
  if (!Number.isFinite(number) || Math.abs(number) > limit) return null;
  return number;
}

type MeetFormErrors = {
  title?: string;
  location?: string;
  time?: string;
  coords?: string;
};

export function MeetsPanel({ city, onRouteTo, onActiveMeetRemoved }: {
  city: CityId;
  onRouteTo?: (
    coords: [number, number],
    name: string,
    meet?: { id: string; title: string; coords: [number, number] },
  ) => void;
  onActiveMeetRemoved?: (meetId: string) => void;
}) {
  const { profile, userMeets, createUserMeet, deleteUserMeet } = useStreetGrid();
  const userMeetsRef = useRef(userMeets);
  userMeetsRef.current = userMeets;
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Meet | null>(null);
  const list = useMemo(() => {
    const merged = [...userMeets, ...MEETS];
    return city === "all" ? merged : merged.filter((meet) => meet.city === city);
  }, [city, userMeets]);
  const [going, setGoing] = useState<Record<string, boolean>>(() => loadMeetRsvp(userMeets));
  const counts = useMemo(
    () => Object.fromEntries(list.map((meet) => [meet.id, meet.going + (going[meet.id] ? 1 : 0)])),
    [list, going],
  );

  const toggle = (id: string) => {
    const next = { ...going };
    if (going[id]) delete next[id];
    else next[id] = true;
    setGoing(next);
    persistMeetRsvp(next, userMeetsRef.current);
  };

  const confirmDelete = () => {
    if (!pendingDelete || pendingDelete.createdBy !== "self") {
      setPendingDelete(null);
      return;
    }
    const id = pendingDelete.id;
    if (!deleteUserMeet(id)) {
      setPendingDelete(null);
      return;
    }
    setGoing((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    onActiveMeetRemoved?.(id);
    setPendingDelete(null);
  };

  return (
    <div className="p-4 space-y-3 pb-24">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="font-display text-xl font-black">МИТЫ</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Сходки и события рядом</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs tracking-wider glow-red flex items-center gap-2 active:scale-95 transition"
        >
          <Plus className="h-4 w-4" /> СОЗДАТЬ
        </button>
      </div>

      {list.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          В этом регионе пока нет митов. Создайте первый!
        </div>
      )}

      {list.map((m) => (
        <article key={m.id} className="glass rounded-2xl overflow-hidden animate-float-up">
          <div className="h-28 bg-gradient-to-br from-primary/30 via-surface-2 to-accent/20 grid place-items-center text-5xl relative">
            <span>{m.cover}</span>
            <div className="absolute top-2 right-2 glass-strong rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest">
              {m.time.toUpperCase()}
            </div>
          </div>
          <div className="p-4 space-y-2.5">
            <h3 className="font-display font-black text-base leading-tight">{m.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>
            <div className="flex items-center gap-3 text-[11px] text-foreground/70">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{m.location}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-accent" />{m.time.split(",")[1]?.trim() ?? m.time}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
              <div className="flex items-center gap-2 text-xs min-w-0">
                <Users className="h-4 w-4 text-nitro shrink-0" />
                <span className="font-bold">{counts[m.id]}</span>
                <span className="text-muted-foreground">едут</span>
                {m.createdBy === "self" && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(m)}
                    className="ml-1 text-[10px] font-bold tracking-wider text-primary active:scale-95 transition"
                  >
                    УДАЛИТЬ
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onRouteTo?.(m.coords, m.title, { id: m.id, title: m.title, coords: m.coords })}
                  className="px-3 h-9 rounded-xl glass border border-accent/40 text-accent text-[11px] font-bold tracking-wider flex items-center gap-1.5 active:scale-95 transition"
                >
                  <Navigation className="h-3 w-3" /> ПОЕХАЛИ
                </button>
                <button
                  onClick={() => toggle(m.id)}
                  className={`px-3 h-9 rounded-xl text-[11px] font-bold tracking-wider transition active:scale-95 flex items-center gap-1.5 ${
                    going[m.id]
                      ? "bg-nitro/20 border border-nitro/50 text-nitro glow-nitro"
                      : "bg-primary text-primary-foreground glow-red"
                  }`}
                >
                  {going[m.id] ? <><Check className="h-3.5 w-3.5" />ЕДУ</> : "ПРИЕДУ"}
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
      <CreateMeetModal
        open={createOpen}
        city={city}
        organizer={profile.handle}
        onClose={() => setCreateOpen(false)}
        onCreate={createUserMeet}
      />
      <DeleteMeetDialog
        meet={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function DeleteMeetDialog({
  meet,
  onCancel,
  onConfirm,
}: {
  meet: Meet | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!meet) return null;
  const shell = document.querySelector(".sg-app-shell") ?? document.body;
  return createPortal(
    <div className="sg-create-meet-overlay" onClick={onCancel} role="presentation">
      <div
        className="sg-create-meet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-delete-meet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="sg-delete-meet-title" className="font-display text-base font-black tracking-wide">Удалить мит?</h2>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{meet.title}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-white/10 bg-white/5 text-[11px] font-bold tracking-widest text-foreground/80">
            ОТМЕНА
          </button>
          <button type="button" onClick={onConfirm} className="h-10 rounded-xl bg-primary text-[11px] font-black tracking-widest text-primary-foreground">
            УДАЛИТЬ
          </button>
        </div>
      </div>
    </div>,
    shell,
  );
}

function CreateMeetModal({
  open,
  city,
  organizer,
  onClose,
  onCreate,
}: {
  open: boolean;
  city: CityId;
  organizer: string;
  onClose: () => void;
  onCreate: (input: CreateMeetInput) => boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [time, setTime] = useState("");
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");
  const [errors, setErrors] = useState<MeetFormErrors>({});
  const [gpsState, setGpsState] = useState<"loading" | "ready" | "missing">("loading");
  const coordsTouched = useRef(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPlace("");
    setTime("");
    setLatText("");
    setLngText("");
    setErrors({});
    setGpsState("loading");
    coordsTouched.current = false;
    if (!("geolocation" in navigator)) {
      setGpsState("missing");
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled || coordsTouched.current) return;
        const { latitude, longitude, accuracy } = pos.coords;
        const valid = (
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          Math.abs(latitude) <= 90 &&
          Math.abs(longitude) <= 180 &&
          Number.isFinite(accuracy) &&
          accuracy > 0
        );
        if (!valid) {
          setGpsState("missing");
          return;
        }
        setLatText(latitude.toFixed(5));
        setLngText(longitude.toFixed(5));
        setGpsState("ready");
      },
      () => {
        if (!cancelled) setGpsState("missing");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const shell = document.querySelector(".sg-app-shell") ?? document.body;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: MeetFormErrors = {};
    if (!title.trim()) nextErrors.title = "Укажите название";
    if (!place.trim()) nextErrors.location = "Укажите место";
    const timeLabel = formatMeetTime(time);
    if (!timeLabel) nextErrors.time = "Укажите время";
    const lat = parseCoord(latText, 90);
    const lng = parseCoord(lngText, 180);
    if (lat == null || lng == null) nextErrors.coords = "Укажите координаты";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || lat == null || lng == null || !timeLabel) return;
    const created = onCreate({
      title,
      description,
      location: place,
      time: timeLabel,
      coords: [lat, lng],
      city: cityForMeet(city, [lat, lng]),
    });
    if (created) onClose();
  };

  return createPortal(
    <div className="sg-create-meet-overlay" onClick={onClose} role="presentation">
      <form
        className="sg-create-meet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-create-meet-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="sg-create-meet-title" className="font-display text-base font-black tracking-wide">СОЗДАТЬ МИТ</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Создай свою автомобильную встречу</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-foreground/70" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-3 block">
          <span className="text-[9px] font-bold tracking-widest text-muted-foreground">НАЗВАНИЕ</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например, Night Drive Tallinn"
            className="mt-1 h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-accent/50"
            maxLength={80}
          />
          {errors.title && <span className="mt-1 block text-[10px] text-primary">{errors.title}</span>}
        </label>

        <label className="mt-2.5 block">
          <span className="text-[9px] font-bold tracking-widest text-muted-foreground">ОПИСАНИЕ</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Коротко о встрече"
            rows={2}
            maxLength={240}
            className="mt-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
        </label>

        <label className="mt-2.5 block">
          <span className="text-[9px] font-bold tracking-widest text-muted-foreground">МЕСТО</span>
          <input
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            placeholder="Название места"
            className="mt-1 h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-accent/50"
            maxLength={80}
          />
          {errors.location && <span className="mt-1 block text-[10px] text-primary">{errors.location}</span>}
        </label>

        <label className="mt-2.5 block">
          <span className="text-[9px] font-bold tracking-widest text-muted-foreground">ВРЕМЯ</span>
          <input
            type="datetime-local"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className="mt-1 h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-accent/50"
          />
          {errors.time && <span className="mt-1 block text-[10px] text-primary">{errors.time}</span>}
        </label>

        <div className="mt-2.5">
          <span className="text-[9px] font-bold tracking-widest text-muted-foreground">КООРДИНАТЫ</span>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {gpsState === "ready"
              ? "Текущая GPS-позиция. Можно поправить."
              : gpsState === "loading"
                ? "Определяем GPS…"
                : "GPS недоступен. Укажите широту и долготу."}
          </p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <input
              value={latText}
              inputMode="decimal"
              placeholder="Широта"
              aria-label="Широта"
              onChange={(event) => {
                coordsTouched.current = true;
                setLatText(event.target.value);
              }}
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-accent/50"
            />
            <input
              value={lngText}
              inputMode="decimal"
              placeholder="Долгота"
              aria-label="Долгота"
              onChange={(event) => {
                coordsTouched.current = true;
                setLngText(event.target.value);
              }}
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-accent/50"
            />
          </div>
          {errors.coords && <span className="mt-1 block text-[10px] text-primary">{errors.coords}</span>}
          {!organizer.trim() && <span className="mt-1 block text-[10px] text-primary">Нет профиля организатора</span>}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-white/10 bg-white/5 text-[11px] font-bold tracking-widest text-foreground/80">
            ОТМЕНА
          </button>
          <button type="submit" className="h-10 rounded-xl bg-accent text-[11px] font-black tracking-widest text-accent-foreground">
            СОЗДАТЬ
          </button>
        </div>
      </form>
    </div>,
    shell,
  );
}
