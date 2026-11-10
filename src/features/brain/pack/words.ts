import type { Question } from '../types';
import { mcq } from './build';

/** Words & Vocabulary starter pack. Hand-written and checked, 2026-11-09. */
const w = (...a: Parameters<typeof mcq> extends [unknown, ...infer R] ? R : never) => mcq('words', ...a);

export const WORDS_PACK: Question[] = [
  // synonyms
  w('word-001', 'synonyms', 1, 'Which word means the same as “happy”?', 'Joyful', ['Angry', 'Tired', 'Hungry'], '“Joyful” means full of happiness.'),
  w('word-002', 'synonyms', 1, 'Which word means the same as “big”?', 'Large', ['Tiny', 'Thin', 'Short'], '“Large” and “big” both mean of great size.'),
  w('word-003', 'synonyms', 2, 'Which word means the same as “rapid”?', 'Fast', ['Slow', 'Loud', 'Calm'], '“Rapid” means happening quickly.'),
  w('word-004', 'synonyms', 2, 'Which word means the same as “begin”?', 'Start', ['Finish', 'Pause', 'Delay'], 'To begin is to start.'),
  w('word-005', 'synonyms', 3, 'Which word means the same as “generous”?', 'Giving', ['Greedy', 'Rude', 'Shy'], 'A generous person gives freely.'),
  w('word-006', 'synonyms', 3, 'Which word means the same as “ancient”?', 'Very old', ['Modern', 'Broken', 'Rare'], '“Ancient” means belonging to the distant past.'),
  w('word-007', 'synonyms', 4, 'Which word means the same as “meticulous”?', 'Very careful', ['Careless', 'Quick', 'Noisy'], 'A meticulous person pays close attention to detail.'),
  w('word-008', 'synonyms', 4, 'Which word means the same as “candid”?', 'Honest', ['Secretive', 'Sweet', 'Nervous'], '“Candid” means frank and truthful.'),
  w('word-009', 'synonyms', 5, 'Which word means the same as “ephemeral”?', 'Short-lived', ['Everlasting', 'Heavy', 'Hidden'], 'Ephemeral things last only a short time.'),
  w('word-010', 'synonyms', 5, 'Which word means the same as “ubiquitous”?', 'Found everywhere', ['Very rare', 'Very loud', 'Unknown'], 'Something ubiquitous seems to be everywhere.'),
  // antonyms
  w('word-011', 'antonyms', 1, 'What is the opposite of “hot”?', 'Cold', ['Warm', 'Bright', 'Dry'], 'Hot and cold are opposites.'),
  w('word-012', 'antonyms', 2, 'What is the opposite of “brave”?', 'Cowardly', ['Bold', 'Strong', 'Kind'], 'A coward lacks bravery.'),
  w('word-013', 'antonyms', 3, 'What is the opposite of “scarce”?', 'Plentiful', ['Rare', 'Small', 'Empty'], '“Scarce” means in short supply; “plentiful” means abundant.'),
  w('word-014', 'antonyms', 4, 'What is the opposite of “humble”?', 'Arrogant', ['Modest', 'Quiet', 'Poor'], 'A humble person is modest; an arrogant one thinks too highly of themselves.'),
  w('word-015', 'antonyms', 5, 'What is the opposite of “verbose”?', 'Concise', ['Wordy', 'Loud', 'Clever'], '“Verbose” uses too many words; “concise” uses few.'),
  // meanings
  w('word-016', 'meanings', 1, 'What does “enormous” mean?', 'Very big', ['Very small', 'Very fast', 'Very old'], '“Enormous” means huge.'),
  w('word-017', 'meanings', 2, 'What is a “biography”?', 'A life story of a person', ['A science book', 'A type of poem', 'A map'], 'A biography tells the story of someone’s life.'),
  w('word-018', 'meanings', 2, 'What does “fragile” mean?', 'Easily broken', ['Very strong', 'Very heavy', 'Sweet-smelling'], 'Fragile things break easily.'),
  w('word-019', 'meanings', 3, 'What does “reluctant” mean?', 'Unwilling', ['Excited', 'Lucky', 'Late'], 'Someone reluctant doesn’t want to do something.'),
  w('word-020', 'meanings', 3, 'What does “obsolete” mean?', 'No longer used', ['Brand new', 'Very expensive', 'Hard to find'], 'Obsolete things have been replaced and are out of date.'),
  w('word-021', 'meanings', 4, 'What does “procrastinate” mean?', 'Delay doing something', ['Work very hard', 'Plan carefully', 'Argue loudly'], 'To procrastinate is to keep putting things off.'),
  w('word-022', 'meanings', 4, 'What does “ambiguous” mean?', 'Having more than one meaning', ['Very clear', 'Very large', 'Ambitious'], 'An ambiguous statement can be understood in different ways.'),
  w('word-023', 'meanings', 5, 'What does “pragmatic” mean?', 'Practical and realistic', ['Dreamy', 'Rude', 'Ancient'], 'A pragmatic person focuses on what works in practice.'),
  w('word-024', 'meanings', 5, 'What does “benevolent” mean?', 'Kind and well-meaning', ['Cruel', 'Lazy', 'Forgetful'], '“Benevolent” comes from Latin for “wishing well”.'),
  // odd word out
  w('word-025', 'odd-word', 1, 'Which word is the odd one out?', 'Carrot', ['Apple', 'Banana', 'Mango'], 'The others are fruits; a carrot is a vegetable.'),
  w('word-026', 'odd-word', 2, 'Which word is the odd one out?', 'Table', ['Cat', 'Horse', 'Rabbit'], 'The others are animals.'),
  w('word-027', 'odd-word', 3, 'Which word is the odd one out?', 'Ran', ['Quickly', 'Slowly', 'Happily'], 'The others are adverbs; “ran” is a verb.'),
  w('word-028', 'odd-word', 3, 'Which word is the odd one out?', 'Triangle', ['Cube', 'Sphere', 'Cylinder'], 'The others are 3D shapes; a triangle is flat.'),
  w('word-029', 'odd-word', 4, 'Which word is the odd one out?', 'Violin', ['Trumpet', 'Flute', 'Clarinet'], 'The others are wind instruments; a violin has strings.'),
  w('word-030', 'odd-word', 5, 'Which word is the odd one out?', 'Simile', ['Noun', 'Verb', 'Adjective'], 'The others are parts of speech; a simile is a figure of speech.'),
  // spelling
  w('word-031', 'spelling', 1, 'Which word is spelled correctly?', 'Friend', ['Freind', 'Frend', 'Friennd'], 'Remember: “fri-END” — i before e here.'),
  w('word-032', 'spelling', 2, 'Which word is spelled correctly?', 'Because', ['Becuase', 'Becouse', 'Beacause'], 'B-E-C-A-U-S-E.'),
  w('word-033', 'spelling', 2, 'Which word is spelled correctly?', 'Believe', ['Beleive', 'Belive', 'Beleave'], '“I before e except after c”: believe.'),
  w('word-034', 'spelling', 3, 'Which word is spelled correctly?', 'Necessary', ['Neccessary', 'Necessery', 'Nessesary'], 'One c, two s: ne-c-e-ss-ary.'),
  w('word-035', 'spelling', 3, 'Which word is spelled correctly?', 'Definitely', ['Definately', 'Definitly', 'Defenitely'], 'It contains “finite”: de-finite-ly.'),
  w('word-036', 'spelling', 4, 'Which word is spelled correctly?', 'Accommodate', ['Accomodate', 'Acommodate', 'Acomodate'], 'Double c and double m: a-cc-o-mm-odate.'),
  w('word-037', 'spelling', 4, 'Which word is spelled correctly?', 'Separate', ['Seperate', 'Separete', 'Seprate'], 'There’s “a rat” in sep-a-rat-e.'),
  w('word-038', 'spelling', 5, 'Which word is spelled correctly?', 'Conscientious', ['Consciencious', 'Conscientous', 'Concientious'], 'Con-sci-en-tious: like “science” in the middle.'),
  w('word-039', 'spelling', 5, 'Which word is spelled correctly?', 'Millennium', ['Millenium', 'Milennium', 'Milenium'], 'Double l and double n: mi-ll-e-nn-ium.'),
  w('word-040', 'spelling', 5, 'Which word is spelled correctly?', 'Embarrass', ['Embarass', 'Embarras', 'Embaress'], 'Double r and double s: emba-rr-a-ss.'),
];
