// Tests for quizService.js — pure business rules (search, challenge building,
// grading, O.W.L. grades, durations, share text, best records) on synthetic
// fixtures AND the real committed quizbank data. localStorage is stubbed for
// the best-record suite (vitest runs in a plain node environment).
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { QuizService } from '../../src/services/quizService.js';

const REAL_DATA_BASE = 'public/data/quiz/';
const ADJUDICATED_ID = 101301103; // answer flipped to option 2 (AD 1473) in v2

// The default singleton points at /data/quiz/ (only valid once the site is
// served); tests read the committed files from the repo instead.
QuizService.configure({ dataBaseUrl: REAL_DATA_BASE });

// Deterministic LCG so shuffle-order assertions never flake.
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// In-memory localStorage double (getItem/setItem/removeItem over a Map).
function stubStorage() {
  const map = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  });
  return map;
}

// A question row shaped like client.allQuestions() entries.
function makeRow(overrides = {}) {
  return {
    bank: 'history_of_magic',
    id: 1,
    theme: 'theme1',
    question: { zh: '题干', en: 'Question' },
    options: [
      { no: 1, is_correct: true, text: { zh: '甲', en: 'Alpha' } },
      { no: 2, is_correct: false, text: { zh: '乙', en: 'Beta' } },
    ],
    explanation: { zh: '讲解', en: 'Explanation' },
    ...overrides,
  };
}

