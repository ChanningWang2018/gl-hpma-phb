/**
 * Front-page statistics helpers.
 *
 * `DataService.extractScatterData()` speaks the archive dialect
 * (`{ reverberationid, winrate, attendancerate, name }`), while the week
 * plate's three numbers and the inline SVG speak the shorter plate dialect
 * (`{ id, name, win, pick, dWin, dPick }`). Both helpers below are pure and
 * defensive: an empty, missing or half-written archive never throws.
 */

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
