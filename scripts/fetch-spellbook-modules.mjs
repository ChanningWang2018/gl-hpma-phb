// Syncs the two 2026-10 spellbook modules from hpma-bits/hpma-spellbook:
//
//   cards/   cards.json  + manifest.json + checksums.txt  -> public/data/spellbook/
//   echoes/  echoes.json + manifest.json + checksums.txt  -> public/data/echoes/
//
// Each module has its own release tag (cards-v*, echoes-v*) and its own
// (schema_version, data_version) axis. The script downloads the data + manifest
// as bare blobs from raw.githubusercontent.com at the immutable tag, audits
// them against that module's checksums.txt, then writes a local version.json
// whose imageBase points back at the same tag. Images stay hot-linked.
//
// Usage:
//   node scripts/fetch-spellbook-modules.mjs            # update (noop if current)
//   node scripts/fetch-spellbook-modules.mjs --check    # exit 2 if either module is newer
//   node scripts/fetch-spellbook-modules.mjs --verify   # audit local data against pinned tags
//   --repo owner/name                                   # override the data repo
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const DATA_ROOT = join(ROOT, 'public', 'data');
const NETLIFY_FILE = join(ROOT, 'netlify.toml');

const DEFAULT_REPO = 'hpma-bits/hpma-spellbook';
const GITHUB_API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const TIMEOUT_MS = 60_000;

const MODULES = [
  {
    id: 'cards',
    dir: 'cards',
    dataFile: 'cards.json',
    target: join(DATA_ROOT, 'spellbook'),
    tagPrefix: 'cards-v',
    label: 'cards',
  },
  {
    id: 'echoes',
    dir: 'echoes',
    dataFile: 'echoes.json',
    target: join(DATA_ROOT, 'echoes'),
    tagPrefix: 'echoes-v',
    label: 'echoes',
  },
];

