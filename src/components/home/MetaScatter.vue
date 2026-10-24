<template>
  <div
    ref="scroller"
    class="scatter"
    :class="{ 'is-pannable': pannable }"
    @scroll.passive="hideTip"
  >
    <div class="scatter-plot">
      <svg
        ref="svg"
        class="scatter-svg"
        :viewBox="`0 0 ${box.w} ${box.h}`"
        role="group"
        :aria-labelledby="ariaLabelledby"
      >
        <title :id="svgTitleId">
          Win rate against pick rate for every echo
        </title>
        <desc :id="svgDescId">
          Each portrait is an echo. Horizontal axis: share of teams that picked
          it. Vertical axis: share of matches won.
        </desc>

        <defs>
          <clipPath :id="clipId">
            <circle r="12" />
          </clipPath>
        </defs>

        <g class="grid">
          <template v-for="tick in xTicks" :key="`x-${tick}`">
            <line
              class="gridline"
              :x1="xScale(tick)"
              :x2="xScale(tick)"
              :y1="box.m.t"
              :y2="box.m.t + box.ph"
            />
            <text
              class="axis-tick"
              :x="xScale(tick)"
              :y="box.h - box.m.b + 15"
              text-anchor="middle"
            >
              {{ tick }}
            </text>
          </template>

          <template v-for="tick in yTicks" :key="`y-${tick}`">
            <line
              class="gridline"
              :x1="box.m.l"
              :x2="box.m.l + box.pw"
              :y1="yScale(tick)"
              :y2="yScale(tick)"
            />
            <text
              class="axis-tick"
              :x="box.m.l - 8"
              :y="yScale(tick) + 3"
              text-anchor="end"
            >
              {{ tick }}
            </text>
          </template>
        </g>

        <line
          v-if="evenVisible"
          class="even"
          :x1="box.m.l"
          :x2="box.m.l + box.pw"
          :y1="yScale(50)"
          :y2="yScale(50)"
        />

        <text
          class="axis-title"
          :x="box.m.l + box.pw"
          :y="box.h - 4"
          text-anchor="end"
        >
          PICK %
        </text>
        <text
          class="axis-title"
          x="10"
          :y="yAxisTitle.y"
          text-anchor="middle"
          :transform="yAxisTitle.transform"
        >
          WIN %
        </text>

        <g
          v-for="point in points"
          :key="point.id"
          class="pt"
          :class="{ 'is-ref': isHighlighted(point) }"
          :transform="`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`"
          tabindex="0"
          role="img"
          :aria-label="point.label"
          @pointerenter="showTip(point)"
          @pointerleave="hideTip"
          @focus="showTip(point)"
          @blur="hideTip"
        >
          <circle class="pt-hit" r="17" />
          <circle class="pt-ring" r="13" />
          <image
            class="pt-img"
            :href="point.avatar"
            width="24"
            height="24"
            x="-12"
            y="-12"
            preserveAspectRatio="xMidYMid slice"
            :clip-path="`url(#${clipId})`"
          />
          <title>{{ point.title }}</title>
        </g>
      </svg>

      <p
        v-if="tip"
        class="pt-tip"
        :class="{
          'is-below': tip.below,
          'is-start': tip.align === 'start',
          'is-end': tip.align === 'end',
        }"
        :style="tipStyle"
        role="status"
        aria-live="polite"
      >
        <b>{{ tip.name }}</b
        ><br />{{ fmt(tip.win) }}% win · {{ fmt(tip.pick) }}% pick
      </p>
    </div>
  </div>
</template>

<script>
// MetaScatter — 版画的散点：横轴选取率、纵轴胜率，点头像是回响。纯内联
// SVG（不引入 Chart.js），坐标域与原型一致：xMax = max(15, ceil(maxPick/5)*5+1)，
// yMin = floor(minWin/5)*5-1，yMax = ceil(maxWin/5)*5+1，10 的刻度、50%
// 虚线。头像 24px 圆裁剪 + 奶油细环，highlightId 命中时金环加粗（由
// StatRail 悬停驱动）。悬停/聚焦出头像浮层；移动端不缩图，横向可拖。
const WIDTH = 760;
const HEIGHT = 372;
const MARGIN = { t: 18, r: 16, b: 38, l: 40 };

// 无数据时也画一张稳定的空版画，避免加载过程中尺寸跳动
const EMPTY_DOMAIN = { xMax: 15, yMin: 40, yMax: 60 };

const fmt = (value) => Number(value).toFixed(1);
const avatarFor = (id) =>
  `/images/avatars/echo${String(id).padStart(2, '0')}.webp`;

// clipPath id 必须全页唯一：多个实例（未来若复用）互不串图
let instanceCount = 0;

