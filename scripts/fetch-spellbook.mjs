// Syncs the committed spellbook data in public/data/spellbook/ with the
// upstream hpma-data GitHub release, so game data updates reach the site
// without hand-edited JSON drift.
//
// Usage:
//   node scripts/fetch-spellbook.mjs           # update (default): pull latest release, noop if current
//   node scripts/fetch-spellbook.mjs --check   # exit 2 when upstream is newer, 0 otherwise
//   node scripts/fetch-spellbook.mjs --verify  # audit local data against the pinned tag's checksums.txt
//   --repo owner/name                          # override data repo (env: HPMA_DATA_REPO)
//
// Data source: release tags named spellbook-vX.Y.Z on the public hpma-data
// repo. The three needed files (checksums.txt, cards.json, manifest.json)
// are downloaded as bare blobs from raw.githubusercontent.com at the
// immutable tag and sha256-audited against checksums.txt — integrity is
// equivalent to the release zip without unzipping it.
// Zero npm dependencies: node built-ins only.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DATA_DIR = join(REPO_ROOT, 'public', 'data', 'spellbook');
const CARDS_FILE = join(DATA_DIR, 'cards.json');
const MANIFEST_FILE = join(DATA_DIR, 'manifest.json');
const VERSION_FILE = join(DATA_DIR, 'version.json');
const NETLIFY_FILE = join(REPO_ROOT, 'netlify.toml');

const DEFAULT_REPO = 'ChanningWang2018/hpma-data';
const GITHUB_API_BASE = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';
const IMAGE_BASE_TEMPLATE =
  'https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@{tag}/spellbook/';
const FETCH_TIMEOUT_MS = 60_000;
const DIFF_PREVIEW_LIMIT = 15;
// Keep in sync with EXPECTED_SCHEMA_VERSION in src/services/spellbookClient.js:
// a schema bump requires consumer-code adaptation BEFORE new data is ingested.
export const EXPECTED_SCHEMA_VERSION = 3;

const TAG_PATTERN = /^spellbook-v(\d+\.\d+\.\d+)$/;

// ========== Pure helpers (unit-tested, no I/O) ==========

// 'spellbook-v1.1.0' -> '1.1.0'; anything else -> null.
export function matchSpellbookTag(tag) {
  if (typeof tag !== 'string') return null;
  const match = tag.match(TAG_PATTERN);
  return match ? match[1] : null;
}

// Numeric semver-style comparison for 'X.Y.Z' strings: -1 | 0 | 1.
// Components compare numerically ('1.10.0' > '1.9.0'), missing -> 0.
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const na = Number.isFinite(pa[i]) ? pa[i] : 0;
    const nb = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

// Rewrites the @spellbook-vX.Y.Z marker inside an imageBase to the new tag.
// Bases without the marker (e.g. a pinned proxy path) are kept as-is; an
// empty base falls back to the default jsDelivr template for the tag.
export function swapTagInImageBase(imageBase, tag) {
  if (!imageBase) return IMAGE_BASE_TEMPLATE.replace('{tag}', tag);
  if (/@spellbook-v\d+\.\d+\.\d+/.test(imageBase)) {
    return imageBase.replace(/@spellbook-v\d+\.\d+\.\d+/, `@${tag}`);
  }
  return imageBase;
}

// The /cardimg/* transparent proxy in netlify.toml hotlinks the same jsDelivr
// tag as version.json's imageBase — bump it in lockstep on every update so L2
// serves the new release's images too (L1 alone would go stale there).
export function syncNetlifyRedirectTag(tomlText, tag) {
  const pattern = /(hpma-data@)spellbook-v\d+\.\d+\.\d+/g;
  if (!pattern.test(tomlText)) return { text: tomlText, changed: false };
  return {
    text: tomlText.replace(pattern, `$1${tag}`),
    changed: true,
  };
}

// Added/removed card ids between two cards.json payloads, each entry carrying
// the display name (zh preferred, en fallback) for human-readable summaries.
export function diffCardIds(oldCards, newCards) {
  const displayName = (card) =>
    card?.i18n?.zh?.name || card?.i18n?.en?.name || String(card?.id);
  const oldIds = new Set((oldCards || []).map((card) => card.id));
  const newIds = new Set((newCards || []).map((card) => card.id));
  return {
    added: (newCards || [])
      .filter((card) => !oldIds.has(card.id))
      .map((card) => ({ id: card.id, name: displayName(card) })),
    removed: (oldCards || [])
      .filter((card) => !newIds.has(card.id))
      .map((card) => ({ id: card.id, name: displayName(card) })),
  };
}

