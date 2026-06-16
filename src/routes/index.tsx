import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/streetgrid/Header";
import { CitySelector } from "@/components/streetgrid/CitySelector";
import { TabBar, type TabId } from "@/components/streetgrid/TabBar";
import { MapView } from "@/components/streetgrid/MapView";
import { MeetsPanel } from "@/components/streetgrid/MeetsPanel";
import { GaragePanel } from "@/components/streetgrid/GaragePanel";
import { RoutesPanel } from "@/components/streetgrid/RoutesPanel";
import { SpotsPanel } from "@/components/streetgrid/SpotsPanel";
import { ChatPanel } from "@/components/streetgrid/ChatPanel";
import { StreetGridProvider } from "@/lib/streetgrid/store";
import type { CityId, Spot } from "@/lib/streetgrid/data";

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
      <div className="min-h-screen flex flex-col">
        <Header />
        <CitySelector value={city} onChange={setCity} />
        <main className="flex-1">
          {tab === "map" && <MapView city={city} onOpenGarage={openGarage} focusSpot={focusSpot} routeRequest={routeRequest} />}
          {tab === "meets" && <MeetsPanel city={city} onRouteTo={routeTo} />}
          {tab === "garage" && (
            <GaragePanel
              viewUserId={viewUser}
              onBack={viewUser ? () => { setViewUser(null); setTab("map"); } : undefined}
            />
          )}
          {tab === "routes" && <RoutesPanel />}
          {tab === "spots" && <SpotsPanel city={city} onSelectSpot={focusSpotOnMap} onRouteTo={routeTo} />}
          {tab === "chat" && <ChatPanel city={city} />}
        </main>
        <TabBar active={tab} onChange={(id) => { if (id !== "garage") setViewUser(null); setTab(id); }} />
      </div>
    </StreetGridProvider>
  );
}
