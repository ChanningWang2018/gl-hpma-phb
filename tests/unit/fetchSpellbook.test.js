// Tests for scripts/fetch-spellbook.mjs pure helpers only — the network
// code paths (GitHub API / raw downloads) are intentionally not tested.
// The checksums fixture mirrors the real upstream file format
// (E:\Scripts\hpma-data\spellbook\checksums.txt, sha256sum binary mode:
// "<64-hex> *<path>", paths relative to the spellbook/ directory).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  EXPECTED_SCHEMA_VERSION,
  matchSpellbookTag,
  compareVersions,
  diffCardIds,
  formatCardDiffList,
  parseChecksums,
  checksumFor,
  buildVersionJson,
  swapTagInImageBase,
  syncNetlifyRedirectTag,
  validateCardsPayload,
} from '../../scripts/fetch-spellbook.mjs';

describe('matchSpellbookTag', () => {
  it('extracts the version from a conforming tag', () => {
    expect(matchSpellbookTag('spellbook-v1.1.0')).toBe('1.1.0');
    expect(matchSpellbookTag('spellbook-v10.20.30')).toBe('10.20.30');
    expect(matchSpellbookTag('spellbook-v0.0.1')).toBe('0.0.1');
  });

  it('rejects tags outside the spellbook-vX.Y.Z contract', () => {
    expect(matchSpellbookTag('v1.1.0')).toBe(null);
    expect(matchSpellbookTag('spellbook-v1.1')).toBe(null);
    expect(matchSpellbookTag('spellbook-v1.1.0-rc1')).toBe(null);
    expect(matchSpellbookTag('spellbook-V1.1.0')).toBe(null);
    expect(matchSpellbookTag('')).toBe(null);
    expect(matchSpellbookTag(null)).toBe(null);
    expect(matchSpellbookTag(undefined)).toBe(null);
    expect(matchSpellbookTag(42)).toBe(null);
  });
});

describe('compareVersions', () => {
  it('orders versions numerically', () => {
    expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
    expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
  });

  it('compares components numerically, not lexicographically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.1.10', '1.1.2')).toBe(1);
  });

  it('treats missing components as zero', () => {
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
    expect(compareVersions('1.1.0', '1.1')).toBe(0);
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
  });
});

describe('swapTagInImageBase', () => {
  it('rewrites the @spellbook-vX.Y.Z marker to the new tag', () => {
    expect(
      swapTagInImageBase(
        'https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@spellbook-v1.1.0/spellbook/',
        'spellbook-v1.2.0',
      ),
    ).toBe(
      'https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@spellbook-v1.2.0/spellbook/',
    );
  });

  it('keeps marker-less bases (e.g. pinned proxy paths) untouched', () => {
    expect(swapTagInImageBase('/cardimg/', 'spellbook-v1.2.0')).toBe(
      '/cardimg/',
    );
  });

  it('falls back to the default jsDelivr template when empty', () => {
    expect(swapTagInImageBase('', 'spellbook-v1.2.0')).toBe(
      'https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@spellbook-v1.2.0/spellbook/',
    );
    expect(swapTagInImageBase(null, 'spellbook-v1.2.0')).toBe(
      'https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@spellbook-v1.2.0/spellbook/',
    );
  });
});

describe('diffCardIds', () => {
  const card = (id, name) => ({
    id,
    i18n: { zh: { name: name || `卡${id}` } },
  });

  it('reports added and removed ids with zh display names', () => {
    const diff = diffCardIds(
      [card(1001, '冰冻咒'), card(1002, '石礅出动')],
      [card(1002, '石礅出动'), card(1003, '飓风咒')],
    );
    expect(diff.added).toEqual([{ id: 1003, name: '飓风咒' }]);
    expect(diff.removed).toEqual([{ id: 1001, name: '冰冻咒' }]);
  });

  it('falls back to the en name and then the raw id', () => {
    const enOnly = { id: 7, i18n: { en: { name: 'Baubles' } } };
    const noI18n = { id: 8 };
    const diff = diffCardIds([enOnly, noI18n], []);
    expect(diff.removed).toEqual([
      { id: 7, name: 'Baubles' },
      { id: 8, name: '8' },
    ]);
  });

  it('returns empty lists when nothing changed and tolerates null inputs', () => {
    const cards = [card(1), card(2)];
    expect(diffCardIds(cards, [card(2), card(1)])).toEqual({
      added: [],
      removed: [],
    });
    expect(diffCardIds(null, cards).added).toHaveLength(2);
    expect(diffCardIds(cards, null).removed).toHaveLength(2);
  });
});

