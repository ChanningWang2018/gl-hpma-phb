// Tests for quizQuery.js — the pure URL <-> state helpers behind /quiz.
// The important guarantees: every malformed value collapses to a default
// (never to an impossible filter), the serializer only emits shareable state
// (no session/answers/results), and parse(serialize(x)) is stable.
import { describe, it, expect } from 'vitest';

import {
  CHALLENGE_BANKS,
  DEFAULT_CHALLENGE_SETUP,
  FILTER_BANKS,
  collectThemes,
  parseQuizQuery,
  resolveQuestion,
  sameQuery,
  serializeQuizQuery,
} from '../../src/services/quizQuery.js';

const DEFAULTS = {
  tab: 'bank',
  filters: { bank: 'all', theme: 'all', query: '' },
  challenge: { ...DEFAULT_CHALLENGE_SETUP },
  question: null,
  questionBank: null,
};

describe('parseQuizQuery defaults', () => {
  it('returns the default state for missing or non-object queries', () => {
    expect(parseQuizQuery({})).toEqual(DEFAULTS);
    expect(parseQuizQuery(undefined)).toEqual(DEFAULTS);
    expect(parseQuizQuery(null)).toEqual(DEFAULTS);
    expect(parseQuizQuery('not-a-query')).toEqual(DEFAULTS);
    expect(parseQuizQuery([])).toEqual(DEFAULTS);
  });

  it('keeps every lookup value a string or number, never an array/object', () => {
    const parsed = parseQuizQuery({
      tab: ['challenge', 'bank'],
      bank: ['muggle_studies', 'history_of_magic'],
      q: ['snape', 'potter'],
      question: ['42'],
    });
    expect(parsed.tab).toBe('challenge');
    expect(parsed.challenge.bank).toBe('muggle_studies');
    expect(parsed.question).toBe(42);
    expect(parsed.filters).toEqual({ bank: null, theme: 'all', query: '' });
  });
});