// A gradeResult()-shaped result for the best-record suite.
function makeResult(overrides = {}) {
  return {
    config: { bank: 'mixed', count: 10, mode: 'normal' },
    correctCount: 6,
    total: 10,
    accuracy: 60,
    totalMs: 100000,
    avgMs: 10000,
    owl: { code: 'P', key: 'owlP' },
    perQuestion: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('pinned constants', () => {
  it('exposes the bank/count/mode tables and the best-records storage key', () => {
    expect(QuizService.BANK_IDS).toEqual([
      'history_of_magic',
      'muggle_studies',
    ]);
    expect(QuizService.CHALLENGE_COUNTS).toEqual([10, 25, 50]);
    expect(QuizService.MODES).toEqual(['normal', 'prefect']);
    expect(QuizService.BEST_STORAGE_KEY).toBe('hpma-quiz-bests');
  });
});

describe('QuizService.searchQuestions (synthetic)', () => {
  const rows = [
    makeRow({
      id: 1,
      question: {
        zh: '哪条咒语可以<color=focus_light>点亮</color>天花板？',
        en: 'Which charm lights the ceiling?',
      },
      options: [
        {
          no: 1,
          is_correct: true,
          text: { zh: '荧光闪烁', en: 'Lumos Maxima' },
        },
        {
          no: 2,
          is_correct: false,
          text: { zh: '呼神护卫', en: 'Expecto Patronum' },
        },
      ],
      explanation: { zh: '魔咒课教过。', en: 'Taught in Charms class.' },
    }),
    makeRow({
      bank: 'muggle_studies',
      id: 2,
      question: {
        zh: '麻瓜用什么照明？',
        en: 'What do Muggles use for light?',
      },
      explanation: { zh: '电灯。', en: 'Electric lamps.' },
    }),
  ];

  it('matches zh and en across question, options and explanation', () => {
    // zh option text
    expect(
      QuizService.searchQuestions(rows, { query: '荧光闪烁' }).map((r) => r.id),
    ).toEqual([1]);
    // en option text, case-insensitive both ways
    expect(
      QuizService.searchQuestions(rows, { query: 'lumos' }).map((r) => r.id),
    ).toEqual([1]);
    expect(
      QuizService.searchQuestions(rows, { query: 'LUMOS' }).map((r) => r.id),
    ).toEqual([1]);
    // en explanation
    expect(
      QuizService.searchQuestions(rows, { query: 'charms' }).map((r) => r.id),
    ).toEqual([1]);
    // zh question stem
    expect(
      QuizService.searchQuestions(rows, { query: '麻瓜' }).map((r) => r.id),
    ).toEqual([2]);
    // en question stem
    expect(
      QuizService.searchQuestions(rows, { query: 'What do MUGGLES' }).map(
        (r) => r.id,
      ),
    ).toEqual([2]);
  });

  it('never matches inline markup: the haystack is the sanitized plain text', () => {
    // Row 1's raw zh stem contains <color=focus_light>…</color>.
    expect(QuizService.searchQuestions(rows, { query: 'color=focus' })).toEqual(
      [],
    );
    // But the highlighted WORD itself is searchable across the tag boundary.
    expect(
      QuizService.searchQuestions(rows, { query: '点亮' }).map((r) => r.id),
    ).toEqual([1]);
  });

  it('filters by bank conjunctively and treats all/absent/blank as no-ops', () => {
    expect(
      QuizService.searchQuestions(rows, {
        bank: 'muggle_studies',
        query: 'lumos',
      }),
    ).toEqual([]);
    expect(
      QuizService.searchQuestions(rows, {
        bank: 'history_of_magic',
        query: '麻瓜',
      }),
    ).toEqual([]);
    const everything = QuizService.searchQuestions(rows, {
      bank: 'all',
      query: '   ',
    });
    expect(everything).toHaveLength(2);
    expect(everything).not.toBe(rows); // new array, input untouched
    expect(QuizService.searchQuestions(rows, {})).toHaveLength(2);
    expect(QuizService.searchQuestions(null, {})).toEqual([]);
  });
});

describe('QuizService.owlGrade', () => {
  it('maps the O.W.L. thresholds 95/85/75/60/40 to code + dictionary key', () => {
    expect(QuizService.owlGrade(100)).toEqual({ code: 'O', key: 'owlO' });
    expect(QuizService.owlGrade(95)).toEqual({ code: 'O', key: 'owlO' });
    expect(QuizService.owlGrade(94.9)).toEqual({ code: 'E', key: 'owlE' });
    expect(QuizService.owlGrade(85)).toEqual({ code: 'E', key: 'owlE' });
    expect(QuizService.owlGrade(84.9)).toEqual({ code: 'A', key: 'owlA' });
    expect(QuizService.owlGrade(75)).toEqual({ code: 'A', key: 'owlA' });
    expect(QuizService.owlGrade(74.9)).toEqual({ code: 'P', key: 'owlP' });
    expect(QuizService.owlGrade(60)).toEqual({ code: 'P', key: 'owlP' });
    expect(QuizService.owlGrade(59.9)).toEqual({ code: 'D', key: 'owlD' });
    expect(QuizService.owlGrade(40)).toEqual({ code: 'D', key: 'owlD' });
    expect(QuizService.owlGrade(39.9)).toEqual({ code: 'T', key: 'owlT' });
    expect(QuizService.owlGrade(0)).toEqual({ code: 'T', key: 'owlT' });
  });
});

describe('QuizService.gradeResult', () => {
  // correctNo sequence: 1, 3, 2, 4
  const session = {
    config: { bank: 'mixed', count: 4, mode: 'normal' },
    items: [
      {
        id: 1,
        options: [
          { no: 1, is_correct: true },
          { no: 2, is_correct: false },
        ],
      },
      {
        id: 2,
        options: [
          { no: 1, is_correct: false },
          { no: 3, is_correct: true },
        ],
      },
      {
        id: 3,
        options: [
          { no: 2, is_correct: true },
          { no: 1, is_correct: false },
        ],
      },
      {
        id: 4,
        options: [
          { no: 4, is_correct: true },
          { no: 1, is_correct: false },
        ],
      },
    ],
  };

  it('grades via answerKey, sums ms and derives accuracy + owl', () => {
    const answers = [
      { chosenNo: 1, ms: 1000 }, // correct
      { chosenNo: 1, ms: 2000 }, // wrong
      { chosenNo: 2, ms: 3000 }, // correct
      null, // skipped: counts wrong with 0 ms
    ];
    const result = QuizService.gradeResult(session, answers);
    expect(result.config).toEqual(session.config);
    expect(result.correctCount).toBe(2);
    expect(result.total).toBe(4);
    expect(result.accuracy).toBe(50);
    expect(result.totalMs).toBe(6000);
    expect(result.avgMs).toBe(1500);
    expect(result.owl).toEqual({ code: 'D', key: 'owlD' });
    expect(result.perQuestion).toEqual([
      {
        item: session.items[0],
        chosenNo: 1,
        correctNo: 1,
        correct: true,
        ms: 1000,
      },
      {
        item: session.items[1],
        chosenNo: 1,
        correctNo: 3,
        correct: false,
        ms: 2000,
      },
      {
        item: session.items[2],
        chosenNo: 2,
        correctNo: 2,
        correct: true,
        ms: 3000,
      },
      {
        item: session.items[3],
        chosenNo: null,
        correctNo: 4,
        correct: false,
        ms: 0,
      },
    ]);
  });

  it('recomputes correctness itself — a stale correct flag cannot fake a point', () => {
    const result = QuizService.gradeResult(session, [
      { chosenNo: 2, correct: true, ms: 100 }, // wrong pick, forged flag
    ]);
    expect(result.perQuestion[0].correct).toBe(false);
    expect(result.correctCount).toBe(0);
    expect(result.accuracy).toBe(0);
    expect(result.owl).toEqual({ code: 'T', key: 'owlT' });
  });

  it('treats missing answers as a blank paper and empty sessions as 0/0', () => {
    const blank = QuizService.gradeResult(session, undefined);
    expect(blank.correctCount).toBe(0);
    expect(blank.accuracy).toBe(0);
    const empty = QuizService.gradeResult({ config: null, items: [] }, []);
    expect(empty.total).toBe(0);
    expect(empty.accuracy).toBe(0);
    expect(empty.avgMs).toBe(0);
    expect(empty.owl).toEqual({ code: 'T', key: 'owlT' });
  });
});

describe('QuizService.answerKey', () => {
  it('returns the flagged option no, null when nothing is flagged', () => {
    expect(
      QuizService.answerKey({
        options: [{ no: 2, is_correct: true }, { no: 1 }],
      }),
    ).toBe(2);
    expect(
      QuizService.answerKey({ options: [{ no: 1, is_correct: false }] }),
    ).toBe(null);
    expect(QuizService.answerKey({})).toBe(null);
    expect(QuizService.answerKey(null)).toBe(null);
  });
});

describe('QuizService.formatDuration', () => {
  it('formats zh with an omitted zero-minute part', () => {
    expect(QuizService.formatDuration(0, 'zh')).toBe('0秒');
    expect(QuizService.formatDuration(999, 'zh')).toBe('0秒');
    expect(QuizService.formatDuration(45000, 'zh')).toBe('45秒');
    expect(QuizService.formatDuration(201000, 'zh')).toBe('3分21秒');
    expect(QuizService.formatDuration(180000, 'zh')).toBe('3分0秒');
    expect(QuizService.formatDuration(650000, 'zh')).toBe('10分50秒');
  });

  it('formats en symmetrically', () => {
    expect(QuizService.formatDuration(0, 'en')).toBe('0s');
    expect(QuizService.formatDuration(45000, 'en')).toBe('45s');
    expect(QuizService.formatDuration(201000, 'en')).toBe('3m 21s');
    expect(QuizService.formatDuration(180000, 'en')).toBe('3m 0s');
    expect(QuizService.formatDuration(650000, 'en')).toBe('10m 50s');
  });

  it('defaults to zh and tolerates junk input', () => {
    expect(QuizService.formatDuration(45000)).toBe('45秒');
    expect(QuizService.formatDuration(undefined, 'zh')).toBe('0秒');
    expect(QuizService.formatDuration(-5, 'en')).toBe('0s');
  });

  it('adds sub-second precision with decimals (truncated, never rounded)', () => {
    // Fast-player regime: sub-second totals keep two decimals.
    expect(QuizService.formatDuration(16830, 'zh', 2)).toBe('16.83秒');
    expect(QuizService.formatDuration(16830, 'en', 2)).toBe('16.83s');
    expect(QuizService.formatDuration(943, 'zh', 2)).toBe('0.94秒');
    // Truncation, not rounding: 999ms -> 0.99, not 1.00.
    expect(QuizService.formatDuration(999, 'zh', 2)).toBe('0.99秒');
    expect(QuizService.formatDuration(999, 'zh')).toBe('0秒');
    // Minute split stays integral; decimals land on the seconds part only.
    expect(QuizService.formatDuration(201000, 'zh', 2)).toBe('3分21.00秒');
    expect(QuizService.formatDuration(64300, 'en', 2)).toBe('1m 4.30s');
    // 0 decimals keeps the legacy floored-integer behaviour byte for byte.
    expect(QuizService.formatDuration(201999, 'zh', 0)).toBe('3分21秒');
  });
});

describe('QuizService.formatShareText', () => {
  // 2/2 correct in 3m21s -> O grade; prefect mode on History of Magic.
  const session = {
    config: { bank: 'history_of_magic', count: 2, mode: 'prefect' },
    items: [
      { id: 1, options: [{ no: 1, is_correct: true }] },
      { id: 2, options: [{ no: 2, is_correct: true }] },
    ],
  };
  const result = QuizService.gradeResult(session, [
    { chosenNo: 1, ms: 100500 },
    { chosenNo: 2, ms: 100500 },
  ]);
  const url = 'https://example.com/quiz';

  it('renders the zh four-line report through the dictionary', () => {
    expect(
      QuizService.formatShareText({ result, url, locale: 'zh' }).split('\n'),
    ).toEqual([
      '【HPMA 魔法测验】魔法史 · 2 题 · 级长模式',
      'O.W.L. 评级：O · 杰出',
      '正确 2/2（100%）· 用时 3分21.00秒',
      '你也来试试 → https://example.com/quiz',
    ]);
  });

  it('renders the en four-line report and defaults to zh', () => {
    expect(
      QuizService.formatShareText({ result, url, locale: 'en' }).split('\n'),
    ).toEqual([
      'HPMA Quiz — History of Magic · 2 questions · Prefect mode',
      'O.W.L. grade: O · Outstanding',
      '2/2 correct (100%) · Time 3m 21.00s',
      'Give it a try → https://example.com/quiz',
    ]);
    expect(QuizService.formatShareText({ result, url })).toContain(
      '你也来试试',
    );
  });

  it('rounds the displayed percentage while the grade uses the raw accuracy', () => {
    // 7/8 = 87.5% raw -> E grade (>=85), displayed rounded up as 88%.
    const session8 = {
      config: { bank: 'mixed', count: 8, mode: 'normal' },
      items: Array.from({ length: 8 }, (_, index) => ({
        id: index,
        options: [
          { no: 1, is_correct: index % 2 === 0 },
          { no: 2, is_correct: index % 2 !== 0 },
        ],
      })),
    };
    const answers = session8.items.map((item, index) => ({
      chosenNo: index < 7 ? (index % 2 === 0 ? 1 : 2) : 0,
      ms: 100,
    }));
    const result = QuizService.gradeResult(session8, answers);
    expect(result.accuracy).toBeCloseTo(87.5, 10);
    expect(result.owl.code).toBe('E');
    const text = QuizService.formatShareText({ result, url, locale: 'zh' });
    expect(text).toContain('正确 7/8（88%）');
  });

  it('fills the template for a degenerate 0-question result', () => {
    const empty = QuizService.gradeResult(
      { config: { bank: 'mixed', count: 0, mode: 'normal' }, items: [] },
      [],
    );
    const text = QuizService.formatShareText({
      result: empty,
      url,
      locale: 'zh',
    });
    expect(text).toContain('混合双科 · 0 题 · 普通模式');
    expect(text).toContain('T · 巨怪');
    expect(text).toContain(url);
  });

  it('appends the review draw label to the mode only for review sessions', () => {
    const review = {
      ...result,
      config: {
        bank: 'history_of_magic',
        count: 2,
        mode: 'prefect',
        draw: 'review',
      },
    };
    expect(
      QuizService.formatShareText({ result: review, url, locale: 'zh' }).split(
        '\n',
      )[0],
    ).toBe('【HPMA 魔法测验】魔法史 · 2 题 · 级长模式 · 全量复习');
    expect(
      QuizService.formatShareText({ result: review, url, locale: 'en' }).split(
        '\n',
      )[0],
    ).toBe(
      'HPMA Quiz — History of Magic · 2 questions · Prefect mode · Full review',
    );
    // Random sessions (no draw field) keep the bare mode name.
    expect(
      QuizService.formatShareText({ result, url, locale: 'zh' }).split('\n')[0],
    ).toBe('【HPMA 魔法测验】魔法史 · 2 题 · 级长模式');
  });
});

describe('QuizService best records (stubbed localStorage)', () => {
  it('bestKey composes bank:count:mode', () => {
    expect(
      QuizService.bestKey({ bank: 'mixed', count: 10, mode: 'normal' }),
    ).toBe('mixed:10:normal');
    expect(
      QuizService.bestKey({
        bank: 'history_of_magic',
        count: 25,
        mode: 'prefect',
      }),
    ).toBe('history_of_magic:25:prefect');
  });

  it('records the first result as an improved best with no previous', () => {
    const map = stubStorage();
    const outcome = QuizService.recordBest({
      result: makeResult(),
      dataVersion: 20261009,
    });
    expect(outcome).toEqual({ improved: true, previous: null });
    const stored = JSON.parse(map.get(QuizService.BEST_STORAGE_KEY));
    expect(stored['mixed:10:normal']).toMatchObject({
      code: 'P',
      key: 'owlP',
      correctCount: 6,
      total: 10,
      accuracy: 60,
      totalMs: 100000,
      dataVersion: 20261009,
    });
  });

  it('improves on higher accuracy and breaks accuracy ties by lower totalMs', () => {
    stubStorage();
    const first = makeResult();
    QuizService.recordBest({ result: first, dataVersion: 20261009 });
    // Higher accuracy wins even when much slower.
    const higher = QuizService.recordBest({
      result: makeResult({
        accuracy: 70,
        correctCount: 7,
        owl: { code: 'D', key: 'owlD' },
        totalMs: 900000,
      }),
      dataVersion: 20261009,
    });
    expect(higher.improved).toBe(true);
    expect(higher.previous.accuracy).toBe(60);
    // Same accuracy, faster run wins.
    const faster = QuizService.recordBest({
      result: makeResult({ accuracy: 70, totalMs: 90000 }),
      dataVersion: 20261009,
    });
    expect(faster.improved).toBe(true);
    expect(faster.previous.totalMs).toBe(900000);
    // Same accuracy, slower/equal run does not.
    expect(
      QuizService.recordBest({
        result: makeResult({ accuracy: 70, totalMs: 900000 }),
        dataVersion: 20261009,
      }).improved,
    ).toBe(false);
    expect(
      QuizService.recordBest({
        result: makeResult({ accuracy: 70, totalMs: 90000 }),
        dataVersion: 20261009,
      }).improved,
    ).toBe(false);
    // Lower accuracy never wins, however fast.
    expect(
      QuizService.recordBest({
        result: makeResult({ accuracy: 69.9, totalMs: 1 }),
        dataVersion: 20261009,
      }).improved,
    ).toBe(false);
  });

  it('loadBests keeps only the current dataVersion; recordBest replaces stale entries', () => {
    const map = stubStorage();
    QuizService.recordBest({ result: makeResult(), dataVersion: 20261009 });
    expect(Object.keys(QuizService.loadBests(20261009))).toEqual([
      'mixed:10:normal',
    ]);
    expect(QuizService.loadBests(20261010)).toEqual({});
    // A new season's first run counts as a fresh record (stale entry ignored).
    const outcome = QuizService.recordBest({
      result: makeResult({ accuracy: 10 }),
      dataVersion: 20261010,
    });
    expect(outcome.improved).toBe(true);
    expect(outcome.previous).toBe(null);
    expect(QuizService.loadBests(20261009)).toEqual({});
    expect(QuizService.loadBests(20261010)['mixed:10:normal'].accuracy).toBe(
      10,
    );
    // The stale record never even lingers in storage.
    const stored = JSON.parse(map.get(QuizService.BEST_STORAGE_KEY));
    expect(Object.keys(stored)).toEqual(['mixed:10:normal']);
  });

  it('degrades corrupted JSON to an empty book and starts over', () => {
    const map = stubStorage();
    map.set(QuizService.BEST_STORAGE_KEY, 'not-json{');
    expect(QuizService.loadBests(20261009)).toEqual({});
    const outcome = QuizService.recordBest({
      result: makeResult(),
      dataVersion: 20261009,
    });
    expect(outcome).toEqual({ improved: true, previous: null });
    // A JSON array is equally rejected.
    map.set(QuizService.BEST_STORAGE_KEY, '[1,2]');
    expect(QuizService.loadBests(20261009)).toEqual({});
  });

  it('clearBests empties storage and loadBests reflects it', () => {
    stubStorage();
    QuizService.recordBest({ result: makeResult(), dataVersion: 20261009 });
    QuizService.clearBests();
    expect(QuizService.loadBests(20261009)).toEqual({});
  });

  it('guards every path when storage is unavailable or refusing writes', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(QuizService.loadBests(20261009)).toEqual({});
    expect(() =>
      QuizService.recordBest({ result: makeResult(), dataVersion: 20261009 }),
    ).not.toThrow();
    expect(() => QuizService.clearBests()).not.toThrow();
    // Privacy mode: reads work, writes throw — recordBest still reports win.
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    });
    const outcome = QuizService.recordBest({
      result: makeResult(),
      dataVersion: 20261009,
    });
    expect(outcome.improved).toBe(true);
  });
});

