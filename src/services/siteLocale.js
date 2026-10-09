// SiteLocale — the site-wide UI language engine (zh | en).
//
// Single source of truth for language resolution, persistence and the
// dictionary-lookup kernel shared by codexLocale.js / quizLocale.js (whose
// translate() now delegates here). One localStorage key for the whole site;
// the legacy per-page keys are migrated read-only on first load and never
// written or removed (rollback-friendly).
//
// No vue-i18n: a two-locale site needs a flat dictionary plus a
// {placeholder} interpolator, not a dependency.

/** localStorage key persisting the user's site-wide manual choice. */
export const STORAGE_KEY = 'hpma-locale';

/** Legacy per-page keys, migrated read-only in this order on first load. */
export const LEGACY_KEYS = ['hpma-codex-locale', 'hpma-quiz-locale'];

/** Supported locales; DEFAULT_LOCALE matches the data's CN-first fallback. */
export const SUPPORTED_LOCALES = ['zh', 'en'];
export const DEFAULT_LOCALE = 'zh';

/** Small shared dictionary for site-wide components (LocaleSwitch etc.). */
export const MESSAGES = {
  zh: { languageToggle: '切换语言' },
  en: { languageToggle: 'Switch language' },
};

/** 'en' -> 'en'; anything else -> null (unknown locales are not accepted). */
export function normalizeLocale(value) {
  return SUPPORTED_LOCALES.includes(value) ? value : null;
}

/** Read one storage key into a normalized locale; null when unset/invalid. */
function readStoredLocale(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return normalizeLocale(localStorage.getItem(key));
  } catch {
    // storage unavailable (privacy mode etc.) — ignore this signal
    return null;
  }
}

/**
 * Initial locale, resolved once per page load. Read-only migration chain:
 * new key > legacy codex key > legacy quiz key > browser language >
 * DEFAULT_LOCALE. Old keys are kept (never written, never deleted).
 * All browser globals are guarded — tests run in a plain node environment.
 */
export function resolveInitialLocale() {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    const stored = readStoredLocale(key);
    if (stored) return stored;
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

/**
 * Persist the manual choice under STORAGE_KEY; invalid values never touch
 * storage, and storage errors (privacy mode, quota) are swallowed silently.
 */
export function persistLocale(locale) {
  if (!normalizeLocale(locale)) return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale);
    }
  } catch {
    // storage unavailable — the choice still applies for this session
  }
}

/**
 * Dictionary kernel: look up messages[locale][key], fall back to the zh
 * message for unknown locales or missing keys, then to the key itself;
 * interpolate {placeholder} params via replaceAll. codexLocale/quizLocale's
 * translate() delegate here with their own dictionaries.
 */
export function translateMessage(messages, locale, key, params) {
  const dict = messages[locale] ?? messages[DEFAULT_LOCALE];
  let text = dict[key] ?? messages[DEFAULT_LOCALE][key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
