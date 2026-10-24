import {
  FALLBACK_OG_IMAGE,
  SITE_ORIGIN,
  STRUCTURED_DATA_SCRIPT_KEY,
  absoluteUrl,
  buildCardStructuredData,
  buildCollectionPageStructuredData,
  buildEchoStructuredData,
  buildWebApplicationStructuredData,
  buildWebSiteStructuredData,
  firstAbsoluteUrl,
  jsonLdScript,
} from '@/services/structuredData.js';

describe('structuredData.absoluteUrl', () => {
  it('keeps absolute URLs untouched', () => {
    expect(absoluteUrl('https://raw.githubusercontent.com/a/b.png')).toBe(
      'https://raw.githubusercontent.com/a/b.png',
    );
    expect(absoluteUrl('http://example.com/x')).toBe('http://example.com/x');
  });

  it('resolves root-relative, relative and protocol-relative paths', () => {
    expect(absoluteUrl('/cards/1001')).toBe(`${SITE_ORIGIN}/cards/1001`);
    expect(absoluteUrl('cards/1001')).toBe(`${SITE_ORIGIN}/cards/1001`);
    expect(absoluteUrl('//cdn.example.com/a.png')).toBe(
      'https://cdn.example.com/a.png',
    );
  });

  it('returns an empty string for empty input', () => {
    expect(absoluteUrl(null)).toBe('');
    expect(absoluteUrl(undefined)).toBe('');
    expect(absoluteUrl('')).toBe('');
    expect(absoluteUrl('   ')).toBe('');
  });
});

describe('structuredData.firstAbsoluteUrl', () => {
  it('returns the first usable candidate', () => {
    expect(
      firstAbsoluteUrl([
        null,
        '',
        'https://cdn.example.com/card.png',
        '/cardimg/images/1001.png',
      ]),
    ).toBe('https://cdn.example.com/card.png');
  });

  it('falls back to the local 1200x630 OG image', () => {
    expect(firstAbsoluteUrl([null, ''])).toBe(
      `${SITE_ORIGIN}${FALLBACK_OG_IMAGE}`,
    );
  });
});

describe('structuredData.buildCardStructuredData', () => {
  const card = buildCardStructuredData({
    name: 'Glacius',
    alternateName: '冰冻咒',
    description: 'Casts a penetrating Freezing Spell.',
    image: 'https://cdn.example.com/images/1001.png',
    url: '/cards/1001',
  });

  it('builds a CreativeWork for the card', () => {
    expect(card['@context']).toBe('https://schema.org');
    expect(card['@type']).toBe('CreativeWork');
    expect(card.name).toBe('Glacius');
    expect(card.alternateName).toBe('冰冻咒');
    expect(card.description).toBe('Casts a penetrating Freezing Spell.');
    expect(card.image).toBe('https://cdn.example.com/images/1001.png');
    expect(card.url).toBe(`${SITE_ORIGIN}/cards/1001`);
  });

  it('declares the Card Codex as the parent collection', () => {
    expect(card.isPartOf).toEqual({
      '@type': 'CollectionPage',
      name: 'Card Codex',
      url: `${SITE_ORIGIN}/cards`,
    });
  });

  it('never invents price, rating or review data', () => {
    expect(card).not.toHaveProperty('offers');
    expect(card).not.toHaveProperty('aggregateRating');
    expect(card).not.toHaveProperty('review');
  });

  it('omits empty optional fields', () => {
    const bare = buildCardStructuredData({ name: 'Card', url: '/cards/1' });
    expect(bare).not.toHaveProperty('alternateName');
    expect(bare).not.toHaveProperty('description');
    expect(bare).not.toHaveProperty('image');
  });
});

describe('structuredData.buildEchoStructuredData', () => {
  const echo = buildEchoStructuredData({
    name: 'Hermione Granger',
    alternateName: '赫敏·格兰杰',
    description: 'Reduces the MP cost of Spell Cards.',
    image: 'https://cdn.example.com/images/icon_hermione.png',
    url: '/echoes/1001',
    about: {
      name: 'Hermione Granger',
      alternateName: '赫敏·格兰杰',
      description: 'The brightest witch of her age.',
    },
  });

  it('builds a CreativeWork for the echo', () => {
    expect(echo['@type']).toBe('CreativeWork');
    expect(echo.name).toBe('Hermione Granger');
    expect(echo.url).toBe(`${SITE_ORIGIN}/echoes/1001`);
    expect(echo.image).toBe('https://cdn.example.com/images/icon_hermione.png');
  });

  it('describes the character through about', () => {
    expect(echo.about).toEqual({
      '@type': 'Thing',
      name: 'Hermione Granger',
      alternateName: '赫敏·格兰杰',
      description: 'The brightest witch of her age.',
    });
  });

  it('links back to the echo index and never invents ratings/reviews', () => {
    expect(echo.isPartOf).toEqual({
      '@type': 'CollectionPage',
      name: 'Echo Index',
      url: `${SITE_ORIGIN}/echoes`,
    });
    expect(echo).not.toHaveProperty('aggregateRating');
    expect(echo).not.toHaveProperty('review');
    expect(echo).not.toHaveProperty('offers');
  });

  it('omits about when there is no character data', () => {
    const bare = buildEchoStructuredData({ name: 'Echo', url: '/echoes/1' });
    expect(bare).not.toHaveProperty('about');
  });
});

