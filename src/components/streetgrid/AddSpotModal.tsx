import { useState } from "react";
import { X, Camera, Square as ParkingSquare, Droplets, Coffee, MapPin } from "lucide-react";
import type { SpotType } from "@/lib/streetgrid/data";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { type: SpotType; name: string; description: string }) => void;
};

const TYPES: { id: SpotType; label: string; icon: typeof Camera; emoji: string }[] = [
  { id: "photo", label: "Фото-спот", icon: Camera, emoji: "📸" },
  { id: "parking", label: "Парковка", icon: ParkingSquare, emoji: "🅿️" },
  { id: "wash", label: "Мойка", icon: Droplets, emoji: "💦" },
  { id: "friendly", label: "Кафе", icon: Coffee, emoji: "☕" },
  { id: "landmark", label: "Точка", icon: MapPin, emoji: "📍" },
];

export function AddSpotModal({ open, onClose, onSubmit }: Props) {
  const [type, setType] = useState<SpotType>("photo");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  if (!open) return null;

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ type, name: name.trim(), description: desc.trim() || "Добавлено пользователем" });
    setName(""); setDesc(""); setType("photo");
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm grid place-items-end sm:place-items-center animate-float-up">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] glass-strong rounded-t-3xl sm:rounded-3xl p-5 border-t border-accent/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-black text-accent">НОВЫЙ СПОТ</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Точка появится в центре карты</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full glass">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">ТИП</div>
          <div className="grid grid-cols-5 gap-1.5">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 rounded-xl transition border",
                    active ? "bg-accent/15 border-accent text-accent" : "glass border-white/5 text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[9px] font-bold">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название спота"
            className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none focus:border-accent/50 focus:bg-white/10 transition"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Краткое описание (необязательно)"
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50 focus:bg-white/10 transition resize-none"
          />
        </div>

        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full h-12 rounded-xl bg-accent text-accent-foreground font-black text-sm tracking-widest glow-cyan disabled:opacity-40 disabled:glow-cyan-0 active:scale-95 transition"
        >
          ДОБАВИТЬ СПОТ
        </button>
      </div>
    </div>
  );
}
