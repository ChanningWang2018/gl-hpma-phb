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

@media (max-width: 768px) {
  .chart-wrapper {
    padding: 15px;
    border-radius: 8px;
  }

  .chart-wrapper h3 {
    margin-bottom: 12px;
    font-size: 1.1em;
  }

  .chart-container {
    height: 350px;
  }

  .chart-container.scatter-chart-container {
    height: 400px;
  }
}

@media (max-width: 480px) {
  .chart-wrapper {
    padding: 12px;
  }

  .chart-wrapper h3 {
    margin-bottom: 10px;
    font-size: 1em;
  }

  .chart-container {
    height: 300px;
  }

  .chart-container.scatter-chart-container {
    height: 350px;
  }
}
</style>
