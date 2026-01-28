<template>
  <header>
    <h1>HPMA Echo Data Visualization</h1>
    <p>Visualizing win rate and pick rate changes for different echoes across periods</p>
    <nav class="nav-tabs">
      <router-link to="/" class="nav-tab" exact>Analytics</router-link>
      <router-link to="/sales-optimizer" class="nav-tab">Sales Optimizer</router-link>
      <router-link to="/resources" class="nav-tab">Other Resources</router-link>
    </nav>
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
  margin-bottom: 25px;
}

.nav-tabs {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
}

.nav-tab {
  padding: 10px 25px;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: white;
  text-decoration: none;
  font-weight: 600;
  font-size: 1em;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
}

.nav-tab:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.nav-tab.router-link-active {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%);
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

@media (max-width: 768px) {
  header h1 {
    font-size: 1.8em;
  }

  header p {
    font-size: 1em;
  }

  .nav-tabs {
    gap: 10px;
    margin-top: 15px;
  }

  .nav-tab {
    padding: 8px 20px;
    font-size: 0.95em;
  }
}

@media (max-width: 480px) {
  header {
    padding: 20px 15px;
  }

  header h1 {
    font-size: 1.5em;
    margin-bottom: 8px;
  }

  header p {
    font-size: 0.95em;
    margin-bottom: 20px;
  }

  .nav-tabs {
    flex-direction: column;
    gap: 8px;
    margin-top: 15px;
  }

  .nav-tab {
    padding: 8px 15px;
    font-size: 0.9em;
  }
}
</style>
