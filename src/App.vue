<template>
  <a class="skip-link" href="#main">Skip to content</a>

  <div class="container">
    <SiteHeader />

    <main id="main">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>

    <SiteFooter />
  </div>
</template>

<script>
import { watch } from 'vue';
import SiteFooter from '@/components/site/SiteFooter.vue';
import SiteHeader from '@/components/site/SiteHeader.vue';
import { useLocaleStore } from '@/stores/localeStore.js';

export default {
  name: 'App',
  components: {
    SiteFooter,
    SiteHeader,
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

<style scoped>
.skip-link {
  position: fixed;
  left: -9999px;
  top: 0;
  z-index: 1000;
  padding: 10px 16px;
  background: var(--ink);
  color: var(--paper-light);
  font-family: var(--font-type);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-decoration: none;
}

.skip-link:focus {
  left: 12px;
  top: 12px;
}

/* The page body is a single landmark; pages provide their own headings. */
main {
  display: block;
}
</style>
