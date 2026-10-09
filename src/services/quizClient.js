/**
 * quizClient.js — zero-dependency ESM loader for the hpma-quizbank data
 * (schema_version 2, released as quiz-v2.<yyyymmdd>.0 tags).
 *
 * Same shape as spellbookClient.js on purpose: works in the browser and in
 * Node.js 18+ via the global `fetch`. In Node, a local data directory (e.g.
 * `public/data/quiz/`) is read straight from disk with node:fs, because
 * `fetch` cannot serve `file:` URLs; http(s) URLs always go through `fetch`,
 * which is what lets the unit tests read the real committed data with zero
 * mocks and keeps any CDN-hosted copy working unchanged.
 *
 * Data model (schema_version 2):
 *   quiz.json     = { schema_version, data_version, generated_at, banks }
 *                   banks = { history_of_magic: Bank, muggle_studies: Bank }
 *                   Bank  = { id, source_table, questions: Question[],
 *                             play_configs }  // play_configs is game-side
 *                             // matchmaking config — not consumed by this site
 *   manifest.json = extraction metadata; coverage.questions mirrors the bank
 *                   sizes, coverage.answer_conflicts lists adjudicated
 *                   "bank:questionId" entries
 *   version.json  = { tag, version, schemaVersion, dataVersion, sourceRepo,
 *                     sourceUrl, generatedAt }  // single source of truth for
 *                     // the /quiz version badge; generatedAt mirrors
 *                     // manifest.generated_at
 *   Question      = { id, theme, question: {zh, en}, options: Option[4],
 *                     explanation: {zh, en}, need_close_bilingual,
 *                     answer_conflict?, answer_adjudicated?, provider_name?,
 *                     duplicate_of? }
 *   Option        = { no, is_correct, text: {zh, en} }
 *
 * Consuming rules baked into the data (verified against the v2 release):
 *   - Every question has exactly 4 options and exactly one is_correct=true.
 *     Outside the single adjudicated question the correct option always sits
 *     at options[0] (the game client shuffles at runtime), so consumers MUST
 *     shuffle options via shuffledOptions() before display — is_correct is
 *     the only source of truth and follows the option object. Questions are
 *     shuffled too, never presented in file order.
 *   - Question id 101301103 carries answer_conflict/answer_adjudicated: the
 *     dataset's correct answer (option 2, AD 1473) deliberately differs from
 *     the in-game scoring (option 1 — an official data-entry mistake). No
 *     special-casing needed: correctness always reads is_correct.
 *   - Inline markup comes in exactly two flavors, <color=focus_light>…
 *     </color> and <color=warn_light>…</color>; sanitizeMarkup() turns them
 *     into plain-text segments with marks. Never render the raw strings as
 *     HTML.
 *
 * The data is Chinese-first: v2 ships 100% bilingual coverage, but
 * lookupText() still falls back to zh defensively.
 */

/** Schema version this loader understands. Bump only on structural changes. */
export const EXPECTED_SCHEMA_VERSION = 2;

/** Default data base for quiz/manifest/version.json on this site. */
export const DEFAULT_DATA_BASE_URL = '/data/quiz/';

/* ------------------------------------------------------------------ */
/* Pure helpers (named exports — use them directly if you like)        */
/* ------------------------------------------------------------------ */

/** Join a base URL (or path) and a relative path without double slashes. */
export function joinUrl(base, relative) {
  return `${String(base).replace(/\/+$/, '')}/${String(relative).replace(/^\/+/, '')}`;
}

/** Ensure a base URL/path ends with exactly one trailing slash. */
export function normalizeBaseUrl(base) {
  const trimmed = String(base).trim();
  return trimmed.replace(/\/+$/, '') + '/';
}

/**
 * Bilingual field value ({ zh, en }) for the requested locale.
 * Falls back to `fallbackLocale` (default zh, the data's primary language)
 * when the requested value is missing or empty; null when neither exists.
 */
export function lookupText(bilingual, locale, fallbackLocale = 'zh') {
  const requested = bilingual?.[locale];
  if (requested !== undefined && requested !== null && requested !== '') {
    return requested;
  }
  const fallback = bilingual?.[fallbackLocale];
  if (fallback !== undefined && fallback !== null && fallback !== '') {
    return fallback;
  }
  return null;
}

