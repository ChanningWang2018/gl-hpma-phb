// Tests for quizLocale.js — UI language resolution/persistence and the page
// dictionary (zh copy pinned by docs/quiz.md, en copy checked for key-set
// parity so a missing translation cannot slip in). Browser globals
// (localStorage/navigator) are stubbed per case because vitest runs in a
// plain node environment.
import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  DEFAULT_LOCALE,
  MESSAGES,
  QUIZ_LOCALES,
  STORAGE_KEY,
  normalizeLocale,
  persistLocale,
  resolveInitialLocale,
  translate,
} from '../../src/services/quizLocale.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dictionary parity', () => {
  it('zh and en cover exactly the same key sets (sorted equal)', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(
      Object.keys(MESSAGES.zh).sort(),
    );
  });

  it('carries the shareText template with every placeholder in both locales', () => {
    for (const locale of QUIZ_LOCALES) {
      const template = MESSAGES[locale].shareText;
      for (const name of [
        'bank',
        'count',
        'mode',
        'grade',
        'correct',
        'total',
        'pct',
        'time',
        'url',
      ]) {
        expect(template).toContain(`{${name}}`);
      }
      expect(template.split('\n')).toHaveLength(4); // 多行成绩文本
    }
  });
});

describe('normalizeLocale', () => {
  it('accepts the supported locales and rejects everything else', () => {
    for (const locale of QUIZ_LOCALES) {
      expect(normalizeLocale(locale)).toBe(locale);
    }
    expect(normalizeLocale('fr')).toBe(null);
    expect(normalizeLocale('EN')).toBe(null); // case-sensitive codes
    expect(normalizeLocale(undefined)).toBe(null);
  });
});

describe('translate', () => {
  it('returns the pinned zh chrome copy', () => {
    expect(translate('zh', 'note')).toBe(
      '全站共 {total} 道课堂问答题：魔法史与麻瓜研究，支持检索与计时挑战。',
    );
    expect(translate('zh', 'tabBank')).toBe('题库检索');
    expect(translate('zh', 'tabChallenge')).toBe('答题挑战');
    expect(translate('zh', 'loading')).toBe('正在翻开课本……');
    expect(translate('zh', 'versionBadge')).toBe('数据 {version} · {total} 题');
    expect(translate('zh', 'hitLine')).toBe('命中 {shown} / {total} 题');
    expect(translate('zh', 'bankAll')).toBe('全部科目');
    expect(translate('zh', 'bankHistory')).toBe('魔法史');
    expect(translate('zh', 'bankMuggle')).toBe('麻瓜研究');
    expect(translate('zh', 'bankMixed')).toBe('混合双科');
    expect(translate('zh', 'adjudicatedNote')).toBe(
      '该题游戏内判分与本站标答不同（官方录错选项顺序），详见数据集裁决记录。',
    );
    expect(translate('zh', 'empty')).toBe('没有命中的题目——换个关键词试试。');
    expect(translate('zh', 'prefectBlurb')).toBe(
      '只有选项，没有题干——凭题库记忆盲选，作答后揭晓题目。',
    );
    expect(translate('zh', 'resultTitle')).toBe('O.W.L. 成绩单');
  });

  it('returns the pinned zh O.W.L. grade names', () => {
    expect(translate('zh', 'owlO')).toBe('O · 杰出');
    expect(translate('zh', 'owlE')).toBe('E · 良好');
    expect(translate('zh', 'owlA')).toBe('A · 及格');
    expect(translate('zh', 'owlP')).toBe('P · 差');
    expect(translate('zh', 'owlD')).toBe('D · 糟糕');
    expect(translate('zh', 'owlT')).toBe('T · 巨怪');
  });

  it('returns idiomatic en counterparts', () => {
    expect(translate('en', 'tabBank')).toBe('Question Bank');
    expect(translate('en', 'bankHistory')).toBe('History of Magic');
    expect(translate('en', 'bankMuggle')).toBe('Muggle Studies');
    expect(translate('en', 'owlO')).toBe('O · Outstanding');
    expect(translate('en', 'owlT')).toBe('T · Troll');
    expect(translate('en', 'resultTitle')).toBe('O.W.L. Report Card');
  });

  it('interpolates {placeholder} params', () => {
    expect(
      translate('zh', 'versionBadge', { version: '2.20261009.0', total: 1847 }),
    ).toBe('数据 2.20261009.0 · 1847 题');
    expect(translate('zh', 'hitLine', { shown: 7, total: 1847 })).toBe(
      '命中 7 / 1847 题',
    );
    expect(translate('zh', 'questionN', { n: 3, total: 10 })).toBe(
      '第 3 / 10 题',
    );
    expect(translate('zh', 'feedbackWrong', { answer: '公元1473年' })).toBe(
      '错误，正确答案：公元1473年',
    );
    expect(
      translate('zh', 'bestLabel', {
        grade: 'O · 杰出',
        correct: 10,
        total: 10,
        time: '3分21秒',
      }),
    ).toBe('本地最佳：O · 杰出 · 10/10 · 3分21秒');
    expect(translate('en', 'statAccuracy', { pct: 100 })).toBe('Accuracy 100%');
  });

  it('interpolates the shareText template end to end', () => {
    expect(
      translate('zh', 'shareText', {
        bank: '魔法史',
        count: 10,
        mode: '级长模式',
        grade: 'O · 杰出',
        correct: 10,
        total: 10,
        pct: 100,
        time: '3分21秒',
        url: 'https://example.com/quiz',
      }).split('\n'),
    ).toEqual([
      '【HPMA 魔法测验】魔法史 · 10 题 · 级长模式',
      'O.W.L. 评级：O · 杰出',
      '正确 10/10（100%）· 用时 3分21秒',
      '你也来试试 → https://example.com/quiz',
    ]);
  });

  it('falls back to the default locale message, then the key itself', () => {
    expect(translate('fr', 'tabBank')).toBe('题库检索');
    expect(translate('zh', 'no_such_key')).toBe('no_such_key');
  });
});

describe('resolveInitialLocale', () => {
  it('returns the CN-first default without any browser signals', () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('localStorage', undefined);
    expect(resolveInitialLocale()).toBe(DEFAULT_LOCALE);
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

  it('prefers the persisted choice over the browser language', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' });
    vi.stubGlobal('localStorage', { getItem: () => 'en' });
    expect(resolveInitialLocale()).toBe('en');
  });

  it('ignors an invalid persisted value', () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    vi.stubGlobal('localStorage', { getItem: () => 'fr' });
    expect(resolveInitialLocale()).toBe('en');
  });
});

describe('persistLocale', () => {
  it('writes the choice under the storage key', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    persistLocale('en');
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, 'en');
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