function parseArgs(argv) {
  const args = { mode: 'update', repo: DEFAULT_REPO };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') args.mode = 'check';
    else if (arg === '--verify') args.mode = 'verify';
    else if (arg === '--repo') {
      const value = argv[i + 1];
      if (!value) throw new Error('--repo needs owner/name');
      args.repo = value;
      i += 1;
    } else if (arg.startsWith('--repo=')) {
      args.repo = arg.slice('--repo='.length);
    } else if (arg === '-h' || arg === '--help') {
      args.mode = 'help';
    } else if (['update', 'check', 'verify'].includes(arg)) {
      args.mode = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function apiHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gl-hpma-phb-spellbook-modules',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchBuffer(url, headers = {}, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const reason =
        error?.name === 'TimeoutError' || error?.name === 'AbortError'
          ? `timeout after ${TIMEOUT_MS}ms`
          : error?.cause?.message || error?.message || String(error);
      lastError = new Error(`download failed: ${url}\n  ${reason}`);
    }
    if (response) {
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
      const retryable = response.status >= 500;
      const error = new Error(
        `download failed: ${url}\n  HTTP ${response.status}`,
      );
      if (!retryable) throw error;
      lastError = error;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

// Fetch a file through the GitHub contents/blobs API instead of raw.*.
// raw.githubusercontent.com is fast for browsers but can be flaky from CI
// and from some networks; the API path is the reliable one for the data
// pipeline. Images still use raw.githubusercontent (hot-linked by the site).
async function fetchRepoFile(repo, ref, path) {
  const encodedPath = path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  const metaUrl = `${GITHUB_API}/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
  const meta = JSON.parse(
    (await fetchBuffer(metaUrl, apiHeaders())).toString('utf8'),
  );
  if (meta?.content && meta?.encoding === 'base64') {
    return Buffer.from(meta.content, 'base64');
  }
  if (!meta?.sha) {
    throw new Error(`GitHub contents API returned no sha for ${path}`);
  }
  const blobUrl = `${GITHUB_API}/repos/${repo}/git/blobs/${meta.sha}`;
  const blob = JSON.parse(
    (await fetchBuffer(blobUrl, apiHeaders())).toString('utf8'),
  );
  if (blob?.encoding !== 'base64' || typeof blob.content !== 'string') {
    throw new Error(`GitHub blobs API returned no base64 content for ${path}`);
  }
  return Buffer.from(blob.content, 'base64');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// sha256sum-style lines: "<64-hex> *<path>" or "<64-hex>  <path>".
// Paths may carry a redundant module prefix; normalize to module-relative.
export function parseChecksums(text, moduleDir = '') {
  const entries = new Map();
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (!match) {
      throw new Error(`unparseable checksums line: ${line.slice(0, 80)}`);
    }
    let key = match[2].trim();
    if (moduleDir && key.startsWith(`${moduleDir}/`)) {
      key = key.slice(moduleDir.length + 1);
    }
    if (key.startsWith('./')) key = key.slice(2);
    entries.set(key, match[1].toLowerCase());
  }
  return entries;
}

export function moduleVersion(tag, prefix) {
  if (typeof tag !== 'string' || !tag.startsWith(prefix)) return null;
  const value = tag.slice(prefix.length);
  return /^\d+\.\d+\.\d+$/.test(value) ? value : null;
}

export function buildVersionJson({ tag, manifest, repo, module, prefix }) {
  const numericDataVersion = Number(manifest.data_version);
  return {
    tag,
    version: moduleVersion(tag, prefix),
    schemaVersion: manifest.schema_version,
    dataVersion: Number.isFinite(numericDataVersion)
      ? numericDataVersion
      : manifest.data_version,
    imageBase: `${RAW}/${repo}/${tag}/${module.dir}/`,
    imagesWebp:
      typeof manifest.webp_images === 'string' && manifest.webp_images
        ? manifest.webp_images
        : null,
    generatedAt: manifest.generated_at,
  };
}

export function syncNetlifyTags(text, tags) {
  let next = text;
  if (tags.cards) {
    next = next.replace(
      /(hpma-bits\/hpma-spellbook\/)cards-v\d+\.\d+\.\d+/g,
      `$1${tags.cards}`,
    );
  }
  if (tags.echoes) {
    next = next.replace(
      /(hpma-bits\/hpma-spellbook\/)echoes-v\d+\.\d+\.\d+/g,
      `$1${tags.echoes}`,
    );
  }
  return next;
}

async function latestRelease(repo, module) {
  const url = `${GITHUB_API}/repos/${repo}/releases?per_page=30`;
  const body = JSON.parse(
    (await fetchBuffer(url, apiHeaders())).toString('utf8'),
  );
  if (!Array.isArray(body)) {
    throw new Error(`unexpected GitHub releases response for ${repo}`);
  }
  const candidates = body
    .filter(
      (release) =>
        !release.draft &&
        !release.prerelease &&
        moduleVersion(release.tag_name, module.tagPrefix),
    )
    .sort(
      (a, b) =>
        new Date(b.published_at ?? b.created_at) -
        new Date(a.published_at ?? a.created_at),
    );
  const release = candidates[0];
  if (!release) {
    throw new Error(
      `no ${module.tagPrefix}* release found in ${repo} (${url})`,
    );
  }
  return {
    tag: release.tag_name,
    version: moduleVersion(release.tag_name, module.tagPrefix),
    publishedAt: release.published_at,
  };
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function validateModuleData(module, data, manifest) {
  if (!data || typeof data !== 'object') {
    throw new Error(`${module.dataFile} is not a JSON object`);
  }
  if (data.schema_version !== manifest.schema_version) {
    throw new Error(
      `${module.dataFile} schema_version=${data.schema_version}, ` +
        `manifest schema_version=${manifest.schema_version}`,
    );
  }
  if (String(data.data_version) !== String(manifest.data_version)) {
    throw new Error(
      `${module.dataFile} data_version=${data.data_version}, ` +
        `manifest data_version=${manifest.data_version}`,
    );
  }
  if (manifest.dataset && manifest.dataset !== module.id) {
    throw new Error(
      `manifest dataset=${manifest.dataset}, expected ${module.id}`,
    );
  }
  if (module.id === 'cards' && !Array.isArray(data.cards)) {
    throw new Error('cards.json has no cards array');
  }
  if (
    module.id === 'echoes' &&
    (!Array.isArray(data.echoes) || !Array.isArray(data.characters))
  ) {
    throw new Error('echoes.json has no echoes/characters arrays');
  }
}

function auditChecksums(module, checksums, payloads) {
  const problems = [];
  for (const [file, buffer] of Object.entries(payloads)) {
    const expected = checksums.get(file);
    if (!expected) {
      problems.push(`checksums.txt has no entry for ${file}`);
      continue;
    }
    const actual = sha256(buffer);
    if (actual !== expected) {
      problems.push(
        `${file} sha256 mismatch: downloaded ${actual}, checksums ${expected}`,
      );
    }
  }
  if (problems.length) {
    throw new Error(
      `${module.id} checksum audit failed:\n  - ${problems.join('\n  - ')}`,
    );
  }
}

function writeIfChanged(file, buffer) {
  const next = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (existsSync(file)) {
    const current = readFileSync(file);
    if (current.equals(next)) return false;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, next);
  return true;
}

async function downloadModule(repo, module) {
  const release = await latestRelease(repo, module);
  const [dataBuf, manifestBuf, checksumsBuf] = await Promise.all([
    fetchRepoFile(repo, release.tag, `${module.dir}/${module.dataFile}`),
    fetchRepoFile(repo, release.tag, `${module.dir}/manifest.json`),
    fetchRepoFile(repo, release.tag, `${module.dir}/checksums.txt`),
  ]);
  const data = JSON.parse(dataBuf.toString('utf8'));
  const manifest = JSON.parse(manifestBuf.toString('utf8'));
  validateModuleData(module, data, manifest);
  const checksums = parseChecksums(checksumsBuf.toString('utf8'), module.dir);
  auditChecksums(module, checksums, {
    [module.dataFile]: dataBuf,
    'manifest.json': manifestBuf,
  });
  return { release, data, manifest, dataBuf, manifestBuf };
}

async function check(repo) {
  let stale = false;
  for (const module of MODULES) {
    const local = readJson(join(module.target, 'version.json'));
    const latest = await latestRelease(repo, module);
    const same = local?.tag === latest.tag;
    console.log(
      `${module.id}: local ${local?.tag ?? '(missing)'} / latest ${latest.tag} ` +
        `${same ? 'ok' : 'NEW'}`,
    );
    if (!same) stale = true;
  }
  process.exitCode = stale ? 2 : 0;
}

async function verify(repo) {
  const problems = [];
  for (const module of MODULES) {
    const version = readJson(join(module.target, 'version.json'));
    if (!version?.tag) {
      problems.push(`${module.id}: version.json missing or has no tag`);
      continue;
    }
    try {
      const [dataBuf, manifestBuf, checksumsBuf] = await Promise.all([
        fetchRepoFile(repo, version.tag, `${module.dir}/${module.dataFile}`),
        fetchRepoFile(repo, version.tag, `${module.dir}/manifest.json`),
        fetchRepoFile(repo, version.tag, `${module.dir}/checksums.txt`),
      ]);
      const data = JSON.parse(dataBuf.toString('utf8'));
      const manifest = JSON.parse(manifestBuf.toString('utf8'));
      validateModuleData(module, data, manifest);
      const checksums = parseChecksums(
        checksumsBuf.toString('utf8'),
        module.dir,
      );
      auditChecksums(module, checksums, {
        [module.dataFile]: dataBuf,
        'manifest.json': manifestBuf,
      });
      const localData = readFileSync(join(module.target, module.dataFile));
      const localManifest = readFileSync(join(module.target, 'manifest.json'));
      if (sha256(localData) !== sha256(dataBuf)) {
        problems.push(`${module.id}: local ${module.dataFile} differs`);
      }
      if (sha256(localManifest) !== sha256(manifestBuf)) {
        problems.push(`${module.id}: local manifest.json differs`);
      }
      console.log(`${module.id}: ${version.tag} ok`);
    } catch (error) {
      problems.push(`${module.id}: ${error.message}`);
    }
  }
  if (problems.length) {
    console.error(`verify failed:\n  - ${problems.join('\n  - ')}`);
    process.exitCode = 1;
  } else {
    console.log('verify ok');
  }
}

async function update(repo) {
  const tags = {};
  let changed = false;
  for (const module of MODULES) {
    const local = readJson(join(module.target, 'version.json'));
    const latest = await latestRelease(repo, module);
    if (local?.tag === latest.tag) {
      console.log(`${module.id}: ${latest.tag} (noop)`);
      tags[module.id] = latest.tag;
      continue;
    }
    const downloaded = await downloadModule(repo, module);
    const version = buildVersionJson({
      tag: downloaded.release.tag,
      manifest: downloaded.manifest,
      repo,
      module,
      prefix: module.tagPrefix,
    });
    const dataChanged = writeIfChanged(
      join(module.target, module.dataFile),
      downloaded.dataBuf,
    );
    const manifestChanged = writeIfChanged(
      join(module.target, 'manifest.json'),
      downloaded.manifestBuf,
    );
    const versionChanged = writeIfChanged(
      join(module.target, 'version.json'),
      `${JSON.stringify(version, null, 2)}\n`,
    );
    tags[module.id] = downloaded.release.tag;
    changed = changed || dataChanged || manifestChanged || versionChanged;
    const count =
      module.id === 'cards'
        ? `${downloaded.data.cards.length} cards`
        : `${downloaded.data.echoes.length} echoes / ${downloaded.data.characters.length} characters`;
    console.log(
      `${module.id}: ${local?.tag ?? '(missing)'} -> ${downloaded.release.tag} (${count})`,
    );
  }

  const toml = readFileSync(NETLIFY_FILE, 'utf8');
  const nextToml = syncNetlifyTags(toml, tags);
  if (nextToml !== toml) {
    writeFileSync(NETLIFY_FILE, nextToml);
    changed = true;
    console.log('netlify.toml proxy tags synced');
  }

  if (!changed) console.log('all modules already current');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'help') {
    console.log(`usage:
  node scripts/fetch-spellbook-modules.mjs [update]
  node scripts/fetch-spellbook-modules.mjs --check
  node scripts/fetch-spellbook-modules.mjs --verify
  --repo owner/name`);
    return;
  }
  if (args.mode === 'check') return check(args.repo);
  if (args.mode === 'verify') return verify(args.repo);
  return update(args.repo);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
