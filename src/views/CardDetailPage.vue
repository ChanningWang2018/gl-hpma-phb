<template>
  <div class="card-detail-page">
    <p class="card-crumb">
      <RouterLink :to="{ name: 'cards' }">← Card codex</RouterLink>
    </p>

    <p v-if="cardStore.loading" class="card-state">Loading card…</p>
    <div v-else-if="cardStore.error" class="card-state card-error">
      <p>{{ cardStore.error }}</p>
      <PressButton @click="retry">Retry</PressButton>
    </div>
    <div v-else-if="!card" class="card-state">
      <h1 class="card-missing">Card not found</h1>
      <p><RouterLink :to="{ name: 'cards' }">Back to the codex</RouterLink></p>
    </div>

    <article v-else class="card-sheet">
      <div class="card-figure">
        <CardImage :card="card" size="detail" />
      </div>

      <div class="card-info">
        <header class="card-head">
          <p class="card-kicker">Card · No. {{ card.id }}</p>
          <h1 class="card-name">{{ cardName }}</h1>
          <p v-if="secondaryName" class="card-name-alt">{{ secondaryName }}</p>
          <p v-if="spellWord" class="card-spell-word">{{ spellWord }}</p>
        </header>

        <div class="card-badges">
          <span class="badge badge-cost">{{ card.cost ?? '—' }} cost</span>
          <span class="badge">{{ typeLabel }}</span>
          <span class="badge" :class="`rarity-${card.rarity}`">{{
            rarityLabel
          }}</span>
        </div>

        <p v-if="desc" class="card-desc">{{ desc }}</p>
        <blockquote v-if="quote" class="card-quote">{{ quote }}</blockquote>

        <p v-if="tags.length" class="card-tags">
          <span v-for="tag in tags" :key="tag" class="card-tag">{{ tag }}</span>
        </p>

        <section
          v-if="levelRows.length"
          class="card-levels"
          aria-labelledby="card-levels-title"
        >
          <header class="card-levels-head">
            <div class="card-levels-intro">
              <p class="card-kicker">Stats</p>
              <h2 id="card-levels-title">Level by level</h2>
              <p class="card-levels-note">
                {{ levelSpan }} · values as printed in the game
              </p>
            </div>

            <div class="level-jump">
              <label class="level-jump-label" for="card-level-jump">
                Jump to level
              </label>
              <select
                id="card-level-jump"
                class="level-jump-select"
                @change="jumpToLevel"
              >
                <option value="" disabled selected>Level…</option>
                <option
                  v-for="group in levelRows"
                  :key="group.lv"
                  :value="group.lv"
                >
                  Lv.{{ group.lv }}
                </option>
              </select>
            </div>
          </header>

          <div
            v-for="group in levelPreview"
            :id="`level-${group.lv}`"
            :key="group.lv"
            class="level-group"
            tabindex="-1"
          >
            <p class="level-head">Lv.{{ group.lv }}</p>
            <div
              v-for="(unit, unitIndex) in unitGroups(group.entries)"
              :key="unitIndex"
              class="level-unit-block"
            >
              <p v-if="unit.unit" class="level-unit">
                {{ statUnitLabel(unit) }}
              </p>
              <dl class="level-rows">
                <div
                  v-for="(entry, index) in unit.entries"
                  :key="`${entry.k}-${index}`"
                  class="level-row"
                >
                  <dt>{{ statLabel(entry) }}</dt>
                  <dd>{{ displayValue(entry) }}</dd>
                </div>
              </dl>
            </div>
          </div>

          <details
            v-if="levelDeep.length"
            class="level-more"
            :open="levelsOpen"
            @toggle="levelsOpen = $event.target.open"
          >
            <summary class="level-more-summary">
              <span class="level-more-title">{{ deepLevelSpan }}</span>
              <span class="level-more-action">
                <span class="level-more-open">
                  Show all {{ levelRows.length }} levels ↓
                </span>
                <span class="level-more-close">Collapse ↑</span>
              </span>
            </summary>

            <div
              v-for="group in levelDeep"
              :id="`level-${group.lv}`"
              :key="group.lv"
              class="level-group"
              tabindex="-1"
            >
              <p class="level-head">Lv.{{ group.lv }}</p>
              <div
                v-for="(unit, unitIndex) in unitGroups(group.entries)"
                :key="unitIndex"
                class="level-unit-block"
              >
                <p v-if="unit.unit" class="level-unit">
                  {{ statUnitLabel(unit) }}
                </p>
                <dl class="level-rows">
                  <div
                    v-for="(entry, index) in unit.entries"
                    :key="`${entry.k}-${index}`"
                    class="level-row"
                  >
                    <dt>{{ statLabel(entry) }}</dt>
                    <dd>{{ displayValue(entry) }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </details>
        </section>
      </div>
    </article>

    <section
      v-if="relatedEchoes.length"
      class="card-related"
      aria-labelledby="card-related-title"
    >
      <header class="card-related-head">
        <div>
          <p class="card-kicker">Synergy</p>
          <h2 id="card-related-title">Echoes that fit this card</h2>
        </div>
        <p class="card-related-note">
          Top {{ relatedEchoes.length }} deck echoes · weight from the game's
          echo score table.
        </p>
      </header>

      <ul class="related-echo-list" role="list">
        <li v-for="echo in relatedEchoes" :key="echo.id">
          <RouterLink
            class="related-echo-link"
            :to="{ name: 'echo-detail', params: { id: echo.id } }"
          >
            <span class="related-echo-name">{{ echo.name }}</span>
            <span class="related-echo-score">{{ echo.score }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
import CardImage from '@/components/CardImage.vue';
import PressButton from '@/components/ui/PressButton.vue';
import {
  echoDisplayName,
  formatEchoScore,
  rankDeckEchoesForCard,
} from '@/services/cardEchoRanking.js';
import { valueLabel } from '@/services/codexLocale.js';
import { lookupLabel } from '@/services/spellbookClient.js';
import { SpellbookService } from '@/services/spellbookService.js';
import {
  FALLBACK_OG_IMAGE,
  absoluteUrl,
  buildCardStructuredData,
  firstAbsoluteUrl,
  jsonLdScript,
} from '@/services/structuredData.js';
import { useCardStore } from '@/stores/cardStore.js';
import { useEchoStore } from '@/stores/echoStore.js';
import { computed, nextTick, onMounted, ref } from 'vue';
import { useHead } from '@vueuse/head';
import { useRoute } from 'vue-router';

const canonicalFor = (id) => absoluteUrl(`/cards/${id}`);

// Levels 1-10 stay visible; 11-30 are rendered inside <details>. Tradeoff: the
// deep rows remain in the initial HTML (search engines and the prerenderer see
// the complete stat table, and the jump control can reach any level without a
// data fetch) while a closed block keeps the page short for readers. Native
// <details> also means expand/collapse keeps working without JavaScript; only
// the jump select opens it programmatically.
const LEVEL_PREVIEW_MAX = 10;

// CardDetailPage — the standalone /cards/:id page. P0a made the canonical
// card URL a real page so it can be shared, prerendered and indexed; the grid
// links here instead of opening a Teleport dialog.
export default {
  name: 'CardDetailPage',
  components: { CardImage, PressButton },
  inheritAttrs: false,
  setup() {
    const cardStore = useCardStore();
    const echoStore = useEchoStore();
    const route = useRoute();
    const levelsOpen = ref(false);

    const card = computed(
      () =>
        cardStore.cards.find(
          (candidate) => candidate.id === Number(route.params.id),
        ) ?? null,
    );
    const locale = computed(() => cardStore.locale);

    const cardName = computed(() =>
      card.value
        ? (SpellbookService.text(card.value, locale.value, 'name') ??
          `No. ${card.value.id}`)
        : 'Card',
    );
    const secondaryName = computed(() => {
      if (!card.value) return '';
      const other = locale.value === 'zh' ? 'en' : 'zh';
      const name = SpellbookService.text(card.value, other, 'name');
      return name && name !== cardName.value ? name : '';
    });
    const spellWord = computed(() => card.value?.spell_word || '');
    const typeLabel = computed(() =>
      card.value
        ? lookupLabel(cardStore.labels, 'type', card.value.type, locale.value)
        : '',
    );
    const rarityLabel = computed(() =>
      card.value
        ? lookupLabel(
            cardStore.labels,
            'rarity',
            card.value.rarity,
            locale.value,
          )
        : '',
    );
    const desc = computed(() =>
      card.value ? SpellbookService.text(card.value, locale.value, 'desc') : '',
    );
    const quote = computed(() =>
      card.value
        ? SpellbookService.text(card.value, locale.value, 'quote')
        : '',
    );
    const tags = computed(() =>
      card.value ? SpellbookService.tags(card.value, locale.value) : [],
    );
    const levelRows = computed(() =>
      card.value ? SpellbookService.formatLevelRows(card.value) : [],
    );

    // Levels 1-10 render outside <details>, 11-30 inside it. Both lists are
    // rendered from the same source, so the full table stays in the DOM.
    const levelRangeLabel = (rows) => {
      if (!rows.length) return '';
      const first = rows[0].lv;
      const last = rows[rows.length - 1].lv;
      return first === last ? `Level ${first}` : `Levels ${first}–${last}`;
    };
    const levelPreview = computed(() =>
      levelRows.value.filter((row) => Number(row.lv) <= LEVEL_PREVIEW_MAX),
    );
    const levelDeep = computed(() =>
      levelRows.value.filter((row) => Number(row.lv) > LEVEL_PREVIEW_MAX),
    );
    const levelSpan = computed(() => levelRangeLabel(levelRows.value));
    const deepLevelSpan = computed(() => levelRangeLabel(levelDeep.value));

    // Reverse the character-first score table: only deck characters get an
    // /echoes/:id page, so the rank helper filters the rest out.
    const relatedEchoes = computed(() => {
      if (!card.value || !echoStore.snapshot) return [];
      return rankDeckEchoesForCard({
        cardId: card.value.id,
        characters: echoStore.deckCharacters,
        scoresForCharacter: (characterId) =>
          echoStore.scoresForCharacter(characterId),
      }).map(({ id, score, character }) => ({
        id,
        name: echoDisplayName(character, locale.value),
        score: formatEchoScore(score),
      }));
    });

    // schema 6: group a level's rows by the subject they belong to, keep the
    // card's own block first, preserve data order otherwise.
    const unitGroups = (entries) => {
      const groups = [];
      for (const entry of entries) {
        const last = groups[groups.length - 1];
        if (last && last.unit === entry.unit) {
          last.entries.push(entry);
          if (!last.unitEn && entry.unitEn) last.unitEn = entry.unitEn;
        } else {
          groups.push({
            unit: entry.unit,
            unitEn: entry.unitEn,
            entries: [entry],
          });
        }
      }
      return groups.sort(
        (a, b) => (a.unit === null ? 0 : 1) - (b.unit === null ? 0 : 1),
      );
    };

    const statLabel = (entry) =>
      locale.value === 'en' && entry.kEn ? entry.kEn : entry.k;
    const statUnitLabel = (group) =>
      locale.value === 'en' && group.unitEn ? group.unitEn : group.unit;
    const displayValue = (entry) => valueLabel(locale.value, entry.display);

    // OG/schema image: the release image when version.json has resolved an
    // imageBase, else the same-origin /cardimg proxy, else the local 1200×630
    // fallback. Entity art is portrait (375×500), so the fallback is the only
    // 1200×630 asset; it is still preferable to a broken absolute URL.
    const ogImage = computed(() => {
      if (!card.value) return absoluteUrl(FALLBACK_OG_IMAGE);
      let primary = null;
      try {
        primary = SpellbookService.imageUrl(card.value);
      } catch {
        // imageBase not ready — fall through to the proxy candidate.
      }
      return firstAbsoluteUrl(
        [primary, card.value.img ? `/cardimg/${card.value.img}` : null],
        FALLBACK_OG_IMAGE,
      );
    });

    useHead(
      computed(() => {
        const nameEn = card.value
          ? SpellbookService.text(card.value, 'en', 'name')
          : 'Card';
        const nameZh = card.value
          ? SpellbookService.text(card.value, 'zh', 'name')
          : '';
        const title = `${nameEn}${
          nameZh && nameZh !== nameEn ? ` ${nameZh}` : ''
        } — HPMA Card Codex`;
        const description = `${nameEn}${
          nameZh && nameZh !== nameEn ? ` (${nameZh})` : ''
        } — HPMA card stats, level values, rarity and tags.`;
        const canonical = canonicalFor(card.value?.id ?? route.params.id);
        const image = ogImage.value;
        // Titles/descriptions/schema stay en-anchored (zh only as a suffix or
        // fallback), so the prerendered HTML does not change with the headless
        // browser's language preference.
        return {
          title,
          meta: [
            { name: 'description', content: description },
            { property: 'og:type', content: 'article' },
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:url', content: canonical },
            { property: 'og:image', content: image },
            { property: 'og:image:alt', content: nameEn },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: title },
            { name: 'twitter:description', content: description },
            { name: 'twitter:image', content: image },
            { name: 'twitter:image:alt', content: nameEn },
          ],
          link: [{ rel: 'canonical', href: canonical }],
          script: card.value
            ? [
                jsonLdScript(
                  buildCardStructuredData({
                    name: nameEn,
                    alternateName: nameZh !== nameEn ? nameZh : '',
                    description: SpellbookService.text(
                      card.value,
                      'en',
                      'desc',
                    ),
                    image,
                    url: canonical,
                  }),
                ),
              ]
            : [],
        };
      }),
    );

    const retry = async () => {
      cardStore.error = null;
      try {
        await cardStore.loadCards();
      } catch (error) {
        console.error('Card detail retry failed:', error);
      }
    };

    // Jump select: deep levels live in a closed <details>, so open it before
    // scrolling. Focus the target too, so keyboard users land on the stats.
    const jumpToLevel = async (event) => {
      const select = event.target;
      const level = String(select.value ?? '');
      select.value = '';
      if (!level) return;
      if (Number(level) > LEVEL_PREVIEW_MAX) levelsOpen.value = true;
      await nextTick();
      const target = document.getElementById(`level-${level}`);
      if (!target) return;
      target.focus({ preventScroll: true });
      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      target.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    };

    onMounted(async () => {
      const tasks = [];
      if (!cardStore.cards.length) {
        tasks.push(
          cardStore.loadCards().catch((error) => {
            console.error('Card detail load failed:', error);
          }),
        );
      }
      // Related echoes need the 2026-10 echoes module; load it here instead of
      // on the card grid so /cards stays two files lighter.
      if (!echoStore.snapshot) {
        tasks.push(
          echoStore.loadEchoes().catch((error) => {
            console.error('Card detail echo load failed:', error);
          }),
        );
      }
      await Promise.all(tasks);
    });

    return {
      card,
      cardName,
      cardStore,
      deepLevelSpan,
      desc,
      displayValue,
      jumpToLevel,
      levelDeep,
      levelPreview,
      levelRows,
      levelSpan,
      levelsOpen,
      quote,
      rarityLabel,
      relatedEchoes,
      retry,
      secondaryName,
      spellWord,
      statLabel,
      statUnitLabel,
      tags,
      typeLabel,
      unitGroups,
    };
  },
};
</script>

<style scoped>
.card-detail-page {
  max-width: 1120px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-6) var(--space-7);
}

