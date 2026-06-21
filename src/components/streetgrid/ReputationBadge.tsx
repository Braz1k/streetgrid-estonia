import type { RankDefinition } from "@/lib/streetgrid/reputation";
import { cn } from "@/lib/utils";

type Props = {
  rank: RankDefinition;
  size?: "xs" | "sm" | "md";
  className?: string;
};

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  xs: "text-[8px] px-1.5 py-0.5",
  sm: "text-[9px] px-2 py-0.5",
  md: "text-[10px] px-2.5 py-1",
};

export function ReputationBadge({ rank, size = "sm", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-display font-black tracking-widest rounded-full border",
        SIZE[size],
        className,
      )}
      style={{
        color: rank.color,
        borderColor: `${rank.color}55`,
        background: `${rank.color}18`,
        boxShadow: `0 0 12px ${rank.color}22`,
      }}
    >
      {rank.label.toUpperCase()}
    </span>
  );
}
