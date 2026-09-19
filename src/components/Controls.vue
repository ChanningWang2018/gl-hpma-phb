<template>
  <div class="controls">
    <div class="control-group">
      <label>Select Mode</label>
      <div class="mode-toggles">
        <button 
          class="mode-btn" 
          :class="{ active: currentMode === '1v1-low' }"
          @click="$emit('set-mode', '1v1-low')"
          data-mode="1v1-low"
        >
          1v1: Below 7500
        </button>
        <button 
          class="mode-btn" 
          :class="{ active: currentMode === '1v1-high' }"
          @click="$emit('set-mode', '1v1-high')"
          data-mode="1v1-high"
        >
          1v1: Above 7500
        </button>
        <button 
          class="mode-btn" 
          :class="{ active: currentMode === '2v2-low' }"
          @click="$emit('set-mode', '2v2-low')"
          data-mode="2v2-low"
        >
          2v2: Below 7500
        </button>
        <button 
          class="mode-btn" 
          :class="{ active: currentMode === '2v2-high' }"
          @click="$emit('set-mode', '2v2-high')"
          data-mode="2v2-high"
        >
          2v2: Above 7500
        </button>
      </div>
    </div>

    <div class="control-group">
      <label for="period-select">Select Period</label>
      <select id="period-select" :value="currentPeriod" @change="$emit('update:currentPeriod', $event.target.value)">
        <option v-for="period in periods" :key="period" :value="period">
          {{ period }}
        </option>
      </select>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Controls',
  props: {
    currentMode: {
      type: String,
      required: true
    },
    currentPeriod: {
      type: [String, Number],
      required: true
    },
    periods: {
      type: Array,
      required: true
    }
  },
  emits: ['update:currentPeriod', 'set-mode']
}
</script>

<style scoped>
.controls {
  padding: 26px 30px;
  background: transparent;
  border-bottom: 1px solid var(--rule);
}

.control-group {
  margin-bottom: 22px;
}

.control-group:last-child {
  margin-bottom: 0;
}

.control-group label {
  display: block;
  font-family: var(--font-type);
  font-weight: 400;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 10px;
  color: var(--ink-faded);
  font-size: 0.85em;
}

select {
  width: 100%;
  max-width: 400px;
  padding: 10px 14px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  font-family: var(--font-type);
  font-size: 0.95em;
  color: var(--ink);
  background: var(--paper-light);
  cursor: pointer;
  transition: border-color 0.25s;
}

select:hover {
  border-color: var(--ink-faded);
}

select:focus {
  outline: none;
  border-color: var(--gold-leaf);
  box-shadow: 0 0 0 2px rgba(176, 141, 63, 0.25);
}

.mode-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.mode-btn {
  flex: 1;
  min-width: 150px;
  padding: 10px 18px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: transparent;
  font-family: var(--font-type);
  font-size: 0.95em;
  font-weight: 400;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.25s, border-color 0.25s, color 0.25s;
  color: var(--ink-faded);
}

.mode-btn:hover {
  background: rgba(var(--accent-rgb), 0.06);
  border-color: var(--ink-faded);
  color: var(--ink);
}

/* Selected mode: oxblood ink stamp */
.mode-btn.active {
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--oxblood);
  border-color: var(--oxblood);
}

@media (max-width: 768px) {
  .controls {
    padding: 18px 15px;
  }

  .mode-toggles {
    flex-direction: column;
  }

  .mode-btn {
    min-width: 100%;
    padding: 10px 15px;
    font-size: 0.95em;
  }
}

@media (max-width: 480px) {
  .controls {
    padding: 15px 12px;
  }

  .control-group {
    margin-bottom: 20px;
  }

  .mode-btn {
    padding: 8px 12px;
    font-size: 0.9em;
  }

  select {
    padding: 10px 12px;
    font-size: 0.9em;
  }
}
</style>
