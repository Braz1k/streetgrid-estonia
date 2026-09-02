import type mapboxgl from "mapbox-gl";
import type { UserProfile } from "@/lib/streetgrid/data";
import {
  getClusterDisplayOpacity,
  getClusterExpandT,
  getClusterIndividualRevealT,
  getClusterVisualExpandT,
  type PresenceOpacities,
} from "@/lib/streetgrid/avatarVehicleTransition";
import { clusterOverlapsSelfMarker } from "@/lib/streetgrid/playerCluster";
import {
  ClusterManager,
  type ClusterId,
  type ClusterEngineSnapshot,
  type StableCluster,
} from "@/lib/streetgrid/clusterManager";
import {
  ClusterTransitionController,
  getSharedClusterTransitionController,
} from "@/lib/streetgrid/clusterTransitionController";
import type { PlayerClusterMarkerProps } from "@/components/streetgrid/PlayerClusterMarker";
import type { MountedPlayerCluster } from "@/components/streetgrid/playerClusterMount";
import {
  mountPlayerClusterMarker,
  updatePlayerClusterMarker,
  unmountPlayerClusterMarker,
} from "@/components/streetgrid/playerClusterMount";

export type ClusterPreviewFn = (members: UserProfile[]) => string[];

export type ClusterEngineFrame = {
  map: mapboxgl.Map;
  users: readonly UserProfile[];
  mergeRadiusPx: number;
  opacities: PresenceOpacities;
  zoom: number;
  selfLngLat: [number, number] | null;
  previewAvatars: ClusterPreviewFn;
  onClusterTap: (members: UserProfile[], entry: MountedPlayerCluster) => void;
  allowClusterRemoval: boolean;
  toLngLat: (loc: [number, number]) => [number, number];
};

/**
 * Production cluster pipeline — stable IDs, hysteresis, 220ms crossfade, mount-once DOM.
 */
export class ClusterEngine {
  readonly manager = new ClusterManager();
  readonly transitions: ClusterTransitionController;
  private memberCache = new Map<ClusterId, readonly string[]>();
  private lastSnapshotKey = "";
  private clusterExpandOff = false;
  private pendingClusterReform = false;
  private dissolving = new Set<ClusterId>();
  private rafPending = false;
  private pendingFrame: ClusterEngineFrame | null = null;

  constructor(
    private readonly mounts: Record<string, MountedPlayerCluster>,
    transitions?: ClusterTransitionController,
  ) {
    this.transitions = transitions ?? getSharedClusterTransitionController();
  }

  reset() {
    this.manager.reset();
    this.memberCache.clear();
    this.lastSnapshotKey = "";
    this.clusterExpandOff = false;
    this.pendingClusterReform = false;
    this.dissolving.clear();
    this.rafPending = false;
    this.pendingFrame = null;
  }

