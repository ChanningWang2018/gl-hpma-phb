// quizQuery.js — pure URL <-> state mapping for /quiz.
//
// The URL is the shareable projection of the quiz screen: the active tab, the
// bank-browser filters, the challenge setup draft and a direct question
// permalink. Sessions, answers and results are intentionally absent — they
// stay in the store only, so refreshing or copying a URL can never leak or
// revive an in-progress attempt.
//
// Every parser is total: unknown or malformed values collapse to the default
// state instead of filtering the page down to a blank result list. The view
// layers data-dependent checks (theme existence, question id resolution) on
// top of these helpers.
import { QuizService } from '@/services/quizService.js';

/** Rows per bank-browser page (shared with the question permalink jump). */
export const QUIZ_PAGE_SIZE = 50;

/** Values accepted by ?tab= (anything else falls back to 'bank'). */
export const QUIZ_TABS = ['bank', 'challenge'];

/** Bank-browser filter values: both banks plus the unfiltered 'all'. */
export const FILTER_BANKS = ['all', ...QuizService.BANK_IDS];

/** Challenge setup banks: both banks plus the pooled 'mixed' draw. */
export const CHALLENGE_BANKS = [...QuizService.BANK_IDS, 'mixed'];

/** Challenge draw styles: random pool or unseen-first review. */
export const CHALLENGE_DRAWS = ['random', 'review'];

/** Default bank-browser filters (mirrors quizStore's initial searchFilters). */
export const DEFAULT_FILTERS = Object.freeze({
  bank: 'all',
  theme: 'all',
  query: '',
});

/** Default challenge setup (mirrors quizStore's initial setupDraft). */
export const DEFAULT_CHALLENGE_SETUP = Object.freeze({
  bank: 'history_of_magic',
  draw: 'random',
  count: QuizService.CHALLENGE_COUNTS[0],
  mode: QuizService.MODES[0],
});

/**
 * First string of a vue-router query value. Vue Router yields string,
 * string[] or null; repeated params and garbage both degrade defensively.
 */
function firstString(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const found = value.find((item) => typeof item === 'string');
    return found ?? '';
  }
  return '';
}