describe('parseQuizQuery bank tab', () => {
  it('parses valid tab, bank, theme, q and question values', () => {
    expect(
      parseQuizQuery({
        tab: 'bank',
        bank: 'muggle_studies',
        theme: 'ugc',
        q: 'snape',
        question: '101301103',
      }),
    ).toEqual({
      tab: 'bank',
      filters: { bank: 'muggle_studies', theme: 'ugc', query: 'snape' },
      challenge: { ...DEFAULT_CHALLENGE_SETUP },
      question: 101301103,
      questionBank: 'muggle_studies',
    });
  });

  it('accepts every known bank and rejects ?bank=mixed on the bank tab', () => {
    for (const bank of FILTER_BANKS) {
      expect(parseQuizQuery({ bank }).filters.bank).toBe(bank);
    }
    expect(parseQuizQuery({ bank: 'mixed' }).filters.bank).toBe('all');
    expect(parseQuizQuery({ bank: 'nope' }).filters.bank).toBe('all');
    expect(parseQuizQuery({ bank: 'ALL' }).filters.bank).toBe('all');
  });

  it('rejects an unknown ?theme= when knownThemes is supplied', () => {
    const knownThemes = new Set(['ugc', 'theme1']);
    expect(
      parseQuizQuery({ theme: 'ugc' }, { knownThemes }).filters.theme,
    ).toBe('ugc');
    expect(
      parseQuizQuery({ theme: 'stale' }, { knownThemes }).filters.theme,
    ).toBe('all');
    expect(
      parseQuizQuery({ theme: 'all' }, { knownThemes }).filters.theme,
    ).toBe('all');
    // Without data we cannot validate the value; keep a non-empty candidate.
    expect(parseQuizQuery({ theme: 'stale' }).filters.theme).toBe('stale');
  });

  it('falls back for malformed tab/question values', () => {
    expect(parseQuizQuery({ tab: 'nope' }).tab).toBe('bank');
    expect(parseQuizQuery({ tab: 'CHALLENGE' }).tab).toBe('bank');
    for (const question of [
      'abc',
      '-1',
      '0',
      '1.5',
      '',
      '12abc',
      '__proto__',
    ]) {
      expect(parseQuizQuery({ question }).question).toBe(null);
    }
    expect(parseQuizQuery({ question: 0 }).question).toBe(null);
    expect(parseQuizQuery({ question: Number.MAX_SAFE_INTEGER }).question).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
});

describe('parseQuizQuery challenge tab', () => {
  it('parses the shareable setup values', () => {
    expect(
      parseQuizQuery({
        tab: 'challenge',
        bank: 'mixed',
        draw: 'review',
        count: '50',
        mode: 'prefect',
      }),
    ).toEqual({
      tab: 'challenge',
      filters: { bank: null, theme: 'all', query: '' },
      challenge: {
        bank: 'mixed',
        draw: 'review',
        count: 50,
        mode: 'prefect',
      },
      question: null,
      questionBank: null,
    });
  });

  it('ignores bank-tab filters (?theme/?q) on the challenge tab', () => {
    const parsed = parseQuizQuery({
      tab: 'challenge',
      theme: 'ugc',
      q: 'snape',
    });
    expect(parsed.filters).toEqual({ bank: null, theme: 'all', query: '' });
  });

  it('falls back invalid setup values to the default setup', () => {
    const parsed = parseQuizQuery({
      tab: 'challenge',
      bank: 'all',
      draw: 'nope',
      count: '7',
      mode: 'nope',
    });
    expect(parsed.challenge).toEqual({ ...DEFAULT_CHALLENGE_SETUP });
  });

  it('validates count against the selected draw style count list', () => {
    // random default 10/25/50; review default 25/50/100
    expect(
      parseQuizQuery({ tab: 'challenge', draw: 'review', count: '10' })
        .challenge.count,
    ).toBe(25);
    expect(
      parseQuizQuery({ tab: 'challenge', draw: 'random', count: '100' })
        .challenge.count,
    ).toBe(10);
    expect(
      parseQuizQuery({ tab: 'challenge', draw: 'review', count: '100' })
        .challenge.count,
    ).toBe(100);
  });

  it('accepts every challenge bank', () => {
    for (const bank of CHALLENGE_BANKS) {
      expect(parseQuizQuery({ tab: 'challenge', bank }).challenge.bank).toBe(
        bank,
      );
    }
  });
});

describe('serializeQuizQuery', () => {
  it('keeps a clean /quiz URL for the default bank state', () => {
    expect(serializeQuizQuery({})).toEqual({});
    expect(
      serializeQuizQuery({
        tab: 'bank',
        filters: { bank: 'all', theme: 'all', query: '   ' },
        challenge: DEFAULT_CHALLENGE_SETUP,
        question: null,
      }),
    ).toEqual({});
  });

  it('writes only non-default bank-browser values', () => {
    expect(
      serializeQuizQuery({
        tab: 'bank',
        filters: { bank: 'muggle_studies', theme: 'ugc', query: ' snape ' },
      }),
    ).toEqual({
      bank: 'muggle_studies',
      theme: 'ugc',
      q: 'snape',
    });
    expect(
      serializeQuizQuery({ filters: { bank: 'all', query: 'snape' } }),
    ).toEqual({ q: 'snape' });
  });

  it('writes the full challenge setup so ?bank= is unambiguously a setup bank', () => {
    expect(serializeQuizQuery({ tab: 'challenge' })).toEqual({
      tab: 'challenge',
      bank: 'history_of_magic',
      draw: 'random',
      count: '10',
      mode: 'normal',
    });
    expect(
      serializeQuizQuery({
        tab: 'challenge',
        challenge: {
          bank: 'mixed',
          draw: 'review',
          count: 50,
          mode: 'prefect',
        },
      }),
    ).toEqual({
      tab: 'challenge',
      bank: 'mixed',
      draw: 'review',
      count: '50',
      mode: 'prefect',
    });
  });

  it('writes question permalinks with the owning bank and no tab key', () => {
    expect(
      serializeQuizQuery({
        tab: 'bank',
        filters: { bank: 'muggle_studies', theme: 'all', query: '' },
        question: { bank: 'muggle_studies', id: 42 },
      }),
    ).toEqual({ bank: 'muggle_studies', question: '42' });
    // A bare id resolves deterministically on its own.
    expect(serializeQuizQuery({ question: 42 })).toEqual({ question: '42' });
  });

  it('normalizes invalid serializer input instead of emitting it', () => {
    expect(
      serializeQuizQuery({
        tab: 'challenge',
        challenge: { bank: 'all', draw: 'nope', count: 7, mode: 'nope' },
      }),
    ).toEqual({
      tab: 'challenge',
      bank: 'history_of_magic',
      draw: 'random',
      count: '10',
      mode: 'normal',
    });
    expect(
      serializeQuizQuery({
        filters: { bank: 'mixed', theme: '', query: 12 },
      }),
    ).toEqual({});
  });

  it('round-trips representative URL states', () => {
    const queries = [
      {},
      { tab: 'bank', bank: 'muggle_studies', theme: 'ugc', q: 'snape' },
      { tab: 'bank', q: 'snape', question: '42' },
      {
        tab: 'bank',
        bank: 'muggle_studies',
        theme: 'theme1',
        q: 'snape',
        question: '42',
      },
      { tab: 'challenge' },
      {
        tab: 'challenge',
        bank: 'mixed',
        draw: 'review',
        count: '50',
        mode: 'prefect',
      },
      { tab: 'challenge', bank: 'muggle_studies' },
    ];
    for (const query of queries) {
      const parsed = parseQuizQuery(query);
      const serialized = serializeQuizQuery({
        tab: parsed.tab,
        filters: parsed.filters,
        challenge: parsed.challenge,
        question: parsed.question
          ? { bank: parsed.filters.bank, id: parsed.question }
          : null,
      });
      expect(parseQuizQuery(serialized)).toEqual(parsed);
    }
  });
});

describe('sameQuery', () => {
  it('compares keys and stringified values order-independently', () => {
    expect(
      sameQuery(
        { tab: 'challenge', count: '10' },
        { count: 10, tab: 'challenge' },
      ),
    ).toBe(true);
    expect(sameQuery({}, {})).toBe(true);
    expect(sameQuery({}, { q: '' })).toBe(false);
    expect(sameQuery({ q: 'a' }, { q: 'b' })).toBe(false);
    expect(sameQuery(null, {})).toBe(true);
  });
});

describe('collectThemes / resolveQuestion', () => {
  const banks = {
    history_of_magic: [
      { id: 1, theme: 'theme1' },
      { id: 2, theme: 'ugc' },
      { id: 3, theme: 'theme1' },
    ],
    muggle_studies: [
      { id: 2, theme: 'theme4' },
      { id: 4, theme: 'ugc' },
    ],
  };

  it('collects every distinct theme across both banks', () => {
    expect([...collectThemes(banks)].sort()).toEqual(
      ['theme1', 'theme4', 'ugc'].sort(),
    );
    expect(collectThemes(null).size).toBe(0);
    expect(collectThemes({ history_of_magic: [{}] }).size).toBe(0);
  });

  it('resolves a unique id and reports its owning bank', () => {
    expect(resolveQuestion(banks, 4)).toEqual({
      bank: 'muggle_studies',
      id: 4,
    });
    expect(resolveQuestion(banks, '1')).toEqual({
      bank: 'history_of_magic',
      id: 1,
    });
  });

  it('uses the bank hint to disambiguate ids that exist in both banks', () => {
    expect(resolveQuestion(banks, 2)).toEqual({
      bank: 'history_of_magic',
      id: 2,
    });
    expect(resolveQuestion(banks, 2, 'muggle_studies')).toEqual({
      bank: 'muggle_studies',
      id: 2,
    });
    // The hint falls back to the other bank when it does not own the id.
    expect(resolveQuestion(banks, 1, 'muggle_studies')).toEqual({
      bank: 'history_of_magic',
      id: 1,
    });
    // 'mixed' is not a hint, but the id still resolves in scan order.
    expect(resolveQuestion(banks, 4, 'mixed')).toEqual({
      bank: 'muggle_studies',
      id: 4,
    });
  });

  it('returns null for malformed or missing ids', () => {
    for (const id of [null, undefined, 0, -4, 'abc', 1.5, 99]) {
      expect(resolveQuestion(banks, id)).toBe(null);
    }
    expect(resolveQuestion(null, 1)).toBe(null);
  });
});
