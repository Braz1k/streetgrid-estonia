import { useState } from "react";
import { X, User, Map as MapIcon, Bell, Cog, LogOut, Trash2 } from "lucide-react";
import { useStreetGrid, type DriverStatus, type Language, type NavProvider } from "@/lib/streetgrid/store";

type Props = { open: boolean; onClose: () => void };

const STATUSES: DriverStatus[] = ["Круиз", "На кортах", "Занят", "Нужен заезд", "На споте"];
const NAVS: { id: NavProvider; label: string }[] = [
  { id: "google", label: "Google Maps" },
  { id: "waze", label: "Waze" },
  { id: "apple", label: "Apple Maps" },
];
const LANGS: { id: Language; label: string }[] = [
  { id: "ru", label: "Русский" },
  { id: "et", label: "Eesti" },
  { id: "en", label: "English" },
];

export function SettingsModal({ open, onClose }: Props) {
  const { profile, updateProfile, settings, updateSettings } = useStreetGrid();
  const [toast, setToast] = useState<string | null>(null);

  if (!open) return null;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const clearCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* noop */
    }
    flash("Кэш приложения очищен");
  };

  const logout = () => {
    flash("Сессия закрыта");
    setTimeout(onClose, 600);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-md grid place-items-end sm:place-items-center animate-float-up"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] glass-strong rounded-t-3xl sm:rounded-3xl border-t border-accent/30 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/15 border border-accent/40 grid place-items-center">
              <Cog className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="font-display text-lg font-black">НАСТРОЙКИ</h2>
              <p className="text-[10px] tracking-widest text-muted-foreground mt-0.5">
                STREETGRID · v6
              </p>
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full glass">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* A. Profile */}
          <Section icon={User} title="ПРОФИЛЬ ВОДИТЕЛЯ" accent="accent">
            <Field label="ИМЯ / НИКНЕЙМ">
              <input
                value={profile.handle}
                onChange={(e) => updateProfile({ handle: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="СТАТУС НА КАРТЕ">
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => {
                  const active = profile.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => updateProfile({ status: s })}
                      className={`px-3 h-8 rounded-full text-[11px] font-bold tracking-wider border transition ${
                        active
                          ? "bg-accent/20 border-accent/60 text-accent glow-cyan"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>
          </Section>

          {/* B. Map */}
          <Section icon={MapIcon} title="КАРТА И НАВИГАЦИЯ" accent="accent">
            <Field label="НАВИГАТОР ДЛЯ «ПОЕХАЛИ»">
              <div className="grid grid-cols-3 gap-1.5">
                {NAVS.map((n) => {
                  const active = settings.defaultNav === n.id;
                  return (
                    <button
                      key={n.id}
                      onClick={() => updateSettings({ defaultNav: n.id })}
                      className={`h-10 rounded-xl text-[11px] font-bold tracking-wider border transition ${
                        active
                          ? "bg-accent/20 border-accent/60 text-accent glow-cyan"
                          : "bg-white/5 border-white/10 text-muted-foreground"
                      }`}
                    >
                      {n.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Toggle
              label="Отображать патрули полиции"
              hint="Маркеры 🚓 на карте"
              checked={settings.showPatrols}
              onChange={(v) => updateSettings({ showPatrols: v })}
            />
            <Toggle
              label="Боты и другие водители"
              hint="Live-движение на карте"
              checked={settings.showBots}
              onChange={(v) => updateSettings({ showBots: v })}
            />
          </Section>

          {/* C. Notifications */}
          <Section icon={Bell} title="УМНЫЕ УВЕДОМЛЕНИЯ" accent="primary">
            <Toggle
              label="Сигналы SOS в моём городе"
              hint="Экстренные ситуации рядом"
              checked={settings.notifSos}
              onChange={(v) => updateSettings({ notifSos: v })}
              variant="red"
            />
            <Toggle
              label="Новые авто-миты и сходки"
              hint="Уведомление о новых событиях"
              checked={settings.notifMeets}
              onChange={(v) => updateSettings({ notifMeets: v })}
              variant="red"
            />
            <Toggle
              label="Патрули полиции рядом"
              hint="Предупреждения в режиме live"
              checked={settings.notifPatrols}
              onChange={(v) => updateSettings({ notifPatrols: v })}
              variant="red"
            />
          </Section>

          {/* D. System */}
          <Section icon={Cog} title="СИСТЕМА" accent="accent">
            <Field label="ЯЗЫК ПРИЛОЖЕНИЯ">
              <div className="grid grid-cols-3 gap-1.5">
                {LANGS.map((l) => {
                  const active = settings.language === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => updateSettings({ language: l.id })}
                      className={`h-10 rounded-xl text-[11px] font-bold tracking-wider border transition ${
                        active
                          ? "bg-accent/20 border-accent/60 text-accent glow-cyan"
                          : "bg-white/5 border-white/10 text-muted-foreground"
                      }`}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <button
              onClick={clearCache}
              className="w-full h-11 rounded-xl glass border border-white/10 flex items-center justify-center gap-2 text-sm font-bold hover:border-accent/40 transition"
            >
              <Trash2 className="h-4 w-4 text-accent" /> Очистить кэш приложения
            </button>
            <button
              onClick={logout}
              className="w-full h-11 rounded-xl bg-primary/10 border border-primary/40 flex items-center justify-center gap-2 text-sm font-bold text-primary hover:bg-primary/15 transition"
            >
              <LogOut className="h-4 w-4" /> Выйти из профиля
            </button>
          </Section>

          <div className="text-center text-[10px] text-muted-foreground pt-2 pb-4 tracking-widest">
            STREETGRID · EST · MADE FOR DRIVERS
          </div>
        </div>

        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass-strong border border-accent/40 rounded-full px-4 py-2 text-xs font-bold text-accent animate-float-up">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-sm outline-none focus:border-accent/60 focus:bg-white/10 transition";

function Section({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: typeof Cog;
  title: string;
  accent: "primary" | "accent";
  children: React.ReactNode;
}) {
  const color = accent === "primary" ? "text-primary" : "text-accent";
  return (
    <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <h3 className={`font-display font-black text-xs tracking-widest ${color}`}>{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] tracking-widest text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  variant = "cyan",
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  variant?: "cyan" | "red";
}) {
  const onCls =
    variant === "red"
      ? "bg-primary border-primary/70 glow-red"
      : "bg-accent border-accent/70 glow-cyan";
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex-1">
        <div className="text-sm font-bold">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        className={`relative h-6 w-11 rounded-full border transition ${
          checked ? onCls : "bg-white/5 border-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}
