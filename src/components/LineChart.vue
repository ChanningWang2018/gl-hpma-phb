<template>
  <div class="line-chart">
    <Line :data="chartConfig" :options="options" />
  </div>
</template>

<script>
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'vue-chartjs';
import { ThemeTokens } from '@/services/themeTokens.js';

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export default {
  name: 'LineChart',
  components: { Line },
  props: {
    chartData: {
      type: Array,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    // Hex color resolved from tokens by the parent (never a literal here).
    color: {
      type: String,
      required: true,
    },
  },
  computed: {
    chartConfig() {
      // 过滤掉值为null的数据
      const filteredData = this.chartData.filter((item) => item.value !== null);

      return {
        labels: filteredData.map((d) => d.period),
        datasets: [
          {
            label: this.label,
            data: filteredData.map((d) => d.value),
            borderColor: this.color,
            backgroundColor: ThemeTokens.withAlpha(this.color, 0.08),
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: ThemeTokens.tokens.colors.paperLight,
            pointBorderColor: this.color,
            pointBorderWidth: 2,
          },
        ],
      };
    },
    options() {
      const paper = ThemeTokens.chartPaper();
      const isPickRate = this.label.includes('Pick Rate');

      return {
        responsive: true,
        maintainAspectRatio: false,
        // The trend line is deliberately static: no draw-on animation and no
        // ambient ink trace.
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { ...paper.legendLabels },
          },
          tooltip: {
            ...paper.tooltip,
            callbacks: {
              label: (context) => {
                return `${this.label}: ${context.parsed.y.toFixed(2)}%`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: isPickRate,
            min: isPickRate ? undefined : 30,
            max: isPickRate ? undefined : 70,
            border: { ...paper.scaleBorder },
            grid: { ...paper.grid },
            ticks: {
              ...paper.ticks,
              maxTicksLimit: 8,
              callback: function (value) {
                return value + '%';
              },
            },
          },
          x: {
            border: { ...paper.scaleBorder },
            grid: { ...paper.grid },
            ticks: { display: false },
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      };
    },
  },
};
</script>

<style scoped>
.line-chart {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
