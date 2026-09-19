<template>
  <div ref="rootEl" class="line-chart">
    <Line ref="chartRef" :data="chartConfig" :options="options" />
    <!-- Living ink: a quill tip keeps tracing the line; the newest point ripples -->
    <svg
      v-if="ink.path && !reducedMotion"
      class="living-ink"
      :style="{ color: color }"
      :viewBox="`0 0 ${ink.w} ${ink.h}`"
      aria-hidden="true"
    >
      <circle class="ink-tip" r="3" :style="{ offsetPath: `path('${ink.path}')` }" />
      <circle class="ink-ripple" :cx="ink.tipX" :cy="ink.tipY" r="5" />
    </svg>
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
    // Hex color resolved from tokens by the parent (never a literal here).
    color: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      ink: { path: null, w: 0, h: 0, tipX: 0, tipY: 0 },
      reducedMotion: false
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
          backgroundColor: ThemeTokens.withAlpha(this.color, 0.08),
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: ThemeTokens.tokens.colors.paperLight,
          pointBorderColor: this.color,
          pointBorderWidth: 2
        }]
      }
    },
    options() {
      const paper = ThemeTokens.chartPaper()
      const isPickRate = this.label.includes('Pick Rate')

      return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: this.reducedMotion ? 0 : 600,
          easing: 'easeOutQuart',
          onComplete: () => this.recomputeInk()
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { ...paper.legendLabels }
          },
          tooltip: {
            ...paper.tooltip,
            callbacks: {
              label: (context) => {
                return `${this.label}: ${context.parsed.y.toFixed(2)}%`
              }
            }
          }
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
              callback: function(value) {
                return value + '%'
              }
            }
          },
          x: {
            border: { ...paper.scaleBorder },
            grid: { ...paper.grid },
            ticks: { display: false }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    }
  },
  mounted() {
    this.reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.onMotionPrefChange = (event) => { this.reducedMotion = event.matches }
    if (typeof window.matchMedia === 'function') {
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      this.motionQuery.addEventListener?.('change', this.onMotionPrefChange)
    }

    // Chart.js resizes the canvas with its container — keep the ink in sync.
    this.resizeObserver = new ResizeObserver(() => this.scheduleRecompute())
    this.resizeObserver.observe(this.$refs.rootEl)
  },
  beforeUnmount() {
    this.resizeObserver?.disconnect()
    this.motionQuery?.removeEventListener?.('change', this.onMotionPrefChange)
  },
  watch: {
    chartData() {
      this.$nextTick(() => this.scheduleRecompute())
    }
  },
  methods: {
    scheduleRecompute() {
      if (this.inkFrame) return
      this.inkFrame = requestAnimationFrame(() => {
        this.inkFrame = null
        this.recomputeInk()
      })
    },
    // Map the rendered line's point coordinates onto an SVG overlay path.
    recomputeInk() {
      if (this.reducedMotion) {
        this.ink = { path: null, w: 0, h: 0, tipX: 0, tipY: 0 }
        return
      }
      const comp = this.$refs.chartRef
      const chart = comp?.chart || comp
      const rootEl = this.$refs.rootEl
      if (!chart || !rootEl) return

      const meta = chart.getDatasetMeta(0)
      const points = (meta?.data || []).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))
      if (points.length < 2) {
        this.ink = { path: null, w: 0, h: 0, tipX: 0, tipY: 0 }
        return
      }

      const tip = points[points.length - 1]
      this.ink = {
        w: rootEl.clientWidth,
        h: rootEl.clientHeight,
        path: 'M' + points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L'),
        tipX: +tip.x.toFixed(1),
        tipY: +tip.y.toFixed(1)
      }
    }
  }
}
</script>

<style scoped>
.line-chart {
  width: 100%;
  height: 100%;
  position: relative;
}

.living-ink {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.ink-tip {
  fill: currentColor;
  filter: drop-shadow(0 0 3px currentColor);
  opacity: 0;
  offset-rotate: 0deg;
  animation: ink-travel 7s linear infinite;
}

@keyframes ink-travel {
  0% { offset-distance: 0%; opacity: 0; }
  4% { opacity: 0.95; }
  78% { opacity: 0.95; }
  88%, 100% { offset-distance: 100%; opacity: 0; }
}

.ink-ripple {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: ink-ripple 2.6s 1s ease-out infinite;
}

@keyframes ink-ripple {
  0% { opacity: 0.7; transform: scale(1); }
  70%, 100% { opacity: 0; transform: scale(2.6); }
}
</style>
