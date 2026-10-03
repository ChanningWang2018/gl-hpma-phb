// Tests for spellbookClient.js — ported from the reference consumer suite
// (E:\Scripts\hpma-cards-consumer\test\loader.test.mjs) plus integration
// assertions against the real committed data (vitest cwd = repo root).
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  EXPECTED_SCHEMA_VERSION,
  createClient,
  joinUrl,
  normalizeBaseUrl,
  lookupLabel,
  lookupText,
  readImageBaseOverride,
} from '../../src/services/spellbookClient.js';

const DATA_BASE = 'public/data/spellbook/';

// One shared client against the real data; individual tests create their own
// when they need different options.
const client = createClient({ dataBaseUrl: DATA_BASE });

afterEach(() => {
  // Tests that simulate a browser clean up after themselves; this is a net.
  delete globalThis.location;
});

describe('pure helpers', () => {
  it('normalizeBaseUrl trims and keeps exactly one trailing slash', () => {
    expect(normalizeBaseUrl('https://cdn.example.com/d')).toBe(
      'https://cdn.example.com/d/',
    );
    expect(normalizeBaseUrl('  ../data/// ')).toBe('../data/');
    expect(normalizeBaseUrl('/')).toBe('/');
  });

  it('joinUrl avoids double slashes', () => {
    expect(joinUrl('public/data/spellbook/', 'cards.json')).toBe(
      'public/data/spellbook/cards.json',
    );
    expect(joinUrl('https://cdn/x', '/cards.json')).toBe(
      'https://cdn/x/cards.json',
    );
  });

  it('readImageBaseOverride reads the ?img= param from location or an explicit string', () => {
    expect(readImageBaseOverride('?img=https://cdn.example.com/pkg/')).toBe(
      'https://cdn.example.com/pkg/',
    );
    expect(readImageBaseOverride('')).toBe('');
    expect(readImageBaseOverride('?other=1')).toBe('');
    // No location in node, no explicit search -> ''.
    expect(readImageBaseOverride()).toBe('');
    globalThis.location = new URL(
      'https://demo.test/?img=https://q.example/base',
    );
    expect(readImageBaseOverride()).toBe('https://q.example/base');
  });

  it('lookupLabel resolves display names with zh default and code fallback', () => {
    expect(
      lookupLabel({ rarity: { epic: { en: 'Epic' } } }, 'rarity', 'epic', 'en'),
    ).toBe('Epic');
    expect(lookupLabel({}, 'rarity', 'bogus', 'en')).toBe('bogus');
  });

  it('lookupText falls back from en to zh (data is CN-first)', () => {
    expect(
      lookupText(
        { i18n: { zh: { name: '冰冻咒' }, en: { name: null } } },
        'en',
        'name',
      ),
    ).toBe('冰冻咒');
    expect(lookupText({ i18n: { zh: { name: '冰冻咒' } } }, 'en', 'name')).toBe(
      '冰冻咒',
    );
    expect(lookupText({ i18n: { zh: {} } }, 'en', 'no_such_field')).toBe(null);
  });
});

