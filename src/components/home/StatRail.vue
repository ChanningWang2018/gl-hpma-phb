<template>
  <dl class="stats" aria-label="Week highlights">
    <div
      v-for="block in blocks"
      :key="block.key"
      class="stat"
      :class="{ 'is-empty': !block.row }"
      :tabindex="block.row ? 0 : -1"
      @pointerenter="$emit('highlight', block.id)"
      @pointerleave="$emit('highlight', null)"
      @focus="$emit('highlight', block.id)"
      @blur="$emit('highlight', null)"
    >
      <dt class="stat-label">{{ block.label }}</dt>
      <dd class="stat-value num">{{ block.value }}</dd>
      <dd class="stat-who">{{ block.who }}</dd>
    </div>
  </dl>
</template>

<script>
// StatRail — 版画顶部的三个数字：结论先于证据。dl 语义（三个 dt + 数值/
// 说明两个 dd），金色数字用衬线 + tabular-nums。悬停或聚焦某一块时向
// WeekPlate 抛 highlight(id)，由它点亮散点上对应的头像；离开 / 失焦抛
// null。无数据时整块显示 —，行高与间距不变。
const fmt = (value) => (value == null ? '—' : Number(value).toFixed(1));

// '+8.9' / '−8.9' / '0.0'：负号用 U+2212，和纸面排印一致
const jumpLabel = (value) => {
  if (value == null) return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (number === 0) return '0.0';
  const sign = number > 0 ? '+' : '−';
  return `${sign}${Math.abs(number).toFixed(1)}`;
};

export default {
  name: 'StatRail',
  props: {
    // summarize() output: { topWin, topPick, topJump } — rows or null
    stats: { type: Object, default: null },
  },
  emits: ['highlight'],
  computed: {
    blocks() {
      const { topWin, topPick, topJump } = this.stats || {};

      return [
        {
          key: 'top-win',
          label: 'Top win rate',
          row: topWin || null,
          id: topWin?.id ?? null,
          value: topWin ? `${fmt(topWin.win)}%` : '—',
          who: topWin ? `${topWin.name} · ${fmt(topWin.pick)}% picked` : '—',
        },
        {
          key: 'most-picked',
          label: 'Most picked',
          row: topPick || null,
          id: topPick?.id ?? null,
          value: topPick ? `${fmt(topPick.pick)}%` : '—',
          who: topPick ? `${topPick.name} · ${fmt(topPick.win)}% win` : '—',
        },
        {
          key: 'biggest-jump',
          label: 'Biggest jump',
          row: topJump || null,
          id: topJump?.id ?? null,
          value: topJump ? jumpLabel(topJump.dWin) : '—',
          who: topJump ? `${topJump.name} · now ${fmt(topJump.win)}%` : '—',
        },
      ];
    },
  },
};
</script>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid var(--gold-line);
}

.stat {
  min-width: 0;
  padding: 16px 22px 17px;
  border-right: 1px solid var(--gold-line);
}

.stat:last-child {
  border-right: 0;
}

.stat:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: -3px;
}

.stat-label {
  font-family: var(--font-type);
  font-size: 7.5px;
  line-height: 1.5;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--cream-muted);
}

.stat-value {
  margin-top: 3px;
  font-family: var(--font-serif);
  font-size: clamp(28px, 2.6vw, 36px);
  line-height: 1.05;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}

.stat-who {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--cream-muted);
}

.stat.is-empty .stat-value {
  opacity: 0.5;
}

@media (max-width: 768px) {
  .stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .stat {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 2px 12px;
    padding: 10px 14px;
    border-right: 0;
    border-bottom: 1px solid var(--gold-line);
  }

  .stat:last-child {
    border-bottom: 0;
  }

  .stat-label {
    grid-column: 1;
    grid-row: 1;
  }

  .stat-value {
    grid-column: 2;
    grid-row: 1;
    margin-top: 0;
    font-size: 22px;
  }

  .stat-who {
    grid-column: 1 / -1;
    grid-row: 2;
    margin-top: 0;
    font-size: 10px;
  }
}
</style>
