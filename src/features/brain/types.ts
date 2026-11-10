/** The five Brain areas the user can pick during setup. */
export type Area = 'math' | 'logic' | 'gk' | 'coding' | 'words';

/** 1 (easy) … 5 (hard). */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** One question, in the same shape for every area (generated or from the starter pack). */
export type Question = {
  id: string;
  area: Area;
  /** Finer topic inside an area, e.g. "percentages" or "big-o". Ratings are kept per subskill. */
  subskill: string;
  /** numeric = typed on a keypad; mcq = pick one of `options`. */
  type: 'numeric' | 'mcq';
  prompt: string;
  /** Pseudocode shown in a monospace card (Coding questions). */
  code?: string;
  /** Multiple-choice options (mcq only). */
  options?: string[];
  /** numeric: the number as a string ("42"); mcq: the exact text of the right option. */
  answer: string;
  difficulty: Difficulty;
  /** One line shown after a wrong answer. */
  explanation: string;
};

/** What happened when the user answered one question. */
export type AnswerRecord = {
  questionId: string;
  area: Area;
  subskill: string;
  difficulty: Difficulty;
  correct: boolean;
  /** Time taken in ms (the full time limit if it ran out). */
  ms: number;
  /** Answered within the "fast" window (2× bonus, turned into Sparks in Phase 5). */
  fast: boolean;
};