export default {
  name: 'MetaScatter',
  props: {
    // [{ id, name, win, pick, dWin, dPick }]
    rows: { type: Array, default: () => [] },
    // Echo id to ring in gold (owned by WeekPlate, fed by StatRail)
    highlightId: { type: [Number, String], default: null },
  },
  emits: ['pannable-change'],
  data() {
    instanceCount += 1;
    return {
      uid: `home-scatter-${instanceCount}`,
      tip: null,
      pannable: false,
      resizeObserver: null,
    };
  },
  computed: {
    svgTitleId() {
      return `${this.uid}-title`;
    },
    svgDescId() {
      return `${this.uid}-desc`;
    },
    ariaLabelledby() {
      return `${this.svgTitleId} ${this.svgDescId}`;
    },
    clipId() {
      return `${this.uid}-clip`;
    },
    // Rows that can actually be plotted (finite win/pick + a name)
    validRows() {
      if (!Array.isArray(this.rows)) return [];
      return this.rows
        .filter((row) => row && row.name)
        .map((row) => ({
          id: row.id,
          name: row.name,
          win: Number(row.win),
          pick: Number(row.pick),
        }))
        .filter((row) => Number.isFinite(row.win) && Number.isFinite(row.pick));
    },
    // Plot rectangle + domain, computed exactly like the prototype
    box() {
      const m = MARGIN;
      const pw = WIDTH - m.l - m.r;
      const ph = HEIGHT - m.t - m.b;
      const rows = this.validRows;

      let domain = EMPTY_DOMAIN;
      if (rows.length) {
        const picks = rows.map((row) => row.pick);
        const wins = rows.map((row) => row.win);
        domain = {
          xMax: Math.max(15, Math.ceil(Math.max(...picks) / 5) * 5 + 1),
          yMin: Math.floor(Math.min(...wins) / 5) * 5 - 1,
          yMax: Math.ceil(Math.max(...wins) / 5) * 5 + 1,
        };
      }

      return { w: WIDTH, h: HEIGHT, m, pw, ph, ...domain };
    },
    xTicks() {
      const ticks = [];
      for (let value = 0; value <= this.box.xMax; value += 10) {
        ticks.push(value);
      }
      return ticks;
    },
    yTicks() {
      const ticks = [];
      const start = Math.ceil(this.box.yMin / 10) * 10;
      for (let value = start; value <= this.box.yMax; value += 10) {
        ticks.push(value);
      }
      return ticks;
    },
    evenVisible() {
      return this.box.yMin <= 50 && 50 <= this.box.yMax;
    },
    yAxisTitle() {
      const y = this.box.m.t + this.box.ph / 2;
      return { y, transform: `rotate(-90 10 ${y})` };
    },
    // Drawn low-pick first so busy discs sit on top, like the prototype
    points() {
      return [...this.validRows]
        .sort((a, b) => a.pick - b.pick)
        .map((row) => ({
          ...row,
          x: this.xScale(row.pick),
          y: this.yScale(row.win),
          avatar: avatarFor(row.id),
          label: `${row.name}: ${fmt(row.win)}% win rate, ${fmt(row.pick)}% pick rate`,
          title: `${row.name} — ${fmt(row.win)}% win, ${fmt(row.pick)}% pick`,
        }));
    },
    // 浮层用像素定位（按 SVG 实际渲染宽度换算），移动端图表被横向
    // 拖动时百分比会算错基准，所以这里以测得的 SVG 盒子为准
    tipStyle() {
      if (!this.tip) return undefined;
      return {
        left: `${this.tip.left}px`,
        top: `${this.tip.top}px`,
      };
    },
  },
  watch: {
    // 换档时旧的浮层不再对应当前数据
    rows() {
      this.tip = null;
    },
  },
  mounted() {
    this.$nextTick(this.updatePannable);
    if ('ResizeObserver' in window && this.$refs.scroller) {
      this.resizeObserver = new ResizeObserver(this.updatePannable);
      this.resizeObserver.observe(this.$refs.scroller);
    }
    // A floating tip measured before a resize would sit over the wrong portrait.
    window.addEventListener('resize', this.hideTip);
  },
  activated() {
    this.$nextTick(this.updatePannable);
  },
  deactivated() {
    this.hideTip();
  },
  beforeUnmount() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.hideTip);
    this.hideTip();
  },
  methods: {
    updatePannable() {
      const el = this.$refs.scroller;
      if (!el) return;
      const next = el.scrollWidth > el.clientWidth + 1;
      if (next !== this.pannable) {
        this.pannable = next;
        this.$emit('pannable-change', next);
      }
    },
    xScale(value) {
      return this.box.m.l + (value / this.box.xMax) * this.box.pw;
    },
    yScale(value) {
      const { m, ph, yMin, yMax } = this.box;
      return m.t + ph - ((value - yMin) / (yMax - yMin)) * ph;
    },
    fmt,
    isHighlighted(point) {
      if (this.highlightId === null || this.highlightId === undefined) {
        return false;
      }
      return String(point.id) === String(this.highlightId);
    },
    showTip(point) {
      // 靠近顶边的头像把浮层放到点下方；近左右边缘的贴边，避免被裁
      const ratio = point.x / this.box.w;
      let align = 'center';
      if (ratio < 0.12) align = 'start';
      else if (ratio > 0.88) align = 'end';

      // 视口 CSS 像素：svg 可能被 min-width 放大（移动端横向拖动）
      const rect = this.$refs.svg?.getBoundingClientRect();
      const scaleX = rect && rect.width ? rect.width / this.box.w : 0;
      const scaleY = rect && rect.height ? rect.height / this.box.h : 0;

      this.tip = {
        name: point.name,
        win: point.win,
        pick: point.pick,
        left: point.x * scaleX,
        top: point.y * scaleY,
        below: point.y < 56,
        align,
      };
    },
    hideTip() {
      this.tip = null;
    },
  },
};
</script>