// Parses sha256sum-style lines: "<64-hex> *<path>" (binary) or
// "<64-hex>  <path>" (text). Real upstream format uses the binary marker.
// Paths may carry a redundant "spellbook/" prefix (repo-root vs dir-relative
// listings) — both are normalized to the dir-relative key. Blank and "#"
// comment lines are skipped; anything else fails loudly.
export function parseChecksums(text) {
  const entries = new Map();
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (!match) {
      throw new Error(
        `checksums.txt 第 ${i + 1} 行无法解析：${line.slice(0, 80)}`,
      );
    }
    entries.set(normalizeChecksumPath(match[2].trim()), match[1].toLowerCase());
  }
  return entries;
}

// Looks up a checksum by file path, tolerating the "spellbook/" prefix.
export function checksumFor(checksums, path) {
  return checksums.get(normalizeChecksumPath(path)) || null;
}

function normalizeChecksumPath(path) {
  return String(path)
    .replace(/^\/+/, '')
    .replace(/^spellbook\//, '');
}

// Structural gate for a freshly downloaded cards.json. Returns null when the
// payload is consumable, or a Chinese error message explaining why it is
// rejected (a schema bump means the site's loader must be upgraded first).
export function validateCardsPayload(cardsJson) {
  if (!cardsJson || typeof cardsJson !== 'object' || Array.isArray(cardsJson)) {
    return 'cards.json 顶层不是 JSON 对象';
  }
  const schema = cardsJson.schema_version;
  if (schema !== EXPECTED_SCHEMA_VERSION) {
    const shown = schema === undefined ? '缺失' : String(schema);
    return (
      `cards.json schema_version=${shown}，` +
      `消费端 spellbookClient 需升级` +
      `（EXPECTED_SCHEMA_VERSION=${EXPECTED_SCHEMA_VERSION}），拒绝入库`
    );
  }
  if (!Array.isArray(cardsJson.cards) || cardsJson.cards.length === 0) {
    return 'cards.json 的 cards 数组为空，疑似坏包';
  }
  return null;
}

// Assembles the version.json document consumed by the UI and --verify.
// Key order matches the T1-committed file byte for byte.
export function buildVersionJson({ tag, manifest, previousImageBase }) {
  return {
    tag,
    version: matchSpellbookTag(tag),
    schemaVersion: manifest.schema_version,
    dataVersion: manifest.data_version,
    imageBase: swapTagInImageBase(previousImageBase, tag),
    generatedAt: manifest.generated_at,
  };
}

// "1001:冰冻咒, 1002:石礅出动" — capped so weekly summaries stay readable.
export function formatCardDiffList(entries, limit = DIFF_PREVIEW_LIMIT) {
  const preview = (entries || [])
    .slice(0, limit)
    .map((entry) => `${entry.id}:${entry.name}`)
    .join(', ');
  const total = (entries || []).length;
  if (total > limit) return `${preview} ...等 ${total} 张`;
  return preview || '（无）';
}

// ========== Network helpers (not unit-tested) ==========

function githubApiHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gl-hpma-phb-spellbook-fetcher',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  // Raises the API rate limit in CI; harmless when absent.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchBuffer(url, headers = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      error?.name === 'TimeoutError' || error?.name === 'AbortError';
    const reason = timedOut
      ? `请求超时（>${FETCH_TIMEOUT_MS}ms）`
      : error?.cause?.message || error?.message || String(error);
    throw new Error(`下载失败：${url}\n  原因：${reason}`);
  }
  if (!response.ok) {
    throw new Error(
      `下载失败：${url}\n  HTTP 状态码：${response.status} ${response.statusText || ''}`.trimEnd(),
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

function rawFileUrl(repo, tag, fileName) {
  return `${RAW_BASE}/${repo}/${tag}/spellbook/${fileName}`;
}

async function fetchLatestTag(repo) {
  const url = `${GITHUB_API_BASE}/repos/${repo}/releases/latest`;
  let body;
  try {
    const buffer = await fetchBuffer(url, githubApiHeaders());
    body = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`GitHub API 返回了非 JSON 响应：${url}`);
    }
    if (/HTTP 状态码：403/.test(error.message)) {
      throw new Error(
        `${error.message}\n  提示：403 多为 API 限流，设置 GITHUB_TOKEN 环境变量可提高限额`,
      );
    }
    throw error;
  }
  const tag = body?.tag_name;
  const version = matchSpellbookTag(tag);
  if (!version) {
    throw new Error(
      `GitHub API 返回的 latest release tag 不符合 spellbook-vX.Y.Z 约定：` +
        `${JSON.stringify(tag ?? null)}（${url}）`,
    );
  }
  return { tag, version };
}

