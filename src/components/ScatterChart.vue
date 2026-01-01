<template>
  <div class="scatter-chart">
    <Scatter :data="chartConfig" :options="options" />
  </div>
</template>

<script>
import {
  Chart as ChartJS,
  Legend,
  LinearScale,
  PointElement,
  ScatterController,
  Title,
  Tooltip
} from 'chart.js';
import { Scatter } from 'vue-chartjs';

// 注册Chart.js组件
ChartJS.register(
  LinearScale,
  PointElement,
  ScatterController,
  Title,
  Tooltip,
  Legend
)

export default {
  name: 'ScatterChart',
  components: { Scatter },
  props: {
    chartData: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      avatarImages: {},
      imagesLoaded: false
    }
  },
  computed: {
    chartConfig() {
      // 如果没有数据或图片未加载，返回空配置
      if (!this.chartData || this.chartData.length === 0 || !this.imagesLoaded) {
        return {
          datasets: []
        }
      }

      // 为每个数据点创建单独的dataset，以便使用不同的图片
      const datasets = this.chartData.map(item => {
        const avatarId = item.reverberationid
        const image = this.avatarImages[avatarId]
        
        // 如果没有对应的图片，使用默认颜色
        if (!image) {
          return {
            label: item.name,
            data: [{ x: item.attendancerate, y: item.winrate }],
            backgroundColor: 'rgba(102, 126, 234, 0.3)',
            borderColor: 'rgba(102, 126, 234, 0.8)',
            borderWidth: 1,
            pointRadius: 8,
            pointHoverRadius: 12
          }
        }

        // 使用图片作为数据点
        return {
          label: item.name,
          data: [{ x: item.attendancerate, y: item.winrate }],
          pointStyle: image,
          pointRadius: 20,
          pointHoverRadius: 25,
          borderWidth: 0
        }
      })

      return {
        datasets: datasets
      }
    },
    options() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: '600'
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              label: (context) => {
                const item = this.chartData[context.datasetIndex]  // datasetIndex rather than dataIndex
                return item ? [
                  item.name,
                  `胜率: ${item.winrate.toFixed(2)}%`,
                  `登场率: ${item.attendancerate.toFixed(2)}%`
                ] : []
              }
            }
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: '胜率 (%)',
              font: {
                size: 14,
                weight: '600'
              },
              color: '#495057'
            },
            beginAtZero: false,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              callback: function(value) {
                return value + '%'
              },
              font: {
                size: 12
              }
            }
          },
          x: {
            title: {
              display: true,
              text: '登场率 (%)',
              font: {
                size: 14,
                weight: '600'
              },
              color: '#495057'
            },
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              callback: function(value) {
                return value + '%'
              },
              font: {
                size: 12
              }
            }
          }
        },
        interaction: {
          intersect: true,
          mode: 'point'
        }
      }
    }
  },
  mounted() {
    this.loadAvatarImages()
  },
  watch: {
    chartData() {
      // 数据变化时重新加载图片
      this.loadAvatarImages()
    }
  },
  methods: {
    async loadAvatarImages() {
      if (!this.chartData || this.chartData.length === 0) {
        return
      }

      // 获取所有唯一的回响ID
      const reverberationIds = [...new Set(this.chartData.map(item => item.reverberationid))]
      
      // 加载所有头像图片
      const imagePromises = reverberationIds.map(async id => {
        try {
          const response = await fetch(`/images/avatars/echo${id.toString().padStart(2, '0')}.png`)
          if (!response.ok) {
            throw new Error(`Failed to load image for id ${id}`)
          }
          
          const blob = await response.blob()
          return new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => {
              img.width = 50
              img.height = 50
              resolve({ id, img })}
            img.onerror = reject
            img.src = URL.createObjectURL(blob)
          })
        } catch (error) {
          console.warn(`无法加载头像图片 echo${id.toString().padStart(2, '0')}.png:`, error)
          return null
        }
      })

      try {
        const results = await Promise.all(imagePromises)
        
        // 更新avatarImages对象
        results.forEach(result => {
          if (result) {
            this.avatarImages[result.id] = result.img
          }
        })
        
        this.imagesLoaded = true
      } catch (error) {
        console.error('加载头像图片失败:', error)
      }
    }
  }
}
</script>

<style scoped>
.scatter-chart {
  width: 100%;
  height: 100%;
}
</style>
