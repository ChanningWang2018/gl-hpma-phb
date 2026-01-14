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
  padding: 30px;
  background: #f8f9fa;
  border-bottom: 2px solid #e9ecef;
}

.control-group {
  margin-bottom: 25px;
}

.control-group:last-child {
  margin-bottom: 0;
}

.control-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 10px;
  color: #495057;
  font-size: 1.1em;
}

select {
  width: 100%;
  max-width: 400px;
  padding: 12px 15px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 1em;
  background: white;
  cursor: pointer;
  transition: all 0.3s;
}

select:hover {
  border-color: #667eea;
}

select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.mode-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.mode-btn {
  flex: 1;
  min-width: 150px;
  padding: 12px 20px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  background: white;
  font-size: 1em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  color: #495057;
}

.mode-btn:hover {
  background: #f0f0f0;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.mode-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

@media (max-width: 768px) {
  .mode-toggles {
    flex-direction: column;
  }
}
</style>
