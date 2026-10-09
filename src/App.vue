<template>
  <div class="container">
    <Header />
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script>
import { watch } from 'vue';
import Header from '@/components/Header.vue';
import { useLocaleStore } from '@/stores/localeStore.js';

export default {
  name: 'App',
  components: {
    Header,
  },
  setup() {
    // <html lang> 跟随全站语言（localeStore 为唯一语言来源），立即写一次初始值
    const localeStore = useLocaleStore();
    watch(
      () => localeStore.locale,
      (value) => {
        document.documentElement.lang = value;
      },
      { immediate: true },
    );
  },
};
</script>
