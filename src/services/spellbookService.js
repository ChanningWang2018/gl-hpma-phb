// Spellbook Service — static-class facade over the spellbookClient singleton.
// Pure logic helpers (filtering, cost options, level table formatting) are
// exposed as static methods so vitest can exercise them without loading data.
import {
  createClient,
  lookupLabel,
  lookupTags,
  lookupText,
} from '@/services/spellbookClient.js';

// Module-level singleton: one client per app. Tests re-point it via
// SpellbookService.configure() (the default data base /data/spellbook/ only
// exists once the site is served; unit tests read public/data/spellbook/).
let client = createClient();

export class SpellbookService {
  /**
   * Replace the module singleton (intended for tests and alt data sources).
   * @param {{ dataBaseUrl?: string, imageBaseUrl?: string }} [options]
   */
  static configure(options) {
    client = createClient(options);
  }

  /** The shared client instance. */
  static get client() {
    return client;
  }

  /**
   * Load cards/manifest/version.json once. Idempotent: repeated and concurrent
   * calls share one in-flight request (delegated to the client cache).
   */
  static async load() {
    return client.load();
  }

  /** All cards. Throws unless load() has completed. */
  static get cards() {
    return client.cards;
  }

  /** labels map from cards.json ({ type: {...}, rarity: {...} }). Throws before load(). */
  static get labels() {
    return client.labels;
  }

  /**
   * Native quality-frame table from cards.json (schema 5):
   * { <rarity>: { file, size, inner } }, or null when absent.
   * Throws before load() — same contract as the labels getter.
   */
  static get frames() {
    return client.frames;
  }

  /**
   * Headline attr-name tuple from cards.json (schema 6):
   * ["hp", "damage", "shield", "duration"] — level rows whose attr_name is in
   * this list are the ones the in-game spellbook face headlines. Null when
   * the document omits it. Throws before load() — same contract as frames.
   */
  static get faceAttrs() {
    return client.faceAttrs;
  }

  /**
   * Resolved URL of the native quality frame for a rarity (image base +
   * `frames/<file>`), or null when unresolvable — never throws (safe even
   * before load()), the UI degrades to its CSS rarity visual.
   * See client.frameUrl.
   */
  static frameUrl(rarity) {
    return client.frameUrl(rarity);
  }

  /** version.json content ({ tag, version, imageBase, ... }). */
  static get versionInfo() {
    return client.versionInfo;
  }

  /** Raw manifest.json document. */
  static get manifest() {
    return client.manifest;
  }

  /** Display name of a type/rarity code (default locale zh). */
  static label(kind, code, locale = 'zh') {
    return lookupLabel(client.labels, kind, code, locale);
  }

  /** Localized card text with zh fallback (data is CN-first). */
  static text(card, locale, field) {
    return lookupText(card, locale, field);
  }

  /** Localized tag list (en list falls back to the zh top-level tags). */
  static tags(card, locale) {
    return lookupTags(card, locale);
  }

  /**
   * Image URL for a card object or bare id. `format: 'png'` (default) is the
   * canonical art URL and throws when no image base can be resolved (load()
   * not done, no explicit base, no ?img= override); `format: 'webp'` returns
   * the release's WebP copy URL or null when the variant is unavailable —
   * never throws. See spellbookClient.createClient for the resolution
   * priority and the imagesWebp capability.
   */
  static imageUrl(cardOrId, format = 'png') {
    return client.imageUrl(cardOrId, format);
  }

