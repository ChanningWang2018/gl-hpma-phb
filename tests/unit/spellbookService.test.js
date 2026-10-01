// Tests for spellbookService.js — pure logic (filter/search/cost options/
// level table) exercised on synthetic fixtures AND the real committed data.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';

import { SpellbookService } from '../../src/services/spellbookService.js';

// The default singleton points at /data/spellbook/ (only valid once the site
// is served); tests read the committed files from the repo instead.
SpellbookService.configure({ dataBaseUrl: 'public/data/spellbook/' });

// A card fixture shaped exactly like cards.json entries (levels = object keyed
// by level-number strings; v is a number|string union).
function makeCard(overrides = {}) {
  return {
    id: 9001,
    type: 'spell',
    rarity: 'rare',
    cost: 5,
    img: 'images/9001.png',
    spell_word: 'TESTUS',
    tags: ['输出'],
    i18n: {
      zh: { name: '测试咒语', desc: '描述', quote: null, stats: '' },
      en: { name: 'Test Spell', desc: null, quote: null },
    },
    levels: {
      1: [
        { k: '伤害', v: 24, pct: false },
        { k: '目标', v: 'ground', pct: false },
      ],
      2: [{ k: '伤害', v: 25, pct: false }],
    },
    ...overrides,
  };
}

describe('SpellbookService.filterCards', () => {
  const cards = [
    makeCard(),
    makeCard({
      id: 9002,
      type: 'summon',
      rarity: 'epic',
      cost: 0, // falsy cost must stay filterable
      spell_word: null,
      i18n: { zh: { name: '小蜘蛛群' }, en: null },
    }),
    makeCard({
      id: 9003,
      type: 'companion',
      rarity: 'legendary',
      cost: 7,
      spell_word: 'GLACIUS',
      i18n: { zh: { name: '冰冻咒' }, en: { name: 'Glacius' } },
    }),
  ];

  it('filters by type, rarity and cost (including cost 0)', () => {
    expect(SpellbookService.filterCards(cards, { type: 'spell' })).toHaveLength(
      1,
    );
    expect(
      SpellbookService.filterCards(cards, { rarity: 'epic' }).map((c) => c.id),
    ).toEqual([9002]);
    expect(
      SpellbookService.filterCards(cards, { cost: 0 }).map((c) => c.id),
    ).toEqual([9002]);
    expect(
      SpellbookService.filterCards(cards, { cost: '7' }).map((c) => c.id),
    ).toEqual([9003]);
  });

  it("treats 'all' and absent criteria as no-ops and returns a new array", () => {
    const result = SpellbookService.filterCards(cards, {
      type: 'all',
      rarity: 'all',
      cost: 'all',
      search: '',
    });
    expect(result).toHaveLength(3);
    expect(result).not.toBe(cards);
  });

  it('searches zh name, en name and spell_word case-insensitively (any hit wins)', () => {
    // zh name hit
    expect(
      SpellbookService.filterCards(cards, { search: '冰冻' }).map((c) => c.id),
    ).toEqual([9003]);
    // en name hit, case-insensitive
    expect(
      SpellbookService.filterCards(cards, { search: 'test spell' }).map(
        (c) => c.id,
      ),
    ).toEqual([9001]);
    // spell_word hit, case-insensitive
    expect(
      SpellbookService.filterCards(cards, { search: 'glac' }).map((c) => c.id),
    ).toEqual([9003]);
    expect(
      SpellbookService.filterCards(cards, { search: 'TESTUS' }).map(
        (c) => c.id,
      ),
    ).toEqual([9001]);
    // no hit anywhere (and no crash on null spell_word / null en)
    expect(SpellbookService.filterCards(cards, { search: '不存在' })).toEqual(
      [],
    );
    // whitespace-only search is ignored
    expect(SpellbookService.filterCards(cards, { search: '  ' })).toHaveLength(
      3,
    );
  });

  it('combines filters conjunctively', () => {
    expect(
      SpellbookService.filterCards(cards, {
        type: 'spell',
        search: 'test',
      }).map((c) => c.id),
    ).toEqual([9001]);
    expect(
      SpellbookService.filterCards(cards, { type: 'spell', search: 'glac' }),
    ).toEqual([]);
  });
});

describe('SpellbookService.costOptions', () => {
  it('dedupes and sorts ascending', () => {
    expect(
      SpellbookService.costOptions([
        makeCard({ cost: 5 }),
        makeCard({ cost: 0 }),
        makeCard({ cost: 7 }),
        makeCard({ cost: 0 }),
      ]),
    ).toEqual([0, 5, 7]);
  });
});