/** Positive safe integer from a URL value, or null when malformed. */
function normalizePositiveInteger(value) {
  const raw = typeof value === 'number' ? String(value) : firstString(value);
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** ?tab= -> 'bank' | 'challenge'. */
function normalizeTab(value) {
  const tab = firstString(value).trim();
  return QUIZ_TABS.includes(tab) ? tab : 'bank';
}

/** ?bank= on the bank tab -> 'all' | a BANK_IDS entry. */
function normalizeFilterBank(value) {
  const bank = firstString(value).trim();
  return FILTER_BANKS.includes(bank) ? bank : 'all';
}

/** ?bank= on the challenge tab -> a BANK_IDS entry | 'mixed'. */
function normalizeChallengeBank(value) {
  const bank = firstString(value).trim();
  return CHALLENGE_BANKS.includes(bank) ? bank : DEFAULT_CHALLENGE_SETUP.bank;
}

/**
 * ?theme= -> 'all' | a theme present in the loaded data.
 *
 * `knownThemes` is the set of `question.theme` values from the quiz store. The
 * parser itself stays data-free; when the view passes the set, a stale/shared
 * theme that no longer exists in the data falls back to 'all' instead of
 * yielding zero rows.
 */
function normalizeTheme(value, knownThemes) {
  const theme = firstString(value).trim();
  if (!theme || theme === 'all') return 'all';
  if (knownThemes === null || knownThemes === undefined) return theme;
  const themes =
    knownThemes instanceof Set ? knownThemes : new Set(knownThemes ?? []);
  return themes.has(theme) ? theme : 'all';
}

/**
 * Challenge setup from the query. Missing and invalid fields both fall back to
 * the default setup; `count` is validated against the count list of the
 * selected draw style (random 10/25/50, review 25/50/100).
 */
function normalizeChallenge(source, tab = 'challenge') {
  const drawValue = firstString(source.draw).trim();
  const draw = CHALLENGE_DRAWS.includes(drawValue)
    ? drawValue
    : DEFAULT_CHALLENGE_SETUP.draw;
  const counts =
    draw === 'review'
      ? QuizService.REVIEW_COUNTS
      : QuizService.CHALLENGE_COUNTS;
  const countValue = normalizePositiveInteger(source.count);
  const count =
    countValue !== null && counts.includes(countValue) ? countValue : counts[0];
  const modeValue = firstString(source.mode).trim();
  return {
    // On the bank tab ?bank= is a browser filter; it must not leak into the
    // challenge setup block (each tab reads only its own keys).
    bank:
      tab === 'challenge'
        ? normalizeChallengeBank(source.bank)
        : DEFAULT_CHALLENGE_SETUP.bank,
    draw,
    count,
    mode: QuizService.MODES.includes(modeValue)
      ? modeValue
      : DEFAULT_CHALLENGE_SETUP.mode,
  };
}

/** Same validation for serializer input (the store should already be valid). */
function normalizeSerializedChallenge(challenge) {
  return normalizeChallenge(
    challenge && typeof challenge === 'object' ? challenge : {},
  );
}

/**
 * Parse a vue-router query into the quiz state shape.
 *
 * @param {object|null|undefined} query route.query (or anything query-like)
 * @param {{ knownThemes?: Set<string>|string[]|null }} [options]
 * @returns {{
 *   tab: 'bank'|'challenge',
 *   filters: { bank: string|null, theme: string, query: string },
 *   challenge: { bank: string, draw: string, count: number, mode: string },
 *   question: number|null,
 *   questionBank: string|null,
 * }}
 *   filters.bank is null on the challenge tab: ?bank= then belongs to the
 *   challenge setup and must not overwrite the bank-browser filter.
 *   questionBank is the ?bank= hint for a cross-bank question id.
 */
export function parseQuizQuery(query, { knownThemes = null } = {}) {
  const source =
    query && typeof query === 'object' && !Array.isArray(query) ? query : {};
  const tab = normalizeTab(source.tab);
  const rawBank = firstString(source.bank).trim();
  const question = normalizePositiveInteger(source.question);

  return {
    tab,
    filters:
      tab === 'bank'
        ? {
            bank: normalizeFilterBank(rawBank),
            theme: normalizeTheme(source.theme, knownThemes),
            query: firstString(source.q),
          }
        : { bank: null, theme: 'all', query: '' },
    challenge: normalizeChallenge(source, tab),
    question,
    // Only meaningful as a question-id hint; without ?question= the bank key
    // belongs to the active tab's own state, not to a permalink.
    questionBank:
      question !== null && FILTER_BANKS.includes(rawBank) && rawBank !== 'all'
        ? rawBank
        : null,
  };
}

/**
 * Serialize the quiz state into a vue-router query object.
 *
 * Bank tab: only non-default filters are written, so /quiz stays clean.
 * Challenge tab: the full setup is written (tab=challenge is what tells the
 * parser that ?bank= is a challenge bank, not a browser filter).
 * Question permalink: written alongside its owning bank (question ids are only
 * unique within a bank; 531 ids collide across the two banks) and implies the
 * bank tab.
 *
 * @param {{
 *   tab?: 'bank'|'challenge',
 *   filters?: { bank?: string, theme?: string, query?: string },
 *   challenge?: { bank?: string, draw?: string, count?: number, mode?: string },
 *   question?: { bank?: string, id?: number|string }|number|string|null,
 * }} [state]
 * @returns {Record<string, string>} query values (always strings)
 */
export function serializeQuizQuery({
  tab = 'bank',
  filters = DEFAULT_FILTERS,
  challenge = DEFAULT_CHALLENGE_SETUP,
  question = null,
} = {}) {
  const questionId = normalizePositiveInteger(
    question && typeof question === 'object' ? question.id : question,
  );
  const questionBank =
    question &&
    typeof question === 'object' &&
    FILTER_BANKS.includes(question.bank) &&
    question.bank !== 'all'
      ? question.bank
      : null;

  const filterSource =
    filters && typeof filters === 'object' ? filters : DEFAULT_FILTERS;
  const bank =
    questionBank ??
    (FILTER_BANKS.includes(filterSource.bank) ? filterSource.bank : 'all');
  const theme =
    typeof filterSource.theme === 'string' &&
    filterSource.theme !== '' &&
    filterSource.theme !== 'all'
      ? filterSource.theme
      : 'all';
  const searchQuery =
    typeof filterSource.query === 'string' ? filterSource.query.trim() : '';

  const query = {};

  if (questionId !== null) {
    if (bank !== 'all') query.bank = bank;
    if (theme !== 'all') query.theme = theme;
    if (searchQuery) query.q = searchQuery;
    query.question = String(questionId);
    return query;
  }

  if (tab === 'challenge') {
    const setup = normalizeSerializedChallenge(challenge);
    query.tab = 'challenge';
    query.bank = setup.bank;
    query.draw = setup.draw;
    query.count = String(setup.count);
    query.mode = setup.mode;
    return query;
  }

  if (bank !== 'all') query.bank = bank;
  if (theme !== 'all') query.theme = theme;
  if (searchQuery) query.q = searchQuery;
  return query;
}

/**
 * Structural query comparison (stringified values, order-independent).
 * Used to skip redundant router.replace calls.
 */
export function sameQuery(left, right) {
  const a = left && typeof left === 'object' ? left : {};
  const b = right && typeof right === 'object' ? right : {};
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      String(a[key]) === String(b[key]),
  );
}

/** Every theme present in the loaded banks (for validating ?theme=). */
export function collectThemes(banks) {
  const themes = new Set();
  for (const bankId of QuizService.BANK_IDS) {
    for (const row of banks?.[bankId] ?? []) {
      if (typeof row?.theme === 'string' && row.theme !== '') {
        themes.add(row.theme);
      }
    }
  }
  return themes;
}

/**
 * Resolve a question id against the loaded banks. Ids are only unique within
 * a bank (many collide across banks), so the ?bank= hint wins when it contains
 * the id; otherwise banks are scanned in BANK_IDS order for determinism.
 *
 * @returns {{ bank: string, id: number }|null}
 */
export function resolveQuestion(banks, questionId, bankHint = null) {
  const id = normalizePositiveInteger(questionId);
  if (id === null) return null;
  const hint =
    FILTER_BANKS.includes(bankHint) && bankHint !== 'all' ? bankHint : null;
  const order = hint
    ? [hint, ...QuizService.BANK_IDS.filter((bank) => bank !== hint)]
    : [...QuizService.BANK_IDS];
  for (const bank of order) {
    const rows = banks?.[bank];
    if (!Array.isArray(rows)) continue;
    if (rows.some((row) => Number(row?.id) === id)) return { bank, id };
  }
  return null;
}
