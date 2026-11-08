import { create } from 'zustand';

import { AppBlocker, type InstalledApp, type Targets, type TodayStats } from '@modules/app-blocker';

import { DEFAULT_LIMIT } from './limits';

/**
 * App-side view of the blocker. The native module is the source of truth (the watcher
 * service reads the same saved data), so every change is written straight through.
 */
type BlockerState = {
  apps: InstalledApp[];
  appsLoaded: boolean;
  targets: Targets;
  today: TodayStats | null;
  accessibilityOn: boolean;

  loadApps: () => Promise<void>;
  refresh: () => void;
  addTargets: (pkgs: string[]) => void;
  setTargetSet: (pkgs: string[]) => void;
  setLimit: (pkg: string, minutes: number) => void;
  removeTarget: (pkg: string) => void;
};

export const useBlocker = create<BlockerState>((set, get) => ({
  apps: [],
  appsLoaded: false,
  targets: {},
  today: null,
  accessibilityOn: false,

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
    });
  },

  addTargets: (pkgs) => {
    const targets = { ...get().targets };
    pkgs.forEach((p) => {
      if (!targets[p]) targets[p] = DEFAULT_LIMIT;
    });
    AppBlocker.setTargets(targets);
    set({ targets });
  },

  /** Replace the blocked set: keep existing limits, add new apps at the default limit. */
  setTargetSet: (pkgs) => {
    const current = get().targets;
    const targets: Targets = {};
    pkgs.forEach((p) => {
      targets[p] = current[p] ?? DEFAULT_LIMIT;
    });
    AppBlocker.setTargets(targets);
    set({ targets });
  },

  setLimit: (pkg, minutes) => {
    const targets = { ...get().targets, [pkg]: minutes };
    AppBlocker.setTargets(targets);
    set({ targets });
  },

  removeTarget: (pkg) => {
    const targets = { ...get().targets };
    delete targets[pkg];
    AppBlocker.setTargets(targets);
    set({ targets });
  },
}));

/** Display name for a package, falling back to the package id. */
export function appLabel(apps: InstalledApp[], pkg: string): string {
  return apps.find((a) => a.packageName === pkg)?.label ?? pkg;
}