describe('structuredData.buildCollectionPageStructuredData', () => {
  const page = buildCollectionPageStructuredData({
    name: 'HPMA Card Codex',
    description: 'Every card, catalogued.',
    url: '/cards',
    itemListName: 'Cards',
    items: [
      { name: 'Glacius', url: '/cards/1001' },
      { name: 'Incendio', url: '/cards/1002' },
    ],
  });

  it('builds a CollectionPage with an ordered ItemList', () => {
    expect(page['@context']).toBe('https://schema.org');
    expect(page['@type']).toBe('CollectionPage');
    expect(page.name).toBe('HPMA Card Codex');
    expect(page.url).toBe(`${SITE_ORIGIN}/cards`);
    expect(page.mainEntity['@type']).toBe('ItemList');
    expect(page.mainEntity.numberOfItems).toBe(2);
    expect(page.mainEntity.itemListOrder).toBe(
      'https://schema.org/ItemListOrderAscending',
    );
    expect(page.mainEntity.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Glacius',
        url: `${SITE_ORIGIN}/cards/1001`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Incendio',
        url: `${SITE_ORIGIN}/cards/1002`,
      },
    ]);
  });

  it('skips incomplete items and omits an empty list', () => {
    const sparse = buildCollectionPageStructuredData({
      name: 'Echoes',
      url: '/echoes',
      items: [
        { name: 'Hermione', url: '/echoes/1001' },
        { name: '', url: '/echoes/1002' },
        { name: 'Ron' },
        null,
      ],
    });
    expect(sparse.mainEntity.numberOfItems).toBe(1);
    expect(sparse.mainEntity.itemListElement[0].url).toBe(
      `${SITE_ORIGIN}/echoes/1001`,
    );

    const empty = buildCollectionPageStructuredData({
      name: 'Echoes',
      url: '/echoes',
      items: [],
    });
    expect(empty).not.toHaveProperty('mainEntity');
  });
});

describe('structuredData site-level builders', () => {
  it('builds WebSite without a SearchAction', () => {
    const site = buildWebSiteStructuredData({
      name: 'my little hpma bits',
      description: 'An unofficial almanac.',
      url: '/',
    });
    expect(site['@type']).toBe('WebSite');
    expect(site.url).toBe(`${SITE_ORIGIN}/`);
    expect(site).not.toHaveProperty('potentialAction');
    expect(JSON.stringify(site)).not.toContain('SearchAction');
  });

  it('builds a minimal generic WebApplication for tool pages', () => {
    const app = buildWebApplicationStructuredData({
      name: 'HPMA Echo Analytics',
      description: 'Win rate and pick rate statistics.',
      url: '/analytics',
    });
    expect(app['@type']).toBe('WebApplication');
    expect(app.url).toBe(`${SITE_ORIGIN}/analytics`);
    expect(app.applicationCategory).toBe('Game');
    expect(app.operatingSystem).toBe('Web Browser');
    expect(app).not.toHaveProperty('offers');
    expect(app).not.toHaveProperty('aggregateRating');
  });
});

describe('structuredData.jsonLdScript', () => {
  it('wraps the graph in one application/ld+json script', () => {
    const data = buildWebSiteStructuredData({
      name: 'my little hpma bits',
      url: '/',
    });
    const script = jsonLdScript(data);
    expect(script.key).toBe(STRUCTURED_DATA_SCRIPT_KEY);
    expect(script.type).toBe('application/ld+json');
    expect(JSON.parse(script.textContent)).toEqual(data);
  });

  it('escapes markup so a description cannot close the script element', () => {
    const script = jsonLdScript({
      '@type': 'CreativeWork',
      name: '</script><script>alert(1)</script>',
    });
    expect(script.textContent).not.toContain('</script>');
    expect(JSON.parse(script.textContent).name).toBe(
      '</script><script>alert(1)</script>',
    );
  });
});
