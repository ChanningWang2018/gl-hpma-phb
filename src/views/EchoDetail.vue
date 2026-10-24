<template>
  <div class="echo-detail-page">
    <p class="echo-crumb">
      <RouterLink :to="{ name: 'echoes' }">← All echoes</RouterLink>
    </p>

    <p v-if="echoStore.loading || chartStore.loading" class="echo-state">
      Loading echo…
    </p>
    <div v-else-if="echoStore.error" class="echo-state echo-error">
      <p>{{ echoStore.error }}</p>
      <PressButton @click="retry">Retry</PressButton>
    </div>
    <div v-else-if="!character" class="echo-state">
      <h1 class="echo-missing">Echo not found</h1>
      <p>
        <RouterLink :to="{ name: 'echoes' }">Back to the echo index</RouterLink>
      </p>
    </div>

    <template v-else>
      <header class="echo-hero">
        <div class="echo-portrait">
          <img
            v-if="icon"
            :src="icon"
            :alt="displayName"
            width="168"
            height="168"
            decoding="async"
          />
          <span v-else class="echo-portrait-fallback">{{
            displayName.slice(0, 1)
          }}</span>
        </div>

        <div class="echo-intro">
          <p class="echo-kicker">
            Echo · {{ statsId ? 'tracked' : 'catalogue' }}
          </p>
          <h1 class="echo-title">{{ displayName }}</h1>
          <p v-if="altName" class="echo-alt-name">{{ altName }}</p>

          <p v-if="tags.length" class="echo-tags">
            <span v-for="tag in tags" :key="tag" class="echo-tag">{{
              tag
            }}</span>
          </p>

          <p v-if="intro" class="echo-copy">{{ intro }}</p>
          <p v-if="tips" class="echo-tips">{{ tips }}</p>

          <dl v-if="statsId" class="echo-numbers">
            <div>
              <dt>Win rate</dt>
              <dd>{{ latest.win }}</dd>
            </div>
            <div>
              <dt>Pick rate</dt>
              <dd>{{ latest.pick }}</dd>
            </div>
            <div>
              <dt>Δ week</dt>
              <dd :class="deltaClass">{{ latest.delta }}</dd>
            </div>
            <div>
              <dt>Bracket</dt>
              <dd class="echo-numbers-mode">{{ formatModeLabel(mode) }}</dd>
            </div>
          </dl>
          <p v-else class="echo-note">
            This character is not part of the weekly tracked ladder.
          </p>
        </div>
      </header>

      <section
        v-if="statsId"
        class="echo-section"
        aria-labelledby="echo-trend-title"
      >
        <div class="echo-section-head">
          <div>
            <p class="echo-kicker">History</p>
            <h2 id="echo-trend-title">Week by week</h2>
          </div>
          <SegmentControl
            :options="modeOptions"
            :model-value="mode"
            aria-label="Bracket"
            @update:model-value="mode = $event"
          />
        </div>

        <div class="echo-trend">
          <svg
            v-if="sparkline.path"
            class="echo-spark"
            :viewBox="`0 0 ${sparkline.w} ${sparkline.h}`"
            role="img"
            :aria-label="`Win rate trend for ${displayName}`"
          >
            <polyline
              class="echo-spark-line"
              :points="sparkline.path"
              fill="none"
            />
            <circle
              v-if="sparkline.last"
              class="echo-spark-dot"
              :cx="sparkline.last.x"
              :cy="sparkline.last.y"
              r="3.5"
            />
          </svg>
          <p v-else class="echo-note">No win-rate history in this bracket.</p>

          <table class="echo-table">
            <caption class="echo-sr-only">
              Recent win and pick rates
            </caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Win</th>
                <th scope="col">Pick</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in recentTrend" :key="row.period">
                <td>{{ row.period }}</td>
                <td>{{ row.win }}</td>
                <td>{{ row.pick }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="echo-section" aria-labelledby="echo-variants-title">
        <div class="echo-section-head">
          <div>
            <p class="echo-kicker">Rarity</p>
            <h2 id="echo-variants-title">Four versions of the same echo</h2>
          </div>
          <SegmentControl
            v-if="variants.length"
            :options="rarityOptions"
            :model-value="selectedRarity"
            aria-label="Rarity"
            role="group"
            @update:model-value="selectedRarity = $event"
          />
        </div>

        <article v-if="selectedVariant" class="echo-variant">
          <header class="echo-variant-head">
            <h3>{{ rarityLabel(selectedVariant.rarity) }}</h3>
            <p v-if="selectedVariant.i18n?.[locale]?.skill">
              {{ selectedVariant.i18n[locale].skill }}
            </p>
          </header>

          <p v-if="selectedVariant.i18n?.[locale]?.desc" class="echo-copy">
            {{ stripRich(selectedVariant.i18n[locale].desc) }}
          </p>

          <div
            v-for="(detail, index) in selectedDetails"
            :key="`${detail.title}-${index}`"
            class="echo-detail-block"
          >
            <h4 v-if="detail.title">{{ stripRich(detail.title) }}</h4>
            <p
              v-for="(item, itemIndex) in detail.items"
              :key="itemIndex"
              class="echo-copy"
            >
              {{ stripRich(item) }}
            </p>
          </div>

          <dl class="echo-variant-attrs">
            <div>
              <dt>Attack</dt>
              <dd>+{{ selectedVariant.attrs?.[0]?.attack_add ?? 0 }}</dd>
            </div>
            <div>
              <dt>HP</dt>
              <dd>+{{ selectedVariant.attrs?.[0]?.hp_add ?? 0 }}</dd>
            </div>
            <div v-if="selectedVariant.derived">
              <dt>Card levels</dt>
              <dd>
                +{{ selectedVariant.derived.level_offset }}–{{
                  selectedVariant.derived.level_max
                }}
              </dd>
            </div>
          </dl>
        </article>
        <p v-else class="echo-note">No rarity variants in this data release.</p>
      </section>

      <section
        v-if="relatedCards.length"
        class="echo-section"
        aria-labelledby="echo-cards-title"
      >
        <div class="echo-section-head">
          <div>
            <p class="echo-kicker">Synergy</p>
            <h2 id="echo-cards-title">Cards that fit this echo</h2>
          </div>
          <p class="echo-note">Weight from the game's echo score table.</p>
        </div>

        <ul class="echo-card-list" role="list">
          <li v-for="card in relatedCards" :key="card.cardId">
            <RouterLink
              class="echo-card-link"
              :to="{ name: 'card-detail', params: { id: card.cardId } }"
            >
              <span class="echo-card-name">{{
                card.nameZh || `Card ${card.cardId}`
              }}</span>
              <span class="echo-card-score">{{ formatScore(card.score) }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script>
import PressButton from '@/components/ui/PressButton.vue';
import SegmentControl from '@/components/ui/SegmentControl.vue';
import { DataService } from '@/services/dataService.js';
import { EchoService } from '@/services/echoService.js';
import { HOME_MODES, formatModeLabel } from '@/services/homeStats.js';
import { useChartStore } from '@/stores/chartStore.js';
import { useEchoStore } from '@/stores/echoStore.js';
import { useLocaleStore } from '@/stores/localeStore.js';
import { computed, onMounted, ref, watch } from 'vue';
import { useHead } from '@vueuse/head';

const stripRich = (value) =>
  String(value ?? '')
    .replace(/<color=[^>]*>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/<[^>]+>/g, '');

const oneDecimal = (value) =>
  value === null || value === undefined || value === ''
    ? '—'
    : Number.isFinite(Number(value))
      ? Number(value).toFixed(1)
      : '—';

const signed = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (number === 0) return '0.0';
  return `${number > 0 ? '+' : '−'}${Math.abs(number).toFixed(1)}`;
};

const formatScore = (value) =>
  Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '—';

// EchoDetail — one character page for the 2026-10 echoes module. Weekly stats
// still come from trends.json (the crawler's 1..19 ids map onto character ids
// via EchoService.STATS_ECHO_IDS); skill text, rarity variants and card scores
// come from echoes.json.
export default {
  name: 'EchoDetail',
  components: { PressButton, SegmentControl },
  inheritAttrs: false,
  props: {
    id: { type: [String, Number], required: true },
  },
  setup(props) {
    const echoStore = useEchoStore();
    const chartStore = useChartStore();
    const localeStore = useLocaleStore();
    const mode = ref('2v2-high');
    const selectedRarity = ref(null);

    const locale = computed(() => localeStore.locale);
    const character = computed(() => {
      if (!echoStore.snapshot) return null;
      const raw = Number(props.id);
      if (!Number.isFinite(raw)) return null;
      return raw < 100
        ? echoStore.characterByStatsId(raw)
        : echoStore.characterById(raw);
    });
    const statsId = computed(() =>
      character.value
        ? EchoService.statsIdForCharacter(character.value.id)
        : null,
    );
    const variants = computed(() =>
      character.value
        ? [...echoStore.echoesForCharacter(character.value.id)].sort(
            (a, b) => a.rarity - b.rarity,
          )
        : [],
    );
    const rarityOptions = computed(() =>
      variants.value.map((variant) => ({
        value: variant.rarity,
        label: EchoService.rarityLabel(variant.rarity, locale.value),
      })),
    );
    const selectedVariant = computed(
      () =>
        variants.value.find(
          (variant) => variant.rarity === selectedRarity.value,
        ) ?? null,
    );
    const selectedDetails = computed(() => {
      const language = locale.value === 'zh' ? 'zh' : 'en';
      const details = selectedVariant.value?.i18n?.[language]?.details;
      return Array.isArray(details) ? details : [];
    });

    const modeOptions = HOME_MODES.map((key) => ({
      value: key,
      label: formatModeLabel(key),
    }));

    const text = (field, lang = locale.value) =>
      character.value?.i18n?.[lang]?.[field] ??
      character.value?.i18n?.en?.[field] ??
      character.value?.i18n?.zh?.[field] ??
      '';

    const displayName = computed(() => stripRich(text('name')));
    const altName = computed(() => {
      const other = locale.value === 'zh' ? 'en' : 'zh';
      const value = stripRich(text('name', other));
      return value && value !== displayName.value ? value : '';
    });
    const intro = computed(() => stripRich(text('intro')));
    const tips = computed(() => stripRich(text('tips')));
    const tags = computed(() => {
      const list = character.value?.i18n?.[locale.value]?.tags;
      return Array.isArray(list) ? list : [];
    });

    const icon = computed(() => {
      if (!character.value) return null;
      return (
        EchoService.characterIconUrl(character.value, 'webp') ||
        EchoService.characterIconUrl(character.value, 'png')
      );
    });

    const trend = computed(() => {
      if (!statsId.value || !chartStore.trends) return [];
      return DataService.extractData(
        chartStore.trends,
        statsId.value,
        mode.value,
      ).map((row) => ({
        period: row.period,
        win: row.winrate,
        pick: row.attendancerate,
      }));
    });

    const recentTrend = computed(() =>
      trend.value
        .filter((row) => row.win !== null && row.pick !== null)
        .slice(-10)
        .reverse()
        .map((row) => ({
          period: row.period,
          win: oneDecimal(row.win),
          pick: oneDecimal(row.pick),
        })),
    );

    const latest = computed(() => {
      const usable = trend.value.filter((row) => row.win !== null);
      const current = usable[usable.length - 1];
      const previous = usable[usable.length - 2];
      const delta =
        current && previous && Number.isFinite(Number(current.win))
          ? Number(current.win) - Number(previous.win)
          : null;
      return {
        win: current ? `${oneDecimal(current.win)}%` : '—',
        pick: current ? `${oneDecimal(current.pick)}%` : '—',
        delta: signed(delta),
      };
    });
    const deltaClass = computed(() => {
      const number = Number.parseFloat(latest.value.delta.replace('−', '-'));
      if (!Number.isFinite(number) || number === 0) return '';
      return number > 0 ? 'is-up' : 'is-down';
    });

    const sparkline = computed(() => {
      const points = trend.value.filter((row) =>
        Number.isFinite(Number(row.win)),
      );
      if (points.length < 2) return { path: '', last: null, w: 560, h: 140 };
      const w = 560;
      const h = 140;
      const pad = 8;
      const values = points.map((row) => Number(row.win));
      const min = Math.min(...values) - 1;
      const max = Math.max(...values) + 1;
      const span = max - min || 1;
      const coords = values.map((value, index) => ({
        x: pad + (index / (values.length - 1)) * (w - pad * 2),
        y: h - pad - ((value - min) / span) * (h - pad * 2),
      }));
      return {
        path: coords.map((point) => `${point.x},${point.y}`).join(' '),
        last: coords[coords.length - 1],
        w,
        h,
      };
    });

    const relatedCards = computed(() =>
      character.value
        ? echoStore.scoresForCharacter(character.value.id).slice(0, 8)
        : [],
    );

    const rarityLabel = (rarity) =>
      EchoService.rarityLabel(rarity, locale.value);

    useHead(
      computed(() => {
        const nameEn = stripRich(text('name', 'en')) || 'Echo';
        const nameZh = stripRich(text('name', 'zh'));
        const title = `${nameEn}${
          nameZh && nameZh !== nameEn ? ` ${nameZh}` : ''
        } — HPMA Echo`;
        const canonical = character.value
          ? `https://hpma-phb.netlify.app/echoes/${character.value.id}`
          : 'https://hpma-phb.netlify.app/echoes';
        return {
          title,
          meta: [
            {
              name: 'description',
              content: `${nameEn}${
                nameZh && nameZh !== nameEn ? ` (${nameZh})` : ''
              } — HPMA echo stats, rarity variants, skill details and card synergies.`,
            },
            { property: 'og:title', content: title },
            { property: 'og:url', content: canonical },
          ],
          link: [{ rel: 'canonical', href: canonical }],
        };
      }),
    );

    watch(
      variants,
      (list) => {
        if (!list.length) {
          selectedRarity.value = null;
          return;
        }
        if (!list.some((variant) => variant.rarity === selectedRarity.value)) {
          selectedRarity.value = list[0].rarity;
        }
      },
      { immediate: true },
    );

    const retry = async () => {
      echoStore.error = null;
      try {
        await Promise.all([echoStore.loadEchoes(), chartStore.updateAllData()]);
      } catch (error) {
        console.error('Echo detail retry failed:', error);
      }
    };

    onMounted(async () => {
      try {
        await Promise.all([echoStore.loadEchoes(), chartStore.updateAllData()]);
      } catch (error) {
        console.error('Echo detail load failed:', error);
      }
    });

    return {
      chartStore,
      deltaClass,
      displayName,
      altName,
      echoStore,
      formatModeLabel,
      formatScore,
      icon,
      intro,
      latest,
      locale,
      mode,
      modeOptions,
      rarityLabel,
      rarityOptions,
      recentTrend,
      relatedCards,
      retry,
      selectedDetails,
      selectedRarity,
      selectedVariant,
      variants,
      sparkline,
      statsId,
      stripRich,
      tags,
      tips,
      character,
    };
  },
};
</script>

<style scoped>
.echo-detail-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-6) var(--space-7);
}

