<template>
  <div class="chart-wrapper">
    <h3>{{ title }}</h3>
    <div class="chart-container" :class="containerClass">
      <slot></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChartWrapper',
  props: {
    title: {
      type: String,
      required: true
    },
    containerClass: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
.chart-wrapper {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.chart-wrapper h3 {
  margin-bottom: 20px;
  color: #495057;
  font-size: 1.3em;
  text-align: center;
}

.chart-container {
  position: relative;
  height: 500px;
}

.chart-container.scatter-chart-container {
  position: relative;
  height: 600px;
}
</style>
