// Build-time sitemap definition. The Vite sitemap plugin supports an async
// default export, so this file can read the committed data and emit one URL
// per card / player-visible echo instead of a hand-maintained list.
//
// The site is a single-URL bilingual app (zh/en via localStorage), so each
// entity has exactly one canonical URL here. Path-level locales would add
// /zh/ and /en/ variants later.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://grimmauldplace.top';

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8'));
}

export default async function sitemapRoutes() {
  const cards = readJson('public/data/spellbook/cards.json');
  const echoes = readJson('public/data/echoes/echoes.json');
  const trends = readJson('public/archive/trends.json');
  const changelog = readJson('src/data/changelog.json');

  const cardsUpdated = String(cards.generated_at ?? '').slice(0, 10);
  const echoesUpdated = String(echoes.generated_at ?? '').slice(0, 10);
  const trendsUpdated = String(trends.generatedAt ?? '').slice(0, 10);
  const changelogUpdated = String(changelog.updated ?? '').slice(0, 10);

  const routes = [
    {
      url: `${BASE}/`,
      changefreq: 'weekly',
      priority: 1.0,
      lastmod: trendsUpdated || undefined,
    },
    {
      url: `${BASE}/analytics`,
      changefreq: 'weekly',
      priority: 0.9,
      lastmod: trendsUpdated || undefined,
    },
    {
      url: `${BASE}/cards`,
      changefreq: 'weekly',
      priority: 0.9,
      lastmod: cardsUpdated || undefined,
    },
    {
      url: `${BASE}/echoes`,
      changefreq: 'weekly',
      priority: 0.9,
      lastmod: echoesUpdated || undefined,
    },
    {
      url: `${BASE}/sales-optimizer`,
      changefreq: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE}/quiz`,
      changefreq: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE}/resources`,
      changefreq: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/methodology`,
      changefreq: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/changelog`,
      changefreq: 'monthly',
      priority: 0.5,
      lastmod: changelogUpdated || undefined,
    },
  ];

  for (const card of cards.cards ?? []) {
    routes.push({
      url: `${BASE}/cards/${card.id}`,
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: cardsUpdated || undefined,
    });
  }

  for (const character of echoes.characters ?? []) {
    if (!character.deck) continue;
    routes.push({
      url: `${BASE}/echoes/${character.id}`,
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: echoesUpdated || undefined,
    });
  }

  return routes;
}
