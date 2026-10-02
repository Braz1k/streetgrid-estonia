import { useState } from "react";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { SettingsModal } from "./SettingsModal";
import { StreetGridPremiumHeader } from "./StreetGridPremiumHeader";
import { HeaderMenuDrawer } from "./HeaderMenuDrawer";
import { usePlayerProgress } from "./PlayerProgressBlock";

type Props = {
  onOpenProfile: () => void;
  onOpenCollection: () => void;
};

export function Header({ onOpenProfile, onOpenCollection }: Props) {
  const { profile } = useStreetGrid();
  const { level, currentXP, requiredXP } = usePlayerProgress();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const openSettings = () => setSettingsOpen(true);

  return (
    <>
      <header
        className="sg-mhdr-wrap header-container"
        style={{ overflow: "hidden", position: "relative" }}
      >
        <StreetGridPremiumHeader
          nickname={profile.handle}
          avatar={profile.avatar}
          level={level}
          currentXP={currentXP}
          requiredXP={requiredXP}
          online
          hasUnreadNotifications
          onNotifications={openSettings}
          onSettings={openSettings}
          onMenu={() => setMenuOpen(true)}
        />
      </header>

      <HeaderMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onProfile={onOpenProfile}
        onCollection={onOpenCollection}
        onLevel={openSettings}
        onNotifications={openSettings}
        onSettings={openSettings}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
