import {
  CalendarPlus,
  Car,
  Gauge,
  MapPin,
  Navigation,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import type { UserProfile } from "@/lib/streetgrid/data";
import { getPlayerAvatarUrl } from "@/lib/streetgrid/avatars";
import {
  computeReputationScore,
  getRankFromProgress,
  getRankProgressPercent,
} from "@/lib/streetgrid/reputation";
import { RARITY_META } from "@/lib/streetgrid/vehicles";

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
  const vehicle = `${user.car.year} ${user.car.make} ${user.car.model}`;
  const avatar = getPlayerAvatarUrl(user);
  const online = user.status !== "offline";
  const rank = getRankFromProgress(user.reputation);
  const repScore = computeReputationScore(user.reputation);
  const repPct = getRankProgressPercent(user.reputation);

  return (
    <div className="sg-player-card-root fixed inset-0 z-[850]" onClick={onClose}>
      <div className="sg-player-card-backdrop absolute inset-0" />

      <div
        className="sg-player-card absolute bottom-0 left-0 right-0 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          borderColor: `${rarity.color}44`,
          boxShadow: `0 -12px 64px ${rarity.color}14, 0 -1px 0 ${rarity.color}44`,
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
            className="sg-player-card__avatar-ring"
            style={{
              borderColor: rarity.color,
              boxShadow: `0 0 32px ${rarity.color}40, inset 0 0 24px ${rarity.color}10`,
            }}
          >
            <img src={avatar} alt="" className="sg-player-card__avatar" draggable={false} />
            {online && <span className="sg-player-card__online" title="Online" />}
          </div>

          <div className="sg-player-card__identity">
            <h2 className="sg-player-card__name">{user.handle}</h2>
            <div className="sg-player-card__badges">
              <span className="sg-player-card__level">LVL {user.level}</span>
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
            <span
              className="sg-player-card__rep-rank"
              style={{ color: rank.color }}
            >
              {rank.label}
            </span>
            <span className="sg-player-card__rep-score">{repScore.toLocaleString()} REP</span>
          </div>
          <div className="sg-player-card__rep-track" aria-hidden>
            <span
              className="sg-player-card__rep-fill"
              style={{
                width: `${repPct}%`,
                background: `linear-gradient(90deg, ${rank.color}88, ${rank.color})`,
                boxShadow: `0 0 12px ${rank.color}55`,
              }}
            />
          </div>
        </div>

        <div className="sg-player-card__stats">
          <div className="sg-player-card__stat">
            <Car className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={2} />
            <div className="min-w-0">
              <div className="sg-player-card__stat-label">Vehicle</div>
              <div className="sg-player-card__stat-value truncate">{vehicle}</div>
            </div>
          </div>
          <div className="sg-player-card__stat">
            <Gauge className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={2} />
            <div>
              <div className="sg-player-card__stat-label">Horsepower</div>
              <div className="sg-player-card__stat-value">{formatHp(user.car.hp)}</div>
            </div>
          </div>
          <div className="sg-player-card__stat sg-player-card__stat--wide">
            <MapPin className="h-4 w-4 text-accent shrink-0" strokeWidth={2} />
            <div>
              <div className="sg-player-card__stat-label">Distance</div>
              <div className="sg-player-card__stat-value sg-player-card__stat-value--accent">
                {formatDistance(distanceKm)}
              </div>
            </div>
          </div>
        </div>

        <div className="sg-player-card__actions">
          <ActionBtn
            icon={UserRound}
            label="View profile"
            onClick={() => onViewProfile(user.id)}
          />
          <ActionBtn
            icon={UserPlus}
            label="Add friend"
            onClick={() => onAddFriend(user)}
          />
          <ActionBtn
            icon={Navigation}
            label="Route"
            accent
            onClick={() => onRoute(user.location, user.handle)}
          />
          <ActionBtn
            icon={CalendarPlus}
            label="Invite to meetup"
            onClick={() => onInvite(user)}
          />
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
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}
