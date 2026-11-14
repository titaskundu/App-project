/**
 * Pure account rules (unit-tested): username, name, email and password checks, and the age
 * gate. The database enforces the same username format and the 16+ rule, so a modified app
 * can't get around them.
 */

/** Minimum age to use the app until parent mode exists (EU / Germany: GDPR age of consent). */
export const MIN_AGE = 16;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const NAME_MAX = 40;
export const PASSWORD_MIN = 8;
/** Supabase hashes passwords with bcrypt, which only reads the first 72 bytes. */
export const PASSWORD_MAX = 72;

export type Profile = {
  userId: string;
  displayName: string;
  username: string;
  /** "YYYY-MM-DD" */
  birthDate: string;
  /** ISO timestamp */
  createdAt: string;
};

export function normalizeUsername(s: string): string {
  return s.trim().replace(/^@/, '').toLowerCase();
}

/** A problem with this username, or null if it's fine (format only; uniqueness is checked online). */
export function usernameError(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters`;
  if (u.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters`;
  if (!/^[a-z0-9_]+$/.test(u)) return 'Only letters, numbers and _';
  return null;
}

/** A username suggestion from a name: "Titas Kundu" → "titas_kundu". */
export function suggestUsername(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, USERNAME_MAX);
  return base.length >= USERNAME_MIN ? base : (base + 'panda').slice(0, USERNAME_MAX);
}

export function nameError(raw: string): string | null {
  const n = raw.trim();
  if (!n) return 'Tell us your name';
  if (n.length > NAME_MAX) return `At most ${NAME_MAX} characters`;
  return null;
}

export function emailError(raw: string): string | null {
  const e = raw.trim();
  if (!e) return 'Enter your email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return "That doesn't look like an email";
  return null;
}

export function passwordError(p: string): string | null {
  if (p.length < PASSWORD_MIN) return `At least ${PASSWORD_MIN} characters`;
  if (p.length > PASSWORD_MAX) return `At most ${PASSWORD_MAX} characters`;
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Use letters and at least one number';
  return null;
}

/** "YYYY-MM-DD" for a real calendar date, else null. */
export function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Age in whole years on `today` (local date). Someone born on 29 Feb turns a year older on
 * 1 Mar in non-leap years, the same rule the database uses (`current_date - interval`).
 */
export function ageOn(birthIso: string, today: Date): number {
  const [y, m, d] = birthIso.split('-').map(Number);
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age;
}

export function birthDateError(birthIso: string | null, today: Date): string | null {
  if (!birthIso) return 'Enter a real date';
  const age = ageOn(birthIso, today);
  if (age < 0) return "That date hasn't happened yet";
  if (age > 120) return 'Check the year';
  return null;
}

export function isOldEnough(birthIso: string, today: Date): boolean {
  return ageOn(birthIso, today) >= MIN_AGE;
}

/** "Titas Kundu" → "TK", "panda" → "P". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}
