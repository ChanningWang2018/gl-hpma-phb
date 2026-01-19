<template>
  <div class="data-table">
    <h3>Detailed Data</h3>
    <br>
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
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

th {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px;
  text-align: left;
  font-weight: 600;
  font-size: 0.95em;
}

td {
  padding: 12px 15px;
  border-bottom: 1px solid #e9ecef;
  font-size: 0.9em;
}

tr:hover {
  background: #f8f9fa;
}

tr:last-child td {
  border-bottom: none;
}

.stat-badge {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.85em;
}

.winrate-badge {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}

.attend-badge {
  background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%);
  color: white;
}
</style>
