/**
 * spellbookClient.js — zero-dependency ESM loader for the hpma-spellbook data.
 *
 * Ported from the reference consumer E:\Scripts\hpma-cards-consumer\src\hpma-cards.js
 * (kept dependency-free so tests and `node -e` smoke checks can import it directly).
 *
 * Works in the browser and in Node.js 18+ using the global `fetch`.
 * In Node, a local data directory (e.g. `public/data/spellbook/`) is read
 * straight from disk, because `fetch` cannot serve `file:` URLs; http(s)
 * URLs always go through `fetch`, which is what makes CDN-hosted data work
 * unchanged.
 *
 * Key difference vs. the reference loader: the data base and the card-image
 * base are separated. Data (cards/manifest/version.json) lives on this site
 * under `/data/spellbook/`; card art is hot-linked from jsDelivr at a pinned
 * tag (copyright: the images must be referenced, never re-distributed). The
 * image base resolves live on every `imageUrl()` call with this priority:
 *
 *   1. explicit `imageBaseUrl` option passed to createClient()
 *   2. the `?img=<base>` query parameter of the browser URL (manual override)
 *   3. the `imageBase` field of the loaded version.json (single source of truth)
 *
 * Data model (schema_version 3):
 *   cards.json    = { schema_version, data_version, generated_at, labels, cards }
 *   manifest.json = extraction metadata (coverage, source, notes, ...)
 *   version.json  = { tag, version, schemaVersion, dataVersion, imageBase, generatedAt }
 *   labels        = { type: { <code>: { zh, en } }, rarity: { <code>: { zh, en } } }
 *   Card          = { id, type, rarity, cost, img, spell_word, tags, i18n, levels? }
 *   i18n          = { zh: { name, desc, quote, stats, tags },
 *                     en: { name, desc, quote, stats, tags } }
 *   levels        = { "<lv>": [{ k, v, pct, k_en?, unit?, unit_en? }, ...] }
 *                   // k_en/unit_en (schema 3): per-row en translation of the
 *                   // stat label / subject entity; see formatLevelRows
 *
 * The data is Chinese-first: `en` strings may be missing or null, so text
 * lookups fall back to `zh` when the requested locale has no value.
 */

/** Schema version this loader understands. Bump only on structural changes. */
export const EXPECTED_SCHEMA_VERSION = 3;

/** Default data base when neither an option nor `?img=`-style overrides apply. */
export const DEFAULT_DATA_BASE_URL = '/data/spellbook/';

/* ------------------------------------------------------------------ */
/* Pure helpers (named exports — use them directly if you like)        */
/* ------------------------------------------------------------------ */

/** Join a base URL (or path) and a relative path without double slashes. */
export function joinUrl(base, relative) {
  return `${String(base).replace(/\/+$/, '')}/${String(relative).replace(/^\/+/, '')}`;
}

/** Ensure a base URL/path ends with exactly one trailing slash. */
export function normalizeBaseUrl(base) {
  const trimmed = String(base).trim();
  return trimmed.replace(/\/+$/, '') + '/';
}

/**
 * Read the `?img=<base>` card-image override from a query string.
 *
 * @param {string} [search] explicit query string (leading "?" optional);
 *   defaults to the browser `location.search` when available, '' otherwise.
 * @returns {string} the override base, or '' when absent.
 */
export function readImageBaseOverride(search) {
  const source =
    search !== undefined
      ? search
      : typeof location !== 'undefined' && typeof location.search === 'string'
        ? location.search
        : '';
  if (!source) return '';
  return new URLSearchParams(source).get('img') ?? '';
}

/** Display name for a type/rarity code, e.g. label("rarity", "epic", "en"). */
export function lookupLabel(labels, kind, code, locale = 'zh') {
  return labels?.[kind]?.[code]?.[locale] ?? code;
}

/**
 * Localized text for a card field with zh fallback (data is CN-first):
 * returns the `locale` value when present, otherwise the `zh` value.
 */
export function lookupText(card, locale, field) {
  const i18n = card?.i18n ?? {};
  const requested = i18n[locale]?.[field];
  if (requested !== undefined && requested !== null && requested !== '')
    return requested;
  return i18n.zh?.[field] ?? null;
}

/**
 * Localized tag list for a card: `i18n[locale].tags` when present (non-empty),
 * falling back to the top-level `tags` (the zh list). Always returns an array.
 */