describe('createClient (real committed data)', () => {
  it('defaults the data base to /data/spellbook/', () => {
    expect(createClient().dataBaseUrl).toBe('/data/spellbook/');
    expect(createClient({ dataBaseUrl: 'public/data' }).dataBaseUrl).toBe(
      'public/data/',
    );
  });

  it('load() fetches and caches all three documents', async () => {
    const snap = await client.load();
    expect(snap.schemaVersion).toBe(EXPECTED_SCHEMA_VERSION);
    expect(snap.dataVersion).toBeGreaterThanOrEqual(1);
    expect(snap.cards).toHaveLength(141);
    expect(snap.manifest && typeof snap.manifest === 'object').toBe(true);
    expect(snap.versionInfo.tag).toMatch(/^spellbook-v\d+\.\d+\.\d+$/);
    // Second call is served from cache (same array identity).
    const again = await client.load();
    expect(again.cards).toBe(snap.cards);
  });

  it('exposes 141 unique cards, manifest and versionInfo', () => {
    expect(client.cards).toHaveLength(141);
    expect(new Set(client.cards.map((c) => c.id)).size).toBe(141);
    expect(typeof client.manifest).toBe('object');
    // versionInfo must mirror the committed version.json verbatim
    // (derived assertion survives upstream data bumps without test edits).
    const committedVersion = JSON.parse(
      readFileSync('public/data/spellbook/version.json', 'utf8'),
    );
    expect(client.versionInfo).toEqual(committedVersion);
  });

  it('byType partitions the full set 65/52/24 and tolerates unknown codes', () => {
    expect(client.byType('spell')).toHaveLength(65);
    expect(client.byType('summon')).toHaveLength(52);
    expect(client.byType('companion')).toHaveLength(24);
    expect(client.byType('spell').every((c) => c.type === 'spell')).toBe(true);
    expect(client.byType('nonexistent')).toEqual([]);
    expect(client.byRarity('nonexistent')).toEqual([]);
  });

  it('byId(1001) is 冰冻咒 / Glacius and coerces string ids', () => {
    const card = client.byId(1001);
    expect(card).toBeDefined();
    expect(card.i18n.zh.name).toBe('冰冻咒');
    expect(card.img).toBe('images/1001.png');
    expect(client.byId('1001').id).toBe(1001);
    expect(client.byId(999999)).toBeUndefined();
  });

  it('label() resolves display names with zh default', () => {
    expect(client.label('type', 'spell')).toBe('咒语卡');
    expect(client.label('type', 'spell', 'en')).toBe('Spell');
    expect(client.label('rarity', 'legendary', 'zh')).toBe('传说');
    expect(client.label('rarity', 'legendary', 'en')).toBe('Legendary');
    expect(client.label('rarity', 'mythic', 'en')).toBe('Mythic');
    expect(client.label('type', 'bogus', 'en')).toBe('bogus');
  });

  it('text() falls back from en to zh when the en value is missing', () => {
    const card = client.byId(1001);
    // v3 补全了 en desc/quote/stats：存在即返回 en，不回退。
    expect(client.text(card, 'en', 'desc')).toBe(card.i18n.en.desc);
    expect(client.text(card, 'zh', 'name')).toBe('冰冻咒');
    expect(client.text(card, 'en', 'name')).toBe('Glacius'); // present -> no fallback
    expect(client.text(card, 'en', 'stats')).toBe(card.i18n.en.stats);

    // 1108 的 en name 在 v3 也已补全（Prior Incantato），直接命中不回退。
    const card1108 = client.byId(1108);
    expect(client.text(card1108, 'en', 'name')).toBe('Prior Incantato');

    // Fallback only kicks in when neither locale has the field.
    expect(client.text(card, 'en', 'no_such_field')).toBe(null);
  });

  it('imageUrl() resolves live with priority explicit option > ?img= > version.json', () => {
    // The default base comes from the committed version.json (bump-proof).
    const jsDelivrBase = client.versionInfo.imageBase;

    // 3rd priority: loaded version.json imageBase.
    expect(client.imageUrl(1001)).toBe(`${jsDelivrBase}images/1001.png`);
    const card = client.byId(1001);
    expect(client.imageUrl(card)).toBe(`${jsDelivrBase}${card.img}`);

    // 1st priority: explicit imageBaseUrl option wins over everything.
    const pinned = createClient({
      dataBaseUrl: DATA_BASE,
      imageBaseUrl: 'https://cdn.example.com/pkg',
    });
    expect(pinned.imageUrl(1001)).toBe(
      'https://cdn.example.com/pkg/images/1001.png',
    );

    // 2nd priority: ?img= query param beats version.json but loses to the option.
    globalThis.location = new URL(
      'https://demo.test/?img=https://query.example/base/',
    );
    expect(client.imageUrl(1001)).toBe(
      'https://query.example/base/images/1001.png',
    );
    expect(pinned.imageUrl(1001)).toBe(
      'https://cdn.example.com/pkg/images/1001.png',
    );

    // Empty ?img= is ignored (falls through to version.json).
    globalThis.location = new URL('https://demo.test/?img=');
    expect(client.imageUrl(1001)).toBe(`${jsDelivrBase}images/1001.png`);
  });

  it('imageUrl() throws before load() when no base is available', () => {
    const fresh = createClient({ dataBaseUrl: DATA_BASE });
    expect(() => fresh.imageUrl(1001)).toThrow(/load\(\)/);
    // Explicit option makes it work even before load().
    expect(
      createClient({ imageBaseUrl: 'https://x.example/' }).imageUrl(1001),
    ).toBe('https://x.example/images/1001.png');
  });

  it('frames exposes the schema-5 frame table of the real data', () => {
    const frames = client.frames;
    expect(Object.keys(frames).sort()).toEqual([
      'common',
      'dark',
      'epic',
      'legendary',
      'mythic',
      'rare',
    ]);
    for (const meta of Object.values(frames)) {
      expect(meta.file).toMatch(/^frame_[a-z]+\.png$/);
      expect(meta.size).toHaveLength(2);
      expect(meta.inner).toHaveLength(4);
    }
    // every rarity that appears on a real card has a frame entry
    for (const card of client.cards) {
      expect(frames[card.rarity]).toBeDefined();
    }
  });

  it('frameUrl() resolves live with the same base priority as imageUrl()', async () => {
    const jsDelivrBase = client.versionInfo.imageBase;
    const file = client.frames.legendary.file;

    // 3rd priority: loaded version.json imageBase + frames/<file>.
    expect(client.frameUrl('legendary')).toBe(`${jsDelivrBase}frames/${file}`);

    // 1st priority: explicit imageBaseUrl option wins over everything.
    // (frameUrl needs the loaded frames table for the file name, unlike
    // imageUrl which can resolve a bare id against an explicit base alone.)
    const pinned = createClient({
      dataBaseUrl: DATA_BASE,
      imageBaseUrl: 'https://cdn.example.com/pkg',
    });
    await pinned.load();
    expect(pinned.frameUrl('legendary')).toBe(
      `https://cdn.example.com/pkg/frames/${file}`,
    );

    // 2nd priority: ?img= query param beats version.json but loses to the option.
    globalThis.location = new URL(
      'https://demo.test/?img=https://query.example/base/',
    );
    expect(client.frameUrl('legendary')).toBe(
      `https://query.example/base/frames/${file}`,
    );
    expect(pinned.frameUrl('legendary')).toBe(
      `https://cdn.example.com/pkg/frames/${file}`,
    );

    // Empty ?img= is ignored (falls through to version.json).
    globalThis.location = new URL('https://demo.test/?img=');
    expect(client.frameUrl('legendary')).toBe(`${jsDelivrBase}frames/${file}`);
  });

  it('frameUrl() returns null instead of throwing on every unresolvable case', async () => {
    // Before load(): no frames, no base — decorative, so null (not a throw).
    const fresh = createClient({ dataBaseUrl: DATA_BASE });
    expect(fresh.frameUrl('legendary')).toBe(null);
    // After load(): unknown rarity code.
    expect(client.frameUrl('nonexistent')).toBe(null);

    // Loaded data without an image base (version.json has no imageBase).
    const dir = await mkdtemp(path.join(tmpdir(), 'hpma-frame-nobase-'));
    await writeFile(
      path.join(dir, 'cards.json'),
      JSON.stringify({
        schema_version: EXPECTED_SCHEMA_VERSION,
        data_version: 1,
        labels: {},
        frames: {
          legendary: {
            file: 'frame_legendary.png',
            size: [208, 272],
            inner: [21, 24, 168, 232],
          },
        },
        cards: [],
      }),
    );
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({}));
    await writeFile(
      path.join(dir, 'version.json'),
      JSON.stringify({ tag: 'spellbook-v1.0.0', imageBase: '' }),
    );
    const noBase = createClient({ dataBaseUrl: dir });
    await noBase.load();
    expect(noBase.frameUrl('legendary')).toBe(null);
  });

  it('throws a helpful error when accessing data before load()', () => {
    const fresh = createClient({ dataBaseUrl: DATA_BASE });
    expect(() => fresh.cards).toThrow(/load\(\)/);
    expect(() => fresh.byId(1)).toThrow(/load\(\)/);
    expect(() => fresh.versionInfo).toThrow(/load\(\)/);
    expect(() => fresh.labels).toThrow(/load\(\)/);
  });

  it('load() rejects with a friendly upgrade error on schema_version mismatch', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hpma-bad-data-'));
    await writeFile(
      path.join(dir, 'cards.json'),
      JSON.stringify({
        schema_version: 99,
        data_version: 1,
        generated_at: 'x',
        labels: {},
        cards: [],
      }),
    );
    await writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ schema_version: 99 }),
    );
    await writeFile(
      path.join(dir, 'version.json'),
      JSON.stringify({ tag: 'spellbook-v99.0.0', imageBase: '' }),
    );

    const bad = createClient({ dataBaseUrl: dir });
    await expect(bad.load()).rejects.toThrow(/schema_version/);
    await expect(bad.load()).rejects.toThrow(/99/);
    await expect(bad.load()).rejects.toThrow(/升级消费端/);
  });

  it('can retry load() after a failure (missing file -> then fixed)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hpma-retry-data-'));
    await writeFile(
      path.join(dir, 'cards.json'),
      JSON.stringify({
        schema_version: EXPECTED_SCHEMA_VERSION,
        data_version: 1,
        labels: {},
        cards: [],
      }),
    );
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({}));
    const broken = createClient({ dataBaseUrl: dir });
    await expect(broken.load()).rejects.toThrow(/version\.json/);
    await writeFile(
      path.join(dir, 'version.json'),
      JSON.stringify({ tag: 'spellbook-v1.0.0', imageBase: '' }),
    );
    const snap = await broken.load();
    expect(snap.cards).toHaveLength(0);
    expect(snap.versionInfo.tag).toBe('spellbook-v1.0.0');
  });
});
