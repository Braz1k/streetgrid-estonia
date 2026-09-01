import { memo } from "react";
import { cn } from "@/lib/utils";
import { MARKER_BADGE } from "./constants";

type BadgeBaseProps = {
  className?: string;
  label: string;
  title?: string;
  children?: React.ReactNode;
};

function MarkerBadge({
  badge,
  className,
  label,
  title,
  children,
}: BadgeBaseProps & { badge: keyof typeof MARKER_BADGE }) {
  const meta = MARKER_BADGE[badge];
  return (
    <span
      className={cn("sg-marker-badge", meta.className, className)}
      style={{ zIndex: meta.zIndex }}
      aria-label={label}
      title={title ?? label}
    >
      {children}
    </span>
  );
}

export const MarkerYouBadge = memo(function MarkerYouBadge() {
  return (
    <MarkerBadge badge="you" label="You">
      YOU
    </MarkerBadge>
  );
});

export const MarkerOnlineBadge = memo(function MarkerOnlineBadge() {
  return <MarkerBadge badge="online" label="Online" />;
});

export const MarkerFriendBadge = memo(function MarkerFriendBadge({
  visible = false,
}: {
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <MarkerBadge badge="friend" label="Friend">
      ★
    </MarkerBadge>
  );
});

export const MarkerLevelBadge = memo(function MarkerLevelBadge({
  level,
  wide,
}: {
  level: number;
  wide?: boolean;
}) {
  return (
    <MarkerBadge
      badge="level"
      label={`Level ${level}`}
      className={wide || level >= 10 ? "sg-marker-badge--level-wide" : undefined}
    >
      <svg viewBox="0 0 20 23" className="sg-marker-badge__level-hex" aria-hidden>
        <path d="M10 0 20 5.75V17.25L10 23 0 17.25V5.75Z" />
      </svg>
      <span className="sg-marker-badge__level-num">{level}</span>
    </MarkerBadge>
  );
});

/** Future slots — hidden until feature ships. */
export const MarkerDeveloperBadge = memo(function MarkerDeveloperBadge({
  visible = false,
}: {
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <MarkerBadge badge="developer" label="Developer">
      DEV
    </MarkerBadge>
  );
});

export const MarkerClubBadge = memo(function MarkerClubBadge({
  visible = false,
  label = "Club",
}: {
  visible?: boolean;
  label?: string;
}) {
  if (!visible) return null;
  return (
    <MarkerBadge badge="club" label={label}>
      {label.slice(0, 3).toUpperCase()}
    </MarkerBadge>
  );
});

export const MarkerVipBadge = memo(function MarkerVipBadge({
  visible = false,
}: {
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <MarkerBadge badge="vip" label="VIP">
      VIP
    </MarkerBadge>
  );
});

export type MarkerBadgeConfig = {
  you?: boolean;
  online?: boolean;
  level?: number;
  friend?: boolean;
  developer?: boolean;
  club?: boolean | string;
  vip?: boolean;
};

/** Render badges in fixed order: online → optional (YOU / level / …). */
export const MarkerBadgeLayer = memo(function MarkerBadgeLayer({
  badges,
  showLevel = false,
  isSelf = false,
}: {
  badges: MarkerBadgeConfig;
  showLevel?: boolean;
  isSelf?: boolean;
}) {
  const levelVisible =
    badges.level != null && (isSelf || showLevel);
  const level = badges.level ?? 1;

  return (
    <>
      {badges.online && <MarkerOnlineBadge />}
      {badges.you && <MarkerYouBadge />}
      {levelVisible && (
        <MarkerLevelBadge level={level} wide={level >= 10} />
      )}
      {badges.friend && <MarkerFriendBadge visible />}
      {badges.developer && <MarkerDeveloperBadge visible />}
      {typeof badges.club === "string" && (
        <MarkerClubBadge visible label={badges.club} />
      )}
      {badges.club === true && <MarkerClubBadge visible />}
      {badges.vip && <MarkerVipBadge visible />}
    </>
  );
});
