import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Bell, Menu, Settings } from "lucide-react";

export type StreetGridPremiumHeaderProps = {
  nickname: string;
  level: number;
  currentXP: number;
  requiredXP: number;
  online?: boolean;
  hasUnreadNotifications?: boolean;
  onNotifications?: () => void;
  onSettings?: () => void;
  onMenu?: () => void;
};

function formatXpNumber(value: number): string {
  return value.toLocaleString("fr-FR").replace(/\u202f/g, " ");
}

function getInitials(nickname: string): string {
  const raw = nickname.replace(/^@/, "").trim();
  if (!raw) return "NR";
  const parts = raw.split(/[_\-.]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

function InitialsAvatar({ initials, online }: { initials: string; online: boolean }) {
  return (
    <figure className="sg-mhdr__avatar" aria-label="Player avatar">
      <span className="sg-mhdr__initials">{initials}</span>
      {online ? (
        <span className="sg-mhdr__online" aria-label="Online" title="Online" />
      ) : null}
    </figure>
  );
}

function LevelHex({ level }: { level: number }) {
  return (
    <span className="sg-mhdr__hex lvl-badge-hex" aria-hidden>
      <svg viewBox="0 0 36 36" width="32" height="32" className="sg-mhdr__hex-svg" fill="none">
        <polygon
          points="18,3 30,9 30,27 18,33 6,27 6,9"
          fill="#0d0d1a"
          stroke="#00E5FF"
          strokeWidth="1.5"
        />
        <text x="18" y="19" textAnchor="middle" dominantBaseline="middle" className="sg-mhdr__hex-num">
          {level}
        </text>
      </svg>
    </span>
  );
}

function HeaderActionButton({
  icon: Icon,
  label,
  onClick,
  showDot = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  showDot?: boolean;
}) {
  return (
    <button
      type="button"
      className="sg-mhdr__action"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {showDot ? <span className="sg-mhdr__action-dot" aria-hidden /> : null}
      <Icon className="sg-mhdr__action-icon" strokeWidth={1.75} />
    </button>
  );
}

export function StreetGridPremiumHeader({
  nickname,
  level,
  currentXP,
  requiredXP,
  online = true,
  hasUnreadNotifications = false,
  onNotifications,
  onSettings,
  onMenu,
}: StreetGridPremiumHeaderProps) {
  const handle = nickname.startsWith("@") ? nickname : `@${nickname}`;
  const percent =
    requiredXP > 0
      ? Math.min(100, Math.max(0, (currentXP / requiredXP) * 100))
      : 0;

  return (
    <div className="sg-mhdr">
      <div className="sg-mhdr__row sg-mhdr__row--1">
        <InitialsAvatar initials={getInitials(nickname)} online={online} />

        <div className="sg-mhdr__intro">
          <h1 className="sg-mhdr__brand">
            <span className="sg-mhdr__brand-street">STREET</span>
            <span className="sg-mhdr__brand-accent">GRID</span>
          </h1>
          <div className="sg-mhdr__identity">
            <span className="sg-mhdr__nick">{handle}</span>
            <span className="sg-mhdr__verify" title="Verified">
              <BadgeCheck className="sg-mhdr__verify-icon" strokeWidth={2.5} />
            </span>
          </div>
        </div>

        <nav className="sg-mhdr__actions" aria-label="Header actions">
          <HeaderActionButton
            icon={Bell}
            label="Notifications"
            onClick={onNotifications}
            showDot={hasUnreadNotifications}
          />
          <HeaderActionButton
            icon={Settings}
            label="Settings"
            onClick={onSettings}
          />
          <HeaderActionButton icon={Menu} label="Menu" onClick={onMenu} />
        </nav>
      </div>

      <div className="sg-mhdr__row sg-mhdr__row--stats" aria-label="Level and experience">
        <LevelHex level={level} />
        <span className="sg-mhdr__lvl">LVL {level}</span>
        <div
          className="sg-mhdr__xp-track"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="sg-mhdr__xp-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="sg-mhdr__xp-values">
          {formatXpNumber(currentXP)} / {formatXpNumber(requiredXP)} XP
        </span>
        <span className="sg-mhdr__xp-pct">{Math.round(percent)}%</span>
      </div>
    </div>
  );
}
