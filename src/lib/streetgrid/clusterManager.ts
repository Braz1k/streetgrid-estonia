import type mapboxgl from "mapbox-gl";
import type { UserProfile } from "@/lib/streetgrid/data";
import {
  getRarityRank,
  rarityFromRank,
  type VehicleRarity,
} from "@/lib/streetgrid/vehicles";

export const CLUSTER_MIN_MEMBERS = 2;

/** Split radius = merge radius × factor (prevents merge/split oscillation). */
export const CLUSTER_SPLIT_HYSTERESIS = 1.35;

export type ClusterId = string;

export type StableCluster = {
  id: ClusterId;
  memberIds: readonly string[];
  members: readonly UserProfile[];
  coords: [number, number];
  count: number;
  rarity: VehicleRarity;
};

export type ClusterEngineSnapshot = {
  clusters: readonly StableCluster[];
  clusteredUserIds: ReadonlySet<string>;
  singles: readonly UserProfile[];
  removedClusterIds: readonly ClusterId[];
  addedClusterIds: readonly ClusterId[];
  /** Players newly assigned to a cluster this frame. */
  mergedUserIds: readonly string[];
  /** Players no longer in any cluster this frame. */
  splitUserIds: readonly string[];
};

type ProjectedPlayer = {
  user: UserProfile;
  index: number;
  x: number;
  y: number;
};

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function cellKey(x: number, y: number, cellSize: number): string {
  return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
}

/**
 * Stable spatial cluster engine — union-find + spatial hash.
 * IDs persist via majority vote; merge/split use separate radii.
 */
export class ClusterManager {
  private nextSeq = 1;
  private playerCluster = new Map<string, ClusterId>();
  private mergedPairs = new Set<string>();
  private activeClusterIds = new Set<ClusterId>();

  reset() {
    this.nextSeq = 1;
    this.playerCluster.clear();
    this.mergedPairs.clear();
    this.activeClusterIds.clear();
  }

  private newClusterId(): ClusterId {
    return `c-${this.nextSeq++}`;
  }

  /**
   * @param mergeRadiusPx screen-space merge threshold (split = merge × 1.35)
   */
  compute(
    map: mapboxgl.Map,
    users: readonly UserProfile[],
    mergeRadiusPx: number,
    toLngLat: (loc: [number, number]) => [number, number],
  ): ClusterEngineSnapshot {
    const n = users.length;
    if (n === 0) {
      const removed = [...this.activeClusterIds];
      this.activeClusterIds.clear();
      this.playerCluster.clear();
      return emptySnapshot(removed);
    }

    const splitRadiusPx = mergeRadiusPx * CLUSTER_SPLIT_HYSTERESIS;
    const mergeR2 = mergeRadiusPx * mergeRadiusPx;
    const splitR2 = splitRadiusPx * splitRadiusPx;
    const cellSize = Math.max(splitRadiusPx, 8);

    const projected: ProjectedPlayer[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const user = users[i];
      const pt = map.project(toLngLat(user.location));
      projected[i] = { user, index: i, x: pt.x, y: pt.y };
    }

    const parent = new Int32Array(n);
    for (let i = 0; i < n; i++) parent[i] = i;

    const find = (i: number): number => {
      let r = i;
      while (parent[r] !== r) {
        parent[r] = parent[parent[r]];
        r = parent[r];
      }
      return r;
    };
    const unite = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    };

