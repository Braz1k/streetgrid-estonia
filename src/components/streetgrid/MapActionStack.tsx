import { Building2, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavMode } from "@/lib/streetgrid/navMode";
import { NavModeButton } from "./NavModeButton";

type Props = {
  navMode: NavMode;
  onNavClick: () => void;
  buildingsVisible: boolean;
  onBuildingsClick: () => void;
  sosOpen: boolean;
  onSosClick: () => void;
};

/** Fixed map FABs — location · 3D buildings · SOS, right edge. */
export function MapActionStack({
  navMode,
  onNavClick,
  buildingsVisible,
  onBuildingsClick,
  sosOpen,
  onSosClick,
}: Props) {
  return (
    <>
      <NavModeButton mode={navMode} onClick={onNavClick} />
      <button
        type="button"
        onClick={onBuildingsClick}
        aria-label={buildingsVisible ? "Hide 3D buildings" : "Show 3D buildings"}
        aria-pressed={buildingsVisible}
        title={buildingsVisible ? "3D buildings on" : "3D buildings off"}
        className={cn(
          "sg-map-fab sg-map-fab--buildings",
          buildingsVisible && "sg-map-fab--buildings-active",
        )}
      >
        <Building2 className="sg-map-fab__buildings-icon" strokeWidth={2.1} aria-hidden />
        <span className="sg-map-fab__buildings-label">3D</span>
      </button>
      <button
        type="button"
        onClick={onSosClick}
        aria-label="SOS"
        aria-pressed={sosOpen}
        className={cn("sg-map-fab sg-map-fab--sos", sosOpen && "sg-map-fab--sos-active")}
      >
        <Siren className="sg-map-fab__sos-icon" strokeWidth={2.25} aria-hidden />
        <span className="sg-map-fab__sos-label">SOS</span>
      </button>
    </>
  );
}
