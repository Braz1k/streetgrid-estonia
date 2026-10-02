export const NICKNAME_COLORS = [
  { id: "white", label: "WHITE", value: "#ffffff" },
  { id: "cyan", label: "CYAN", value: "#00E5FF" },
  { id: "ice", label: "ICE BLUE", value: "#38BDF8" },
  { id: "blue", label: "ELECTRIC BLUE", value: "#3B82F6" },
  { id: "violet", label: "VIOLET", value: "#8B5CF6" },
  { id: "purple", label: "PURPLE", value: "#A855F7" },
  { id: "pink", label: "PINK", value: "#EC4899" },
  { id: "green", label: "GREEN", value: "#00FF88" },
  { id: "amber", label: "AMBER", value: "#FFB800" },
  { id: "red", label: "RED", value: "#FF3B30" },
] as const;

export type NicknameColorId = (typeof NICKNAME_COLORS)[number]["id"];

export function nicknameColorValue(id: string | null | undefined): string {
  return NICKNAME_COLORS.find((color) => color.id === id)?.value ?? "#ffffff";
}

export function readNicknameColor(value: unknown): NicknameColorId {
  if (typeof value === "string" && NICKNAME_COLORS.some((color) => color.id === value)) {
    return value as NicknameColorId;
  }
  return "white";
}
