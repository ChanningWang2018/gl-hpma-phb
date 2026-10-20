<template>
  <div class="cover-copy">
    <p class="kicker">
      Vol. IV · Issue No. {{ editionLabel }} · <b>{{ rangeLabel }}</b>
    </p>

    <h1 id="cover-title" class="wordmark">my little hpma bits</h1>

    <div class="ornament" aria-hidden="true">
      <span></span>
      <i></i>
      <span></span>
    </div>

    <p class="tagline">
      Weekly statistics, card data and quiz drills for<br
        class="tagline-break"
      />
      Harry Potter: Magic Awakened.
    </p>

    <div class="actions">
      <RouterLink class="btn btn-primary" to="/analytics">
        This week's data
        <span class="arrow" aria-hidden="true">→</span>
      </RouterLink>
      <RouterLink class="btn btn-ghost" to="/cards">Card codex</RouterLink>
    </div>

    <p class="hero-note">
      Unofficial fan project · data through {{ dataThrough }}
    </p>
  </div>
</template>

<script>
import { RouterLink } from 'vue-router';

// CoverHero — 封面文案块（深墨底上的期号、报头字、金色饰线、一句定位、
// 两个入口、一行状态）。背景/留白由 Home 的 .cover 壳负责，这里只管
// 文案与字阶。期号或日期缺失（加载中 / 加载失败）时统一显示 ——，版式
// 不跳动。dataThrough 从区间标签里取末日：'24–30 Sep 2026' -> '30 Sep
// 2026'，跨月 '28 Sep – 04 Oct 2026' 同理。
export default {
  name: 'CoverHero',
  components: { RouterLink },
  props: {
    // Issue number (periods.length); null while loading
    edition: { type: Number, default: null },
    // Full range label, e.g. '24–30 Sep 2026'
    periodLabel: { type: String, default: '' },
  },
  computed: {
    editionLabel() {
      return this.edition ?? '—';
    },
    rangeLabel() {
      return this.periodLabel || '—';
    },
    // The plate covers up to the last day of the range
    dataThrough() {
      if (!this.periodLabel) return '—';
      const parts = this.periodLabel.split(/[–-]/);
      return (parts[parts.length - 1] || '').trim() || '—';
    },
  },
};
</script>

<style scoped>
.cover-copy {
  text-align: center;
  color: var(--cream);
}

.kicker {
  font-family: var(--font-type);
  font-size: 9px;
  line-height: 1.5;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--cream-muted);
}

.kicker b {
  font-weight: 400;
  color: var(--gold);
}

.wordmark {
  margin: 16px 0 0;
  font-family: var(--font-blackletter);
  font-size: clamp(56px, 7.4vw, 104px);
  font-weight: 400;
  line-height: 0.94;
  letter-spacing: 0.5px;
  color: var(--cream);
  text-wrap: balance;
  text-shadow:
    0 1px 0 rgba(var(--ink-rgb), 0.55),
    0 10px 46px rgba(var(--gold-rgb), 0.16);
  animation: settle 0.9s ease-out both;
}

@keyframes settle {
  from {
    opacity: 0;
    transform: translateY(-10px);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}

.ornament {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 18px;
}

.ornament span {
  width: clamp(40px, 6vw, 78px);
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-line));
}

.ornament span:last-child {
  background: linear-gradient(90deg, var(--gold-line), transparent);
}

.ornament i {
  display: block;
  width: 6px;
  height: 6px;
  background: var(--gold);
  transform: rotate(45deg);
  opacity: 0.85;
}

.tagline {
  max-width: 640px;
  margin: 18px auto 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: clamp(16px, 1.45vw, 19px);
  line-height: 1.55;
  color: var(--cream-muted);
  text-wrap: balance;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 26px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 46px;
  padding: 0 24px;
  border: 1px solid transparent;
  font-family: var(--font-type);
  font-size: 10px;
  line-height: 1;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-decoration: none;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s;
}

.btn .arrow {
  transition: transform 0.2s;
}

.btn:hover .arrow {
  transform: translateX(3px);
}

.btn-primary {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--cover);
}

.btn-primary:hover {
  background: var(--cream);
  border-color: var(--cream);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--cream);
  outline-offset: 3px;
}

.btn-ghost {
  color: var(--cream);
  border-color: var(--gold-line);
}

.btn-ghost:hover {
  border-color: var(--cream);
}

.btn-ghost:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}

.hero-note {
  margin-top: 14px;
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--cream-muted);
  opacity: 0.7;
}

@media (max-width: 768px) {
  .wordmark {
    font-size: clamp(46px, 13vw, 66px);
  }

  .tagline {
    padding: 0 6px;
    font-size: 15.5px;
  }

  .tagline-break {
    display: none;
  }

  .actions {
    margin-top: 22px;
  }

  .btn {
    height: 44px;
    padding: 0 18px;
  }
}

@media (max-width: 480px) {
  .actions {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 0 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wordmark {
    animation: none;
  }

  .btn,
  .btn .arrow {
    transition: none;
  }
}
</style>
