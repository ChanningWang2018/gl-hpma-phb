import { gzipSync } from 'node:zlib';
import {
  SEARCH_INDEX_GZIP_LIMIT,
  SEARCH_INDEX_SCHEMA_VERSION,
  buildSearchIndex,
  stripRichText,
} from '../../scripts/build-search-index.mjs';

// The builder reads the real committed modules (like the quiz/spellbook tests
// do): the index must match the data that ships with the site.
const index = buildSearchIndex();
const byId = new Map(index.entries.map((entry) => [entry.id, entry]));

describe('buildSearchIndex', () => {
  it('emits one entry per card, deck echo and quiz question', () => {
    expect(index.version).toBe(SEARCH_INDEX_SCHEMA_VERSION);
    expect(index.counts).toEqual({
      cards: 141,
      echoes: 19,
      questions: 1847,
      total: 2007,
    });
    expect(index.entries).toHaveLength(2007);
    expect(new Set(index.entries.map((entry) => entry.id)).size).toBe(2007);
  });

  it('gives every entry the five search fields', () => {
    for (const entry of index.entries) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id).not.toBe('');
      expect(typeof entry.name).toBe('string');
      expect(entry.name.trim()).not.toBe('');
      expect(['card', 'echo', 'question']).toContain(entry.type);
      expect(Array.isArray(entry.aliases)).toBe(true);
      for (const alias of entry.aliases) {
        expect(typeof alias).toBe('string');
        expect(alias.trim()).not.toBe('');
      }
      expect(entry.url.startsWith('/')).toBe(true);
    }
  });

  it('indexes both languages and the canonical detail URLs', () => {
    expect(byId.get('card:1001')).toEqual({
      id: 'card:1001',
      type: 'card',
      name: 'Glacius',
      aliases: ['冰冻咒'],
      url: '/cards/1001',
    });
    expect(byId.get('echo:1001')).toMatchObject({
      type: 'echo',
      name: 'Hermione Granger',
      url: '/echoes/1001',
    });
    expect(byId.get('echo:1001').aliases).toContain('赫敏·格兰杰');
    expect(byId.get('question:history_of_magic:1').url).toBe(
      '/quiz?bank=history_of_magic&question=1',
    );
  });

  it('strips rich-text markup from every searchable string', () => {
    // Question 1 wraps 教科书 in <color=focus_light>…</color>.
    const question = byId.get('question:history_of_magic:1');
    expect(question.name).toContain('教科书');
    expect(question.name).not.toContain('<');
    expect(JSON.stringify(index)).not.toMatch(/<\/?color|<[a-z][^>]*>/i);
    expect(stripRichText('A <color=focus_light>Textbook</color> item')).toBe(
      'A Textbook item',
    );
  });

  it('keeps the gzip payload under the 150 KB budget', () => {
    const gzipBytes = gzipSync(JSON.stringify(index)).length;
    expect(gzipBytes).toBeLessThan(SEARCH_INDEX_GZIP_LIMIT);
    // A truncated/empty index would also be "under budget" — guard the floor.
    expect(gzipBytes).toBeGreaterThan(50 * 1024);
  });
});
