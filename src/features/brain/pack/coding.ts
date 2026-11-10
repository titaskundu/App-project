import type { Question } from '../types';
import { mcq } from './build';

/**
 * Coding starter pack: language-neutral pseudocode. Every snippet was traced by hand,
 * 2026-11-09. Conventions: `←` assigns, `//` is whole-number division, `%` is remainder,
 * lists start at index 0, `for i from a to b` includes both a and b.
 */
const c = (...a: Parameters<typeof mcq> extends [unknown, ...infer R] ? R : never) => mcq('coding', ...a);

export const CODING_PACK: Question[] = [
  // output
  c('code-001', 'output', 1, 'What does this print?', '8', ['5', '3', '53'], 'x is 5, then 3 is added: 5 + 3 = 8.', 'x ← 5\nx ← x + 3\nprint(x)'),
  c('code-002', 'output', 1, 'What does this print?', '10', ['4', '6', '24'], 'a + b = 4 + 6 = 10.', 'a ← 4\nb ← 6\nprint(a + b)'),
  c('code-003', 'output', 1, 'What does this print?', 'big', ['small', 'nothing', 'error'], '12 > 10 is true, so the first branch runs.', 'n ← 12\nif n > 10:\n  print("big")\nelse:\n  print("small")'),
  c('code-004', 'output', 2, 'What does this print?', '15', ['5', '10', '14'], '1+2+3+4+5 = 15.', 'total ← 0\nfor i from 1 to 5:\n  total ← total + i\nprint(total)'),
  c('code-005', 'output', 2, 'What does this print?', '2', ['3', '1', '3.5'], '7 // 3 is whole-number division: 2.', 'print(7 // 3)'),
  c('code-006', 'output', 2, 'What does this print?', '1', ['3', '2', '0'], '7 % 3 is the remainder of 7 ÷ 3, which is 1.', 'print(7 % 3)'),
  c('code-007', 'output', 2, 'What does this print?', '30', ['10', '20', '40'], 'Lists start at 0, so list[2] is the third item: 30.', 'list ← [10, 20, 30, 40]\nprint(list[2])'),
  c('code-008', 'output', 3, 'What does this print?', '16', ['8', '32', '4'], 'x doubles 4 times: 1 → 2 → 4 → 8 → 16.', 'x ← 1\nrepeat 4 times:\n  x ← x * 2\nprint(x)'),
  c('code-009', 'output', 3, 'What does this print?', '3', ['4', '2', '5'], 'Of 4, 7, 8 and 12, the even ones are 4, 8 and 12: 3 numbers.', 'count ← 0\nfor n in [4, 7, 8, 12]:\n  if n % 2 = 0:\n    count ← count + 1\nprint(count)'),
  c('code-010', 'output', 3, 'What does this print?', '2 1', ['1 2', '2 2', '1 1'], 'The swap uses a temporary variable, so a and b trade values.', 'a ← 1\nb ← 2\ntemp ← a\na ← b\nb ← temp\nprint(a, b)'),
  c('code-011', 'output', 4, 'What does this print?', '6', ['3', '5', '9'], 'f(3) = 3 + f(2) = 3 + 2 + f(1) = 3 + 2 + 1 = 6.', 'function f(n):\n  if n = 1: return 1\n  return n + f(n - 1)\nprint(f(3))'),
  c('code-012', 'output', 4, 'What does this print?', '9', ['3', '1', '12'], 'The loop keeps the largest value seen: 9.', 'best ← 0\nfor n in [3, 9, 1, 7]:\n  if n > best:\n    best ← n\nprint(best)'),
  c('code-013', 'output', 5, 'What does this print?', '4', ['3', '5', '16'], 'Halving 16: 16 → 8 → 4 → 2 → 1 takes 4 steps.', 'n ← 16\nsteps ← 0\nwhile n > 1:\n  n ← n // 2\n  steps ← steps + 1\nprint(steps)'),
  c('code-014', 'output', 5, 'What does this print?', 'cba', ['abc', 'cab', 'bca'], 'Each letter is put in front of the result, reversing the word.', 's ← "abc"\nr ← ""\nfor ch in s:\n  r ← ch + r\nprint(r)'),
  // loops
  c('code-015', 'loops', 1, 'How many times does "hi" print?', '3', ['2', '4', '1'], 'i takes the values 1, 2 and 3.', 'for i from 1 to 3:\n  print("hi")'),
  c('code-016', 'loops', 2, 'How many times does the loop body run?', '5', ['4', '6', '0'], 'i = 0, 2, 4, 6, 8 → 5 times (10 is not < 10).', 'i ← 0\nwhile i < 10:\n  i ← i + 2'),
  c('code-017', 'loops', 3, 'How many times is "*" printed?', '12', ['7', '3', '4'], 'The inner loop runs 4 times for each of 3 outer runs: 3 × 4 = 12.', 'for i from 1 to 3:\n  for j from 1 to 4:\n    print("*")'),
  c('code-018', 'loops', 3, 'What is the last value of i that is printed?', '9', ['10', '8', '1'], 'The loop stops once i reaches 10, so 9 is the last printed.', 'i ← 1\nwhile i < 10:\n  print(i)\n  i ← i + 1'),
  c('code-019', 'loops', 4, 'How many times does this loop run?', 'Forever', ['10 times', '0 times', '1 time'], 'i is never changed inside the loop, so i < 10 stays true: an infinite loop.', 'i ← 0\nwhile i < 10:\n  print(i)'),
  c('code-020', 'loops', 5, 'How many times is "x" printed?', '6', ['9', '3', '5'], 'j runs from i to 3: i=1 → 3, i=2 → 2, i=3 → 1, total 6.', 'for i from 1 to 3:\n  for j from i to 3:\n    print("x")'),
  // bugs
  c('code-021', 'bugs', 2, 'This should add up the list but returns the wrong total. Why?', 'total is reset inside the loop', ['The list is empty', 'It should use subtraction', 'print is in the wrong place'], 'Setting total ← 0 inside the loop throws away earlier sums.', 'for n in [2, 4, 6]:\n  total ← 0\n  total ← total + n\nprint(total)'),
  c('code-022', 'bugs', 2, 'This should print 1 to 5. What does it actually print?', '1 to 4', ['1 to 5', '0 to 5', '2 to 5'], 'With i < 5 the loop stops before printing 5 (an off-by-one bug).', 'i ← 1\nwhile i < 5:\n  print(i)\n  i ← i + 1'),
  c('code-023', 'bugs', 3, 'What goes wrong here?', 'list[4] is past the end', ['Lists start at 1', 'The values are too large', 'Nothing, it prints 50'], 'A list of 4 items has indexes 0–3, so index 4 is out of range.', 'list ← [10, 20, 30, 40]\nprint(list[4])'),
  c('code-024', 'bugs', 3, 'This should return the larger number. What is the bug?', 'The comparison is reversed', ['It returns nothing', 'It needs a loop', 'a and b must be lists'], 'It returns a when a < b, which is the smaller one.', 'function max(a, b):\n  if a < b: return a\n  return b'),
  c('code-025', 'bugs', 4, 'This should check if n is even. When does it fail?', 'For every number', ['Only for 0', 'Only for negative numbers', 'Never'], 'n % 2 = 1 is true for odd numbers, so the answers are swapped for every n.', 'function isEven(n):\n  return n % 2 = 1'),
  c('code-026', 'bugs', 5, 'This should average the list but crashes for one input. Which?', 'An empty list', ['A list of one number', 'Negative numbers', 'A list of zeros'], 'For an empty list, length is 0, so it divides by zero.', 'function average(list):\n  return sum(list) / length(list)'),
  // complexity
  c('code-027', 'complexity', 2, 'Looking up one item by its index in a list is…', 'O(1)', ['O(n)', 'O(log n)', 'O(n²)'], 'Index access jumps straight to the position: constant time.'),
  c('code-028', 'complexity', 3, 'Checking every item once in a list of n items is…', 'O(n)', ['O(1)', 'O(n²)', 'O(log n)'], 'The work grows in step with n: linear time.'),
  c('code-029', 'complexity', 3, 'Two nested loops, each over all n items, take…', 'O(n²)', ['O(n)', 'O(2n)', 'O(log n)'], 'n inner steps for each of n outer steps = n × n.'),
  c('code-030', 'complexity', 4, 'Binary search on a sorted list of n items takes…', 'O(log n)', ['O(n)', 'O(1)', 'O(n log n)'], 'Each step halves the remaining range.'),
  c('code-031', 'complexity', 4, 'Good general-purpose sorting algorithms (like merge sort) take…', 'O(n log n)', ['O(n)', 'O(log n)', 'O(n³)'], 'Comparison sorts can’t beat n log n in general; merge sort reaches it.'),
  c('code-032', 'complexity', 5, 'Roughly how many steps does binary search need for 1,000,000 sorted items?', 'About 20', ['About 1,000', 'About 500,000', 'About 2'], '2²⁰ ≈ 1,000,000, so about 20 halvings.'),
  // data structures
  c('code-033', 'data-structures', 1, 'Which structure works “last in, first out” (like a pile of plates)?', 'Stack', ['Queue', 'Tree', 'Set'], 'A stack removes the most recently added item first.'),
  c('code-034', 'data-structures', 2, 'Which structure works “first in, first out” (like a line at a shop)?', 'Queue', ['Stack', 'Graph', 'Map'], 'A queue removes the oldest item first.'),
  c('code-035', 'data-structures', 2, 'Which structure stores key → value pairs for fast lookup?', 'Hash map', ['Array', 'Stack', 'Linked list'], 'A hash map (dictionary) finds a value by its key in about constant time.'),
  c('code-036', 'data-structures', 3, 'A set is best for…', 'Checking if an item is present', ['Keeping items in order', 'Storing duplicates', 'Sorting numbers'], 'Sets store unique items and answer “is x in here?” quickly.'),
  c('code-037', 'data-structures', 3, 'After push(1), push(2), push(3), pop() on an empty stack, what is removed?', '3', ['1', '2', 'Nothing'], 'Last in, first out: 3 was pushed last.'),
  c('code-038', 'data-structures', 4, 'In a binary search tree, where are values smaller than a node?', 'In its left subtree', ['In its right subtree', 'At the root', 'Anywhere'], 'BST rule: left < node < right.'),
  c('code-039', 'data-structures', 4, 'Which structure models a road map of cities and roads best?', 'Graph', ['Stack', 'Queue', 'Array'], 'Cities are nodes and roads are edges.'),
  c('code-040', 'data-structures', 5, 'Inserting at the front of a linked list takes…', 'O(1)', ['O(n)', 'O(log n)', 'O(n²)'], 'You only change the head pointer; nothing else moves.'),
];
