<template>
  <header class="page-head">
    <div class="page-head-row">
      <div class="page-head-title">
        <slot />
      </div>
      <div v-if="$slots.meta" class="page-head-meta">
        <slot name="meta" />
      </div>
    </div>
    <div v-if="$slots.note" class="page-head-note">
      <slot name="note" />
    </div>
  </header>
</template>

<script>
// PageHead — 公共页头：3px double 墨线压底的栏目标题区，收编 Quiz 与
// CardCodex 两份逐字拷贝的头部 markup/样式。插槽分工：
//   默认     = 标题区（h1.page-title，内含 .page-title-zh 双语副题 span）
//   #meta    = 标题行右侧控件位（LocaleSwitch）
//   #note    = 标题行下说明行（数据说明 + 版本徽章等）
// ≤768px 移动端压缩：标题 clamp 降到 20px 下限、标题与 meta 同行不折行，
// note 行保留；桌面（≥769）与原双页头视觉等价。
export default {
  name: 'PageHead',
};
</script>

<style scoped>
.page-head {
  border-bottom: 3px double var(--ink);
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-4);
}

.page-head-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.page-head-title :slotted(.page-title) {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: clamp(26px, 4vw, 36px);
  color: var(--ink);
  line-height: 1.15;
}

.page-head-title :slotted(.page-title-zh) {
  font-family: var(--font-sans);
  font-size: 0.55em;
  color: var(--ink-faded);
  margin-left: var(--space-2);
  letter-spacing: 0.2em;
}

.page-head-note {
  margin-top: var(--space-2);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--ink-faded);
}

/* ---- 移动端压缩：标题降档 + 标题/meta 同行不折行 ---- */
@media (max-width: 768px) {
  .page-head-row {
    flex-wrap: nowrap;
    gap: var(--space-2);
  }

  .page-head-title :slotted(.page-title) {
    font-size: clamp(20px, 5vw, 26px);
  }

  .page-head-title :slotted(.page-title-zh) {
    margin-left: var(--space-1);
  }
}
</style>
