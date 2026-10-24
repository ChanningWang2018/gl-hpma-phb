// Echoes data module (2026-10 split from hpma-bits/hpma-spellbook).
//
// Layout: public/data/echoes/{echoes.json, manifest.json, version.json}
// - echoes.json: 184 echo variants / 46 character rows / labels / rarity
//   backgrounds / affixes / growth / economy / card↔character scores.
// - The 19 `deck: true` characters are the player-visible echoes; weekly
//   stats still key on the crawler's old 1..19 reverberation ids, so the
//   explicit STATS_ECHO_IDS table maps those to character ids.
//
// Image paths are relative to the module root (images/<name>.png); the
// version.json imageBase points at the pinned data-repo tag. Card images stay
// in SpellbookService; this module owns echo icons only.
import { joinUrl } from '@/services/spellbookClient.js';

export const EXPECTED_SCHEMA_VERSION = 1;
export const DEFAULT_DATA_BASE_URL = '/data/echoes/';

// Crawler `reverberationid` (1..19) -> echoes.json character id.
// Explicit on purpose: ids are independent spaces (see echoes.schema.json).
export const STATS_ECHO_IDS = Object.freeze({
  1: 1001, // Hermione Granger
  2: 1002, // Harry Potter
  3: 1003, // Dobby
  4: 1004, // Rubeus Hagrid
  5: 1005, // Weasley twins
  6: 1006, // Newt Scamander
  7: 1008, // Severus Snape
  8: 1010, // Neville Longbottom
  9: 1012, // Bellatrix Lestrange
  10: 1015, // Luna Lovegood
  11: 1011, // Filius Flitwick
  12: 1021, // Sirius Black
  13: 1025, // Ron Weasley
  14: 1030, // Ginny Weasley
  15: 1034, // Albus Dumbledore
  16: 1035, // Minerva McGonagall
  17: 1036, // Voldemort
  18: 1037, // Cedric Diggory
  19: 1038, // Gellert Grindelwald
});

const STATS_ID_BY_CHARACTER = Object.fromEntries(
  Object.entries(STATS_ECHO_IDS).map(([statsId, characterId]) => [
    characterId,
    Number(statsId),
  ]),
);

/** `images/x.png` + `images_webp/` -> `images_webp/x.webp`. */
export function toWebpPath(path, webpDir) {
  if (typeof path !== 'string' || !path.startsWith('images/')) return null;
  if (!path.endsWith('.png')) return null;
  if (typeof webpDir !== 'string' || !webpDir) return null;
  return `${webpDir.replace(/\/+$/, '')}/${path.slice(
    'images/'.length,
    -'.png'.length,
  )}.webp`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

export class EchoService {
  static snapshot = null;
  static inFlight = null;

  static async load() {
    if (EchoService.snapshot) return EchoService.snapshot;
    if (!EchoService.inFlight) {
      EchoService.inFlight = Promise.all([
        fetchJson(`${DEFAULT_DATA_BASE_URL}echoes.json`),
        fetchJson(`${DEFAULT_DATA_BASE_URL}manifest.json`),
        fetchJson(`${DEFAULT_DATA_BASE_URL}version.json`),
      ])
        .then(([data, manifest, versionInfo]) => {
          if (data?.schema_version !== EXPECTED_SCHEMA_VERSION) {
            throw new Error(
              `echoes.json schema_version=${data?.schema_version}，` +
                `消费端只支持 ${EXPECTED_SCHEMA_VERSION}`,
            );
          }
          const characters = Array.isArray(data.characters)
            ? data.characters
            : [];
          const echoes = Array.isArray(data.echoes) ? data.echoes : [];
          const charactersById = new Map(
            characters.map((character) => [character.id, character]),
          );
          const echoesByCharacter = new Map();
          for (const echo of echoes) {
            if (!echoesByCharacter.has(echo.character_id)) {
              echoesByCharacter.set(echo.character_id, []);
            }
            echoesByCharacter.get(echo.character_id).push(echo);
          }
          const scoresByCharacter = new Map();
          for (const row of data.card_echo_scores ?? []) {
            for (const [characterId, score] of Object.entries(
              row.scores ?? {},
            )) {
              const id = Number(characterId);
              if (!scoresByCharacter.has(id)) {
                scoresByCharacter.set(id, []);
              }
              scoresByCharacter.get(id).push({
                cardId: row.card_id,
                nameZh: row.name_zh,
                score,
              });
            }
          }
          for (const list of scoresByCharacter.values()) {
            list.sort((a, b) => b.score - a.score);
          }
          EchoService.snapshot = {
            data,
            manifest,
            versionInfo,
            characters,
            charactersById,
            deckCharacters: characters.filter((character) => character.deck),
            echoes,
            echoesByCharacter,
            scoresByCharacter,
          };
          return EchoService.snapshot;
        })
        .finally(() => {
          EchoService.inFlight = null;
        });
    }
    return EchoService.inFlight;
  }

  static requireLoaded() {
    if (!EchoService.snapshot) {
      throw new Error(
        'No echo data loaded yet — call `await EchoService.load()` first.',
      );
    }
    return EchoService.snapshot;
  }

  static get characters() {
    return EchoService.requireLoaded().characters;
  }

  static get deckCharacters() {
    return EchoService.requireLoaded().deckCharacters;
  }

  static get echoes() {
    return EchoService.requireLoaded().echoes;
  }

  static get versionInfo() {
    return EchoService.requireLoaded().versionInfo;
  }

  static get labels() {
    return EchoService.requireLoaded().data.labels ?? {};
  }

  static characterById(id) {
    return EchoService.requireLoaded().charactersById.get(Number(id)) ?? null;
  }

  static characterByStatsId(statsId) {
    return EchoService.characterById(STATS_ECHO_IDS[Number(statsId)]);
  }

  static statsIdForCharacter(characterId) {
    return STATS_ID_BY_CHARACTER[Number(characterId)] ?? null;
  }

  static echoesForCharacter(characterId) {
    return (
      EchoService.requireLoaded().echoesByCharacter.get(Number(characterId)) ??
      []
    );
  }

  static scoresForCharacter(characterId) {
    return (
      EchoService.requireLoaded().scoresByCharacter.get(Number(characterId)) ??
      []
    );
  }

  static rarityLabel(rarity, locale = 'zh') {
    const entry = EchoService.labels.rarity?.[String(rarity)];
    return entry?.[locale] ?? entry?.zh ?? String(rarity);
  }

  /** Resolve a module-relative image path to the pinned data-repo URL. */
  static imageUrl(path, format = 'png') {
    if (typeof path !== 'string' || !path) return null;
    const versionInfo = EchoService.snapshot?.versionInfo;
    const base = versionInfo?.imageBase;
    if (!base) return null;
    const relative =
      format === 'webp' ? toWebpPath(path, versionInfo?.imagesWebp) : path;
    return relative ? joinUrl(base, relative) : null;
  }

  static characterIconUrl(character, format = 'png') {
    return (
      EchoService.imageUrl(character?.icon, format) ??
      EchoService.imageUrl(character?.big_icon, format)
    );
  }

  static rarityBackgroundUrl(rarity, format = 'png') {
    const path =
      EchoService.snapshot?.data?.rarity_backgrounds?.[String(rarity)];
    return EchoService.imageUrl(path, format);
  }
}
