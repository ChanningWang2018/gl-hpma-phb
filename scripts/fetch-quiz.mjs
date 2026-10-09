// Syncs the committed quiz data in public/data/quiz/ with the upstream
// hpma-quizbank GitHub release, so classroom question-bank updates reach the
// /quiz page without hand-edited JSON drift.
//
// Usage:
//   node scripts/fetch-quiz.mjs           # update (default): pull latest release, noop if current
//   node scripts/fetch-quiz.mjs --check   # exit 2 when upstream is newer, 0 otherwise
//   node scripts/fetch-quiz.mjs --verify  # audit local files against version.json (pure local, no network)
//   --repo owner/name                     # override data repo (env: HPMA_QUIZ_REPO)
//
// Data source: release tags named quiz-v{schema}.{YYYYMMDD}.0 on the public
// hpma-quizbank repo. Unlike spellbook, the upstream repo has no
// checksums.txt (release assets are zip + .sha256, which we deliberately do
// not unzip). Instead the two needed files (quiz.json, manifest.json) are
// downloaded as bare blobs from raw.githubusercontent.com at the immutable
// tag, and integrity rests on tag immutability plus a structural gate
// (schema + per-question invariants + manifest coverage agreement). A
// consciously weaker but dependency-free trade-off; upstream checksums.txt
// can be layered in later.
// Zero npm dependencies: node built-ins only.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DATA_DIR = join(REPO_ROOT, 'public', 'data', 'quiz');
const QUIZ_FILE = join(DATA_DIR, 'quiz.json');
const MANIFEST_FILE = join(DATA_DIR, 'manifest.json');
const VERSION_FILE = join(DATA_DIR, 'version.json');

const DEFAULT_REPO = 'hpma-bits/hpma-quizbank';
const GITHUB_API_BASE = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';
const FETCH_TIMEOUT_MS = 60_000;
const DIFF_PREVIEW_LIMIT = 15;
const DIFF_NAME_PREVIEW_LIMIT = 24;
// Keep in sync with EXPECTED_SCHEMA_VERSION in src/services/quizClient.js:
// a schema bump requires consumer-code adaptation BEFORE new data is ingested.
export const EXPECTED_SCHEMA_VERSION = 2;

// quiz-v{schema}.{YYYYMMDD}.0 — schema segment gates consumer code, the date
// segment is the game-data cut. Patch is pinned to 0 (re-publish = new tag).
const TAG_PATTERN = /^quiz-v(\d+)\.(\d{8})\.0$/;

// ========== Pure helpers (unit-tested, no I/O) ==========

// 'quiz-v2.20261009.0' -> '2.20261009.0'; anything else -> null.
export function matchQuizTag(tag) {
  if (typeof tag !== 'string') return null;
  return TAG_PATTERN.test(tag) ? tag.slice('quiz-v'.length) : null;
}

// Numeric comparison for the 'X.YYYYMMDD.0' version strings: -1 | 0 | 1.
// Components compare numerically, never lexicographically ('2.9999999.0'
// sorts before '2.20261009.0'); missing components count as 0.
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

// Assembles the version.json document consumed by the UI and --verify.
// schemaVersion/dataVersion/generatedAt mirror manifest.json; sourceUrl pins
// the GitHub tree at the exact tag. Key order matches the T1-committed file.
export function buildVersionJson({ tag, repo, manifest }) {
  return {
    tag,
    version: matchQuizTag(tag),
    schemaVersion: manifest.schema_version,
    dataVersion: manifest.data_version,
    sourceRepo: repo,
    sourceUrl: `https://github.com/${repo}/tree/${tag}`,
    generatedAt: manifest.generated_at,
  };
}

