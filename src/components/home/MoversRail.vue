<template>
  <section class="movers" aria-labelledby="movers-title">
    <header class="aside-head">
      <p class="kicker">Movers</p>
      <h3 id="movers-title">Week over week</h3>
      <p class="aside-deck">Win rate, points · {{ modeLabel || '—' }}</p>
    </header>

    <ul v-if="movers.length" class="mover-list" role="list">
      <li
        v-for="mover in movers"
        :key="mover.id"
        class="mover"
        :class="`is-${mover.direction}`"
      >
        <img
          class="mover-face"
          :src="mover.avatar"
          alt=""
          width="30"
          height="30"
          loading="lazy"
          decoding="async"
        />
        <span class="mover-who">
          <span class="mover-name">{{ mover.name }}</span>
          <span class="mover-win">{{ mover.win }}% win</span>
        </span>
        <span class="mover-delta">{{ mover.deltaLabel }}</span>
        <span
          class="mover-bar"
          :style="{ width: mover.width }"
          aria-hidden="true"
        ></span>
      </li>
    </ul>

    <p v-else class="movers-empty">No movement recorded for this bracket.</p>
  </section>
</template>

<script>
import { rankMovers } from '@/services/homeStats.js';

const avatarFor = (id) =>
  `/images/avatars/echo${String(id).padStart(2, '0')}.webp`;

const oneDecimal = (value) => Number(value).toFixed(1);

// '+8.9' / '−11.1' — U+2212 minus, as the rest of the paper prints it.
const deltaLabel = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '0.0';
  return `${number > 0 ? '+' : '−'}${oneDecimal(Math.abs(number))}`;
};

// MoversRail — the paper column beside the plate. Three largest rises and two
// largest falls of the current bracket, ordered by absolute movement, each row
// carrying a proportional bar. A rise grows from the left in ink-teal, a fall
// from the right in oxblood; the signed number carries the same information
// for anyone who cannot rely on colour.
export default {
  name: 'MoversRail',
  props: {
    // mergeRows() output for the bracket currently shown on the plate
    rows: { type: Array, default: () => [] },
    // e.g. '2v2 High'
    modeLabel: { type: String, default: '' },
  },
  computed: {
    movers() {
      const picked = rankMovers(this.rows);
      if (!picked.length) return [];

      const scale = Math.max(
        ...picked.map((row) => Math.abs(Number(row.dWin)) || 0),
      );

      return picked.map((row) => {
        const delta = Number(row.dWin);
        const width = scale
          ? Math.max(4, Math.round((Math.abs(delta) / scale) * 100))
          : 0;

        return {
          id: row.id,
          name: row.name,
          win: oneDecimal(row.win),
          dWin: delta,
          direction: delta > 0 ? 'up' : 'down',
          deltaLabel: deltaLabel(delta),
          width: `${width}%`,
          avatar: avatarFor(row.id),
        };
      });
    },
  },
};
</script>

<style scoped>
.movers {
  padding-top: 13px;
  border-top: 1px solid var(--ink);
}

.kicker {
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--oxblood);
}

.aside-head h3 {
  margin-top: 6px;
  font-family: var(--font-serif);
  font-size: clamp(21px, 1.9vw, 25px);
  font-weight: 400;
  line-height: 1.1;
  color: var(--ink);
}

.aside-deck {
  margin-top: 5px;
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.mover-list {
  margin-top: 14px;
  list-style: none;
}

.mover {
  position: relative;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0 12px;
  border-bottom: 1px solid var(--rule);
  overflow: hidden;
}

.mover:last-child {
  border-bottom: 0;
}

.mover-face {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--paper-deep);
  box-shadow: 0 0 0 1px var(--rule);
  filter: saturate(0.92);
}

.mover-who {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.mover-name {
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-serif);
  font-size: 15.5px;
  line-height: 1.2;
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mover-win {
  flex: none;
  font-family: var(--font-type);
  font-size: 9px;
  line-height: 1.5;
  letter-spacing: 0.04em;
  color: var(--ink-faded);
  font-variant-numeric: tabular-nums;
}

.mover-delta {
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.mover.is-up .mover-delta {
  color: var(--teal-ink);
}

.mover.is-down .mover-delta {
  color: var(--oxblood);
}

.mover-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  background: var(--teal-ink);
  opacity: 0.55;
  transition: width 0.35s ease-out;
}

.mover.is-down .mover-bar {
  right: 0;
  left: auto;
  background: var(--oxblood);
}

.movers-empty {
  margin-top: 14px;
  padding: 12px 0;
  border-top: 1px solid var(--rule);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink-faded);
}

@media (prefers-reduced-motion: reduce) {
  .mover-bar {
    transition: none;
  }
}
</style>
