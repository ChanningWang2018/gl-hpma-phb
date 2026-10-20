<template>
  <div class="home" lang="en">
    <section class="cover" aria-labelledby="cover-title">
      <div class="cover-inner">
        <CoverHero :edition="edition" :period-label="periodLabel" />

        <WeekPlate
          :rows-by-mode="rowsByMode"
          :edition="edition"
          :period-label="periodLabel"
        />

        <p v-if="chartStore.error" class="cover-error" role="alert">
          <span>This week's plate didn't load.</span>
          <button type="button" class="cover-error-retry" @click="retry">
            Retry
          </button>
        </p>
      </div>
    </section>

    <section class="sections" aria-labelledby="sections-title">
      <div class="sections-head">
        <p class="kicker">Contents</p>
        <h2 id="sections-title">Five ways in</h2>
      </div>

      <ToolGrid :edition="edition" />
    </section>

    <UpdatesStrip :edition="edition" :period-label="periodLabel" />
  </div>
</template>

<script>
import CoverHero from '@/components/home/CoverHero.vue';
import ToolGrid from '@/components/home/ToolGrid.vue';
import UpdatesStrip from '@/components/home/UpdatesStrip.vue';
import WeekPlate from '@/components/home/WeekPlate.vue';
import { DataService } from '@/services/dataService.js';
import { mergeRows } from '@/services/homeStats.js';
import { useChartStore } from '@/stores/chartStore.js';
import { computed, onMounted } from 'vue';
import { useHead } from '@vueuse/head';