describe('formatCardDiffList', () => {
  it('joins id:name pairs and truncates beyond the limit', () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `卡${i + 1}`,
    }));
    const text = formatCardDiffList(entries, 3);
    expect(text).toBe('1:卡1, 2:卡2, 3:卡3 ...等 20 张');
    expect(formatCardDiffList(entries.slice(0, 2), 3)).toBe('1:卡1, 2:卡2');
    expect(formatCardDiffList([], 3)).toBe('（无）');
  });
});

describe('parseChecksums / checksumFor', () => {
  // First three lines copied verbatim from the real upstream
  // E:\Scripts\hpma-data\spellbook\checksums.txt (spellbook-v1.1.0).
  const REAL_FORMAT_LINES = [
    '48fe5a43ae8ee647f7c9ffdad4f727317eb9702014dffbb92f9b64b5c7853a8b *README.md',
    '0318270f6bda79ea3a875518ad772230bebb0f0d20ebe8439d81ca4635bbeb56 *cards.json',
    '20439308f2bf4a3cbf0b2d5d8efc7c6e5b977f6e5972a0dab457c6a90fc63ff2 *images/1001.png',
  ].join('\n');

  it('parses the real sha256sum binary-mode format', () => {
    const checksums = parseChecksums(REAL_FORMAT_LINES);
    expect(checksums.get('cards.json')).toBe(
      '0318270f6bda79ea3a875518ad772230bebb0f0d20ebe8439d81ca4635bbeb56',
    );
    expect(checksums.get('images/1001.png')).toBe(
      '20439308f2bf4a3cbf0b2d5d8efc7c6e5b977f6e5972a0dab457c6a90fc63ff2',
    );
    expect(checksums.get('README.md')).toBe(
      '48fe5a43ae8ee647f7c9ffdad4f727317eb9702014dffbb92f9b64b5c7853a8b',
    );
    expect(checksums.size).toBe(3);
  });

  it('checksumFor tolerates a redundant spellbook/ prefix on lookup', () => {
    const checksums = parseChecksums(REAL_FORMAT_LINES);
    expect(checksumFor(checksums, 'spellbook/cards.json')).toBe(
      '0318270f6bda79ea3a875518ad772230bebb0f0d20ebe8439d81ca4635bbeb56',
    );
    expect(checksumFor(checksums, 'cards.json')).not.toBe(null);
    expect(checksumFor(checksums, 'nope.json')).toBe(null);
  });

  it('parses repo-root style lines with a spellbook/ prefix on the path', () => {
    const hashA = 'a'.repeat(64);
    const hashB = 'b'.repeat(64);
    const checksums = parseChecksums(
      `${hashA} *spellbook/cards.json\n${hashB} *spellbook/images/9.png`,
    );
    expect(checksums.get('cards.json')).toBe(hashA);
    expect(checksums.get('images/9.png')).toBe(hashB);
  });

  it('tolerates CRLF, blank and comment lines', () => {
    const checksums = parseChecksums(
      `# comment\r\n\r\n${REAL_FORMAT_LINES.replace(/\n/g, '\r\n')}\n`,
    );
    expect(checksums.size).toBe(3);
  });

  it('parses text-mode entries (two spaces, no asterisk)', () => {
    const checksums = parseChecksums(
      '0318270f6bda79ea3a875518ad772230bebb0f0d20ebe8439d81ca4635bbeb56  cards.json',
    );
    expect(checksums.get('cards.json')).toBe(
      '0318270f6bda79ea3a875518ad772230bebb0f0d20ebe8439d81ca4635bbeb56',
    );
  });

  it('lowercases hex and fails loudly on malformed lines', () => {
    const checksums = parseChecksums(
      '0318270F6BDA79EA3A875518AD772230BEBB0F0D20EBE8439D81CA4635BBEB56 *cards.json',
    );
    expect(checksums.get('cards.json')).toBe(
      '0318270f6bda79ea3a875518ad772230bebb0f0d20ebe8439d81ca4635bbeb56',
    );
    expect(() => parseChecksums('not-a-hash *cards.json')).toThrow(/第 1 行/);
    expect(() =>
      parseChecksums(
        '0318270f6bda79ea3a875518ad772230bebb0f0d20ebe8439d81ca4635bbeb5 *cards.json',
      ),
    ).toThrow(/第 1 行/);
  });
});

