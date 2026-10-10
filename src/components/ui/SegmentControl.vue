<template>
  <div
    class="segment-control"
    :role="role"
    :aria-label="ariaLabel || undefined"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="segment-btn"
      :class="{ active: opt.value === modelValue }"
      :role="isTablist ? 'tab' : undefined"
      :aria-selected="isTablist ? opt.value === modelValue : undefined"
      @click="select(opt.value)"
    >
      {{ opt.label }}
      <span v-if="opt.count !== undefined" class="segment-count">{{
        opt.count
      }}</span>
    </button>
  </div>
</template>

<script>
// SegmentControl — 公共分段选择钮：1.5px 墨线框 + active 墨底反白 + hover
// 墨色 5% 洗色 + focus-visible 金叶描边，小字计数（count）可选。收编
// Quiz/CardCodex/QuizBankBrowser/ChallengeSetup 四处逐字重复的
// .type-segment/.type-btn 样式（≤480px 全宽等分的媒体查询一并收编于此）。
// role 由使用方按语义给：'group'（一般分段）/ 'tablist'（Quiz 页签条，
// 此时选项钮自动带 role="tab" + aria-selected）；不传则无 role。
export default {
  name: 'SegmentControl',
  props: {
    // [{ value, label, count? }]
    options: { type: Array, required: true },
    modelValue: { type: [String, Number], default: null },
    ariaLabel: { type: String, default: '' },
    role: { type: String, default: undefined },
  },
  emits: ['update:modelValue'],
  computed: {
    isTablist() {
      return this.role === 'tablist';
    },
  },
  methods: {
    select(value) {
      this.$emit('update:modelValue', value);
    },
  },
};
</script>

<style scoped>
.segment-control {
  display: inline-flex;
  flex-wrap: wrap;
  border: 1.5px solid var(--ink);
  border-radius: 2px;
  overflow: hidden;
}

.segment-btn {
  min-height: 40px;
  padding: 0 var(--space-4);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-type);
  font-size: var(--type-body);
  color: var(--ink-faded);
  background: transparent;
  border: none;
  border-right: 1px solid var(--rule);
  cursor: pointer;
  transition:
    color 0.25s,
    background-color 0.25s;
}

.segment-btn:last-child {
  border-right: none;
}

.segment-btn:hover {
  color: var(--ink);
  background: rgba(var(--ink-rgb), 0.05);
}

.segment-btn.active {
  background: var(--ink);
  color: var(--paper-light);
}

.segment-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: -2px;
}

.segment-count {
  /* 无 opacity：0.7 叠 paper 底对比度仅约 2.8:1，继承 token 色即可过 AA */
  font-size: var(--type-caption);
}

/* ≤480px 全宽等分：原四处重复的断点规则收编于此 */
@media (max-width: 480px) {
  .segment-control {
    display: flex;
    width: 100%;
  }

  .segment-btn {
    flex: 1;
    justify-content: center;
    padding: 0 var(--space-2);
  }
}
</style>