describe('QuizService facade over the real committed data', () => {
  let snapshot;

  beforeAll(async () => {
    snapshot = await QuizService.load();
  });

  it('load() is idempotent and versionInfo mirrors the committed version.json', async () => {
    const again = await QuizService.load();
    expect(again.banks).toBe(snapshot.banks);
    expect(QuizService.client.dataBaseUrl).toBe(REAL_DATA_BASE);
    const committedVersion = JSON.parse(
      readFileSync('public/data/quiz/version.json', 'utf8'),
    );
    expect(QuizService.versionInfo).toEqual(committedVersion);
    expect(typeof QuizService.manifest).toBe('object');
  });

  it('searches the real data across zh/en with markup stripped', () => {
    const rows = QuizService.client.allQuestions();
    // The adjudicated Quidditch question, via its zh option and en option.
    const by1473 = QuizService.searchQuestions(rows, { query: '1473' });
    expect(
      by1473.some(
        (row) => row.bank === 'history_of_magic' && row.id === ADJUDICATED_ID,
      ),
    ).toBe(true);
    expect(
      QuizService.searchQuestions(rows, { query: 'ad 1473' }).map(
        (row) => row.id,
      ),
    ).toEqual([ADJUDICATED_ID]);
    // Two-way mirror question (history 611 carries an unclosed focus span).
    expect(
      QuizService.searchQuestions(rows, { query: '双面镜' }).some(
        (row) => row.bank === 'history_of_magic' && row.id === 611,
      ),
    ).toBe(true);
    // Markup never leaks into the haystack: the raw data would match 500+
    // rows on this needle, the sanitized search matches none.
    expect(QuizService.searchQuestions(rows, { query: 'color=focus' })).toEqual(
      [],
    );
    // en query pinned to one real Muggle Studies question.
    const leap = QuizService.searchQuestions(rows, { query: '366 days' });
    expect(leap).toHaveLength(1);
    expect(leap[0].bank).toBe('muggle_studies');
  });

  it('buildChallenge("mixed", 50) draws a shuffled, bank-spanning, duplicate-free 50', () => {
    const session = QuizService.buildChallenge({
      bank: 'mixed',
      count: 50,
      mode: 'normal',
      dataVersion: QuizService.versionInfo.dataVersion,
      rng: makeRng(20261009),
    });
    expect(session.config).toEqual({
      bank: 'mixed',
      count: 50,
      mode: 'normal',
    });
    expect(session.dataVersion).toBe(QuizService.versionInfo.dataVersion);
    expect(session.items).toHaveLength(50);
    // Distinct questions only.
    expect(
      new Set(session.items.map((item) => `${item.bank}:${item.id}`)).size,
    ).toBe(50);
    // Deterministic seed draws from both banks (fixed rng: no flake room).
    expect(new Set(session.items.map((item) => item.bank)).size).toBe(2);
    // Same seed, same session.
    const replay = QuizService.buildChallenge({
      bank: 'mixed',
      count: 50,
      mode: 'normal',
      rng: makeRng(20261009),
    });
    expect(replay.items.map((item) => item.id)).toEqual(
      session.items.map((item) => item.id),
    );
    // Single-bank draws stay in-bank.
    const muggle = QuizService.buildChallenge({
      bank: 'muggle_studies',
      count: 10,
      mode: 'prefect',
      rng: makeRng(7),
    });
    expect(muggle.items.every((item) => item.bank === 'muggle_studies')).toBe(
      true,
    );
    // A pool smaller than the requested count yields the whole pool — every
    // row stays coverable (no dedup: duplicate-stem questions are instead
    // flagged so the prefect UI can reveal their stems).
    const fullDraw = QuizService.buildChallenge({
      bank: 'mixed',
      count: 99999,
      mode: 'normal',
      rng: makeRng(4),
    });
    expect(fullDraw.items).toHaveLength(1847);
    // Both variants of the known duplicate pair 33/502 ("传闻中的救世之星")
    // are drawn — note ids are bank-qualified, both banks reuse small ids.
    const histIds = new Set(
      fullDraw.items
        .filter((item) => item.bank === 'history_of_magic')
        .map((item) => item.id),
    );
    expect(histIds.has(33)).toBe(true);
    expect(histIds.has(502)).toBe(true);
    const q33 = fullDraw.items.find(
      (item) => item.bank === 'history_of_magic' && item.id === 33,
    );
    expect(q33.markers.stemShared).toBe(true);
    // The stemShared population is derived from the data itself (markup-
    // stripped zh stems appearing more than once across the pool).
    const plain = (text) => text.replace(/<[^>]+>/g, '').trim();
    const allRows = QuizService.client.allQuestions();
    const stemTally = new Map();
    for (const row of allRows) {
      const key = plain(row.question.zh);
      if (key) stemTally.set(key, (stemTally.get(key) ?? 0) + 1);
    }
    const expectedShared = allRows.filter((row) => {
      const key = plain(row.question.zh);
      return key && stemTally.get(key) > 1;
    }).length;
    expect(expectedShared).toBeGreaterThan(0);
    expect(
      fullDraw.items.filter((item) => item.markers.stemShared),
    ).toHaveLength(expectedShared);
    expect(
      QuizService.buildChallenge({
        bank: 'history_of_magic',
        count: 0,
        mode: 'normal',
      }).items,
    ).toEqual([]);
  });

  it('shuffles every drawn question with the injected rng (never source order)', () => {
    // rng() = 0.5 forces [a,b,c,d] -> [a,d,b,c] for 4 options: always a
    // different order, same multiset, is_correct travelling with its option.
    const session = QuizService.buildChallenge({
      bank: 'muggle_studies', // no adjudicated question: correct is at source [0]
      count: 5,
      mode: 'normal',
      rng: () => 0.5,
    });
    expect(session.items).toHaveLength(5);
    for (const item of session.items) {
      const source = QuizService.client
        .bankQuestions('muggle_studies')
        .find((question) => question.id === item.id);
      expect(item.options.map((option) => option.no)).not.toEqual(
        source.options.map((option) => option.no),
      );
      expect([...item.options].sort((a, b) => a.no - b.no)).toEqual(
        [...source.options].sort((a, b) => a.no - b.no),
      );
      expect(item.options.filter((option) => option.is_correct)).toHaveLength(
        1,
      );
    }
  });

  it('answerKey reads the real adjudicated question from option 2', () => {
    const question = QuizService.client
      .bankQuestions('history_of_magic')
      .find((row) => row.id === ADJUDICATED_ID);
    expect(QuizService.answerKey({ options: question.options })).toBe(2);
  });

  it('grades a real drawn session end to end', () => {
    const session = QuizService.buildChallenge({
      bank: 'mixed',
      count: 25,
      mode: 'normal',
      rng: makeRng(99),
    });
    const answers = session.items.map((item, index) => ({
      // Answer every 3rd question correctly, others wrongly, with fake ms.
      chosenNo:
        index % 3 === 0
          ? QuizService.answerKey(item)
          : item.options.find((option) => !option.is_correct).no,
      ms: 1000 + index,
    }));
    const result = QuizService.gradeResult(session, answers);
    expect(result.total).toBe(25);
    expect(result.correctCount).toBe(9);
    expect(result.accuracy).toBeCloseTo(36, 10);
    expect(result.owl).toEqual({ code: 'T', key: 'owlT' });
    expect(result.perQuestion).toHaveLength(25);
    expect(result.totalMs).toBe(
      answers.reduce((sum, answer) => sum + answer.ms, 0),
    );
  });
});

