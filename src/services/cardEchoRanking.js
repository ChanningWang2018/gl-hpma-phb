// Pure helpers for the "related echoes" block on /cards/:id.
//
// `echoes.json` keeps card↔character scores character-first (see
// EchoService.load): scoresForCharacter(characterId) returns
// [{ cardId, nameZh, score }]. The card page needs the reverse view — which
// deck echoes fit this card best — so this module ranks the existing
// character-first rows without changing the EchoService API or the data
// schema.
//
// Only `deck: true` characters are eligible: the score table also contains
// non-deck and alternate ids (101001, 201015, …) that have no /echoes/:id
// page, so they are filtered out before ranking.

export const RELATED_ECHO_LIMIT = 6;

/**
 * Reverse-rank the deck characters for one card by the game's echo score.
 *
 * @param {object} options
 * @param {number|string} options.cardId Card id to look up (e.g. 1022).
 * @param {Array<object>} options.characters Candidate characters; rows without
 *   `deck: true` are ignored.
 * @param {(characterId: number) => Array<{cardId: number|string, score: number}>}
 *   options.scoresForCharacter Read-only score lookup, normally
 *   EchoService.scoresForCharacter / echoStore.scoresForCharacter.
 * @param {number} [options.limit] Maximum rows to return (default 6).
 * @returns {Array<{ id: number, score: number, character: object }>} Sorted by
 *   score descending, then id ascending for deterministic ties.
 */
export function rankDeckEchoesForCard({
  cardId,
  characters = [],
  scoresForCharacter,
  limit = RELATED_ECHO_LIMIT,
} = {}) {
  const target = Number(cardId);
  if (!Number.isFinite(target) || typeof scoresForCharacter !== 'function') {
    return [];
  }
  const max = Number.isInteger(limit) && limit > 0 ? limit : RELATED_ECHO_LIMIT;
  const ranked = [];

  for (const character of characters) {
    if (!character || character.deck !== true) continue;
    const id = Number(character.id);
    if (!Number.isFinite(id)) continue;

    let best = null;
    for (const entry of scoresForCharacter(id) ?? []) {
      if (Number(entry?.cardId) !== target) continue;
      if (
        entry?.score === null ||
        entry?.score === undefined ||
        entry?.score === ''
      ) {
        continue;
      }
      const score = Number(entry.score);
      if (!Number.isFinite(score)) continue;
      if (best === null || score > best) best = score;
    }
    if (best !== null) ranked.push({ id, score: best, character });
  }

  ranked.sort((a, b) => b.score - a.score || a.id - b.id);
  return ranked.slice(0, max);
}

/** One decimal, matching the echo detail page's score display. */
export function formatEchoScore(value) {
  if (value === null || value === undefined || value === '') return '—';
  return Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '—';
}

/**
 * Locale-aware character name with the same fallback order as EchoDetail
 * (requested locale -> en -> zh) plus game rich-text tag stripping.
 */
export function echoDisplayName(character, locale = 'zh') {
  const i18n = character?.i18n ?? {};
  const name =
    i18n[locale]?.name ?? i18n.en?.name ?? i18n.zh?.name ?? String('');
  return String(name)
    .replace(/<[^>]+>/g, '')
    .trim();
}
