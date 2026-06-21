/** Stable portrait avatar URL per player — DiceBear personas, no letter placeholders. */
export function getPlayerAvatarUrl(user: { id: string; handle: string }): string {
  const seed = encodeURIComponent(user.id || user.handle.replace("@", ""));
  return `https://api.dicebear.com/7.x/personas/png?seed=${seed}&size=128&backgroundColor=080a12,0c1420`;
}
