// Tests for siteLocale.js — the site-wide language engine: locale
// normalization, the read-only legacy-key migration chain, guarded
// persistence and the translateMessage kernel shared by both page
// dictionaries. Browser globals (localStorage/navigator) are stubbed per
// case because vitest runs in a plain node environment.
import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  DEFAULT_LOCALE,
  LEGACY_KEYS,
  MESSAGES,
  STORAGE_KEY,
  SUPPORTED_LOCALES,
  normalizeLocale,
  persistLocale,
  resolveInitialLocale,
  translateMessage,
} from '../../src/services/siteLocale.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normalizeLocale', () => {
  it('accepts the supported locales and rejects everything else', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(normalizeLocale(locale)).toBe(locale);
    }
    expect(normalizeLocale('fr')).toBe(null);
    expect(normalizeLocale('EN')).toBe(null); // case-sensitive codes
    expect(normalizeLocale(undefined)).toBe(null);
  });
});

describe('resolveInitialLocale', () => {
  it('returns the CN-first default without any browser signals', () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('localStorage', undefined);
    expect(resolveInitialLocale()).toBe(DEFAULT_LOCALE);
  });

  it('prefers the new key over both legacy keys', () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    vi.stubGlobal('localStorage', {
      getItem: (key) => (key === STORAGE_KEY ? 'en' : 'zh'),
    });
    expect(resolveInitialLocale()).toBe('en');
  });

  it('migrates the legacy codex key before the quiz key when both are set', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key) =>
        key === LEGACY_KEYS[0] ? 'en' : key === LEGACY_KEYS[1] ? 'zh' : null,
    });
    expect(resolveInitialLocale()).toBe('en');
  });

  it('falls back to the legacy quiz key when it is the only one set', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key) => (key === LEGACY_KEYS[1] ? 'en' : null),
    });
    expect(resolveInitialLocale()).toBe('en');
  });

  it('ignors invalid persisted values and keeps scanning the chain', () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    vi.stubGlobal('localStorage', { getItem: () => 'fr' });
    expect(resolveInitialLocale()).toBe('en');
  });

  it('follows the browser language: zh* -> zh, everything else -> en', () => {
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('navigator', { language: 'zh-CN' });
    expect(resolveInitialLocale()).toBe('zh');
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(resolveInitialLocale()).toBe('en');
    vi.stubGlobal('navigator', { language: 'ja-JP' });
    expect(resolveInitialLocale()).toBe('en');
  });

  it('swallows a throwing localStorage and falls through to detection', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' });
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(resolveInitialLocale()).toBe('zh');
  });
});

describe('persistLocale', () => {
  it('writes the choice under the storage key', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    persistLocale('en');
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, 'en');
  });

  it('no-ops on invalid values without touching storage', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    persistLocale('fr');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('silently no-ops when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => persistLocale('zh')).not.toThrow();
  });

  it('swallows storage errors (privacy mode)', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(() => persistLocale('zh')).not.toThrow();
  });
});

describe('translateMessage', () => {
  it('returns the zh and en dictionary messages', () => {
    expect(translateMessage(MESSAGES, 'zh', 'languageToggle')).toBe('切换语言');
    expect(translateMessage(MESSAGES, 'en', 'languageToggle')).toBe(
      'Switch language',
    );
  });

  it('interpolates {placeholder} params, repeated placeholders included', () => {
    const dict = {
      zh: { hitLine: '命中 {shown} / {total} 张', costN: '{n} 费（{n}）' },
    };
    expect(
      translateMessage(dict, 'zh', 'hitLine', { shown: 3, total: 141 }),
    ).toBe('命中 3 / 141 张');
    expect(translateMessage(dict, 'zh', 'costN', { n: 5 })).toBe('5 费（5）');
    expect(translateMessage(dict, 'zh', 'costN', { n: 0 })).toBe('0 费（0）');
  });

  it('falls back to the zh message for unknown locales, then the key itself', () => {
    const dict = { zh: { onlyZh: '仅有中文' } };
    expect(translateMessage(dict, 'fr', 'onlyZh')).toBe('仅有中文');
    expect(translateMessage(dict, 'zh', 'no_such_key')).toBe('no_such_key');
  });
});
