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
      required: true,
    },
    containerClass: {
      type: String,
      default: '',
    },
  },
};
</script>

<style scoped>
.chart-wrapper {
  background: transparent;
  border-top: 3px double var(--ink);
  border-radius: 0;
  padding: 18px 10px 12px;
}

.chart-wrapper h3 {
  margin-bottom: 18px;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 1.25em;
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
    padding: 14px 8px 10px;
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
    padding: 12px 6px 8px;
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