/**
 * The question's correct option object. The exactly-one-is_correct invariant
 * guarantees a hit on well-formed data; returns null defensively when the
 * options are missing or no option is flagged.
 */
export function correctOption(question) {
  if (!Array.isArray(question?.options)) return null;
  return question.options.find((option) => option.is_correct) ?? null;
}

/**
 * Fisher-Yates shuffle. Returns a NEW array (the input is never mutated);
 * `rng` is injectable for deterministic tests, defaulting to Math.random.
 */
export function shuffle(array, rng = Math.random) {
  const result = Array.from(array ?? []);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * The question's options in shuffled display order (new array, same option
 * object references — is_correct travels with its option). The source order
 * must never be shown: outside the adjudicated question the answer always
 * sits at options[0] in the raw data.
 */
export function shuffledOptions(question, rng = Math.random) {
  return shuffle(question?.options ?? [], rng);
}

/* ------------------------------------------------------------------ */
/* Inline markup sanitizing                                            */
/* ------------------------------------------------------------------ */

const MARKUP_FOCUS_OPEN = '<color=focus_light>';
const MARKUP_WARN_OPEN = '<color=warn_light>';
const MARKUP_CLOSE = '</color>';

/**
 * Parse a question/option/explanation string into render-safe segments:
 * `Array<{ text: string, mark: null | 'focus' | 'warn' }>`.
 *
 *   - <color=focus_light>…</color> -> segments marked 'focus'
 *   - <color=warn_light>…</color>  -> segments marked 'warn'
 *   - any other well-formed <…> tag is stripped (defensive; the v2 data
 *     ships none, but the game text chain could)
 *   - a bare '<' with no closing '>' stays literal text
 *   - a color span without its closer keeps marking the remaining text
 *
 * Joining the segment texts reproduces the input character-for-character,
 * minus the stripped tags. Never feed raw markup strings to innerHTML.
 */
