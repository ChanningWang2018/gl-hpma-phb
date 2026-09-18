import { DataService } from "@/services/dataService.js";
import { defineStore } from "pinia";

export const useChartStore = defineStore("chart", {
  state: () => ({
    // 响应式数据
    currentReverberation: 1,
    currentMode: "2v2-high",
    currentPeriod: null,
    periods: [],
    trends: null,
    scatterChartData: [],

    // 图表实例
    scatterChart: null,
    winrateChart: null,
    attendanceChart: null,

    // 头像缓存
    avatarCache: {},

    // 加载状态
    loading: false,
    error: null,
  }),

  getters: {
    modeMapping: () => DataService.modeMapping,

    // 表格数据计算属性
    tableData: (state) => {
      return DataService.extractData(
        state.trends,
        state.currentReverberation,
        state.currentMode
      );
    },

    reverberationName: (state) => (id) => {
      return DataService.getReverberationName(id);
    },
  },

  actions: {
    // 设置当前模式
    setCurrentMode(mode) {
      this.currentMode = mode;
      // 更新散点图数据
      this.updateScatterData();
    },

    // 更新当前回响
    setCurrentReverberation(reverberationId) {
      this.currentReverberation = reverberationId;
      // 注意：这里不需要更新散点图数据，因为散点图只依赖于时期和模式
    },

    // 更新当前时期
    setCurrentPeriod(period) {
      this.currentPeriod = period;
      // 更新散点图数据
      this.updateScatterData();
    },

    // 加载聚合趋势数据并初始化时期选择
    async loadTrendsData() {
      this.loading = true;
      try {
        this.trends = await DataService.loadTrendsData();
        this.periods = this.trends.periods;

        // 设置默认选中最新时期
        if (this.periods.length > 0 && !this.periods.includes(this.currentPeriod)) {
          this.currentPeriod = this.periods[this.periods.length - 1];
        }
      } catch (error) {
        this.error = "Failed to load trends data";
        console.error("Error loading trends data:", error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // 更新散点图数据
    updateScatterData() {
      if (this.trends && this.currentPeriod) {
        this.scatterChartData = DataService.extractScatterData(
          this.trends,
          this.currentPeriod,
          this.currentMode
        );
      }
    },

    // 更新所有数据
    async updateAllData() {
      // 如果还没有加载数据，则加载一次
      if (!this.trends) {
        await this.loadTrendsData();
      }

      // 更新散点图数据
      this.updateScatterData();
    },
  },
});
