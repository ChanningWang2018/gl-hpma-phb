<template>
  <div ref="sentinel" class="header-sentinel" aria-hidden="true"></div>
  <header lang="en" class="site-header" :class="{ 'is-stuck': isStuck }">
    <div class="header-inner">
      <RouterLink class="brand" to="/">my little hpma bits</RouterLink>

      <nav class="nav" aria-label="Sections">
        <RouterLink class="nav-link" to="/analytics">Data</RouterLink>
        <RouterLink class="nav-link" to="/cards">Cards</RouterLink>
        <RouterLink class="nav-link" to="/sales-optimizer"
          >Optimizer</RouterLink
        >
        <RouterLink class="nav-link" to="/quiz">Quiz</RouterLink>
        <RouterLink class="nav-link" to="/resources">Library</RouterLink>
      </nav>

      <div class="controls">
        <SearchOverlay />
        <LocaleSwitch tone="paper" />
      </div>
    </div>
  </header>
</template>

<script>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import LocaleSwitch from '@/components/LocaleSwitch.vue';
import SearchOverlay from '@/components/SearchOverlay.vue';

// SiteHeader — 全站唯一的顶栏，纸色一版到底。滚动后出现一层很轻的阴影。
// 栏目里没有 "Home"：品牌字标就是回到头版的入口。
export default {
  name: 'SiteHeader',
  components: { LocaleSwitch, RouterLink, SearchOverlay },
  setup() {
    const sentinel = ref(null);
    const isStuck = ref(false);
    let observer = null;

    onMounted(() => {
      if (!('IntersectionObserver' in window) || !sentinel.value) return;
      observer = new IntersectionObserver(
        ([entry]) => {
          isStuck.value = !entry.isIntersecting;
        },
        { threshold: 0 },
      );
      observer.observe(sentinel.value);
    });

    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = null;
    });

    return { sentinel, isStuck };
  },
};
</script>

<style scoped>
.header-sentinel {
  height: 0;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 60;
  background: rgba(var(--paper-light-rgb), 0.94);
  border-bottom: 1px solid var(--rule);
  backdrop-filter: blur(8px);
  transition:
    background 0.25s,
    border-color 0.25s,
    box-shadow 0.25s;
}

.site-header.is-stuck {
  box-shadow: 0 10px 26px rgba(var(--ink-rgb), 0.12);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: clamp(16px, 2.4vw, 32px);
  height: 64px;
  padding: 0 clamp(15px, 4.4vw, 56px);
}

.brand {
  flex: none;
  font-family: var(--font-blackletter);
  font-size: 21px;
  line-height: 1;
  color: var(--ink);
  white-space: nowrap;
  text-decoration: none;
  padding-bottom: 2px;
}

.nav {
  display: flex;
  flex: 1;
  gap: clamp(14px, 2vw, 28px);
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav::-webkit-scrollbar {
  display: none;
}

.nav-link {
  position: relative;
  padding: 4px 0;
  font-family: var(--font-type);
  font-size: 9.5px;
  line-height: 1.5;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faded);
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.2s;
}

.nav-link::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: transparent;
  transition: background 0.2s;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--ink);
}

.nav-link:hover::after,
.nav-link.router-link-active::after {
  background: var(--gold-leaf);
}

.controls {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
}

@media (max-width: 768px) {
  .header-inner {
    flex-wrap: wrap;
    height: auto;
    gap: 3px 12px;
    padding-top: 9px;
    padding-bottom: 0;
  }

  .brand {
    order: 1;
    font-size: 18px;
  }

  .controls {
    order: 2;
    margin-left: auto;
  }

  .nav {
    order: 3;
    flex-basis: 100%;
    width: 100%;
    gap: 18px;
    padding: 6px 0;
    border-top: 1px solid var(--rule);
  }

  .nav-link {
    font-size: 9px;
  }
}
</style>
