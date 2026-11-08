import { requireNativeModule } from 'expo';

/** Raw native functions (see android/.../AppBlockerModule.kt). Complex values travel as JSON. */
type NativeAppBlocker = {
  isAccessibilityEnabled(): boolean;
  openAccessibilitySettings(): void;
  getInstalledAppsAsync(): Promise<string>;
  getTargets(): string;
  setTargets(json: string): void;
  getToday(): string;
  grantMinutes(pkg: string, minutes: number): void;
  openApp(pkg: string): boolean;
  goHome(): void;
};

const Native = requireNativeModule<NativeAppBlocker>('AppBlocker');

export type InstalledApp = { packageName: string; label: string };

/** Blocked apps → daily limit in minutes. */
export type Targets = Record<string, number>;

export type TodayStats = {
  day: string;
  /** Milliseconds used today, per app. */
  usage: Record<string, number>;
  /** Extra milliseconds earned today from tolls, per app. */
  extra: Record<string, number>;
  /** Tolls paid today, per app. */
  tolls: Record<string, number>;
};

export const AppBlocker = {
  isAccessibilityEnabled: () => Native.isAccessibilityEnabled(),
  openAccessibilitySettings: () => Native.openAccessibilitySettings(),
  getInstalledApps: async (): Promise<InstalledApp[]> => JSON.parse(await Native.getInstalledAppsAsync()),
  getTargets: (): Targets => JSON.parse(Native.getTargets()),
  setTargets: (targets: Targets) => Native.setTargets(JSON.stringify(targets)),
  getToday: (): TodayStats => JSON.parse(Native.getToday()),
  grantMinutes: (pkg: string, minutes: number) => Native.grantMinutes(pkg, minutes),
  openApp: (pkg: string) => Native.openApp(pkg),
  goHome: () => Native.goHome(),
};