<style scoped>
.scatter {
  min-width: 0;
  padding: 10px 8px 2px 12px;
}

.scatter-plot {
  position: relative;
}

.scatter-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.scatter-svg text {
  font-family: var(--font-type);
}

.gridline {
  stroke: var(--cream);
  stroke-opacity: 0.1;
  stroke-width: 1;
  stroke-dasharray: 2 5;
}

.even {
  stroke: var(--gold);
  stroke-opacity: 0.32;
  stroke-width: 1;
  stroke-dasharray: 5 5;
}

.axis-tick {
  fill: var(--cream-muted);
  font-size: 8.5px;
  letter-spacing: 0.06em;
}

.axis-title {
  fill: var(--cream-muted);
  font-size: 8px;
  letter-spacing: 0.18em;
  opacity: 0.7;
}

.pt {
  cursor: pointer;
}

.pt:focus-visible {
  outline: none;
}

.pt-ring {
  fill: var(--cover-2);
  stroke: var(--cream);
  stroke-opacity: 0.72;
  stroke-width: 1.1;
  transition:
    stroke 0.18s,
    stroke-width 0.18s;
}

/* Invisible, larger hit area: 24px portraits scale down to ~16px in the
   mobile's 520px-wide scroller, and a 16px tap target is not a tap target. */
.pt-hit {
  fill: transparent;
  pointer-events: all;
}

.pt:hover .pt-ring,
.pt:focus-visible .pt-ring {
  stroke: var(--gold);
  stroke-opacity: 1;
  stroke-width: 2;
}

.pt.is-ref .pt-ring {
  stroke: var(--gold);
  stroke-opacity: 1;
  stroke-width: 2.6;
}

.pt-img {
  pointer-events: none;
}

.pt-tip {
  position: absolute;
  z-index: 3;
  pointer-events: none;
  padding: 6px 9px;
  background: var(--cream);
  color: var(--cover);
  font-family: var(--font-type);
  font-size: 9.5px;
  line-height: 1.5;
  letter-spacing: 0.03em;
  white-space: nowrap;
  transform: translate(-50%, calc(-100% - 10px));
  box-shadow: 0 8px 20px rgba(var(--ink-rgb), 0.35);
}

.pt-tip.is-below {
  transform: translate(-50%, 10px);
}

/* 靠近左右边缘的头像把浮层贴边摆，避免被滚动容器裁掉 */
.pt-tip.is-start {
  transform: translate(6px, calc(-100% - 10px));
}

.pt-tip.is-start.is-below {
  transform: translate(6px, 10px);
}

.pt-tip.is-end {
  transform: translate(calc(-100% - 6px), calc(-100% - 10px));
}

.pt-tip.is-end.is-below {
  transform: translate(calc(-100% - 6px), 10px);
}

.pt-tip b {
  color: var(--oxblood);
  font-weight: 600;
}

@media (max-width: 768px) {
  .scatter {
    overflow-x: auto;
    padding: 8px 4px 0 8px;
  }

  .scatter-svg {
    min-width: 520px;
  }
}

/* Only fade/scroll when the chart actually overflows (measured in JS). */
.scatter.is-pannable {
  scrollbar-width: thin;
  mask-image: linear-gradient(90deg, var(--cream) 92%, transparent 100%);
  -webkit-mask-image: linear-gradient(
    90deg,
    var(--cream) 92%,
    transparent 100%
  );
}

@media (prefers-reduced-motion: reduce) {
  .pt-ring {
    transition: none;
  }
}
</style>
