<template>
  <section class="plate" aria-labelledby="plate-title">
    <header class="plate-top">
      <p id="plate-title" class="plate-label">The week in one picture</p>

      <div class="modes" role="group" aria-label="Game mode">
        <button
          v-for="option in modes"
          :key="option.key"
          type="button"
          class="mode-btn"
          :aria-pressed="option.key === mode ? 'true' : 'false'"
          @click="setMode(option.key)"
        >
          {{ option.label }}
        </button>
      </div>

      <p class="plate-date">{{ periodShortLabel }}</p>
    </header>

    <StatRail :stats="stats" @highlight="onHighlight" />

    <MetaScatter
      :rows="rows"
      :highlight-id="highlightId"
      @pannable-change="pannable = $event"
    />

    <footer class="plate-foot">
      <span>{{ countsLabel }}</span>
      <span v-if="pannable" class="hint-mobile">Swipe the chart →</span>
      <span v-else class="hint-desktop"
        >Hover or tap a portrait for details</span
      >
    </footer>
  </section>
</template>

<script>
import MetaScatter from '@/components/home/MetaScatter.vue';
import StatRail from '@/components/home/StatRail.vue';
import {
  DEFAULT_HOME_MODE,
  HOME_MODES,
  formatModeLabel,
  summarize,
} from '@/services/homeStats.js';

// WeekPlate — 封面内的深色版画。四档模式由 Home 持有（右侧的涨跌榜要跟着
// 同一档走），这里只发 update:mode，不本地改状态。三个数字在上、散点在下；
// StatRail 悬停抛出的 echo id 存在 highlightId 里，交给 MetaScatter 点亮
// 金环。Home 一次传入四档 rows（rowsByMode），换档不再请求数据。
export default {
  name: 'WeekPlate',
  components: { MetaScatter, StatRail },
  props: {
    // { '1v1-high': [...], '1v1-low': [...], '2v2-high': [...], '2v2-low': [...] }
    rowsByMode: { type: Object, default: () => ({}) },
    // Week count (periods.length); null while loading
    edition: { type: Number, default: null },
    // Full range label, e.g. '24–30 Sep 2026'
    periodLabel: { type: String, default: '' },
    // Controlled bracket selection, owned by Home
    mode: { type: String, default: DEFAULT_HOME_MODE },
  },
  emits: ['update:mode'],
  data() {
    return {
      highlightId: null,
      pannable: false,
    };
  },
  computed: {
    modes() {
      return HOME_MODES.map((key) => ({ key, label: formatModeLabel(key) }));
    },
    rows() {
      const rows = (this.rowsByMode || {})[this.mode];
      return Array.isArray(rows) ? rows : [];
    },
    stats() {
      return summarize(this.rows);
    },
    // '24–30 Sep' — the year stays on the cover kicker
    periodShortLabel() {
      return this.periodLabel ? this.periodLabel.replace(/ \d{4}$/, '') : '—';
    },
    countsLabel() {
      const echoCount = this.rows.length;
      const bracketCount = HOME_MODES.filter(
        (key) => ((this.rowsByMode || {})[key] || []).length > 0,
      ).length;
      const weekCount = this.edition;

      const count = (value, one, many) =>
        value ? `${value} ${value === 1 ? one : many}` : `— ${many}`;

      return [
        count(echoCount, 'echo', 'echoes'),
        count(bracketCount, 'bracket', 'brackets'),
        count(weekCount, 'week', 'weeks'),
      ].join(' · ');
    },
  },
  watch: {
    // A new bracket invalidates the highlighted portrait and the tooltip
    mode() {
      this.highlightId = null;
    },
  },
  methods: {
    setMode(key) {
      if (this.mode === key) return;
      this.$emit('update:mode', key);
    },
    onHighlight(id) {
      this.highlightId = id ?? null;
    },
  },
};
</script>

<style scoped>
.plate {
  position: relative;
  width: 100%;
  min-width: 0;
  background: var(--cover-2);
  border: 1px solid var(--ink);
  box-shadow: 0 22px 54px rgba(var(--ink-rgb), 0.2);
  text-align: left;
  animation: rise 0.8s 0.18s both;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.plate-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--gold-line);
}

.plate-label {
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--gold);
  white-space: nowrap;
}

.modes {
  display: flex;
  gap: 2px;
  margin: 0 auto;
}

.mode-btn {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 6px 10px;
  font-family: var(--font-type);
  font-size: 8.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cream-muted);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.2s,
    color 0.2s;
}

.mode-btn:hover {
  color: var(--cream);
}

.mode-btn:focus-visible {
  outline: 2px solid var(--cream);
  outline-offset: -2px;
}

.mode-btn[aria-pressed='true'] {
  background: var(--gold);
  color: var(--cover);
}

.plate-date {
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--cream-muted);
  white-space: nowrap;
}

.plate-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  border-top: 1px solid var(--gold-line);
  font-family: var(--font-type);
  font-size: 8px;
  line-height: 1.5;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cream-muted);
}

@media (max-width: 768px) {
  .plate-top {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
  }

  .plate-label {
    display: none;
  }

  .plate-date {
    order: -1;
  }

  .modes {
    width: 100%;
    margin: 0;
    justify-content: space-between;
  }

  .mode-btn {
    flex: 1;
    padding: 10px 2px;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .plate {
    animation: none;
  }

  .mode-btn {
    transition: none;
  }
}
</style>
