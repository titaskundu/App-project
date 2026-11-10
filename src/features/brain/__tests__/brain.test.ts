import { describe, expect, it } from '@jest/globals';

import { STARTER_PACK, validateQuestions } from '../pack';
import { createRng } from '../random';
import { difficultyFor, expectedScore, START_RATING, updateRatings } from '../rating';
import { nextQuestion } from '../select';
import {
  BANK_DAILY_CAP,
  passMark,
  passed,
  practiceReward,
  questionCount,
  tollReward,
  TOLL_MINUTES,
} from '../toll';
import type { AnswerRecord } from '../types';

describe('starter pack', () => {
  it.each(Object.entries(STARTER_PACK))('%s pack is valid and has 40 questions', (_area, qs) => {
    expect(qs).toHaveLength(40);
    expect(validateQuestions(qs!)).toEqual([]);
    expect(qs!.every((q) => q.options?.length === 4)).toBe(true);
  });

  it('covers every difficulty in every area', () => {
    for (const qs of Object.values(STARTER_PACK)) {
      expect(new Set(qs!.map((q) => q.difficulty))).toEqual(new Set([1, 2, 3, 4, 5]));
    }
  });

  it('has unique ids across all areas', () => {
    const all = Object.values(STARTER_PACK).flat();
    expect(new Set(all.map((q) => q!.id)).size).toBe(all.length);
  });
});

describe('toll rules', () => {
  it('starts at 3 questions and adds one per repeat, up to 8', () => {
    expect([0, 1, 2, 5, 9].map(questionCount)).toEqual([3, 4, 5, 8, 8]);
  });

  it('needs about 75-80% right', () => {
    expect([3, 4, 5, 6, 7, 8].map(passMark)).toEqual([2, 3, 4, 5, 6, 6]);
    expect(passed(2, 3)).toBe(true);
    expect(passed(1, 3)).toBe(false);
  });

  it('always unlocks 10 min, plus capped bonus for extra answers', () => {
    expect(tollReward(0)).toBe(TOLL_MINUTES);
    expect(tollReward(2)).toBe(14);
    expect(tollReward(50)).toBe(20);
  });

  it('caps banked practice minutes per day', () => {
    expect(practiceReward(true, 0)).toBe(5);
    expect(practiceReward(true, BANK_DAILY_CAP - 2)).toBe(2);
    expect(practiceReward(true, BANK_DAILY_CAP)).toBe(0);
    expect(practiceReward(false, 0)).toBe(0);
  });
});

describe('ratings', () => {
  const answer = (correct: boolean, difficulty: 1 | 3 | 5 = 3): AnswerRecord => ({
    questionId: 'q', area: 'math', subskill: 'addition', difficulty, correct, ms: 5000, fast: false,
  });

  it('goes up for right answers and down for wrong ones', () => {
    expect(updateRatings({}, answer(true)).math).toBeGreaterThan(START_RATING);
    expect(updateRatings({}, answer(false)).math).toBeLessThan(START_RATING);
    expect(updateRatings({}, answer(true))['math/addition']).toBeGreaterThan(START_RATING);
  });

  it('rewards hard questions more than easy ones', () => {
    const hard = updateRatings({}, answer(true, 5)).math;
    const easy = updateRatings({}, answer(true, 1)).math;
    expect(hard).toBeGreaterThan(easy);
  });

  it('maps ratings to sensible difficulties', () => {
    expect(difficultyFor(START_RATING)).toBe(1);
    expect(difficultyFor(1300)).toBe(4);
    expect(difficultyFor(2000)).toBe(5);
    expect(expectedScore(START_RATING, 1)).toBeGreaterThan(0.5);
  });
});

describe('question selection', () => {
  it('only uses the areas the player picked', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const q = nextQuestion({ areas: ['gk', 'words'], ratings: {}, rng });
      expect(['gk', 'words']).toContain(q.area);
    }
  });

  it('favours the weakest area', () => {
    const rng = createRng(2);
    const counts = { math: 0, logic: 0 };
    for (let i = 0; i < 1000; i++) {
      const q = nextQuestion({ areas: ['math', 'logic'], ratings: { math: 800, logic: 1400 }, rng });
      counts[q.area as 'math' | 'logic']++;
    }
    expect(counts.math).toBeGreaterThan(counts.logic * 2);
  });

  it('avoids pack questions already seen', () => {
    const rng = createRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(nextQuestion({ areas: ['coding'], ratings: {}, seen, rng }).id);
    expect(seen.size).toBe(40);
  });

  it('shuffles options but keeps the answer among them', () => {
    const rng = createRng(4);
    for (let i = 0; i < 100; i++) {
      const q = nextQuestion({ areas: ['words'], ratings: {}, rng });
      expect(q.options).toContain(q.answer);
    }
  });
});
