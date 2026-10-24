<template>
  <div class="echo-index-page">
    <PageHead>
      <h1 class="page-title">Echoes <span class="page-title-zh">回响</span></h1>
      <template #note>
        {{ deckCount }} player echoes · 4 rarities each · weekly win / pick
      </template>
    </PageHead>

    <div class="echo-toolbar">
      <SegmentControl
        :options="modeOptions"
        :model-value="mode"
        aria-label="Bracket"
        @update:model-value="mode = $event"
      />
      <p class="echo-note">
        {{ latestPeriod || 'Loading the latest week…' }}
      </p>
    </div>

    <p v-if="echoStore.loading || chartStore.loading" class="echo-state">
      Loading echoes…
    </p>
    <div v-else-if="echoStore.error" class="echo-state echo-error">
      <p>{{ echoStore.error }}</p>
      <PressButton @click="retry">Retry</PressButton>
    </div>
    <p v-else-if="!rows.length" class="echo-state">
      No echo data is available yet.
    </p>

    <ul v-else class="echo-grid" role="list">
      <li v-for="row in rows" :key="row.id" class="echo-item">
        <RouterLink
          class="echo-card"
          :to="{ name: 'echo-detail', params: { id: row.id } }"
        >
          <EchoImage
            class="echo-figure"
            size="tile"
            :path="row.iconPath"
            :stats-id="row.statsId"
            :alt="row.name"
            :initial="row.initial"
          />

          <span class="echo-body">
            <span class="echo-heading">
              <span class="echo-name">{{ row.name }}</span>
              <span v-if="row.altName" class="echo-name-alt">
                {{ row.altName }}
              </span>
            </span>

            <span v-if="row.tags.length" class="echo-tags">
              <span v-for="tag in row.tags" :key="tag" class="echo-tag">
                {{ tag }}
              </span>
            </span>

            <span class="echo-stats">
              <span
                ><b>{{ row.win }}</b> win</span
              >
              <span
                ><b>{{ row.pick }}</b> pick</span
              >
              <span class="echo-stats-mode">{{ formatModeLabel(mode) }}</span>
            </span>
          </span>

          <span class="echo-arrow" aria-hidden="true">→</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<script>
import EchoImage from '@/components/EchoImage.vue';
import PageHead from '@/components/ui/PageHead.vue';
import PressButton from '@/components/ui/PressButton.vue';
import SegmentControl from '@/components/ui/SegmentControl.vue';
import { DataService } from '@/services/dataService.js';
import { EchoService } from '@/services/echoService.js';
import { HOME_MODES, formatModeLabel } from '@/services/homeStats.js';
import { useChartStore } from '@/stores/chartStore.js';
import { useEchoStore } from '@/stores/echoStore.js';
import { useLocaleStore } from '@/stores/localeStore.js';
import {
  FALLBACK_OG_IMAGE,
  absoluteUrl,
  buildCollectionPageStructuredData,
  jsonLdScript,
} from '@/services/structuredData.js';
import { computed, onMounted, ref } from 'vue';
import { useHead } from '@vueuse/head';

const DESCRIPTION =
  'All 19 player echoes in Harry Potter: Magic Awakened — win rate, pick rate, rarity variants and card synergies.';

const oneDecimal = (value) =>
  value === null || value === undefined || value === ''
    ? '—'
    : Number.isFinite(Number(value))
      ? Number(value).toFixed(1)
      : '—';

