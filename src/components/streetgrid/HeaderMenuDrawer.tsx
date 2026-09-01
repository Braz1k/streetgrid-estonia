import { Bell, Settings, User, X, type LucideIcon } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onProfile?: () => void;
  onLevel?: () => void;
  onNotifications?: () => void;
  onSettings?: () => void;
};

type DrawerItem = {
  id: string;
  title: string;
  description: string;
  accent: "cyan" | "purple";
  icon?: LucideIcon;
  iconNode?: string;
};

const ITEMS: DrawerItem[] = [
  {
    id: "profile",
    icon: User,
    title: "Профиль",
    description: "Настройка фото, ника, статуса",
    accent: "cyan",
  },
  {
    id: "level",
    iconNode: "⬡",
    title: "Уровень",
    description: "Прогресс-бар, опыт, следующий уровень",
    accent: "cyan",
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Уведомления",
    description: "Быстрый доступ",
    accent: "purple",
  },
  {
    id: "settings",
    icon: Settings,
    title: "Настройки",
    description: "Гибкие настройки карты и профиля",
    accent: "cyan",
  },
];

export function HeaderMenuDrawer({
  open,
  onClose,
  onProfile,
  onLevel,
  onNotifications,
  onSettings,
}: Props) {
  if (!open) return null;

  const handlers: Record<string, (() => void) | undefined> = {
    profile: onProfile,
    level: onLevel,
    notifications: onNotifications,
    settings: onSettings,
  };

  return (
    <div className="sg-drawer" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" className="sg-drawer__backdrop" aria-label="Close menu" onClick={onClose} />
      <aside className="sg-drawer__panel">
        <div className="sg-drawer__head">
          <span className="sg-drawer__title">Меню</span>
          <button type="button" className="sg-drawer__close" aria-label="Close" onClick={onClose}>
            <X className="sg-drawer__close-icon" strokeWidth={2} />
          </button>
        </div>
        <nav className="sg-drawer__nav">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className="sg-drawer__item"
                onClick={() => {
                  handlers[item.id]?.();
                  onClose();
                }}
              >
                <span className={`sg-drawer__item-icon sg-drawer__item-icon--${item.accent}`}>
                  {Icon ? (
                    <Icon className="sg-drawer__item-icon-svg" strokeWidth={1.75} />
                  ) : (
                    <span className="sg-drawer__item-emoji">{item.iconNode}</span>
                  )}
                </span>
                <span className="sg-drawer__item-text">
                  <span className="sg-drawer__item-title">{item.title}</span>
                  <span className="sg-drawer__item-desc">{item.description}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
