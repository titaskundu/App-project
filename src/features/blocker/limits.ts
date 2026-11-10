/** Pure helpers for limits and time display (no React, no native code — easy to unit-test). */

/** Choices for an app's daily limit, in minutes. 1 minute is handy for testing. */
export const LIMIT_STEPS = [1, 5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

export const DEFAULT_LIMIT = 15;

/** Next limit step up or down from the current value. */
export function stepLimit(current: number, direction: 1 | -1): number {
  const steps: readonly number[] = LIMIT_STEPS;
  const idx = steps.findIndex((s) => s >= current);
  const at = idx === -1 ? steps.length - 1 : idx;
  const exact = steps[at] === current;
  const next = direction === 1 ? (exact ? at + 1 : at) : at - 1;
  return steps[Math.min(Math.max(next, 0), steps.length - 1)];
}

/** "45s", "12 min", "1h 05m" */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/** Allowance for today = daily limit + minutes earned from tolls. */
export function allowanceMs(limitMinutes: number, extraMs: number): number {
  return limitMinutes * 60_000 + extraMs;
}

/** Common distracting apps, shown first in the picker when installed. */
export const SUGGESTED_PACKAGES = [
  'com.instagram.android',
  'com.google.android.youtube',
  'com.zhiliaoapp.musically', // TikTok
  'com.facebook.katana',
  'com.twitter.android', // X
  'com.snapchat.android',
  'com.reddit.frontpage',
  'in.mohalla.sharechat',
  'com.netflix.mediaclient',
];

// ---- scopes: whole app vs Reels/Shorts --------------------------------------

const SHORT_SUFFIX = ':short';

/** "com.instagram.android" → "com.instagram.android:short" (its Reels/Shorts limit). */
export function shortScope(pkg: string): string {
  return pkg + SHORT_SUFFIX;
}

export function isShortScope(scope: string): boolean {
  return scope.endsWith(SHORT_SUFFIX);
}

/** The app a scope belongs to. */
export function scopePkg(scope: string): string {
  return isShortScope(scope) ? scope.slice(0, -SHORT_SUFFIX.length) : scope;
}

/** Apps with any limit, in the order they were added, without duplicates. */
export function trackedPackages(targets: Record<string, number>): string[] {
  return [...new Set(Object.keys(targets).map(scopePkg))];
}

/**
 * New targets after the user saves the app picker.
 * - Apps kept: keep all their limits.
 * - New apps: Reels/Shorts limit for apps that support it (the point of tracking them),
 *   whole-app limit for everything else.
 * - Apps no longer picked: all their limits removed.
 */
export function targetsForPicked(
  current: Record<string, number>,
  picked: string[],
  shortFormApps: Record<string, string>
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const pkg of picked) {
    const short = shortScope(pkg);
    const had = current[pkg] !== undefined || current[short] !== undefined;
    if (had) {
      if (current[pkg] !== undefined) next[pkg] = current[pkg];
      if (current[short] !== undefined) next[short] = current[short];
    } else if (shortFormApps[pkg]) {
      next[short] = DEFAULT_LIMIT;
    } else {
      next[pkg] = DEFAULT_LIMIT;
    }
  }
  return next;
}

// ---- limit mode: Reels only / whole app / both -------------------------------

export type LimitMode = 'short' | 'app' | 'both';

/** Which limits an app has (null when it isn't tracked). */
export function limitMode(targets: Record<string, number>, pkg: string): LimitMode | null {
  const app = targets[pkg] !== undefined;
  const short = targets[shortScope(pkg)] !== undefined;
  if (app && short) return 'both';
  if (app) return 'app';
  if (short) return 'short';
  return null;
}

/**
 * Targets after switching an app's mode. Limits that stay keep their minutes; a limit that
 * gets turned on starts at DEFAULT_LIMIT.
 */
export function targetsForMode(
  targets: Record<string, number>,
  pkg: string,
  mode: LimitMode
): Record<string, number> {
  const next = { ...targets };
  const short = shortScope(pkg);
  if (mode === 'app' || mode === 'both') next[pkg] = targets[pkg] ?? DEFAULT_LIMIT;
  else delete next[pkg];
  if (mode === 'short' || mode === 'both') next[short] = targets[short] ?? DEFAULT_LIMIT;
  else delete next[short];
  return next;
}

// ---- today's status per app --------------------------------------------------

/** Usage level: under 80% of the allowance, almost out, or out of time. */
export type UsageLevel = 'ok' | 'near' | 'over';

export function usageLevel(ratio: number): UsageLevel {
  return ratio >= 1 ? 'over' : ratio >= 0.8 ? 'near' : 'ok';
}

export type ScopeStatus = {
  scope: string;
  kind: 'short' | 'app';
  limit: number;
  usedMs: number;
  allowanceMs: number;
  /** used / allowance (can pass 1). */
  ratio: number;
  level: UsageLevel;
};

type TodayLike = { usage: Record<string, number>; extra: Record<string, number> } | null | undefined;

/** Status of each limit an app has today: Reels/Shorts first, then whole app. */
export function scopeStatuses(targets: Record<string, number>, today: TodayLike, pkg: string): ScopeStatus[] {
  const out: ScopeStatus[] = [];
  for (const [scope, kind] of [
    [shortScope(pkg), 'short'],
    [pkg, 'app'],
  ] as const) {
    const limit = targets[scope];
    if (limit === undefined) continue;
    const usedMs = today?.usage[scope] ?? 0;
    const allowance = allowanceMs(limit, today?.extra[scope] ?? 0);
    const ratio = allowance > 0 ? usedMs / allowance : 1;
    out.push({ scope, kind, limit, usedMs, allowanceMs: allowance, ratio, level: usageLevel(ratio) });
  }
  return out;
}

/** The app's most pressing level today (any limit over → over). */
export function worstLevel(statuses: ScopeStatus[]): UsageLevel {
  const max = Math.max(0, ...statuses.map((s) => s.ratio));
  return usageLevel(max);
}

/** Tracked apps sorted most-urgent first (highest used/allowance), keeping add order on ties. */
export function byUrgency(targets: Record<string, number>, today: TodayLike): string[] {
  const pkgs = trackedPackages(targets);
  const score = (pkg: string) => Math.max(0, ...scopeStatuses(targets, today, pkg).map((s) => s.ratio));
  return pkgs
    .map((pkg, i) => ({ pkg, i, s: score(pkg) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.pkg);
}

/** Targets with one app's limits replaced by `limits` (scopes of that app only). */
export function withAppLimits(
  targets: Record<string, number>,
  pkg: string,
  limits: Record<string, number>
): Record<string, number> {
  const next = { ...targets };
  delete next[pkg];
  delete next[shortScope(pkg)];
  for (const [scope, minutes] of Object.entries(limits)) {
    if (scopePkg(scope) === pkg) next[scope] = minutes;
  }
  return next;
}

/** One app's limits picked out of the targets: { "pkg": 30, "pkg:short": 10 }. */
export function appLimits(targets: Record<string, number>, pkg: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const scope of [shortScope(pkg), pkg]) if (targets[scope] !== undefined) out[scope] = targets[scope];
  return out;
}