.card-crumb {
  margin-bottom: var(--space-4);
  font-family: var(--font-type);
  font-size: var(--type-caption);
}

.card-crumb a {
  color: var(--ink-faded);
  text-decoration: none;
}

.card-crumb a:hover {
  color: var(--ink);
}

.card-state {
  margin: var(--space-5) 0;
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--ink-faded);
}

.card-error {
  color: var(--oxblood);
}

.card-missing {
  font-family: var(--font-serif);
  font-weight: 400;
}

.card-sheet {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
  padding-top: var(--space-2);
}

.card-figure {
  position: sticky;
  top: 84px;
}

.card-info {
  min-width: 0;
}

.card-kicker {
  font-family: var(--font-type);
  font-size: 8.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--oxblood);
}

.card-name {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-size: clamp(32px, 4vw, 46px);
  font-weight: 400;
  line-height: 1.05;
}

.card-name-alt {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 17px;
  color: var(--ink-faded);
}

.card-spell-word {
  margin-top: 8px;
  font-family: var(--font-type);
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border: 1px solid var(--rule);
  font-family: var(--font-type);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.badge-cost {
  border-color: var(--ink);
  color: var(--ink);
}

.card-desc {
  margin-top: var(--space-4);
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink);
  white-space: pre-line;
}

