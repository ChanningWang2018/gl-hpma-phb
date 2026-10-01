// CodexLocale — UI language layer for the /cards page (zh | en).
//
// Only the page chrome (toolbar labels, state lines, aria text) lives here.
// Data-side bilingual text — card name/desc/quote, type/rarity labels, tags
// and the per-row level stat labels (k_en/unit_en) — comes from cards.json
// itself (schema 3), resolved through spellbookClient's lookup* helpers.
//
// No vue-i18n: a single page needs translating, so a flat dictionary plus a
// {placeholder} interpolator covers it without a dependency.

/** localStorage key persisting the user's manual choice. */
export const STORAGE_KEY = 'hpma-codex-locale';

/** Supported locales; DEFAULT_LOCALE matches the data's CN-first fallback. */
export const CODEX_LOCALES = ['zh', 'en'];
export const DEFAULT_LOCALE = 'zh';

const MESSAGES = {
  zh: {
    note: '全站 {total} 张卡牌档案：咒语 / 召唤 / 伙伴，支持按类型、稀有度、费用与名称检索。',
    languageToggle: '切换到英文',
    filterByType: '按类型筛选',
    labelRarity: '稀有度',
    labelCost: '费用',
    labelSearch: '搜索',
    searchPlaceholder: '中文名 / 英文名 / 咒语词',
    all: '全部',
    allRarities: '全部稀有度',
    allCosts: '全部费用',
    costN: '{n} 费',
    hitLine: '命中 {shown} / {total} 张',
    loading: '正在翻开图鉴……',
    loadError: '卡牌数据加载失败，请稍后重试。',
    retry: '重试',
    empty: '没有命中的卡牌——放宽筛选项或换个关键词试试。',
    cardList: '卡牌列表',
    viewDetail: '查看 {name} 详情',
    costTitle: '费用 {n}',
    closeDetail: '关闭卡牌详情',
    levelStats: '等级数值',
    levelStatsAria: '等级数值表',
  },
  en: {
    note: 'All {total} cards — spells, summons and companions — with type, rarity and cost filters plus name search.',
    languageToggle: 'Switch to Chinese',
    filterByType: 'Filter by type',
    labelRarity: 'Rarity',
    labelCost: 'Cost',
    labelSearch: 'Search',
    searchPlaceholder: 'Card name or incantation',
    all: 'All',
    allRarities: 'All rarities',
    allCosts: 'All costs',
    costN: 'Cost {n}',
    hitLine: '{shown} / {total} cards',
    loading: 'Opening the codex…',
    loadError: 'Failed to load card data — please try again later.',
    retry: 'Retry',
    empty: 'No cards match — loosen the filters or try another keyword.',
    cardList: 'Card list',
    viewDetail: 'View {name} details',
    costTitle: 'Cost {n}',
    closeDetail: 'Close card details',
    levelStats: 'Level Stats',
    levelStatsAria: 'Level stats table',
  },
};

// English display for enum-ish string stat values (levels row.v). Numeric and
// "40%"/"8×28"-style values pass through untouched; zh keeps the raw data.
const VALUE_LABELS = {
  en: {
    ground: 'Ground',
    'air&ground': 'Air & Ground',
    entire_scene: 'Entire Scene',
    speed_veryfast: 'Very Fast',
    speed_fast: 'Fast',
    speed_normal: 'Normal',
    speed_slow: 'Slow',
  },
};

/** 'en' -> 'en'; anything else -> null (unknown locales are not accepted). */
export function normalizeLocale(value) {
  return CODEX_LOCALES.includes(value) ? value : null;
}

/**
 * Dictionary lookup with {placeholder} interpolation and DEFAULT_LOCALE
 * fallback (missing keys degrade to the zh message, then the key itself).
 */
export function translate(locale, key, params) {
  const dict = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  let text = dict[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Enum-ish string value -> display label in `locale` (zh passes through). */
export function valueLabel(locale, value) {
  if (typeof value !== 'string') return value;
  return VALUE_LABELS[locale]?.[value] ?? value;
}

/**
 * Initial locale: persisted choice > browser language > DEFAULT_LOCALE.
 * All browser globals are guarded — tests run in a plain node environment.
 */
export function resolveInitialLocale() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = normalizeLocale(localStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
    }
  } catch {
    // storage unavailable (privacy mode etc.) — fall through to detection
  }
  const language =
    typeof navigator !== 'undefined' && typeof navigator.language === 'string'
      ? navigator.language
      : '';
  // Browser language available: zh* stays zh, everything else gets en.
  // No signal at all (node tests, exotic browsers): CN-first default.
  if (language) {
    return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }
  return DEFAULT_LOCALE;
}

/** Persist the manual choice; silently no-ops when storage is unavailable. */
export function persistLocale(locale) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale);
    }
  } catch {
    // storage unavailable — the choice still applies for this session
  }
}
