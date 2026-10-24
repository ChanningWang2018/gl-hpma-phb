<template>
  <footer class="site-footer" lang="en">
    <div class="footer-inner">
      <div class="footer-brand">
        <RouterLink class="footer-mark" to="/">my little hpma bits</RouterLink>
        <p class="footer-note">An unofficial, non-commercial fan project.</p>
      </div>

      <nav class="footer-nav" aria-label="Footer">
        <RouterLink to="/analytics">Data</RouterLink>
        <RouterLink to="/cards">Cards</RouterLink>
        <RouterLink to="/echoes">Echoes</RouterLink>
        <RouterLink to="/sales-optimizer">Optimizer</RouterLink>
        <RouterLink to="/quiz">Quiz</RouterLink>
        <RouterLink to="/resources">Library</RouterLink>
        <RouterLink to="/methodology">Methodology</RouterLink>
        <RouterLink to="/changelog">Changelog</RouterLink>
      </nav>
    </div>

    <div class="footer-legal">
      <span>Card art, game text and statistics © NetEase / Warner Bros.</span>
      <span>Not affiliated with or endorsed by either.</span>
    </div>
  </footer>
</template>

<script>
import { RouterLink } from 'vue-router';

// SiteFooter — 纸色页脚，全站共用。刻意不列数据源：页面只保留版权与
// 非官方声明，来源留在工程文档里。
export default {
  name: 'SiteFooter',
  components: { RouterLink },
};
</script>

<style scoped>
.site-footer {
  padding: 32px clamp(15px, 4.4vw, 56px) 28px;
  border-top: 1px solid var(--rule);
  background: var(--paper-light);
}

.footer-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
}

.footer-brand {
  min-width: 0;
}

.footer-mark {
  font-family: var(--font-blackletter);
  font-size: 25px;
  line-height: 1;
  color: var(--ink);
  text-decoration: none;
}

.footer-note {
  margin-top: 7px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--ink-faded);
}

.footer-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding-top: 6px;
}

.footer-nav a {
  font-family: var(--font-type);
  font-size: 8.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-faded);
  text-decoration: none;
}

.footer-nav a:hover {
  color: var(--ink);
}

.footer-legal {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 18px;
  margin-top: 24px;
  padding-top: 13px;
  border-top: 1px solid var(--rule);
  font-family: var(--font-type);
  font-size: 8px;
  line-height: 1.5;
  letter-spacing: 0.08em;
  color: var(--ink-faded);
}

@media (max-width: 768px) {
  .footer-inner {
    flex-direction: column;
    gap: 18px;
  }

  .footer-legal {
    flex-direction: column;
    gap: 6px;
  }
}
</style>
