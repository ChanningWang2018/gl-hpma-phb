<template>
  <div class="controls">
    <div class="control-group">
      <label for="reverberation-select">选择回响</label>
      <select id="reverberation-select" :value="currentReverberation" @change="$emit('update:currentReverberation', $event.target.value)">
        <option value="1">赫敏·格兰杰</option>
        <option value="2">哈利·波特</option>
        <option value="3">多比</option>
        <option value="4">鲁伯·海格</option>
        <option value="5">韦斯莱双胞胎</option>
        <option value="6">纽特·斯卡曼德</option>
        <option value="7">西弗勒斯·斯内普</option>
        <option value="8">纳威·隆巴顿</option>
        <option value="9">贝拉·莱斯特兰奇</option>
        <option value="10">卢娜·洛夫古德</option>
        <option value="11">菲利乌斯·弗立维</option>
        <option value="12">小天狼星·布莱克</option>
        <option value="13">罗恩·韦斯莱</option>
        <option value="14">金妮·韦斯莱</option>
        <option value="15">阿不思·邓布利多</option>
        <option value="16">米勒娃·麦格</option>
        <option value="17">伏地魔</option>
        <option value="18">塞德里克·迪戈里</option>
      </select>
    </div>

    <div class="control-group">
      <label>选择模式</label>
      <div class="mode-toggles">
        <button 
          class="mode-btn" 
          :class="{ active: currentMode === '1v1-low' }"
          @click="$emit('set-mode', '1v1-low')"
          data-mode="1v1-low"
        >
          1v1: 7500分以下
        </button>
        <button 
          class="mode-btn" 
          :class="{ active: currentMode === '1v1-high' }"
          @click="$emit('set-mode', '1v1-high')"
          data-mode="1v1-high"
        >
          1v1: 7500分以上
        </button>
        <button 
          class="mode-btn" 
          :class="{ active: currentMode === '2v2-low' }"
          @click="$emit('set-mode', '2v2-low')"
          data-mode="2v2-low"
        >
          2v2: 7500分以下
        </button>
        <button 
          class="mode-btn" 
          :class="{ active: currentMode === '2v2-high' }"
          @click="$emit('set-mode', '2v2-high')"
          data-mode="2v2-high"
        >
          2v2: 7500分以上
        </button>
      </div>
    </div>

    <div class="control-group">
      <label for="period-select">选择时期</label>
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
    currentReverberation: {
      type: [String, Number],
      required: true
    },
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
  emits: ['update:currentReverberation', 'update:currentPeriod', 'set-mode']
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

.control-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 10px;
  color: #495057;
  font-size: 1.1em;
}

select {
  width: 100%;
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
