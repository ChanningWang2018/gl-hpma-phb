<template>
  <div class="home" lang="en">
    <div class="band">
      <div class="shell">
        <Masthead :period-label="periodLabel" />
      </div>
    </div>

    <section class="band lead" aria-labelledby="lead-title">
      <div class="shell">
        <header class="section-head">
          <p class="kicker">The lead</p>
          <div class="section-head-row">
            <h2 id="lead-title">This week in echoes</h2>
            <p class="standfirst">
              Every echo, plotted by how often it is picked and how often it
              wins. Choose a bracket to redraw the plate.
            </p>
          </div>
        </header>

        <div class="lead-grid">
          <WeekPlate
            :rows-by-mode="rowsByMode"
            :edition="edition"
            :period-label="periodLabel"
            :mode="mode"
            @update:mode="mode = $event"
          />

          <aside class="lead-aside" aria-label="This week's figures">
            <MoversRail :rows="currentRows" :mode-label="currentModeLabel" />
            <ArchiveLedger
              :edition="edition"
              :echo-count="currentRows.length"
              :bracket-count="bracketCount"
            />
          </aside>
        </div>

        <p v-if="chartStore.error" class="load-error" role="alert">
          <span>This week's plate didn't load.</span>
          <button type="button" class="load-error-retry" @click="retry">
            Retry
          </button>
        </p>
      </div>
    </section>

    <section class="band contents" aria-labelledby="contents-title">
      <div class="shell">
        <header class="section-head">
          <p class="kicker">Contents</p>
          <div class="section-head-row">
            <h2 id="contents-title">Five ways in</h2>
            <p class="standfirst">
              Start with the data; the rest is reference.
            </p>
          </div>
        </header>

        <ToolGrid :edition="edition" />
        <UpdatesStrip :period-label="periodLabel" />
      </div>
    </section>
  </div>
</template>

<script>
import ArchiveLedger from '@/components/home/ArchiveLedger.vue';
import Masthead from '@/components/home/Masthead.vue';
import MoversRail from '@/components/home/MoversRail.vue';
import ToolGrid from '@/components/home/ToolGrid.vue';
import UpdatesStrip from '@/components/home/UpdatesStrip.vue';
import WeekPlate from '@/components/home/WeekPlate.vue';
import { DataService } from '@/services/dataService.js';
import {
  DEFAULT_HOME_MODE,
  HOME_MODES,
  formatModeLabel,
  formatPeriodRange,
  mergeRows,
} from '@/services/homeStats.js';
import { useChartStore } from '@/stores/chartStore.js';
import {
  FALLBACK_OG_IMAGE,
  absoluteUrl,
  buildWebSiteStructuredData,
  jsonLdScript,
} from '@/services/structuredData.js';
import { computed, onMounted, ref } from 'vue';
import { useHead } from '@vueuse/head';

const SITE_NAME = 'my little hpma bits';
const TITLE = 'my little hpma bits — HPMA weekly data, cards & quiz';
const DESCRIPTION =
  'An unofficial almanac for Harry Potter: Magic Awakened — weekly echo statistics, a 141-card codex, a sales solver and 1,847 quiz questions.';

