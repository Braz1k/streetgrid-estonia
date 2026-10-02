import { useState } from "react";
import {
  BUILD_HISTORY_TYPE_LABEL,
  CITIES,
  sortBuildHistory,
  type BuildHistoryEntry,
  type BuildHistoryType,
  type Car,
  type CarSpecificationKey,
} from "@/lib/streetgrid/data";
import { SPOTS } from "@/lib/streetgrid/spots";
import { mediaSrc } from "@/lib/streetgrid/media";
import { nicknameColorValue } from "@/lib/streetgrid/nickname";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { getRankFromProgress } from "@/lib/streetgrid/reputation";
import { RARITY_META } from "@/lib/streetgrid/vehicles";
import { ReputationBadge } from "./ReputationBadge";
import { ReputationPanel } from "./ReputationPanel";
import {
  BadgeCheck,
  CalendarDays,
  Cog,
  Edit3,
  Flag,
  ImagePlus,
  KeyRound,
  MapPin,
  Trophy,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { GarageSectionEditor, type GarageSection } from "./GarageSectionEditor";
import { PositionedImage } from "./PositionedImage";
import { ProfileCoverEditor } from "./ProfileCoverEditor";

const SPEC_DISPLAY: { key: CarSpecificationKey; label: string }[] = [
  { key: "engine", label: "ДВИГАТЕЛЬ" },
  { key: "fuel", label: "ТОПЛИВО" },
  { key: "displacement", label: "ОБЪЁМ" },
  { key: "cylinders", label: "ЦИЛИНДРЫ" },
  { key: "induction", label: "НАДДУВ" },
  { key: "drivetrain", label: "ПРИВОД" },
  { key: "transmission", label: "КОРОБКА" },
  { key: "torque", label: "МОМЕНТ" },
  { key: "zeroTo100", label: "0–100 КМ/Ч" },
  { key: "topSpeed", label: "МАКС. СКОРОСТЬ" },
];

type Props = { onBack?: () => void };

/** The signed-in driver's editable garage profile. */
export function ProfileGaragePanel(_props: Props) {
  const { profile, activity, updateCar, updateProfile, getEffectiveReputation } = useStreetGrid();
  const handle = profile.handle;
  const status = profile.status;
  const car = profile.car;
  const reputation = getEffectiveReputation();
  const rank = getRankFromProgress(reputation);
  const rarity = profile.rarity;
  const rarityMeta = RARITY_META[rarity];
  const [section, setSection] = useState<GarageSection | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [historyIntent, setHistoryIntent] = useState<string | null>(null);
  const openHistory = (intent: string | null) => {
    setHistoryIntent(intent);
    setSection("history");
  };
  const activityItems = [...activity].sort((a, b) => b.createdAt - a.createdAt);
  const galleryImage = car?.photos.find((photo) => mediaSrc(photo)) ?? null;
  const carPhoto = (car?.photo && mediaSrc(car.photo) ? car.photo : null) ?? galleryImage;
  const background = profile.backgroundImage;
  const hasBackground = Boolean(background && mediaSrc(background));
  const emojiFallback = car?.photos.find((photo): photo is string => typeof photo === "string" && !mediaSrc(photo));
  const visualFallback = emojiFallback ?? "🚗";
  const nicknameColor = nicknameColorValue(profile.nicknameColor);
  const specificationRows = car ? SPEC_DISPLAY.flatMap((field) => {
    const value = car.specifications?.[field.key]?.trim();
    return value ? [{ ...field, value }] : [];
  }) : [];
  const historyGroups = buildHistoryGroups(car?.buildHistory);

  return (
    <div className="sg-profile animate-float-up">
      <section className={`sg-profile-hero${hasBackground ? " has-photo" : ""}`}>
        {hasBackground && background && (
          <PositionedImage media={background} alt="" className="sg-profile-hero__photo" />
        )}
        <div className="sg-profile-hero__shade" />

        <div className="sg-profile-hero__toolbar">
          <button type="button" className="sg-profile-icon-button" onClick={() => setCoverOpen(true)} aria-label="Изменить обложку профиля">
            <ImagePlus aria-hidden /> ФОН
          </button>
        </div>

        <div className="sg-profile-hero__identity">
          <div className="sg-profile-identity-copy">
            <div className="sg-profile-identity-copy__name">
              <h1 style={{ color: nicknameColor }}>{handle}</h1>
              <span className="sg-profile-verify" title="Verified">
                <BadgeCheck aria-hidden />
              </span>
            </div>
            <div className="sg-profile-identity-copy__badges">
              <ReputationBadge rank={rank} size="sm" />
              <span
                className="sg-profile-rarity"
                style={{
                  color: rarityMeta.color,
                  borderColor: rarityMeta.border,
                  background: `${rarityMeta.color}16`,
                }}
              >
                {rarityMeta.label.toUpperCase()}
              </span>
            </div>
            <div className="sg-profile-status">{status}</div>
          </div>
        </div>
      </section>

      <div className="sg-profile-body">
        <div className="sg-profile-meta" aria-label="Profile metadata">
          <span><MapPin aria-hidden /> {profile.location.trim() ? profile.location : "Локация не указана"}</span>
          <span><CalendarDays aria-hidden /> {profile.joinedAt ? profile.joinedAt : "Дата регистрации не указана"}</span>
        </div>

        {car ? (
        <>
        <section className="sg-profile-section sg-garage-show sg-profile-car-card">
          <div className="sg-profile-section-heading sg-profile-section-heading--actions">
            <SectionHeading eyebrow="REAL GARAGE" title="МОЙ АВТО" />
            <button type="button" className="sg-profile-section-action" onClick={() => setSection("car")}>
              <Edit3 aria-hidden /> EDIT
            </button>
          </div>
          <div className="sg-profile-car-card__stage">
            {carPhoto ? (
              <PositionedImage media={carPhoto} alt={`${car.make} ${car.model}`} />
            ) : (
              <div className="sg-profile-car-fallback">
                <span>{visualFallback}</span>
              </div>
            )}
          </div>
          <div className="sg-profile-car-card__copy">
            <h2><span>{car.make}</span>{car.model}</h2>
            <p>{car.year} · {car.hp} HP · {car.specs.length} мод.</p>
          </div>
        </section>

        <section className="sg-profile-section sg-garage-show">
          <div className="sg-profile-section-heading sg-profile-section-heading--actions">
            <SectionHeading eyebrow="CAR SPECS" title="ХАРАКТЕРИСТИКИ" />
            {specificationRows.length > 0 && (
              <button type="button" className="sg-profile-section-action" onClick={() => setSection("specs")}>
                <Edit3 aria-hidden /> EDIT
              </button>
            )}
          </div>
          {specificationRows.length > 0 ? (
            <dl className="sg-profile-spec-grid">
              {specificationRows.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="sg-profile-specs-empty sg-garage-empty">
              <p>Технические данные автомобиля ещё не добавлены.</p>
              <button type="button" onClick={() => setSection("specs")}>
                ДОБАВИТЬ
              </button>
            </div>
          )}
        </section>

        <section className="sg-profile-section sg-garage-show">
          <div className="sg-profile-section-heading sg-profile-section-heading--actions">
            <SectionHeading eyebrow="REAL CAR MEDIA" title="ГАЛЕРЕЯ" />
            {car.photos.length > 0 && (
              <button type="button" className="sg-profile-section-action" onClick={() => setSection("photos")}>
                <Edit3 aria-hidden /> EDIT
              </button>
            )}
          </div>
          {car.photos.length > 0 ? (
            <div className="sg-profile-gallery">
              {car.photos.map((photo, index) => {
                const token = mediaSrc(photo) ?? (typeof photo === "string" ? photo : String(index));
                return (
                <div className={`sg-profile-gallery__item${index === 0 ? " is-primary" : ""}`} key={`${index}-${token}`}>
                  {mediaSrc(photo) ? (
                    <PositionedImage media={photo} alt={`${car.make} ${car.model}, фото ${index + 1}`} />
                  ) : (
                    <span>{typeof photo === "string" ? photo : ""}</span>
                  )}
                  {index === 0 && <span className="sg-profile-gallery__primary">ОСНОВНОЕ</span>}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="sg-profile-specs-empty sg-garage-empty">
              <p>Фотографии пока не добавлены</p>
              <button type="button" onClick={() => setSection("photos")}>
                ДОБАВИТЬ
              </button>
            </div>
          )}
        </section>

        <section className="sg-profile-section sg-garage-show">
          <div className="sg-profile-section-heading sg-profile-section-heading--actions">
            <SectionHeading eyebrow="CAR BUILD" title="МОДИФИКАЦИИ" />
            {car.specs.length > 0 && (
              <button type="button" className="sg-profile-section-action" onClick={() => setSection("mods")}>
                <Edit3 aria-hidden /> EDIT
              </button>
            )}
          </div>
          {car.specs.length > 0 ? (
            <div className="sg-profile-build-list">
              {car.specs.map((spec, index) => (
                <div key={`${spec}-${index}`} className="sg-profile-build-row">
                  <span className="sg-build-hex" aria-hidden>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </span>
                  <strong>{spec}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="sg-profile-specs-empty">
              <p>Модификации пока не добавлены</p>
              <button type="button" onClick={() => setSection("mods")}>
                ДОБАВИТЬ
              </button>
            </div>
          )}
        </section>

        <section className="sg-profile-section sg-garage-show">
          <div className="sg-profile-section-heading sg-profile-section-heading--actions">
            <SectionHeading eyebrow="CAR BUILD" title="БИЛД / ИСТОРИЯ" />
            {historyGroups.length > 0 && (
              <button type="button" className="sg-profile-section-action" onClick={() => openHistory(null)}>
                <Edit3 aria-hidden /> EDIT
              </button>
            )}
          </div>
          {historyGroups.length > 0 ? (
            <div className="sg-build-timeline">
              {historyGroups.map((group) => (
                <div className="sg-build-year" key={group.year}>
                  <h4>{group.year}</h4>
                  <ol>
                    {group.entries.map((entry) => {
                      const TypeIcon = HISTORY_TYPE_ICON[entry.type];
                      return (
                        <li className="sg-build-event" key={entry.id}>
                          <div className="sg-build-event__head">
                            <span className={`sg-build-event__badge is-${entry.type}`}>
                              <TypeIcon aria-hidden />
                              {BUILD_HISTORY_TYPE_LABEL[entry.type]}
                            </span>
                            <time dateTime={entry.date}>{formatHistoryDay(entry.date)}</time>
                            <button
                              type="button"
                              className="sg-build-event__edit"
                              aria-label={`Редактировать ${entry.title}`}
                              onClick={() => openHistory(entry.id)}
                            >
                              EDIT
                            </button>
                          </div>
                          <strong>{entry.title}</strong>
                          {entry.description && <p>{entry.description}</p>}
                          {entry.photos && entry.photos.length > 0 && (
                            <div className="sg-build-event__photos">
                              {entry.photos.map((photo, index) => (
                                mediaSrc(photo) ? (
                                  <span className="sg-media-clip" key={`${entry.id}-${index}`}>
                                    <PositionedImage media={photo} alt="" />
                                  </span>
                                ) : (
                                  <span key={`${entry.id}-${index}`}>{typeof photo === "string" ? photo : ""}</span>
                                )
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          ) : (
            <div className="sg-profile-specs-empty">
              <p>История проекта пока пуста.</p>
              <button type="button" onClick={() => openHistory("add")}>
                ДОБАВИТЬ СОБЫТИЕ
              </button>
            </div>
          )}
        </section>
        </>
        ) : (
          <section className="sg-profile-section sg-garage-show sg-profile-car-card">
            <div className="sg-profile-section-heading">
              <SectionHeading eyebrow="REAL GARAGE" title="МОЙ АВТО" />
            </div>
            <div className="sg-profile-specs-empty">
              <p>Автомобиль ещё не добавлен.</p>
              <button type="button" onClick={() => setSection("car")}>
                ДОБАВИТЬ АВТО
              </button>
            </div>
          </section>
        )}

        <ReputationPanel progress={reputation} />

        <section className="sg-profile-section">
          <SectionHeading eyebrow="SOCIAL PROGRESS" title="ДОСТИЖЕНИЯ" icon={Trophy} />
          <div className="sg-profile-achievement-slot">
            <div className="sg-profile-achievement-slot__icon"><Trophy aria-hidden /></div>
            <div>
              <strong>{reputation.achievements > 0 ? `${reputation.achievements} получено` : "Пока нет достижений"}</strong>
              <span>Каталог достижений появится позже</span>
            </div>
          </div>
        </section>

        <section className="sg-profile-section" aria-label="Активность">
            <SectionHeading eyebrow="OWN HISTORY" title="АКТИВНОСТЬ" icon={MapPin} />
            {activityItems.length > 0 ? (
              <div className="sg-profile-activity">
                {activityItems.map((item) => {
                  if (item.type === "meet_visit") {
                    return (
                      <article key={item.id} className="sg-profile-activity__item">
                        <span className="sg-profile-activity__icon" aria-hidden>
                          <Flag />
                        </span>
                        <div className="sg-profile-activity__copy">
                          <div className="sg-profile-activity__main">
                            <span className="sg-profile-activity__kind">Мит</span>
                            <strong>Посетил {item.payload.title}</strong>
                          </div>
                          <div className="sg-profile-activity__meta">
                            <time dateTime={new Date(item.createdAt).toISOString()}>
                              {formatActivityTime(item.createdAt)}
                            </time>
                          </div>
                        </div>
                      </article>
                    );
                  }
                  const city = activityCityName(item.payload.spotId);
                  return (
                    <article key={item.id} className="sg-profile-activity__item">
                      <span className="sg-profile-activity__icon" aria-hidden>
                        <MapPin />
                      </span>
                      <div className="sg-profile-activity__copy">
                        <div className="sg-profile-activity__main">
                          <span className="sg-profile-activity__kind">Спот</span>
                          <strong>{item.payload.name}</strong>
                        </div>
                        <div className="sg-profile-activity__meta">
                          {city && <span>{city}</span>}
                          <time dateTime={new Date(item.createdAt).toISOString()}>
                            {formatActivityTime(item.createdAt)}
                          </time>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="sg-profile-empty">Пока нет посещений спотов</div>
            )}
          </section>

      </div>

      <GarageSectionEditor
          section={section}
          car={profile.car ?? EMPTY_GARAGE_CAR}
          historyIntent={historyIntent}
          onClose={() => {
            setSection(null);
            setHistoryIntent(null);
          }}
          onSave={(next) => updateCar(next)}
          onDelete={profile.car ? () => updateCar(null) : undefined}
        />
      <ProfileCoverEditor
          open={coverOpen}
          backgroundImage={profile.backgroundImage}
          nicknameColor={profile.nicknameColor}
          onClose={() => setCoverOpen(false)}
          onSave={(next, nicknameColor) => {
            updateProfile({ backgroundImage: next, nicknameColor });
            setCoverOpen(false);
          }}
        />
    </div>
  );
}

const HISTORY_TYPE_ICON: Record<BuildHistoryType, LucideIcon> = {
  purchase: KeyRound,
  modification: Wrench,
  service: Cog,
  milestone: Flag,
};

function buildHistoryGroups(entries: BuildHistoryEntry[] | undefined): { year: string; entries: BuildHistoryEntry[] }[] {
  const groups: { year: string; entries: BuildHistoryEntry[] }[] = [];
  for (const entry of sortBuildHistory(entries ?? [])) {
    const year = entry.date.slice(0, 4);
    const last = groups[groups.length - 1];
    if (!last || last.year !== year) groups.push({ year, entries: [entry] });
    else last.entries.push(entry);
  }
  return groups;
}

function formatHistoryDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function activityCityName(spotId: string): string | null {
  const spot = SPOTS.find((row) => row.id === spotId);
  if (!spot) return null;
  return CITIES.find((city) => city.id === spot.city)?.name ?? null;
}

function formatActivityTime(createdAt: number): string {
  return new Date(createdAt).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EMPTY_GARAGE_CAR: Car = {
  make: "",
  model: "",
  year: new Date().getFullYear(),
  hp: 0,
  specs: [],
  photos: [],
  photo: null,
};

function SectionHeading({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon?: LucideIcon }) {
  return (
    <div className="sg-profile-section-heading">
      <span>{eyebrow}</span>
      <h3>{Icon && <Icon aria-hidden />}{title}</h3>
    </div>
  );
}


