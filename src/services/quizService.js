// Quiz Service — static-class facade over the quizClient singleton plus the
// pure business rules of the /quiz page: bank search, challenge building,
// grading, O.W.L. grades, durations, share text and local best records.
// Pure logic is exposed as static methods so vitest can exercise it without
// loading data (and against the real committed data via configure()).
import {
  correctOption,
  createClient,
  sanitizeMarkup,
  shuffle,
  shuffledOptions,
} from '@/services/quizClient.js';
import { translate } from '@/services/quizLocale.js';

// Module-level singleton: one client per app. Tests re-point it via
// QuizService.configure() (the default data base /data/quiz/ only exists
// once the site is served; unit tests read public/data/quiz/).
let client = createClient();

/** Dictionary keys naming a challenge bank / mode in the UI locale. */
const BANK_LABEL_KEYS = {
  history_of_magic: 'bankHistory',
  muggle_studies: 'bankMuggle',
  mixed: 'bankMixed',
};
const MODE_LABEL_KEYS = {
  normal: 'modeNormal',
  prefect: 'modePrefect',
};

/** Plain text of one game string: sanitizeMarkup segments joined back. */
function plainText(text) {
  if (typeof text !== 'string' || text === '') return '';
  return sanitizeMarkup(text)
    .map((segment) => segment.text)
    .join('');
}

/**
 * Lowercased search haystack of one question row: zh/en question, all option
 * texts and the explanation, markup stripped (so inline color tags can never
 * match a query), joined with newlines to avoid cross-field false hits.
 */
function searchHaystack(row) {
  const texts = [
    row.question?.zh,
    row.question?.en,
    ...((Array.isArray(row.options) ? row.options : []) ?? []).flatMap(
      (option) => [option?.text?.zh, option?.text?.en],
    ),
    row.explanation?.zh,
    row.explanation?.en,
  ];
  return texts
    .map(plainText)
    .filter((text) => text !== '')
    .join('\n')
    .toLowerCase();
}

/** Own-property id check for the progress maps (seen/wrong). */
function hasId(map, id) {
  return !!map && Object.prototype.hasOwnProperty.call(map, id);
}

/** Fresh default per-bank progress: round 1, nothing seen, nothing wrong. */
function defaultBankProgress() {
  return { round: 1, seen: {}, wrong: {} };
}

/** Fresh empty progress document covering every bank (normalized zero state). */
function freshProgress() {
  const banks = {};
  for (const bankId of QuizService.BANK_IDS) {
    banks[bankId] = defaultBankProgress();
  }
  return { banks };
}

