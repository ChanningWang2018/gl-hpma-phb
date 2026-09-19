<template>
  <header>
    <p v-if="datelineText" :key="datelineText" class="dateline">
      <span class="dateline-text">{{ datelineText }}</span>
    </p>
    <h1 class="masthead">{{ headerContent.title }}</h1>
    <p class="tagline">{{ headerContent.subtitle }}</p>
    <nav class="nav-tabs">
      <router-link to="/" class="nav-tab" exact>Analytics</router-link>
      <router-link to="/sales-optimizer" class="nav-tab">Sales Optimizer</router-link>
      <router-link to="/resources" class="nav-tab">Other Resources</router-link>
    </nav>
  </header>
</template>

<script>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useChartStore } from '@/stores/chartStore.js';

export default {
  name: 'Header',
  setup() {
    const route = useRoute();
    const chartStore = useChartStore();

    const headerContent = computed(() => {
      const subtitles = {
        'analytics': 'Data that matters (not really)',
        'sales-optimizer': 'Math without tears',
        'resources': 'Borrowed wisdom'
      };
      return {
        title: 'my little hpma bits',
        subtitle: subtitles[route.name] || 'Data that matters (not really)'
      };
    });

    // Edition number = manifest count; dateline = the real current period.
    const datelineText = computed(() => {
      if (!chartStore.currentPeriod) return '';
      const edition = chartStore.periods.length
        ? `No. ${chartStore.periods.length} · `
        : '';
      return `${edition}${chartStore.currentPeriod}`;
    });

    return { headerContent, datelineText };
  }
}
</script>

<style scoped>
header {
  padding: 34px 30px 26px;
  text-align: center;
  border-bottom: 3px double var(--ink);
}

.dateline {
  font-family: var(--font-type);
  font-size: 13px;
  letter-spacing: 0.12em;
  color: var(--ink-faded);
  width: fit-content;
  margin: 0 auto 12px;
  white-space: nowrap;
  overflow: hidden;
  animation: dateline-type 1.4s steps(44) 0.2s both;
}

/* The telegraph key stays on the paper after typing */
.dateline::after {
  content: "";
  display: inline-block;
  width: 7px;
  height: 1.05em;
  margin-left: 3px;
  vertical-align: -0.18em;
  background: var(--oxblood);
  animation: dateline-caret 1.06s linear infinite;
}

@keyframes dateline-type {
  from { width: 0; }
  to { width: 100%; }
}

@keyframes dateline-caret {
  0%, 45% { opacity: 1; }
  50%, 95% { opacity: 0; }
  100% { opacity: 1; }
}

.masthead {
  font-family: var(--font-blackletter);
  font-weight: 400;
  font-size: clamp(40px, 6vw, 64px);
  line-height: 1.05;
  color: var(--ink);
  letter-spacing: 1px;
  /* Letterpress impression */
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 3px rgba(42, 33, 24, 0.28);
  /* The plate is loose: slow drift with a hint of rotation */
  animation: masthead-drift 6.5s 1.2s ease-in-out infinite alternate;
}

@keyframes masthead-drift {
  from { transform: translate(0, 0) rotate(0deg); }
  to { transform: translate(2.6px, -1.8px) rotate(0.22deg); }
}

.tagline {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 15px;
  color: var(--ink-faded);
  margin: 10px 0 22px;
}

.nav-tabs {
  display: flex;
  justify-content: center;
  gap: 34px;
}

.nav-tab {
  font-family: var(--font-type);
  font-size: 14px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--ink-faded);
  padding: 4px 2px;
  border-bottom: 2px solid transparent;
  transition: color 0.25s, border-color 0.25s;
}

.nav-tab:hover {
  color: var(--ink);
}

/* Active section: gold-leaf underline */
.nav-tab.router-link-active {
  color: var(--ink);
  border-bottom-color: var(--gold-leaf);
}

@media (max-width: 768px) {
  header {
    padding: 24px 15px 20px;
  }

  .masthead {
    font-size: clamp(30px, 8vw, 44px);
  }

  .nav-tabs {
    gap: 18px;
  }
}

@media (max-width: 480px) {
  .nav-tabs {
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }
}
</style>
