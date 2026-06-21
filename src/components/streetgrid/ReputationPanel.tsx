import type { ReputationProgress } from "@/lib/streetgrid/reputation";
import {
  computeReputationScore,
  getNextRank,
  getRankFromProgress,
  getRankProgressPercent,
  REPUTATION_WEIGHTS,
} from "@/lib/streetgrid/reputation";
import { ReputationBadge } from "./ReputationBadge";
import { MapPin, Trophy, Users, Gauge } from "lucide-react";

type Props = {
  progress: ReputationProgress;
};

const STAT_ROWS = [
  { key: "distanceKm" as const,   label: "Дистанция", icon: Gauge,  unit: "км",  weight: REPUTATION_WEIGHTS.distanceKm },
  { key: "events" as const,       label: "Ивенты",    icon: Users,  unit: "",    weight: REPUTATION_WEIGHTS.events },
  { key: "spots" as const,        label: "Споты",     icon: MapPin, unit: "",    weight: REPUTATION_WEIGHTS.spots },
  { key: "achievements" as const, label: "Ачивки",    icon: Trophy, unit: "",    weight: REPUTATION_WEIGHTS.achievements },
];

export function ReputationPanel({ progress }: Props) {
  const rank     = getRankFromProgress(progress);
  const next     = getNextRank(rank);
  const pct      = getRankProgressPercent(progress);
  const score    = computeReputationScore(progress);
  const nextNeed = next ? next.minScore - score : 0;

  return (
    <section className="glass rounded-2xl p-4 border border-white/5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-display font-black text-sm">РЕПУТАЦИЯ</h3>
        <ReputationBadge rank={rank} size="md" />
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-muted-foreground tracking-wider">
            {next ? `До ${next.label}` : "MAX RANK"}
          </span>
          <span className="font-bold" style={{ color: rank.color }}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${rank.color}88, ${rank.color})`,
              boxShadow: `0 0 8px ${rank.color}66`,
            }}
          />
        </div>
        {next && (
          <p className="text-[9px] text-muted-foreground mt-1">
            Ещё {Math.max(0, nextNeed)} очков до {next.label}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STAT_ROWS.map(({ key, label, icon: Icon, unit, weight }) => {
          const val = progress[key];
          const pts = Math.round(val * weight);
          return (
            <div key={key} className="rounded-xl bg-white/5 border border-white/5 px-2.5 py-2">
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground tracking-wider">
                <Icon className="h-3 w-3" style={{ color: rank.color }} />
                {label}
              </div>
              <div className="font-display font-black text-sm mt-0.5">
                {unit ? `${Math.round(val)} ${unit}` : val}
              </div>
              <div className="text-[9px] text-muted-foreground">+{pts} pts</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
