// Verify the static output of `npm run build:prerender` (issue #20).
//
// This is the post-build smoke test: no browser and no dependencies, just the
// files in dist/. It pins the indexable-route contract (9 index pages + 141
// cards + 19 deck echoes = 169 pages), checks that dist/sitemap.xml describes
// exactly those pages, and inspects every page for the SEO invariants the
// prerender exists to guarantee:
//
//   - exactly one rel="canonical" pointing at the page's own URL
//   - exactly one application/ld+json graph whose @type matches the route and
//     whose url matches the canonical (no invented ratings/reviews/offers)
//   - one og:url (== canonical), one og:type (website/article), one absolute
//     og:image and twitter:card=summary_large_image
//   - card / echo pages whose <title> keeps the entity name
//   - no "Loading card…" / "Loading echo…" client-only placeholders
//
// Usage: npm run verify:prerender
// Exits non-zero with an itemized list of every failure.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SITE_ORIGIN = 'https://grimmauldplace.top';

// The indexable-route contract. When a data module adds or removes entities,
// update these numbers (and the README count) in the same commit.
const INDEX_ROUTES = [
  '/',
  '/analytics',
  '/cards',
  '/echoes',
  '/quiz',
  '/sales-optimizer',
  '/resources',
  '/methodology',
  '/changelog',
];
const EXPECTED_CARDS = 141;
const EXPECTED_ECHOES = 19;
const EXPECTED_TOTAL = 169;

const LOADING_PLACEHOLDERS = ['Loading card…', 'Loading echo…'];

const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8'));
}

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&(amp|lt|gt|quot|apos);/gi, (match, name) => {
      const entities = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
      };
      return entities[name.toLowerCase()] ?? match;
    });
}

// Read an attribute from a single HTML tag, accepting quoted or unquoted
// values. Attribute order varies between @vueuse/head versions, so callers
// select the tag first and then ask for rel/href.
function attribute(tag, name) {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    'i',
  );
  const match = pattern.exec(tag);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3];
}

// Every <meta> carrying attr=value, decoded. Duplicate meta tags are an SEO
// bug, so callers check the length as well as the content.
function metaContent(html, attr, value) {
  return (html.match(/<meta\b[^>]*>/gi) ?? [])
    .filter((tag) => attribute(tag, attr) === value)
    .map((tag) => decodeEntities(attribute(tag, 'content') ?? ''));
}

function jsonLdScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .map((match) => ({
      tag: `<script ${match[1]}>`,
      content: match[2],
    }))
    .filter(
      ({ tag }) =>
        (attribute(tag, 'type') ?? '').toLowerCase() === 'application/ld+json',
    );
}

// P2-B contract: one graph per page, chosen by route shape.
function expectedSchemaType(route) {
  if (route.startsWith('/cards/') || route.startsWith('/echoes/'))
    return 'CreativeWork';
  if (route === '/cards' || route === '/echoes') return 'CollectionPage';
  if (route === '/') return 'WebSite';
  if (route === '/methodology' || route === '/changelog') return 'WebPage';
  return 'WebApplication';
}

function expectedOgType(route) {
  return route.startsWith('/cards/') || route.startsWith('/echoes/')
    ? 'article'
    : 'website';
}

function pageFile(route) {
  if (route === '/') return join(DIST, 'index.html');
  return join(DIST, route.replace(/^\//, ''), 'index.html');
}

function routeForPage(file) {
  const relativePath = relative(DIST, file).replace(/\\/g, '/');
  if (relativePath === 'index.html') return '/';
  return `/${relativePath.slice(0, -'/index.html'.length)}`;
}

function listPages(directory) {
  const pages = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      pages.push(...listPages(fullPath));
    } else if (entry.isFile() && entry.name === 'index.html') {
      pages.push(fullPath);
    }
  }
  return pages;
}

// Same lookup rules as src/services/spellbookClient.js lookupText(): the
// requested locale, then the zh source language.
function cardName(card, locale) {
  const i18n = card.i18n ?? {};
  const requested = i18n[locale]?.name;
  if (requested) return requested;
  return i18n.zh?.name ?? '';
}

