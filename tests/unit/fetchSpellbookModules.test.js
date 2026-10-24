import { describe, expect, it } from 'vitest';
import {
  buildVersionJson,
  moduleVersion,
  parseChecksums,
  syncNetlifyTags,
} from '../../scripts/fetch-spellbook-modules.mjs';

const CARDS_MANIFEST = {
  schema_version: 1,
  data_version: '20261024',
  dataset: 'cards',
  webp_images: 'images_webp/',
  generated_at: '2026-10-24T10:28:55+08:00',
};

const ECHOES_MANIFEST = {
  schema_version: 1,
  data_version: '20261024',
  dataset: 'echoes',
  webp_images: 'images_webp/',
  generated_at: '2026-10-24T10:30:07+08:00',
};

describe('moduleVersion', () => {
  it('extracts cards/echoes module versions', () => {
    expect(moduleVersion('cards-v1.20261024.0', 'cards-v')).toBe(
      '1.20261024.0',
    );
    expect(moduleVersion('echoes-v1.20261024.0', 'echoes-v')).toBe(
      '1.20261024.0',
    );
  });

  it('rejects the wrong module prefix and malformed tags', () => {
    expect(moduleVersion('spellbook-v1.2.0', 'cards-v')).toBe(null);
    expect(moduleVersion('cards-v1.2', 'cards-v')).toBe(null);
    expect(moduleVersion(null, 'cards-v')).toBe(null);
  });
});

describe('parseChecksums', () => {
  it('parses binary/text lines and strips the module prefix', () => {
    const map = parseChecksums(
      [
        `${'a'.repeat(64)} *cards.json`,
        `${'b'.repeat(64)}  cards/manifest.json`,
        `${'c'.repeat(64)} *./images/1001.png`,
        '',
        '# comment',
      ].join('\r\n'),
      'cards',
    );
    expect(map.get('cards.json')).toBe('a'.repeat(64));
    expect(map.get('manifest.json')).toBe('b'.repeat(64));
    expect(map.get('images/1001.png')).toBe('c'.repeat(64));
  });

  it('fails loudly on malformed lines', () => {
    expect(() => parseChecksums('not-a-checksum')).toThrow(/unparseable/);
  });
});

describe('buildVersionJson', () => {
  it('builds the cards contract with a raw imageBase', () => {
    const version = buildVersionJson({
      tag: 'cards-v1.20261024.0',
      manifest: CARDS_MANIFEST,
      repo: 'hpma-bits/hpma-spellbook',
      module: { dir: 'cards' },
      prefix: 'cards-v',
    });
    expect(version).toEqual({
      tag: 'cards-v1.20261024.0',
      version: '1.20261024.0',
      schemaVersion: 1,
      dataVersion: 20261024,
      imageBase:
        'https://raw.githubusercontent.com/hpma-bits/hpma-spellbook/cards-v1.20261024.0/cards/',
      imagesWebp: 'images_webp/',
      generatedAt: '2026-10-24T10:28:55+08:00',
    });
  });

  it('builds the echoes contract and drops a missing WebP capability', () => {
    const version = buildVersionJson({
      tag: 'echoes-v1.20261024.0',
      manifest: { ...ECHOES_MANIFEST, webp_images: null },
      repo: 'hpma-bits/hpma-spellbook',
      module: { dir: 'echoes' },
      prefix: 'echoes-v',
    });
    expect(version.imageBase).toContain('/echoes-v1.20261024.0/echoes/');
    expect(version.imagesWebp).toBe(null);
  });
});

describe('syncNetlifyTags', () => {
  it('rewrites both module proxy tags in place', () => {
    const toml = [
      'to = "https://raw.githubusercontent.com/hpma-bits/hpma-spellbook/cards-v1.20261024.0/cards/:splat"',
      'to = "https://raw.githubusercontent.com/hpma-bits/hpma-spellbook/echoes-v1.20261024.0/echoes/:splat"',
    ].join('\n');
    const next = syncNetlifyTags(toml, {
      cards: 'cards-v2.20261101.0',
      echoes: 'echoes-v2.20261101.0',
    });
    expect(next).toContain('cards-v2.20261101.0');
    expect(next).toContain('echoes-v2.20261101.0');
    expect(next).not.toContain('cards-v1.20261024.0');
  });
});
