import type { Area, Question } from '../types';
import { CODING_PACK } from './coding';
import { GK_PACK } from './gk';
import { WORDS_PACK } from './words';

/**
 * Hand-written starter pack bundled with the app: the offline safety net for the areas that
 * can't be generated on the phone. From Phase 4, AI-generated batches downloaded from Supabase
 * take over and this becomes the last resort.
 */
export const STARTER_PACK: Partial<Record<Area, Question[]>> = {
  gk: GK_PACK,
  coding: CODING_PACK,
  words: WORDS_PACK,
};

/** Problems with a set of questions (empty = all good). Used by tests and future AI imports. */
export function validateQuestions(questions: Question[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const prompts = new Set<string>();
  for (const q of questions) {
    const where = `${q.id}:`;
    if (ids.has(q.id)) problems.push(`${where} duplicate id`);
    ids.add(q.id);
    const key = `${q.prompt}|${q.code ?? ''}|${(q.options ?? []).join('|')}`;
    if (prompts.has(key)) problems.push(`${where} duplicate question`);
    prompts.add(key);
    if (!q.prompt.trim()) problems.push(`${where} empty prompt`);
    if (!q.explanation.trim()) problems.push(`${where} empty explanation`);
    if (![1, 2, 3, 4, 5].includes(q.difficulty)) problems.push(`${where} difficulty out of range`);
    if (q.type === 'mcq') {
      const opts = q.options ?? [];
      if (opts.length < 2 || opts.length > 5) problems.push(`${where} needs 2–5 options`);
      if (!opts.includes(q.answer)) problems.push(`${where} answer is not one of the options`);
      if (new Set(opts).size !== opts.length) problems.push(`${where} duplicate options`);
      if (opts.some((o) => o.length > 40)) problems.push(`${where} option longer than 40 characters`);
    } else if (!/^\d+$/.test(q.answer)) {
      problems.push(`${where} numeric answer must be a whole number ≥ 0`);
    }
    if (q.code) {
      const lines = q.code.split('\n');
      if (lines.length > 10) problems.push(`${where} code longer than 10 lines`);
      if (lines.some((l) => l.length > 34)) problems.push(`${where} code line wider than 34 characters`);
    }
  }
  return problems;
}
