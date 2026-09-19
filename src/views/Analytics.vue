<template>
  <div>
    <div v-if="chartStore.loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>Setting type&hellip;</p>
    </div>

    <div v-else-if="chartStore.error" class="error-message">
      <p>{{ chartStore.error }}</p>
      <button @click="retryLoading" class="retry-button">Retry</button>
    </div>

    <div v-else>
      <div class="charts-container">
        <ChartWrapper title="Echo Distribution (Pick Rate vs Win Rate)" container-class="scatter-chart-container">
          <ScatterChart 
            :chart-data="chartStore.scatterChartData"
          />
        </ChartWrapper>
      </div>

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
import LineChart from '@/components/LineChart.vue';
import ScatterChart from '@/components/ScatterChart.vue';
import { useChartStore } from '@/stores/chartStore.js';
import { ThemeTokens } from '@/services/themeTokens.js';
import { computed, onMounted } from 'vue';
import { useHead } from '@vueuse/head';

export default {
  name: 'Analytics',
  components: {
    ChartWrapper,
    Controls,
    DataTable,
    EchoSelect,
    LineChart,
    ScatterChart
  },
  setup() {
    useHead({
      title: 'HPMA Echo Analytics - Win Rate & Pick Rate Statistics',
      meta: [
        { name: 'description', content: 'Track Harry Potter: Magic Awakened character performance. Win rates, pick rates, and trends for all 18 Echoes across 1v1 and 2v2 modes.' },
        { property: 'og:title', content: 'HPMA Echo Analytics - Character Performance Data' },
        { property: 'og:description', content: 'Comprehensive win rate and pick rate statistics for all Echoes in Harry Potter: Magic Awakened.' },
        { property: 'og:url', content: 'https://hpma-phb.netlify.app/' }
      ]
    });

    const chartStore = useChartStore();
    const theme = ThemeTokens.tokens;
    
    const winrateData = computed(() => {
      return chartStore.tableData
        .map(item => ({
          period: item.period,
          value: item.winrate
        }))
        .filter(item => item.value !== null);
    });
    
    const attendanceData = computed(() => {
      return chartStore.tableData
        .map(item => ({
          period: item.period,
          value: item.attendancerate
        }))
        .filter(item => item.value !== null);
    });
    
    onMounted(async () => {
      try {
        await chartStore.updateAllData();
        preloadAvatarImages();
      } catch (error) {
        console.error('初始化失败:', error);
      }
    });

    const preloadAvatarImages = () => {
      for (let i = 1; i <= 18; i++) {
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
      retryLoading: async () => {
        chartStore.error = null;
        try {
          await chartStore.updateAllData();
        } catch (error) {
          console.error("重试失败:", error);
        }
      }
    };
  }
};
</script>

<style>
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
  background: rgba(247, 240, 225, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  width: 46px;
  height: 46px;
  border: 3px solid rgba(42, 33, 24, 0.15);
  border-top: 3px solid var(--oxblood);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 18px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
