<template>
  <div class="container">
    <Header />
    <router-view />
  </div>
</template>

<script>
import Header from '@/components/Header.vue';

export default {
  name: 'App',
  components: {
    Header
  }
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  background: white;
  border-radius: 15px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  overflow: hidden;
}

@media (max-width: 768px) {
  .container {
    border-radius: 10px;
    margin: 0 10px;
  }
}

@media (max-width: 480px) {
  body {
    padding: 10px;
  }

  .container {
    border-radius: 8px;
    margin: 0;
  }
}
</style>
