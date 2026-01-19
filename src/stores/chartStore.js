import { DataService } from "@/services/dataService.js";
import { defineStore } from "pinia";

export const useChartStore = defineStore("chart", {
  state: () => ({
    // 响应式数据
    currentReverberation: 1,
    currentMode: "2v2-high",
    currentPeriod: null,
    periods: [],
    allData: [],
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
        state.allData,
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

    // 初始化时期选择器
    async initializePeriodSelector() {
      this.loading = true;
      try {
        const manifest = await DataService.loadManifest();
        console.log("Loaded manifest:", manifest);
        this.periods = manifest.map((item) => item.period);

        // 设置默认选中最新时期
        if (this.periods.length > 0) {
          this.currentPeriod = this.periods[this.periods.length - 1];
          console.log("Set current period to:", this.currentPeriod);
        }
      } catch (error) {
        this.error = "Failed to load manifest";
        console.error("Error loading manifest:", error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // 加载所有归档数据
    async loadArchiveData() {
      this.loading = true;
      try {
        this.allData = await DataService.loadArchiveData();
      } catch (error) {
        this.error = "Failed to load archive data";
        console.error("Error loading archive data:", error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // 更新散点图数据
    updateScatterData() {
      if (this.currentPeriod) {
        this.scatterChartData = DataService.extractScatterData(
          this.allData,
          this.currentPeriod,
          this.currentMode
        );
      }
    },

    // 更新所有数据
    async updateAllData() {
      // 如果还没有加载数据，则加载一次
      if (this.allData.length === 0) {
        await this.loadArchiveData();
      }

      // 更新散点图数据
      this.updateScatterData();
    },
  },
});