// Added/removed questions between two quiz.json payloads. Question ids are
// unique per bank only (the two banks keep independent id spaces), so the
// diff key is the bank-qualified 'bankId:id' (same convention as
// manifest.coverage.answer_conflicts). Each entry carries a short zh
// question text (en fallback) for human-readable summaries.
export function diffQuestionIds(oldQuiz, newQuiz) {
  const questionName = (q) =>
    q?.question?.zh || q?.question?.en || String(q?.id);
  const collect = (quiz) => {
    const map = new Map();
    const banks = quiz?.banks || {};
    for (const [bankId, bank] of Object.entries(banks)) {
      for (const q of bank?.questions || []) {
        const key = `${bankId}:${q?.id}`;
        map.set(key, { key, name: questionName(q) });
      }
    }
    return map;
  };
  const oldMap = collect(oldQuiz);
  const newMap = collect(newQuiz);
  return {
    added: [...newMap.values()].filter((entry) => !oldMap.has(entry.key)),
    removed: [...oldMap.values()].filter((entry) => !newMap.has(entry.key)),
  };
}

// "history_of_magic:101301103 魁地奇世界杯的举办地是哪里" — capped so weekly
// summaries stay readable; long question texts are truncated.
export function formatQuizDiffList(entries, limit = DIFF_PREVIEW_LIMIT) {
  const truncate = (name) => {
    const text = String(name ?? '');
    return text.length > DIFF_NAME_PREVIEW_LIMIT
      ? `${text.slice(0, DIFF_NAME_PREVIEW_LIMIT)}…`
      : text;
  };
  const preview = (entries || [])
    .slice(0, limit)
    .map((entry) => `${entry.key} ${truncate(entry.name)}`)
    .join('、');
  const total = (entries || []).length;
  if (total > limit) return `${preview} ...等 ${total} 题`;
  return preview || '（无）';
}

// Structural gate (a): schema version. Returns null when consumable, or a
// Chinese error message explaining why the payload is rejected (a schema
// bump means the site's quizClient must be upgraded first).
export function validateQuizSchemaVersion(quizJson) {
  if (!quizJson || typeof quizJson !== 'object' || Array.isArray(quizJson)) {
    return 'quiz.json 顶层不是 JSON 对象';
  }
  const schema = quizJson.schema_version;
  if (schema !== EXPECTED_SCHEMA_VERSION) {
    const shown = schema === undefined ? '缺失' : String(schema);
    return (
      `quiz.json schema_version=${shown}，` +
      `消费端 quizClient 需升级（EXPECTED_SCHEMA_VERSION=${EXPECTED_SCHEMA_VERSION}），拒绝入库`
    );
  }
  return null;
}

// Structural gate (b): per-bank question invariants. Every bank must carry a
// non-empty questions array, and every question exactly 4 options with
// exactly one is_correct=true (the whole grading logic leans on this).
// Returns a list of Chinese problems (empty = pass).
export function checkQuestionInvariants(quizJson) {
  const problems = [];
  const banks = quizJson?.banks;
  if (!banks || typeof banks !== 'object' || Array.isArray(banks)) {
    return ['quiz.json 缺少 banks 对象'];
  }
  for (const [bankId, bank] of Object.entries(banks)) {
    if (!bank || typeof bank !== 'object') {
      problems.push(`quiz.json 的 ${bankId} 不是对象`);
      continue;
    }
    if (!Array.isArray(bank.questions) || bank.questions.length === 0) {
      problems.push(`${bankId} 的 questions 为空或不是数组，疑似坏包`);
      continue;
    }
    for (let i = 0; i < bank.questions.length; i += 1) {
      const q = bank.questions[i];
      const where = `第 ${i + 1} 题（id=${q?.id ?? '缺失'}）`;
      if (!q || typeof q !== 'object') {
        problems.push(`${bankId} ${where} 不是对象`);
        continue;
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        const shown = Array.isArray(q.options)
          ? String(q.options.length)
          : '非数组';
        problems.push(`${bankId} ${where}选项数不为 4（实际 ${shown}）`);
        continue;
      }
      if (!q.options.every((o) => o && typeof o === 'object')) {
        problems.push(`${bankId} ${where}存在非对象选项`);
        continue;
      }
      const correctCount = q.options.filter(
        (o) => o.is_correct === true,
      ).length;
      if (correctCount !== 1) {
        problems.push(
          `${bankId} ${where}is_correct 标记数不为 1（实际 ${correctCount}）`,
        );
      }
    }
  }
  return problems;
}