describe('validateCardsPayload', () => {
  it('accepts a consumable payload at the expected schema version', () => {
    expect(
      validateCardsPayload({
        schema_version: EXPECTED_SCHEMA_VERSION,
        cards: [{ id: 1001 }],
      }),
    ).toBe(null);
  });

  it('rejects a newer schema with the consumer-upgrade message', () => {
    const newer = EXPECTED_SCHEMA_VERSION + 1;
    const message = validateCardsPayload({
      schema_version: newer,
      cards: [{}],
    });
    expect(message).toContain(`schema_version=${newer}`);
    expect(message).toContain('spellbookClient 需升级');
    expect(message).toContain(
      `EXPECTED_SCHEMA_VERSION=${EXPECTED_SCHEMA_VERSION}`,
    );
    expect(message).toContain('拒绝入库');
  });

  it('rejects missing/other schema versions and empty card arrays', () => {
    expect(validateCardsPayload({ cards: [{}] })).toContain('缺失');
    expect(validateCardsPayload({ schema_version: 99, cards: [{}] })).toContain(
      'schema_version=99',
    );
    expect(
      validateCardsPayload({
        schema_version: EXPECTED_SCHEMA_VERSION,
        cards: [],
      }),
    ).toContain('cards 数组为空');
    expect(validateCardsPayload(null)).toContain('不是 JSON 对象');
    expect(validateCardsPayload([1, 2])).toContain('不是 JSON 对象');
  });
});

describe('syncNetlifyRedirectTag', () => {
  const tomlWith = (tag) =>
    [
      '[[redirects]]',
      '  from = "/cardimg/*"',
      `  to = "https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@${tag}/spellbook/:splat"`,
      '  status = 200',
      '  force = true',
      '',
    ].join('\n');

  it('bumps the /cardimg/ proxy tag in lockstep with the release', () => {
    const result = syncNetlifyRedirectTag(
      tomlWith('spellbook-v1.1.0'),
      'spellbook-v2.20261001.0',
    );
    expect(result.changed).toBe(true);
    expect(result.text).toContain(
      'hpma-data@spellbook-v2.20261001.0/spellbook/:splat',
    );
    // Only the tag changes; the redirect shape stays intact.
    expect(result.text).toContain('from = "/cardimg/*"');
  });

  it('leaves files without a hpma-data@tag proxy line untouched', () => {
    const text = '[[redirects]]\n  from = "/*"\n  to = "/index.html"\n';
    const result = syncNetlifyRedirectTag(text, 'spellbook-v9.9.9');
    expect(result.changed).toBe(false);
    expect(result.text).toBe(text);
  });
});

describe('buildVersionJson', () => {
  const manifest = {
    schema_version: 1,
    data_version: 1,
    generated_at: '2026-10-01T00:43:59+08:00',
  };
  const previousImageBase =
    'https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@spellbook-v1.1.0/spellbook/';

  it('assembles the version.json contract from tag + manifest', () => {
    const info = buildVersionJson({
      tag: 'spellbook-v1.2.0',
      manifest: { ...manifest, schema_version: 1, data_version: 2 },
      previousImageBase,
    });
    expect(info).toEqual({
      tag: 'spellbook-v1.2.0',
      version: '1.2.0',
      schemaVersion: 1,
      dataVersion: 2,
      imageBase:
        'https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@spellbook-v1.2.0/spellbook/',
      imagesWebp: null,
      generatedAt: '2026-10-01T00:43:59+08:00',
    });
    // Key order matches the T1-committed file shape.
    expect(Object.keys(info)).toEqual([
      'tag',
      'version',
      'schemaVersion',
      'dataVersion',
      'imageBase',
      'imagesWebp',
      'generatedAt',
    ]);
  });

  it('mirrors manifest.webp_images into imagesWebp (WebP copy-set capability)', () => {
    const info = buildVersionJson({
      tag: 'spellbook-v5.20261004.0',
      manifest: {
        ...manifest,
        schema_version: 5,
        data_version: 20261004,
        webp_images: 'images_webp/',
      },
      previousImageBase,
    });
    expect(info.imagesWebp).toBe('images_webp/');
    // Absent / empty / non-string -> null (consumer loads PNG directly).
    expect(
      buildVersionJson({
        tag: 'spellbook-v5.20261004.0',
        manifest: { ...manifest, webp_images: '' },
        previousImageBase,
      }).imagesWebp,
    ).toBe(null);
    expect(
      buildVersionJson({
        tag: 'spellbook-v5.20261004.0',
        manifest: { ...manifest, webp_images: 42 },
        previousImageBase,
      }).imagesWebp,
    ).toBe(null);
  });

  it('serializes byte for byte to the committed version.json (real data)', () => {
    const committed = readFileSync(
      'public/data/spellbook/version.json',
      'utf8',
    );
    const committedInfo = JSON.parse(committed);
    const realManifest = JSON.parse(
      readFileSync('public/data/spellbook/manifest.json', 'utf8'),
    );
    const rebuilt = buildVersionJson({
      tag: committedInfo.tag,
      manifest: realManifest,
      previousImageBase: committedInfo.imageBase,
    });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
