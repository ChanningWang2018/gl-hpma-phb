// Build-time global search index for the header overlay.
//
// Reads the committed data modules — cards (141), player-visible echoes (19)
// and quiz questions (1,847) — and writes public/search-index.json as one flat
// list of { id, name, aliases, type, url }. Rich-text markup is stripped and
// aliases that repeat (or are already contained in) the primary name are
// dropped: the client only fetches this file when the overlay first opens, so
// the gzip budget is deliberately tight (< 150 KB).
//
// Usage:
//   node scripts/build-search-index.mjs
//
// The npm predev / prebuild / prebuild:prerender hooks run it automatically,
// so `npm run dev`, `npm run build` and `npm run build:prerender` always ship
// an index that matches the data on disk. The output is gitignored.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

/** Structure version of public/search-index.json (bump on shape changes). */
export const SEARCH_INDEX_SCHEMA_VERSION = 1;

/** Default output path (public/ is copied verbatim by Vite into dist/). */
export const SEARCH_INDEX_FILE = join(REPO_ROOT, 'public', 'search-index.json');

/** Hard budget for the built index, measured with zlib's default gzip level. */
export const SEARCH_INDEX_GZIP_LIMIT = 150 * 1024;

/** Source modules, relative to the repository root. */
const SOURCE_PATHS = {
  cards: join('public', 'data', 'spellbook', 'cards.json'),
  echoes: join('public', 'data', 'echoes', 'echoes.json'),
  quiz: join('public', 'data', 'quiz', 'quiz.json'),
};

