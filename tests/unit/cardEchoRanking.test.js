import {
  echoDisplayName,
  formatEchoScore,
  rankDeckEchoesForCard,
  RELATED_ECHO_LIMIT,
} from '../../src/services/cardEchoRanking.js';

const character = (id, { deck = true, zh, en } = {}) => ({
  id,
  deck,
  i18n: {
    zh: { name: zh ?? `角色 ${id}` },
    en: { name: en ?? `Echo ${id}` },
  },
});

const lookupFrom = (rowsByCharacter) => (characterId) =>
  rowsByCharacter[characterId] ?? [];

describe('cardEchoRanking.rankDeckEchoesForCard', () => {
  it('ranks deck characters by score, highest first', () => {
    const characters = [
      character(1001),
      character(1002),
      character(1003),
      character(9999, { deck: false }),
    ];
    const scoresForCharacter = lookupFrom({
      1001: [
        { cardId: 1022, score: 120 },
        { cardId: 1001, score: 200 },
      ],
      1002: [{ cardId: 1022, score: '185.1' }],
      9999: [{ cardId: 1022, score: 999 }],
      1003: [],
    });

    const ranked = rankDeckEchoesForCard({
      cardId: 1022,
      characters,
      scoresForCharacter,
    });

    expect(ranked.map((row) => row.id)).toEqual([1002, 1001]);
    expect(ranked[0].score).toBe(185.1);
    expect(ranked[1].score).toBe(120);
    expect(ranked[0].character).toBe(characters[1]);
  });

  it('matches numeric and string card ids', () => {
    const characters = [character(1002), character(1004)];
    const scoresForCharacter = lookupFrom({
      1002: [{ cardId: '1022', score: 131.2 }],
      1004: [{ cardId: 'nope', score: 999 }],
    });

    expect(
      rankDeckEchoesForCard({
        cardId: '1022',
        characters,
        scoresForCharacter,
      }).map((row) => row.id),
    ).toEqual([1002]);
  });

  it('caps the result at the related-echo limit by default', () => {
    const characters = Array.from({ length: 8 }, (_, index) =>
      character(2000 + index),
    );
    const scoresForCharacter = lookupFrom(
      Object.fromEntries(
        characters.map((entry, index) => [
          entry.id,
          [{ cardId: 1022, score: index * 10 }],
        ]),
      ),
    );

    const ranked = rankDeckEchoesForCard({
      cardId: 1022,
      characters,
      scoresForCharacter,
    });

    expect(RELATED_ECHO_LIMIT).toBe(6);
    expect(ranked).toHaveLength(6);
    expect(ranked.map((row) => row.id)).toEqual([
      2007, 2006, 2005, 2004, 2003, 2002,
    ]);
  });

  it('honours an explicit limit', () => {
    const characters = [character(1001), character(1002), character(1003)];
    const scoresForCharacter = (id) => [{ cardId: 1022, score: id }];

    expect(
      rankDeckEchoesForCard({
        cardId: 1022,
        characters,
        scoresForCharacter,
        limit: 2,
      }).map((row) => row.id),
    ).toEqual([1003, 1002]);
  });

  it('breaks ties by character id for deterministic output', () => {
    const characters = [character(1004), character(1002), character(1003)];
    const scoresForCharacter = () => [{ cardId: 1022, score: 100 }];

    expect(
      rankDeckEchoesForCard({
        cardId: 1022,
        characters,
        scoresForCharacter,
      }).map((row) => row.id),
    ).toEqual([1002, 1003, 1004]);
  });

  it('keeps the best score when a character has duplicate rows for the card', () => {
    const characters = [character(1002)];
    const scoresForCharacter = () => [
      { cardId: 1022, score: 120 },
      { cardId: 1022, score: 131.5 },
    ];

    expect(
      rankDeckEchoesForCard({
        cardId: 1022,
        characters,
        scoresForCharacter,
      })[0].score,
    ).toBe(131.5);
  });

  it('ignores malformed scores, ids and characters without deck access', () => {
    const characters = [
      character(1001),
      character(1002, { deck: false }),
      null,
      { id: 'nope', deck: true },
    ];
    const scoresForCharacter = lookupFrom({
      1001: [
        { cardId: 1022, score: 'not a number' },
        { cardId: 1022, score: null },
        { cardId: 1001, score: 200 },
      ],
      1002: [{ cardId: 1022, score: 999 }],
    });

    expect(
      rankDeckEchoesForCard({
        cardId: 1022,
        characters,
        scoresForCharacter,
      }),
    ).toEqual([]);
  });

  it('returns an empty list for an invalid card id or lookup', () => {
    const characters = [character(1002)];
    const scoresForCharacter = () => [{ cardId: 1022, score: 100 }];

    expect(
      rankDeckEchoesForCard({
        cardId: null,
        characters,
        scoresForCharacter,
      }),
    ).toEqual([]);
    expect(
      rankDeckEchoesForCard({
        cardId: 1022,
        characters,
        scoresForCharacter: null,
      }),
    ).toEqual([]);
    expect(rankDeckEchoesForCard()).toEqual([]);
  });
});

describe('cardEchoRanking.formatEchoScore', () => {
  it('prints one decimal for finite scores', () => {
    expect(formatEchoScore(169.613625467)).toBe('169.6');
    expect(formatEchoScore('131.25')).toBe('131.3');
    expect(formatEchoScore(100)).toBe('100.0');
    expect(formatEchoScore(0)).toBe('0.0');
  });

  it('prints an em dash for missing or non-numeric scores', () => {
    expect(formatEchoScore(null)).toBe('—');
    expect(formatEchoScore(undefined)).toBe('—');
    expect(formatEchoScore('')).toBe('—');
    expect(formatEchoScore('nope')).toBe('—');
  });
});

describe('cardEchoRanking.echoDisplayName', () => {
  it('uses the requested locale with en -> zh fallback', () => {
    const entry = character(1002, { zh: '哈利·波特', en: 'Harry Potter' });
    expect(echoDisplayName(entry, 'zh')).toBe('哈利·波特');
    expect(echoDisplayName(entry, 'en')).toBe('Harry Potter');
    expect(echoDisplayName({ i18n: { en: { name: 'Only English' } } })).toBe(
      'Only English',
    );
  });

  it('strips game rich-text tags and trims whitespace', () => {
    expect(
      echoDisplayName(
        { i18n: { zh: { name: ' <color=focus_dark>赫敏</color> ' } } },
        'zh',
      ),
    ).toBe('赫敏');
  });

  it('returns an empty string for a missing character', () => {
    expect(echoDisplayName(null, 'zh')).toBe('');
  });
});
