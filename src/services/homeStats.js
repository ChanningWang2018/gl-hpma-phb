/**
 * Front-page statistics helpers.
 *
 * `DataService.extractScatterData()` speaks the archive dialect
 * (`{ reverberationid, winrate, attendancerate, name }`), while the week
 * plate's three numbers and the inline SVG speak the shorter plate dialect
 * (`{ id, name, win, pick, dWin, dPick }`). Every helper below is pure and
 * defensive: an empty, missing or half-written archive never throws.
 */

/** The four brackets the front page covers, in reading order. */
export const HOME_MODES = ['1v1-high', '1v1-low', '2v2-high', '2v2-low'];

/** The bracket the plate opens on. */
export const DEFAULT_HOME_MODE = '2v2-high';

/** '2v2-high' -> '2v2 High' (the plate's tab label). */
export function formatModeLabel(key) {
  return String(key || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** '2026/09/24' -> { year, month, day }; null when the cell is not a date. */
function parsePeriodDate(value) {
  const parts = String(value).trim().split('/');
  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  if (year <= 0 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
}

/**
 * Archive period -> stable date slug (the period's start day).
 *
 * '2026/09/24 - 2026/09/30' -> '2026-09-24'
 *
 * Used by /analytics?period=… and by any future /issues/YYYY-MM-DD page.
 * Returns null for malformed periods so callers can fall back to the latest
 * issue instead of minting a broken URL.
 *
 * @param {string} period raw archive period
 * @returns {string|null}
 */
export function periodSlug(period) {
  const [start] = String(period || '').split(/\s+-\s+/);
  const parsed = parsePeriodDate(start);
  if (!parsed) return null;
  const pad = (value) => String(value).padStart(2, '0');
  return `${parsed.year}-${pad(parsed.month)}-${pad(parsed.day)}`;
}

/** Find a raw period string by its date slug; null when absent. */
export function findPeriodBySlug(periods, slug) {
  if (!slug || !Array.isArray(periods)) return null;
  return periods.find((period) => periodSlug(period) === slug) ?? null;
}

/**
 * Archive period -> dateline.
 *
 * '2026/09/24 - 2026/09/30' -> '24–30 Sep 2026'
 * '2026/09/28 - 2026/10/04' -> '28 Sep – 04 Oct 2026'
 *
 * An unparseable period is returned unchanged: a broken archive cell must not
 * throw during render.
 *
 * @param {string} period raw archive period
 * @returns {string}
 */
export function formatPeriodRange(period) {
  if (!period) return '';

  const [start, end] = String(period).split(/\s+-\s+/);
  if (!start || !end) return String(period);

  const from = parsePeriodDate(start);
  const to = parsePeriodDate(end);
  if (!from || !to) return String(period);

  if (from.year === to.year && from.month === to.month) {
    return `${from.day}–${to.day} ${MONTHS[to.month - 1]} ${to.year}`;
  }
  const pad2 = (value) => String(value).padStart(2, '0');
  return `${pad2(from.day)} ${MONTHS[from.month - 1]} – ${pad2(to.day)} ${MONTHS[to.month - 1]} ${to.year}`;
}

/**
 * Dateline -> its closing day, which is what the data covers.
 *
 * '24–30 Sep 2026' -> '30 Sep 2026'
 * '28 Sep – 04 Oct 2026' -> '04 Oct 2026'
 *
 * @param {string} periodLabel formatPeriodRange() output
 * @returns {string} the closing day, or '—' when there is nothing to print
 */
export function periodEndLabel(periodLabel) {
  if (!periodLabel) return '—';
  const parts = String(periodLabel).split(/[–-]/);
  return (parts[parts.length - 1] || '').trim() || '—';
}

/** Round to the single decimal place the plate prints. */
const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Coerce a raw archive value to a finite number.
 *
 * @param {*} value raw cell (number, numeric string, null, undefined, '')
 * @returns {number|null} null when the value is missing or not numeric
 */
function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Read a row's echo id from either the archive shape or the plate shape.
 *
 * @param {Object} row
 * @returns {number|string|null}
 */
function idOf(row) {
  return row.reverberationid ?? row.id ?? null;
}

/**
 * Read a row's win rate from either shape.
 *
 * @param {Object} row
 * @returns {number|null}
 */
function winOf(row) {
  return toNumber(row.winrate ?? row.win);
}

/**
 * Read a row's pick rate from either shape.
 *
 * @param {Object} row
 * @returns {number|null}
 */
function pickOf(row) {
  return toNumber(row.attendancerate ?? row.pick);
}

/**
 * Merge this week's rows with last week's so the plate can show movement.
 *
 * Rows keep the order they arrive in, so ties resolve to the first row. A row
 * with no previous-period twin (first ever issue, or an echo new to a bracket)
 * gets `dWin`/`dPick` of 0; deltas are rounded to one decimal, matching the
 * precision the paper prints. Rows without a usable id, win rate or pick rate
 * are skipped instead of poisoning the axis domains.
 *
 * @param {Array<Object>|null|undefined} current this period's rows
 * @param {Array<Object>|null|undefined} previous last period's rows
 * @returns {Array<{id: (number|string), name: string, win: number, pick: number, dWin: number, dPick: number}>}
 */
export function mergeRows(current, previous) {
  const previousById = new Map();
  if (Array.isArray(previous)) {
    for (const row of previous) {
      if (!row) continue;
      const id = idOf(row);
      if (id !== null) previousById.set(id, row);
    }
  }

  if (!Array.isArray(current)) return [];

  const merged = [];
  for (const row of current) {
    if (!row) continue;

    const id = idOf(row);
    const win = winOf(row);
    const pick = pickOf(row);
    if (id === null || win === null || pick === null) continue;

    const previousRow = previousById.get(id);
    const previousWin = previousRow ? winOf(previousRow) : null;
    const previousPick = previousRow ? pickOf(previousRow) : null;

    merged.push({
      id,
      name: row.name ?? previousRow?.name ?? '',
      win,
      pick,
      dWin: previousWin === null ? 0 : round1(win - previousWin),
      dPick: previousPick === null ? 0 : round1(pick - previousPick),
    });
  }

  return merged;
}

/**
 * Find the three headline numbers for a set of merged rows.
 *
 * The plate reads "top win rate" off the max win, "most picked" off the max
 * pick and "biggest jump" off the max week-over-week win delta. Ties keep the
 * first row in input order; rows with no delta at all count as 0, which keeps
 * a first-ever issue printable instead of blank.
 *
 * @param {Array<Object>|null|undefined} rows mergeRows() output
 * @returns {{topWin: Object|null, topPick: Object|null, topJump: Object|null}}
 */
export function summarize(rows) {
  const summary = { topWin: null, topPick: null, topJump: null };
  if (!Array.isArray(rows) || rows.length === 0) return summary;

  let bestWin = -Infinity;
  let bestPick = -Infinity;
  let bestJump = 0;

  for (const row of rows) {
    if (!row) continue;

    const win = winOf(row);
    const pick = pickOf(row);
    const jump = toNumber(row.dWin);

    if (win !== null && win > bestWin) {
      bestWin = win;
      summary.topWin = row;
    }
    if (pick !== null && pick > bestPick) {
      bestPick = pick;
      summary.topPick = row;
    }
    // Only a real, positive week-over-week rise earns "biggest jump"; a first
    // issue or an all-declining bracket leaves it null (the rail prints —).
    if (jump !== null && jump > bestJump) {
      bestJump = jump;
      summary.topJump = row;
    }
  }

  return summary;
}

/**
 * Pick the week's biggest win-rate moves, rises first by default.
 *
 * The front page prints a short leaderboard beside the plate rather than every
 * delta: the three largest rises and the two largest falls. Rows are then
 * ordered by absolute movement so the loudest number sits at the top; ties
 * keep a rise above a fall. Rows without a usable delta and flat rows are
 * skipped, and a first-ever issue simply yields an empty list.
 *
 * @param {Array<Object>|null|undefined} rows mergeRows() output
 * @param {{ups?: number, downs?: number}} [limits]
 * @returns {Array<Object>} at most ups + downs rows, biggest move first
 */
export function rankMovers(rows, { ups = 3, downs = 2 } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const rises = [];
  const falls = [];
  for (const row of rows) {
    if (!row) continue;
    const delta = toNumber(row.dWin);
    if (delta === null || delta === 0) continue;
    (delta > 0 ? rises : falls).push(row);
  }

  rises.sort((a, b) => toNumber(b.dWin) - toNumber(a.dWin));
  falls.sort((a, b) => toNumber(a.dWin) - toNumber(b.dWin));

  return [
    ...rises.slice(0, Math.max(0, ups)),
    ...falls.slice(0, Math.max(0, downs)),
  ].sort(
    (a, b) =>
      Math.abs(toNumber(b.dWin)) - Math.abs(toNumber(a.dWin)) ||
      toNumber(b.dWin) - toNumber(a.dWin),
  );
}
