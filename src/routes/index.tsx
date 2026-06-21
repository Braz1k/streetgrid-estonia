import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Header } from "@/components/streetgrid/Header";
import { CitySelector } from "@/components/streetgrid/CitySelector";
import { TabBar, type TabId } from "@/components/streetgrid/TabBar";
import { MapView } from "@/components/streetgrid/MapView";
import { MeetsPanel } from "@/components/streetgrid/MeetsPanel";
import { VehicleGarageScreen } from "@/components/streetgrid/VehicleGarageScreen";
import { ProfileGaragePanel } from "@/components/streetgrid/ProfileGaragePanel";
import { RoutesPanel } from "@/components/streetgrid/RoutesPanel";
import { SpotsPanel } from "@/components/streetgrid/SpotsPanel";
import { ChatPanel } from "@/components/streetgrid/ChatPanel";
import { StreetGridProvider } from "@/lib/streetgrid/store";
import type { CityId } from "@/lib/streetgrid/data";
import type { Spot } from "@/lib/streetgrid/spots";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<TabId>("map");
  const [city, setCity] = useState<CityId>("tallinn");
  const [viewUser, setViewUser] = useState<string | null>(null);
  const [focusSpot, setFocusSpot] = useState<{ id: string; ts: number } | null>(null);
  const [routeRequest, setRouteRequest] = useState<{ coords: [number, number]; name: string; ts: number } | null>(null);

  const openGarage = (id: string) => {
    setViewUser(id);
    setTab("garage");
  };

  const focusSpotOnMap = (spot: Spot) => {
    setFocusSpot({ id: spot.id, ts: Date.now() });
    setTab("map");
  };

  const routeTo = (coords: [number, number], name: string) => {
    setRouteRequest({ coords, name, ts: Date.now() });
    setTab("map");
  };

  return (
    <StreetGridProvider>
      {/* Full-width container — fills 100% of any screen, no side borders */}
      <div style={{ minHeight: "100dvh", background: "#0a0b14" }}>
        <div
          style={{
            position:   "relative",
            width:      "100%",
            height:     "100dvh",
            overflow:   "hidden",
            background: "#0a0b14",
          }}
        >
          {/* Map lives absolutely inside the phone frame */}
          {tab === "map" && (
            <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
              <MapView city={city} onOpenGarage={openGarage} focusSpot={focusSpot} routeRequest={routeRequest} />
            </div>
          )}

          {/* Header + city selector overlay */}
          <div
            style={{ position: "relative", zIndex: 20, pointerEvents: tab === "map" ? "none" : "auto" }}
          >
            <div style={{ pointerEvents: "auto" }}>
              <Header />
            </div>
            <div style={{ pointerEvents: "auto" }}>
              <CitySelector value={city} onChange={setCity} />
            </div>
          </div>

          {/* Tab content (non-map panels) */}
          {tab !== "map" && (
            <main style={{ position: "relative", zIndex: 10, flex: 1 }}>
              {tab === "meets"  && <MeetsPanel city={city} onRouteTo={routeTo} />}
              {tab === "garage" && (
                viewUser ? (
                  <ProfileGaragePanel
                    viewUserId={viewUser}
                    onBack={() => { setViewUser(null); setTab("map"); }}
                  />
                ) : (
                  <VehicleGarageScreen />
                )
              )}
              {tab === "routes" && <RoutesPanel />}
              {tab === "spots"  && <SpotsPanel city={city} onSelectSpot={focusSpotOnMap} onRouteTo={routeTo} />}
              {tab === "chat"   && <ChatPanel city={city} />}
            </main>
          )}

          <TabBar active={tab} onChange={(id) => { if (id !== "garage") setViewUser(null); setTab(id); }} />
        </div>
      </div>
    </StreetGridProvider>
  );
}
