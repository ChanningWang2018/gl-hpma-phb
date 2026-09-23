// Aggregates all raw archive snapshots (repo-root archive/) into a single
// compact public/archive/trends.json so the client needs one small request
// instead of fetching every archive file.
//
// Usage:
//   node scripts/build-trends.mjs           # (re)build public/archive/trends.json
//   node scripts/build-trends.mjs --verify  # compare trends.json against raw archives
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
// Raw crawler snapshots live at the repo root (NOT deployed); only the
// aggregated trends.json is served from public/archive/.
const ARCHIVE_DIR = join(REPO_ROOT, "archive");
const TRENDS_FILE = join(REPO_ROOT, "public", "archive", "trends.json");

const ARCHIVE_FILE_PATTERN = /^\d{8}-\d{6}\.json$/;

function readArchives() {
  return readdirSync(ARCHIVE_DIR)
    .filter((name) => ARCHIVE_FILE_PATTERN.test(name))
    .sort()
    .map((name) => ({
      name,
      json: JSON.parse(readFileSync(join(ARCHIVE_DIR, name), "utf8")),
    }));
}

// Period label mirrors the manifest format produced by the crawler workflow:
// "YYYY/MM/DD - YYYY/MM/DD" from the snapshot's own date fields.
function derivePeriod(records, fileName) {
  const first = records[0] || {};
  const start = (first.starttimedate || "").trim();
  const end = (first.endtimedate || "").trim();
  if (start && end) {
    return `${start} - ${end}`;
  }
  const fallback = fileName.match(/^(\d{4})(\d{2})(\d{2})/);
  return fallback
    ? `${fallback[1]}/${fallback[2]}/${fallback[3]} data archive`
    : `${fileName} data archive`;
}

function periodSortKey(period) {
  const start = period.split(" - ")[0].replaceAll("/", "-");
  const parsed = Date.parse(start);
  return Number.isNaN(parsed) ? Infinity : parsed;
}

// generatedAt derives from the newest archive's filename so repeated builds
// over unchanged archives stay byte-identical (idempotent).
function deriveGeneratedAt(fileNames, now = new Date()) {
  const newest = fileNames
    .map((name) => name.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/))
    .filter(Boolean)
    .sort()
    .pop();
  if (!newest) {
    return now.toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  const [, y, mo, d, h, mi, s] = newest;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

export function derivePeriodEntries(archives) {
  return archives
    .map(({ name, json }) => {
      const records = json?.data?.huixianginfo;
      return Array.isArray(records)
        ? { name, records, period: derivePeriod(records, name) }
        : null;
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        periodSortKey(a.period) - periodSortKey(b.period) ||
        a.period.localeCompare(b.period)
    );
}

// The game's API occasionally re-serves an old period label after a data
// rollback (e.g. 20260605-064929 crawled "2026/03/19 - 2026/03/25" again),
// which would show the same date twice in the UI. Keep the first snapshot
// captured for each period label — the genuine one from right after the
// period ended — and skip later stale re-serves.
export function dedupeByPeriod(periodEntries) {
  const seen = new Set();
  const kept = [];
  const skipped = [];
  for (const entry of periodEntries) {
    if (seen.has(entry.period)) {
      skipped.push(entry);
      continue;
    }
    seen.add(entry.period);
    kept.push(entry);
  }
  return { kept, skipped };
}

export function buildTrends(archives, now = new Date()) {
  const { kept: periodEntries, skipped } = dedupeByPeriod(
    derivePeriodEntries(archives)
  );

  const periods = periodEntries.map((entry) => entry.period);
  const modes = [
    ...new Set(periodEntries.flatMap((entry) => entry.records.map((r) => r.type))),
  ].sort();

  const rows = [];
  periodEntries.forEach((entry, periodIndex) => {
    for (const record of entry.records) {
      if (!Number.isFinite(record.reverberationid) || typeof record.type !== "string") {
        continue;
      }
      const modeIndex = modes.indexOf(record.type);
      if (modeIndex === -1) {
        continue;
      }
      rows.push([
        periodIndex,
        record.reverberationid,
        modeIndex,
        record.winrate,
        record.attendancerate,
      ]);
    }
  });
  rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

  return {
    generatedAt: deriveGeneratedAt(
      archives.map((archive) => archive.name),
      now
    ),
    periods,
    modes,
    rows,
  };
}

function verifyTrends() {
  if (!existsSync(TRENDS_FILE)) {
    console.error(`verify failed: ${TRENDS_FILE} does not exist (run without --verify first)`);
    return false;
  }
  const committed = JSON.parse(readFileSync(TRENDS_FILE, "utf8"));
  const fresh = buildTrends(readArchives());

  const problems = [];
  if (JSON.stringify(committed.periods) !== JSON.stringify(fresh.periods)) {
    problems.push("periods differ");
  }
  if (JSON.stringify(committed.modes) !== JSON.stringify(fresh.modes)) {
    problems.push("modes differ");
  }

  const committedRows = new Map(committed.rows.map((row) => [row.slice(0, 3).join("|"), row]));
  const freshRows = new Map(fresh.rows.map((row) => [row.slice(0, 3).join("|"), row]));
  const missing = fresh.rows.filter((row) => {
    const other = committedRows.get(row.slice(0, 3).join("|"));
    return !other || JSON.stringify(other) !== JSON.stringify(row);
  });
  const extra = committed.rows.filter((row) => !freshRows.has(row.slice(0, 3).join("|")));
  if (missing.length > 0) {
    problems.push(`${missing.length} rows missing/differing, e.g. ${JSON.stringify(missing.slice(0, 3))}`);
  }
  if (extra.length > 0) {
    problems.push(`${extra.length} stale rows, e.g. ${JSON.stringify(extra.slice(0, 3))}`);
  }

  if (problems.length > 0) {
    console.error(`verify failed: trends.json is out of sync with the raw archives in archive/:\n  - ${problems.join("\n  - ")}`);
    console.error("Rebuild with: npm run build:trends");
    return false;
  }

  console.log(
    `verify ok: ${fresh.periods.length} periods x ${fresh.modes.length} modes, ` +
      `${fresh.rows.length} rows match raw archives`
  );
  return true;
}

function main() {
  if (process.argv.includes("--verify")) {
    process.exitCode = verifyTrends() ? 0 : 1;
    return;
  }

  const archives = readArchives();
  const { skipped } = dedupeByPeriod(derivePeriodEntries(archives));
  const trends = buildTrends(archives);
  writeFileSync(TRENDS_FILE, JSON.stringify(trends));
  if (skipped.length > 0) {
    console.warn(
      "skipped stale period re-serves (duplicate labels, kept first snapshot): " +
        skipped.map((entry) => `${entry.name} (${entry.period})`).join(", ")
    );
  }
  const sizeKb = (Buffer.byteLength(JSON.stringify(trends)) / 1024).toFixed(1);
  console.log(
    `wrote ${TRENDS_FILE} (${trends.periods.length} periods, ${trends.rows.length} rows, ${sizeKb}KB)`
  );
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  main();
}
