import { requireNativeModule } from 'expo';

/** Raw native functions (see android/.../AppBlockerModule.kt). Complex values travel as JSON. */
type NativeAppBlocker = {
  isAccessibilityEnabled(): boolean;
  openAccessibilitySettings(): void;
  getInstalledAppsAsync(): Promise<string>;
  getTargets(): string;
  setTargets(json: string): void;
  getToday(): string;
  grantMinutes(scope: string, minutes: number): void;
  getShortFormApps(): string;
  openApp(pkg: string): boolean;
  goHome(): void;
};

const Native = requireNativeModule<NativeAppBlocker>('AppBlocker');

export type InstalledApp = { packageName: string; label: string };

/**
 * Daily limit in minutes per *scope*: a package ("com.instagram.android" = whole app) or a
 * Reels/Shorts scope ("com.instagram.android:short"). An app can have either or both.
 */
export type Targets = Record<string, number>;

/** Apps whose short-video feed can be limited separately: pkg → "Reels" | "Shorts". */
export type ShortFormApps = Record<string, string>;

export type TodayStats = {
  day: string;
  /** Milliseconds used today, per scope (whole-app time includes Reels time). */
  usage: Record<string, number>;
  /** Extra milliseconds earned today from tolls, per scope. */
  extra: Record<string, number>;
  /** Tolls paid today, per scope. */
  tolls: Record<string, number>;
  /** Reels/Shorts watched today, per Reels scope. */
  counts: Record<string, number>;
  /** Apps whose Reels detection looks broken (probably an app update); whole app counts instead. */
  stale: string[];
};

export const AppBlocker = {
  isAccessibilityEnabled: () => Native.isAccessibilityEnabled(),
  openAccessibilitySettings: () => Native.openAccessibilitySettings(),
  getInstalledApps: async (): Promise<InstalledApp[]> => JSON.parse(await Native.getInstalledAppsAsync()),
  getTargets: (): Targets => JSON.parse(Native.getTargets()),
  setTargets: (targets: Targets) => Native.setTargets(JSON.stringify(targets)),
  getToday: (): TodayStats => JSON.parse(Native.getToday()),
  grantMinutes: (scope: string, minutes: number) => Native.grantMinutes(scope, minutes),
  getShortFormApps: (): ShortFormApps => JSON.parse(Native.getShortFormApps()),
  openApp: (pkg: string) => Native.openApp(pkg),
  goHome: () => Native.goHome(),
};