    const grid = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const key = cellKey(projected[i].x, projected[i].y, cellSize);
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(i);
    }

    for (let i = 0; i < n; i++) {
      const pi = projected[i];
      const cx = Math.floor(pi.x / cellSize);
      const cy = Math.floor(pi.y / cellSize);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get(`${cx + dx},${cy + dy}`);
          if (!bucket) continue;

          for (let k = 0; k < bucket.length; k++) {
            const j = bucket[k];
            if (j <= i) continue;

            const pj = projected[j];
            const distSq = (pi.x - pj.x) ** 2 + (pi.y - pj.y) ** 2;
            const idA = pi.user.id;
            const idB = pj.user.id;
            const pk = pairKey(idA, idB);

            const sameCluster =
              this.playerCluster.get(idA) !== undefined &&
              this.playerCluster.get(idA) === this.playerCluster.get(idB);
            const wasMerged = this.mergedPairs.has(pk) || sameCluster;

            if (wasMerged) {
              if (distSq <= splitR2) unite(i, j);
              else this.mergedPairs.delete(pk);
            } else if (distSq <= mergeR2) {
              this.mergedPairs.add(pk);
              unite(i, j);
            }
          }
        }
      }
    }

    const components = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      let list = components.get(root);
      if (!list) {
        list = [];
        components.set(root, list);
      }
      list.push(i);
    }

    const prevPlayerCluster = this.playerCluster;
    const nextPlayerCluster = new Map<string, ClusterId>();
    const clusters: StableCluster[] = [];
    const clusteredUserIds = new Set<string>();
    const singles: UserProfile[] = [];
    const addedClusterIds: ClusterId[] = [];
    const nextClusterIds = new Set<ClusterId>();

    for (const indices of components.values()) {
      if (indices.length < CLUSTER_MIN_MEMBERS) {
        singles.push(projected[indices[0]].user);
        continue;
      }

      const members = indices.map((idx) => projected[idx].user);
      const memberIds = members.map((m) => m.id);

      const votes = new Map<ClusterId, number>();
      for (const id of memberIds) {
        const prev = prevPlayerCluster.get(id);
        if (prev) votes.set(prev, (votes.get(prev) ?? 0) + 1);
      }

      let clusterId: ClusterId | null = null;
      let best = 0;
      for (const [id, count] of votes) {
        if (count > best) {
          best = count;
          clusterId = id;
        }
      }

      const majority = Math.ceil(memberIds.length * 0.5);
      if (!clusterId || best < majority) {
        clusterId = this.newClusterId();
      }

      if (!this.activeClusterIds.has(clusterId)) {
        addedClusterIds.push(clusterId);
      }

      let lngSum = 0;
      let latSum = 0;
      let maxRank = 0;
      for (const idx of indices) {
        const u = projected[idx].user;
        const [lng, lat] = toLngLat(u.location);
        lngSum += lng;
        latSum += lat;
        maxRank = Math.max(maxRank, getRarityRank(u.rarity));
      }

      const count = indices.length;
      for (const id of memberIds) {
        clusteredUserIds.add(id);
        nextPlayerCluster.set(id, clusterId);
      }
      nextClusterIds.add(clusterId);

      clusters.push({
        id: clusterId,
        memberIds,
        members,
        coords: [lngSum / count, latSum / count],
        count,
        rarity: rarityFromRank(maxRank),
      });
    }

    const removedClusterIds: ClusterId[] = [];
    for (const id of this.activeClusterIds) {
      if (!nextClusterIds.has(id)) removedClusterIds.push(id);
    }

    const mergedUserIds: string[] = [];
    const splitUserIds: string[] = [];
    for (const id of clusteredUserIds) {
      if (!prevPlayerCluster.has(id)) mergedUserIds.push(id);
    }
    for (const [id] of prevPlayerCluster) {
      if (!nextPlayerCluster.has(id)) splitUserIds.push(id);
    }

    this.playerCluster = nextPlayerCluster;
    this.activeClusterIds = nextClusterIds;

    return {
      clusters,
      clusteredUserIds,
      singles,
      removedClusterIds,
      addedClusterIds,
      mergedUserIds,
      splitUserIds,
    };
  }

  getClusterIdForPlayer(userId: string): ClusterId | undefined {
    return this.playerCluster.get(userId);
  }
}

function emptySnapshot(removed: ClusterId[]): ClusterEngineSnapshot {
  return {
    clusters: [],
    clusteredUserIds: new Set(),
    singles: [],
    removedClusterIds: removed,
    addedClusterIds: [],
    mergedUserIds: [],
    splitUserIds: [],
  };
}
