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
      '正确 2/2（100%）· 用时 3分21秒',
      '你也来试试 → https://example.com/quiz',
    ]);
  });

  it('renders the en four-line report and defaults to zh', () => {
    expect(
      QuizService.formatShareText({ result, url, locale: 'en' }).split('\n'),
    ).toEqual([
      'HPMA Quiz — History of Magic · 2 questions · Prefect mode',
      'O.W.L. grade: O · Outstanding',
      '2/2 correct (100%) · Time 3m 21s',
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
    // A pool smaller than the requested count yields the whole pool.
    expect(
      QuizService.buildChallenge({
        bank: 'mixed',
        count: 99999,
        mode: 'normal',
      }).items,
    ).toHaveLength(1847);
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

  it('precomputes adjudicated/conflict/ugc/duplicate markers', () => {
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
    });
    expect(byId[2].markers).toEqual({
      adjudicated: false,
      conflict: false,
      ugc: false,
      duplicate: true,
    });
    expect(byId[3].markers).toEqual({
      adjudicated: false,
      conflict: false,
      ugc: false,
      duplicate: false,
    });
    expect(byId[4].markers).toEqual({
      adjudicated: false,
      conflict: false,
      ugc: true,
      duplicate: false,
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
