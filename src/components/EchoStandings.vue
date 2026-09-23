<template>
  <section class="echo-standings">
    <h3>Standings · {{ modeLabel }}</h3>
    <table>
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :aria-sort="
              sortKey === col.key
                ? sortDir === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            "
          >
            <button
              class="th-sort"
              :class="{ active: sortKey === col.key }"
              type="button"
              @click="setSort(col.key)"
            >
              {{ col.label }}
              <span v-if="sortKey === col.key" class="sort-arrow">{{
                sortDir === 'asc' ? '▲' : '▼'
              }}</span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in sortedRows"
          :key="row.reverberationid"
          :style="{ '--tint': tintFor(row.winRank) }"
        >
          <td>{{ row.name }}</td>
          <td class="num-cell">{{ fmt(row.winrate) }}%</td>
          <td :class="deltaClass(row.deltaWin)">
            {{ deltaLabel(row.deltaWin) }}
          </td>
          <td class="num-cell">{{ fmt(row.attendancerate) }}%</td>
          <td :class="deltaClass(row.deltaPick)">
            {{ deltaLabel(row.deltaPick) }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script>
export default {
  name: 'EchoStandings',
  props: {
    // All echo rows for the current period + mode
    // ({ reverberationid, name, winrate, attendancerate })
    rows: {
      type: Array,
      required: true,
    },
    // Same shape for the previous period, or null when there is none
    prevRows: {
      type: Array,
      default: null,
    },
    mode: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      sortKey: 'winrate',
      sortDir: 'desc',
    };
  },
  computed: {
    columns() {
      return [
        { key: 'name', label: 'Echo' },
        { key: 'winrate', label: 'Win %' },
        { key: 'deltaWin', label: 'Δ Win' },
        { key: 'attendancerate', label: 'Pick %' },
        { key: 'deltaPick', label: 'Δ Pick' },
      ];
    },
    modeLabel() {
      return this.mode
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    },
    // Decorate every row with its win-rate rank and week-over-week deltas.
    // The tint anchors to winRank, NOT to row position — sorting reshuffles
    // rows but the ink depth always encodes the win-rate standing.
    decoratedRows() {
      const prevById = new Map(
        (this.prevRows || []).map((row) => [row.reverberationid, row]),
      );

      return [...this.rows]
        .filter((row) => row && row.name)
        .sort((a, b) => (b.winrate ?? -Infinity) - (a.winrate ?? -Infinity))
        .map((row, index) => {
          const prev = prevById.get(row.reverberationid);
          const deltaOf = (current, previous) =>
            prev && previous != null && current != null
              ? current - previous
              : null;
          return {
            ...row,
            winRank: index,
            deltaWin: deltaOf(row.winrate, prev?.winrate),
            deltaPick: deltaOf(row.attendancerate, prev?.attendancerate),
          };
        });
    },
    sortedRows() {
      const dir = this.sortDir === 'asc' ? 1 : -1;
      const key = this.sortKey;

      return [...this.decoratedRows].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av == null && bv == null) return 0;
        if (av == null) return 1; // missing values sink regardless of direction
        if (bv == null) return -1;
        if (typeof av === 'string') return av.localeCompare(bv) * dir;
        return (av - bv) * dir;
      });
    },
  },
  methods: {
    setSort(key) {
      if (this.sortKey === key) {
        this.sortDir = this.sortDir === 'desc' ? 'asc' : 'desc';
        return;
      }
      this.sortKey = key;
      this.sortDir = key === 'name' ? 'asc' : 'desc';
    },
    deltaClass(delta) {
      if (delta == null) return 'no-delta';
      return delta >= 0 ? 'delta-up' : 'delta-down';
    },
    deltaLabel(delta) {
      if (delta == null) return '—';
      return `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}`;
    },
    fmt(value) {
      return value == null ? '—' : Number(value).toFixed(1);
    },
    // Ink deepens toward the win-rate leader (rank-based tint)
    tintFor(winRank) {
      return Math.max(0.02, 0.2 - winRank * 0.013).toFixed(3);
    },
  },
};
</script>

<style scoped>
.echo-standings {
  padding: 4px 30px 26px;
  border-bottom: 1px solid var(--rule);
  overflow-x: auto;
}

h3 {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 1.25em;
  text-align: center;
  margin-bottom: 14px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  color: var(--ink-faded);
  font-family: var(--font-type);
  font-weight: 400;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.8em;
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ink);
}

/* Sortable headers: the caption is a press button */
.th-sort {
  background: none;
  border: none;
  padding: 0 0 2px;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid transparent;
  transition: color 0.2s;
}

.th-sort:hover {
  color: var(--ink);
}

.th-sort.active {
  color: var(--ink);
  border-bottom-color: var(--gold-leaf);
}

.sort-arrow {
  font-size: 0.85em;
  color: var(--oxblood);
}

td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--rule);
  font-size: 0.9em;
  color: var(--ink);
}

tbody tr {
  background: rgba(var(--accent-rgb), var(--tint, 0));
  transition: filter 0.2s;
}

tbody tr:hover {
  filter: brightness(0.97);
}

tbody tr:last-child td {
  border-bottom: none;
}

.num-cell {
  font-variant-numeric: tabular-nums;
}

.delta-up {
  color: var(--oxblood);
  font-weight: 600;
}

.delta-down {
  color: var(--ink-faded);
}

.no-delta {
  color: var(--ink-faded);
}

@media (max-width: 768px) {
  .echo-standings {
    padding: 4px 15px 20px;
  }

  th,
  td {
    padding: 7px 8px;
    font-size: 0.8em;
  }
}
</style>
