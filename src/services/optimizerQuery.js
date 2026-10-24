/**
 * URL-state helpers for /sales-optimizer.
 *
 * The shareable surface is deliberately just the three inputs:
 *
 *   ?currency=gold|gems&budget=12000&strategy=minimize_stock|maximize_stock
 *
 * Defaults are omitted, so the canonical /sales-optimizer URL stays clean.
 * Inventory and the results panel are not part of the URL: inventory is large
 * and results are derived from it.
 */

/** Currencies the optimizer accepts. */
export const OPTIMIZER_CURRENCIES = ['gold', 'gems'];

/** Selling strategies the optimizer accepts. */
export const OPTIMIZER_STRATEGIES = ['minimize_stock', 'maximize_stock'];

/** The state used when a field is absent or invalid. */
export const DEFAULT_OPTIMIZER_INPUTS = Object.freeze({
  currency: 'gold',
  budget: null,
  strategy: 'minimize_stock',
});

const isOneOf = (value, options) =>
  typeof value === 'string' && options.includes(value);

/**
 * Read a budget query value.
 *
 * Only a plain, positive, safe integer is accepted. vue-router hands query
 * values over as strings (or arrays for repeated keys); anything else — zero,
 * negatives, decimals, junk, `?budget=1&budget=2` — falls back to no budget
 * instead of producing a broken input.
 *
 * @param {*} value raw query value
 * @returns {number|null} positive integer, or null when absent/invalid
 */
export function parseOptimizerBudget(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const budget = Number(value);
  return Number.isSafeInteger(budget) && budget > 0 ? budget : null;
}

/** Budget from component state: v-model.number yields a number, tests may pass a string. */
function normalizeBudget(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  return parseOptimizerBudget(value);
}

/**
 * Read ?currency=&budget=&strategy= into the optimizer's input shape.
 *
 * Each field falls back independently, so one bad parameter never blanks the
 * page or discards the other valid ones.
 *
 * @param {Object|null|undefined} query vue-router query object
 * @returns {{currency: string, budget: number|null, strategy: string}}
 */
export function parseOptimizerQuery(query) {
  const source = query && typeof query === 'object' ? query : {};

  return {
    currency: isOneOf(source.currency, OPTIMIZER_CURRENCIES)
      ? source.currency
      : DEFAULT_OPTIMIZER_INPUTS.currency,
    budget: parseOptimizerBudget(source.budget),
    strategy: isOneOf(source.strategy, OPTIMIZER_STRATEGIES)
      ? source.strategy
      : DEFAULT_OPTIMIZER_INPUTS.strategy,
  };
}

/**
 * Write the optimizer's input shape into a vue-router query object.
 *
 * Only values that differ from the defaults are emitted; budget must be a
 * positive integer. Invalid or blank state is omitted, so the URL can never
 * carry a value the parser would reject.
 *
 * @param {{currency?: string, budget?: (number|string|null), strategy?: string}} [inputs]
 * @returns {{currency?: string, budget?: string, strategy?: string}}
 */
export function serializeOptimizerQuery(inputs = {}) {
  const source = inputs && typeof inputs === 'object' ? inputs : {};
  const query = {};

  if (
    isOneOf(source.currency, OPTIMIZER_CURRENCIES) &&
    source.currency !== DEFAULT_OPTIMIZER_INPUTS.currency
  ) {
    query.currency = source.currency;
  }

  const budget = normalizeBudget(source.budget);
  if (budget !== null) query.budget = String(budget);

  if (
    isOneOf(source.strategy, OPTIMIZER_STRATEGIES) &&
    source.strategy !== DEFAULT_OPTIMIZER_INPUTS.strategy
  ) {
    query.strategy = source.strategy;
  }

  return query;
}
