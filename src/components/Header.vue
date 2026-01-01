<template>
  <header>
    <h1>HPMA回响数据可视化</h1>
    <p>可视化展示不同时期回响的胜率与登场率变化</p>
  </header>
</template>

<script>
export default {
  name: 'Header'
}
</script>

<style scoped>
header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  text-align: center;
}

header h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

header p {
  font-size: 1.1em;
  opacity: 0.9;
}

@media (max-width: 768px) {
  header h1 {
    font-size: 1.8em;
  }
}
</style>
