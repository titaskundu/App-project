import type { Area } from './types';

/** Display info for each Brain area (icons are Ionicons names). */
export const AREAS: {
  id: Area;
  title: string;
  description: string;
  icon: 'calculator' | 'extension-puzzle' | 'earth' | 'code-slash' | 'book';
}[] = [
  { id: 'math', title: 'Mental Math', description: 'Quick sums, percentages, simple equations', icon: 'calculator' },
  { id: 'logic', title: 'Logic & Patterns', description: 'Number sequences, odd one out, deductions', icon: 'extension-puzzle' },
  { id: 'gk', title: 'General Knowledge', description: 'Geography, science, history, culture', icon: 'earth' },
  { id: 'coding', title: 'Coding', description: 'Read pseudocode, spot bugs, Big-O', icon: 'code-slash' },
  { id: 'words', title: 'Words & Vocabulary', description: 'Synonyms, meanings, spelling', icon: 'book' },
];

export const AREA_IDS: Area[] = AREAS.map((a) => a.id);

export function areaTitle(area: Area): string {
  return AREAS.find((a) => a.id === area)?.title ?? area;
}