describe('buildChallenge markers + item shape on a synthetic dataset', () => {
  let synthDir;

  beforeAll(async () => {
    synthDir = await mkdtemp(path.join(tmpdir(), 'hpma-quiz-svc-'));
    const question = (id, theme, extra = {}) => ({
      id,
      theme,
      question: { zh: `Q${id}`, en: `Q${id}` },
      options: [1, 2, 3, 4].map((no) => ({
        no,
        is_correct: no === 1,
        text: { zh: `选项${no}`, en: `opt${no}` },
      })),
      explanation: { zh: `E${id}`, en: `E${id}` },
      ...extra,
    });
    await writeFile(
      path.join(synthDir, 'quiz.json'),
      JSON.stringify({
        schema_version: 2,
        data_version: 777,
        generated_at: 'x',
        banks: {
          history_of_magic: {
            id: 'history_of_magic',
            questions: [
              question(1, 'ugc', {
                provider_name: '可爱的小沉沉',
                answer_conflict: true,
                answer_adjudicated: { correct_no: 1, note: '按原著口径' },
              }),
              question(2, 'theme1', { duplicate_of: [502] }),
              question(3, 'theme2'),
            ],
          },
          muggle_studies: {
            id: 'muggle_studies',
            questions: [question(4, 'ugc')],
          },
        },
      }),
    );
    await writeFile(path.join(synthDir, 'manifest.json'), JSON.stringify({}));
    await writeFile(
      path.join(synthDir, 'version.json'),
      JSON.stringify({ tag: 'quiz-v2.777.0', dataVersion: 777 }),
    );
    QuizService.configure({ dataBaseUrl: synthDir });
    await QuizService.load();
  });

  afterAll(() => {
    // Hand the module singleton back to the real data.
    QuizService.configure({ dataBaseUrl: REAL_DATA_BASE });
  });

  it('precomputes adjudicated/conflict/ugc/duplicate/stemShared markers', () => {
    const { items } = QuizService.buildChallenge({
      bank: 'mixed',
      count: 10,
      mode: 'normal',
      dataVersion: 777,
    });
    expect(items).toHaveLength(4); // whole pool, smaller than the count
    const byId = Object.fromEntries(items.map((item) => [item.id, item]));
    expect(byId[1].markers).toEqual({
      adjudicated: true,
      conflict: true,
      ugc: true,
      duplicate: false,
      stemShared: false,
    });
    expect(byId[2].markers).toEqual({
      adjudicated: false,
      conflict: false,
      ugc: false,
      duplicate: true,
      stemShared: false,
    });
    expect(byId[3].markers).toEqual({
      adjudicated: false,
      conflict: false,
      ugc: false,
      duplicate: false,
      stemShared: false,
    });
    expect(byId[4].markers).toEqual({
      adjudicated: false,
      conflict: false,
      ugc: true,
      duplicate: false,
      stemShared: false,
    });
  });

  it('carries bank/question/options/explanation and stamps the dataVersion', () => {
    const session = QuizService.buildChallenge({
      bank: 'muggle_studies',
      count: 5,
      mode: 'prefect',
      dataVersion: 777,
      rng: () => 0.5,
    });
    expect(session.dataVersion).toBe(777);
    // config.count is the ACTUAL drawn size, not the requested one.
    expect(session.config).toEqual({
      bank: 'muggle_studies',
      count: 1,
      mode: 'prefect',
    });
    const [item] = session.items;
    expect(item).toMatchObject({
      bank: 'muggle_studies',
      id: 4,
      question: { zh: 'Q4', en: 'Q4' },
      explanation: { zh: 'E4', en: 'E4' },
    });
    expect(item.options).toHaveLength(4);
    // rng()=0.5 trace: [1,2,3,4] -> [1,4,2,3] — order changed, set kept.
    expect(item.options.map((option) => option.no)).toEqual([1, 4, 2, 3]);
    expect(QuizService.answerKey(item)).toBe(1);
  });
});

