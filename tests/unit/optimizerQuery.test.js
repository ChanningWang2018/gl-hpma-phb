import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPTIMIZER_INPUTS,
  OPTIMIZER_CURRENCIES,
  OPTIMIZER_STRATEGIES,
  parseOptimizerBudget,
  parseOptimizerQuery,
  serializeOptimizerQuery,
} from '../../src/services/optimizerQuery.js';

describe('optimizerQuery.parseOptimizerQuery', () => {
  it('returns the defaults for an absent query', () => {
    expect(parseOptimizerQuery({})).toEqual(DEFAULT_OPTIMIZER_INPUTS);
    expect(parseOptimizerQuery(undefined)).toEqual(DEFAULT_OPTIMIZER_INPUTS);
    expect(parseOptimizerQuery(null)).toEqual(DEFAULT_OPTIMIZER_INPUTS);
    expect(parseOptimizerQuery('currency=gems')).toEqual(
      DEFAULT_OPTIMIZER_INPUTS,
    );
  });

  it('keeps valid non-default values', () => {
    expect(
      parseOptimizerQuery({
        currency: 'gems',
        budget: '12000',
        strategy: 'maximize_stock',
      }),
    ).toEqual({
      currency: 'gems',
      budget: 12000,
      strategy: 'maximize_stock',
    });
  });

  it('falls back field by field instead of blanking the whole query', () => {
    expect(
      parseOptimizerQuery({
        currency: 'silver',
        budget: '12000',
        strategy: 'maximize_stock',
      }),
    ).toEqual({
      currency: 'gold',
      budget: 12000,
      strategy: 'maximize_stock',
    });

    expect(
      parseOptimizerQuery({
        currency: 'gems',
        budget: 'not-a-number',
        strategy: 'liquidate',
      }),
    ).toEqual({
      currency: 'gems',
      budget: null,
      strategy: 'minimize_stock',
    });
  });

  it('rejects unknown, repeated and misspelled enum values', () => {
    const query = parseOptimizerQuery({
      currency: ['gems', 'gold'],
      budget: ['12000'],
      strategy: ['maximize_stock'],
    });

    expect(query).toEqual({
      currency: 'gold',
      budget: null,
      strategy: 'minimize_stock',
    });
    expect(
      parseOptimizerQuery({ currency: 'GEMS', strategy: 'Maximize_Stock' }),
    ).toEqual(DEFAULT_OPTIMIZER_INPUTS);
  });

  it('exposes the accepted values as constants', () => {
    expect(OPTIMIZER_CURRENCIES).toEqual(['gold', 'gems']);
    expect(OPTIMIZER_STRATEGIES).toEqual(['minimize_stock', 'maximize_stock']);
  });
});

describe('optimizerQuery.parseOptimizerBudget', () => {
  it.each(['1', '1000', '12000', '20000', '9007199254740991'])(
    'accepts the positive integer %s',
    (value) => {
      expect(parseOptimizerBudget(value)).toBe(Number(value));
    },
  );

  it.each([
    '',
    '0',
    '-1',
    '+1',
    '1.5',
    '1e3',
    'abc',
    ' 12000',
    '12000 ',
    '12abc',
    '9007199254740992',
  ])('rejects %j', (value) => {
    expect(parseOptimizerBudget(value)).toBeNull();
  });

  it('rejects non-string query shapes', () => {
    expect(parseOptimizerBudget(12000)).toBeNull();
    expect(parseOptimizerBudget(['12000'])).toBeNull();
    expect(parseOptimizerBudget({})).toBeNull();
    expect(parseOptimizerBudget(null)).toBeNull();
    expect(parseOptimizerBudget(undefined)).toBeNull();
  });
});

describe('optimizerQuery.serializeOptimizerQuery', () => {
  it('emits nothing for defaults, so the clean URL stays clean', () => {
    expect(serializeOptimizerQuery()).toEqual({});
    expect(serializeOptimizerQuery(DEFAULT_OPTIMIZER_INPUTS)).toEqual({});
  });

  it('emits only non-default values', () => {
    expect(
      serializeOptimizerQuery({
        currency: 'gems',
        budget: 12000,
        strategy: 'maximize_stock',
      }),
    ).toEqual({
      currency: 'gems',
      budget: '12000',
      strategy: 'maximize_stock',
    });

    expect(serializeOptimizerQuery({ budget: 12000 })).toEqual({
      budget: '12000',
    });
    expect(serializeOptimizerQuery({ currency: 'gems' })).toEqual({
      currency: 'gems',
    });
    expect(serializeOptimizerQuery({ strategy: 'maximize_stock' })).toEqual({
      strategy: 'maximize_stock',
    });
  });

  it('canonicalises a numeric-string budget', () => {
    expect(serializeOptimizerQuery({ budget: '012000' })).toEqual({
      budget: '12000',
    });
  });

  it('omits invalid state instead of writing it to the URL', () => {
    expect(
      serializeOptimizerQuery({
        currency: 'silver',
        budget: 0,
        strategy: 'liquidate',
      }),
    ).toEqual({});
    expect(serializeOptimizerQuery({ budget: '' })).toEqual({});
    expect(serializeOptimizerQuery({ budget: -5 })).toEqual({});
    expect(serializeOptimizerQuery({ budget: 1.5 })).toEqual({});
    expect(serializeOptimizerQuery({ budget: 'not-a-number' })).toEqual({});
  });
});

describe('optimizerQuery round trips', () => {
  it('parses what it serialises', () => {
    const inputs = {
      currency: 'gems',
      budget: 12000,
      strategy: 'maximize_stock',
    };

    expect(parseOptimizerQuery(serializeOptimizerQuery(inputs))).toEqual(
      inputs,
    );
  });

  it('round-trips a canonical query unchanged', () => {
    const query = {
      currency: 'gems',
      budget: '12000',
      strategy: 'maximize_stock',
    };

    expect(serializeOptimizerQuery(parseOptimizerQuery(query))).toEqual(query);
  });

  it('round-trips defaults to an empty query', () => {
    expect(
      serializeOptimizerQuery(parseOptimizerQuery(DEFAULT_OPTIMIZER_INPUTS)),
    ).toEqual({});
  });

  it('round-trips each field on its own', () => {
    const cases = [
      { currency: 'gems' },
      { budget: 12000 },
      { strategy: 'maximize_stock' },
    ];

    for (const inputs of cases) {
      expect(parseOptimizerQuery(serializeOptimizerQuery(inputs))).toEqual({
        ...DEFAULT_OPTIMIZER_INPUTS,
        ...inputs,
      });
    }
  });

  it('cleans an invalid query back to the defaults', () => {
    const parsed = parseOptimizerQuery({
      currency: 'silver',
      budget: '-1',
      strategy: 'liquidate',
    });

    expect(parsed).toEqual(DEFAULT_OPTIMIZER_INPUTS);
    expect(serializeOptimizerQuery(parsed)).toEqual({});
  });
});
