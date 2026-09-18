import { buildTrends } from "../../scripts/build-trends.mjs";
import { DataService } from "../../src/services/dataService.js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ARCHIVE_DIR = join(ROOT, "public", "archive");

// Helper: build an archive in the raw API response shape
function makeArchive(starttimedate, endtimedate, records) {
  return {
    data: {
      huixianginfo: records.map((r) => ({
        starttimedate: ` ${starttimedate}`,
        endtimedate: ` ${endtimedate}`,
        ovocardid: null,
        ...r,
      })),
    },
  };
}

const M_1V1_LOW = "1v1:7500分以下";
const M_1V1_HIGH = "1v1:7500分以上";
const M_2V2_HIGH = "2v2:7500分以上";

describe("buildTrends", () => {
  const archives = [
    {
      name: "20260109-034952.json",
      json: makeArchive("2026/01/03", "2026/01/09", [
        { reverberationid: 1, type: M_1V1_LOW, winrate: 40.44, attendancerate: 6.14 },
        { reverberationid: 1, type: M_1V1_HIGH, winrate: 41.2, attendancerate: 5.9 },
        { reverberationid: 2, type: M_1V1_LOW, winrate: 55.01, attendancerate: 8.8 },
        // echo 2 has no 1v1-high record in this period
      ]),
    },
    {
      name: "20260115-172020.json",
      json: makeArchive("2026/01/10", "2026/01/16", [
        { reverberationid: 1, type: M_1V1_LOW, winrate: 42.0, attendancerate: 6.5 },
        { reverberationid: 2, type: M_1V1_LOW, winrate: 54.0, attendancerate: 9.1 },
      ]),
    },
    // Out-of-order file on disk must still sort oldest period first
    {
      name: "20251219-034544.json",
      json: makeArchive("2025/12/13", "2025/12/19", [
        { reverberationid: 3, type: M_2V2_HIGH, winrate: 48.3, attendancerate: 7.7 },
      ]),
    },
  ];

  it("derives period labels from the snapshot date fields", () => {
    const trends = buildTrends(archives);
    expect(trends.periods).toEqual([
      "2025/12/13 - 2025/12/19",
      "2026/01/03 - 2026/01/09",
      "2026/01/10 - 2026/01/16",
    ]);
  });

  it("collects the unique sorted mode list", () => {
    const trends = buildTrends(archives);
    expect(trends.modes).toEqual([M_1V1_HIGH, M_1V1_LOW, M_2V2_HIGH]);
  });

  it("encodes rows as [periodIndex, echoId, modeIndex, winrate, pickrate] sorted", () => {
    const trends = buildTrends(archives);
    expect(trends.rows).toEqual([
      [0, 3, 2, 48.3, 7.7],
      [1, 1, 0, 41.2, 5.9],
      [1, 1, 1, 40.44, 6.14],
      [1, 2, 1, 55.01, 8.8],
      [2, 1, 1, 42.0, 6.5],
      [2, 2, 1, 54.0, 9.1],
    ]);
  });
  it("derives generatedAt from the newest archive filename (deterministic)", () => {
    const trends = buildTrends(archives);
    expect(trends.generatedAt).toBe("2026-01-15T17:20:20Z");
  });

  it("is idempotent for unchanged inputs", () => {
    expect(JSON.stringify(buildTrends(archives))).toBe(
      JSON.stringify(buildTrends(archives))
    );
  });

  it("keeps only the first snapshot for a duplicated period label (stale game re-serve)", () => {
    // Mirrors the 2026-06-05 game rollback: the API re-served period
    // 2026/03/19 - 2026/03/25 one day after the normal 06/04 snapshot.
    const genuine = {
      name: "20260327-131520.json",
      json: makeArchive("2026/03/19", "2026/03/25", [
        { reverberationid: 1, type: M_1V1_LOW, winrate: 44.53, attendancerate: 7.29 },
      ]),
    };
    const staleReServe = {
      name: "20260605-064929.json",
      json: makeArchive("2026/03/19", "2026/03/25", [
        { reverberationid: 1, type: M_1V1_LOW, winrate: 43.68, attendancerate: 6.08 },
      ]),
    };
    const laterPeriod = {
      name: "20260612-070442.json",
      json: makeArchive("2026/06/04", "2026/06/10", [
        { reverberationid: 1, type: M_1V1_LOW, winrate: 45.0, attendancerate: 7.0 },
      ]),
    };

    const trends = buildTrends([genuine, staleReServe, laterPeriod]);
    expect(trends.periods).toEqual([
      "2026/03/19 - 2026/03/25",
      "2026/06/04 - 2026/06/10",
    ]);
    // Rows must carry the genuine first capture, not the rolled-back numbers
    expect(trends.rows).toEqual([
      [0, 1, 0, 44.53, 7.29],
      [1, 1, 0, 45.0, 7.0],
    ]);
  });
});

