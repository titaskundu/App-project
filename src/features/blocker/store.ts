import { create } from 'zustand';

import {
  AppBlocker,
  type InstalledApp,
  type ShortFormApps,
  type Targets,
  type TodayStats,
} from '@modules/app-blocker';

import { scopePkg, shortScope, targetsForPicked } from './limits';

/**
 * App-side view of the blocker. The native module is the source of truth (the watcher
 * service reads the same saved data), so every change is written straight through.
 *
 * Limits are per *scope*: "pkg" (whole app) or "pkg:short" (Reels/Shorts only).
 */
type BlockerState = {
  apps: InstalledApp[];
  appsLoaded: boolean;
  targets: Targets;
  today: TodayStats | null;
  accessibilityOn: boolean;
  /** Apps whose Reels/Shorts can be limited separately: pkg → "Reels" | "Shorts". */
  shortFormApps: ShortFormApps;

  loadApps: () => Promise<void>;
  refresh: () => void;
  /** Replace the set of tracked apps (from the app picker). */
  setTargetSet: (pkgs: string[]) => void;
  /** Set a scope's limit; null removes that limit (the app stays tracked if it has another). */
  setLimit: (scope: string, minutes: number | null) => void;
  /** Stop tracking an app entirely (both limits). */
  removeApp: (pkg: string) => void;
};

function save(targets: Targets): Targets {
  AppBlocker.setTargets(targets);
  return targets;
}

export const useBlocker = create<BlockerState>((set, get) => ({
  apps: [],
  appsLoaded: false,
  targets: {},
  today: null,
  accessibilityOn: false,
  shortFormApps: {},

  loadApps: async () => {
    if (get().appsLoaded) return;
    const apps = await AppBlocker.getInstalledApps();
    set({ apps, appsLoaded: true });
  },

  refresh: () => {
    set({
      targets: AppBlocker.getTargets(),
      today: AppBlocker.getToday(),
      accessibilityOn: AppBlocker.isAccessibilityEnabled(),
      ...(Object.keys(get().shortFormApps).length ? {} : { shortFormApps: AppBlocker.getShortFormApps() }),
    });
  },

  setTargetSet: (pkgs) => {
    set({ targets: save(targetsForPicked(get().targets, pkgs, get().shortFormApps)) });
  },

  setLimit: (scope, minutes) => {
    const targets = { ...get().targets };
    if (minutes === null) delete targets[scope];
    else targets[scope] = minutes;
    set({ targets: save(targets) });
  },

  removeApp: (pkg) => {
    const targets = { ...get().targets };
    delete targets[pkg];
    delete targets[shortScope(pkg)];
    set({ targets: save(targets) });
  },
}));

/** Display name for a package, falling back to the package id. */
export function appLabel(apps: InstalledApp[], pkg: string): string {
  return apps.find((a) => a.packageName === pkg)?.label ?? pkg;
}

/** Display name for a scope: "Instagram" or "Instagram Reels". */
export function scopeLabel(apps: InstalledApp[], shortFormApps: ShortFormApps, scope: string): string {
  const pkg = scopePkg(scope);
  const name = appLabel(apps, pkg);
  return scope === pkg ? name : `${name} ${shortFormApps[pkg] ?? 'Reels'}`;
}
