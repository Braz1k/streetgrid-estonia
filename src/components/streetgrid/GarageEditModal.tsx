import { useEffect, useState } from "react";
import { X, Save } from "lucide-react";
import type { Car } from "@/lib/streetgrid/data";

const AVATARS = ["🚗", "🏎️", "🚙", "🛻", "🏁", "🛞", "🌃", "💦"];

type Props = {
  open: boolean;
  car: Car;
  onClose: () => void;
  onSave: (car: Car) => void;
};

export function GarageEditModal({ open, car, onClose, onSave }: Props) {
  const [make, setMake] = useState(car.make);
  const [model, setModel] = useState(car.model);
  const [year, setYear] = useState(String(car.year));
  const [hp, setHp] = useState(String(car.hp));
  const [specs, setSpecs] = useState(car.specs.join("\n"));
  const [avatar, setAvatar] = useState(car.photos[0] ?? "🚗");

  useEffect(() => {
    if (!open) return;
    setMake(car.make);
    setModel(car.model);
    setYear(String(car.year));
    setHp(String(car.hp));
    setSpecs(car.specs.join("\n"));
    setAvatar(car.photos[0] ?? "🚗");
  }, [open, car]);

  if (!open) return null;

  const save = () => {
    onSave({
      make: make.trim() || car.make,
      model: model.trim() || car.model,
      year: Number(year) || car.year,
      hp: Number(hp) || car.hp,
      specs: specs.split("\n").map((s) => s.trim()).filter(Boolean),
      photos: [avatar, ...car.photos.filter((p) => p !== avatar)].slice(0, 6),
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-md grid place-items-end sm:place-items-center animate-float-up"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] glass-strong rounded-t-3xl sm:rounded-3xl p-5 border-t border-accent/40 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-black text-accent">РЕДАКТИРОВАТЬ АВТО</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Обнови данные своего гаража</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full glass">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="МАРКА">
              <input value={make} onChange={(e) => setMake(e.target.value)} className={inputCls} />
            </Field>
            <Field label="МОДЕЛЬ">
              <input value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="ГОД">
              <input
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className={inputCls}
              />
            </Field>
            <Field label="МОЩНОСТЬ (HP)">
              <input
                value={hp}
                onChange={(e) => setHp(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="СПЕКЛИСТ / ТЮНИНГ — каждая строка = пункт">
            <textarea
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              rows={5}
              className={`${inputCls} resize-none font-mono text-xs`}
            />
          </Field>
          <Field label="ИКОНКА АВТО">
            <div className="grid grid-cols-8 gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`h-10 rounded-lg text-xl grid place-items-center transition ${
                    avatar === a
                      ? "bg-accent/20 border border-accent/60 glow-cyan"
                      : "bg-white/5 border border-white/10 hover:border-white/30"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <button
          onClick={save}
          className="mt-5 w-full h-12 rounded-2xl bg-accent text-accent-foreground font-display font-black tracking-widest glow-cyan active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          <Save className="h-4 w-4" /> СОХРАНИТЬ
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm outline-none focus:border-accent/60 focus:bg-white/10 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-widest text-muted-foreground block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
