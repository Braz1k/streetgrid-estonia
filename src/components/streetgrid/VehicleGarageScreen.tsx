import { useState } from "react";
import { createPortal } from "react-dom";
import { Lock, Zap, Check, X } from "lucide-react";
import { useStreetGrid } from "@/lib/streetgrid/store";
import {
  VEHICLE_CATALOG,
  RARITY_META,
  formatUnlockRequirement,
  getVehicleById,
  type VehicleDefinition,
  type OwnedVehicle,
} from "@/lib/streetgrid/vehicles";
import { getRarityUiBorder } from "@/lib/streetgrid/markerRendering";

type Props = {
  onBack?: () => void;
};

export function VehicleGarageScreen({ onBack }: Props) {
  const { vehicleProgress, selectedCarId, equipVehicle, getOwnedVehicle } = useStreetGrid();
  const [detailId, setDetailId] = useState<string | null>(null);

  const ownedIds   = new Set(vehicleProgress.owned.map((o) => o.vehicleId));
  const ownedList  = vehicleProgress.owned
    .map((o) => ({ owned: o, def: getVehicleById(o.vehicleId)! }))
    .filter((x) => x.def);
  const lockedList = VEHICLE_CATALOG.filter((v) => !ownedIds.has(v.id));
  const ownedCards = [...ownedList].sort((a, b) => {
    const aEquipped = a.def.id === selectedCarId ? 0 : 1;
    const bEquipped = b.def.id === selectedCarId ? 0 : 1;
    return aEquipped - bEquipped;
  });

  const detailDef   = detailId ? getVehicleById(detailId) : null;
  const detailOwned = detailId ? getOwnedVehicle(detailId) : undefined;
  const shell = typeof document !== "undefined" ? document.querySelector(".sg-app-shell") : null;

  return (
    <div className="sg-garage animate-float-up">
      <div className="sg-garage__topline">
        <h2 className="sg-garage__title">КОЛЛЕКЦИЯ</h2>
        {onBack && (
          <button type="button" className="sg-garage__back" onClick={onBack}>
            ← НАЗАД
          </button>
        )}
      </div>

      <EquippedHero
        vehicle={getVehicleById(selectedCarId)!}
        owned={getOwnedVehicle(selectedCarId)}
      />

      <section className="sg-garage-section">
        <SectionHeader title="МОИ АВТО" count={ownedList.length} />
        <div className="sg-garage-list">
          {ownedCards.map(({ owned, def }) => (
            <VehicleCard
              key={def.id}
              def={def}
              owned={owned}
              equipped={selectedCarId === def.id}
              onSelect={() => setDetailId(def.id)}
              onEquip={() => equipVehicle(def.id)}
            />
          ))}
        </div>
      </section>

      <section className="sg-garage-section">
        <SectionHeader title="ЗАБЛОКИРОВАНО" count={lockedList.length} muted />
        <div className="sg-garage-list">
          {lockedList.map((def) => (
            <LockedVehicleCard
              key={def.id}
              def={def}
              onSelect={() => setDetailId(def.id)}
            />
          ))}
        </div>
      </section>

      {detailDef && shell && createPortal(
        <VehicleDetailSheet
          def={detailDef}
          owned={detailOwned}
          equipped={selectedCarId === detailDef.id}
          onClose={() => setDetailId(null)}
          onEquip={() => { equipVehicle(detailDef.id); setDetailId(null); }}
        />,
        shell,
      )}
    </div>
  );
}

function plateStyle(vehicle: VehicleDefinition) {
  return {
    background: `radial-gradient(circle at 50% 42%, ${vehicle.color}38, rgba(8, 10, 16, 0.92) 72%)`,
    borderColor: getRarityUiBorder(vehicle.rarity),
  };
}

function RarityBadge({ vehicle }: { vehicle: VehicleDefinition }) {
  const rarity = RARITY_META[vehicle.rarity];
  return (
    <span
      className="sg-garage-rarity"
      style={{
        color: rarity.color,
        borderColor: getRarityUiBorder(vehicle.rarity),
        background: `${rarity.color}18`,
      }}
    >
      {rarity.label.toUpperCase()}
    </span>
  );
}

function EquippedHero({ vehicle, owned }: { vehicle: VehicleDefinition; owned?: OwnedVehicle }) {
  return (
    <div className="sg-garage-hero">
      <div className="sg-garage-plate" style={plateStyle(vehicle)} aria-hidden>
        {vehicle.emoji}
      </div>
      <div className="sg-garage-hero__copy">
        <div className="sg-garage-hero__kicker">МОЙ АВТО</div>
        <RarityBadge vehicle={vehicle} />
        <h3 className="sg-garage-hero__name">{vehicle.name}</h3>
        <div className="sg-garage-hero__meta">
          <span>LVL {owned?.level ?? 1}</span>
          <span>·</span>
          <span>{vehicle.stats.power} HP</span>
          <span>·</span>
          <span className="sg-garage-hero__live">
            <Zap className="h-3 w-3" /> В ЭФИРЕ
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count, muted }: { title: string; count: number; muted?: boolean }) {
  return (
    <div className="sg-garage-section__head">
      <h3 className={`sg-garage-section__title${muted ? " sg-garage-section__title--muted" : ""}`}>
        {title}
      </h3>
      <span className="sg-garage-section__count">{count}</span>
    </div>
  );
}