export function sanitizeMarkup(text) {
  if (typeof text !== 'string' || text === '') return [];
  const segments = [];
  let mark = null;
  let runStart = 0;
  let cursor = 0;

  const flush = (end) => {
    if (end > runStart) {
      segments.push({ text: text.slice(runStart, end), mark });
    }
  };

  while (cursor < text.length) {
    const lt = text.indexOf('<', cursor);
    if (lt === -1) break; // no more markup candidates; flush the rest below
    const gt = text.indexOf('>', lt + 1);
    if (gt === -1) break; // bare '<': literal text to the end
    flush(lt);
    const tag = text.slice(lt, gt + 1);
    if (tag === MARKUP_FOCUS_OPEN) {
      mark = 'focus';
    } else if (tag === MARKUP_WARN_OPEN) {
      mark = 'warn';
    } else if (tag === MARKUP_CLOSE) {
      mark = null;
    }
    // Unknown tags are stripped: skipped without touching the mark.
    cursor = gt + 1;
    runStart = cursor;
  }
  flush(text.length);
  return segments;
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch + parse a JSON document.
 * - http(s)/data URLs: plain `fetch` (browser and Node).
 * - local paths / file: URLs (Node only): read via node:fs, because Node's
 *   fetch does not support the `file:` scheme. This branch is what lets the
 *   unit tests read the real committed data with zero mocks.
 */
async function loadJson(url) {
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  if (isNode && !/^(https?|data):/i.test(url)) {
    const { readFile } = await import('node:fs/promises');
    const { pathToFileURL, fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const filePath = url.startsWith('file:')
      ? fileURLToPath(url)
      : path.resolve(url);
    try {
      return JSON.parse(await readFile(filePath, 'utf8'));
    } catch (err) {
      throw new Error(`Cannot read data file "${filePath}" (${err.message})`);
    }
  }

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Network error while fetching ${url}: ${err.message}`);
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

/** Validate the quiz.json document and normalize the fields we expose. */
function prepareDoc(quizDoc, manifest, versionInfo) {
  if (
    !quizDoc ||
    typeof quizDoc !== 'object' ||
    !quizDoc.banks ||
    typeof quizDoc.banks !== 'object'
  ) {
    throw new Error(
      'quiz.json is malformed: expected an object with a top-level "banks" object.',
    );
  }

  const actual = quizDoc.schema_version;
  if (actual !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(
      `不支持的数据版本：quiz.json 的 schema_version 为 ${JSON.stringify(actual)}，` +
        `但当前加载器只支持 ${EXPECTED_SCHEMA_VERSION}。\n` +
        'schema_version 变更代表数据结构变化，需要先升级消费端代码（quizClient.js）' +
        '才能使用新数据；仅 data_version 变化只是内容更新，无需修改代码。',
    );
  }

  return {
    schemaVersion: quizDoc.schema_version,
    dataVersion: quizDoc.data_version,
    generatedAt: quizDoc.generated_at,
    banks: quizDoc.banks,
    manifest: manifest ?? null,
    versionInfo: versionInfo ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

/**
 * Create a data client.
 *
 *   const client = createClient();  // data base defaults to /data/quiz/
 *   await client.load();            // fetch quiz/manifest/version concurrently
 *   client.banks;                   // raw banks object from quiz.json
 *   client.bankQuestions('history_of_magic');
 *   client.questionCount('muggle_studies');
 *   client.allQuestions();          // [{ bank, ...question }] across both banks
 *   client.versionInfo;             // version.json content (badge source)
 *
 * @param {{ dataBaseUrl?: string }} [options]
 *   dataBaseUrl — base for quiz/manifest/version.json; defaults to
 *   `/data/quiz/`. http(s) URLs go through fetch, local paths are read from
 *   disk in Node.
 */
export function createClient(options = {}) {
  const dataBaseUrl = options.dataBaseUrl
    ? normalizeBaseUrl(options.dataBaseUrl)
    : DEFAULT_DATA_BASE_URL;
  /** @type {ReturnType<typeof prepareDoc> | null} */
  let loaded = null;
  /** @type {Promise<ReturnType<typeof prepareDoc>> | null} */
  let inFlight = null;

  async function load() {
    if (loaded) return snapshot();
    if (!inFlight) {
      // All three documents are independent — fetch them concurrently.
      inFlight = Promise.all([
        loadJson(joinUrl(dataBaseUrl, 'quiz.json')),
        loadJson(joinUrl(dataBaseUrl, 'manifest.json')),
        loadJson(joinUrl(dataBaseUrl, 'version.json')),
      ])
        .then(([quizDoc, manifest, versionInfo]) => {
          loaded = prepareDoc(quizDoc, manifest, versionInfo);
          return snapshot();
        })
        .finally(() => {
          inFlight = null; // allow a retry if loading failed
        });
    }
    return inFlight;
  }

  function snapshot() {
    const d = loaded;
    return {
      schemaVersion: d.schemaVersion,
      dataVersion: d.dataVersion,
      generatedAt: d.generatedAt,
      banks: d.banks,
      manifest: d.manifest,
      versionInfo: d.versionInfo,
    };
  }

  function requireLoaded() {
    if (!loaded) {
      throw new Error('No data loaded yet — call `await client.load()` first.');
    }
    return loaded;
  }

  function bankQuestions(bankId) {
    return requireLoaded().banks[bankId]?.questions ?? [];
  }

  function questionCount(bankId) {
    return bankQuestions(bankId).length;
  }

  /** Both banks concatenated as [{ bank, ...question }] rows. */
  function allQuestions() {
    const d = requireLoaded();
    const rows = [];
    for (const bank of Object.keys(d.banks)) {
      for (const question of d.banks[bank]?.questions ?? []) {
        rows.push({ bank, ...question });
      }
    }
    return rows;
  }

  return {
    /** Resolved data base URL every data file is joined against. */
    dataBaseUrl,

    /** Fetch (and cache) quiz.json + manifest.json + version.json. Idempotent. */
    load,

    /** Raw banks object from quiz.json. Throws unless load() has completed. */
    get banks() {
      return requireLoaded().banks;
    },

    /** Raw manifest.json document (null when unavailable). Throws before load(). */
    get manifest() {
      return requireLoaded().manifest;
    },

    /** version.json content ({ tag, dataVersion, sourceUrl, ... }). Throws before load(). */
    get versionInfo() {
      return requireLoaded().versionInfo;
    },

    /** Raw questions array of one bank (unknown bankId -> empty array). */
    bankQuestions,

    /** Number of questions in one bank (unknown bankId -> 0). */
    questionCount,

    /** Both banks concatenated as [{ bank, ...question }] rows. */
    allQuestions,
  };
}