describe('buildChallenge stemShared flag (synthetic dataset)', () => {
  let synthDir;

  beforeAll(async () => {
    synthDir = await mkdtemp(path.join(tmpdir(), 'hpma-quiz-stemshared-'));
    // Stems with variant rows (all rows must stay drawable):
    //   'S' — official q1 (correct opt 1) vs UGC q2 (correct opt 2): same
    //         stem, DIFFERENT correct answers — the prefect-mode trap the
    //         flag exists for.
    //   'U' — plain q4 vs q7 whose stem is wrapped in a color tag: markup
    //         must not split the group.
    //   'V' — two UGC rows only (no official variant exists).
    const question = (id, theme, stem, correctNo) => ({
      id,
      theme,
      ...(theme === 'ugc' ? { provider_name: '投稿人' } : {}),
      question: { zh: stem, en: stem },
      options: [1, 2, 3, 4].map((no) => ({
        no,
        is_correct: no === correctNo,
        text: { zh: `选项${no}`, en: `opt${no}` },
      })),
      explanation: { zh: `E${id}`, en: `E${id}` },
    });
    await writeFile(
      path.join(synthDir, 'quiz.json'),
      JSON.stringify({
        schema_version: 2,
        data_version: 888,
        generated_at: 'x',
        banks: {
          history_of_magic: {
            id: 'history_of_magic',
            questions: [
              question(1, 'theme1', 'S', 1),
              question(2, 'ugc', 'S', 2),
              question(3, 'theme2', 'T', 1),
              question(5, 'ugc', 'V', 1),
              question(6, 'ugc', 'V', 2),
            ],
          },
          muggle_studies: {
            id: 'muggle_studies',
            questions: [
              question(4, 'theme1', 'U', 1),
              question(7, 'theme1', '<color=focus_light>U</color>', 2),
            ],
          },
        },
      }),
    );
    await writeFile(path.join(synthDir, 'manifest.json'), JSON.stringify({}));
    await writeFile(
      path.join(synthDir, 'version.json'),
      JSON.stringify({ tag: 'quiz-v2.888.0', dataVersion: 888 }),
    );
    QuizService.configure({ dataBaseUrl: synthDir });
    await QuizService.load();
  });

  afterAll(() => {
    QuizService.configure({ dataBaseUrl: REAL_DATA_BASE });
  });

  it('keeps every row drawable and flags exactly the shared-stem rows', () => {
    const { items } = QuizService.buildChallenge({
      bank: 'mixed',
      count: 99,
      mode: 'prefect',
      rng: makeRng(42),
    });
    // All 7 rows are in the pool — none dropped for sharing a stem.
    expect(items).toHaveLength(7);
    const sharedById = Object.fromEntries(
      items.map((item) => [item.id, item.markers.stemShared]),
    );
    expect(sharedById).toEqual({
      1: true, // 'S' group
      2: true,
      3: false, // unique stem 'T'
      4: true, // 'U' group (with the tagged variant)
      5: true, // 'V' group (all-UGC)
      6: true,
      7: true,
    });
  });

  it('groups on the markup-stripped stem: tags do not split a group', () => {
    // Muggle pool: q4 ('U') and q7 ('<color=focus_light>U</color>') share a
    // stem group — both flagged, both drawable.
    const { items } = QuizService.buildChallenge({
      bank: 'muggle_studies',
      count: 99,
      mode: 'normal',
      rng: makeRng(7),
    });
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.markers.stemShared)).toBe(true);
  });

  it('flags are scoped to the drawn pool: single-bank draws see in-bank groups only', () => {
    // History-only pool: the 'U' group lives in the other bank, so this pool
    // carries the 'S' and 'V' groups plus one unique stem.
    const { items } = QuizService.buildChallenge({
      bank: 'history_of_magic',
      count: 99,
      mode: 'normal',
      rng: makeRng(9),
    });
    expect(items).toHaveLength(5);
    const sharedById = Object.fromEntries(
      items.map((item) => [item.id, item.markers.stemShared]),
    );
    expect(sharedById).toEqual({
      1: true,
      2: true,
      3: false,
      5: true,
      6: true,
    });
  });
});

describe('QuizService review progress storage (stubbed localStorage)', () => {
  const EMPTY_PROGRESS = {
    banks: {
      history_of_magic: { round: 1, seen: {}, wrong: {} },
      muggle_studies: { round: 1, seen: {}, wrong: {} },
    },
  };

  it('pins the review constants', () => {
    expect(QuizService.REVIEW_COUNTS).toEqual([25, 50, 100]);
    expect(QuizService.PROGRESS_STORAGE_KEY).toBe('hpma-quiz-progress');
  });

  it('readProgressRaw degrades to a fresh empty progress without storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(QuizService.readProgressRaw()).toEqual(EMPTY_PROGRESS);
    expect(() => QuizService.writeProgressRaw(null)).not.toThrow();
    expect(() => QuizService.clearProgress()).not.toThrow();
  });

  it('readProgressRaw normalizes the stored document (banks, round, maps)', () => {
    const map = stubStorage();
    map.set(
      QuizService.PROGRESS_STORAGE_KEY,
      JSON.stringify({
        banks: {
          history_of_magic: { round: 2, seen: { 7: 1 }, wrong: { 9: 1 } },
          // muggle_studies missing entirely -> defaulted
        },
        stray: true, // unknown top-level keys ignored
      }),
    );
    expect(QuizService.readProgressRaw()).toEqual({
      banks: {
        history_of_magic: { round: 2, seen: { 7: 1 }, wrong: { 9: 1 } },
        muggle_studies: { round: 1, seen: {}, wrong: {} },
      },
    });
    // Junk round / non-object maps normalize in place; fractional rounds floor.
    map.set(
      QuizService.PROGRESS_STORAGE_KEY,
      JSON.stringify({
        banks: {
          history_of_magic: { round: 0, seen: 'nope', wrong: [1, 2] },
          muggle_studies: { round: 2.7 },
        },
      }),
    );
    expect(QuizService.readProgressRaw()).toEqual({
      banks: {
        history_of_magic: { round: 1, seen: {}, wrong: {} },
        muggle_studies: { round: 2, seen: {}, wrong: {} },
      },
    });
  });

  it('readProgressRaw hands out fresh containers, never stored references', () => {
    const map = stubStorage();
    map.set(
      QuizService.PROGRESS_STORAGE_KEY,
      JSON.stringify({
        banks: {
          history_of_magic: { round: 2, seen: { 7: 1 }, wrong: {} },
          muggle_studies: {},
        },
      }),
    );
    const first = QuizService.readProgressRaw();
    first.banks.history_of_magic.seen[7] = 2;
    first.banks.muggle_studies.round = 9;
    const second = QuizService.readProgressRaw();
    expect(second.banks.history_of_magic.seen).toEqual({ 7: 1 });
    expect(second.banks.muggle_studies.round).toBe(1);
  });

  it('readProgressRaw degrades corrupted JSON and non-object payloads', () => {
    const map = stubStorage();
    for (const junk of ['not-json{', '[1,2]', '"str"', 'null', '42']) {
      map.set(QuizService.PROGRESS_STORAGE_KEY, junk);
      expect(QuizService.readProgressRaw()).toEqual(EMPTY_PROGRESS);
    }
  });

  it('writeProgressRaw stores JSON and clearProgress removes it; both guarded', () => {
    const map = stubStorage();
    const progress = {
      banks: {
        history_of_magic: { round: 3, seen: { 1: 1 }, wrong: {} },
        muggle_studies: { round: 1, seen: {}, wrong: {} },
      },
    };
    QuizService.writeProgressRaw(progress);
    expect(JSON.parse(map.get(QuizService.PROGRESS_STORAGE_KEY))).toEqual(
      progress,
    );
    QuizService.clearProgress();
    expect(map.has(QuizService.PROGRESS_STORAGE_KEY)).toBe(false);
    // Privacy mode: every storage call throws — nothing propagates.
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('quota');
      },
    });
    expect(() => QuizService.writeProgressRaw(progress)).not.toThrow();
    expect(() => QuizService.clearProgress()).not.toThrow();
    expect(() => QuizService.readProgressRaw()).not.toThrow();
  });

  it('reconcileProgress drops vanished ids per bank and keeps rounds (pure)', () => {
    const banks = {
      history_of_magic: [{ id: 1 }, { id: 2 }],
      muggle_studies: [{ id: 101 }],
    };
    const progress = {
      banks: {
        history_of_magic: {
          round: 4,
          seen: { 1: 1, 3: 1 },
          wrong: { 2: 1, 4: 1 },
        },
        muggle_studies: { round: 2, seen: { 101: 1 }, wrong: {} },
      },
    };
    const snapshot = JSON.parse(JSON.stringify(progress));
    const reconciled = QuizService.reconcileProgress(progress, banks);
    // ids 3/4 left the bank and are dropped; ids 1/2 and both rounds stay.
    expect(reconciled).toEqual({
      banks: {
        history_of_magic: { round: 4, seen: { 1: 1 }, wrong: { 2: 1 } },
        muggle_studies: { round: 2, seen: { 101: 1 }, wrong: {} },
      },
    });
    expect(reconciled).not.toBe(progress);
    expect(progress).toEqual(snapshot); // input untouched, incl. nested maps
    // Shape-missing input normalizes to the empty progress.
    expect(QuizService.reconcileProgress(null, banks)).toEqual(EMPTY_PROGRESS);
    // The raw client banks shape ({ [bankId]: { questions } }) works too.
    expect(
      QuizService.reconcileProgress(progress, {
        history_of_magic: { questions: [{ id: 1 }] },
        muggle_studies: { questions: [] },
      }),
    ).toEqual({
      banks: {
        history_of_magic: { round: 4, seen: { 1: 1 }, wrong: {} },
        muggle_studies: { round: 2, seen: {}, wrong: {} },
      },
    });
  });
});

