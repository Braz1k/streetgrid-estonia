import { cn } from "@/lib/utils";
import type { NavMode } from "@/lib/streetgrid/navMode";

type Props = {
  mode: NavMode;
  onClick: () => void;
  className?: string;
};

/** Location / compass — 52px rounded-square cyan glass FAB. */
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
      <span className="sg-map-fab__compass-icon" aria-hidden>
        ➤
      </span>
    </button>
  );
}
