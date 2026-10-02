import {
  CalendarPlus,
  Navigation,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { UserProfile } from "@/lib/streetgrid/data";
import { getPlayerAvatarUrl } from "@/lib/streetgrid/avatars";
import {
  computeReputationScore,
  getRankFromProgress,
  getRankProgressPercent,
} from "@/lib/streetgrid/reputation";
import { RARITY_META } from "@/lib/streetgrid/vehicles";
import { getRarityRingCssProperties } from "@/lib/streetgrid/markerRendering";

export type PlayerCardSheetProps = {
  user: UserProfile | null;
  distanceKm: number | null;
  onClose: () => void;
  onViewProfile: (userId: string) => void;
  onInvite: (user: UserProfile) => void;
  onRoute: (coords: [number, number], name: string) => void;
  onAddFriend: (user: UserProfile) => void;
};

function formatDistance(km: number | null): string {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatHp(hp: number): string {
  return `${hp.toLocaleString()} HP`;
}

function hasVehicle(user: UserProfile): boolean {
  return Boolean(user.car?.make?.trim() && user.car?.model?.trim());
}

export function PlayerCardSheet({
  user,
  distanceKm,
  onClose,
  onViewProfile,
  onInvite,
  onRoute,
  onAddFriend,
}: PlayerCardSheetProps) {
  if (!user) return null;

  const rarity = RARITY_META[user.rarity];
  const avatar = getPlayerAvatarUrl(user);
  const online = user.status !== "offline";
  const rank = getRankFromProgress(user.reputation);
  const repScore = computeReputationScore(user.reputation);
  const repPct = getRankProgressPercent(user.reputation);
  const vehicleReady = hasVehicle(user);

  return (
    <div className="sg-player-card-root" onClick={onClose}>
      <div className="sg-player-card-backdrop" />

      <div
        className="sg-player-card"
        role="dialog"
        aria-label={user.handle}
        onClick={(event) => event.stopPropagation()}
        style={{
          borderColor: `${rarity.color}55`,
          boxShadow: `0 16px 40px rgba(0, 0, 0, 0.45), 0 0 18px ${rarity.color}18`,
        }}
      >
        <div className="sg-player-card__handle" aria-hidden />

        <button
          type="button"
          onClick={onClose}
          className="sg-player-card__close"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="sg-player-card__hero">
          <div
            className="sg-player-card__avatar-ring sg-rarity-ring sg-rarity-ring--card"
            style={{
              ...getRarityRingCssProperties(user.rarity),
              borderColor: rarity.color,
            } as CSSProperties}
          >
            <img src={avatar} alt="" className="sg-player-card__avatar" draggable={false} />
            {online && <span className="sg-player-card__online" title="Online" />}
          </div>

          <div className="sg-player-card__identity">
            <h2 className="sg-player-card__name">{user.handle}</h2>
            <div className="sg-player-card__badges">
              <span className="sg-player-card__level">LVL {user.level}</span>
              <span className="sg-player-card__rank" style={{ color: rank.color, borderColor: `${rank.color}66` }}>
                {rank.label}
              </span>
              <span
                className="sg-player-card__rarity"
                style={{
                  color: rarity.color,
                  borderColor: `${rarity.color}66`,
                  background: `${rarity.color}14`,
                }}
              >
                {rarity.label.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="sg-player-card__reputation">
          <div className="sg-player-card__rep-head">
            <span className="sg-player-card__rep-rank" style={{ color: rank.color }}>
              {rank.label}
            </span>
            <span className="sg-player-card__rep-score">{repScore.toLocaleString()} REP</span>
          </div>
          <div className="sg-player-card__rep-track" aria-hidden>
            <span
              className="sg-player-card__rep-fill"
              style={{
                width: `${repPct}%`,
                background: rank.color,
              }}
            />
          </div>
        </div>

        <div className="sg-player-card__stats">
          {vehicleReady ? (
            <>
              <div className="sg-player-card__stat">
                <div className="sg-player-card__stat-label">Vehicle</div>
                <div className="sg-player-card__stat-value">
                  {user.car.year} {user.car.make} {user.car.model}
                </div>
              </div>
              <div className="sg-player-card__stat">
                <div className="sg-player-card__stat-label">Horsepower</div>
                <div className="sg-player-card__stat-value">{formatHp(user.car.hp)}</div>
              </div>
            </>
          ) : (
            <div className="sg-player-card__stat sg-player-card__stat--wide">
              <div className="sg-player-card__stat-label">Vehicle</div>
              <div className="sg-player-card__stat-value sg-player-card__stat-value--empty">
                Автомобиль не указан
              </div>
            </div>
          )}
          <div className="sg-player-card__stat sg-player-card__stat--wide">
            <div className="sg-player-card__stat-label">Distance</div>
            <div className="sg-player-card__stat-value sg-player-card__stat-value--accent">
              {formatDistance(distanceKm)}
            </div>
          </div>
        </div>

        <div className="sg-player-card__actions">
          <ActionBtn icon={UserRound} label="ПРОФИЛЬ" onClick={() => onViewProfile(user.id)} />
          <ActionBtn icon={UserPlus} label="ДРУГ" onClick={() => onAddFriend(user)} />
          <ActionBtn
            icon={Navigation}
            label="МАРШРУТ"
            accent
            onClick={() => onRoute(user.location, user.handle)}
          />
          <ActionBtn icon={CalendarPlus} label="ПРИГЛАСИТЬ НА МИТ" onClick={() => onInvite(user)} />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  accent,
  onClick,
}: {
  icon: typeof UserRound;
  label: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={accent ? "sg-player-card__action sg-player-card__action--accent" : "sg-player-card__action"}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}
