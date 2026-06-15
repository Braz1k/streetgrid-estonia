import { useState } from "react";
import { ME, USERS } from "@/lib/streetgrid/data";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { Gauge, Calendar, Wrench, Camera, Edit3 } from "lucide-react";
import { GarageEditModal } from "./GarageEditModal";

type Props = { viewUserId?: string | null; onBack?: () => void };

export function GaragePanel({ viewUserId, onBack }: Props) {
  const { profile, updateCar } = useStreetGrid();
  const otherUser = viewUserId ? USERS.find((u) => u.id === viewUserId) : null;
  const isMe = !otherUser;
  const handle = isMe ? profile.handle : otherUser!.handle;
  const avatar = isMe ? profile.avatar : otherUser!.avatar;
  const status = isMe ? profile.status : otherUser!.status === "moving" ? "В движении" : "На споте";
  const car = isMe ? profile.car : otherUser!.car;
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="pb-24 animate-float-up">
      {/* Hero car visual */}
      <div className="relative h-56 bg-gradient-to-b from-primary/20 via-surface-2 to-background overflow-hidden">
        <div className="absolute inset-0 grid place-items-center text-[140px] opacity-90">{car.photos[0]}</div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        {viewUserId && onBack && (
          <button onClick={onBack} className="absolute top-3 left-3 glass-strong rounded-xl px-3 h-9 text-xs font-bold">
            ← НАЗАД
          </button>
        )}
        <div className="absolute bottom-3 right-3 glass-strong rounded-full px-3 py-1.5 text-[10px] font-bold tracking-widest text-nitro border border-nitro/40">
          ● {status.toUpperCase()}
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-4">
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/30 grid place-items-center font-display font-black text-lg">
              {avatar}
            </div>
            <div className="flex-1">
              <div className="font-display font-black text-lg">{handle}</div>
              <div className="text-xs text-muted-foreground">Tallinn · участник с 2023</div>
            </div>
            {isMe && (
              <button
                onClick={() => setEditOpen(true)}
                aria-label="Редактировать профиль авто"
                className="h-9 px-3 grid place-items-center rounded-xl bg-accent/15 border border-accent/40 text-accent text-[10px] font-bold tracking-widest hover:bg-accent/25 transition flex-row gap-1.5"
                style={{ display: "inline-flex" }}
              >
                <Edit3 className="h-3.5 w-3.5" /> EDIT
              </button>
            )}
          </div>
          <div className="border-t border-white/5 pt-3">
            <div className="text-[10px] tracking-widest text-muted-foreground">РЕАЛЬНЫЙ ГАРАЖ</div>
            <h2 className="font-display text-2xl font-black mt-1">
              {car.make} <span className="text-primary text-glow-red">{car.model}</span>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Stat icon={Calendar} label="ГОД" value={String(car.year)} />
            <Stat icon={Gauge} label="МОЩНОСТЬ" value={`${car.hp} HP`} accent />
            <Stat icon={Wrench} label="СПЕКОВ" value={String(car.specs.length)} />
          </div>
        </div>

        <section className="glass rounded-2xl p-4">
          <h3 className="font-display font-black text-sm mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" /> СПЕКЛИСТ
          </h3>
          <div className="space-y-1.5">
            {car.specs.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1.5 border-b border-white/5 last:border-0">
                <span className="text-primary text-xs">▸</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-black text-sm flex items-center gap-2">
              <Camera className="h-4 w-4 text-accent" /> ГАЛЕРЕЯ
            </h3>
            {isMe && (
              <button onClick={() => setEditOpen(true)} className="text-[10px] tracking-widest text-accent font-bold">
                + ИЗМЕНИТЬ
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-square rounded-xl bg-gradient-to-br from-surface-2 to-surface border border-white/5 grid place-items-center text-3xl">
                {car.photos[i % car.photos.length]}
              </div>
            ))}
          </div>
        </section>
      </div>

      <GarageEditModal
        open={editOpen && isMe}
        car={car}
        onClose={() => setEditOpen(false)}
        onSave={(c) => updateCar(c)}
      />
    </div>
  );
}

// Keep ME reference used to silence unused warning in case of tree-shaking
void ME;

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Gauge; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 border ${accent ? "bg-primary/10 border-primary/30" : "bg-white/5 border-white/5"}`}>
      <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      <div className="text-[9px] tracking-widest text-muted-foreground mt-1">{label}</div>
      <div className={`font-display font-black text-sm mt-0.5 ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
