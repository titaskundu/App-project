import type { Question } from '../types';
import { mcq } from './build';

/** General Knowledge starter pack (global). Hand-written and fact-checked, 2026-11-09. */
const g = (...a: Parameters<typeof mcq> extends [unknown, ...infer R] ? R : never) => mcq('gk', ...a);

export const GK_PACK: Question[] = [
  // geography
  g('gk-001', 'geography', 1, 'What is the capital of France?', 'Paris', ['Lyon', 'Marseille', 'Nice'], 'Paris has been France’s capital for centuries.'),
  g('gk-002', 'geography', 1, 'Which is the largest ocean on Earth?', 'Pacific', ['Atlantic', 'Indian', 'Arctic'], 'The Pacific covers about a third of Earth’s surface.'),
  g('gk-003', 'geography', 1, 'On which continent is Egypt mostly located?', 'Africa', ['Asia', 'Europe', 'South America'], 'Egypt is in north-east Africa (with Sinai in Asia).'),
  g('gk-004', 'geography', 2, 'What is the capital of Japan?', 'Tokyo', ['Kyoto', 'Osaka', 'Hiroshima'], 'Tokyo is Japan’s capital and largest city.'),
  g('gk-005', 'geography', 2, 'Which river flows through Cairo?', 'Nile', ['Congo', 'Niger', 'Zambezi'], 'The Nile runs north through Cairo to the Mediterranean.'),
  g('gk-006', 'geography', 2, 'Mount Everest lies on the border of Nepal and which other country/region?', 'China (Tibet)', ['India', 'Bhutan', 'Pakistan'], 'Everest sits on the Nepal–China (Tibet) border.'),
  g('gk-007', 'geography', 3, 'What is the capital of Australia?', 'Canberra', ['Sydney', 'Melbourne', 'Perth'], 'Canberra was purpose-built as the capital.'),
  g('gk-008', 'geography', 3, 'Which country has the most people (2024)?', 'India', ['China', 'United States', 'Indonesia'], 'India overtook China in population in 2023.'),
  g('gk-009', 'geography', 3, 'The Atacama, one of the driest deserts, is mainly in which country?', 'Chile', ['Peru', 'Mexico', 'Morocco'], 'The Atacama stretches along northern Chile.'),
  g('gk-010', 'geography', 4, 'What is the capital of Canada?', 'Ottawa', ['Toronto', 'Vancouver', 'Montreal'], 'Ottawa, in Ontario, is Canada’s capital.'),
  g('gk-011', 'geography', 4, 'Which is the smallest country in the world by area?', 'Vatican City', ['Monaco', 'San Marino', 'Malta'], 'Vatican City is about 0.44 km².'),
  g('gk-012', 'geography', 5, 'Lake Baikal, the deepest lake on Earth, is in which country?', 'Russia', ['Mongolia', 'Kazakhstan', 'Canada'], 'Baikal is in Siberia, Russia, and is over 1,600 m deep.'),
  // science
  g('gk-013', 'science', 1, 'What do plants mainly take in from the air to make food?', 'Carbon dioxide', ['Oxygen', 'Nitrogen', 'Helium'], 'Photosynthesis turns carbon dioxide and water into sugar.'),
  g('gk-014', 'science', 1, 'How many planets are in our solar system?', '8', ['7', '9', '10'], 'Pluto was reclassified as a dwarf planet in 2006.'),
  g('gk-015', 'science', 1, 'What is H₂O better known as?', 'Water', ['Salt', 'Hydrogen gas', 'Oxygen'], 'Two hydrogen atoms + one oxygen atom = water.'),
  g('gk-016', 'science', 2, 'Which planet is known as the Red Planet?', 'Mars', ['Venus', 'Jupiter', 'Mercury'], 'Iron oxide (rust) on Mars makes it look red.'),
  g('gk-017', 'science', 2, 'What is the hardest natural material?', 'Diamond', ['Gold', 'Quartz', 'Iron'], 'Diamond is pure carbon in a very strong crystal lattice.'),
  g('gk-018', 'science', 2, 'Which organ pumps blood around the body?', 'Heart', ['Lungs', 'Liver', 'Kidneys'], 'The heart pumps blood through the circulatory system.'),
  g('gk-019', 'science', 3, 'What is the chemical symbol for gold?', 'Au', ['Ag', 'Gd', 'Go'], 'Au comes from the Latin “aurum”.'),
  g('gk-020', 'science', 3, 'Light from the Sun takes about how long to reach Earth?', '8 minutes', ['8 seconds', '1 hour', '1 day'], 'Sunlight travels ~150 million km in about 8 minutes 20 seconds.'),
  g('gk-021', 'science', 3, 'What part of the cell holds most of its DNA?', 'Nucleus', ['Ribosome', 'Cell wall', 'Vacuole'], 'In plant and animal cells, DNA is stored mainly in the nucleus.'),
  g('gk-022', 'science', 4, 'What is the most abundant gas in Earth’s atmosphere?', 'Nitrogen', ['Oxygen', 'Carbon dioxide', 'Argon'], 'Air is about 78% nitrogen and 21% oxygen.'),
  g('gk-023', 'science', 4, 'At sea level, water boils at what temperature in Fahrenheit?', '212 °F', ['100 °F', '180 °F', '232 °F'], '100 °C equals 212 °F.'),
  g('gk-024', 'science', 5, 'Which particle has no electric charge?', 'Neutron', ['Proton', 'Electron', 'Positron'], 'Neutrons are neutral; protons are +, electrons are −.'),
  g('gk-025', 'science', 5, 'What is the speed of light in a vacuum, roughly?', '300,000 km/s', ['30,000 km/s', '3,000 km/s', '3,000,000 km/s'], 'About 299,792 km per second.'),
  // history
  g('gk-026', 'history', 1, 'Who was the first person to walk on the Moon?', 'Neil Armstrong', ['Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'], 'Armstrong stepped onto the Moon in July 1969.'),
  g('gk-027', 'history', 2, 'The ancient pyramids of Giza were built in which country?', 'Egypt', ['Mexico', 'Peru', 'Sudan'], 'They stand near Cairo, Egypt.'),
  g('gk-028', 'history', 2, 'In which year did World War II end?', '1945', ['1918', '1939', '1950'], 'The war ended in 1945.'),
  g('gk-029', 'history', 3, 'Who was the first President of the United States?', 'George Washington', ['Abraham Lincoln', 'Thomas Jefferson', 'John Adams'], 'Washington served from 1789 to 1797.'),
  g('gk-030', 'history', 3, 'The Berlin Wall fell in which year?', '1989', ['1961', '1975', '1991'], 'It fell on 9 November 1989.'),
  g('gk-031', 'history', 4, 'Who led India’s non-violent independence movement?', 'Mahatma Gandhi', ['Jawaharlal Nehru', 'Subhas Chandra Bose', 'B. R. Ambedkar'], 'Gandhi championed non-violent resistance.'),
  g('gk-032', 'history', 4, 'Which empire built Machu Picchu?', 'Inca', ['Aztec', 'Maya', 'Olmec'], 'The Inca built it in the 15th century in Peru.'),
  g('gk-033', 'history', 5, 'The printing press with movable metal type was developed by…', 'Johannes Gutenberg', ['Leonardo da Vinci', 'Galileo Galilei', 'Isaac Newton'], 'Gutenberg developed it around 1440 in Germany.'),
  // culture
  g('gk-034', 'culture', 1, 'How many players does a football (soccer) team have on the field?', '11', ['9', '10', '12'], 'Eleven per side, including the goalkeeper.'),
  g('gk-035', 'culture', 2, 'Who painted the Mona Lisa?', 'Leonardo da Vinci', ['Michelangelo', 'Pablo Picasso', 'Vincent van Gogh'], 'Leonardo painted it in the early 1500s.'),
  g('gk-036', 'culture', 2, 'How often are the Summer Olympic Games normally held?', 'Every 4 years', ['Every 2 years', 'Every 3 years', 'Every 5 years'], 'The Summer Games are held every four years.'),
  g('gk-037', 'culture', 3, 'Who wrote “Romeo and Juliet”?', 'William Shakespeare', ['Charles Dickens', 'Jane Austen', 'Mark Twain'], 'Shakespeare wrote it in the 1590s.'),
  g('gk-038', 'culture', 3, 'Which instrument has 88 keys?', 'Piano', ['Organ', 'Accordion', 'Harp'], 'A standard piano has 52 white and 36 black keys.'),
  g('gk-039', 'culture', 4, 'Sushi comes from which country’s cuisine?', 'Japan', ['China', 'Korea', 'Thailand'], 'Sushi is a traditional Japanese dish.'),
  g('gk-040', 'culture', 5, 'In chess, which piece can only move diagonally?', 'Bishop', ['Rook', 'Knight', 'King'], 'Bishops stay on squares of one colour, moving diagonally.'),
];
