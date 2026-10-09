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

export class QuizService {
  /** Bank ids usable for search filters and challenges (order = UI order). */
  static BANK_IDS = ['history_of_magic', 'muggle_studies'];

  /** Challenge length choices. */
  static CHALLENGE_COUNTS = [10, 25, 50];

  /** Challenge modes ('prefect' hides the question stem until answered). */
  static MODES = ['normal', 'prefect'];

  /** localStorage key holding the {bestKey -> record} map. */
  static BEST_STORAGE_KEY = 'hpma-quiz-bests';

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
    // in the pool — each question must stay coverable): the v2 bank carries
    // 73 stem groups, 6 of which disagree on the correct answer between
    // variants, so hiding such a stem in prefect mode would trap players who
    // memorized the other variant. Items carry markers.stemShared so the
    // prefect UI shows those stems directly (decided 2026-10-10; the rejected
    // alternative was dropping variants from the pool).
    const rows = [];
    const stemCounts = new Map();
    for (const bankId of bankIds) {
      for (const question of client.bankQuestions(bankId)) {
        const row = { bank: bankId, ...question };
        const stemKey = plainText(question.question?.zh).trim();
        if (stemKey) {
          stemCounts.set(stemKey, (stemCounts.get(stemKey) ?? 0) + 1);
          rows.push({ ...row, stemKey });
        } else {
          rows.push(row);
        }
      }
    }
    const items = shuffle(rows, rng)
      .slice(0, Math.max(0, count))
      .map(({ stemKey, ...row }) => ({
        bank: row.bank,
        id: row.id,
        question: row.question,
        options: shuffledOptions(row, rng),
        explanation: row.explanation,
        markers: {
          adjudicated: row.answer_adjudicated != null,
          conflict: row.answer_conflict != null,
          ugc: row.theme === 'ugc',
          duplicate:
            Array.isArray(row.duplicate_of) && row.duplicate_of.length > 0,
          stemShared: stemKey ? stemCounts.get(stemKey) > 1 : false,
        },
      }));
    // config.count is the ACTUAL size (pools can be smaller than requested)
    // so best records always key on what was really played.
    return {
      config: { bank, count: items.length, mode },
      items,
      dataVersion: dataVersion ?? null,
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
    return translate(locale, 'shareText', {
      bank: translate(locale, BANK_LABEL_KEYS[config.bank] ?? config.bank),
      count: config.count ?? 0,
      mode: translate(locale, MODE_LABEL_KEYS[config.mode] ?? config.mode),
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
}
