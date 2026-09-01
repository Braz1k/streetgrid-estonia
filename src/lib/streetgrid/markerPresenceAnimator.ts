import { presenceDisplayLerpFactor } from "@/lib/streetgrid/avatarVehicleTransition";

export type OpacityAnimTarget = {
  id: string;
  getCurrent: () => number;
  setCurrent: (v: number) => void;
  getTarget: () => number;
  setTarget: (v: number) => void;
  apply: (opacity: number) => void;
};

/** Shared rAF opacity interpolator — one loop for all map markers. */
export class MarkerOpacityAnimator {
  private targets = new Map<string, OpacityAnimTarget>();
  private rafId: number | null = null;
  private readonly epsilon = 0.004;
  private readonly lerp = presenceDisplayLerpFactor();

  register(target: OpacityAnimTarget) {
    this.targets.set(target.id, target);
  }

  unregister(id: string) {
    this.targets.delete(id);
    if (this.targets.size === 0 && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setTarget(id: string, opacity: number) {
    const t = this.targets.get(id);
    if (!t) return;
    t.setTarget(Math.max(0, Math.min(1, opacity)));
    this.ensureRunning();
  }

  /** Snap immediately (mount / teardown). */
  snap(id: string, opacity: number) {
    const t = this.targets.get(id);
    if (!t) return;
    const v = Math.max(0, Math.min(1, opacity));
    t.setCurrent(v);
    t.setTarget(v);
    t.apply(v);
  }

  private ensureRunning() {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    let active = false;
    for (const t of this.targets.values()) {
      const current = t.getCurrent();
      const target = t.getTarget();
      const diff = target - current;
      if (Math.abs(diff) > this.epsilon) {
        const next = current + diff * this.lerp;
        t.setCurrent(next);
        t.apply(next);
        active = true;
      } else if (current !== target) {
        t.setCurrent(target);
        t.apply(target);
      }
    }
    this.rafId = active ? requestAnimationFrame(this.tick) : null;
  };
}

let sharedAnimator = new MarkerOpacityAnimator();

export function getSharedMarkerOpacityAnimator(): MarkerOpacityAnimator {
  return sharedAnimator;
}

/** Stateful hysteresis — show ≥ showMin, hide ≤ hideMax. */
export class ZoomVisibilityGate {
  private visible = false;

  constructor(
    private readonly showMin: number,
    private readonly hideMax: number,
  ) {}

  reset(initialZoom: number) {
    this.visible = initialZoom >= this.showMin;
  }

  update(zoom: number): boolean {
    if (zoom >= this.showMin) this.visible = true;
    else if (zoom <= this.hideMax) this.visible = false;
    return this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }
}

import {
  HYST_LEVEL_BADGE_HIDE_MAX,
  HYST_LEVEL_BADGE_SHOW_MIN,
} from "@/lib/streetgrid/avatarVehicleTransition";

/** Level badge on other players — show ≥ 15.0, hide ≤ 14.6. */
export const levelBadgeGate = new ZoomVisibilityGate(
  HYST_LEVEL_BADGE_SHOW_MIN,
  HYST_LEVEL_BADGE_HIDE_MAX,
);
