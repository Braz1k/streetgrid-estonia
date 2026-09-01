import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
      <div className="sg-mobile-shell">
        <div className="sg-app-shell">
        <div className="sg-top-chrome">
          <Header />
          <div
            style={{ height: "1px", background: "rgba(255,255,255,0.08)", width: "100%" }}
            aria-hidden
          />
          <CitySelector value={city} onChange={setCity} />
        </div>

        <div className="sg-main-stage">
          {tab === "map" && (
            <MapView
              city={city}
              onOpenGarage={openGarage}
              focusSpot={focusSpot}
              routeRequest={routeRequest}
            />
          )}

          {tab !== "map" && (
            <main className="relative z-10 h-full overflow-y-auto">
              {tab === "meets" && <MeetsPanel city={city} onRouteTo={routeTo} />}
              {tab === "garage" &&
                (viewUser ? (
                  <ProfileGaragePanel
                    viewUserId={viewUser}
                    onBack={() => {
                      setViewUser(null);
                      setTab("map");
                    }}
                  />
                ) : (
                  <VehicleGarageScreen />
                ))}
              {tab === "routes" && <RoutesPanel />}
              {tab === "spots" && (
                <SpotsPanel city={city} onSelectSpot={focusSpotOnMap} onRouteTo={routeTo} />
              )}
              {tab === "chat" && <ChatPanel city={city} />}
            </main>
          )}
        </div>

        <TabBar
          active={tab}
          onChange={(id) => {
            if (id !== "garage") setViewUser(null);
            setTab(id);
          }}
        />
        </div>
      </div>
    </StreetGridProvider>
  );
}