export function lookupTags(card, locale) {
  const localized = card?.i18n?.[locale]?.tags;
  if (Array.isArray(localized) && localized.length > 0) return localized;
  return Array.isArray(card?.tags) ? card.tags : [];
}

/** The `img` path of a card, or of a bare card id. */
export function cardImagePath(cardOrId) {
  if (cardOrId !== null && typeof cardOrId === 'object') return cardOrId.img;
  return `images/${cardOrId}.png`;
}

/** Absolute (base-resolved) image URL for a card object or bare id. */
export function resolveImageUrl(baseUrl, cardOrId) {
  return joinUrl(baseUrl, cardImagePath(cardOrId));
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch + parse a JSON document.
 * - http(s)/data URLs: plain `fetch` (browser and Node).
 * - local paths / file: URLs (Node only): read via node:fs, because Node's
 *   fetch does not support the `file:` scheme. This branch is what lets the
 *   unit tests read the real committed data with zero mocks.
 */
async function loadJson(url) {
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  if (isNode && !/^(https?|data):/i.test(url)) {
    const { readFile } = await import('node:fs/promises');
    const { pathToFileURL, fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const filePath = url.startsWith('file:')
      ? fileURLToPath(url)
      : path.resolve(url);
    try {
      return JSON.parse(await readFile(filePath, 'utf8'));
    } catch (err) {
      throw new Error(`Cannot read data file "${filePath}" (${err.message})`);
    }
  }

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Network error while fetching ${url}: ${err.message}`);
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

/** Validate the cards.json document and index it for fast lookups. */
function prepareDoc(cardsDoc, manifest, versionInfo) {
  if (
    !cardsDoc ||
    typeof cardsDoc !== 'object' ||
    !Array.isArray(cardsDoc.cards)
  ) {
    throw new Error(
      'cards.json is malformed: expected an object with a top-level "cards" array.',
    );
  }

  const actual = cardsDoc.schema_version;
  if (actual !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(
      `不支持的数据版本：cards.json 的 schema_version 为 ${JSON.stringify(actual)}，` +
        `但当前加载器只支持 ${EXPECTED_SCHEMA_VERSION}。\n` +
        'schema_version 变更代表数据结构变化，需要先升级消费端代码（spellbookClient.js）' +
        '才能使用新数据；仅 data_version 变化只是内容更新，无需修改代码。',
    );
  }

  const byId = new Map();
  const byType = new Map();
  const byRarity = new Map();
  for (const card of cardsDoc.cards) {
    byId.set(card.id, card);
    if (!byType.has(card.type)) byType.set(card.type, []);
    byType.get(card.type).push(card);
    if (!byRarity.has(card.rarity)) byRarity.set(card.rarity, []);
    byRarity.get(card.rarity).push(card);
  }

  return {
    schemaVersion: cardsDoc.schema_version,
    dataVersion: cardsDoc.data_version,
    generatedAt: cardsDoc.generated_at,
    labels: cardsDoc.labels ?? {},
    cards: cardsDoc.cards,
    manifest: manifest ?? null,
    versionInfo: versionInfo ?? null,
    byId,
    byType,
    byRarity,
  };
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

/**
 * Create a data client.
 *
 *   const client = createClient();   // data base defaults to /data/spellbook/
 *   await client.load();             // fetch cards/manifest/version concurrently
 *   client.cards;                    // Card[]
 *   client.byId(1001);
 *   client.byType('spell');
 *   client.byRarity('legendary');
 *   client.label('rarity', 'epic', 'en');
 *   client.text(card, 'en', 'name'); // falls back to zh
 *   client.imageUrl(card);           // image base + card.img (resolved live)
 *   client.versionInfo;              // version.json content
 *
 * @param {{
 *   dataBaseUrl?: string,
 *   imageBaseUrl?: string,
 * }} [options]
 *   dataBaseUrl  — base for cards/manifest/version.json; defaults to
 *                  `/data/spellbook/`. http(s) URLs go through fetch, local
 *                  paths are read from disk in Node.
 *   imageBaseUrl — pins the card-image base and wins over the `?img=` query
 *                  param and version.json's imageBase.
 */
export function createClient(options = {}) {
  const dataBaseUrl = options.dataBaseUrl
    ? normalizeBaseUrl(options.dataBaseUrl)
    : DEFAULT_DATA_BASE_URL;
  const explicitImageBase = options.imageBaseUrl
    ? normalizeBaseUrl(options.imageBaseUrl)
    : null;
  /** @type {ReturnType<typeof prepareDoc> | null} */
  let loaded = null;
  /** @type {Promise<ReturnType<typeof prepareDoc>> | null} */
  let inFlight = null;

  async function load() {
    if (loaded) return snapshot();
    if (!inFlight) {
      // All three documents are independent — fetch them concurrently.
      inFlight = Promise.all([
        loadJson(joinUrl(dataBaseUrl, 'cards.json')),
        loadJson(joinUrl(dataBaseUrl, 'manifest.json')),
        loadJson(joinUrl(dataBaseUrl, 'version.json')),
      ])
        .then(([cardsDoc, manifest, versionInfo]) => {
          loaded = prepareDoc(cardsDoc, manifest, versionInfo);
          return snapshot();
        })
        .finally(() => {
          inFlight = null; // allow a retry if loading failed
        });
    }
    return inFlight;
  }

  function snapshot() {
    const d = loaded;
    return {
      schemaVersion: d.schemaVersion,
      dataVersion: d.dataVersion,
      generatedAt: d.generatedAt,
      labels: d.labels,
      cards: d.cards,
      manifest: d.manifest,
      versionInfo: d.versionInfo,
    };
  }

  function requireLoaded() {
    if (!loaded) {
      throw new Error('No data loaded yet — call `await client.load()` first.');
    }
    return loaded;
  }

  /**
   * Resolve the card-image base right now.
   * Priority: explicit option > `?img=` query param > version.json imageBase.
   * Returns null when none applies (version.json not loaded yet and no
   * explicit/queried base).
   */
  function currentImageBaseUrl() {
    if (explicitImageBase) return explicitImageBase;
    const fromQuery = readImageBaseOverride();
    if (fromQuery) return normalizeBaseUrl(fromQuery);
    const fromVersion = requireLoaded().versionInfo?.imageBase;
    return fromVersion ? normalizeBaseUrl(fromVersion) : null;
  }

  return {
    /** Resolved data base URL every data file is joined against. */
    dataBaseUrl,

    /** Fetch (and cache) cards.json + manifest.json + version.json. Idempotent. */
    load,

    /** All cards. Throws unless load() has completed. */
    get cards() {
      return requireLoaded().cards;
    },

    /** labels map from cards.json ({ type: {...}, rarity: {...} }). Throws before load(). */
    get labels() {
      return requireLoaded().labels;
    },

    /** Raw manifest.json document (null when unavailable). Throws before load(). */
    get manifest() {
      return requireLoaded().manifest;
    },

    /** version.json content ({ tag, version, imageBase, ... }). Throws before load(). */
    get versionInfo() {
      return requireLoaded().versionInfo;
    },

    /** Card by numeric id (string ids from query params are coerced). */
    byId(id) {
      const numeric = Number(id);
      return requireLoaded().byId.get(numeric);
    },

    /** All cards of one type ("spell" | "summon" | "companion"). */
    byType(type) {
      return requireLoaded().byType.get(type) ?? [];
    },

    /** All cards of one rarity ("common" ... "forbidden"). */
    byRarity(rarity) {
      return requireLoaded().byRarity.get(rarity) ?? [];
    },

    /** Display name of a type/rarity code in a locale (default "zh"). */
    label(kind, code, locale = 'zh') {
      return lookupLabel(requireLoaded().labels, kind, code, locale);
    },

    /** Localized card text with zh fallback (data is CN-first). */
    text(card, locale, field) {
      return lookupText(card, locale, field);
    },

    /**
     * Fully-resolved image URL for a card object or bare id.
     *
     * The image base is resolved live on every call (option > `?img=` >
     * version.json imageBase). Throws when no base can be resolved — i.e.
     * called before `load()` completed and without an explicit `imageBaseUrl`
     * option or `?img=` query param; callers treat that as a bug, the UI's
     * broken-image fallback chain handles network failures instead.
     */
    imageUrl(cardOrId) {
      const base = currentImageBaseUrl();
      if (!base) {
        throw new Error(
          'No card-image base available yet — call `await client.load()` first ' +
            '(or pass an explicit imageBaseUrl / ?img= override).',
        );
      }
      return resolveImageUrl(base, cardOrId);
    },
  };
}