describe('QuizService review engine (synthetic dataset)', () => {
  // 6 history questions (ids 1-6; q1/q2 share stem 'S') and 4 muggle
  // questions (ids 101-104, q104's correct option is 3).
  const HISTORY_IDS = [1, 2, 3, 4, 5, 6];
  const MUGGLE_IDS = [101, 102, 103, 104];
  let synthDir;

  const makeProgress = (perBank = {}) => ({
    banks: Object.fromEntries(
      QuizService.BANK_IDS.map((bankId) => [
        bankId,
        {
          round: perBank[bankId]?.round ?? 1,
          seen: Object.fromEntries(
            (perBank[bankId]?.seen ?? []).map((id) => [id, 1]),
          ),
          wrong: Object.fromEntries(
            (perBank[bankId]?.wrong ?? []).map((id) => [id, 1]),
          ),
        },
      ]),
    ),
  });

  // Minimal challenge item for hand-built applyProgress sessions (only
  // bank/id/options matter — answerKey reads is_correct).
  const synthItem = (bank, id, correctNo) => ({
    bank,
    id,
    options: [1, 2, 3, 4].map((no) => ({ no, is_correct: no === correctNo })),
  });

  beforeAll(async () => {
    synthDir = await mkdtemp(path.join(tmpdir(), 'hpma-quiz-review-'));
    const question = (id, theme, stem, correctNo) => ({
      id,
      theme,
      ...(theme === 'ugc' ? { provider_name: '投稿人' } : {}),
      question: { zh: stem, en: `Q${id}` },
      options: [1, 2, 3, 4].map((no) => ({
        no,
        is_correct: no === correctNo,
        text: { zh: `选项${no}`, en: `opt${no}` },
      })),
      explanation: { zh: `E${id}`, en: `E${id}` },
    });
    await writeFile(
      path.join(synthDir, 'quiz.json'),
      JSON.stringify({
        schema_version: 2,
        data_version: 999,
        generated_at: 'x',
        banks: {
          history_of_magic: {
            id: 'history_of_magic',
            questions: [
              question(1, 'theme1', 'S', 1),
              question(2, 'ugc', 'S', 2),
              question(3, 'theme2', 'T3', 1),
              question(4, 'theme3', 'T4', 1),
              question(5, 'theme4', 'T5', 1),
              question(6, 'theme5', 'T6', 1),
            ],
          },
          muggle_studies: {
            id: 'muggle_studies',
            questions: [
              question(101, 'theme1', 'M1', 1),
              question(102, 'theme2', 'M2', 1),
              question(103, 'theme3', 'M3', 1),
              question(104, 'theme4', 'M4', 3),
            ],
          },
        },
      }),
    );
    await writeFile(path.join(synthDir, 'manifest.json'), JSON.stringify({}));
    await writeFile(
      path.join(synthDir, 'version.json'),
      JSON.stringify({ tag: 'quiz-v2.999.0', dataVersion: 999 }),
    );
    QuizService.configure({ dataBaseUrl: synthDir });
    await QuizService.load();
  });

  afterAll(() => {
    // Hand the module singleton back to the real data.
    QuizService.configure({ dataBaseUrl: REAL_DATA_BASE });
  });

  describe('buildReviewChallenge', () => {
    const SEEN = makeProgress({
      history_of_magic: { seen: [1, 2] },
      muggle_studies: { seen: [101] },
    });

    it('draws only unseen questions; never intersects seen; deterministic', () => {
      const session = QuizService.buildReviewChallenge({
        bank: 'history_of_magic',
        count: 25,
        mode: 'normal',
        progress: SEEN,
        rng: makeRng(11),
      });
      // count clamped to the unseen pool (4 left after seen 1/2).
      expect(session.config).toEqual({
        bank: 'history_of_magic',
        count: 4,
        mode: 'normal',
        draw: 'review',
      });
      expect(
        session.items.map((item) => item.id).sort((a, b) => a - b),
      ).toEqual([3, 4, 5, 6]);
      // Same seed, same session.
      const replay = QuizService.buildReviewChallenge({
        bank: 'history_of_magic',
        count: 25,
        mode: 'normal',
        progress: SEEN,
        rng: makeRng(11),
      });
      expect(replay.items.map((item) => item.id)).toEqual(
        session.items.map((item) => item.id),
      );
      // Options shuffled through the same path (rng()=0.5 trace on 4
      // options: [1,4,2,3] — order changed, is_correct travelling along).
      const fixed = QuizService.buildReviewChallenge({
        bank: 'muggle_studies',
        count: 2,
        mode: 'prefect',
        progress: makeProgress({ muggle_studies: { seen: [101] } }),
        rng: () => 0.5,
      });
      for (const item of fixed.items) {
        expect(item.options.map((option) => option.no)).toEqual([1, 4, 2, 3]);
        expect(item.options.filter((option) => option.is_correct)).toHaveLength(
          1,
        );
      }
      const m104 = fixed.items.find((item) => item.id === 104);
      expect(QuizService.answerKey(m104)).toBe(3);
    });

    it('mixed draws the union of both banks’ unseen sets', () => {
      const session = QuizService.buildReviewChallenge({
        bank: 'mixed',
        count: 25,
        mode: 'normal',
        progress: SEEN,
        rng: makeRng(5),
      });
      // history unseen {3..6} ∪ muggle unseen {102..104} = 7 questions.
      expect(session.items).toHaveLength(7);
      expect(new Set(session.items.map((item) => item.bank)).size).toBe(2);
      const seenIds = new Set([1, 2, 101].map(String));
      expect(session.items.every((item) => !seenIds.has(String(item.id)))).toBe(
        true,
      );
    });

    it('a fully seen bank draws from the full pool (post-rollover state)', () => {
      // Right after applyProgress rolls a completed round, seen/wrong are
      // cleared — that is the natural "bank fully seen" state, and the whole
      // pool is drawable again.
      const session = QuizService.buildReviewChallenge({
        bank: 'history_of_magic',
        count: 25,
        mode: 'normal',
        progress: makeProgress({ history_of_magic: { round: 2 } }),
        rng: makeRng(3),
      });
      expect(session.items).toHaveLength(6);
      expect(
        session.items.map((item) => item.id).sort((a, b) => a - b),
      ).toEqual(HISTORY_IDS);
      // The literal all-seen-without-rollover shape can never persist (the
      // eager rollover clears seen the moment a bank drains); per the
      // contract the unseen pool is pool-minus-seen, so nothing is drawn.
      const exhausted = QuizService.buildReviewChallenge({
        bank: 'history_of_magic',
        count: 25,
        mode: 'normal',
        progress: makeProgress({ history_of_magic: { seen: HISTORY_IDS } }),
        rng: makeRng(3),
      });
      expect(exhausted.items).toEqual([]);
      expect(exhausted.config.count).toBe(0);
    });

    it('clamps count and tolerates an exhausted pool / missing progress', () => {
      const two = QuizService.buildReviewChallenge({
        bank: 'muggle_studies',
        count: 2,
        mode: 'normal',
        progress: SEEN,
        rng: makeRng(2),
      });
      expect(two.config.count).toBe(2);
      expect(two.items).toHaveLength(2);
      const none = QuizService.buildReviewChallenge({
        bank: 'mixed',
        count: 0,
        mode: 'normal',
        progress: SEEN,
        rng: makeRng(2),
      });
      expect(none.items).toEqual([]);
      expect(none.config).toEqual({
        bank: 'mixed',
        count: 0,
        mode: 'normal',
        draw: 'review',
      });
      // null progress = nothing seen yet -> the whole pool is drawable.
      const fresh = QuizService.buildReviewChallenge({
        bank: 'history_of_magic',
        count: 99,
        mode: 'normal',
        progress: null,
        rng: makeRng(2),
      });
      expect(fresh.items).toHaveLength(6);
    });

    it('shares the markers path with random draws: same rng, equal items', () => {
      // Empty progress -> the review pool IS the full pool, so the two
      // builders must agree item for item (order, options and markers).
      const review = QuizService.buildReviewChallenge({
        bank: 'mixed',
        count: 50,
        mode: 'normal',
        progress: makeProgress(),
        rng: makeRng(20261009),
      });
      const random = QuizService.buildChallenge({
        bank: 'mixed',
        count: 50,
        mode: 'normal',
        rng: makeRng(20261009),
      });
      expect(review.items).toEqual(random.items);
      expect(review.dataVersion).toBe(null); // review never enters bests
      // Same-stem groups are tallied over the WHOLE bank pool: q1's group
      // mate (q2) is seen, yet q1 still draws with stemShared=true —
      // identical to what a random draw would say about it.
      const session = QuizService.buildReviewChallenge({
        bank: 'history_of_magic',
        count: 25,
        mode: 'prefect',
        progress: makeProgress({ history_of_magic: { seen: [2] } }),
        rng: makeRng(8),
      });
      const q1 = session.items.find((item) => item.id === 1);
      expect(q1.markers).toEqual({
        adjudicated: false,
        conflict: false,
        ugc: false,
        duplicate: false,
        stemShared: true,
      });
      expect(Object.keys(q1).sort()).toEqual([
        'bank',
        'explanation',
        'id',
        'markers',
        'options',
        'question',
      ]);
    });

    it('is pure: the passed progress is never mutated', () => {
      const progress = makeProgress({
        history_of_magic: { seen: [1, 2] },
        muggle_studies: { seen: [101] },
      });
      const snapshot = JSON.parse(JSON.stringify(progress));
      QuizService.buildReviewChallenge({
        bank: 'mixed',
        count: 5,
        mode: 'normal',
        progress,
        rng: makeRng(1),
      });
      expect(progress).toEqual(snapshot);
    });
  });

  describe('applyProgress', () => {
    it('marks seen/wrong via answerKey, skips blanks and ignores forged flags', () => {
      const progress = makeProgress();
      const session = {
        config: {
          bank: 'history_of_magic',
          count: 3,
          mode: 'normal',
          draw: 'review',
        },
        items: [
          synthItem('history_of_magic', 1, 1),
          synthItem('history_of_magic', 3, 2),
          synthItem('history_of_magic', 6, 4),
        ],
      };
      const answers = [
        { chosenNo: 1, correct: true, ms: 100 }, // correct -> seen
        { chosenNo: 1, correct: true, ms: 200 }, // WRONG pick (key is 2),
        // the forged correct flag must not rescue it -> seen + wrong
        null, // skipped: chosenNo null never touches progress
      ];
      const {
        progress: next,
        coveredNow,
        rolledBanks,
      } = QuizService.applyProgress(progress, session, answers);
      expect(coveredNow).toBe(2);
      expect(rolledBanks).toEqual([]);
      expect(next.banks.history_of_magic).toEqual({
        round: 1,
        seen: { 1: 1, 3: 1 },
        wrong: { 3: 1 },
      });
      expect(next.banks.muggle_studies).toEqual({
        round: 1,
        seen: {},
        wrong: {},
      });
      expect(next).not.toBe(progress);
      // Missing answer entries (undefined) count as blank too.
      const sparse = QuizService.applyProgress(progress, session, [
        { chosenNo: 1, ms: 100 },
      ]);
      expect(sparse.coveredNow).toBe(1);
      expect(sparse.progress.banks.history_of_magic.seen).toEqual({ 1: 1 });
    });

    it('a same-round correct answer removes the id from wrong; pre-seen ids do not recount', () => {
      const progress = makeProgress({
        history_of_magic: { seen: [1], wrong: [3] },
      });
      const session = {
        config: {
          bank: 'history_of_magic',
          count: 2,
          mode: 'normal',
          draw: 'review',
        },
        items: [
          synthItem('history_of_magic', 3, 2),
          synthItem('history_of_magic', 4, 1),
        ],
      };
      const { progress: next, coveredNow } = QuizService.applyProgress(
        progress,
        session,
        [
          { chosenNo: 2, ms: 100 },
          { chosenNo: 1, ms: 100 },
        ],
      );
      // id 3 answered correctly -> wrong entry removed (defensive re-answer).
      expect(next.banks.history_of_magic.wrong).toEqual({});
      expect(next.banks.history_of_magic.seen).toEqual({ 1: 1, 3: 1, 4: 1 });
      // coveredNow counts only newly covered ids: 3 and 4, not the pre-seen 1.
      expect(coveredNow).toBe(2);
    });

    it('rolls only the bank whose unseen set drained, even on a wrong answer', () => {
      // Five of six history questions seen: the review draw is exactly the
      // last unseen one; answering it (wrong, even) drains the bank.
      const progress = makeProgress({
        history_of_magic: { seen: [1, 2, 3, 4, 5], wrong: [2] },
      });
      const session = {
        config: {
          bank: 'history_of_magic',
          count: 1,
          mode: 'normal',
          draw: 'review',
        },
        items: [synthItem('history_of_magic', 6, 1)],
      };
      const {
        progress: next,
        coveredNow,
        rolledBanks,
      } = QuizService.applyProgress(progress, session, [
        { chosenNo: 4, ms: 100 },
      ]);
      expect(rolledBanks).toEqual(['history_of_magic']);
      expect(coveredNow).toBe(1);
      expect(next.banks.history_of_magic).toEqual({
        round: 2,
        seen: {},
        wrong: {},
      });
      expect(next.banks.muggle_studies).toEqual({
        round: 1,
        seen: {},
        wrong: {},
      });
    });

    it('mixed partial drain: only the drained bank rolls, the other keeps its round', () => {
      // Muggle has one unseen question left; history still has four.
      const progress = makeProgress({
        history_of_magic: { seen: [1] },
        muggle_studies: { seen: [101, 102, 103] },
      });
      const session = {
        config: { bank: 'mixed', count: 2, mode: 'normal', draw: 'review' },
        items: [
          synthItem('history_of_magic', 3, 1),
          synthItem('muggle_studies', 104, 3),
        ],
      };
      const {
        progress: next,
        coveredNow,
        rolledBanks,
      } = QuizService.applyProgress(progress, session, [
        { chosenNo: 1, ms: 100 },
        { chosenNo: 3, ms: 100 },
      ]);
      expect(rolledBanks).toEqual(['muggle_studies']);
      expect(coveredNow).toBe(2);
      // Muggle rolled and cleared; history untouched on round 1.
      expect(next.banks.muggle_studies).toEqual({
        round: 2,
        seen: {},
        wrong: {},
      });
      expect(next.banks.history_of_magic).toEqual({
        round: 1,
        seen: { 1: 1, 3: 1 },
        wrong: {},
      });
    });

    it('is pure and records nothing when every answer is blank', () => {
      const progress = makeProgress({
        history_of_magic: { seen: [1], wrong: [2] },
      });
      const snapshot = JSON.parse(JSON.stringify(progress));
      const session = {
        config: { bank: 'mixed', count: 2, mode: 'normal', draw: 'review' },
        items: [
          synthItem('history_of_magic', 3, 1),
          synthItem('muggle_studies', 101, 1),
        ],
      };
      const {
        progress: next,
        coveredNow,
        rolledBanks,
      } = QuizService.applyProgress(progress, session, [
        null,
        { chosenNo: null, ms: 100 },
      ]);
      expect(coveredNow).toBe(0);
      expect(rolledBanks).toEqual([]);
      expect(next).toEqual(progress); // same content…
      expect(next).not.toBe(progress); // …but a fresh object
      expect(progress).toEqual(snapshot); // input untouched
    });
  });
});

