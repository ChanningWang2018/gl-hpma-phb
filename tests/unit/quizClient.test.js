// Tests for quizClient.js — pure helpers plus integration assertions against
// the real committed quizbank data (vitest cwd = repo root).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  DEFAULT_DATA_BASE_URL,
  EXPECTED_SCHEMA_VERSION,
  correctOption,
  createClient,
  joinUrl,
  lookupText,
  normalizeBaseUrl,
  sanitizeMarkup,
  shuffle,
  shuffledOptions,
} from '../../src/services/quizClient.js';

const DATA_BASE = 'public/data/quiz/';
const HISTORY_COUNT = 1223;
const MUGGLE_COUNT = 624;
const TOTAL_COUNT = HISTORY_COUNT + MUGGLE_COUNT;
const ADJUDICATED_ID = 101301103; // Quidditch World Cup year — answer moved to option 2

// One shared client against the real data; individual tests create their own
// when they need different options.
const client = createClient({ dataBaseUrl: DATA_BASE });

// Deterministic LCG so sampled assertions never flake.
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function sampleRows(rng, count) {
  const rows = client.allQuestions();
  const picked = new Set();
  while (picked.size < count) picked.add(rows[Math.floor(rng() * rows.length)]);
  return [...picked];
}

const stripTags = (text) => text.replace(/<[^<>]*>/g, '');

describe('pure helpers', () => {
  it('pins the schema and default data base contract', () => {
    expect(EXPECTED_SCHEMA_VERSION).toBe(2);
    expect(DEFAULT_DATA_BASE_URL).toBe('/data/quiz/');
    expect(createClient().dataBaseUrl).toBe('/data/quiz/');
    expect(createClient({ dataBaseUrl: 'public/data' }).dataBaseUrl).toBe(
      'public/data/',
    );
  });

  it('normalizeBaseUrl trims and keeps exactly one trailing slash', () => {
    expect(normalizeBaseUrl('https://cdn.example.com/d')).toBe(
      'https://cdn.example.com/d/',
    );
    expect(normalizeBaseUrl('  ../data/// ')).toBe('../data/');
    expect(normalizeBaseUrl('/')).toBe('/');
  });

  it('joinUrl avoids double slashes', () => {
    expect(joinUrl('public/data/quiz/', 'quiz.json')).toBe(
      'public/data/quiz/quiz.json',
    );
    expect(joinUrl('https://cdn/x', '/quiz.json')).toBe(
      'https://cdn/x/quiz.json',
    );
  });

  it('lookupText reads the requested locale and falls back to zh', () => {
    expect(lookupText({ zh: '题干', en: 'Question' }, 'en')).toBe('Question');
    expect(lookupText({ zh: '题干', en: 'Question' }, 'zh')).toBe('题干');
    // Empty or missing requested value -> zh fallback.
    expect(lookupText({ zh: '题干', en: '' }, 'en')).toBe('题干');
    expect(lookupText({ zh: '题干' }, 'en')).toBe('题干');
    // Neither locale has a value -> null.
    expect(lookupText({ en: 'Question' }, 'zh')).toBe(null);
    expect(lookupText({}, 'en')).toBe(null);
    expect(lookupText(null, 'en')).toBe(null);
    // Custom fallback locale.
    expect(lookupText({ en: 'Question' }, 'zh', 'en')).toBe('Question');
  });

  it('correctOption() returns the flagged option and null when absent', () => {
    const option2 = { no: 2, is_correct: true };
    const question = {
      options: [
        { no: 1, is_correct: false },
        option2,
        { no: 3, is_correct: false },
        { no: 4, is_correct: false },
      ],
    };
    expect(correctOption(question)).toBe(option2);
    expect(correctOption({ options: [{ no: 1, is_correct: false }] })).toBe(
      null,
    );
    expect(correctOption({})).toBe(null);
    expect(correctOption(null)).toBe(null);
  });

  it('shuffle() Fisher-Yates returns a new array and never mutates the input', () => {
    const source = ['a', 'b', 'c', 'd'];
    const snapshot = [...source];
    const shuffled = shuffle(source, () => 0.5);
    expect(shuffled).not.toBe(source);
    expect(source).toEqual(snapshot); // input untouched
    expect([...shuffled].sort()).toEqual(snapshot); // permutation of the set
    // Deterministic trace with rng()=0.5: j = floor(0.5*(i+1)) -> swaps
    // (3,2) then (2,1), then a no-op (1,1): a b c d -> a b d c -> a d b c.
    expect(shuffled).toEqual(['a', 'd', 'b', 'c']);
    // Degenerate inputs still produce a fresh array.
    expect(shuffle([], () => 0.5)).toEqual([]);
    expect(shuffle(['x'], () => 0.5)).toEqual(['x']);
    expect(shuffle(['x'], () => 0.5)).not.toBe(['x']);
  });

  it('shuffledOptions() shuffles a fresh array and leaves question.options untouched', () => {
    const question = {
      options: [{ no: 1 }, { no: 2 }, { no: 3 }, { no: 4 }],
    };
    const snapshot = [...question.options];
    const shuffled = shuffledOptions(question, () => 0.5);
    expect(shuffled).not.toBe(question.options);
    expect(question.options).toEqual(snapshot);
    expect([...shuffled].sort((a, b) => a.no - b.no)).toEqual(snapshot);
    // Elements stay identical references (is_correct travels with its option).
    expect(snapshot.includes(shuffled[0])).toBe(true);
    expect(shuffled.map((o) => o.no)).not.toEqual([1, 2, 3, 4]);
    // Default rng path works.
    expect(shuffledOptions(question)).toHaveLength(4);
  });

  it('sanitizeMarkup() passes plain text through as one unmarked segment', () => {
    expect(sanitizeMarkup(' plain question ')).toEqual([
      { text: ' plain question ', mark: null },
    ]);
  });

  it('sanitizeMarkup() parses the two known color tags into marked segments', () => {
    expect(sanitizeMarkup('a<color=focus_light>key</color>b')).toEqual([
      { text: 'a', mark: null },
      { text: 'key', mark: 'focus' },
      { text: 'b', mark: null },
    ]);
    expect(sanitizeMarkup('<color=warn_light>危险</color>')).toEqual([
      { text: '危险', mark: 'warn' },
    ]);
    // Each span boundary keeps its own segment; joins stay lossless.
    const segments = sanitizeMarkup(
      'x<color=focus_light>a</color>y<color=focus_light>b</color>z',
    );
    expect(segments).toEqual([
      { text: 'x', mark: null },
      { text: 'a', mark: 'focus' },
      { text: 'y', mark: null },
      { text: 'b', mark: 'focus' },
      { text: 'z', mark: null },
    ]);
  });

  it('sanitizeMarkup() keeps the rest marked when a color span never closes', () => {
    // Real-data shape (history_of_magic:611 carries an opener without </color>).
    expect(sanitizeMarkup('是谁<color=focus_light>在第二次大战')).toEqual([
      { text: '是谁', mark: null },
      { text: '在第二次大战', mark: 'focus' },
    ]);
  });

  it('sanitizeMarkup() strips unknown tags and keeps a bare "<" literal', () => {
    const segments = sanitizeMarkup('a<link=x>跳转</link>b < c');
    expect(segments.map((s) => s.text).join('')).toBe('a跳转b < c');
    expect(segments.map((s) => s.mark)).toEqual([null, null, null]);
  });

  it('sanitizeMarkup() tolerates stray closers and empty input', () => {
    expect(
      sanitizeMarkup('a</color>b')
        .map((s) => s.text)
        .join(''),
    ).toBe('ab');
    expect(sanitizeMarkup('')).toEqual([]);
    expect(sanitizeMarkup(null)).toEqual([]);
    expect(sanitizeMarkup(undefined)).toEqual([]);
  });
});