// EchoIndex — the 19 player-visible echoes from the 2026-10 echoes module.
// Home and /analytics keep their local 24px thumbnails; this page is the
// full-size entry point and the parent of /echoes/:id.
export default {
  name: 'EchoIndex',
  components: { EchoImage, PageHead, PressButton, SegmentControl },
  setup() {
    const echoStore = useEchoStore();
    const chartStore = useChartStore();
    const localeStore = useLocaleStore();
    const mode = ref('2v2-high');

    const locale = computed(() => localeStore.locale);
    const latestPeriod = computed(
      () => chartStore.periods[chartStore.periods.length - 1] ?? null,
    );
    const deckCount = computed(() => echoStore.deckCharacters.length || 19);
    const modeOptions = HOME_MODES.map((key) => ({
      value: key,
      label: formatModeLabel(key),
    }));

    const statsById = computed(() => {
      if (!chartStore.trends || !latestPeriod.value) return new Map();
      const rows = DataService.extractScatterData(
        chartStore.trends,
        latestPeriod.value,
        mode.value,
      );
      return new Map(rows.map((row) => [row.reverberationid, row]));
    });

    const text = (character, field, lang = locale.value) =>
      character?.i18n?.[lang]?.[field] ??
      character?.i18n?.en?.[field] ??
      character?.i18n?.zh?.[field] ??
      '';

    const canonical = absoluteUrl('/echoes');
    const image = absoluteUrl(FALLBACK_OG_IMAGE);
    // ItemList names/schema stay en-anchored (zh fallback inside text()), so the
    // prerendered graph does not depend on the headless browser's language.
    const plainName = (character) =>
      String(text(character, 'name', 'en') || `Echo ${character.id}`).replace(
        /<[^>]+>/g,
        '',
      );

    useHead(
      computed(() => ({
        title: 'HPMA Echoes — Every Player Echo, Ranked',
        meta: [
          { name: 'description', content: DESCRIPTION },
          { property: 'og:type', content: 'website' },
          {
            property: 'og:title',
            content: 'HPMA Echoes — Every Player Echo, Ranked',
          },
          { property: 'og:description', content: DESCRIPTION },
          { property: 'og:url', content: canonical },
          { property: 'og:image', content: image },
          { property: 'og:image:alt', content: 'HPMA Echoes' },
          { name: 'twitter:card', content: 'summary_large_image' },
          {
            name: 'twitter:title',
            content: 'HPMA Echoes — Every Player Echo, Ranked',
          },
          { name: 'twitter:description', content: DESCRIPTION },
          { name: 'twitter:image', content: image },
        ],
        link: [{ rel: 'canonical', href: canonical }],
        script: [
          jsonLdScript(
            buildCollectionPageStructuredData({
              name: 'HPMA Echoes',
              description: DESCRIPTION,
              url: canonical,
              itemListName: 'Player echoes',
              items: echoStore.deckCharacters.map((character) => ({
                name: plainName(character),
                url: `/echoes/${character.id}`,
              })),
            }),
          ),
        ],
      })),
    );

    const rows = computed(() => {
      return echoStore.deckCharacters.map((character) => {
        const statsId = EchoService.statsIdForCharacter(character.id);
        const stats = statsId ? statsById.value.get(statsId) : null;
        const other = locale.value === 'zh' ? 'en' : 'zh';
        const altName = text(character, 'name', other);
        return {
          id: character.id,
          statsId,
          name: text(character, 'name'),
          altName: altName !== text(character, 'name') ? altName : '',
          initial: (text(character, 'name') || '?').slice(0, 1),
          iconPath: EchoService.characterIconPath(character),
          tags: Array.isArray(character.i18n?.[locale.value]?.tags)
            ? character.i18n[locale.value].tags
            : [],
          win: oneDecimal(stats?.winrate),
          pick: oneDecimal(stats?.attendancerate),
        };
      });
    });

    const retry = async () => {
      echoStore.error = null;
      try {
        await Promise.all([echoStore.loadEchoes(), chartStore.updateAllData()]);
      } catch (error) {
        console.error('Echo page retry failed:', error);
      }
    };

    onMounted(async () => {
      try {
        await Promise.all([echoStore.loadEchoes(), chartStore.updateAllData()]);
      } catch (error) {
        console.error('Echo page load failed:', error);
      }
    });

    return {
      chartStore,
      deckCount,
      echoStore,
      formatModeLabel,
      latestPeriod,
      mode,
      modeOptions,
      retry,
      rows,
    };
  },
};
</script>

<style scoped>
.echo-index-page {
  padding: var(--space-5) var(--space-6) var(--space-7);
  max-width: 1280px;
  margin: 0 auto;
}

.echo-toolbar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.echo-note {
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--ink-faded);
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

.echo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0;
  list-style: none;
  border-top: 1px solid var(--ink);
}

.echo-item {
  border-bottom: 1px solid var(--rule);
}

.echo-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-2);
  color: var(--ink);
  text-decoration: none;
  transition: background-color 0.22s;
}

.echo-card:hover {
  background: rgba(var(--gold-rgb), 0.08);
}

.echo-card:focus-visible {
  outline: 2px solid var(--gold-ink);
  outline-offset: 2px;
}

.echo-figure {
  border: 1px solid var(--rule);
  border-radius: 4px;
}

.echo-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.echo-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.echo-name {
  font-family: var(--font-serif);
  font-size: 21px;
  line-height: 1.15;
}

.echo-name-alt {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--ink-faded);
}

.echo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.echo-tag {
  padding: 1px 5px;
  border: 1px solid var(--rule);
  font-family: var(--font-type);
  font-size: 8px;
  letter-spacing: 0.06em;
  color: var(--ink-faded);
}

.echo-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--ink-faded);
}

.echo-stats b {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 14px;
  color: var(--ink);
}

.echo-stats-mode {
  font-family: var(--font-type);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.echo-arrow {
  flex: none;
  color: var(--oxblood);
  font-size: 16px;
}

@media (max-width: 768px) {
  .echo-index-page {
    padding: var(--space-3) var(--space-3) var(--space-5);
  }

  .echo-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .echo-card {
    transition: none;
  }
}
</style>
