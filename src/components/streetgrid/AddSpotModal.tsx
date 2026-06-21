import { useState } from "react";
import { X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string }) => void;
};

export function AddSpotModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  if (!open) return null;

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: desc.trim() || "Добавлено пользователем" });
    setName("");
    setDesc("");
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm grid place-items-end sm:place-items-center animate-float-up">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] glass-strong rounded-t-3xl sm:rounded-3xl p-5 border-t border-[#00f0ff]/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-black text-[#00f0ff]">НОВЫЙ СПОТ</h2>
            <p className="text-xs text-muted-foreground mt-0.5">COMMON · появится в центре карты</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full glass">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4 glass rounded-xl px-3 py-2.5 border border-[#00f0ff]/25">
          <MapPin className="h-4 w-4 text-[#00f0ff] shrink-0" />
          <span className="text-xs text-muted-foreground">Награда: +20 XP · Community Spot</span>
        </div>

        <div className="space-y-2 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название спота"
            className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none focus:border-[#00f0ff]/50 focus:bg-white/10 transition"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Краткое описание (необязательно)"
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#00f0ff]/50 focus:bg-white/10 transition resize-none"
          />
        </div>

        <button
          onClick={submit}
          disabled={!name.trim()}
          className={cn(
            "w-full h-12 rounded-xl font-black text-sm tracking-widest transition active:scale-95",
            "bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/45",
            "disabled:opacity-40",
          )}
        >
          ДОБАВИТЬ СПОТ
        </button>
      </div>
    </div>
  );
}