describe('QuizService review engine over the real committed data', () => {
  let banks; // store-shaped { [bankId]: Question[] }

  beforeAll(async () => {
    QuizService.configure({ dataBaseUrl: REAL_DATA_BASE });
    await QuizService.load();
    banks = {
      history_of_magic: QuizService.client.bankQuestions('history_of_magic'),
      muggle_studies: QuizService.client.bankQuestions('muggle_studies'),
    };
  });

  it('coverageStats reports the real bank sizes 1223 / 624', () => {
    expect(QuizService.coverageStats(null, banks)).toEqual({
      history_of_magic: {
        round: 1,
        seen: 0,
        total: 1223,
        remaining: 1223,
        wrong: 0,
      },
      muggle_studies: {
        round: 1,
        seen: 0,
        total: 624,
        remaining: 624,
        wrong: 0,
      },
    });
    const ids = (bankId, n) =>
      banks[bankId].slice(0, n).map((question) => question.id);
    const progress = {
      banks: {
        history_of_magic: {
          round: 3,
          seen: Object.fromEntries(
            ids('history_of_magic', 5).map((id) => [id, 1]),
          ),
          wrong: Object.fromEntries(
            ids('history_of_magic', 2).map((id) => [id, 1]),
          ),
        },
        muggle_studies: { round: 1, seen: {}, wrong: {} },
      },
    };
    const stats = QuizService.coverageStats(progress, banks);
    expect(stats.history_of_magic).toEqual({
      round: 3,
      seen: 5,
      total: 1223,
      remaining: 1218,
      wrong: 2,
    });
    expect(stats.muggle_studies).toEqual({
      round: 1,
      seen: 0,
      total: 624,
      remaining: 624,
      wrong: 0,
    });
  });

  it('an empty-progress review draw is item-for-item identical to the random path', () => {
    const review = QuizService.buildReviewChallenge({
      bank: 'mixed',
      count: 50,
      mode: 'normal',
      progress: null,
      rng: makeRng(20261009),
    });
    const random = QuizService.buildChallenge({
      bank: 'mixed',
      count: 50,
      mode: 'normal',
      rng: makeRng(20261009),
    });
    expect(review.items).toEqual(random.items);
    expect(review.config).toEqual({
      bank: 'mixed',
      count: 50,
      mode: 'normal',
      draw: 'review',
    });
  });

  it('reconciles weekly-update drift and draws strictly unseen (mixed)', () => {
    // 400 history + 300 muggle ids marked seen, plus one id that no longer
    // exists in the bank (a weekly update removed it).
    const seenHistory = banks.history_of_magic
      .slice(0, 400)
      .map((question) => question.id);
    const seenMuggle = banks.muggle_studies
      .slice(0, 300)
      .map((question) => question.id);
    const stored = {
      banks: {
        history_of_magic: {
          round: 2,
          seen: Object.fromEntries(
            [...seenHistory, 999999999].map((id) => [id, 1]),
          ),
          wrong: {},
        },
        muggle_studies: {
          round: 1,
          seen: Object.fromEntries(seenMuggle.map((id) => [id, 1])),
          wrong: {},
        },
      },
    };
    const progress = QuizService.reconcileProgress(stored, banks);
    expect(progress.banks.history_of_magic.seen[999999999]).toBeUndefined();
    expect(Object.keys(progress.banks.history_of_magic.seen)).toHaveLength(400);
    expect(progress.banks.history_of_magic.round).toBe(2);
    expect(Object.keys(progress.banks.muggle_studies.seen)).toHaveLength(300);

    const session = QuizService.buildReviewChallenge({
      bank: 'mixed',
      count: 100,
      mode: 'prefect',
      progress,
      rng: makeRng(20261010),
    });
    expect(session.items).toHaveLength(100);
    // ids are only unique PER BANK — qualify with the bank when checking.
    const seenIds = new Set([
      ...seenHistory.map((id) => `history_of_magic:${id}`),
      ...seenMuggle.map((id) => `muggle_studies:${id}`),
    ]);
    expect(
      session.items.every((item) => !seenIds.has(`${item.bank}:${item.id}`)),
    ).toBe(true);
    expect(new Set(session.items.map((item) => item.bank)).size).toBe(2);
    // Deterministic on the fixed seed.
    const replay = QuizService.buildReviewChallenge({
      bank: 'mixed',
      count: 100,
      mode: 'prefect',
      progress,
      rng: makeRng(20261010),
    });
    expect(replay.items.map((item) => item.id)).toEqual(
      session.items.map((item) => item.id),
    );
  });

  it('applyProgress folds a real review session in and persists round-trip', () => {
    stubStorage();
    const session = QuizService.buildReviewChallenge({
      bank: 'history_of_magic',
      count: 25,
      mode: 'normal',
      progress: null,
      rng: makeRng(7),
    });
    const answers = session.items.map((item, index) => ({
      // Every 2nd question correct (13 of 25), the rest wrong.
      chosenNo:
        index % 2 === 0
          ? QuizService.answerKey(item)
          : item.options.find((option) => !option.is_correct).no,
      ms: 1000,
    }));
    const { progress, coveredNow, rolledBanks } = QuizService.applyProgress(
      null,
      session,
      answers,
    );
    expect(coveredNow).toBe(25);
    expect(rolledBanks).toEqual([]);
    expect(Object.keys(progress.banks.history_of_magic.seen)).toHaveLength(25);
    expect(Object.keys(progress.banks.history_of_magic.wrong)).toHaveLength(12);
    // Storage round-trip preserves the normalized shape.
    QuizService.writeProgressRaw(progress);
    expect(QuizService.readProgressRaw()).toEqual(progress);
    QuizService.clearProgress();
    expect(QuizService.readProgressRaw()).toEqual({
      banks: {
        history_of_magic: { round: 1, seen: {}, wrong: {} },
        muggle_studies: { round: 1, seen: {}, wrong: {} },
      },
    });
  });
});
