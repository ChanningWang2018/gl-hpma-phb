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
            <p class="card-kicker">Stats</p>
            <h2 id="card-levels-title">Level by level</h2>
            <p class="card-levels-note">
              Levels 1–30 · values as printed in the game
            </p>
          </header>

          <div v-for="group in levelRows" :key="group.lv" class="level-group">
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
        </section>
      </div>
    </article>
  </div>
</template>

<script>
import CardImage from '@/components/CardImage.vue';
import PressButton from '@/components/ui/PressButton.vue';
import { valueLabel } from '@/services/codexLocale.js';
import { lookupLabel } from '@/services/spellbookClient.js';
import { SpellbookService } from '@/services/spellbookService.js';
import { useCardStore } from '@/stores/cardStore.js';
import { computed, onMounted } from 'vue';
import { useHead } from '@vueuse/head';
import { useRoute } from 'vue-router';

const canonicalFor = (id) => `https://hpma-phb.netlify.app/cards/${id}`;

// CardDetailPage — the standalone /cards/:id page. The grid used to open
// CardDetail as a Teleport dialog; P0a makes the canonical card URL a real
// page so it can be shared, prerendered and indexed. The dialog remains in
// the component tree only for a future quick-view enhancement.
export default {
  name: 'CardDetailPage',
  components: { CardImage, PressButton },
  inheritAttrs: false,
  setup() {
    const cardStore = useCardStore();
    const route = useRoute();

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
        const canonical = canonicalFor(card.value?.id ?? route.params.id);
        return {
          title,
          meta: [
            {
              name: 'description',
              content: `${nameEn}${
                nameZh && nameZh !== nameEn ? ` (${nameZh})` : ''
              } — HPMA card stats, level values, rarity and tags.`,
            },
            { property: 'og:title', content: title },
            { property: 'og:url', content: canonical },
          ],
          link: [{ rel: 'canonical', href: canonical }],
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

    onMounted(async () => {
      if (cardStore.cards.length) return;
      try {
        await cardStore.loadCards();
      } catch (error) {
        console.error('Card detail load failed:', error);
      }
    });

    return {
      card,
      cardName,
      cardStore,
      desc,
      displayValue,
      levelRows,
      quote,
      rarityLabel,
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

.level-group {
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--rule);
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
  font-family: var(--font-sans);
  font-size: 11.5px;
  color: var(--ink-faded);
}

.level-row dd {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--ink);
  text-align: right;
}

@media (max-width: 900px) {
  .card-sheet {
    grid-template-columns: minmax(0, 1fr);
  }

  .card-figure {
    position: static;
    max-width: 300px;
  }
}

@media (max-width: 768px) {
  .card-detail-page {
    padding: var(--space-3) var(--space-3) var(--space-5);
  }
}
</style>