// Structural gate (c): question counts must agree with the manifest — each
// bank against manifest.coverage.questions, the grand total against
// manifest.datasets[id=quiz].count. Returns a list of Chinese problems.
export function checkCoverageCounts(quizJson, manifestJson) {
  const problems = [];
  const banks = quizJson?.banks;
  const coverage = manifestJson?.coverage;
  if (
    !coverage ||
    typeof coverage !== 'object' ||
    !coverage.questions ||
    typeof coverage.questions !== 'object'
  ) {
    return ['manifest.json 缺少 coverage.questions，无法核对各科目题数'];
  }
  const expected = coverage.questions;
  const bankIds = new Set([
    ...Object.keys(banks || {}),
    ...Object.keys(expected),
  ]);
  let total = 0;
  for (const bankId of bankIds) {
    const bank = banks?.[bankId];
    const actual = Array.isArray(bank?.questions)
      ? bank.questions.length
      : null;
    const want = expected[bankId];
    if (typeof want !== 'number') {
      problems.push(
        `manifest.coverage.questions 缺少 ${bankId} 的题数（quiz.json 实际 ${actual ?? 'questions 非数组'}）`,
      );
      continue;
    }
    if (actual === null) {
      problems.push(
        `${bankId} 的 questions 缺失或不是数组，manifest.coverage.questions 声明 ${want} 题`,
      );
      continue;
    }
    total += actual;
    if (actual !== want) {
      problems.push(
        `${bankId} 题数不一致：quiz.json=${actual}，manifest.coverage.questions=${want}`,
      );
    }
  }
  const dataset = Array.isArray(manifestJson?.datasets)
    ? manifestJson.datasets.find((d) => d && d.id === 'quiz')
    : null;
  if (!dataset) {
    problems.push(
      'manifest.json 的 datasets 中没有 id=quiz 的条目，无法核对总题数',
    );
  } else if (dataset.count !== total) {
    problems.push(
      `总题数不一致：quiz.json 各 bank 合计=${total}，manifest.datasets[quiz].count=${dataset.count}`,
    );
  }
  return problems;
}

// Full structural gate run before ingesting a download: a (schema) + b
// (question invariants) + c (coverage counts) + d (manifest schema
// agreement) + the fields version.json assembly depends on. Gate (a) refuses
// fast — with an unknown schema nothing downstream is meaningful.
// Returns a list of Chinese problems (empty = pass).
export function validateQuizBundle(quizJson, manifestJson) {
  const schemaProblem = validateQuizSchemaVersion(quizJson);
  if (schemaProblem) return [schemaProblem];

  const problems = [...checkQuestionInvariants(quizJson)];

  const manifestIsObject =
    !!manifestJson &&
    typeof manifestJson === 'object' &&
    !Array.isArray(manifestJson);
  if (!manifestIsObject) {
    problems.push('manifest.json 顶层不是 JSON 对象');
    return problems;
  }
  problems.push(...checkCoverageCounts(quizJson, manifestJson));
  if (manifestJson.schema_version !== quizJson.schema_version) {
    problems.push(
      `schema 版本不一致：quiz.json=${quizJson.schema_version}，` +
        `manifest.json=${manifestJson.schema_version}`,
    );
  }
  if (
    typeof manifestJson.data_version !== 'number' ||
    typeof manifestJson.generated_at !== 'string'
  ) {
    problems.push(
      'manifest.json 缺少 data_version/generated_at，无法组装 version.json',
    );
  }
  return problems;
}

// ========== Network helpers (not unit-tested) ==========

function githubApiHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gl-hpma-phb-quiz-fetcher',
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

// Quiz upstream keeps the files at the repo root (no spellbook/ subdir).
function rawFileUrl(repo, tag, fileName) {
  return `${RAW_BASE}/${repo}/${tag}/${fileName}`;
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
  const version = matchQuizTag(tag);
  if (!version) {
    throw new Error(
      `GitHub API 返回的 latest release tag 不符合 quiz-vX.YYYYMMDD.0 约定：` +
        `${JSON.stringify(tag ?? null)}（${url}）`,
    );
  }
  return { tag, version };
}

