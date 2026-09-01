import { memo, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { VehicleRarity } from "@/lib/streetgrid/vehicles";
import {
  getMarkerRingClasses,
  getUniformPlayerRingClasses,
  resolveMarkerRingStyle,
  type RingVariant,
} from "./ringPipeline";

export type MarkerRingProps = {
  rarity: VehicleRarity;
  isSelf?: boolean;
  variant?: RingVariant;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  badges?: ReactNode;
};

/**
 * Player marker frame — fixed construction for every tier:
 * glow → ring → avatar (children) → badges
 */
export const MarkerRing = memo(function MarkerRing({
  rarity,
  isSelf = false,
  variant = "player",
  className,
  style,
  children,
  badges,
}: MarkerRingProps) {
  const ringStyle = { ...resolveMarkerRingStyle(rarity, { isSelf, variant }), ...style };

  if (variant === "player") {
    return (
      <div className={cn("sg-marker__frame", className)} style={ringStyle}>
        <div className="sg-marker__glow" aria-hidden />
        <div className={cn(getUniformPlayerRingClasses())}>
          <div className="sg-marker-ring__inner">{children}</div>
        </div>
        {badges}
      </div>
    );
  }

  return (
    <div
      className={cn(getMarkerRingClasses(rarity, { isSelf, variant }), className)}
      style={ringStyle}
    >
      <div className="sg-marker-ring__inner">{children}</div>
      {badges}
    </div>
  );
});
