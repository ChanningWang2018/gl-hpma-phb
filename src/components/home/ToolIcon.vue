<template>
  <svg
    class="tool-icon"
    width="28"
    height="28"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'analytics'">
      <path d="M5 27V5M5 27h22" />
      <circle cx="12" cy="20" r="2.2" />
      <circle cx="19" cy="13" r="2.2" />
      <circle cx="26" cy="8" r="2.2" />
      <path d="M12 20l7-7 7-5" stroke-dasharray="2 3" opacity=".6" />
    </template>

    <template v-else-if="name === 'cards'">
      <rect x="11" y="4" width="13" height="19" rx="1.5" />
      <path d="M7.5 7.5v17A2.5 2.5 0 0 0 10 27h11" />
      <path d="M17.5 9.5l2.6 2.6-2.6 2.6-2.6-2.6z" />
    </template>

    <template v-else-if="name === 'optimizer'">
      <path d="M6 26h20" />
      <path d="M9 26v-7M15.5 26v-12M22 26v-17" />
      <path d="M9 15l6.5-5 6.5-4" stroke-dasharray="2 3" opacity=".6" />
    </template>

    <template v-else-if="name === 'quiz'">
      <path d="M5.5 6.5h21v13.5H14l-5.5 5v-5h-3z" />
      <path d="M13.5 11.6a2.6 2.6 0 1 1 3.6 2.4c-.9.4-1.3 1-1.3 2.1" />
      <circle cx="15.8" cy="18.4" r="0.7" fill="currentColor" stroke="none" />
    </template>

    <template v-else-if="name === 'library'">
      <path
        d="M16 9.2c-3-2-6.6-2.5-10.5-1.5V25c3.9-1 7.5-.5 10.5 1.5 3-2 6.6-2.5 10.5-1.5V7.7C22.6 6.7 19 7.2 16 9.2z"
      />
      <path d="M16 9.2V26" />
    </template>
  </svg>
</template>

<script>
// ToolIcon — 目录五栏共用的 28px 线性图标（1.4px 描边、32 格网格、同一
// 套几何语言，抄自 docs/design/home.html）。纯装饰：父级负责颜色与悬停
// 位移，图标本身 aria-hidden。
export default {
  name: 'ToolIcon',
  props: {
    name: {
      type: String,
      required: true,
      validator: (value) =>
        ['analytics', 'cards', 'optimizer', 'quiz', 'library'].includes(value),
    },
  },
};
</script>

<style scoped>
.tool-icon {
  display: block;
  flex: none;
}
</style>
