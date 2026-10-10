<template>
  <button type="button" class="press-btn" :class="`press-btn--${variant}`">
    <slot />
  </button>
</template>

<script>
// PressButton — 公共按压按钮：primary（牛血底反白主按钮，44px 触控高，
// 收编原 .primary-btn 与 Quiz/CardCodex 的 .retry-btn——两者同底色仅差
// 档位）与 ghost（透明底 --rule 细线次按钮，hover 走牛血，同 reveal-btn/
// pager-btn 的既有次按钮语言）。type/disabled/aria-* 等 attrs 经 Vue3
// attrs 继承透传到根 button，class 自动合并；默认 type="button" 可被
// 使用方覆盖。
export default {
  name: 'PressButton',
  props: {
    variant: {
      type: String,
      default: 'primary',
      validator: (value) => ['primary', 'ghost'].includes(value),
    },
  },
};
</script>

<style scoped>
.press-btn {
  min-height: 44px;
  padding: 0 var(--space-5);
  font-family: var(--font-type);
  font-size: var(--type-body);
  letter-spacing: 0.06em;
  color: var(--paper-light);
  background: var(--oxblood);
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: background-color 0.25s;
}

.press-btn:hover {
  background: var(--ink);
}

.press-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 2px;
}

.press-btn--ghost {
  color: var(--ink);
  background: transparent;
  border: 1px solid var(--rule);
  transition:
    color 0.25s,
    border-color 0.25s;
}

.press-btn--ghost:hover {
  color: var(--oxblood);
  border-color: var(--oxblood);
  background: transparent;
}
</style>
