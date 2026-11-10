import type { Area, Difficulty, Question } from '../types';

/**
 * Compact way to write starter-pack questions: the right answer first, then the wrong options.
 * Options are shuffled when the question is shown.
 */
export function mcq(
  area: Area,
  id: string,
  subskill: string,
  difficulty: Difficulty,
  prompt: string,
  answer: string,
  wrong: [string, string, string],
  explanation: string,
  code?: string
): Question {
  return { id, area, subskill, type: 'mcq', prompt, answer, options: [answer, ...wrong], difficulty, explanation, ...(code ? { code } : {}) };
}
