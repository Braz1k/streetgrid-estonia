import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Header } from "@/components/streetgrid/Header";
import { CitySelector } from "@/components/streetgrid/CitySelector";
import { TabBar, type TabId } from "@/components/streetgrid/TabBar";
import { MapView } from "@/components/streetgrid/MapView";
import { MeetsPanel } from "@/components/streetgrid/MeetsPanel";
import { VehicleGarageScreen } from "@/components/streetgrid/VehicleGarageScreen";
import { ProfileGaragePanel } from "@/components/streetgrid/ProfileGaragePanel";
import { PublicPlayerProfile } from "@/components/streetgrid/PublicPlayerProfile";
import { RoutesPanel } from "@/components/streetgrid/RoutesPanel";
import { SpotsPanel } from "@/components/streetgrid/SpotsPanel";
import { ChatPanel } from "@/components/streetgrid/ChatPanel";
import { StreetGridProvider } from "@/lib/streetgrid/store";
import type { CityId } from "@/lib/streetgrid/data";
import type { Spot } from "@/lib/streetgrid/spots";

export const Route = createFileRoute("/")({
  component: App,
});

type SecondaryView =
  | { kind: "ownProfile"; returnTab: TabId }
  | { kind: "otherProfile"; userId: string; returnTab: TabId }
  | { kind: "collection"; returnTab: TabId };

function App() {
  const [tab, setTab] = useState<TabId>("map");
  const [city, setCity] = useState<CityId>("tallinn");
  const [secondaryView, setSecondaryView] = useState<SecondaryView | null>(null);
  const [focusSpot, setFocusSpot] = useState<{ id: string; ts: number } | null>(null);
  const [routeRequest, setRouteRequest] = useState<{
    coords: [number, number];
    name: string;
    ts: number;
    meet?: { id: string; title: string; coords: [number, number] };
  } | null>(null);

  const openGarage = (id: string) => {
    setSecondaryView({ kind: "otherProfile", userId: id, returnTab: tab });
  };

  const openOwnProfile = () => {
    setSecondaryView({ kind: "ownProfile", returnTab: tab === "garage" ? "map" : tab });
    setTab("garage");
  };

  const openCollection = () => {
    setSecondaryView({ kind: "collection", returnTab: tab });
  };

  const closeSecondaryView = () => {
    if (!secondaryView) {
      setTab("map");
      return;
    }
    setTab(secondaryView.returnTab);
    setSecondaryView(null);
  };

  const currentView = secondaryView?.kind ?? (tab === "garage" ? "ownProfile" : null);

  const focusSpotOnMap = (spot: Spot) => {
    setFocusSpot({ id: spot.id, ts: Date.now() });
    setSecondaryView(null);
    setTab("map");
  };

  const routeTo = (
    coords: [number, number],
    name: string,
    meet?: { id: string; title: string; coords: [number, number] },
  ) => {
    setRouteRequest({ coords, name, ts: Date.now(), meet });
    setSecondaryView(null);
    setTab("map");
  };

  const clearRouteRequest = useCallback(() => setRouteRequest(null), []);

  return (
    <StreetGridProvider>
      <div className="sg-mobile-shell">
        <div className="sg-app-shell">
        <div className="sg-top-chrome">
          <Header onOpenProfile={openOwnProfile} onOpenCollection={openCollection} />
          {tab === "map" && !secondaryView && (
            <CitySelector value={city} onChange={setCity} />
          )}
        </div>

        <div className="sg-main-stage">
          {tab === "map" && !secondaryView && (
            <MapView
              city={city}
              onOpenGarage={openGarage}
              focusSpot={focusSpot}
              routeRequest={routeRequest}
              onRouteCleared={clearRouteRequest}
            />
          )}

          {(tab !== "map" || secondaryView) && (
            <main className="relative z-10 h-full overflow-y-auto">
              {!secondaryView && tab === "meets" && (
                <MeetsPanel
                  city={city}
                  onRouteTo={routeTo}
                  onActiveMeetRemoved={(meetId) => {
                    setRouteRequest((current) => current?.meet?.id === meetId ? null : current);
                  }}
                />
              )}
              {currentView === "ownProfile" && (
                <ProfileGaragePanel onBack={closeSecondaryView} />
              )}
              {currentView === "otherProfile" && secondaryView?.kind === "otherProfile" && (
                <PublicPlayerProfile userId={secondaryView.userId} onRoute={routeTo} />
              )}
              {currentView === "collection" && (
                <VehicleGarageScreen onBack={closeSecondaryView} />
              )}
              {!secondaryView && tab === "routes" && <RoutesPanel />}
              {!secondaryView && tab === "spots" && (
                <SpotsPanel city={city} onSelectSpot={focusSpotOnMap} onRouteTo={routeTo} />
              )}
              {!secondaryView && tab === "chat" && <ChatPanel city={city} />}
            </main>
          )}
        </div>

        <TabBar
          active={tab}
          onChange={(id) => {
            setSecondaryView(null);
            setTab(id);
          }}
        />
        </div>
      </div>
    </StreetGridProvider>
  );
}
