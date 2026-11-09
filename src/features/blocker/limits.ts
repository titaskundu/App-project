/** Pure helpers for limits and time display (no React, no native code — easy to unit-test). */

/** Choices for an app's daily limit, in minutes. 1 minute is handy for testing. */
export const LIMIT_STEPS = [1, 5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

export const DEFAULT_LIMIT = 15;

/** Minutes unlocked by one toll (Phase 1 placeholder; Phase 2+ makes repeats harder). */
export const TOLL_MINUTES = 5;

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
