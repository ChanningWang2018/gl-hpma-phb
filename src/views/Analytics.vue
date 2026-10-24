<template>
  <div>
    <div class="analytics-head">
      <PageHead>
        <h1 class="page-title">
          Echo analytics <span class="page-title-zh">回响数据</span>
        </h1>
        <template #note>
          Weekly standings · 4 brackets · {{ chartStore.periods.length || '—' }}
          archived issues ·
          <RouterLink class="echoes-link" to="/echoes"
            >All 19 echoes →</RouterLink
          >
        </template>
      </PageHead>
    </div>

    <div v-if="chartStore.loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>Setting type&hellip;</p>
    </div>

    <div v-else-if="chartStore.error" class="error-message">
      <p>{{ chartStore.error }}</p>
      <button class="retry-button" @click="retryLoading">Retry</button>
    </div>

    <div v-else>
      <div class="charts-container">
        <ChartWrapper
          title="Echo Distribution (Pick Rate vs Win Rate)"
          container-class="scatter-chart-container"
        >
          <ScatterChart :chart-data="chartStore.scatterChartData" />
        </ChartWrapper>
      </div>

      <EchoStandings
        :rows="chartStore.scatterChartData"
        :prev-rows="prevRows"
        :mode="chartStore.currentMode"
      />

      <Controls
        :current-mode="chartStore.currentMode"
        :current-period="chartStore.currentPeriod"
        :periods="chartStore.periods"
        @update:current-period="chartStore.setCurrentPeriod"
        @set-mode="chartStore.setCurrentMode"
      />

      <EchoSelect
        :current-reverberation="chartStore.currentReverberation"
        @update:current-reverberation="chartStore.setCurrentReverberation"
      />

      <div class="charts-container">
        <ChartWrapper title="Win Rate Trend">
          <LineChart
            :chart-data="winrateData"
            label="Win Rate (%)"
            :color="theme.colors.tealInk"
          />
        </ChartWrapper>

        <ChartWrapper title="Pick Rate Trend">
          <LineChart
            :chart-data="attendanceData"
            label="Pick Rate (%)"
            :color="theme.colors.oxblood"
          />
        </ChartWrapper>
      </div>

      <DataTable
        :table-data="chartStore.tableData"
        :current-mode="chartStore.currentMode"
        :mode-mapping="chartStore.modeMapping"
      />
    </div>
  </div>
</template>

<script>
import ChartWrapper from '@/components/ChartWrapper.vue';
import Controls from '@/components/Controls.vue';
import DataTable from '@/components/DataTable.vue';
import EchoSelect from '@/components/EchoSelect.vue';
import EchoStandings from '@/components/EchoStandings.vue';
import LineChart from '@/components/LineChart.vue';
import ScatterChart from '@/components/ScatterChart.vue';
import { useChartStore } from '@/stores/chartStore.js';
import { DataService } from '@/services/dataService.js';
import { findPeriodBySlug, periodSlug } from '@/services/homeStats.js';
import { ThemeTokens } from '@/services/themeTokens.js';
import { computed, onMounted, watch } from 'vue';
import { useHead } from '@vueuse/head';
import { useRoute, useRouter } from 'vue-router';
import PageHead from '@/components/ui/PageHead.vue';