function resolveRepo(options) {
  const repo = options.repo || process.env.HPMA_QUIZ_REPO || DEFAULT_REPO;
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

function readLocalQuiz() {
  if (!existsSync(QUIZ_FILE)) return null;
  return JSON.parse(readFileSync(QUIZ_FILE, 'utf8'));
}

// ========== Commands ==========

// --check: exit 2 when upstream is strictly newer, 0 when current (or local
// is already ahead). One-line verdict either way.
async function runCheck(repo) {
  const local = readLocalVersionInfo();
  const { tag, version: remoteVersion } = await fetchLatestTag(repo);
  if (!local) {
    console.log(`本地尚无 quiz 数据，上游最新 ${tag}`);
    process.exitCode = 2;
    return;
  }
  const localVersion = matchQuizTag(local.tag) || '0.0.0';
  if (compareVersions(remoteVersion, localVersion) > 0) {
    console.log(`有新版本：${local.tag} -> ${tag}`);
    process.exitCode = 2;
  } else {
    console.log(`已是最新：本地 ${local.tag}，上游 ${tag}`);
  }
}

// update (default): download -> structural gate -> write.
async function runUpdate(repo) {
  const local = readLocalVersionInfo();
  const { tag } = await fetchLatestTag(repo);
  if (local && local.tag === tag) {
    console.log(`already up to date（${tag}）`);
    return;
  }

  console.log(
    `发现新版本：${local ? local.tag : '（无本地数据）'} -> ${tag}，下载两文件...`,
  );
  const [quizBuf, manifestBuf] = await Promise.all([
    fetchBuffer(rawFileUrl(repo, tag, 'quiz.json')),
    fetchBuffer(rawFileUrl(repo, tag, 'manifest.json')),
  ]);

  let quizJson;
  let manifestJson;
  try {
    quizJson = JSON.parse(quizBuf.toString('utf8'));
    manifestJson = JSON.parse(manifestBuf.toString('utf8'));
  } catch (error) {
    throw new Error(`下载的 JSON 无法解析：${error.message}`);
  }

  const problems = validateQuizBundle(quizJson, manifestJson);
  if (problems.length > 0) {
    console.error(
      `拒绝入库（结构门未通过，${problems.length} 处）：\n  - ${problems.join('\n  - ')}`,
    );
    process.exitCode = 1;
    return;
  }

  let oldQuiz = null;
  try {
    oldQuiz = readLocalQuiz();
  } catch {
    console.warn('本地旧 quiz.json 无法解析，diff 摘要按空集处理');
  }

  const diff = diffQuestionIds(oldQuiz, quizJson);
  const versionInfo = buildVersionJson({ tag, repo, manifest: manifestJson });

  writeFileSync(QUIZ_FILE, quizBuf);
  writeFileSync(MANIFEST_FILE, manifestBuf);
  writeFileSync(VERSION_FILE, `${JSON.stringify(versionInfo, null, 2)}\n`);

  const bankCounts = Object.entries(quizJson.banks).map(
    ([bankId, bank]) => `${bankId}: ${bank.questions.length} 题`,
  );
  const totalCount = Object.values(quizJson.banks).reduce(
    (sum, bank) => sum + bank.questions.length,
    0,
  );
  const oldLabel = local ? local.tag : '（无本地数据）';
  console.log(
    `quiz 数据已入库：${oldLabel} -> ${tag}（${totalCount} 题，` +
      `generated_at=${manifestJson.generated_at}）`,
  );
  console.log(`各科目题数：${bankCounts.join('，')}`);
  console.log(
    `新增 ${diff.added.length} 题：${formatQuizDiffList(diff.added)}`,
  );
  console.log(
    `移除 ${diff.removed.length} 题：${formatQuizDiffList(diff.removed)}`,
  );
  console.log('已写入 public/data/quiz/{quiz,manifest,version}.json');
}

// --verify: CI drift guard, pure local (no network). version.json must agree
// with manifest.json / quiz.json on tag, schemaVersion, dataVersion,
// generatedAt, and its sourceUrl must pin the current tag; the structural
// gates (b)/(c) re-run against the committed quiz.json.
async function runVerify() {
  const problems = [];

  let local = null;
  try {
    local = readLocalVersionInfo();
  } catch (error) {
    problems.push(`version.json 无法读取：${error.message}`);
  }
  if (!local) problems.push(`缺少 ${VERSION_FILE}（先运行 update 入库）`);

  const missingFiles = [QUIZ_FILE, MANIFEST_FILE].filter(
    (file) => !existsSync(file),
  );
  missingFiles.forEach((file) => problems.push(`缺少 ${file}`));

  let quizJson = null;
  let manifestJson = null;
  if (missingFiles.length === 0) {
    try {
      quizJson = JSON.parse(readFileSync(QUIZ_FILE, 'utf8'));
    } catch (error) {
      problems.push(`quiz.json 不是合法 JSON：${error.message}`);
    }
    try {
      manifestJson = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
    } catch (error) {
      problems.push(`manifest.json 不是合法 JSON：${error.message}`);
    }
  }

  const tag = local?.tag;
  const version = matchQuizTag(tag);
  if (local && !version) {
    problems.push(
      `version.json 的 tag 不符合 quiz-vX.YYYYMMDD.0：${JSON.stringify(tag)}`,
    );
  }

  if (version && quizJson && manifestJson && missingFiles.length === 0) {
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
    if (quizJson.schema_version !== manifestJson.schema_version) {
      problems.push(
        `schemaVersion 不一致：quiz.json=${quizJson.schema_version}，manifest=${manifestJson.schema_version}`,
      );
    }
    if (manifestJson.schema_version !== EXPECTED_SCHEMA_VERSION) {
      problems.push(
        `manifest.json schema_version=${manifestJson.schema_version}，` +
          `消费端 quizClient 需升级（EXPECTED_SCHEMA_VERSION=${EXPECTED_SCHEMA_VERSION}）`,
      );
    }
    if (local.dataVersion !== manifestJson.data_version) {
      problems.push(
        `dataVersion 不一致：version.json=${local.dataVersion}，manifest=${manifestJson.data_version}`,
      );
    }
    if (quizJson.data_version !== manifestJson.data_version) {
      problems.push(
        `dataVersion 不一致：quiz.json=${quizJson.data_version}，manifest=${manifestJson.data_version}`,
      );
    }
    if (local.generatedAt !== manifestJson.generated_at) {
      problems.push(
        `generatedAt 不一致：version.json=${local.generatedAt}，manifest=${manifestJson.generated_at}`,
      );
    }
    if (typeof local.sourceUrl !== 'string' || !local.sourceUrl.includes(tag)) {
      problems.push(
        `sourceUrl 未包含当前 tag（${tag}）：${JSON.stringify(local.sourceUrl ?? null)}`,
      );
    }
    // Structural gates (b)/(c) re-run against the committed files.
    problems.push(...checkQuestionInvariants(quizJson));
    problems.push(...checkCoverageCounts(quizJson, manifestJson));
  }

  const found = problems.filter(Boolean);
  if (found.length > 0) {
    console.error(
      `verify failed（${found.length} 处不一致）：\n  - ${found.join('\n  - ')}`,
    );
    process.exitCode = 1;
    return;
  }
  const totalCount = quizJson?.banks
    ? Object.values(quizJson.banks).reduce(
        (sum, bank) =>
          sum + (Array.isArray(bank.questions) ? bank.questions.length : 0),
        0,
      )
    : '?';
  console.log(
    `verify ok：本地 quiz 数据与 version.json 契约一致（${totalCount} 题，${tag}），纯本地校验未访问网络`,
  );
}

// ========== CLI entry ==========

function printUsage() {
  console.log(`用法：
  node scripts/fetch-quiz.mjs [update]   拉取上游最新 release 入库（已是最新则 noop）
  node scripts/fetch-quiz.mjs --check    只检测是否有新版（有则退出码 2）
  node scripts/fetch-quiz.mjs --verify   纯本地校验 version.json 与 quiz/manifest 一致（无网络）
  --repo owner/name                      覆盖数据仓（默认 ${DEFAULT_REPO}，可用 HPMA_QUIZ_REPO）`);
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
  if (args.mode === 'verify') {
    await runVerify();
    return;
  }
  const repo = resolveRepo(args);
  if (args.mode === 'check') {
    await runCheck(repo);
  } else {
    await runUpdate(repo);
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(`quiz 更新失败：${error?.message || error}`);
    process.exitCode = 1;
  });
}