function VehicleCard({
  def, owned, equipped, onSelect, onEquip,
}: {
  def: VehicleDefinition;
  owned: OwnedVehicle;
  equipped: boolean;
  onSelect: () => void;
  onEquip: () => void;
}) {
  return (
    <div className={`sg-garage-card${equipped ? " sg-garage-card--active" : ""}`}>
      <button type="button" onClick={onSelect} className="sg-garage-card__open">
        <div className="sg-garage-plate" style={plateStyle(def)} aria-hidden>
          {def.emoji}
        </div>
        <div className="sg-garage-card__copy">
          <div className="sg-garage-card__title-row">
            <span className="sg-garage-card__name">{def.name}</span>
            <RarityBadge vehicle={def} />
          </div>
          <div className="sg-garage-card__meta">
            LVL {owned.level} · {def.stats.power} HP
          </div>
        </div>
      </button>
      <div className="sg-garage-card__action">
        {equipped ? (
          <span className="sg-garage-check" aria-label="Экипирован">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : (
          <button type="button" onClick={onEquip} className="sg-garage-equip">
            ВЫБРАТЬ
          </button>
        )}
      </div>
    </div>
  );
}

function LockedVehicleCard({ def, onSelect }: { def: VehicleDefinition; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="sg-garage-card sg-garage-card--locked">
      <div className="sg-garage-plate sg-garage-plate--locked" style={plateStyle(def)} aria-hidden>
        {def.emoji}
      </div>
      <div className="sg-garage-card__copy">
        <div className="sg-garage-card__title-row">
          <span className="sg-garage-card__name">{def.name}</span>
          <RarityBadge vehicle={def} />
        </div>
        <div className="sg-garage-card__meta">
          <Lock className="h-3 w-3 shrink-0" />
          {formatUnlockRequirement(def.unlock)}
        </div>
      </div>
    </button>
  );
}

function VehicleDetailSheet({
  def, owned, equipped, onClose, onEquip,
}: {
  def: VehicleDefinition;
  owned?: OwnedVehicle;
  equipped: boolean;
  onClose: () => void;
  onEquip: () => void;
}) {
  const locked = !owned;

  return (
    <div className="sg-garage-detail" onClick={onClose}>
      <div className="sg-garage-detail__backdrop" />
      <div
        className="sg-garage-detail__sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sg-garage-detail__handle" />
        <div className="sg-garage-detail__head">
          <div className="sg-garage-detail__copy">
            <RarityBadge vehicle={def} />
            <h3 className="sg-garage-detail__name">{def.name}</h3>
            <p className="sg-garage-detail__sub">{def.description}</p>
          </div>
          <button type="button" onClick={onClose} className="sg-garage-detail__close" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="sg-garage-detail__visual" style={plateStyle(def)} aria-hidden>
          {def.emoji}
        </div>

        <div className="sg-garage-detail__stats">
          <StatBox label="МОЩНОСТЬ" value={`${def.stats.power} HP`} />
          <StatBox label="УПРАВЛ." value={String(def.stats.handling)} />
          <StatBox label="СТИЛЬ" value={String(def.stats.style)} />
        </div>

        <div className="sg-garage-detail__progress">
          {locked ? (
            <>
              <div className="sg-garage-detail__progress-label">ТРЕБОВАНИЕ</div>
              <div className="sg-garage-detail__progress-value">
                <Lock className="h-3.5 w-3.5" />
                {formatUnlockRequirement(def.unlock)}
              </div>
              {def.unlock.type === "achievement" && (
                <p className="sg-garage-detail__soon">
                  Достижения скоро — ID: {def.unlock.achievementId}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="sg-garage-detail__progress-label">ПРОГРЕСС</div>
              <div className="sg-garage-detail__progress-value">
                Уровень {owned!.level} · {owned!.xp} XP
              </div>
            </>
          )}
        </div>

        {def.relatedAchievementIds && def.relatedAchievementIds.length > 0 && (
          <div className="sg-garage-detail__achievements">
            <div className="sg-garage-detail__progress-label">ДОСТИЖЕНИЯ</div>
            {def.relatedAchievementIds.map((id) => (
              <div key={id} className="sg-garage-detail__achievement">
                <Lock className="h-3 w-3" /> {id} — скоро
              </div>
            ))}
          </div>
        )}

        {!locked && !equipped && (
          <button type="button" onClick={onEquip} className="sg-garage-cta">
            ВЫБРАТЬ НА КАРТЕ
          </button>
        )}
        {!locked && equipped && (
          <div className="sg-garage-cta-state">
            <Check className="h-4 w-4" /> АКТИВНА НА КАРТЕ
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="sg-garage-stat">
      <div className="sg-garage-stat__label">{label}</div>
      <div className="sg-garage-stat__value">{value}</div>
    </div>
  );
}
