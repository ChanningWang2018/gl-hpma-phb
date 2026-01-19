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
  Tooltip
} from 'chart.js';
import { Line } from 'vue-chartjs';

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export default {
  name: 'LineChart',
  components: { Line },
  props: {
    chartData: {
      type: Array,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    color: {
      type: String,
      required: true
    }
  },
  computed: {
    chartConfig() {
      // 过滤掉值为null的数据
      const filteredData = this.chartData.filter(item => item.value !== null)
      
      return {
        labels: filteredData.map(d => d.period),
        datasets: [{
          label: this.label,
          data: filteredData.map(d => d.value),
          borderColor: this.color,
          backgroundColor: this.color.replace(')', ', 0.1)').replace('rgb', 'rgba'),
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: 'white',
          pointBorderColor: this.color,
          pointBorderWidth: 2
        }]
      }
    },
    options() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 300,
          easing: 'linear'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                size: 13,
                weight: '600'
              },
              boxWidth: 12,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 10,
            titleFont: {
              size: 13,
              weight: '600'
            },
            bodyFont: {
              size: 12
            },
            displayColors: false,
            callbacks: {
              label: (context) => {
                return `${this.label}: ${context.parsed.y.toFixed(2)}%`
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: this.label.includes('Pick Rate') ? true : false,
            min: this.label.includes('Win Rate') ? 30 : undefined,
            max: this.label.includes('Win Rate') ? 70 : undefined,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            ticks: {
              callback: function(value) {
                return value + '%'
              },
              font: {
                size: 11
              },
              maxTicksLimit: 8
            }
          },
          x: {
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            ticks: {
              display: false,
              // font: {
              //   size: 12
              // },
              // callback: function(value, index, ticks) {
              //   // Use this.getLabelForValue to ensure we get the string (e.g., "2023-01")
              //   // instead of the index (e.g., 0).
              //   const currentLabel = this.getLabelForValue(value);
                
              //   // Get all labels defined in the chart to find the absolute start and end.
              //   const allLabels = this.getLabels();
                
              //   // Check if the current label is the very first or the very last one.
              //   if (index === 0 || index === allLabels.length - 1) {
              //     return currentLabel;
              //   }
                
              //   // Return empty string for all others to hide them
              //   return '';
              // }
          }
        }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    }
  }
}
</script>

<style scoped>
.line-chart {
  width: 100%;
  height: 100%;
}
</style>
