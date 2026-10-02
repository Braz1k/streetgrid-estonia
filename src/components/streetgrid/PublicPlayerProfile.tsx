import { CalendarPlus, Navigation, Trophy, UserPlus } from "lucide-react";
import { BUILD_HISTORY_TYPE_LABEL, USERS, sortBuildHistory, type UserProfile } from "@/lib/streetgrid/data";
import { mediaSrc } from "@/lib/streetgrid/media";
import { nicknameColorValue } from "@/lib/streetgrid/nickname";
import { getRankFromProgress } from "@/lib/streetgrid/reputation";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { RARITY_META } from "@/lib/streetgrid/vehicles";
import { ReputationBadge } from "./ReputationBadge";
import { ReputationPanel } from "./ReputationPanel";
import { PositionedImage } from "./PositionedImage";

type Props = {
  userId: string;
  onRoute: (coords: [number, number], name: string) => void;
};

/** Read-only destination for another player. Never reads the signed-in profile. */
export function PublicPlayerProfile({ userId, onRoute }: Props) {
  const { pushChat } = useStreetGrid();
  const user = USERS.find((entry) => entry.id === userId) ?? null;

  if (!user) {
    return (
      <div className="sg-profile sg-public-profile">
        <p className="sg-public-note">Профиль игрока недоступен.</p>
      </div>
    );
  }

  const car = user.car;
  const reputation = user.reputation;
  const rank = getRankFromProgress(reputation);
  const rarity = RARITY_META[user.rarity];
  const nicknameColor = nicknameColorValue(user.nicknameColor);
  const status = user.status === "moving" ? "В движении" : user.status === "spot" ? "На споте" : "Не в сети";
  const realPhoto = (car.photo && mediaSrc(car.photo) ? car.photo : null) ?? car.photos.find((photo) => mediaSrc(photo)) ?? null;
  const emojiFallback = car.photos.find((photo): photo is string => typeof photo === "string" && !mediaSrc(photo));
  const gallery = car.photos.filter((photo) => mediaSrc(photo));
  const specs = SPEC_ROWS.flatMap((field) => {
    const value = car.specifications?.[field.key]?.trim();
    return value ? [{ ...field, value }] : [];
  });
  const hasVehicle = Boolean(car.make.trim() && car.model.trim());
  const history = sortBuildHistory(car.buildHistory ?? []);

  return (
    <div className="sg-profile sg-public-profile">
      <header className="sg-public-head">
        <div className="sg-profile-avatar">
          <div className="sg-profile-avatar__face">
            {mediaSrc(user.avatar) ? <img src={mediaSrc(user.avatar)!} alt="" /> : user.avatar}
          </div>
        </div>
        <div className="sg-profile-identity-copy">
          <h1 style={{ color: nicknameColor }}>{user.handle}</h1>
          <div className="sg-profile-identity-copy__badges">
            <span className="sg-profile-level">LVL {user.level}</span>
            <ReputationBadge rank={rank} size="sm" />
            <span
              className="sg-profile-rarity"
              style={{ color: rarity.color, borderColor: rarity.border, background: `${rarity.color}16` }}
            >
              {rarity.label.toUpperCase()}
            </span>
          </div>
          <div className="sg-profile-status">{status}</div>
        </div>
      </header>

      <div className="sg-public-actions">
        <button type="button" className="sg-public-action" onClick={() => sendFriend(pushChat, user)}>
          <UserPlus aria-hidden />
          <span>ДРУГ</span>
        </button>
        <button type="button" className="sg-public-action sg-public-action--accent" onClick={() => onRoute(user.location, user.handle)}>
          <Navigation aria-hidden />
          <span>МАРШРУТ</span>
        </button>
        <button type="button" className="sg-public-action sg-public-action--wide" onClick={() => sendInvite(pushChat, user)}>
          <CalendarPlus aria-hidden />
          <span>ПРИГЛАСИТЬ НА МИТ</span>
        </button>
      </div>

      <div className="sg-profile-body">
        <section className="sg-profile-section sg-garage-show sg-profile-car-card">
          <div className="sg-profile-section-heading">
            <span>GARAGE</span>
            <h3>АВТО</h3>
          </div>
          {hasVehicle ? (
            <>
              <div className="sg-profile-car-card__stage">
                {realPhoto ? (
                  <PositionedImage media={realPhoto} alt={`${car.make} ${car.model}`} />
                ) : (
                  <div className="sg-profile-car-fallback">
                    <span>{emojiFallback ?? "🚗"}</span>
                  </div>
                )}
              </div>
              <div className="sg-profile-car-card__copy">
                <h2><span>{car.make}</span>{car.model}</h2>
                <p>{car.year} · {car.hp} HP · {car.specs.length} мод.</p>
              </div>
            </>
          ) : (
            <p className="sg-public-note">Автомобиль не указан</p>
          )}
        </section>

        {specs.length > 0 ? (
          <section className="sg-profile-section sg-garage-show">
            <div className="sg-profile-section-heading">
              <span>CAR SPECS</span>
              <h3>ХАРАКТЕРИСТИКИ</h3>
            </div>
            <dl className="sg-profile-spec-grid">
              {specs.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : (
          <p className="sg-public-note">Технические данные не указаны.</p>
        )}

        {gallery.length > 0 ? (
          <section className="sg-profile-section sg-garage-show">
            <div className="sg-profile-section-heading">
              <span>REAL CAR MEDIA</span>
              <h3>ГАЛЕРЕЯ</h3>
            </div>
            <div className="sg-profile-gallery">
              {gallery.map((photo, index) => (
                <div className={`sg-profile-gallery__item${index === 0 ? " is-primary" : ""}`} key={`${index}-${mediaSrc(photo)}`}>
                  <PositionedImage media={photo} alt={`${car.make} ${car.model}, фото ${index + 1}`} />
                  {index === 0 && <span className="sg-profile-gallery__primary">ОСНОВНОЕ</span>}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="sg-public-note">Фотографии пока не добавлены</p>
        )}

        {car.specs.length > 0 ? (
          <section className="sg-profile-section sg-garage-show">
            <div className="sg-profile-section-heading">
              <span>CAR BUILD</span>
              <h3>МОДИФИКАЦИИ</h3>
            </div>
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
          </section>
        ) : (
          <p className="sg-public-note">Модификации пока не добавлены</p>
        )}

        {history.length > 0 ? (
          <section className="sg-profile-section sg-garage-show">
            <div className="sg-profile-section-heading">
              <span>CAR BUILD</span>
              <h3>БИЛД / ИСТОРИЯ</h3>
            </div>
            <ol className="sg-public-history">
              {history.map((entry) => (
                <li key={entry.id}>
                  <span>{BUILD_HISTORY_TYPE_LABEL[entry.type]}</span>
                  <strong>{entry.title}</strong>
                  <time dateTime={entry.date}>{entry.date}</time>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <p className="sg-public-note">История проекта пока пуста.</p>
        )}

        <ReputationPanel progress={reputation} />

        <section className="sg-profile-section">
          <div className="sg-profile-section-heading">
            <span>SOCIAL PROGRESS</span>
            <h3><Trophy aria-hidden />ДОСТИЖЕНИЯ</h3>
          </div>
          <div className="sg-profile-achievement-slot">
            <div className="sg-profile-achievement-slot__icon"><Trophy aria-hidden /></div>
            <div>
              <strong>{reputation.achievements > 0 ? `${reputation.achievements} получено` : "Пока нет достижений"}</strong>
              <span>Каталог достижений появится позже</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const SPEC_ROWS = [
  { key: "engine" as const, label: "ДВИГАТЕЛЬ" },
  { key: "fuel" as const, label: "ТОПЛИВО" },
  { key: "displacement" as const, label: "ОБЪЁМ" },
  { key: "cylinders" as const, label: "ЦИЛИНДРЫ" },
  { key: "induction" as const, label: "НАДДУВ" },
  { key: "drivetrain" as const, label: "ПРИВОД" },
  { key: "transmission" as const, label: "КОРОБКА" },
  { key: "torque" as const, label: "МОМЕНТ" },
  { key: "zeroTo100" as const, label: "0–100 КМ/Ч" },
  { key: "topSpeed" as const, label: "МАКС. СКОРОСТЬ" },
];

function sendFriend(pushChat: ReturnType<typeof useStreetGrid>["pushChat"], user: UserProfile) {
  pushChat({
    city: "tallinn",
    user: "SYSTEM",
    text: `${user.handle} added to friends`,
    time: "now",
  });
}

function sendInvite(pushChat: ReturnType<typeof useStreetGrid>["pushChat"], user: UserProfile) {
  pushChat({
    city: "tallinn",
    user: "SYSTEM",
    text: `Meetup invite sent to ${user.handle}`,
    time: "now",
  });
}