.card-quote {
  margin-top: var(--space-3);
  padding-left: var(--space-3);
  border-left: 2px solid var(--gold-leaf);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--ink-faded);
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: var(--space-3);
}

.card-tag {
  padding: 2px 6px;
  border: 1px solid var(--rule);
  font-family: var(--font-type);
  font-size: 8px;
  letter-spacing: 0.06em;
  color: var(--ink-faded);
}

.card-levels {
  margin-top: var(--space-5);
  padding-top: var(--space-3);
  border-top: 1px solid var(--ink);
}

.card-levels-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.card-levels-intro {
  min-width: 0;
}

.card-levels-head h2 {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 400;
}

.card-levels-note {
  margin-top: 3px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--ink-faded);
}

.level-jump {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.level-jump-label {
  font-family: var(--font-type);
  font-size: 8.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faded);
  white-space: nowrap;
}

.level-jump-select {
  max-width: 100%;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--rule);
  border-radius: 0;
  background: var(--paper-light);
  color: var(--ink);
  font-family: var(--font-type);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.level-jump-select:hover {
  border-color: var(--ink-faded);
}

.level-jump-select:focus-visible {
  outline: 2px solid var(--gold-ink);
  outline-offset: 2px;
}

.level-group {
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--rule);
  scroll-margin-top: 84px;
}

