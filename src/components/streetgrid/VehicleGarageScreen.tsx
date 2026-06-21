import { useState } from "react";
import { Lock, Zap, Check, X, ChevronRight } from "lucide-react";
import { useStreetGrid } from "@/lib/streetgrid/store";
import {
  VEHICLE_CATALOG,
  RARITY_META,
  formatUnlockRequirement,
  getVehicleById,
  type VehicleDefinition,
  type OwnedVehicle,
} from "@/lib/streetgrid/vehicles";

export function VehicleGarageScreen() {
  const { vehicleProgress, selectedCarId, equipVehicle, getOwnedVehicle } = useStreetGrid();
  const [detailId, setDetailId] = useState<string | null>(null);

  const ownedIds   = new Set(vehicleProgress.owned.map((o) => o.vehicleId));
  const ownedList  = vehicleProgress.owned
    .map((o) => ({ owned: o, def: getVehicleById(o.vehicleId)! }))
    .filter((x) => x.def);
  const lockedList = VEHICLE_CATALOG.filter((v) => !ownedIds.has(v.id));

  const detailDef   = detailId ? getVehicleById(detailId) : null;
  const detailOwned = detailId ? getOwnedVehicle(detailId) : undefined;

  return (
    <div className="pb-28 animate-float-up overflow-y-auto max-h-[calc(100dvh-140px)]">
      {/* Hero — equipped vehicle */}
      <EquippedHero
        vehicle={getVehicleById(selectedCarId)!}
        owned={getOwnedVehicle(selectedCarId)}
      />

      <div className="px-4 space-y-5 -mt-6 relative z-10">
        {/* Owned Vehicles */}
        <section>
          <SectionHeader title="МОИ АВТО" count={ownedList.length} />
          <div className="space-y-2">
            {ownedList.map(({ owned, def }) => (
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

        {/* Locked Vehicles */}
        <section>
          <SectionHeader title="ЗАБЛОКИРОВАНО" count={lockedList.length} muted />
          <div className="space-y-2">
            {lockedList.map((def) => (
              <LockedVehicleCard
                key={def.id}
                def={def}
                onSelect={() => setDetailId(def.id)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Vehicle Details sheet */}
      {detailDef && (
        <VehicleDetailSheet
          def={detailDef}
          owned={detailOwned}
          equipped={selectedCarId === detailDef.id}
          onClose={() => setDetailId(null)}
          onEquip={() => { equipVehicle(detailDef.id); setDetailId(null); }}
        />
      )}
    </div>
  );
}

function EquippedHero({ vehicle, owned }: { vehicle: VehicleDefinition; owned?: OwnedVehicle }) {
  const rarity = RARITY_META[vehicle.rarity];
  return (
    <div
      className="relative h-48 overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${vehicle.color}22 0%, #0a0b14 100%)` }}
    >
      <div className="absolute inset-0 grid place-items-center text-[100px] opacity-80">{vehicle.emoji}</div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4">
        <span
          className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full border"
          style={{ color: rarity.color, borderColor: rarity.border, background: `${rarity.color}18` }}
        >
          {rarity.label.toUpperCase()}
        </span>
        <h1 className="font-display text-xl font-black mt-1.5">{vehicle.name}</h1>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
          <span className="text-accent font-bold">LVL {owned?.level ?? 1}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-accent" /> В ЭФИРЕ</span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count, muted }: { title: string; count: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h2 className={`font-display font-black text-xs tracking-widest ${muted ? "text-muted-foreground" : ""}`}>
        {title}
      </h2>
      <span className="text-[10px] text-muted-foreground">{count}</span>
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
  const rarity = RARITY_META[def.rarity];
  return (
    <div
      className="glass-strong rounded-2xl p-3 flex items-center gap-3 border transition"
      style={{
        borderColor: equipped ? `${def.color}66` : "rgba(255,255,255,0.08)",
        boxShadow:   equipped ? `0 0 16px ${def.color}22` : undefined,
      }}
    >
      <button onClick={onSelect} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div
          className="shrink-0 w-12 h-12 rounded-xl grid place-items-center text-2xl border"
          style={{ borderColor: rarity.border, background: `${def.color}15`, boxShadow: rarity.glow }}
        >
          {def.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate">{def.shortName}</span>
            <span className="text-[9px] font-black tracking-wider" style={{ color: rarity.color }}>
              {rarity.label.toUpperCase()}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">LVL {owned.level} · {def.description}</div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {equipped ? (
        <span className="shrink-0 text-[9px] font-black px-2 py-1 rounded-full bg-accent/20 text-accent border border-accent/40">
          ✓
        </span>
      ) : (
        <button
          onClick={onEquip}
          className="shrink-0 text-[9px] font-black px-2.5 py-1.5 rounded-full bg-white/8 border border-white/15 hover:border-accent/40 transition"
        >
          ВЫБРАТЬ
        </button>
      )}
    </div>
  );
}

function LockedVehicleCard({ def, onSelect }: { def: VehicleDefinition; onSelect: () => void }) {
  const rarity = RARITY_META[def.rarity];
  return (
    <button
      onClick={onSelect}
      className="w-full glass rounded-2xl p-3 flex items-center gap-3 border border-white/5 opacity-70 hover:opacity-90 transition text-left"
    >
      <div className="shrink-0 w-12 h-12 rounded-xl grid place-items-center text-2xl bg-white/5 border border-white/8 relative">
        <span className="opacity-40 grayscale">{def.emoji}</span>
        <Lock className="absolute h-3.5 w-3.5 text-muted-foreground bottom-1 right-1" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold truncate text-muted-foreground">{def.shortName}</span>
          <span className="text-[9px] font-black tracking-wider opacity-60" style={{ color: rarity.color }}>
            {rarity.label.toUpperCase()}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
          <Lock className="h-2.5 w-2.5" />
          {formatUnlockRequirement(def.unlock)}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
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
  const rarity = RARITY_META[def.rarity];
  const locked = !owned;

  return (
    <div className="fixed inset-0 z-[800]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl p-5 pb-10 max-h-[80vh] overflow-y-auto animate-float-up border-t border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <span
              className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full border"
              style={{ color: rarity.color, borderColor: rarity.border, background: `${rarity.color}18` }}
            >
              {rarity.label.toUpperCase()}
            </span>
            <h3 className="font-display text-xl font-black mt-2">{def.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg glass shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-[120px] text-center my-2 opacity-90">{def.emoji}</div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatBox label="МОЩНОСТЬ" value={def.stats.power} suffix=" HP" />
          <StatBox label="УПРАВЛ." value={def.stats.handling} suffix="" />
          <StatBox label="СТИЛЬ" value={def.stats.style} suffix="" />
        </div>

        {/* Unlock / Level */}
        <div className="glass rounded-2xl p-3.5 mb-4">
          {locked ? (
            <>
              <div className="text-[10px] tracking-widest text-muted-foreground mb-1">ТРЕБОВАНИЕ</div>
              <div className="text-sm font-bold flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                {formatUnlockRequirement(def.unlock)}
              </div>
              {def.unlock.type === "achievement" && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Достижения скоро — ID: {def.unlock.achievementId}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="text-[10px] tracking-widest text-muted-foreground mb-1">ПРОГРЕСС</div>
              <div className="text-sm font-bold">Уровень {owned!.level} · {owned!.xp} XP</div>
            </>
          )}
        </div>

        {/* Future achievements hook */}
        {def.relatedAchievementIds && def.relatedAchievementIds.length > 0 && (
          <div className="glass rounded-2xl p-3.5 mb-4 opacity-60">
            <div className="text-[10px] tracking-widest text-muted-foreground mb-2">ДОСТИЖЕНИЯ</div>
            {def.relatedAchievementIds.map((id) => (
              <div key={id} className="text-[11px] text-muted-foreground flex items-center gap-2 py-1">
                <Lock className="h-3 w-3" /> {id} — скоро
              </div>
            ))}
          </div>
        )}

        {!locked && !equipped && (
          <button
            onClick={onEquip}
            className="w-full h-12 rounded-2xl bg-accent text-accent-foreground font-display font-black tracking-wider glow-cyan active:scale-[0.98] transition"
          >
            ВЫБРАТЬ НА КАРТЕ
          </button>
        )}
        {!locked && equipped && (
          <div className="w-full h-12 rounded-2xl bg-accent/15 border border-accent/40 text-accent font-display font-black tracking-wider grid place-items-center flex items-center justify-center gap-2">
            <Check className="h-4 w-4" /> АКТИВНА НА КАРТЕ
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className="rounded-xl p-2.5 bg-white/5 border border-white/8 text-center">
      <div className="text-[9px] tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display font-black text-lg mt-0.5">{value}{suffix}</div>
    </div>
  );
}