// 首页四档固定顺序（与 DataService.modeMapping 的键一致）
const HOME_MODES = ['1v1-high', '1v1-low', '2v2-high', '2v2-low'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const parsePeriodDate = (value) => {
  const [year, month, day] = String(value).trim().split('/').map(Number);
  return { year, month, day };
};

/**
 * 归档的期号区间 -> 封面/版画上的日期标签。
 * '2026/09/24 - 2026/09/30' -> '24–30 Sep 2026'
 * '2026/09/28 - 2026/10/04' -> '28 Sep – 04 Oct 2026'
 * 解析不出来时原样返回，绝不在渲染期抛错。
 */
const formatPeriodRange = (period) => {
  if (!period) return '';
  const [start, end] = String(period).split(/\s+-\s+/);
  if (!start || !end) return String(period);

  const from = parsePeriodDate(start);
  const to = parsePeriodDate(end);
  const valid = [from, to].every(
    (date) =>
      Number.isFinite(date.year) &&
      Number.isFinite(date.month) &&
      Number.isFinite(date.day) &&
      date.year > 0 &&
      date.month >= 1 &&
      date.month <= 12 &&
      date.day >= 1,
  );
  if (!valid) return String(period);

  if (from.year === to.year && from.month === to.month) {
    return `${from.day}–${to.day} ${MONTHS[to.month - 1]} ${to.year}`;
  }
  return `${from.day} ${MONTHS[from.month - 1]} – ${to.day} ${MONTHS[to.month - 1]} ${to.year}`;
};

// Home — 封面 + 目录。上半部是深墨封面（CoverHero + WeekPlate），下半部
// 是纸色目录（ToolGrid + UpdatesStrip）。页面外壳（SiteHeader / main /
// SiteFooter）由 App 负责，这里不再渲染 header/footer/main，根节点只是
// 一个 div。数据全部来自共享的 chartStore（一次 updateAllData，Analytics
// 已加载时不会再发请求），首页不加载 cards.json / quiz.json，也不使用
// Chart.js。
export default {
  name: 'Home',
  components: { CoverHero, WeekPlate, ToolGrid, UpdatesStrip },
  setup() {
    useHead({
      title: 'my little hpma bits — HPMA weekly data, cards & quiz',
      meta: [
        {
          name: 'description',
          content:
            'An unofficial almanac for Harry Potter: Magic Awakened — weekly echo statistics, a 141-card codex, a sales solver and 1,847 quiz questions.',
        },
        {
          property: 'og:title',
          content: 'my little hpma bits — HPMA weekly data, cards & quiz',
        },
        {
          property: 'og:description',
          content:
            'An unofficial almanac for Harry Potter: Magic Awakened — weekly echo statistics, a 141-card codex, a sales solver and 1,847 quiz questions.',
        },
        { property: 'og:url', content: 'https://hpma-phb.netlify.app/' },
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

    // 期号 = 归档期数；加载中显示 —（不渲染 Issue No. 0）
    const edition = computed(() => (chartStore.periods || []).length || null);
    const periodLabel = computed(() => formatPeriodRange(currentPeriod.value));

    // 四档模式共用同一份 trends：本期 rows 与上一期 rows 合并出 dWin/dPick。
    // 上一期不存在时 deltas 全 0（第一期即为这种情况）。
    const rowsByMode = computed(() => {
      const modes = {};
      for (const mode of HOME_MODES) modes[mode] = [];

      const trends = chartStore.trends;
      const period = currentPeriod.value;
      if (!trends || !period) return modes;

      const periods = trends.periods || [];
      const index = periods.indexOf(period);
      if (index === -1) return modes;

      const previousPeriod = index > 0 ? periods[index - 1] : null;
      for (const mode of HOME_MODES) {
        const currentRows = DataService.extractScatterData(
          trends,
          period,
          mode,
        );
        const previousRows = previousPeriod
          ? DataService.extractScatterData(trends, previousPeriod, mode)
          : null;
        modes[mode] = mergeRows(currentRows, previousRows);
      }
      return modes;
    });

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

    return { chartStore, edition, periodLabel, rowsByMode, retry };
  },
};
</script>

<style scoped>
.home {
  /* 与 SiteHeader / SiteFooter 同一档通栏留白；子组件（UpdatesStrip 等）
     通过继承拿到同一个值，封面文字才能和页头页脚左右对齐 */
  --home-gutter: clamp(15px, 4.4vw, 56px);
  position: relative;
}

/* ---------- 封面 ---------- */
.cover {
  position: relative;
  z-index: 2;
  overflow: hidden;
  background: var(--cover);
  color: var(--cream);
  border-bottom: 1px solid var(--gold-line);
  box-shadow: 0 26px 56px rgba(var(--ink-rgb), 0.22);
}

.cover::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 62% 46% at 50% -4%,
      rgba(var(--gold-rgb), 0.13),
      transparent 62%
    ),
    radial-gradient(
      ellipse 46% 40% at 50% 108%,
      rgba(var(--accent-rgb), 0.16),
      transparent 70%
    );
}

.cover-inner {
  position: relative;
  padding: clamp(44px, 5.2vw, 66px) var(--home-gutter) clamp(28px, 3.4vw, 44px);
}

.cover-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
  font-family: var(--font-type);
  font-size: 9px;
  line-height: 1.5;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--cream-muted);
}

.cover-error-retry {
  appearance: none;
  padding: 5px 10px;
  border: 1px solid var(--gold-line);
  background: transparent;
  font: inherit;
  letter-spacing: 0.14em;
  text-transform: inherit;
  color: var(--gold);
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;
}

.cover-error-retry:hover {
  border-color: var(--gold);
  color: var(--cream);
}

.cover-error-retry:focus-visible {
  outline: 2px solid var(--cream);
  outline-offset: 2px;
}

/* ---------- 目录 ---------- */
.sections {
  padding: clamp(56px, 6vw, 82px) var(--home-gutter) 0;
}

.sections-head {
  padding-bottom: 22px;
}

.kicker {
  margin-bottom: 8px;
  font-family: var(--font-type);
  font-size: 9px;
  line-height: 1.5;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--oxblood);
}

.sections-head h2 {
  font-family: var(--font-serif);
  font-size: clamp(27px, 2.7vw, 36px);
  font-weight: 400;
  line-height: 1.05;
  color: var(--ink);
  text-wrap: balance;
}

@media (max-width: 768px) {
  .cover-inner {
    padding-top: 38px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cover-error-retry {
    transition: none;
  }
}
</style>