.level-group:focus {
  outline: none;
}

.level-group:focus-visible {
  outline: 1px dashed var(--gold-ink);
  outline-offset: 4px;
}

.level-head {
  font-family: var(--font-serif);
  font-size: 18px;
  color: var(--oxblood);
}

.level-unit {
  margin-top: 6px;
  font-family: var(--font-type);
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.level-rows {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0 var(--space-3);
  margin-top: 4px;
}

.level-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 4px 0;
  border-bottom: 1px dotted var(--rule);
}

.level-row dt {
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: var(--font-sans);
  font-size: 11.5px;
  color: var(--ink-faded);
}

.level-row dd {
  flex: none;
  overflow-wrap: anywhere;
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--ink);
  text-align: right;
}

/* Native <details> keeps levels 11-30 in the DOM while collapsing their
   visual weight; the summary is the expand/collapse affordance. */
.level-more {
  margin-top: var(--space-3);
  border-top: 1px solid var(--rule);
}

.level-more-summary {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  list-style: none;
  cursor: pointer;
}

.level-more-summary::-webkit-details-marker {
  display: none;
}

.level-more-summary::before {
  content: '+';
  flex: none;
  width: 16px;
  font-family: var(--font-type);
  font-size: 14px;
  line-height: 1;
  color: var(--oxblood);
}

