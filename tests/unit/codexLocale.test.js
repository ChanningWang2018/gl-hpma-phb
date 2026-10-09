// Tests for codexLocale.js — the /cards page chrome dictionary (checked for
// zh/en key-set parity so a missing translation cannot slip in) and the
// enum-value display mapping. Locale resolution/persistence now lives in
// siteLocale.js and is covered by tests/unit/siteLocale.test.js.
import { describe, it, expect } from 'vitest';

import {
  CODEX_LOCALES,
  MESSAGES,
  normalizeLocale,
  translate,
  valueLabel,
} from '../../src/services/codexLocale.js';

describe('dictionary parity', () => {
  it('zh and en cover exactly the same key sets (sorted equal)', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(
      Object.keys(MESSAGES.zh).sort(),
    );
  });
});

describe('normalizeLocale', () => {
  it('accepts the supported locales and rejects everything else', () => {
    for (const locale of CODEX_LOCALES) {
      expect(normalizeLocale(locale)).toBe(locale);
    }
    expect(normalizeLocale('fr')).toBe(null);
    expect(normalizeLocale('EN')).toBe(null); // case-sensitive codes
    expect(normalizeLocale(undefined)).toBe(null);
  });
});

describe('translate', () => {
  it('returns the zh and en dictionary messages', () => {
    expect(translate('zh', 'labelRarity')).toBe('稀有度');
    expect(translate('en', 'labelRarity')).toBe('Rarity');
  });

  it('interpolates {placeholder} params', () => {
    expect(translate('zh', 'hitLine', { shown: 3, total: 141 })).toBe(
      '命中 3 / 141 张',
    );
    expect(translate('en', 'costN', { n: 5 })).toBe('Cost 5');
  });

  it('falls back to the default locale message, then the key itself', () => {
    expect(translate('fr', 'labelRarity')).toBe('稀有度');
    expect(translate('zh', 'no_such_key')).toBe('no_such_key');
  });
});

describe('valueLabel', () => {
  it('maps enum-ish string values in en', () => {
    expect(valueLabel('en', 'ground')).toBe('Ground');
    expect(valueLabel('en', 'air&ground')).toBe('Air & Ground');
    expect(valueLabel('en', 'speed_fast')).toBe('Fast');
    expect(valueLabel('en', 'entire_scene')).toBe('Entire Scene');
  });

  it('passes through non-enum strings, numbers and the zh locale', () => {
    expect(valueLabel('en', '40%')).toBe('40%');
    expect(valueLabel('en', '8×28')).toBe('8×28');
    expect(valueLabel('en', 'totally_unknown')).toBe('totally_unknown');
    expect(valueLabel('en', 42)).toBe(42);
    expect(valueLabel('zh', 'ground')).toBe('ground'); // zh keeps the raw data
    expect(valueLabel('zh', 42)).toBe(42);
  });
});
