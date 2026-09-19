<template>
  <section class="echo-standings">
    <h3>Standings · {{ modeLabel }}</h3>
    <table>
      <thead>
        <tr>
          <th>Echo</th>
          <th>Win %</th>
          <th>Δ week</th>
          <th>Pick %</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in rankedRows"
          :key="row.reverberationid"
          :style="{ '--tint': tintFor(index) }"
        >
          <td>{{ row.name }}</td>
          <td class="num-cell">{{ fmt(row.winrate) }}%</td>
          <td :class="row.delta === null ? 'no-delta' : (row.delta >= 0 ? 'delta-up' : 'delta-down')">
            <template v-if="row.delta === null">&mdash;</template>
            <template v-else>{{ row.delta >= 0 ? '▲' : '▼' }} {{ Math.abs(row.delta).toFixed(1) }}</template>
          </td>
          <td class="num-cell">{{ fmt(row.attendancerate) }}%</td>
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
      required: true
    },
    // Same shape for the previous period, or null when there is none
    prevRows: {
      type: Array,
      default: null
    },
    mode: {
      type: String,
      required: true
    }
  },
  computed: {
    modeLabel() {
      return this.mode
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    },
    rankedRows() {
      const prevById = new Map(
        (this.prevRows || []).map(row => [row.reverberationid, row])
      );

      return [...this.rows]
        .filter(row => row && row.name)
        .sort((a, b) => (b.winrate ?? -Infinity) - (a.winrate ?? -Infinity))
        .map(row => {
          const prev = prevById.get(row.reverberationid);
          const delta = prev && prev.winrate != null && row.winrate != null
            ? row.winrate - prev.winrate
            : null;
          return { ...row, delta };
        });
    }
  },
  methods: {
    fmt(value) {
      return value == null ? '—' : Number(value).toFixed(1);
    },
    // Ink deepens toward the top of the table (rank-based tint)
    tintFor(index) {
      return Math.max(0.02, 0.20 - index * 0.013).toFixed(3);
    }
  }
}
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

  th, td {
    padding: 7px 8px;
    font-size: 0.8em;
  }
}
</style>