.echo-crumb {
  margin-bottom: var(--space-4);
  font-family: var(--font-type);
  font-size: var(--type-caption);
}

.echo-crumb a {
  color: var(--ink-faded);
  text-decoration: none;
}

.echo-crumb a:hover {
  color: var(--ink);
}

.echo-state {
  margin: var(--space-5) 0;
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--ink-faded);
}

.echo-error {
  color: var(--oxblood);
}

.echo-missing {
  font-family: var(--font-serif);
  font-weight: 400;
}

.echo-hero {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--ink);
}

.echo-portrait {
  width: 168px;
  height: 168px;
  display: grid;
  place-items: center;
  background: var(--paper-deep);
  border: 1px solid var(--rule);
  border-radius: 4px;
  overflow: hidden;
}

.echo-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.echo-portrait-fallback {
  font-family: var(--font-serif);
  font-size: 64px;
  color: var(--ink-faded);
}

.echo-kicker {
  font-family: var(--font-type);
  font-size: 8.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--oxblood);
}

.echo-title {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-size: clamp(32px, 4vw, 46px);
  font-weight: 400;
  line-height: 1.05;
}

.echo-alt-name {
  margin-top: 4px;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-faded);
}

.echo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
}

.echo-tag {
  padding: 2px 6px;
  border: 1px solid var(--rule);
  font-family: var(--font-type);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.echo-copy {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.55;
  color: var(--ink);
  white-space: pre-line;
}

.echo-tips {
  margin-top: 8px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ink-faded);
}