describe('SpellbookService.formatLevelRows', () => {
  it('formats levels into numerically-ordered rows, preserving v as number|string', () => {
    const rows = SpellbookService.formatLevelRows(
      makeCard({
        levels: {
          10: [{ k: '伤害', v: 33, pct: false }],
          2: [
            { k: '宽度', v: 28, pct: true },
            { k: '目标', v: 'speed_fast', pct: false },
          ],
        },
      }),
    );
    expect(rows.map((r) => r.lv)).toEqual(['2', '10']); // numeric, not lexicographic
    expect(rows[0].entries).toEqual([
      {
        k: '宽度',
        v: 28,
        pct: true,
        unit: null,
        kEn: null,
        unitEn: null,
        display: '28',
      },
      {
        k: '目标',
        v: 'speed_fast',
        pct: false,
        unit: null,
        kEn: null,
        unitEn: null,
        display: 'speed_fast',
      },
    ]);
    expect(rows[1].entries[0]).toEqual({
      k: '伤害',
      v: 33,
      pct: false,
      unit: null,
      kEn: null,
      unitEn: null,
      display: '33',
    });
  });

  it('passes through the schema-2 unit field (subject entity of the stat)', () => {
    const rows = SpellbookService.formatLevelRows(
      makeCard({
        levels: {
          1: [
            { k: '生命值', v: 100, pct: false, unit: '挪威脊背龙蛋' },
            { k: '伤害', v: 24, pct: false },
          ],
        },
      }),
    );
    expect(rows[0].entries[0].unit).toBe('挪威脊背龙蛋');
    expect(rows[0].entries[1].unit).toBe(null); // absent -> card's own effect
  });

  it('carries the schema-3 k_en/unit_en en translations per row', () => {
    const rows = SpellbookService.formatLevelRows(
      makeCard({
        levels: {
          1: [
            {
              k: '生命值',
              v: 100,
              pct: false,
              k_en: 'HP',
              unit: '挪威脊背龙蛋',
              unit_en: 'Norwegian Ridgeback Egg',
            },
            { k: '伤害', v: 24, pct: false, k_en: 'Damage' },
          ],
        },
      }),
    );
    expect(rows[0].entries[0]).toMatchObject({
      kEn: 'HP',
      unitEn: 'Norwegian Ridgeback Egg',
    });
    expect(rows[0].entries[1]).toMatchObject({ kEn: 'Damage', unitEn: null });
  });

  it('returns [] for cards without levels (or null/undefined input)', () => {
    expect(
      SpellbookService.formatLevelRows(makeCard({ levels: undefined })),
    ).toEqual([]);
    expect(SpellbookService.formatLevelRows(null)).toEqual([]);
  });
});

