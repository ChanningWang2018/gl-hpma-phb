import { mergeRows, summarize } from '../../src/services/homeStats.js';
import { DataService } from '../../src/services/dataService.js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_ARCHIVE = join(ROOT, 'public', 'archive', 'trends.json');

// One row in the shape DataService.extractScatterData() returns
const archiveRow = (id, winrate, attendancerate, name = `Echo ${id}`) => ({
  reverberationid: id,
  winrate,
  attendancerate,
  name,
});

// One row in the shape the plate/scatter consume
const plateRow = (id, win, pick, dWin = 0) => ({
  id,
  name: `Echo ${id}`,
  win,
  pick,
  dWin,
  dPick: 0,
});

describe('homeStats.mergeRows', () => {
  it('maps archive rows onto the plate shape', () => {
    const merged = mergeRows(
      [archiveRow(1, 52.04, 9.13, 'Hermione Granger')],
      null,
    );

    expect(merged).toEqual([
      {
        id: 1,
        name: 'Hermione Granger',
        win: 52.04,
        pick: 9.13,
        dWin: 0,
        dPick: 0,
      },
    ]);
  });

  it('adds week-over-week win and pick deltas, rounded to one decimal', () => {
    const merged = mergeRows(
      [archiveRow(14, 58.74, 21.34, 'Ginny Weasley')],
      [archiveRow(14, 51.62, 19.97, 'Ginny Weasley')],
    );

    expect(merged[0].dWin).toBe(7.1);
    expect(merged[0].dPick).toBe(1.4);
  });

  it('keeps a genuinely unchanged metric at 0, not null', () => {
    const merged = mergeRows(
      [archiveRow(3, 42.67, 6.63)],
      [archiveRow(3, 42.67, 6.63)],
    );

    expect(merged[0].dWin).toBe(0);
    expect(merged[0].dPick).toBe(0);
  });

  it('defaults deltas to 0 when there is no previous period', () => {
    const rows = [archiveRow(1, 50, 10), archiveRow(2, 49, 8)];

    for (const previous of [null, undefined, []]) {
      const merged = mergeRows(rows, previous);
      expect(merged.map((row) => row.dWin)).toEqual([0, 0]);
      expect(merged.map((row) => row.dPick)).toEqual([0, 0]);
    }
  });

  it('defaults deltas to 0 for an echo missing from last week', () => {
    const merged = mergeRows(
      [archiveRow(1, 50, 10), archiveRow(2, 40, 5)],
      [archiveRow(1, 45, 9)],
    );

    expect(merged.map((row) => row.dWin)).toEqual([5, 0]);
    expect(merged.map((row) => row.dPick)).toEqual([1, 0]);
  });

  it('preserves input order and understands plate-shaped previous rows', () => {
    const merged = mergeRows(
      [archiveRow(9, 53, 11), archiveRow(1, 60, 4)],
      [plateRow(1, 55, 1)],
    );

    expect(merged.map((row) => row.id)).toEqual([9, 1]);
    expect(merged[1].dWin).toBe(5);
  });

  it('skips malformed rows instead of poisoning the chart', () => {
    const merged = mergeRows(
      [
        null,
        archiveRow(1, null, 5),
        archiveRow(2, 40, null),
        { name: 'No id', winrate: 50, attendancerate: 5 },
        archiveRow(3, '44.5', '7.25'),
      ],
      null,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 3, win: 44.5, pick: 7.25 });
  });

  it('returns [] for empty or non-array input', () => {
    expect(mergeRows([], [])).toEqual([]);
    expect(mergeRows(null, null)).toEqual([]);
    expect(mergeRows(undefined, [archiveRow(1, 50, 5)])).toEqual([]);
  });
});

describe('homeStats.summarize', () => {
  const rows = [
    { id: 1, name: 'A', win: 50, pick: 20, dWin: 2, dPick: 1 },
    { id: 2, name: 'B', win: 60, pick: 5, dWin: -1, dPick: 0 },
    { id: 3, name: 'C', win: 45, pick: 8, dWin: 6, dPick: 2 },
  ];

  it('picks max win, max pick and max win delta', () => {
    const { topWin, topPick, topJump } = summarize(rows);

    expect(topWin).toBe(rows[1]);
    expect(topPick).toBe(rows[0]);
    expect(topJump).toBe(rows[2]);
  });

  it('resolves ties to the first row in input order', () => {
    const tied = [
      { id: 1, name: 'A', win: 60, pick: 9, dWin: 3, dPick: 0 },
      { id: 2, name: 'B', win: 60, pick: 9, dWin: 3, dPick: 0 },
    ];
    const summary = summarize(tied);

    expect(summary.topWin.id).toBe(1);
    expect(summary.topPick.id).toBe(1);
    expect(summary.topJump.id).toBe(1);
  });

  it('leaves biggest jump empty when no row actually rose', () => {
    const summary = summarize([
      { id: 1, name: 'A', win: 60, pick: 9 },
      { id: 2, name: 'B', win: 50, pick: 4, dWin: -2 },
      { id: 3, name: 'C', win: 45, pick: 8, dWin: 0 },
    ]);

    expect(summary.topJump).toBeNull();
  });

  it('ignores flat rows when a positive rise exists', () => {
    const summary = summarize([
      { id: 1, name: 'A', win: 60, pick: 9, dWin: 0 },
      { id: 2, name: 'B', win: 50, pick: 4, dWin: 1.4 },
    ]);

    expect(summary.topJump.id).toBe(2);
  });

  it('returns nulls for empty, null or all-null input', () => {
    const empty = { topWin: null, topPick: null, topJump: null };

    expect(summarize([])).toEqual(empty);
    expect(summarize(null)).toEqual(empty);
    expect(summarize(undefined)).toEqual(empty);
    expect(summarize([null, { name: 'no numbers' }]).topWin).toBeNull();
    expect(summarize([null, { name: 'no numbers' }]).topPick).toBeNull();
  });
});

// Real-archive regression net: only runs when the deployed trends.json exists
describe('homeStats against the real archive', () => {
  const trends = existsSync(PUBLIC_ARCHIVE)
    ? JSON.parse(readFileSync(PUBLIC_ARCHIVE, 'utf8'))
    : null;

  it('derives four printable modes for the latest period', () => {
    if (!trends) return;

    const periods = trends.periods;
    const current = periods[periods.length - 1];
    const previous = periods.length > 1 ? periods[periods.length - 2] : null;

    for (const mode of ['1v1-high', '1v1-low', '2v2-high', '2v2-low']) {
      const rows = mergeRows(
        DataService.extractScatterData(trends, current, mode),
        previous
          ? DataService.extractScatterData(trends, previous, mode)
          : null,
      );
      const summary = summarize(rows);

      expect(rows.length).toBeGreaterThan(0);
      expect(summary.topWin.win).toBe(Math.max(...rows.map((r) => r.win)));
      expect(summary.topPick.pick).toBe(Math.max(...rows.map((r) => r.pick)));
      const maxJump = Math.max(...rows.map((r) => r.dWin));
      if (maxJump > 0) {
        expect(summary.topJump.dWin).toBe(maxJump);
      } else {
        expect(summary.topJump).toBeNull();
      }
      expect(
        rows.every(
          (row) => Number.isFinite(row.dWin) && Number.isFinite(row.dPick),
        ),
      ).toBe(true);
    }
  });
});