  /**
   * Pure filter over a card array.
   *
   * @param {Array} cards card objects (as in cards.json).
   * @param {{
   *   type?: string|'all',
   *   rarity?: string|'all',
   *   cost?: number|string|'all',
   *   search?: string,
   * }} criteria
   *   search is matched case-insensitively against zh name, en name and
   *   spell_word — a hit in any one of them keeps the card.
   * @returns {Array} new filtered array (input is never mutated).
   */
  static filterCards(cards, { type, rarity, cost, search } = {}) {
    const query = (search ?? '').trim().toLowerCase();
    return cards.filter((card) => {
      if (type && type !== 'all' && card.type !== type) return false;
      if (rarity && rarity !== 'all' && card.rarity !== rarity) return false;
      // String compare keeps cost 0 filterable (a truthiness check would drop it).
      if (
        cost !== undefined &&
        cost !== null &&
        cost !== '' &&
        cost !== 'all'
      ) {
        if (String(card.cost) !== String(cost)) return false;
      }
      if (query) {
        const haystacks = [
          card.i18n?.zh?.name,
          card.i18n?.en?.name,
          card.spell_word,
        ];
        if (
          !haystacks.some((h) => h && String(h).toLowerCase().includes(query))
        ) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Distinct mana costs of a card array, ascending — dropdown options.
   * @returns {number[]}
   */
  static costOptions(cards) {
    return [...new Set(cards.map((card) => card.cost))].sort((a, b) => a - b);
  }

  /**
   * Format a card's `levels` into UI-ready rows.
   *
   * Real data shape (schema 6, verified against cards.json v6.20261004):
   *   levels = { "1": { battle_show?: number[], rows: Row[] },
   *              "2": { ... }, ... }
   *   - keys are level numbers as strings; the spellbook data only covers
   *     1..30 (the in-game cap) and is contiguous in v6, but iterate actual
   *     keys and sort numerically regardless.
   *   - block.rows mirrors the game's attr_val_list 1:1:
   *     Row = { attr_name?, k, v, k_en?, unit?, unit_en? }.
   *   - row.attr_name (schema 6) is the locale-independent SKILL_ATTR_NAME
   *     identifier (omitted when the game idx is unknown). The spellbook
   *     headline rule is: a row is headlined iff attr_name ∈ the document's
   *     top-level face_attrs (["hp","damage","shield","duration"]) — exposed
   *     as SpellbookService.faceAttrs. This replaces schema ≤5's
   *     per-row `pct` flag, which misread the raw game field battle_show as
   *     0-based and carried no percentage semantics; it is gone in v6 and
   *     this site renders level values as plain text either way (decision of
   *     2026-10-04), so entries no longer carry any headline flag.
   *   - block.battle_show is the raw game field, verbatim: 1-BASED positions
   *     into rows (rows[b-1]), possibly dirty (out-of-range). formatLevelRows
   *     does not consume it — the defense is simply not reading it.
   *   - row.v is a number | string union ("ground", "speed_fast", ...).
   *   - row.unit (optional) names the entity the stat belongs to —
   *     one card can list stats for several subjects (e.g. 挪威脊背龙蛋 vs the
   *     hatched 挪威脊背龙); absent unit means the card's own effect. The UI
   *     groups entries by unit within each level.
   *   - row.k_en / row.unit_en (schema 3, optional) are the en translations of
   *     the stat label / subject — shown when the UI locale is en, with the zh
   *     value as fallback.
   *   - k-sets may differ between levels of the same card, so each row carries
   *     its own entries instead of assuming one shared stat matrix.
   *   - levels is optional (2 of 141 cards have none).
   *
   * @param {object|null|undefined} card
   * @returns {Array<{ lv: string, entries: Array<{ k: string, v: number|string, unit: string|null, kEn: string|null, unitEn: string|null, display: string|null }> }>}
   *   one row per level, ascending numeric level; empty array when the card
   *   has no levels.
   */
  static formatLevelRows(card) {
    const levels = card?.levels;
    if (!levels || typeof levels !== 'object') return [];
    return Object.keys(levels)
      .sort((a, b) => Number(a) - Number(b))
      .map((lv) => {
        // schema 6: each level is a { battle_show?, rows } block; only rows
        // are rendered. A missing/malformed block degrades to no entries.
        const rows = Array.isArray(levels[lv]?.rows) ? levels[lv].rows : [];
        return {
          lv,
          entries: rows.map((row) => ({
            k: row.k,
            v: row.v,
            unit: typeof row.unit === 'string' ? row.unit : null,
            kEn: typeof row.k_en === 'string' ? row.k_en : null,
            unitEn: typeof row.unit_en === 'string' ? row.unit_en : null,
            display:
              row.v === null || row.v === undefined ? null : String(row.v),
          })),
        };
      });
  }
}
