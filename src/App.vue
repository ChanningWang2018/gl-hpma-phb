<template>
  <div class="container">
    <Header />
    
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
</template>

<script>
import ChartWrapper from '@/components/ChartWrapper.vue';
import Controls from '@/components/Controls.vue';
import DataTable from '@/components/DataTable.vue';
import EchoSelect from '@/components/EchoSelect.vue';
import Header from '@/components/Header.vue';
import LineChart from '@/components/LineChart.vue';
import ScatterChart from '@/components/ScatterChart.vue';
import { useChartStore } from '@/stores/chartStore.js';
import { computed, onMounted } from 'vue';

export default {
  name: 'App',
  components: {
    Header,
    Controls,
    EchoSelect,
    ChartWrapper,
    DataTable,
    ScatterChart,
    LineChart
  },
  setup() {
    const chartStore = useChartStore();
    
    // 计算属性
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
    
    // 组件挂载时初始化
    onMounted(async () => {
      try {
        await chartStore.initializePeriodSelector();
        await chartStore.loadArchiveData();
        await chartStore.updateAllData();
      } catch (error) {
        console.error('初始化失败:', error);
      }
    });
    
    return {
      chartStore,
      winrateData,
      attendanceData
    };
  }
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  background: white;
  border-radius: 15px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  overflow: hidden;
}

.charts-container {
  padding: 30px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

@media (max-width: 768px) {
  .charts-container {
    grid-template-columns: 1fr;
  }
}
</style>
