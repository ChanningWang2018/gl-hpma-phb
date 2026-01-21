<template>
  <div>
    <div v-if="chartStore.loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>Loading data...</p>
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
            color="rgb(17, 153, 142)"
          />
        </ChartWrapper>
        
        <ChartWrapper title="Pick Rate Trend">
          <LineChart 
            :chart-data="attendanceData"
            label="Pick Rate (%)"
            color="rgb(238, 9, 121)"
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
import { computed, onMounted } from 'vue';

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
    const chartStore = useChartStore();
    
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
        await chartStore.initializePeriodSelector();
        await chartStore.loadArchiveData();
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
      winrateData,
      attendanceData,
      retryLoading: async () => {
        chartStore.error = null;
        try {
          await chartStore.initializePeriodSelector();
          await chartStore.loadArchiveData();
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
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  border-radius: 15px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-overlay p {
  font-size: 16px;
  color: #495057;
  font-weight: 600;
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
  font-size: 18px;
  color: #dc3545;
  margin-bottom: 20px;
  font-weight: 600;
}

.retry-button {
  padding: 12px 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.retry-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}
</style>