  /** Coalesce rapid zoom updates — one compute per animation frame. */
  scheduleFrame(frame: ClusterEngineFrame) {
    this.pendingFrame = frame;
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      const f = this.pendingFrame;
      this.pendingFrame = null;
      if (f) this.runFrame(f);
    });
  }

  runFrame(frame: ClusterEngineFrame): ReadonlySet<string> {
    const expandT = getClusterExpandT(frame.zoom);
    if (expandT <= 0.001) {
      return this.applyClusterModeOff(frame);
    }
    this.clusterExpandOff = false;

    const reform = this.pendingClusterReform;
    this.pendingClusterReform = false;

    const snapshot = this.manager.compute(
      frame.map,
      frame.users,
      frame.mergeRadiusPx,
      frame.toLngLat,
    );

    const snapshotKey = snapshotKeyOf(snapshot);
    if (snapshotKey === this.lastSnapshotKey && !frame.allowClusterRemoval && !reform) {
      this.applyZoomOnly(frame, snapshot);
      return snapshot.clusteredUserIds;
    }
    this.lastSnapshotKey = snapshotKey;

    return this.applySnapshot(frame, snapshot, reform);
  }

  private applyZoomOnly(frame: ClusterEngineFrame, snapshot: ClusterEngineSnapshot) {
    const clusterOp = getClusterDisplayOpacity(frame.opacities);
    const revealT = getClusterIndividualRevealT(frame.zoom);
    const liveIds = new Set(snapshot.clusters.map((cluster) => cluster.id));
    for (const cluster of snapshot.clusters) {
      if (this.shouldSkipCluster(frame, cluster)) continue;
      const entry = this.mounts[cluster.id];
      if (!entry) continue;
      updatePlayerClusterMarker(entry, this.propsFor(cluster, frame), cluster.coords, frame.zoom);
      this.transitions.setClusterZoomOpacity(cluster.id, clusterOp);
    }
    for (const clusterId of Object.keys(this.mounts)) {
      if (!liveIds.has(clusterId)) this.dissolveClusterMount(clusterId);
    }
    this.syncPlayerZoom(frame, snapshot.clusteredUserIds, revealT);
  }

  private applySnapshot(
    frame: ClusterEngineFrame,
    snapshot: ClusterEngineSnapshot,
    reform = false,
  ): ReadonlySet<string> {
    const clusterOp = getClusterDisplayOpacity(frame.opacities);
    const revealT = getClusterIndividualRevealT(frame.zoom);
    const effectiveClustered = new Set<string>();

    for (const cluster of snapshot.clusters) {
      if (this.shouldSkipCluster(frame, cluster)) {
        for (const id of cluster.memberIds) {
          this.transitions.setPlayerZoomOpacity(id, frame.opacities.avatar * revealT);
        }
        continue;
      }

      effectiveClustered.add(...cluster.memberIds);

      const prevMembers = this.memberCache.get(cluster.id);
      this.memberCache.set(cluster.id, cluster.memberIds);

      const existing = this.mounts[cluster.id];
      if (existing) {
        updatePlayerClusterMarker(
          existing,
          this.propsFor(cluster, frame),
          cluster.coords,
          frame.zoom,
        );
        this.transitions.registerCluster({
          clusterId: cluster.id,
          container: existing.container,
          stage: existing.stage,
        });
        this.transitions.setClusterZoomOpacity(cluster.id, clusterOp);

        // Live again (hysteresis merge or leaving cluster-off band) — reverse fade, cancel unmount.
        if (reform || this.dissolving.has(cluster.id)) {
          this.dissolving.delete(cluster.id);
          this.transitions.formCluster(cluster.id, cluster.memberIds);
          continue;
        }

        if (prevMembers) {
          const newlyMerged = cluster.memberIds.filter(
            (id) => !prevMembers.includes(id) && snapshot.mergedUserIds.includes(id),
          );
          if (newlyMerged.length > 0) {
            this.transitions.mergeMembers(newlyMerged);
          }
        }
        continue;
      }

      const entry = this.mountCluster(frame, cluster, clusterOp);
      this.mounts[cluster.id] = entry;
      this.transitions.primeClusterEnter(cluster.id, clusterOp);
      this.transitions.formCluster(cluster.id, cluster.memberIds);
    }

    for (const clusterId of snapshot.removedClusterIds) {
      this.dissolveClusterMount(clusterId);
    }

    for (const userId of snapshot.splitUserIds) {
      if (!effectiveClustered.has(userId)) {
        this.transitions.setPlayerZoomOpacity(
          userId,
          frame.opacities.avatar * revealT,
        );
      }
    }

    this.syncPlayerZoom(frame, effectiveClustered, revealT);
    return effectiveClustered;
  }

  /** Below cluster zoom band — dissolve once, reveal players, hide discs. */
  private applyClusterModeOff(frame: ClusterEngineFrame): ReadonlySet<string> {
    const revealT = getClusterIndividualRevealT(frame.zoom);

    if (!this.clusterExpandOff) {
      this.clusterExpandOff = true;
      this.pendingClusterReform = true;
      this.lastSnapshotKey = "";
      for (const clusterId of Object.keys(this.mounts)) {
        this.dissolveClusterMount(clusterId);
      }
    }

    for (const user of frame.users) {
      this.transitions.setPlayerZoomOpacity(
        user.id,
        frame.opacities.avatar * revealT,
      );
    }

    return new Set();
  }

  private dissolveClusterMount(clusterId: ClusterId) {
    const entry = this.mounts[clusterId];
    if (!entry || this.dissolving.has(clusterId)) return;

    this.dissolving.add(clusterId);
    const members = this.memberCache.get(clusterId) ?? [];
    this.memberCache.delete(clusterId);
    this.transitions.dissolveCluster(clusterId, members);

    this.transitions.whenClusterHidden(clusterId, () => {
      this.dissolving.delete(clusterId);
      if (this.mounts[clusterId] !== entry) return;
      if (this.memberCache.has(clusterId)) return;
      unmountPlayerClusterMarker(entry);
      delete this.mounts[clusterId];
      this.transitions.unregisterCluster(clusterId);
    });
  }

  private mountCluster(
    frame: ClusterEngineFrame,
    cluster: StableCluster,
    clusterOp: number,
  ): MountedPlayerCluster {
    let entry!: MountedPlayerCluster;
    entry = mountPlayerClusterMarker(
      frame.map,
      cluster.id,
      cluster.coords,
      this.propsFor(cluster, frame),
      () => frame.onClusterTap([...cluster.members], entry),
      clusterOp,
      frame.zoom,
      this.transitions,
    );
    return entry;
  }

  private propsFor(cluster: StableCluster, frame: ClusterEngineFrame): PlayerClusterMarkerProps {
    return {
      count: cluster.count,
      previewAvatars: frame.previewAvatars([...cluster.members]),
      visualExpandT: getClusterVisualExpandT(frame.zoom),
    };
  }

  private shouldSkipCluster(frame: ClusterEngineFrame, cluster: StableCluster): boolean {
    return (
      frame.selfLngLat != null &&
      clusterOverlapsSelfMarker(frame.map, cluster.coords, frame.selfLngLat, cluster.count)
    );
  }

  private syncPlayerZoom(
    frame: ClusterEngineFrame,
    clustered: ReadonlySet<string>,
    revealT: number,
  ) {
    for (const userId of clustered) {
      this.transitions.setPlayerZoomOpacity(
        userId,
        frame.opacities.avatar * revealT,
      );
    }
  }
}

function snapshotKeyOf(s: ClusterEngineSnapshot): string {
  const clusterPart = s.clusters
    .map((c) => `${c.id}:${c.memberIds.join(",")}`)
    .sort()
    .join("|");
  return `${clusterPart}::${s.removedClusterIds.join(",")}`;
}