describe('SpellbookService facade over the real committed data', () => {
  let snapshot;

  beforeAll(async () => {
    snapshot = await SpellbookService.load();
  });

  it('load() is idempotent and exposes cards/labels/versionInfo/manifest', async () => {
    expect(snapshot.cards).toHaveLength(141);
    const again = await SpellbookService.load();
    expect(again.cards).toBe(snapshot.cards);
    expect(SpellbookService.cards).toBe(snapshot.cards);
    expect(SpellbookService.labels.type.spell).toEqual({
      zh: '咒语卡',
      en: 'Spell',
    });
    // versionInfo must mirror the committed version.json verbatim
    // (derived assertion survives upstream data bumps without test edits).
    const committedVersion = JSON.parse(
      readFileSync('public/data/spellbook/version.json', 'utf8'),
    );
    expect(SpellbookService.versionInfo).toEqual(committedVersion);
    expect(typeof SpellbookService.manifest).toBe('object');
  });

  it('filters the real data: byType counts 65/52/24', () => {
    expect(
      SpellbookService.filterCards(SpellbookService.cards, { type: 'spell' }),
    ).toHaveLength(65);
    expect(
      SpellbookService.filterCards(SpellbookService.cards, { type: 'summon' }),
    ).toHaveLength(52);
    expect(
      SpellbookService.filterCards(SpellbookService.cards, {
        type: 'companion',
      }),
    ).toHaveLength(24);
  });

  it('searches the real data across zh/en/spell_word', () => {
    const cards = SpellbookService.cards;
    // en name, lowercase query (1001 Glacius + 1138 Glacius-maxima)
    expect(
      SpellbookService.filterCards(cards, { search: 'glacius' }).map(
        (c) => c.id,
      ),
    ).toEqual([1001, 1138]);
    // zh name query on a card whose zh name differs from its en name (1108
    // Prior Incantato / 闪回咒 since v3 completed en names)
    expect(
      SpellbookService.filterCards(cards, { search: '闪回咒' }).map(
        (c) => c.id,
      ),
    ).toEqual([1108]);
    // an en-only query cannot find 1108 by its en title fragment and does not crash
    expect(
      SpellbookService.filterCards(cards, { search: 'flashback' }),
    ).toEqual([]);
  });

  it('derives the real cost option list', () => {
    expect(SpellbookService.costOptions(SpellbookService.cards)).toEqual([
      0, 2, 3, 4, 5, 6, 7, 8, 14, 16,
    ]);
  });

  it('formats the real levels of card 1001 (30 contiguous levels, number|string v)', () => {
    const rows = SpellbookService.formatLevelRows(
      SpellbookService.client.byId(1001),
    );
    expect(rows).toHaveLength(30);
    expect(rows[0]).toEqual({
      lv: '1',
      entries: [
        {
          k: '伤害',
          v: 24,
          pct: false,
          unit: null,
          kEn: 'Damage',
          unitEn: null,
          display: '24',
        },
        {
          k: '宽度',
          v: 28,
          pct: true,
          unit: null,
          kEn: 'Width',
          unitEn: null,
          display: '28',
        },
        {
          k: '二段伤害',
          v: 96,
          pct: false,
          unit: null,
          kEn: 'Secondary',
          unitEn: null,
          display: '96',
        },
        {
          k: '范围半径',
          v: 25,
          pct: true,
          unit: null,
          kEn: 'Range',
          unitEn: null,
          display: '25',
        },
        {
          k: '控制时间',
          v: 3,
          pct: false,
          unit: null,
          kEn: 'Control Duration',
          unitEn: null,
          display: '3',
        },
        {
          k: '目标',
          v: 'ground',
          pct: false,
          unit: null,
          kEn: 'Target',
          unitEn: null,
          display: 'ground',
        },
      ],
    });
  });

  it('carries the schema-2 unit subjects of the real data (1011 自身 + 增益效果)', () => {
    const rows = SpellbookService.formatLevelRows(
      SpellbookService.client.byId(1011),
    );
    const units = rows[0].entries.map((e) => e.unit);
    expect(units.some((u) => u === null)).toBe(true); // 卡自身效果
    expect(units).toContain('增益效果');
  });

  it('keeps non-contiguous level keys (card 1002: 1..30 then 41..60)', () => {
    const rows = SpellbookService.formatLevelRows(
      SpellbookService.client.byId(1002),
    );
    expect(rows).toHaveLength(50); // 30 + 20 keys, the 31..40 gap is not fabricated
    expect(rows[29].lv).toBe('30');
    expect(rows[30].lv).toBe('41'); // the gap is preserved, order numeric
  });

  it('returns [] for the two cards that have no levels (1108, 1176)', () => {
    expect(
      SpellbookService.formatLevelRows(SpellbookService.client.byId(1108)),
    ).toEqual([]);
    expect(
      SpellbookService.formatLevelRows(SpellbookService.client.byId(1176)),
    ).toEqual([]);
  });

  it('resolves real image URLs from version.json imageBase', () => {
    const { imageBase } = JSON.parse(
      readFileSync('public/data/spellbook/version.json', 'utf8'),
    );
    expect(SpellbookService.imageUrl(1001)).toBe(`${imageBase}images/1001.png`);
  });

  it('label()/text() delegate with zh fallback', () => {
    expect(SpellbookService.label('rarity', 'forbidden')).toBe('禁忌');
    const card = SpellbookService.client.byId(1001);
    // v3 在数据侧补全了 en.stats，text() 直接返回 en 值（不再回退 zh）
    expect(SpellbookService.text(card, 'en', 'stats')).toBe(card.i18n.en.stats);
  });

  it('tags() returns the locale list, en falling back to the zh top-level tags', () => {
    const card = SpellbookService.client.byId(1001);
    expect(SpellbookService.tags(card, 'zh')).toEqual(card.tags);
    expect(SpellbookService.tags(card, 'en')).toEqual(card.i18n.en.tags);
    // fixture without i18n.en.tags degrades to the zh list
    expect(SpellbookService.tags({ tags: ['输出'] }, 'en')).toEqual(['输出']);
    expect(SpellbookService.tags({}, 'zh')).toEqual([]);
  });
});