export default {
  name: 'Analytics',
  components: {
    ChartWrapper,
    Controls,
    DataTable,
    EchoSelect,
    EchoStandings,
    LineChart,
    PageHead,
    ScatterChart,
  },
  setup() {
    useHead({
      title: 'HPMA Echo Analytics - Win Rate & Pick Rate Statistics',
      meta: [
        {
          name: 'description',
          content:
            'Track Harry Potter: Magic Awakened character performance. Win rates, pick rates, and trends for all 19 Echoes across 1v1 and 2v2 modes.',
        },
        {
          property: 'og:title',
          content: 'HPMA Echo Analytics - Character Performance Data',
        },
        {
          property: 'og:description',
          content:
            'Comprehensive win rate and pick rate statistics for all Echoes in Harry Potter: Magic Awakened.',
        },
        {
          property: 'og:url',
          content: 'https://hpma-phb.netlify.app/analytics',
        },
      ],
      link: [
        {
          rel: 'canonical',
          href: 'https://hpma-phb.netlify.app/analytics',
        },
      ],
    });

    const chartStore = useChartStore();
    const theme = ThemeTokens.tokens;

    const winrateData = computed(() => {
      return chartStore.tableData
        .map((item) => ({
          period: item.period,
          value: item.winrate,
        }))
        .filter((item) => item.value !== null);
    });

    const attendanceData = computed(() => {
      return chartStore.tableData
        .map((item) => ({
          period: item.period,
          value: item.attendancerate,
        }))
        .filter((item) => item.value !== null);
    });

    // Previous period's echo rows — the standings' Δ week column
    const prevPeriod = computed(() => {
      const idx = chartStore.periods.indexOf(chartStore.currentPeriod);
      return idx > 0 ? chartStore.periods[idx - 1] : null;
    });

    const prevRows = computed(() => {
      if (!chartStore.trends || !prevPeriod.value) return null;
      return DataService.extractScatterData(
        chartStore.trends,
        prevPeriod.value,
        chartStore.currentMode,
      );
    });

    const route = useRoute();
    const router = useRouter();
    let syncingQuery = false;
    // Wait until the first applyQuery() has read the incoming URL before the
    // store watchers are allowed to write defaults back into it.
    let queryReady = false;

    const sameQuery = (a, b) =>
      Object.keys(a).length === Object.keys(b).length &&
      Object.entries(a).every(([key, value]) => b[key] === value);

    // ?period=YYYY-MM-DD&mode=2v2-high&echo=1 -> store. Invalid values fall
    // back to the store's current/default state.
    const applyQuery = () => {
      if (route.name !== 'analytics') return;
      if (syncingQuery || !chartStore.periods.length) return;
      const query = route.query;
      const period = findPeriodBySlug(chartStore.periods, query.period);
      if (period && period !== chartStore.currentPeriod) {
        chartStore.setCurrentPeriod(period);
      }
      const mode = typeof query.mode === 'string' ? query.mode : null;
      if (
        mode &&
        Object.prototype.hasOwnProperty.call(DataService.modeMapping, mode) &&
        mode !== chartStore.currentMode
      ) {
        chartStore.setCurrentMode(mode);
      }
      const echo = Number(query.echo);
      if (
        Number.isInteger(echo) &&
        echo >= 1 &&
        echo <= 19 &&
        echo !== chartStore.currentReverberation
      ) {
        chartStore.setCurrentReverberation(echo);
      }
    };

    // store -> URL (replace: filters should not spam browser history).
    const syncQuery = () => {
      if (route.name !== 'analytics') return;
      if (!queryReady || syncingQuery || !chartStore.currentPeriod) return;
      const query = {
        period: periodSlug(chartStore.currentPeriod),
        mode: chartStore.currentMode,
        echo: String(chartStore.currentReverberation),
      };
      if (!query.period) delete query.period;
      if (sameQuery(query, route.query)) return;
      syncingQuery = true;
      router
        .replace({ name: 'analytics', query })
        .catch(() => {})
        .finally(() => {
          syncingQuery = false;
        });
    };

    watch(
      () => [
        chartStore.currentPeriod,
        chartStore.currentMode,
        chartStore.currentReverberation,
      ],
      syncQuery,
    );
    watch(() => route.query, applyQuery, { deep: true });

    onMounted(async () => {
      try {
        await chartStore.updateAllData();
        applyQuery();
        queryReady = true;
        syncQuery();
        preloadAvatarImages();
      } catch (error) {
        console.error('初始化失败:', error);
      }
    });

    const preloadAvatarImages = () => {
      for (let i = 1; i <= 19; i++) {
        const idStr = i.toString().padStart(2, '0');

        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = `/images/avatars/echo${idStr}.webp`;
        link.type = 'image/webp';
        document.head.appendChild(link);
      }
    };

    return {
      chartStore,
      theme,
      winrateData,
      attendanceData,
      prevRows,
      retryLoading: async () => {
        chartStore.error = null;
        try {
          await chartStore.updateAllData();
        } catch (error) {
          console.error('重试失败:', error);
        }
      },
    };
  },
};
</script>

<style>
.analytics-head {
  padding: 24px 30px 0;
}

.echoes-link {
  color: var(--oxblood);
  text-decoration: none;
  border-bottom: 1px solid var(--gold-leaf);
}

.echoes-link:hover {
  color: var(--ink);
}

@media (max-width: 768px) {
  .analytics-head {
    padding: 18px 15px 0;
  }
}

@media (max-width: 480px) {
  .analytics-head {
    padding: 14px 12px 0;
  }
}

.charts-container {
  padding: 30px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

@media (max-width: 768px) {
  .charts-container {
    padding: 15px;
    gap: 20px;
  }
}

@media (max-width: 480px) {
  .charts-container {
    padding: 12px;
    gap: 15px;
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--paper-light-rgb), 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  width: 46px;
  height: 46px;
  border: 3px solid rgba(var(--ink-rgb), 0.15);
  border-top: 3px solid var(--oxblood);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 18px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-overlay p {
  font-family: var(--font-type);
  font-size: 15px;
  color: var(--ink-faded);
  letter-spacing: 0.1em;
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  padding: 40px;
}

.error-message p {
  font-family: var(--font-serif);
  font-size: 19px;
  color: var(--oxblood);
  margin-bottom: 20px;
}

.retry-button {
  padding: 10px 26px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--oxblood);
  border: 1px solid rgba(var(--accent-rgb), 0.5);
  border-radius: 2px;
  font-family: var(--font-type);
  font-size: 15px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 0.25s;
}

.retry-button:hover {
  background: rgba(var(--accent-rgb), 0.2);
}
</style>