.echo-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  margin-top: 18px;
}

.echo-numbers div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.echo-numbers dt {
  font-family: var(--font-type);
  font-size: 8px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.echo-numbers dd {
  font-family: var(--font-serif);
  font-size: 25px;
  line-height: 1;
}

.echo-numbers dd.is-up {
  color: var(--teal-ink);
}

.echo-numbers dd.is-down {
  color: var(--oxblood);
}

.echo-numbers-mode {
  font-family: var(--font-sans) !important;
  font-size: 12px !important;
  color: var(--ink-faded);
}

.echo-note {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12.5px;
  color: var(--ink-faded);
}

.echo-section {
  padding-top: var(--space-5);
}

.echo-section-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.echo-section-head h2 {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-size: clamp(23px, 2.6vw, 30px);
  font-weight: 400;
  line-height: 1.1;
}

.echo-trend {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.6fr);
  gap: var(--space-4);
  align-items: start;
}

.echo-spark {
  width: 100%;
  height: auto;
  background: var(--paper-deep);
  border: 1px solid var(--rule);
}

.echo-spark-line {
  stroke: var(--teal-ink);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.echo-spark-dot {
  fill: var(--gold-ink);
}

.echo-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-sans);
  font-size: 11.5px;
}

.echo-table th {
  padding: 5px 4px;
  border-bottom: 1px solid var(--ink);
  font-family: var(--font-type);
  font-size: 8px;
  letter-spacing: 0.1em;
  text-align: left;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.echo-table td {
  padding: 5px 4px;
  border-bottom: 1px solid var(--rule);
  color: var(--ink);
}

.echo-table td:not(:first-child) {
  font-family: var(--font-serif);
  font-size: 14px;
}

.echo-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.echo-variant {
  padding: var(--space-3) 0;
  border-top: 1px solid var(--rule);
}

.echo-variant-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.echo-variant-head h3 {
  font-family: var(--font-serif);
  font-size: 23px;
  font-weight: 400;
}

.echo-variant-head p {
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--ink-faded);
}

.echo-detail-block {
  margin-top: var(--space-3);
}

.echo-detail-block h4 {
  font-family: var(--font-type);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--oxblood);
}

.echo-detail-block .echo-copy {
  margin-top: 4px;
}

.echo-variant-attrs {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--rule);
}

.echo-variant-attrs div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.echo-variant-attrs dt {
  font-family: var(--font-type);
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.echo-variant-attrs dd {
  font-family: var(--font-serif);
  font-size: 18px;
}

.echo-card-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0;
  list-style: none;
  border-top: 1px solid var(--ink);
}

.echo-card-link {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 9px 6px;
  border-bottom: 1px solid var(--rule);
  color: var(--ink);
  text-decoration: none;
}

.echo-card-link:hover {
  background: rgba(var(--gold-rgb), 0.08);
}

.echo-card-name {
  font-family: var(--font-serif);
  font-size: 15px;
}

.echo-card-score {
  font-family: var(--font-type);
  font-size: 9px;
  color: var(--ink-faded);
}

@media (max-width: 768px) {
  .echo-detail-page {
    padding: var(--space-3) var(--space-3) var(--space-5);
  }

  .echo-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .echo-trend {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