// Home — the paper's front page. Masthead, one data plate with a paper column
// beside it, then the contents table. Everything is printed on paper; the only
// dark surface is the plate itself, which reads as the issue's photograph. The
// page shell (SiteHeader / main / SiteFooter) lives in App.
//
// Data comes from the shared chart store: one updateAllData() call, no
// cards.json / quiz.json, no Chart.js. The bracket selection is owned here so
// the plate and the movers column always describe the same bracket.
export default {
  name: 'Home',
  components: {
    ArchiveLedger,
    Masthead,
    MoversRail,
    ToolGrid,
    UpdatesStrip,
    WeekPlate,
  },
  setup() {
    const canonical = absoluteUrl('/');
    const image = absoluteUrl(FALLBACK_OG_IMAGE);
    useHead({
      title: TITLE,
      meta: [
        { name: 'description', content: DESCRIPTION },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: TITLE },
        { property: 'og:description', content: DESCRIPTION },
        { property: 'og:url', content: canonical },
        { property: 'og:image', content: image },
        { property: 'og:image:alt', content: SITE_NAME },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: TITLE },
        { name: 'twitter:description', content: DESCRIPTION },
        { name: 'twitter:image', content: image },
      ],
      link: [{ rel: 'canonical', href: canonical }],
      script: [
        jsonLdScript(
          buildWebSiteStructuredData({
            name: SITE_NAME,
            description: DESCRIPTION,
            url: canonical,
          }),
        ),
      ],
    });

    const chartStore = useChartStore();

    // The front page is always the newest issue. Unlike /analytics, it must not
    // follow the archive period picker: picking an old week there and clicking
    // the brand should still land on this week's cover.
    const currentPeriod = computed(() => {
      const periods = chartStore.periods || [];
      return periods.length ? periods[periods.length - 1] : null;
    });

    // 周数 = 归档期数；加载中显示 —（不渲染 No. 0）
    const edition = computed(() => (chartStore.periods || []).length || null);
    const periodLabel = computed(() => formatPeriodRange(currentPeriod.value));

    // 四档模式共用同一份 trends：本期 rows 与上一期 rows 合并出 dWin/dPick。
    // 上一期不存在时 deltas 全 0（第一期即为这种情况）。
    const rowsByMode = computed(() => {
      const modes = {};
      for (const key of HOME_MODES) modes[key] = [];

      const trends = chartStore.trends;
      const period = currentPeriod.value;
      if (!trends || !period) return modes;

      const periods = trends.periods || [];
      const index = periods.indexOf(period);
      if (index === -1) return modes;

      const previousPeriod = index > 0 ? periods[index - 1] : null;
      for (const key of HOME_MODES) {
        const currentRows = DataService.extractScatterData(trends, period, key);
        const previousRows = previousPeriod
          ? DataService.extractScatterData(trends, previousPeriod, key)
          : null;
        modes[key] = mergeRows(currentRows, previousRows);
      }
      return modes;
    });

    // Owned here rather than inside the plate: the movers column follows it.
    const mode = ref(DEFAULT_HOME_MODE);
    const currentRows = computed(() => rowsByMode.value[mode.value] || []);
    const currentModeLabel = computed(() => formatModeLabel(mode.value));
    const bracketCount = computed(
      () =>
        HOME_MODES.filter((key) => (rowsByMode.value[key] || []).length > 0)
          .length,
    );

    const retry = async () => {
      chartStore.error = null;
      try {
        await chartStore.updateAllData();
      } catch (error) {
        console.error('Front page retry failed:', error);
      }
    };

    onMounted(async () => {
      try {
        // 共享请求：trends 已在 store 里时 updateAllData 只重算，不重新 fetch
        await chartStore.updateAllData();
        // 加载成功就清掉别的页面留下的旧错误，避免首页误报
        chartStore.error = null;
      } catch (error) {
        console.error('Front page data load failed:', error);
      }
    });

    return {
      bracketCount,
      chartStore,
      currentModeLabel,
      currentRows,
      edition,
      mode,
      periodLabel,
      retry,
      rowsByMode,
    };
  },
};
</script>

<style scoped>
.home {
  --home-gutter: clamp(15px, 4.4vw, 56px);
  position: relative;
}

.band {
  padding: 0 var(--home-gutter);
}

.shell {
  max-width: 1320px;
  margin: 0 auto;
}

/* ---------- Section heads ---------- */
.section-head {
  padding-bottom: clamp(16px, 1.8vw, 22px);
}

.kicker {
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--oxblood);
}

.section-head-row {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  align-items: end;
  gap: clamp(14px, 3vw, 48px);
  margin-top: 7px;
}

.section-head h2 {
  font-family: var(--font-serif);
  font-size: clamp(30px, 3vw, 40px);
  font-weight: 400;
  line-height: 1.02;
  color: var(--ink);
  text-wrap: balance;
}

.standfirst {
  justify-self: end;
  max-width: 46ch;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14.5px;
  line-height: 1.5;
  color: var(--ink-faded);
  text-wrap: pretty;
}

/* ---------- The lead spread ---------- */
.lead {
  padding-top: clamp(38px, 4.6vw, 58px);
}

.lead-grid {
  display: grid;
  grid-template-columns: minmax(0, 8fr) minmax(0, 4fr);
  align-items: start;
  gap: clamp(22px, 2.4vw, 36px);
}

.lead-aside {
  display: flex;
  flex-direction: column;
  gap: clamp(24px, 2.4vw, 32px);
  min-width: 0;
}

/* ---------- Contents ---------- */
.contents {
  padding-top: clamp(60px, 7.2vw, 92px);
}

.load-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  color: var(--oxblood);
}

.load-error-retry {
  appearance: none;
  padding: 5px 11px;
  border: 1px solid var(--ink);
  background: transparent;
  font-family: var(--font-type);
  font-size: 8.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink);
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.load-error-retry:hover {
  background: var(--ink);
  color: var(--paper-light);
}

.load-error-retry:focus-visible {
  outline: 2px solid var(--gold-ink);
  outline-offset: 2px;
}

@media (max-width: 1100px) {
  .lead-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: clamp(26px, 3vw, 36px);
  }

  .lead-aside {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(24px, 3vw, 36px);
  }
}

@media (max-width: 768px) {
  .section-head-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .standfirst {
    justify-self: start;
    max-width: none;
    font-size: 14px;
  }

  .lead-aside {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .load-error-retry {
    transition: none;
  }
}
</style>
