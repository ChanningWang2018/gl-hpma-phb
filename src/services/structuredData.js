// Structured data (JSON-LD) builders for the indexable pages (issue #22).
//
// These are pure functions: a view resolves the entity fields from the data
// services (localized name, description, image) and passes them in, so every
// builder is unit-testable without Vue, Pinia or fetch. The only shared global
// is SITE_ORIGIN — every URL in the emitted graph is absolute and comparable
// with the page's rel="canonical".
//
// Deliberate non-goals, because the site has no real data for them:
//   - no offers / price (cards and echoes are not sold here),
//   - no aggregateRating / review (no ratings or reviews exist),
//   - no FAQPage,
//   - no SearchAction on WebSite (the site has no global search yet),
//   - no hreflang (one URL per entity is intentional; P3).
// Inventing any of them would be rich-result spam, so they are simply absent.

/** Canonical site origin used by every URL builder. */
export const SITE_ORIGIN = 'https://grimmauldplace.top';

/** Local 1200×630 fallback used when an entity has no usable image. */
export const FALLBACK_OG_IMAGE = '/og-image.webp';

/**
 * Stable head key for the JSON-LD script. With keep-alive route changes the
 * outgoing and incoming pages can briefly overlap; the key makes unhead treat
 * both entries as the same script, so the document never carries two blocks.
 */
export const STRUCTURED_DATA_SCRIPT_KEY = 'structured-data';

function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

/**
 * Make a URL absolute against SITE_ORIGIN. Absolute URLs (any scheme) are
 * returned unchanged; protocol-relative and root-relative paths are resolved
 * against https + the site origin.
 *
 * @param {string|null|undefined} value
 * @returns {string} absolute URL, or '' when nothing usable was passed
 */
export function absoluteUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${SITE_ORIGIN}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

/**
 * First candidate that resolves to an absolute URL; otherwise the fallback.
 * Views pass their image chain (release image → same-origin proxy), so this
 * keeps the "entity image, else og-image.webp" rule in one place.
 *
 * @param {Array<string|null|undefined>} candidates
 * @param {string} [fallback]
 * @returns {string}
 */
export function firstAbsoluteUrl(candidates, fallback = FALLBACK_OG_IMAGE) {
  for (const candidate of candidates ?? []) {
    const url = absoluteUrl(candidate);
    if (url) return url;
  }
  return absoluteUrl(fallback);
}

/**
 * Card detail page: CreativeWork for one card of the Card Codex.
 * Deliberately no price, rating or review — the game data has none.
 *
 * @param {{
 *   name: string,
 *   alternateName?: string,
 *   description?: string,
 *   image?: string,
 *   url: string,
 * }} card
 * @returns {object} Schema.org CreativeWork
 */
export function buildCardStructuredData({
  name,
  alternateName,
  description,
  image,
  url,
}) {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name,
    alternateName,
    description,
    image: absoluteUrl(image),
    url: absoluteUrl(url),
    isPartOf: {
      '@type': 'CollectionPage',
      name: 'Card Codex',
      url: absoluteUrl('/cards'),
    },
  });
}

/**
 * Echo detail page: CreativeWork whose `about` (a Thing) describes the
 * character behind the echo. No aggregateRating / review — none exist.
 *
 * @param {{
 *   name: string,
 *   alternateName?: string,
 *   description?: string,
 *   image?: string,
 *   url: string,
 *   about?: { name?: string, alternateName?: string, description?: string },
 * }} echo
 * @returns {object} Schema.org CreativeWork
 */
export function buildEchoStructuredData({
  name,
  alternateName,
  description,
  image,
  url,
  about,
}) {
  const character =
    about && (about.name || about.description)
      ? compact({
          '@type': 'Thing',
          name: about.name,
          alternateName: about.alternateName,
          description: about.description,
        })
      : null;
  return compact({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name,
    alternateName,
    description,
    image: absoluteUrl(image),
    url: absoluteUrl(url),
    about: character,
    isPartOf: {
      '@type': 'CollectionPage',
      name: 'Echo Index',
      url: absoluteUrl('/echoes'),
    },
  });
}

/**
 * Index page: CollectionPage whose mainEntity is an ItemList of the entities
 * linked from that page. Empty/malformed items are skipped; an empty list
 * omits mainEntity rather than emitting an ItemList with zero elements.
 *
 * @param {{
 *   name: string,
 *   description?: string,
 *   url: string,
 *   items?: Array<{ name: string, url: string }>,
 *   itemListName?: string,
 *   itemListDescription?: string,
 * }} page
 * @returns {object} Schema.org CollectionPage
 */
export function buildCollectionPageStructuredData({
  name,
  description,
  url,
  items = [],
  itemListName,
  itemListDescription,
}) {
  const listItems = (items ?? [])
    .filter((item) => item && item.name && item.url)
    .map((item, index) =>
      compact({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.url),
      }),
    );
  return compact({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: absoluteUrl(url),
    mainEntity: listItems.length
      ? compact({
          '@type': 'ItemList',
          name: itemListName,
          description: itemListDescription,
          numberOfItems: listItems.length,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: listItems,
        })
      : null,
  });
}

/**
 * Home page: WebSite. No potentialAction/SearchAction — global search does
 * not exist on this branch, and a fake target would be invalid markup.
 *
 * @param {{ name: string, description?: string, url: string }} site
 * @returns {object} Schema.org WebSite
 */
export function buildWebSiteStructuredData({ name, description, url }) {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    description,
    url: absoluteUrl(url),
  });
}

/**
 * Static documentation page: a plain WebPage. Used for /methodology and
 * /changelog so every prerendered route still carries exactly one graph.
 *
 * @param {{ name: string, description?: string, url: string }} page
 * @returns {object} Schema.org WebPage
 */
export function buildWebPageStructuredData({ name, description, url }) {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url: absoluteUrl(url),
  });
}

/**
 * Generic page markup for the tool pages that have no per-entity graph
 * (analytics, quiz, sales optimizer, resources). Kept minimal and truthful:
 * no feature list or free-offer claims beyond "this is a web application".
 *
 * @param {{ name: string, description?: string, url: string }} app
 * @returns {object} Schema.org WebApplication
 */
export function buildWebApplicationStructuredData({ name, description, url }) {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: absoluteUrl(url),
    applicationCategory: 'Game',
    operatingSystem: 'Web Browser',
  });
}

/**
 * Wrap a schema object in the head `script` entry @vueuse/head renders.
 * `<` is escaped so a description containing `</script>` cannot terminate the
 * element in the prerendered HTML; JSON.parse still restores the character.
 *
 * @param {object} data
 * @returns {{ key: string, type: string, textContent: string }}
 */
export function jsonLdScript(data) {
  return {
    key: STRUCTURED_DATA_SCRIPT_KEY,
    type: 'application/ld+json',
    textContent: JSON.stringify(data).replace(/</g, '\\u003c'),
  };
}
