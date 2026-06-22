import { Navigation } from "lucide-react";
import type { NavMode } from "@/lib/streetgrid/navMode";
import { NAV_MODE_ARIA } from "@/lib/streetgrid/navMode";

type Props = {
  mode:    NavMode;
  onClick: () => void;
};

/** Circular GPS nav — sized to align with SOS (48px). */
export function NavModeButton({ mode, onClick }: Props) {
  const label = NAV_MODE_ARIA[mode];

  return (
    <button
      type="button"
      onClick={onClick}
      data-nav={mode}
      aria-label={label}
      title={label}
      className="sg-nav-btn shrink-0 grid place-items-center rounded-full border-2 backdrop-blur-md active:scale-95 h-12 w-12"
    >
      <Navigation
        className="sg-nav-icon h-5 w-5"
        style={mode !== "FREE" ? { fill: "currentColor" } : undefined}
        strokeWidth={mode === "FREE" ? 1.85 : 2.25}
      />
    </button>
  );
}
