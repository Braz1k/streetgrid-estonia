import { cn } from "@/lib/utils";
import type { NavMode } from "@/lib/streetgrid/navMode";

type Props = {
  mode: NavMode;
  onClick: () => void;
  className?: string;
};

/** Location — 44px cyan glass circle, compact recenter locator. */
export function NavModeButton({
  mode,
  onClick,
  className,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-nav={mode}
      aria-label="Center on your location"
      title="Center on your location"
      className={cn("sg-map-fab sg-map-fab--compass", className)}
    >
      <svg
        className="sg-map-fab__compass-icon"
        viewBox="0 0 20 20"
        aria-hidden
      >
        <path
          d="M1.7 8.2A8.5 8.5 0 0 0 5 3.1M15 3.1A8.5 8.5 0 0 1 18.3 8.2M13.2 17.9A8.5 8.5 0 0 1 6.8 17.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M10 5 13.6 15 10 12.55 6.4 15ZM10 10.6m-.8 0a.8.8 0 1 0 1.6 0a.8.8 0 1 0-1.6 0"
        />
      </svg>
    </button>
  );
}