describe("DataService trends extractors", () => {
  // Same dataset expressed in the old allData shape and the new trends shape
  const periodA = "2026/01/03 - 2026/01/09";
  const periodB = "2026/01/10 - 2026/01/16";

  const oldShape = [
    {
      period: periodA,
      data: [
        { reverberationid: 1, type: M_1V1_LOW, winrate: 40.44, attendancerate: 6.14 },
        { reverberationid: 2, type: M_1V1_LOW, winrate: 55.01, attendancerate: 8.8 },
      ],
    },
    {
      period: periodB,
      data: [{ reverberationid: 2, type: M_1V1_LOW, winrate: 54.0, attendancerate: 9.1 }],
    },
  ];

  const trendsShape = {
    periods: [periodA, periodB],
    modes: [M_1V1_LOW],
    rows: [
      [0, 1, 0, 40.44, 6.14],
      [0, 2, 0, 55.01, 8.8],
      [1, 2, 0, 54.0, 9.1],
    ],
  };

  it("extractData matches the legacy archive-based output", () => {
    const fromTrends = DataService.extractData(trendsShape, 2, "1v1-low");
    expect(fromTrends).toEqual([
      { period: periodA, winrate: 55.01, attendancerate: 8.8 },
      { period: periodB, winrate: 54.0, attendancerate: 9.1 },
    ]);

    // Missing echo/mode records must surface as nulls, per period
    const missing = DataService.extractData(trendsShape, 1, "1v1-low");
    expect(missing).toEqual([
      { period: periodA, winrate: 40.44, attendancerate: 6.14 },
      { period: periodB, winrate: null, attendancerate: null },
    ]);
  });

  it("extractScatterData matches the legacy archive-based output", () => {
    const scatter = DataService.extractScatterData(trendsShape, periodA, "1v1-low");
    expect(scatter).toEqual([
      { reverberationid: 1, winrate: 40.44, attendancerate: 6.14, name: "Hermione Granger" },
      { reverberationid: 2, winrate: 55.01, attendancerate: 8.8, name: "Harry Potter" },
    ]);
  });

  it("extractScatterData returns [] for unknown period/mode and handles empty trends", () => {
    expect(DataService.extractScatterData(trendsShape, "nope", "1v1-low")).toEqual([]);
    expect(DataService.extractScatterData(trendsShape, periodA, "2v2-high")).toEqual([]);
    expect(DataService.extractData(null, 1, "1v1-low")).toEqual([]);
    expect(DataService.extractScatterData(null, periodA, "1v1-low")).toEqual([]);
  });
});

describe("committed trends.json regression vs raw archives", () => {
  const trendsFile = join(ARCHIVE_DIR, "trends.json");

  it("matches a fresh aggregation of every archive file", () => {
    if (!existsSync(trendsFile)) {
      return; // nothing committed yet
    }
    const archives = readdirSync(ARCHIVE_DIR)
      .filter((name) => /^\d{8}-\d{6}\.json$/.test(name))
      .sort()
      .map((name) => ({
        name,
        json: JSON.parse(readFileSync(join(ARCHIVE_DIR, name), "utf8")),
      }));
    expect(archives.length).toBeGreaterThan(0);

    const committed = JSON.parse(readFileSync(trendsFile, "utf8"));
    const fresh = buildTrends(archives);

    // generatedAt compares equal too: it derives from the newest filename
    expect(committed).toEqual(fresh);
  });
});
