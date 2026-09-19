<template>
  <div class="data-table">
    <h3>Detailed Data</h3>
    <table id="dataTable">
      <thead>
        <tr>
          <th>Period</th>
          <th>Mode</th>
          <th>Win Rate (%)</th>
          <th>Pick Rate (%)</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in tableData" :key="index">
          <td>{{ item.period }}</td>
          <td>{{ modeMapping[currentMode] }}</td>
          <td>
            <span class="stat-badge winrate-badge">
              {{ item.winrate ? item.winrate.toFixed(2) : 'N/A' }}
            </span>
          </td>
          <td>
            <span class="stat-badge attend-badge">
              {{ item.attendancerate ? item.attendancerate.toFixed(2) : 'N/A' }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'DataTable',
  props: {
    tableData: {
      type: Array,
      required: true
    },
    currentMode: {
      type: String,
      required: true
    },
    modeMapping: {
      type: Object,
      required: true
    }
  }
}
</script>

<style scoped>
.data-table {
  padding: 30px;
  overflow-x: auto;
}

@media (max-width: 768px) {
  .data-table {
    padding: 15px;
  }

  table {
    font-size: 0.85em;
  }

  th {
    padding: 12px 10px;
    font-size: 0.85em;
  }

  td {
    padding: 10px 8px;
    font-size: 0.8em;
  }

  .stat-badge {
    padding: 4px 10px;
    font-size: 0.75em;
  }
}

@media (max-width: 480px) {
  .data-table {
    padding: 12px;
  }

  table {
    font-size: 0.75em;
  }

  th {
    padding: 8px 6px;
    font-size: 0.75em;
    white-space: nowrap;
  }

  td {
    padding: 6px 4px;
    font-size: 0.7em;
  }

  .stat-badge {
    padding: 3px 8px;
    font-size: 0.7em;
    display: block;
    text-align: center;
  }
}

table {
  width: 100%;
  border-collapse: collapse;
  background: transparent;
  border-top: 3px double var(--ink);
}

th {
  background: transparent;
  color: var(--ink-faded);
  font-family: var(--font-type);
  font-weight: 400;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 12px 15px;
  text-align: left;
  font-size: 0.8em;
  border-bottom: 1px solid var(--ink);
}

td {
  padding: 10px 15px;
  border-bottom: 1px solid var(--rule);
  font-size: 0.9em;
  color: var(--ink);
}

tr:hover {
  background: rgba(var(--accent-rgb), 0.05);
}

tr:last-child td {
  border-bottom: none;
}

.stat-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 2px;
  font-weight: 600;
  font-size: 0.85em;
}

/* Ink stamps: tinted ground, hairline frame — no pill gradients */
.winrate-badge {
  background: rgba(var(--accent-rgb), 0.1);
  border: 1px solid rgba(var(--accent-rgb), 0.5);
  color: var(--oxblood);
}

.attend-badge {
  background: rgba(31, 95, 91, 0.1);
  border: 1px solid rgba(31, 95, 91, 0.5);
  color: var(--teal-ink);
}
</style>