describe('createClient (real committed data)', () => {
  it('load() fetches and caches all three documents', async () => {
    const snap = await client.load();
    expect(snap.schemaVersion).toBe(EXPECTED_SCHEMA_VERSION);
    expect(snap.dataVersion).toBeGreaterThanOrEqual(1);
    expect(Object.keys(snap.banks).sort()).toEqual([
      'history_of_magic',
      'muggle_studies',
    ]);
    expect(snap.manifest && typeof snap.manifest === 'object').toBe(true);
    expect(snap.versionInfo.tag).toMatch(/^quiz-v\d+\.\d{8}\.0$/);
    // Second call is served from cache (same object identity).
    const again = await client.load();
    expect(again.banks).toBe(snap.banks);
  });

  it('load() shares one in-flight promise across concurrent callers', async () => {
    const fresh = createClient({ dataBaseUrl: DATA_BASE });
    const [a, b] = await Promise.all([fresh.load(), fresh.load()]);
    expect(a.banks).toBe(b.banks);
    expect(a.versionInfo).toBe(b.versionInfo);
  });

  it('exposes the real bank counts 1223 / 624 / 1847', () => {
    expect(client.questionCount('history_of_magic')).toBe(HISTORY_COUNT);
    expect(client.questionCount('muggle_studies')).toBe(MUGGLE_COUNT);
    expect(client.questionCount('nonexistent')).toBe(0);
    expect(client.bankQuestions('nonexistent')).toEqual([]);
    expect(client.allQuestions()).toHaveLength(TOTAL_COUNT);
    expect(client.bankQuestions('history_of_magic')).toHaveLength(
      HISTORY_COUNT,
    );
    expect(client.bankQuestions('muggle_studies')).toHaveLength(MUGGLE_COUNT);
  });

  it('bankQuestions() hands out the raw array reference', () => {
    expect(client.bankQuestions('history_of_magic')).toBe(
      client.banks.history_of_magic.questions,
    );
  });

  it('allQuestions() concatenates both banks as [{ bank, ...question }]', () => {
    const rows = client.allQuestions();
    expect(rows).toHaveLength(TOTAL_COUNT);
    expect(
      rows.every(
        (row) =>
          row.bank === 'history_of_magic' || row.bank === 'muggle_studies',
      ),
    ).toBe(true);
    // Every row carries the question payload next to its bank id.
    expect(
      rows.every(
        (row) =>
          typeof row.id === 'number' &&
          typeof row.question === 'object' &&
          Array.isArray(row.options),
      ),
    ).toBe(true);
    // Per-bank ids are unique; the tail of the concatenation is muggle_studies.
    expect(
      new Set(
        rows.filter((r) => r.bank === 'history_of_magic').map((r) => r.id),
      ).size,
    ).toBe(HISTORY_COUNT);
    expect(
      new Set(rows.filter((r) => r.bank === 'muggle_studies').map((r) => r.id))
        .size,
    ).toBe(MUGGLE_COUNT);
    expect(rows[0].bank).toBe('history_of_magic');
    expect(rows[rows.length - 1].bank).toBe('muggle_studies');
  });

  it('every question has exactly 4 options with exactly one is_correct', () => {
    const violations = [];
    for (const row of client.allQuestions()) {
      if (
        !Array.isArray(row.options) ||
        row.options.length !== 4 ||
        row.options.filter((option) => option.is_correct).length !== 1
      ) {
        violations.push(`${row.bank}:${row.id}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('outside the adjudicated question the correct option sits at options[0]', () => {
    const offenders = client
      .allQuestions()
      .filter(
        (row) =>
          row.id !== ADJUDICATED_ID && row.options[0].is_correct !== true,
      );
    expect(offenders.map((row) => `${row.bank}:${row.id}`)).toEqual([]);
  });

  it('correctOption() matches the single flagged option on 20 sampled questions', () => {
    for (const row of sampleRows(makeRng(20261009), 20)) {
      const flagged = row.options.filter((option) => option.is_correct);
      expect(flagged).toHaveLength(1);
      expect(correctOption(row)).toBe(flagged[0]);
    }
  });

  it('the adjudicated question reads its answer from option 2 (1473)', () => {
    const question = client
      .bankQuestions('history_of_magic')
      .find((row) => row.id === ADJUDICATED_ID);
    expect(question).toBeDefined();
    expect(question.answer_conflict).toBe(true);
    expect(question.answer_adjudicated.correct_no).toBe(2);
    const correct = correctOption(question);
    expect(correct.no).toBe(2);
    expect(correct.text.zh).toContain('1473');
    // The "answer_conflicts" manifest entry names exactly this question.
    expect(client.manifest.coverage.answer_conflicts).toEqual([
      `history_of_magic:${ADJUDICATED_ID}`,
    ]);
  });

  it('shuffledOptions() with the default rng never leaves all 20 questions in source order', () => {
    const history = client.bankQuestions('history_of_magic');
    const rng = makeRng(7);
    let identity = 0;
    for (let i = 0; i < 20; i += 1) {
      const question = history[Math.floor(rng() * history.length)];
      const shuffled = shuffledOptions(question);
      if (
        shuffled.every((option, index) => option === question.options[index])
      ) {
        identity += 1;
      }
    }
    expect(identity).toBeLessThan(20);
  });

  it('sanitizeMarkup() round-trips 30 sampled real question texts', () => {
    for (const row of sampleRows(makeRng(42), 30)) {
      const texts = [
        row.question.zh,
        row.explanation.zh,
        ...row.options.map((option) => option.text.zh),
      ];
      for (const text of texts) {
        const segments = sanitizeMarkup(text);
        for (const segment of segments) {
          expect([null, 'focus', 'warn']).toContain(segment.mark);
          expect(segment.text.length).toBeGreaterThan(0);
        }
        // Joining the segments reproduces the input minus stripped tags.
        expect(segments.map((s) => s.text).join('')).toBe(stripTags(text));
        // Every color span in the text owns at least one marked segment.
        const openings = (text.match(/<color=/g) || []).length;
        if (openings > 0) {
          expect(segments.length).toBeGreaterThanOrEqual(openings);
        }
      }
    }
  });

  it('sanitizeMarkup() is lossless across every zh question text in the dataset', () => {
    const offenders = [];
    for (const row of client.allQuestions()) {
      const segments = sanitizeMarkup(row.question.zh);
      if (segments.map((s) => s.text).join('') !== stripTags(row.question.zh)) {
        offenders.push(`${row.bank}:${row.id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('lookupText() needs no fallback — the v2 data is 100% bilingual', () => {
    const missing = [];
    for (const row of client.allQuestions()) {
      if (lookupText(row.question, 'zh') !== row.question.zh) {
        missing.push(`${row.bank}:${row.id} question/zh`);
      }
      if (lookupText(row.question, 'en') !== row.question.en) {
        missing.push(`${row.bank}:${row.id} question/en`);
      }
      if (lookupText(row.explanation, 'en') !== row.explanation.en) {
        missing.push(`${row.bank}:${row.id} explanation/en`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('versionInfo mirrors the committed version.json and agrees with quiz/manifest', () => {
    // versionInfo must mirror the committed version.json verbatim
    // (derived assertion survives upstream data bumps without test edits).
    const committedVersion = JSON.parse(
      readFileSync('public/data/quiz/version.json', 'utf8'),
    );
    expect(client.versionInfo).toEqual(committedVersion);
    // Cross-document version facts: quiz.json <-> manifest.json <-> version.json.
    expect(client.versionInfo.schemaVersion).toBe(EXPECTED_SCHEMA_VERSION);
    expect(client.manifest.schema_version).toBe(EXPECTED_SCHEMA_VERSION);
    expect(client.versionInfo.dataVersion).toBe(client.manifest.data_version);
    expect(client.versionInfo.generatedAt).toBe(client.manifest.generated_at);
    expect(client.versionInfo.sourceUrl).toContain(client.versionInfo.tag);
    expect(client.versionInfo.sourceRepo).toBe('hpma-bits/hpma-quizbank');
    // Manifest coverage mirrors the real bank sizes.
    expect(client.manifest.coverage.questions).toEqual({
      history_of_magic: HISTORY_COUNT,
      muggle_studies: MUGGLE_COUNT,
    });
    expect(client.manifest.datasets[0]).toEqual({
      id: 'quiz',
      file: 'quiz.json',
      count: TOTAL_COUNT,
    });
  });

  it('throws a helpful error when accessing data before load()', () => {
    const fresh = createClient({ dataBaseUrl: DATA_BASE });
    expect(() => fresh.banks).toThrow(/load\(\)/);
    expect(() => fresh.manifest).toThrow(/load\(\)/);
    expect(() => fresh.versionInfo).toThrow(/load\(\)/);
    expect(() => fresh.bankQuestions('history_of_magic')).toThrow(/load\(\)/);
    expect(() => fresh.questionCount('history_of_magic')).toThrow(/load\(\)/);
    expect(() => fresh.allQuestions()).toThrow(/load\(\)/);
  });

  it('load() rejects with a friendly upgrade error on schema_version mismatch', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hpma-bad-quiz-'));
    await writeFile(
      path.join(dir, 'quiz.json'),
      JSON.stringify({
        schema_version: 99,
        data_version: 1,
        generated_at: 'x',
        banks: {},
      }),
    );
    await writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ schema_version: 99 }),
    );
    await writeFile(
      path.join(dir, 'version.json'),
      JSON.stringify({ tag: 'quiz-v99.0.0' }),
    );

    const bad = createClient({ dataBaseUrl: dir });
    await expect(bad.load()).rejects.toThrow(/schema_version/);
    await expect(bad.load()).rejects.toThrow(/99/);
    await expect(bad.load()).rejects.toThrow(/升级消费端/);
  });

  it('can retry load() after a failure (missing file -> then fixed)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hpma-quiz-retry-'));
    await writeFile(
      path.join(dir, 'quiz.json'),
      JSON.stringify({
        schema_version: EXPECTED_SCHEMA_VERSION,
        data_version: 1,
        banks: {},
      }),
    );
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({}));
    const broken = createClient({ dataBaseUrl: dir });
    await expect(broken.load()).rejects.toThrow(/version\.json/);
    await writeFile(
      path.join(dir, 'version.json'),
      JSON.stringify({
        tag: 'quiz-v2.0.0',
        version: '2.0.0',
        schemaVersion: 2,
        dataVersion: 1,
        sourceRepo: 'hpma-bits/hpma-quizbank',
        sourceUrl:
          'https://github.com/hpma-bits/hpma-quizbank/tree/quiz-v2.0.0',
        generatedAt: 'x',
      }),
    );
    const snap = await broken.load();
    expect(snap.banks).toEqual({});
    expect(snap.versionInfo.tag).toBe('quiz-v2.0.0');
  });
});