// Same lookup and markup stripping as src/views/EchoDetail.vue text() and
// stripRich(); echo names can carry <color=...> rich-text tags.
function echoName(character, locale) {
  const i18n = character.i18n ?? {};
  const requested = i18n[locale]?.name;
  const english = i18n.en?.name;
  const chinese = i18n.zh?.name;
  return String(requested ?? english ?? chinese ?? '')
    .replace(/<color=[^>]*>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/<[^>]+>/g, '');
}

function titleNamesForCard(card) {
  const primary = cardName(card, 'en') || 'Card';
  const secondary = cardName(card, 'zh');
  return secondary && secondary !== primary ? [primary, secondary] : [primary];
}

function titleNamesForEcho(character) {
  const primary = echoName(character, 'en') || 'Echo';
  const secondary = echoName(character, 'zh');
  return secondary && secondary !== primary ? [primary, secondary] : [primary];
}

function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error(
      'Prerender verification failed: dist/index.html is missing — run `npm run build:prerender` first.',
    );
    process.exitCode = 1;
    return;
  }

  const homeHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
  if (homeHtml.includes('<div id="app"></div>')) {
    console.error(
      'Prerender verification failed: dist/index.html is still the SPA shell (not prerendered) — run `npm run build:prerender` first.',
    );
    process.exitCode = 1;
    return;
  }

  const cards = readJson('public/data/spellbook/cards.json').cards ?? [];
  const deckEchoes = (
    readJson('public/data/echoes/echoes.json').characters ?? []
  ).filter((character) => character.deck);

  if (cards.length !== EXPECTED_CARDS) {
    fail(
      `public/data/spellbook/cards.json has ${cards.length} cards, expected ${EXPECTED_CARDS}; update the contract in scripts/verify-prerender.mjs and the README when the spellbook module changes`,
    );
  }
  if (deckEchoes.length !== EXPECTED_ECHOES) {
    fail(
      `public/data/echoes/echoes.json has ${deckEchoes.length} deck echoes, expected ${EXPECTED_ECHOES}; update the contract in scripts/verify-prerender.mjs and the README when the echoes module changes`,
    );
  }

  const titleNames = new Map();
  const expectedRoutes = [...INDEX_ROUTES];
  for (const card of cards) {
    const route = `/cards/${card.id}`;
    expectedRoutes.push(route);
    titleNames.set(route, titleNamesForCard(card));
  }
  for (const character of deckEchoes) {
    const route = `/echoes/${character.id}`;
    expectedRoutes.push(route);
    titleNames.set(route, titleNamesForEcho(character));
  }

  if (expectedRoutes.length !== EXPECTED_TOTAL) {
    fail(
      `route contract has ${expectedRoutes.length} routes, expected ${EXPECTED_TOTAL} (${INDEX_ROUTES.length} index + ${EXPECTED_CARDS} cards + ${EXPECTED_ECHOES} echoes)`,
    );
  }
  const expectedRouteSet = new Set(expectedRoutes);
  if (expectedRouteSet.size !== expectedRoutes.length) {
    fail('the route contract contains duplicate routes');
  }

  const pages = listPages(DIST);
  if (pages.length !== EXPECTED_TOTAL) {
    fail(
      `dist has ${pages.length} index.html pages, expected ${EXPECTED_TOTAL} (${INDEX_ROUTES.length} index + ${EXPECTED_CARDS} cards + ${EXPECTED_ECHOES} echoes)`,
    );
  }

  const pageRoutes = new Set(pages.map(routeForPage));
  for (const route of expectedRouteSet) {
    if (!pageRoutes.has(route)) {
      fail(
        `missing prerendered page ${route} (expected ${relative(ROOT, pageFile(route))})`,
      );
    }
  }
  for (const route of pageRoutes) {
    if (!expectedRouteSet.has(route)) {
      fail(
        `unexpected prerendered page ${route} (${relative(ROOT, pageFile(route))})`,
      );
    }
  }

  const sitemapPath = join(DIST, 'sitemap.xml');
  if (!existsSync(sitemapPath)) {
    fail('dist/sitemap.xml is missing');
  } else {
    const sitemap = readFileSync(sitemapPath, 'utf8');
    const urlCount = (sitemap.match(/<url\b/gi) ?? []).length;
    const locations = [
      ...sitemap.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi),
    ].map((match) => decodeEntities(match[1]));
    if (urlCount !== EXPECTED_TOTAL) {
      fail(
        `dist/sitemap.xml has ${urlCount} <url> entries, expected ${EXPECTED_TOTAL}`,
      );
    }
    if (locations.length !== urlCount) {
      fail(
        `dist/sitemap.xml has ${urlCount} <url> entries but ${locations.length} <loc> values`,
      );
    }

    const expectedUrls = new Set(
      [...expectedRouteSet].map((route) => `${SITE_ORIGIN}${route}`),
    );
    const seenUrls = new Set();
    for (const location of locations) {
      if (seenUrls.has(location)) {
        fail(`dist/sitemap.xml repeats ${location}`);
      }
      seenUrls.add(location);

      let url;
      try {
        url = new URL(location);
      } catch {
        fail(
          `dist/sitemap.xml has a <loc> that is not an absolute URL: ${JSON.stringify(location)}`,
        );
        continue;
      }
      if (url.origin !== SITE_ORIGIN) {
        fail(`dist/sitemap.xml URL ${location} points outside ${SITE_ORIGIN}`);
        continue;
      }
      if (url.search || url.hash) {
        fail(`dist/sitemap.xml URL ${location} should not carry a query/hash`);
      }
      const file = pageFile(url.pathname);
      if (!existsSync(file)) {
        fail(
          `dist/sitemap.xml URL ${location} has no page file (${relative(ROOT, file)})`,
        );
      }
      if (!expectedUrls.has(location)) {
        fail(
          `dist/sitemap.xml URL ${location} is not in the ${EXPECTED_TOTAL}-route contract`,
        );
      }
    }
    for (const expectedUrl of expectedUrls) {
      if (!seenUrls.has(expectedUrl)) {
        fail(`dist/sitemap.xml is missing ${expectedUrl}`);
      }
    }
  }

  for (const route of expectedRouteSet) {
    if (!pageRoutes.has(route)) continue;
    const html = readFileSync(pageFile(route), 'utf8');

    const canonicalTags = (html.match(/<link\b[^>]*>/gi) ?? []).filter(
      (tag) => (attribute(tag, 'rel') ?? '').toLowerCase() === 'canonical',
    );
    let canonicalHref = null;
    if (canonicalTags.length !== 1) {
      fail(
        `${route}: expected exactly 1 rel="canonical" link, found ${canonicalTags.length}`,
      );
    } else {
      const href = attribute(canonicalTags[0], 'href');
      const expectedHref = `${SITE_ORIGIN}${route}`;
      if (!href) {
        fail(`${route}: rel="canonical" link has no href`);
      } else {
        canonicalHref = decodeEntities(href);
        if (canonicalHref !== expectedHref) {
          fail(
            `${route}: canonical points to ${canonicalHref}, expected ${expectedHref}`,
          );
        }
      }
    }

    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (!titleMatch) {
      fail(`${route}: missing <title>`);
    } else {
      const title = decodeEntities(titleMatch[1]).trim();
      if (!title) {
        fail(`${route}: <title> is empty`);
      }
      for (const name of titleNames.get(route) ?? []) {
        if (!title.includes(name)) {
          fail(
            `${route}: <title> does not contain the entity name ${JSON.stringify(name)} — got ${JSON.stringify(title)}`,
          );
        }
      }
    }

    // P2-B contract: exactly one JSON-LD graph per page, absolute URLs and
    // OG/Twitter tags consistent with the canonical. Zero blocks means the
    // per-page data is missing; two means a static script collided with it.
    const ldScripts = jsonLdScripts(html);
    const schemaType = expectedSchemaType(route);
    if (ldScripts.length !== 1) {
      fail(
        `${route}: expected exactly 1 application/ld+json script, found ${ldScripts.length}`,
      );
    } else {
      let data = null;
      try {
        data = JSON.parse(ldScripts[0].content);
      } catch (error) {
        fail(`${route}: JSON-LD does not parse (${error.message})`);
      }
      if (data) {
        if (data['@context'] !== 'https://schema.org') {
          fail(
            `${route}: JSON-LD @context is ${JSON.stringify(data['@context'])}`,
          );
        }
        if (data['@type'] !== schemaType) {
          fail(
            `${route}: JSON-LD @type is ${JSON.stringify(data['@type'])}, expected ${schemaType}`,
          );
        }
        if (canonicalHref && data.url !== canonicalHref) {
          fail(
            `${route}: JSON-LD url ${JSON.stringify(data.url)} does not match canonical ${canonicalHref}`,
          );
        }
        if ('aggregateRating' in data || 'review' in data || 'offers' in data) {
          fail(`${route}: JSON-LD contains invented rating/review/price data`);
        }
        if (data['@type'] === 'CollectionPage') {
          const items = data.mainEntity?.itemListElement ?? [];
          if (!items.length) {
            fail(`${route}: CollectionPage has no ItemList items`);
          }
          if (data.mainEntity?.numberOfItems !== items.length) {
            fail(
              `${route}: ItemList numberOfItems ${data.mainEntity?.numberOfItems} does not match its ${items.length} entries`,
            );
          }
          for (const item of items) {
            if (!item.name || !item.url || !item.position) {
              fail(`${route}: ItemList entry is missing name/url/position`);
              break;
            }
          }
        }
        if (data['@type'] === 'CreativeWork') {
          for (const field of ['name', 'description', 'image', 'url']) {
            if (!data[field]) {
              fail(`${route}: CreativeWork.${field} is missing`);
            }
          }
          if (!/^https?:\/\//.test(data.image ?? '')) {
            fail(
              `${route}: CreativeWork.image is not an absolute URL: ${JSON.stringify(data.image)}`,
            );
          }
          if (route.startsWith('/echoes/') && !data.about?.name) {
            fail(`${route}: echo CreativeWork.about is missing the character`);
          }
        }
        if (data['@type'] === 'WebSite' && 'potentialAction' in data) {
          fail(`${route}: WebSite must not declare a SearchAction yet`);
        }
      }
    }

    const ogUrls = metaContent(html, 'property', 'og:url');
    const ogTypes = metaContent(html, 'property', 'og:type');
    const ogImages = metaContent(html, 'property', 'og:image');
    const twitterCards = metaContent(html, 'name', 'twitter:card');
    if (ogUrls.length !== 1) {
      fail(`${route}: expected exactly 1 og:url meta, found ${ogUrls.length}`);
    } else if (canonicalHref && ogUrls[0] !== canonicalHref) {
      fail(
        `${route}: og:url ${ogUrls[0]} does not match canonical ${canonicalHref}`,
      );
    }
    if (ogTypes.length !== 1) {
      fail(
        `${route}: expected exactly 1 og:type meta, found ${ogTypes.length}`,
      );
    } else if (ogTypes[0] !== expectedOgType(route)) {
      fail(
        `${route}: og:type ${ogTypes[0]} does not match ${expectedOgType(route)}`,
      );
    }
    if (ogImages.length !== 1) {
      fail(
        `${route}: expected exactly 1 og:image meta, found ${ogImages.length}`,
      );
    } else if (!/^https?:\/\//.test(ogImages[0])) {
      fail(`${route}: og:image is not an absolute URL: ${ogImages[0]}`);
    }
    if (twitterCards.length !== 1) {
      fail(
        `${route}: expected exactly 1 twitter:card meta, found ${twitterCards.length}`,
      );
    } else if (twitterCards[0] !== 'summary_large_image') {
      fail(`${route}: twitter:card is ${JSON.stringify(twitterCards[0])}`);
    }

    for (const placeholder of LOADING_PLACEHOLDERS) {
      if (html.includes(placeholder)) {
        fail(
          `${route}: still contains the client-only placeholder ${JSON.stringify(placeholder)}`,
        );
      }
    }
  }

  if (failures.length) {
    console.error(
      `Prerender verification failed with ${failures.length} issue(s):`,
    );
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Prerender verification passed: ${EXPECTED_TOTAL} pages (${INDEX_ROUTES.length} index + ${EXPECTED_CARDS} cards + ${EXPECTED_ECHOES} echoes), ${EXPECTED_TOTAL} sitemap URLs, one canonical and one JSON-LD graph per page, consistent og:url/og:type/og:image, no loading placeholders.`,
  );
}

main();
