import { DataService } from '../../src/services/dataService.js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_ARCHIVE = join(ROOT, 'public', 'archive', 'trends.json');

const M_1V1_LOW = '1v1:7500分以下';
const M_2V2_HIGH = '2v2:7500分以上';
// extractData/extractScatterData take the store-level mode keys
const MODE_1V1_LOW = '1v1-low';
const MODE_2V2_HIGH = '2v2-high';

// trends.rows shape: [periodIndex, echoId, modeIndex, winrate, attendancerate]
// Rows are deliberately out of echoId order so scatter sorting is exercised.
function makeTrends() {
  return {
    periods: [
      '2026/01/03 - 2026/01/09',
      '2026/01/10 - 2026/01/16',
      '2026/01/17 - 2026/01/23',
    ],
    modes: [M_1V1_LOW, M_2V2_HIGH],
    rows: [
      [1, 3, 0, 40.44, 6.14],
      [1, 1, 0, 41.2, 5.9],
      [0, 2, 0, 55.01, 8.8],
      [0, 1, 0, 52.0, 9.1],
      [2, 1, 1, 48.3, 7.7],
      // echo 2 has no 2v2-high rows at all; echo 1 has none in periods 0/1
    ],
  };
}

describe('DataService row index', () => {
  it('indexes rows by periodIndex|echoId|modeIndex', () => {
    const trends = makeTrends();
    const { byRow } = DataService.getRowIndex(trends);
    expect(byRow.get('0|1|0')).toEqual([0, 1, 0, 52.0, 9.1]);
    expect(byRow.get('1|3|0')).toEqual([1, 3, 0, 40.44, 6.14]);
    expect(byRow.get('2|1|1')).toEqual([2, 1, 1, 48.3, 7.7]);
    // Missing combination resolves to undefined, not a throw
    expect(byRow.get('0|2|1')).toBeUndefined();
  });

  it('groups rows by periodIndex|modeIndex preserving original row order', () => {
    const trends = makeTrends();
    const { byPeriodMode } = DataService.getRowIndex(trends);
    expect(byPeriodMode.get('0|0')).toEqual([
      [0, 2, 0, 55.01, 8.8],
      [0, 1, 0, 52.0, 9.1],
    ]);
    expect(byPeriodMode.get('1|0')).toEqual([
      [1, 3, 0, 40.44, 6.14],
      [1, 1, 0, 41.2, 5.9],
    ]);
    expect(byPeriodMode.has('2|0')).toBe(false);
  });

  it('keeps the first row on duplicate keys (mirrors Array.find semantics)', () => {
    const trends = makeTrends();
    trends.rows.push([0, 1, 0, 99.9, 99.9]); // duplicate of an existing key
    const { byRow } = DataService.getRowIndex(trends);
    expect(byRow.get('0|1|0')).toEqual([0, 1, 0, 52.0, 9.1]);
  });

  it('caches the index per trends object identity', () => {
    const trends = makeTrends();
    expect(DataService.getRowIndex(trends)).toBe(
      DataService.getRowIndex(trends),
    );
  });
});

describe('DataService.extractData', () => {
  it('returns one entry per period with matched winrate/attendancerate', () => {
    const trends = makeTrends();
    expect(DataService.extractData(trends, 1, MODE_1V1_LOW)).toEqual([
      { period: '2026/01/03 - 2026/01/09', winrate: 52.0, attendancerate: 9.1 },
      { period: '2026/01/10 - 2026/01/16', winrate: 41.2, attendancerate: 5.9 },
      {
        period: '2026/01/17 - 2026/01/23',
        winrate: null,
        attendancerate: null,
      },
    ]);
  });

  it('falls back to nulls for missing rows', () => {
    const trends = makeTrends();
    expect(DataService.extractData(trends, 2, MODE_2V2_HIGH)).toEqual([
      {
        period: '2026/01/03 - 2026/01/09',
        winrate: null,
        attendancerate: null,
      },
      {
        period: '2026/01/10 - 2026/01/16',
        winrate: null,
        attendancerate: null,
      },
      {
        period: '2026/01/17 - 2026/01/23',
        winrate: null,
        attendancerate: null,
      },
    ]);
  });

  it('returns [] for null trends', () => {
    expect(DataService.extractData(null, 1, MODE_1V1_LOW)).toEqual([]);
  });

  it('treats an unknown mode as missing data (all nulls), not a throw', () => {
    const trends = makeTrends();
    const result = DataService.extractData(trends, 1, '1v1:未知模式');
    expect(result).toHaveLength(3);
    expect(
      result.every((r) => r.winrate === null && r.attendancerate === null),
    ).toBe(true);
  });

  it('parses string reverberation ids', () => {
    const trends = makeTrends();
    expect(DataService.extractData(trends, '3', MODE_1V1_LOW)[1]).toEqual({
      period: '2026/01/10 - 2026/01/16',
      winrate: 40.44,
      attendancerate: 6.14,
    });
  });
});

