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

  /**
   * Module-relative image path inside the release (`images/…png` /
   * `images_webp/…webp`), independent of the host. Returns null when the
   * release has no WebP copy set or the path is not a PNG.
   */
  static imageRelativePath(path, format = 'png') {
    if (typeof path !== 'string' || !path) return null;
    if (format === 'webp') {
      return toWebpPath(path, EchoService.snapshot?.versionInfo?.imagesWebp);
    }
    return path;
  }

  /** Resolve a module-relative image path to the pinned data-repo URL (L1). */
  static imageUrl(path, format = 'png') {
    const base = EchoService.snapshot?.versionInfo?.imageBase;
    if (!base) return null;
    const relative = EchoService.imageRelativePath(path, format);
    return relative ? joinUrl(base, relative) : null;
  }

  /**
   * L2 同源代理（netlify.toml `/echoimg/*` -> 锁定 tag 的 raw 图源）。
   * 只在客户端直连 GitHub 失败时使用；路径与 L1 的发布包内相对路径一致。
   */
  static proxyImageUrl(path, format = 'png') {
    const relative = EchoService.imageRelativePath(path, format);
    return relative ? joinUrl('/echoimg/', relative) : null;
  }

  /** L3 本站 19 名 deck 角色头像；statsId 与 crawler 的 1..19 编号一致。 */
  static localAvatarUrl(statsId) {
    const id = Number(statsId);
    if (!Number.isInteger(id) || id < 1 || id > 19) return null;
    return `/images/avatars/echo${String(id).padStart(2, '0')}.webp`;
  }

  /**
   * 单张回响图的降级候选（顺序即重试顺序）：
   * L1 WebP -> L1 PNG -> L2 /echoimg -> L3 本地头像 -> 空（组件显示首字占位）。
   *
   * 所有 URL 都从 `version.json` 的 `imageBase` / `imagesWebp` 推导，组件不
   * 硬编码图源域名；`fallbackPath` 只用于 icon -> big_icon 这类同层备用路径。
   * 重复 URL 会去重（例如 imageBase 日后切到 `/echoimg/` 时 L1 即 L2）。
   */
  static imageCandidates(path, { fallbackPath = null, statsId = null } = {}) {
    const candidates = [];
    const seen = new Set();
    const push = (url) => {
      if (url && !seen.has(url)) {
        seen.add(url);
        candidates.push(url);
      }
    };
    const paths = [path, fallbackPath].filter(
      (value) => typeof value === 'string' && value,
    );
    for (const value of paths) {
      push(EchoService.imageUrl(value, 'webp'));
      push(EchoService.imageUrl(value, 'png'));
    }
    for (const value of paths) {
      push(EchoService.proxyImageUrl(value));
    }
    push(EchoService.localAvatarUrl(statsId));
    return candidates;
  }

  static characterIconPath(character) {
    return character?.icon ?? character?.big_icon ?? null;
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
