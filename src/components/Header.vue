<template>
  <header>
    <h1>HPMA Echo Data Visualization</h1>
    <p>Visualizing win rate and pick rate changes for different echoes across periods</p>
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