.level-more[open] .level-more-summary::before {
  content: '−';
}

.level-more-summary:focus-visible {
  outline: 1px dashed var(--gold-ink);
  outline-offset: 2px;
}

.level-more-title {
  font-family: var(--font-serif);
  font-size: 18px;
  line-height: 1.2;
  color: var(--ink);
}

.level-more-summary:hover .level-more-title {
  color: var(--oxblood);
}

.level-more-action {
  margin-left: auto;
  font-family: var(--font-type);
  font-size: 8.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-faded);
  text-align: right;
}

.level-more-open {
  display: inline;
}

.level-more-close {
  display: none;
}

.level-more[open] .level-more-open {
  display: none;
}

.level-more[open] .level-more-close {
  display: inline;
}

.card-related {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--ink);
}

.card-related-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.card-related-head h2 {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-size: clamp(23px, 2.6vw, 30px);
  font-weight: 400;
  line-height: 1.1;
}

.card-related-note {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12.5px;
  color: var(--ink-faded);
}

.related-echo-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0 var(--space-4);
  margin-top: var(--space-3);
  list-style: none;
  border-top: 1px solid var(--ink);
}

.related-echo-link {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
  padding: 10px 6px;
  border-bottom: 1px solid var(--rule);
  color: var(--ink);
  text-decoration: none;
}

.related-echo-link:hover {
  background: rgba(var(--gold-rgb), 0.08);
}

.related-echo-link:focus-visible {
  outline: 2px solid var(--gold-ink);
  outline-offset: -2px;
}

.related-echo-name {
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: var(--font-serif);
  font-size: 16px;
}

.related-echo-score {
  flex: none;
  font-family: var(--font-type);
  font-size: 9px;
  color: var(--ink-faded);
}

@media (max-width: 900px) {
  .card-sheet {
    grid-template-columns: minmax(0, 1fr);
  }

  /* No sticky card art on narrow screens: it would steal the viewport while
     the reader jumps between level rows. */
  .card-figure {
    position: static;
    max-width: 300px;
  }
}

@media (max-width: 768px) {
  .card-detail-page {
    padding: var(--space-3) var(--space-3) var(--space-5);
  }

  .level-jump {
    width: 100%;
    justify-content: space-between;
  }

  .level-jump-select {
    flex: 1 1 auto;
  }

  /* One readable column for stats instead of the desktop auto-fill grid. */
  .level-rows {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 480px) {
  .card-related-head {
    align-items: flex-start;
  }

  .related-echo-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
