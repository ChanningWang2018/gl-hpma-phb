// Tests for spellbookService.js — pure logic (filter/search/cost options/
// level table) exercised on synthetic fixtures AND the real committed data.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';

import { SpellbookService } from '../../src/services/spellbookService.js';

// The default singleton points at /data/spellbook/ (only valid once the site
// is served); tests read the committed files from the repo instead.
SpellbookService.configure({ dataBaseUrl: 'public/data/spellbook/' });

// A card fixture shaped exactly like cards.json entries (schema 6: levels is
// an object of { battle_show?, rows } blocks keyed by level-number strings;
// v is a number|string union).
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
      1: {
        battle_show: [1],
        rows: [
          { attr_name: 'damage', k: '伤害', k_en: 'Damage', v: 24 },
          { attr_name: 'targets', k: '目标', k_en: 'Target', v: 'ground' },
        ],
      },
      2: { rows: [{ attr_name: 'damage', k: '伤害', v: 25 }] },
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
          10: { rows: [{ k: '伤害', v: 33 }] },
          2: {
            battle_show: [1], // raw 1-based game field: passed over, not consumed
            rows: [
              { attr_name: 'width', k: '宽度', v: 28 },
              { attr_name: 'targets', k: '目标', v: 'speed_fast' },
            ],
          },
        },
      }),
    );
    expect(rows.map((r) => r.lv)).toEqual(['2', '10']); // numeric, not lexicographic
    expect(rows[0].entries).toEqual([
      {
        k: '宽度',
        v: 28,
        unit: null,
        kEn: null,
        unitEn: null,
        display: '28',
      },
      {
        k: '目标',
        v: 'speed_fast',
        unit: null,
        kEn: null,
        unitEn: null,
        display: 'speed_fast',
      },
    ]);
    expect(rows[1].entries[0]).toEqual({
      k: '伤害',
      v: 33,
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
          1: {
            rows: [
              { k: '生命值', v: 100, unit: '挪威脊背龙蛋' },
              { k: '伤害', v: 24 },
            ],
          },
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
          1: {
            rows: [
              {
                k: '生命值',
                v: 100,
                k_en: 'HP',
                unit: '挪威脊背龙蛋',
                unit_en: 'Norwegian Ridgeback Egg',
              },
              { k: '伤害', v: 24, k_en: 'Damage' },
            ],
          },
        },
      }),
    );
    expect(rows[0].entries[0]).toMatchObject({
      kEn: 'HP',
      unitEn: 'Norwegian Ridgeback Egg',
    });
    expect(rows[0].entries[1]).toMatchObject({ kEn: 'Damage', unitEn: null });
  });

  it('reads only block.rows: a dirty battle_show never leaks into the output', () => {
    // battle_show is the raw 1-based game field and may carry out-of-range
    // values; the defense is not consuming it (headline rule = face_attrs).
    const rows = SpellbookService.formatLevelRows(
      makeCard({
        levels: {
          1: { battle_show: [0, 99], rows: [{ k: '伤害', v: 24 }] },
        },
      }),
    );
    expect(rows[0].entries).toEqual([
      { k: '伤害', v: 24, unit: null, kEn: null, unitEn: null, display: '24' },
    ]);
  });

  it('degrades a malformed level block to no entries instead of crashing', () => {
    const rows = SpellbookService.formatLevelRows(
      makeCard({
        levels: { 1: {}, 2: null, 3: { rows: [{ k: '伤害', v: 1 }] } },
      }),
    );
    expect(rows.map((r) => r.lv)).toEqual(['1', '2', '3']);
    expect(rows[0].entries).toEqual([]);
    expect(rows[1].entries).toEqual([]);
    expect(rows[2].entries).toHaveLength(1);
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
          unit: null,
          kEn: 'Damage',
          unitEn: null,
          display: '24',
        },
        {
          k: '宽度',
          v: 28,
          unit: null,
          kEn: 'Width',
          unitEn: null,
          display: '28',
        },
        {
          k: '二段伤害',
          v: 96,
          unit: null,
          kEn: 'Secondary',
          unitEn: null,
          display: '96',
        },
        {
          k: '范围半径',
          v: 25,
          unit: null,
          kEn: 'Range',
          unitEn: null,
          display: '25',
        },
        {
          k: '控制时间',
          v: 3,
          unit: null,
          kEn: 'Control Duration',
          unitEn: null,
          display: '3',
        },
        {
          k: '目标',
          v: 'ground',
          unit: null,
          kEn: 'Target',
          unitEn: null,
          display: 'ground',
        },
      ],
    });
  });

  it('exposes the schema-6 face_attrs headline tuple of the real data', () => {
    expect(SpellbookService.faceAttrs).toEqual([
      'hp',
      'damage',
      'shield',
      'duration',
    ]);
    // The headline rule it encodes: rows with these attr_names exist on the
    // real cards and are exactly the ones the game face headlines.
    const rows1001 = SpellbookService.formatLevelRows(
      SpellbookService.client.byId(1001),
    )[0].entries;
    expect(rows1001.some((e) => e.k === '伤害')).toBe(true); // attr_name damage
  });

  it('carries the schema-2 unit subjects of the real data (1011 自身 + 增益效果)', () => {
    const rows = SpellbookService.formatLevelRows(
      SpellbookService.client.byId(1011),
    );
    const units = rows[0].entries.map((e) => e.unit);
    expect(units.some((u) => u === null)).toBe(true); // 卡自身效果
    expect(units).toContain('增益效果');
  });

  it('keeps non-contiguous level keys ordered without fabricating the gap', () => {
    // v6 keeps every level key contiguous 1..30; the gap behaviour is covered
    // with a synthetic card instead.
    const rows = SpellbookService.formatLevelRows({
      levels: {
        1: { rows: [{ k: '伤害', v: 10 }] },
        3: { rows: [{ k: '伤害', v: 30 }] },
      },
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.lv)).toEqual(['1', '3']); // the 2 gap is not fabricated
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

  it('exposes the native frame table and derives every frame URL from imageBase', () => {
    const frames = SpellbookService.frames;
    // 6 rarities, spec shape { file, size, inner } (schema 5 frames table)
    expect(Object.keys(frames).sort()).toEqual([
      'common',
      'dark',
      'epic',
      'legendary',
      'mythic',
      'rare',
    ]);
    for (const meta of Object.values(frames)) {
      expect(meta.file).toMatch(/^frame_[a-z]+\.png$/);
      expect(meta.size).toHaveLength(2);
      expect(meta.inner).toHaveLength(4);
    }
    // frameUrl() = version.json imageBase + frames/<file>, derived per entry
    const { imageBase } = JSON.parse(
      readFileSync('public/data/spellbook/version.json', 'utf8'),
    );
    for (const [rarity, meta] of Object.entries(frames)) {
      expect(SpellbookService.frameUrl(rarity)).toBe(
        `${imageBase}frames/${meta.file}`,
      );
    }
    // unknown rarity -> null without throwing (decorative, CSS fallback)
    expect(SpellbookService.frameUrl('nonexistent')).toBe(null);
  });

  it('label()/text() delegate with zh fallback', () => {
    expect(SpellbookService.label('rarity', 'dark')).toBe('深渊');
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