/** Whether `value` is a plain id map (non-null object, not an array). */
function isIdMap(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normalized copy of one stored bank entry: round forced to an integer >= 1
 * (junk/fractional/negative rounds fall back to 1), seen/wrong coerced to
 * plain objects. Only ever returns fresh containers — stored references are
 * never handed out.
 */
function normalizeBankProgress(value) {
  const source = isIdMap(value) ? value : {};
  const round =
    Number.isFinite(source.round) && source.round >= 1
      ? Math.floor(source.round)
      : 1;
  return {
    round,
    seen: isIdMap(source.seen) ? { ...source.seen } : {},
    wrong: isIdMap(source.wrong) ? { ...source.wrong } : {},
  };
}

/**
 * Deep-enough copy of a progress document: every BANK_IDS entry normalized
 * (missing banks defaulted), extra bank keys ignored. Pure — the input and
 * its nested maps are never mutated nor aliased.
 */
function cloneProgress(progress) {
  const next = freshProgress();
  const stored = isIdMap(progress?.banks) ? progress.banks : null;
  if (stored) {
    for (const bankId of QuizService.BANK_IDS) {
      if (stored[bankId] != null) {
        next.banks[bankId] = normalizeBankProgress(stored[bankId]);
      }
    }
  }
  return next;
}

/**
 * Question list of one bank from a banks map. Accepts the store shape
 * (`{ [bankId]: Question[] }`) and tolerates the raw client shape
 * (`{ [bankId]: { questions } }`); unknown banks yield an empty list.
 */
function bankQuestionList(banks, bankId) {
  const entry = banks?.[bankId];
  if (Array.isArray(entry)) return entry;
  return Array.isArray(entry?.questions) ? entry.questions : [];
}

/**
 * Draw pool for the given bank ids, in bank order then data order. Every row
 * stays in the pool — each question must stay coverable (the v2 bank carries
 * 73 stem groups, 6 of which disagree on the correct answer between variants,
 * so hiding such a stem in prefect mode would trap players who memorized the
 * other variant; dropping variants from the pool was the rejected
 * alternative, decided 2026-10-10). Rows are fresh objects
 * (`{ bank, ...question }`) enriched with `stemKey` (markup-stripped zh stem,
 * when non-empty) and `stemShared` (that stem occurs more than once in THIS
 * pool) — the raw client data is never touched. Shared by the random and
 * review draw paths.
 */
function poolRows(bankIds) {
  const rows = [];
  const stemCounts = new Map();
  for (const bankId of bankIds) {
    for (const question of client.bankQuestions(bankId)) {
      const row = { bank: bankId, ...question };
      const stemKey = plainText(question.question?.zh).trim();
      if (stemKey) {
        stemCounts.set(stemKey, (stemCounts.get(stemKey) ?? 0) + 1);
        row.stemKey = stemKey;
      }
      rows.push(row);
    }
  }
  // Resolve stemShared in a second pass, once every group is tallied.
  for (const row of rows) {
    row.stemShared = row.stemKey ? stemCounts.get(row.stemKey) > 1 : false;
  }
  return rows;
}

/**
 * Assemble challenge items from drawn rows: options shuffled into display
 * order via shuffledOptions() (the raw data parks the answer at options[0])
 * and the optional-question markers precomputed for badge rendering. `rows`
 * must already be in final presentation order — callers draw (shuffle + take
 * the first count) BEFORE assembling, so option shuffling only consumes rng
 * for the questions actually shown. Shared by the random and review paths.
 */
function toItems(rows, rng) {
  return rows.map(({ stemKey, stemShared, ...row }) => ({
    bank: row.bank,
    id: row.id,
    question: row.question,
    options: shuffledOptions(row, rng),
    explanation: row.explanation,
    markers: {
      adjudicated: row.answer_adjudicated != null,
      conflict: row.answer_conflict != null,
      ugc: row.theme === 'ugc',
      duplicate: Array.isArray(row.duplicate_of) && row.duplicate_of.length > 0,
      stemShared,
    },
  }));
}

export class QuizService {
  /** Bank ids usable for search filters and challenges (order = UI order). */
  static BANK_IDS = ['history_of_magic', 'muggle_studies'];

  /** Challenge length choices. */
  static CHALLENGE_COUNTS = [10, 25, 50];

  /** Challenge modes ('prefect' hides the question stem until answered). */
  static MODES = ['normal', 'prefect'];

  /** localStorage key holding the {bestKey -> record} map. */
  static BEST_STORAGE_KEY = 'hpma-quiz-bests';

  /** Review-mode (unseen-first) challenge length choices. */
  static REVIEW_COUNTS = [25, 50, 100];

  /** localStorage key holding the review progress document. */
  static PROGRESS_STORAGE_KEY = 'hpma-quiz-progress';

  /**
   * Replace the module singleton (intended for tests and alt data sources).
   * @param {{ dataBaseUrl?: string }} [options]
   */
  static configure(options) {
    client = createClient(options);
  }

  /** The shared client instance. */
  static get client() {
    return client;
  }

  /**
   * Load quiz/manifest/version.json once. Idempotent: repeated and concurrent
   * calls share one in-flight request (delegated to the client cache).
   */
  static async load() {
    return client.load();
  }

  /** version.json content ({ tag, dataVersion, sourceUrl, ... }). */
  static get versionInfo() {
    return client.versionInfo;
  }

  /** Raw manifest.json document. */
  static get manifest() {
    return client.manifest;
  }

  /**
   * Pure filter/search over question rows ({ bank, ...question }).
   *
   * @param {Array} allQuestions rows as produced by client.allQuestions().
   * @param {{
   *   bank?: string|'all',
   *   query?: string,
   * }} criteria
   *   query is matched case-insensitively against the zh AND en question,
   *   every option text and the explanation — markup stripped first, so a
   *   hit in any one of them keeps the row.
   * @returns {Array} new filtered array (input is never mutated).
   */
  static searchQuestions(allQuestions, { bank = 'all', query = '' } = {}) {
    const needle = String(query ?? '')
      .trim()
      .toLowerCase();
    return (allQuestions ?? []).filter((row) => {
      if (bank && bank !== 'all' && row.bank !== bank) return false;
      if (!needle) return true;
      return searchHaystack(row).includes(needle);
    });
  }

  /**
   * Build a challenge session.
   *
   * @param {{
   *   bank: string,       // a BANK_IDS entry or 'mixed' (both banks pooled)
   *   count: number,      // questions to draw; smaller pools yield fewer
   *   mode: string,       // 'normal' | 'prefect'
   *   dataVersion?: number|null, // stamped onto the session for best-record
   *                      // invalidation
   *   rng?: () => number, // injectable for deterministic tests
   * }} options
   * @returns {{ config: { bank, count, mode }, items: Array, dataVersion }}
   *   items are pre-shuffled in both dimensions: question order is a shuffle
   *   of the whole pool (first `count` taken) and each item's options are
   *   shuffledOptions() — the raw data parks the answer at options[0].
   *   Markers precompute the optional question flags for badge rendering.
   */
  static buildChallenge({
    bank,
    count,
    mode,
    dataVersion = null,
    rng = Math.random,
  } = {}) {
    const bankIds = bank === 'mixed' ? QuizService.BANK_IDS : [bank];
    // Same-stem variant detection over the WHOLE draw pool (every row stays
    // in the pool — each question must stay coverable) happens inside
    // poolRows(); items carry markers.stemShared so the prefect UI shows
    // those stems directly (decided 2026-10-10; the rejected alternative was
    // dropping variants from the pool).
    const items = toItems(
      shuffle(poolRows(bankIds), rng).slice(0, Math.max(0, count)),
      rng,
    );
    // config.count is the ACTUAL size (pools can be smaller than requested)
    // so best records always key on what was really played.
    return {
      config: { bank, count: items.length, mode },
      items,
      dataVersion: dataVersion ?? null,
    };
  }

  /**
   * Build a review challenge session — the unseen-first draw of the
   * full-review feature (docs/quiz-review.md).
   *
   * @param {{
   *   bank: string,     // a BANK_IDS entry or 'mixed' (both banks pooled)
   *   count: number,    // questions to draw; smaller pools yield fewer
   *   mode: string,     // 'normal' | 'prefect'
   *   progress: object|null, // readProgressRaw()/applyProgress() shape
   *   rng?: () => number, // injectable for deterministic tests
   * }} options
   * @returns {{ config: { bank, count, mode, draw: 'review' }, items, dataVersion }}
   *   Same session shape as buildChallenge. The pool is the selected banks'
   *   rows minus each bank's seen ids (mixed = the union of both unseen
   *   sets), shuffled, first `count` taken. Markers are assembled by the
   *   same toItems() path as random sessions, with stem groups tallied over
   *   the WHOLE bank pool — identical to a random draw (with empty progress
   *   and the same rng the two builders produce equal items). dataVersion
   *   stays null: review results never enter bests (second-run scores are
   *   not comparable with blind draws).
   */
  static buildReviewChallenge({
    bank,
    count,
    mode,
    progress,
    rng = Math.random,
  } = {}) {
    const bankIds = bank === 'mixed' ? QuizService.BANK_IDS : [bank];
    // Unseen set per selected bank: everything minus this round's seen ids.
    // After an eager rollover (applyProgress) seen is empty, so drawing from
    // the full pool is the natural post-rollover state — build never has to
    // roll anything itself.
    const seenSets = new Map();
    for (const bankId of bankIds) {
      const seen = progress?.banks?.[bankId]?.seen;
      seenSets.set(bankId, new Set(isIdMap(seen) ? Object.keys(seen) : []));
    }
    const rows = poolRows(bankIds).filter(
      (row) => !seenSets.get(row.bank).has(String(row.id)),
    );
    const items = toItems(shuffle(rows, rng).slice(0, Math.max(0, count)), rng);
    return {
      config: { bank, count: items.length, mode, draw: 'review' },
      items,
      dataVersion: null,
    };
  }

  /**
   * The correct option's `no` for a challenge item (or any question-like
   * object with `.options`). Null when no option is flagged — the exactly-one
   * invariant makes this a formality on well-formed data.
   */
  static answerKey(item) {
    return correctOption(item)?.no ?? null;
  }

  /**
   * Grade a finished session against the recorded answers.
   *
   * @param {{ config: object, items: Array }} session as built by
   *   buildChallenge (extra runtime fields like index/answers are ignored).
   * @param {Array<{ chosenNo: number|null, correct?: boolean, ms: number }>}
   *   answers — answers[index] corresponds to session.items[index]; null or
   *   missing entries count as wrong with 0 ms. Correctness is derived here
   *   by answerKey comparison (single source of truth).
   * @returns {{ config, correctCount, total, accuracy, totalMs, avgMs, owl,
   *   perQuestion }} accuracy is a percentage (0-100, raw float); owl is the
   *   O.W.L. grade object; perQuestion rows carry
   *   { item, chosenNo, correctNo, correct, ms } for the review list.
   */
  static gradeResult(session, answers) {
    const items = session?.items ?? [];
    let correctCount = 0;
    let totalMs = 0;
    const perQuestion = items.map((item, index) => {
      const answer = answers?.[index] ?? null;
      const correctNo = QuizService.answerKey(item);
      const correct = answer != null && answer.chosenNo === correctNo;
      const ms = answer?.ms ?? 0;
      if (correct) correctCount += 1;
      totalMs += ms;
      return {
        item,
        chosenNo: answer?.chosenNo ?? null,
        correctNo,
        correct,
        ms,
      };
    });
    const total = items.length;
    const accuracy = total > 0 ? (correctCount / total) * 100 : 0;
    return {
      config: session?.config ?? null,
      correctCount,
      total,
      accuracy,
      totalMs,
      avgMs: total > 0 ? totalMs / total : 0,
      owl: QuizService.owlGrade(accuracy),
      perQuestion,
    };
  }

  /**
   * O.W.L. grade for an accuracy percentage. Thresholds (>= bound):
   * O 95 / E 85 / A 75 / P 60 / D 40 / T below. `key` is the quizLocale
   * dictionary key naming the grade.
   */
  static owlGrade(accuracyPercent) {
    const accuracy = Number(accuracyPercent) || 0;
    if (accuracy >= 95) return { code: 'O', key: 'owlO' };
    if (accuracy >= 85) return { code: 'E', key: 'owlE' };
    if (accuracy >= 75) return { code: 'A', key: 'owlA' };
    if (accuracy >= 60) return { code: 'P', key: 'owlP' };
    if (accuracy >= 40) return { code: 'D', key: 'owlD' };
    return { code: 'T', key: 'owlT' };
  }

  /**
   * Duration in the locale's compact form: zh `3分21秒` / en `3m 21s`;
   * a zero minute part is omitted (`45秒` / `45s`). Seconds are truncated
   * (stopwatch semantics), never rounded.
   *
   * `decimals > 0` adds sub-second precision for result contexts — many
   * players answer within a second, so the report/share/best screens pass 2
   * (`16.83秒` / `16.83s`; minute split keeps integer minutes: `1分4.30秒`).
   * The live running timer stays at decimals 0.
   */
  static formatDuration(ms, locale = 'zh', decimals = 0) {
    const places = Math.max(0, Math.min(3, Math.floor(Number(decimals) || 0)));
    // Integer arithmetic throughout: truncating a float product (e.g.
    // floor(16.83 * 100)) drifts to 16.82 on binary-representable inputs, so
    // the sub-second cut works on whole milliseconds instead.
    const totalMs = Math.max(0, Math.round(Number(ms) || 0));
    const minutes = Math.floor(totalMs / 60000);
    const restMs = totalMs % 60000;
    const unitMs = 1000 / 10 ** places;
    const seconds = Math.floor(restMs / unitMs) / 10 ** places;
    const secondsText = seconds.toFixed(places);
    if (locale === 'en') {
      return minutes > 0 ? `${minutes}m ${secondsText}s` : `${secondsText}s`;
    }
    return minutes > 0 ? `${minutes}分${secondsText}秒` : `${secondsText}秒`;
  }

  /**
   * Multi-line share text from the quizLocale `shareText` template. Bank,
   * mode and the O.W.L. grade are named through the dictionary; the duration
   * goes through formatDuration; `url` is passed through verbatim (callers
   * pass location.origin at runtime).
   */
  static formatShareText({ result, url, locale = 'zh' }) {
    const config = result?.config ?? {};
    let mode = translate(locale, MODE_LABEL_KEYS[config.mode] ?? config.mode);
    // Review sessions append the draw label: a second-run score is a
    // different game from a blind draw, and the share text says so
    // (docs/quiz-review.md §2).
    if (config.draw === 'review') {
      mode = `${mode} · ${translate(locale, 'drawReview')}`;
    }
    return translate(locale, 'shareText', {
      bank: translate(locale, BANK_LABEL_KEYS[config.bank] ?? config.bank),
      count: config.count ?? 0,
      mode,
      grade: translate(locale, result?.owl?.key ?? ''),
      correct: result?.correctCount ?? 0,
      total: result?.total ?? 0,
      pct: Math.round(result?.accuracy ?? 0),
      // Share text advertises speed — sub-second precision included.
      time: QuizService.formatDuration(result?.totalMs ?? 0, locale, 2),
      url: url ?? '',
    });
  }

  /** Storage key for one config: '{bank}:{count}:{mode}'. */
  static bestKey(config) {
    return `${config?.bank ?? 'unknown'}:${config?.count ?? 0}:${config?.mode ?? 'unknown'}`;
  }

  /** Guarded read of the raw {bestKey -> record} map. Never throws. */
  static readBestsRaw() {
    try {
      if (typeof localStorage === 'undefined') return {};
      const raw = localStorage.getItem(QuizService.BEST_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      return parsed;
    } catch {
      // corrupted JSON or storage unavailable — degrade to "no records"
      return {};
    }
  }

  /** Guarded write of the raw map; silently no-ops when storage refuses. */
  static writeBestsRaw(map) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(QuizService.BEST_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // storage unavailable (privacy mode / quota) — records stay in-session
    }
  }

  /**
   * Best records valid for `dataVersion` only — entries stamped with any
   * other dataVersion are dropped (a quiz data update invalidates old bests).
   * Returns a fresh plain object; the stored map is never handed out.
   */
  static loadBests(dataVersion) {
    const bests = {};
    for (const [key, record] of Object.entries(QuizService.readBestsRaw())) {
      if (
        record &&
        typeof record === 'object' &&
        record.dataVersion === dataVersion
      ) {
        bests[key] = record;
      }
    }
    return bests;
  }

  /**
   * Maybe persist a new best for result.config.
   *
   * Better = higher accuracy; on an accuracy tie, lower totalMs. Records from
   * another dataVersion are treated as absent (the new result replaces them).
   *
   * @returns {{ improved: boolean, previous: object|null }}
   */
  static recordBest({ result, dataVersion }) {
    const raw = QuizService.readBestsRaw();
    const key = QuizService.bestKey(result?.config);
    const candidate = raw[key];
    const previous =
      candidate &&
      typeof candidate === 'object' &&
      candidate.dataVersion === dataVersion
        ? candidate
        : null;
    const record = {
      code: result?.owl?.code ?? null,
      key: result?.owl?.key ?? null,
      correctCount: result?.correctCount ?? 0,
      total: result?.total ?? 0,
      accuracy: result?.accuracy ?? 0,
      totalMs: result?.totalMs ?? 0,
      dataVersion,
    };
    const improved =
      previous == null ||
      record.accuracy > previous.accuracy ||
      (record.accuracy === previous.accuracy &&
        record.totalMs < previous.totalMs);
    if (improved) {
      raw[key] = record;
      QuizService.writeBestsRaw(raw);
    }
    return { improved, previous };
  }

  /** Drop every best record; silently no-ops when storage is unavailable. */
  static clearBests() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(QuizService.BEST_STORAGE_KEY);
    } catch {
      // storage unavailable — nothing to clear
    }
  }

  /* ---------------------------------------------------------------- */
  /* Review progress (hpma-quiz-progress) — docs/quiz-review.md §1/§2 */
  /* ---------------------------------------------------------------- */

  /**
   * Guarded read of the stored review progress, normalized: both banks
   * present (missing entries defaulted to round 1 with empty seen/wrong),
   * round clamped to an integer >= 1, seen/wrong coerced to plain objects.
   * Corrupted JSON or unavailable storage degrades to a fresh empty
   * progress. Never hands out references into storage.
   */
  static readProgressRaw() {
    try {
      if (typeof localStorage === 'undefined') return freshProgress();
      const raw = localStorage.getItem(QuizService.PROGRESS_STORAGE_KEY);
      if (!raw) return freshProgress();
      return cloneProgress(JSON.parse(raw));
    } catch {
      // corrupted JSON or storage unavailable — degrade to "no progress"
      return freshProgress();
    }
  }

  /** Guarded write of the progress document; silently no-ops when storage
   *  is unavailable (privacy mode / quota) or refuses the write. */
  static writeProgressRaw(progress) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(
        QuizService.PROGRESS_STORAGE_KEY,
        JSON.stringify(progress),
      );
    } catch {
      // storage unavailable — progress stays in-session only
    }
  }

  /**
   * Pure reconcile against the current data: drop seen/wrong ids that no
   * longer exist in `banks` (each bank independently), keep rounds, return a
   * new object — the input and its nested maps are never mutated. `banks`
   * takes the store shape `{ [bankId]: Question[] }` (the raw client shape
   * `{ [bankId]: { questions } }` is tolerated). Weekly data updates may
   * remove questions; coverage progress survives them (deliberately unlike
   * bests, which reset on a dataVersion change).
   */
  static reconcileProgress(progress, banks) {
    const next = cloneProgress(progress);
    for (const bankId of QuizService.BANK_IDS) {
      const ids = new Set(
        bankQuestionList(banks, bankId).map((question) => String(question.id)),
      );
      const bank = next.banks[bankId];
      for (const map of [bank.seen, bank.wrong]) {
        for (const key of Object.keys(map)) {
          if (!ids.has(key)) delete map[key];
        }
      }
    }
    return next;
  }

  /**
   * Per-bank coverage snapshot for the report screens:
   * `{ [bankId]: { round, seen, total, remaining, wrong } }` — seen/wrong
   * count only ids still present in the bank, total is the bank's question
   * count, remaining = total - seen. Pure; junk-free input handling matches
   * readProgressRaw's normalization.
   */
  static coverageStats(progress, banks) {
    const stats = {};
    for (const bankId of QuizService.BANK_IDS) {
      const { round, seen, wrong } = normalizeBankProgress(
        progress?.banks?.[bankId],
      );
      const ids = new Set(
        bankQuestionList(banks, bankId).map((question) => String(question.id)),
      );
      const seenCount = Object.keys(seen).filter((key) => ids.has(key)).length;
      stats[bankId] = {
        round,
        seen: seenCount,
        total: ids.size,
        remaining: Math.max(0, ids.size - seenCount),
        wrong: Object.keys(wrong).filter((key) => ids.has(key)).length,
      };
    }
    return stats;
  }

  /**
   * Fold one finished (or abandoned-with-answers) review session into the
   * progress — the write side of the unseen-first model.
   *
   * @param {object|null} progress current progress document
   * @param {{ items: Array }} session as built by buildReviewChallenge
   * @param {Array<{ chosenNo: number|null }>} answers — answers[index]
   *   corresponds to session.items[index]
   * @returns {{ progress: object, coveredNow: number, rolledBanks: string[] }}
   *   progress is a NEW object (purity: inputs are never mutated); only
   *   answers with `chosenNo != null` are recorded — seen gains the id,
   *   wrong gains it on a wrong pick (correctness recomputed via answerKey,
   *   a stale/forged `correct` flag is ignored) and loses it on a same-round
   *   correct answer; coveredNow counts the newly covered (previously
   *   unseen) ids. Eager per-bank rollover: any involved bank whose unseen
   *   set drained this session immediately moves to round+1 with seen/wrong
   *   cleared; banks that still hold unseen questions are untouched — which
   *   is why buildReviewChallenge never faces an exhausted state in
   *   persisted progress.
   */
  static applyProgress(progress, session, answers) {
    const next = cloneProgress(progress);
    const involved = new Set();
    let coveredNow = 0;
    (session?.items ?? []).forEach((item, index) => {
      const chosenNo = answers?.[index]?.chosenNo;
      if (chosenNo == null) return; // 未作答（null/缺位）不记
      const bankId = item?.bank;
      if (!hasId(next.banks, bankId)) return;
      const bank = next.banks[bankId];
      const key = String(item.id);
      if (!hasId(bank.seen, key)) coveredNow += 1;
      bank.seen[key] = 1;
      if (chosenNo === QuizService.answerKey(item)) {
        delete bank.wrong[key]; // 同轮重复答对则移出（防御性）
      } else {
        bank.wrong[key] = 1;
      }
      involved.add(bankId);
    });
    const rolledBanks = [];
    for (const bankId of QuizService.BANK_IDS) {
      if (!involved.has(bankId)) continue;
      const bank = next.banks[bankId];
      const questions = client.bankQuestions(bankId);
      const drained =
        questions.length > 0 &&
        questions.every((question) => hasId(bank.seen, String(question.id)));
      if (drained) {
        bank.round += 1;
        bank.seen = {};
        bank.wrong = {};
        rolledBanks.push(bankId);
      }
    }
    return { progress: next, coveredNow, rolledBanks };
  }

  /** Drop the stored review progress; silently no-ops when storage is
   *  unavailable. */
  static clearProgress() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(QuizService.PROGRESS_STORAGE_KEY);
    } catch {
      // storage unavailable — nothing to clear
    }
  }
}
