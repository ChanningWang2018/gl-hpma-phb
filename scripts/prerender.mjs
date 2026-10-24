// Prerender the SPA into static HTML for the indexable routes:
//
//   /  /analytics  /cards  /echoes  /quiz  /sales-optimizer  /resources
//   /methodology  /changelog
//   /cards/:id   (141)
//   /echoes/:id  (19 deck characters)
//
// The site is a client-rendered Vue app; this script builds it, serves dist/
// with the SPA fallback, opens each route in a headless Chromium, waits for the
// page's data state, and writes document.documentElement.outerHTML to
// dist/<route>/index.html. useHead() has already written the per-entity
// title/description/canonical/OG tags by then.
//
// Browser: puppeteer-core, using CHROME_PATH or an installed Edge/Chrome.
// Images are fulfilled with a 1x1 transparent PNG during prerender so the
// captured markup keeps the real <img src> without waiting on the CDN.
import { createServer } from 'node:http';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const INDEX_FILE = join(DIST, 'index.html');

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2S8AAAAASUVORK5CYII=',
  'base64',
);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8'));
}

function systemChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function resolveBrowser() {
  // An explicit CHROME_PATH / PUPPETEER_EXECUTABLE_PATH always wins (local
  // override when the downloaded browser is unusable); then Puppeteer's
  // downloaded browser (extracted on install in CI/Netlify); then an
  // installed Edge/Chrome. puppeteer >= 22 returns a Promise from
  // executablePath(), so this must be awaited.
  const override = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ].find((candidate) => candidate && existsSync(candidate));
  if (override) return override;
  try {
    const bundled = await puppeteer.executablePath();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    // fall through to the system lookup
  }
  const system = systemChromePath();
  if (!system) {
    throw new Error(
      'No Chromium found. Set CHROME_PATH or install Puppeteer with its browser.',
    );
  }
  return system;
}

function buildRoutes() {
  const cards = readJson('public/data/spellbook/cards.json');
  const echoes = readJson('public/data/echoes/echoes.json');
  const routes = [
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
  for (const card of cards.cards ?? []) {
    routes.push(`/cards/${card.id}`);
  }
  for (const character of echoes.characters ?? []) {
    if (character.deck) routes.push(`/echoes/${character.id}`);
  }
  return routes;
}

function waitSelector(route) {
  if (route.startsWith('/cards/')) return '.card-name, .card-missing';
  if (route.startsWith('/echoes/')) return '.echo-title, .echo-missing';
  if (route === '/cards') return '.card-grid, .codex-empty, .codex-error';
  if (route === '/echoes') return '.echo-grid';
  if (route === '/analytics') return '#dataTable, .error-message';
  if (route === '/') return '.masthead .issue-no';
  return 'main h1';
}

function startServer() {
  const originalIndex = readFileSync(INDEX_FILE);
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      pathname = url.pathname;
    }
    const safePath = resolve(DIST, `.${pathname}`);
    if (!safePath.startsWith(resolve(DIST))) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const candidates = [safePath];
    if (pathname.endsWith('/'))
      candidates.unshift(join(safePath, 'index.html'));
    else candidates.push(join(safePath, 'index.html'));
    for (const candidate of candidates) {
      try {
        if (statSync(candidate).isFile()) {
          const body = readFileSync(candidate);
          response.writeHead(200, {
            'Content-Type':
              MIME[extname(candidate).toLowerCase()] ??
              'application/octet-stream',
          });
          response.end(body);
          return;
        }
      } catch {
        // try the next candidate
      }
    }
    // SPA fallback: keep the original app shell in memory, so writing the
    // prerendered home page last cannot poison the fallback for other routes.
    response.writeHead(200, { 'Content-Type': MIME['.html'] });
    response.end(originalIndex);
  });
  return new Promise((resolvePort) => {
    server.listen(0, '127.0.0.1', () => {
      resolvePort({ server, port: server.address().port });
    });
  });
}

function outputFile(route) {
  if (route === '/') return INDEX_FILE;
  return join(DIST, route.replace(/^\//, ''), 'index.html');
}

async function renderRoute(browser, baseUrl, route) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const type = request.resourceType();
      if (type === 'image') {
        request
          .respond({
            status: 200,
            contentType: 'image/png',
            body: TRANSPARENT_PNG,
          })
          .catch(() => {});
        return;
      }
      if (type === 'font' || type === 'media') {
        request.abort().catch(() => {});
        return;
      }
      // Drop third-party requests (analytics, fonts, embeds). The app only
      // needs its own origin; letting a slow or blocked external host hold
      // the page open is what made the first Netlify build exceed its budget.
      if (!request.url().startsWith(baseUrl)) {
        request.abort().catch(() => {});
        return;
      }
      request.continue().catch(() => {});
    });

    try {
      await page.goto(`${baseUrl}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });
      // Every selector below is data-dependent (home waits for the issue
      // number, analytics for the table, details for the entity name), so the
      // selector is the readiness signal. A short settle replaces the old
      // 8s network-idle wait.
      await page.waitForSelector(waitSelector(route), { timeout: 15_000 });
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
      const html = await page.content();
      const file = outputFile(route);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, html);
      return file;
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    } finally {
      await page.close().catch(() => {});
    }
  }
  throw lastError;
}

async function main() {
  if (!existsSync(INDEX_FILE)) {
    throw new Error('dist/index.html missing — run `npm run build` first.');
  }
  const shell = readFileSync(INDEX_FILE, 'utf8');
  if (!shell.includes('<div id="app"></div>')) {
    throw new Error(
      'dist/index.html is already prerendered — run `npm run build` first.',
    );
  }
  const allRoutes = buildRoutes();
  const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const workersArg = process.argv.find((arg) => arg.startsWith('--workers='));
  let routes = onlyArg ? [onlyArg.slice('--only='.length)] : allRoutes;
  if (limitArg) routes = routes.slice(0, Number(limitArg.slice(8)) || 0);

  // Home last: the static server keeps the original shell in memory, but
  // writing the home page last also keeps the fallback file untouched longest.
  routes = [
    ...routes.filter((route) => route !== '/'),
    ...routes.filter((route) => route === '/'),
  ];

  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: await resolveBrowser(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let cursor = 0;
  let completed = 0;
  const requestedWorkers =
    Number(workersArg?.slice('--workers='.length)) ||
    Number(process.env.PRERENDER_WORKERS) ||
    4;
  const workers = Math.max(1, Math.min(requestedWorkers, routes.length));
  try {
    await Promise.all(
      Array.from({ length: workers }, async () => {
        while (cursor < routes.length) {
          const route = routes[cursor];
          cursor += 1;
          try {
            await renderRoute(browser, baseUrl, route);
            completed += 1;
            if (completed % 10 === 0 || completed === routes.length) {
              console.log(`prerendered ${completed}/${routes.length}`);
            }
          } catch (error) {
            console.error(`prerender failed: ${route}\n  ${error.message}`);
            throw error;
          }
        }
      }),
    );
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  console.log(`prerender done: ${completed} routes -> dist/`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
