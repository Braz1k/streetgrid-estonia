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
    <section className="sg-profile-reputation">
      <div className="sg-profile-reputation__head">
        <div>
          <span>SOCIAL RANK</span>
          <h3>РЕПУТАЦИЯ</h3>
        </div>
        <ReputationBadge rank={rank} size="md" />
      </div>

      <div className="sg-profile-reputation__progress">
        <div className="sg-profile-reputation__progress-copy">
          <span>
            {next ? `До ${next.label}` : "MAX RANK"}
          </span>
          <strong style={{ color: rank.color }}>{pct}%</strong>
        </div>
        <div className="sg-profile-reputation__track">
          <div
            className="sg-profile-reputation__fill"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${rank.color}88, ${rank.color})`,
              boxShadow: `0 0 8px ${rank.color}66`,
            }}
          />
        </div>
        {next && (
          <p>
            Ещё {Math.max(0, nextNeed)} очков до {next.label}
          </p>
        )}
      </div>

      <div className="sg-profile-reputation__stats">
        {STAT_ROWS.map(({ key, label, icon: Icon, unit, weight }) => {
          const val = progress[key];
          const pts = Math.round(val * weight);
          return (
            <div key={key} className="sg-profile-reputation__stat">
              <div>
                <Icon style={{ color: rank.color }} />
                {label}
              </div>
              <strong>
                {unit ? `${Math.round(val)} ${unit}` : val}
              </strong>
              <span>+{pts} pts</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
