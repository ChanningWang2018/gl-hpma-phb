import {
  RESULT_LIMIT,
  SearchService,
  normalizeText,
  searchIndex,
  tokenizeQuery,
} from '@/services/searchService.js';
import { buildSearchIndex } from '../../scripts/build-search-index.mjs';

// Ranking is exercised against the real index (and therefore the data that
// ships), matching the acceptance examples: Hermione, Glacius, a quiz keyword.
const index = buildSearchIndex();

function groupOf(result, type) {
  return result.groups.find((group) => group.type === type);
}

describe('searchIndex', () => {
  it('returns cards and echoes for "Hermione"', () => {
    const result = searchIndex(index, 'Hermione');
    expect(result.tokens).toEqual(['hermione']);
    expect(result.groups.map((group) => group.type)).toEqual([
      'card',
      'echo',
      'question',
    ]);

    const cards = groupOf(result, 'card');
    expect(cards.results.some((row) => row.name === 'Hermione Granger')).toBe(
      true,
    );
    expect(groupOf(result, 'echo').results[0]).toMatchObject({
      name: 'Hermione Granger',
      url: '/echoes/1001',
    });
  });

  it('returns Chinese cards and echoes through aliases', () => {
    const result = searchIndex(index, '赫敏');
    expect(result.total).toBeGreaterThan(0);
    expect(groupOf(result, 'card')).toBeTruthy();
    expect(groupOf(result, 'echo').results[0].url).toBe('/echoes/1001');
  });

  it('ranks the exact card name above a longer variant', () => {
    const result = searchIndex(index, 'Glacius');
    const cards = groupOf(result, 'card');
    expect(cards.results[0]).toMatchObject({
      name: 'Glacius',
      url: '/cards/1001',
    });
    expect(cards.results[1].name).toBe('Glacius Maxima');
  });

  it('finds quiz questions by a keyword in the stem', () => {
    const result = searchIndex(index, '霍格沃茨');
    const questions = groupOf(result, 'question');
    expect(questions.results.length).toBeGreaterThan(0);
    expect(questions.results[0]).toMatchObject({
      type: 'question',
      url: expect.stringMatching(/^\/quiz\?bank=[^&]+&question=\d+$/),
    });
  });

  it('requires every token to match and does not hit word middles', () => {
    expect(searchIndex(index, 'glacius maxima').total).toBe(1);
    // "ron" must not match "Hermione" through the middle of the word.
    const cards = groupOf(searchIndex(index, 'ron'), 'card');
    expect(cards.results.map((row) => row.name)).toEqual(['Ron Weasley']);
  });

  it('caps results per group while keeping the full match count', () => {
    const result = searchIndex(index, 'a', { limit: 2 });
    expect(result.groups.length).toBeGreaterThan(0);
    for (const group of result.groups) {
      expect(group.results.length).toBeLessThanOrEqual(2);
      expect(group.total).toBeGreaterThanOrEqual(group.results.length);
    }
    expect(result.groups.some((group) => group.total > 2)).toBe(true);
    expect(RESULT_LIMIT).toBe(6);
  });

  it('returns no groups for an empty query', () => {
    expect(searchIndex(index, '   ')).toMatchObject({
      query: '',
      tokens: [],
      total: 0,
      groups: [],
    });
    expect(searchIndex({ entries: [] }, 'hermione').groups).toEqual([]);
  });
});

describe('search text helpers', () => {
  it('normalizes case, accents and apostrophes', () => {
    expect(normalizeText('  Luna’s  ')).toBe('lunas');
    expect(normalizeText('HERMIONE')).toBe('hermione');
  });

  it('tokenizes and de-duplicates punctuation-wrapped words', () => {
    expect(tokenizeQuery(' Hermione,  GRANGER ')).toEqual([
      'hermione',
      'granger',
    ]);
    expect(tokenizeQuery('赫敏、')).toEqual(['赫敏']);
    expect(tokenizeQuery('   ')).toEqual([]);
  });
});

describe('SearchService.loadIndex', () => {
  afterEach(() => {
    SearchService.reset();
  });

  it('fetches the index only once and reuses it', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => index,
    }));

    const first = await SearchService.loadIndex({ fetchImpl });
    const second = await SearchService.loadIndex({ fetchImpl });

    expect(first).toBe(index);
    expect(second).toBe(index);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('/search-index.json');
    expect(SearchService.loaded).toBe(true);
    expect(SearchService.search('Glacius').groups[0].results[0].url).toBe(
      '/cards/1001',
    );
  });

  it('shares one request between concurrent calls', async () => {
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true, json: async () => index }), 0);
        }),
    );

    const [first, second] = await Promise.all([
      SearchService.loadIndex({ fetchImpl }),
      SearchService.loadIndex({ fetchImpl }),
    ]);

    expect(first).toBe(index);
    expect(second).toBe(index);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('clears the failed request so a later open can retry', async () => {
    const failing = vi.fn(async () => ({ ok: false, status: 503 }));
    await expect(
      SearchService.loadIndex({ fetchImpl: failing }),
    ).rejects.toThrow('HTTP 503');
    expect(SearchService.index).toBeNull();
    expect(SearchService.loaded).toBe(false);

    const working = vi.fn(async () => ({
      ok: true,
      json: async () => index,
    }));
    await SearchService.loadIndex({ fetchImpl: working });
    expect(SearchService.loaded).toBe(true);
  });

  it('rejects a malformed or version-mismatched payload', async () => {
    await expect(
      SearchService.loadIndex({
        fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
      }),
    ).rejects.toThrow(/malformed/);

    await expect(
      SearchService.loadIndex({
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ version: 99, entries: [] }),
        }),
      }),
    ).rejects.toThrow(/schema version 99/);
  });
});