function resolveRepo(options) {
  const repo = options.repo || process.env.HPMA_DATA_REPO || DEFAULT_REPO;
  if (!/^[^\s/]+\/[^\s/]+$/.test(repo)) {
    throw new Error(`仓名格式应为 owner/repo，收到：${JSON.stringify(repo)}`);
  }
  return repo;
}

// ========== Local I/O ==========

function readLocalVersionInfo() {
  if (!existsSync(VERSION_FILE)) return null;
  const info = JSON.parse(readFileSync(VERSION_FILE, 'utf8'));
  if (!info || typeof info.tag !== 'string') {
    throw new Error(`version.json 缺少 tag 字段：${VERSION_FILE}`);
  }
  return info;
}

function readLocalCards() {
  if (!existsSync(CARDS_FILE)) return null;
  return JSON.parse(readFileSync(CARDS_FILE, 'utf8'));
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function auditChecksum(checksums, key, buffer) {
  const expected = checksumFor(checksums, key);
  if (!expected) return `checksums.txt 中没有 ${key} 的条目`;
  const actual = sha256Hex(buffer);
  return actual === expected
    ? null
    : `${key} sha256 不匹配：下载 ${actual}，清单 ${expected}`;
}

function auditLocalFile(checksums, localFile, key) {
  const expected = checksumFor(checksums, key);
  if (!expected) return `checksums.txt 中没有 ${key} 的条目`;
  const actual = sha256Hex(readFileSync(localFile));
  return actual === expected
    ? null
    : `${key} sha256 不匹配：本地 ${actual}，上游 ${expected}`;
}

// ========== Commands ==========

// --check: exit 2 when upstream is strictly newer, 0 when current (or local
// is already ahead). One-line verdict either way.
async function runCheck(repo) {
  const local = readLocalVersionInfo();
  const { tag, version: remoteVersion } = await fetchLatestTag(repo);
  if (!local) {
    console.log(`本地尚无 spellbook 数据，上游最新 ${tag}`);
    process.exitCode = 2;
    return;
  }
  const localVersion = matchSpellbookTag(local.tag) || '0.0.0';
  if (compareVersions(remoteVersion, localVersion) > 0) {
    console.log(`有新版本：${local.tag} -> ${tag}`);
    process.exitCode = 2;
  } else {
    console.log(`已是最新：本地 ${local.tag}，上游 ${tag}`);
  }
}

// update (default): download -> sha256 audit -> structural gate -> write.
async function runUpdate(repo) {
  const local = readLocalVersionInfo();
  const { tag, version: newVersion } = await fetchLatestTag(repo);
  if (local && local.tag === tag) {
    console.log(`already up to date（${tag}）`);
    return;
  }

  console.log(
    `发现新版本：${local ? local.tag : '（无本地数据）'} -> ${tag}，下载三文件...`,
  );
  const [checksumsBuf, cardsBuf, manifestBuf] = await Promise.all([
    fetchBuffer(rawFileUrl(repo, tag, 'checksums.txt')),
    fetchBuffer(rawFileUrl(repo, tag, 'cards.json')),
    fetchBuffer(rawFileUrl(repo, tag, 'manifest.json')),
  ]);

  const checksums = parseChecksums(checksumsBuf.toString('utf8'));
  const checksumProblems = [
    auditChecksum(checksums, 'cards.json', cardsBuf),
    auditChecksum(checksums, 'manifest.json', manifestBuf),
  ].filter(Boolean);
  if (checksumProblems.length > 0) {
    throw new Error(
      `sha256 校验失败，拒绝入库：\n  - ${checksumProblems.join('\n  - ')}`,
    );
  }

  let cardsJson;
  let manifestJson;
  try {
    cardsJson = JSON.parse(cardsBuf.toString('utf8'));
    manifestJson = JSON.parse(manifestBuf.toString('utf8'));
  } catch (error) {
    throw new Error(`下载的 JSON 无法解析：${error.message}`);
  }

  const schemaProblem = validateCardsPayload(cardsJson);
  if (schemaProblem) {
    console.error(`拒绝入库：${schemaProblem}`);
    process.exitCode = 1;
    return;
  }
  if (
    manifestJson.schema_version !== cardsJson.schema_version ||
    typeof manifestJson.data_version !== 'number' ||
    typeof manifestJson.generated_at !== 'string'
  ) {
    console.error(
      '拒绝入库：manifest.json 缺少 schema_version/data_version/generated_at，无法组装 version.json',
    );
    process.exitCode = 1;
    return;
  }

  let oldCards = [];
  try {
    oldCards = readLocalCards()?.cards || [];
  } catch {
    console.warn('本地旧 cards.json 无法解析，diff 摘要按空集处理');
  }

  const diff = diffCardIds(oldCards, cardsJson.cards);
  const versionInfo = buildVersionJson({
    tag,
    manifest: manifestJson,
    previousImageBase: local?.imageBase,
  });

  writeFileSync(CARDS_FILE, cardsBuf);
  writeFileSync(MANIFEST_FILE, manifestBuf);
  writeFileSync(VERSION_FILE, `${JSON.stringify(versionInfo, null, 2)}\n`);

  // /cardimg/* 代理与 imageBase 同 tag：不随版本升级会让 L2 兜底供旧图
  if (existsSync(NETLIFY_FILE)) {
    const toml = readFileSync(NETLIFY_FILE, 'utf8');
    const synced = syncNetlifyRedirectTag(toml, tag);
    if (synced.changed) {
      writeFileSync(NETLIFY_FILE, synced.text);
      console.log(`netlify.toml /cardimg/ 代理 tag 已同步为 ${tag}`);
    } else {
      console.warn(
        'netlify.toml 未找到 hpma-data@spellbook-v* 代理行，跳过同步',
      );
    }
  }

  const oldLabel = local
    ? `${local.tag}（${oldCards.length} 卡）`
    : '（无本地数据）';
  console.log(
    `spellbook 数据已入库：${oldLabel} -> ${tag}（${cardsJson.cards.length} 卡，` +
      `generated_at=${manifestJson.generated_at}）`,
  );
  console.log(
    `新增 ${diff.added.length} 张：${formatCardDiffList(diff.added)}`,
  );
  console.log(
    `移除 ${diff.removed.length} 张：${formatCardDiffList(diff.removed)}`,
  );
  console.log('已写入 public/data/spellbook/{cards,manifest,version}.json');
}

// --verify: CI drift guard. Local files are audited against the pinned tag's
// checksums.txt, and version.json must agree with manifest.json's schema /
// data version / generatedAt / imageBase tag.
async function runVerify(repo) {
  const problems = [];

  let local = null;
  try {
    local = readLocalVersionInfo();
  } catch (error) {
    problems.push(`version.json 无法读取：${error.message}`);
  }
  if (!local) problems.push(`缺少 ${VERSION_FILE}（先运行 update 入库）`);

  const missingFiles = [CARDS_FILE, MANIFEST_FILE].filter(
    (file) => !existsSync(file),
  );
  missingFiles.forEach((file) => problems.push(`缺少 ${file}`));

  let cardsJson = null;
  let manifestJson = null;
  if (missingFiles.length === 0) {
    try {
      cardsJson = JSON.parse(readFileSync(CARDS_FILE, 'utf8'));
    } catch (error) {
      problems.push(`cards.json 不是合法 JSON：${error.message}`);
    }
    try {
      manifestJson = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
    } catch (error) {
      problems.push(`manifest.json 不是合法 JSON：${error.message}`);
    }
  }

  const tag = local?.tag;
  const version = matchSpellbookTag(tag);
  if (local && !version) {
    problems.push(
      `version.json 的 tag 不符合 spellbook-vX.Y.Z：${JSON.stringify(tag)}`,
    );
  }

  if (version && cardsJson && manifestJson && missingFiles.length === 0) {
    if (local.version !== version) {
      problems.push(
        `version.json 的 version(${local.version}) 与 tag(${tag}) 不一致`,
      );
    }
    if (local.schemaVersion !== manifestJson.schema_version) {
      problems.push(
        `schemaVersion 不一致：version.json=${local.schemaVersion}，manifest=${manifestJson.schema_version}`,
      );
    }
    if (local.dataVersion !== manifestJson.data_version) {
      problems.push(
        `dataVersion 不一致：version.json=${local.dataVersion}，manifest=${manifestJson.data_version}`,
      );
    }
    if (local.generatedAt !== manifestJson.generated_at) {
      problems.push(
        `generatedAt 不一致：version.json=${local.generatedAt}，manifest=${manifestJson.generated_at}`,
      );
    }
    if (
      typeof local.imageBase !== 'string' ||
      !local.imageBase.includes(`@${tag}`)
    ) {
      problems.push(
        `imageBase 未包含当前 tag（@${tag}）：${JSON.stringify(local.imageBase ?? null)}`,
      );
    }
    if (manifestJson.schema_version !== EXPECTED_SCHEMA_VERSION) {
      problems.push(
        `manifest.json schema_version=${manifestJson.schema_version}，` +
          `消费端 spellbookClient 需升级（EXPECTED_SCHEMA_VERSION=${EXPECTED_SCHEMA_VERSION}）`,
      );
    }
    try {
      const checksumsBuf = await fetchBuffer(
        rawFileUrl(repo, tag, 'checksums.txt'),
      );
      const checksums = parseChecksums(checksumsBuf.toString('utf8'));
      problems.push(auditLocalFile(checksums, CARDS_FILE, 'cards.json'));
      problems.push(auditLocalFile(checksums, MANIFEST_FILE, 'manifest.json'));
    } catch (error) {
      problems.push(`无法获取上游 checksums.txt：${error.message}`);
    }
  }

  const found = problems.filter(Boolean);
  if (found.length > 0) {
    console.error(
      `verify failed（${found.length} 处不一致）：\n  - ${found.join('\n  - ')}`,
    );
    process.exitCode = 1;
    return;
  }
  const cardCount = Array.isArray(cardsJson?.cards)
    ? cardsJson.cards.length
    : '?';
  console.log(
    `verify ok：本地 spellbook 数据与上游 ${tag} 的 checksums.txt 及 version.json 契约一致（${cardCount} 卡）`,
  );
}

// ========== CLI entry ==========

function printUsage() {
  console.log(`用法：
  node scripts/fetch-spellbook.mjs [update]   拉取上游最新 release 入库（已是最新则 noop）
  node scripts/fetch-spellbook.mjs --check    只检测是否有新版（有则退出码 2）
  node scripts/fetch-spellbook.mjs --verify   校验本地数据与上游 checksums/契约一致
  --repo owner/name                           覆盖数据仓（默认 ${DEFAULT_REPO}，可用 HPMA_DATA_REPO）`);
}

function parseArgs(argv) {
  const args = { mode: 'update', repo: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') {
      args.mode = 'check';
    } else if (arg === '--verify') {
      args.mode = 'verify';
    } else if (arg === '-h' || arg === '--help') {
      args.mode = 'help';
    } else if (arg === 'update' || arg === 'check' || arg === 'verify') {
      if (args.mode === 'update') args.mode = arg;
    } else if (arg === '--repo') {
      const value = argv[i + 1];
      if (!value) throw new Error('--repo 需要一个 owner/repo 值');
      args.repo = value;
      i += 1;
    } else if (arg.startsWith('--repo=')) {
      args.repo = arg.slice('--repo='.length);
    } else {
      throw new Error(
        `未知参数：${arg}（可用：update | --check | --verify | --repo owner/repo）`,
      );
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'help') {
    printUsage();
    return;
  }
  const repo = resolveRepo(args);
  if (args.mode === 'check') {
    await runCheck(repo);
  } else if (args.mode === 'verify') {
    await runVerify(repo);
  } else {
    await runUpdate(repo);
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(`spellbook 更新失败：${error?.message || error}`);
    process.exitCode = 1;
  });
}