describe('DataService.extractScatterData', () => {
  it('filters by period and mode, maps fields, and sorts by echoId ascending', () => {
    const trends = makeTrends();
    expect(
      DataService.extractScatterData(
        trends,
        '2026/01/03 - 2026/01/09',
        MODE_1V1_LOW,
      ),
    ).toEqual([
      {
        reverberationid: 1,
        winrate: 52.0,
        attendancerate: 9.1,
        name: 'Hermione Granger',
      },
      {
        reverberationid: 2,
        winrate: 55.01,
        attendancerate: 8.8,
        name: 'Harry Potter',
      },
    ]);
    expect(
      DataService.extractScatterData(
        trends,
        '2026/01/10 - 2026/01/16',
        MODE_1V1_LOW,
      ),
    ).toEqual([
      {
        reverberationid: 1,
        winrate: 41.2,
        attendancerate: 5.9,
        name: 'Hermione Granger',
      },
      {
        reverberationid: 3,
        winrate: 40.44,
        attendancerate: 6.14,
        name: 'Dobby',
      },
    ]);
  });

  it('labels unknown echo ids as Unknown Echo', () => {
    const trends = makeTrends();
    trends.rows.push([2, 999, 0, 10.0, 1.0]);
    const result = DataService.extractScatterData(
      trends,
      '2026/01/17 - 2026/01/23',
      MODE_1V1_LOW,
    );
    expect(result).toEqual([
      {
        reverberationid: 999,
        winrate: 10.0,
        attendancerate: 1.0,
        name: 'Unknown Echo',
      },
    ]);
  });

  it('returns [] for unknown period, unknown mode, or null trends', () => {
    const trends = makeTrends();
    expect(
      DataService.extractScatterData(trends, 'no-such-period', MODE_1V1_LOW),
    ).toEqual([]);
    expect(
      DataService.extractScatterData(
        trends,
        '2026/01/03 - 2026/01/09',
        'no-such-mode',
      ),
    ).toEqual([]);
    expect(
      DataService.extractScatterData(
        null,
        '2026/01/03 - 2026/01/09',
        MODE_1V1_LOW,
      ),
    ).toEqual([]);
  });

  it('does not mutate the cached period/mode groups when sorting', () => {
    const trends = makeTrends();
    const first = DataService.extractScatterData(
      trends,
      '2026/01/03 - 2026/01/09',
      MODE_1V1_LOW,
    );
    const { byPeriodMode } = DataService.getRowIndex(trends);
    // Cache group stays in original row order (echo 2 before echo 1)
    expect(byPeriodMode.get('0|0').map((r) => r[1])).toEqual([2, 1]);
    // A repeated call still yields the same sorted output
    const second = DataService.extractScatterData(
      trends,
      '2026/01/03 - 2026/01/09',
      MODE_1V1_LOW,
    );
    expect(second).toEqual(first);
    expect(second.map((r) => r.reverberationid)).toEqual([1, 2]);
  });
});

describe('DataService index rebuild on reload', () => {
  it('builds a fresh index for a new trends object and leaves the old one cached', () => {
    const first = makeTrends();
    expect(DataService.extractData(first, 1, MODE_1V1_LOW)[0].winrate).toBe(
      52.0,
    );

    // Simulate a reload: loadTrendsData JSON-parses a fresh object every time
    const reloaded = JSON.parse(JSON.stringify(first));
    reloaded.rows = reloaded.rows.map((r) =>
      r[0] === 0 && r[1] === 1 && r[2] === 0 ? [0, 1, 0, 77.7, 3.3] : r,
    );

    expect(DataService.extractData(reloaded, 1, MODE_1V1_LOW)[0].winrate).toBe(
      77.7,
    );
    // The previous dataset's cached index is untouched
    expect(DataService.extractData(first, 1, MODE_1V1_LOW)[0].winrate).toBe(
      52.0,
    );

    const { byRow } = DataService.getRowIndex(reloaded);
    expect(byRow.get('0|1|0')).toEqual([0, 1, 0, 77.7, 3.3]);
    expect(DataService.getRowIndex(first)).not.toBe(
      DataService.getRowIndex(reloaded),
    );
  });
});

// Real-archive regression net: only runs when the deployed trends.json exists
describe('DataService against the real archive', () => {
  const trends = existsSync(PUBLIC_ARCHIVE)
    ? JSON.parse(readFileSync(PUBLIC_ARCHIVE, 'utf8'))
    : null;

  it('matches a linear rows.find baseline for extractData', () => {
    if (!trends) return;
    const mode = '2v2-high';
    for (const id of [1, 7, 19]) {
      const result = DataService.extractData(trends, id, mode);
      expect(result).toHaveLength(trends.periods.length);
      const modeIndex = trends.modes.indexOf(DataService.modeMapping[mode]);
      for (const [periodIndex, entry] of result.entries()) {
        const row = trends.rows.find(
          (r) => r[0] === periodIndex && r[1] === id && r[2] === modeIndex,
        );
        expect(entry.winrate).toBe(row ? row[3] : null);
        expect(entry.attendancerate).toBe(row ? row[4] : null);
      }
    }
  });

  it('matches a linear filter baseline for extractScatterData', () => {
    if (!trends) return;
    const period = trends.periods[trends.periods.length - 1];
    const result = DataService.extractScatterData(trends, period, '2v2-high');
    const modeIndex = trends.modes.indexOf(DataService.modeMapping['2v2-high']);
    const periodIndex = trends.periods.indexOf(period);
    const expected = trends.rows
      .filter((r) => r[0] === periodIndex && r[2] === modeIndex)
      .sort((a, b) => a[1] - b[1]);
    expect(result).toHaveLength(expected.length);
    expect(result.map((r) => r.reverberationid)).toEqual(
      expected.map((r) => r[1]),
    );
    expect(
      result.every(
        (r, i) =>
          r.winrate === expected[i][3] && r.attendancerate === expected[i][4],
      ),
    ).toBe(true);
  });
});
