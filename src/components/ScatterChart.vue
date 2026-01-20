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
      if (!this.chartData || this.chartData.length === 0) {
        return {
          datasets: []
        }
      }

      if (!this.imagesLoaded) {
        return {
          datasets: [{
            data: this.chartData.map(item => ({
              x: item.attendancerate,
              y: item.winrate,
              name: item.name,
              id: item.reverberationid
            })),
            pointStyle: 'circle',
            backgroundColor: 'rgba(102, 126, 234, 0.3)',
            borderColor: 'rgba(102, 126, 234, 0.8)',
            borderWidth: 1,
            pointRadius: 8,
            pointHoverRadius: 12
          }]
        }
      }

      const pointStyles = []
      const pointColors = []
      const allImagesLoaded = this.chartData.every(item => 
        this.avatarImages[item.reverberationid]
      )

      if (!allImagesLoaded) {
        return {
          datasets: [{
            data: this.chartData.map(item => ({
              x: item.attendancerate,
              y: item.winrate,
              name: item.name,
              id: item.reverberationid
            })),
            pointStyle: 'circle',
            backgroundColor: 'rgba(102, 126, 234, 0.3)',
            borderColor: 'rgba(102, 126, 234, 0.8)',
            borderWidth: 1,
            pointRadius: 8,
            pointHoverRadius: 12
          }]
        }
      }

      this.chartData.forEach(item => {
        const avatarId = item.reverberationid
        const image = this.avatarImages[avatarId]
        
        if (image) {
          pointStyles.push(image)
          pointColors.push('transparent')
        } else {
          pointStyles.push('circle')
          pointColors.push('rgba(102, 126, 234, 0.3)')
        }
      })

      return {
        datasets: [{
          data: this.chartData.map(item => ({
            x: item.attendancerate,
            y: item.winrate,
            name: item.name,
            id: item.reverberationid
          })),
          pointStyle: pointStyles,
          backgroundColor: pointColors,
          borderColor: 'rgba(102, 126, 234, 0.8)',
          borderWidth: 0,
          pointRadius: 20,
          pointHoverRadius: 25
        }]
      }
    },
    options() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 200,
          easing: 'linear'
        },
        plugins: {
          legend: {
            display: false
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
                const item = context.raw
                return item ? [
                  item.name,
                  `Win Rate: ${item.y.toFixed(2)}%`,
                  `Pick Rate: ${item.x.toFixed(2)}%`
                ] : []
              }
            }
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Win Rate (%)',
              font: {
                size: 13,
                weight: '600'
              },
              color: '#495057'
            },
            beginAtZero: false,
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
            title: {
              display: true,
              text: 'Pick Rate (%)',
              font: {
                size: 13,
                weight: '600'
              },
              color: '#495057'
            },
            beginAtZero: true,
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

      const imagePromises = this.chartData.map(async item => {
        const id = item.reverberationid
        const idStr = id.toString().padStart(2, '0')
        
        try {
          const response = await fetch(`/images/avatars/echo${idStr}.webp`)
          if (!response.ok) {
            throw new Error(`Failed to fetch WebP image for echo${idStr}`)
          }
          const blob = await response.blob()
          return new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => {
              img.width = 50
              img.height = 50
              resolve({ id, img })
            }
            img.onerror = () => reject(new Error(`Failed to load WebP image for echo${idStr}`))
            img.src = URL.createObjectURL(blob)
          })
        } catch (error) {
          console.warn(`无法加载头像图片 echo${idStr}:`, error)
          return null
        }
      })

      try {
        const results = await Promise.all(imagePromises)
        
        results.forEach(result => {
          if (result) {
            this.avatarImages[result.id] = result.img
          }
        })
        
        this.imagesLoaded = true
        
        this.$forceUpdate()
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