function readJson(root, relativePath) {
  const file = join(root, relativePath);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot read search-index source ${file}: ${error.message}`,
    );
  }
}

/**
 * Plain text of one game string. The quiz module wraps key terms in
 * <color=focus_light>…</color> (and, defensively, any other <…> tag); those
 * tags are removed without inserting a space, because the markup usually sits
 * inside a word in Chinese ("所使用的<color>教科书</color>"). Runs of
 * whitespace are collapsed so multi-line stems stay one-line.
 */
export function stripRichText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Aliases worth searching for `name`: cleaned, deduplicated case-insensitively,
 * and skipped when the primary name already matches them. Keeping only
 * distinct aliases keeps the index small; a substring of the name adds no
 * recall (the matcher also does substring/prefix hits on the name itself).
 */
function uniqueAliases(name, candidates) {
  const nameKey = name.toLowerCase();
  const seen = new Set([nameKey]);
  const aliases = [];
  for (const candidate of candidates) {
    const alias = stripRichText(candidate);
    const key = alias.toLowerCase();
    if (!alias || seen.has(key)) continue;
    if (nameKey.includes(key)) continue;
    seen.add(key);
    aliases.push(alias);
  }
  return aliases;
}

function assertSource(condition, message) {
  if (!condition)
    throw new Error(`search-index source is malformed: ${message}`);
}

function cardEntries(cardsDoc) {
  assertSource(
    Array.isArray(cardsDoc?.cards),
    'cards.json is missing its "cards" array',
  );
  return cardsDoc.cards.map((card) => {
    const english = stripRichText(card?.i18n?.en?.name);
    const chinese = stripRichText(card?.i18n?.zh?.name);
    const name = english || chinese || `Card ${card?.id}`;
    return {
      id: `card:${card.id}`,
      type: 'card',
      name,
      aliases: uniqueAliases(name, [chinese, card?.spell_word]),
      url: `/cards/${card.id}`,
    };
  });
}

function echoEntries(echoesDoc) {
  assertSource(
    Array.isArray(echoesDoc?.characters),
    'echoes.json is missing its "characters" array',
  );
  const deckCharacters = echoesDoc.characters.filter(
    (character) => character?.deck === true,
  );
  return deckCharacters.map((character) => {
    const english = stripRichText(character?.i18n?.en?.name);
    const chinese = stripRichText(character?.i18n?.zh?.name);
    const name =
      english || chinese || character?.key || `Echo ${character?.id}`;
    return {
      id: `echo:${character.id}`,
      type: 'echo',
      name,
      // "Echo of …" makes the category itself searchable ("echo"), while the
      // zh name covers Chinese queries and `key` the data-repo slug.
      aliases: uniqueAliases(name, [
        chinese,
        character?.key,
        english ? `Echo of ${english}` : '',
      ]),
      url: `/echoes/${character.id}`,
    };
  });
}

function questionEntries(quizDoc) {
  assertSource(
    quizDoc?.banks && typeof quizDoc.banks === 'object',
    'quiz.json is missing its "banks" object',
  );
  const entries = [];
  for (const [bankId, bank] of Object.entries(quizDoc.banks)) {
    assertSource(
      Array.isArray(bank?.questions),
      `quiz.json bank "${bankId}" is missing its "questions" array`,
    );
    for (const question of bank.questions) {
      const chinese = stripRichText(question?.question?.zh);
      const english = stripRichText(question?.question?.en);
      const name = chinese || english || `Question ${question?.id}`;
      entries.push({
        // Question ids only collide across banks, so the bank is part of the
        // stable entry id (same as the permalink URL below).
        id: `question:${bankId}:${question.id}`,
        type: 'question',
        name,
        aliases: uniqueAliases(name, [english, chinese]),
        url: `/quiz?bank=${encodeURIComponent(bankId)}&question=${question.id}`,
      });
    }
  }
  return entries;
}

function assertEntries(entries) {
  for (const entry of entries) {
    const ok =
      typeof entry.id === 'string' &&
      entry.id !== '' &&
      typeof entry.name === 'string' &&
      entry.name !== '' &&
      typeof entry.type === 'string' &&
      entry.type !== '' &&
      typeof entry.url === 'string' &&
      entry.url.startsWith('/');
    if (!ok) {
      throw new Error(
        `search-index entry is malformed: ${JSON.stringify(entry)}`,
      );
    }
  }
}

/**
 * Build the in-memory index from the committed data modules.
 *
 * @param {{ root?: string }} [options] repository root (tests may point at a
 *   fixture tree; defaults to this checkout).
 * @returns {{
 *   version: number,
 *   counts: { cards: number, echoes: number, questions: number, total: number },
 *   entries: Array<{ id: string, type: string, name: string,
 *     aliases: string[], url: string }>,
 * }}
 */
export function buildSearchIndex({ root = REPO_ROOT } = {}) {
  const cards = cardEntries(readJson(root, SOURCE_PATHS.cards));
  const echoes = echoEntries(readJson(root, SOURCE_PATHS.echoes));
  const questions = questionEntries(readJson(root, SOURCE_PATHS.quiz));
  const entries = [...cards, ...echoes, ...questions];
  assertEntries(entries);
  return {
    version: SEARCH_INDEX_SCHEMA_VERSION,
    counts: {
      cards: cards.length,
      echoes: echoes.length,
      questions: questions.length,
      total: entries.length,
    },
    entries,
  };
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function main() {
  const index = buildSearchIndex();
  const json = JSON.stringify(index);
  const gzipBytes = gzipSync(json).length;
  if (gzipBytes >= SEARCH_INDEX_GZIP_LIMIT) {
    throw new Error(
      `search-index.json is ${formatKb(gzipBytes)} gzipped — ` +
        `the budget is ${formatKb(SEARCH_INDEX_GZIP_LIMIT)}. Trim fields or ` +
        'drop aliases before adding more content.',
    );
  }
  writeFileSync(SEARCH_INDEX_FILE, json);
  const { counts } = index;
  console.log(
    `wrote ${SEARCH_INDEX_FILE} (${counts.cards} cards, ${counts.echoes} echoes, ` +
      `${counts.questions} questions; ${formatKb(Buffer.byteLength(json))} raw / ` +
      `${formatKb(gzipBytes)} gzip)`,
  );
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}
