<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-overlay" @click.self="$emit('close')">
        <section
          class="sheet-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="t('filters')"
        >
          <header class="sheet-head">
            <h3 class="sheet-title">{{ t('filters') }}</h3>
            <button
              ref="closeBtn"
              type="button"
              class="sheet-close"
              :aria-label="t('closeFilters')"
              @click="$emit('close')"
            >
              ×
            </button>
          </header>

          <!-- 筛选控件直写 store（与桌面横排工具栏同一响应式事实源）：
               即时生效，「应用」只负责关闭抽屉 -->
          <div class="sheet-body">
            <SegmentControl
              role="group"
              :aria-label="t('filterByType')"
              :options="cardStore.typeOptions"
              :model-value="cardStore.filters.type"
              @update:model-value="setType"
            />

            <label class="sheet-field">
              <span class="field-label">{{ t('labelRarity') }}</span>
              <select v-model="rarityModel">
                <option
                  v-for="opt in cardStore.rarityOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}（{{ opt.count }}）
                </option>
              </select>
            </label>

            <label class="sheet-field">
              <span class="field-label">{{ t('labelCost') }}</span>
              <select v-model="costModel">
                <option
                  v-for="opt in cardStore.costOptions"
                  :key="String(opt.value)"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </label>
          </div>

          <footer class="sheet-footer">
            <!-- 命中行从移动端工具栏移入此处；筛选即时生效，行内数字实时刷新 -->
            <p class="sheet-hit" role="status">
              {{
                t('hitLine', {
                  shown: cardStore.filteredCards.length,
                  total: cardStore.totalCards,
                })
              }}
            </p>
            <div class="sheet-actions">
              <!-- 重置：type/rarity/cost/search 全归 store 初始态；
                   search 清空经 CardCodex 的 watch 同步回输入框 -->
              <PressButton variant="ghost" @click="resetFilters">
                {{ t('resetFilters') }}
              </PressButton>
              <PressButton variant="primary" @click="$emit('close')">
                {{ t('applyFilters') }}
              </PressButton>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
// CardFilterSheet — 卡牌图鉴移动端筛选抽屉（≤768px 由 CardCodex 的
// 「筛选」chip 唤起）。交互范式收编自 CardDetail.vue：Teleport 到 body、
// overlay 点击关闭、Esc 关闭、body 滚动锁、关闭焦点归还触发钮、
// transform/opacity ≤200ms 进出场、prefers-reduced-motion 下关闭动画。
// 差异点：开关状态由父视图持有（open prop + close 事件），不进 store——
// 只有本页会打开它，且 keep-alive 切页时父视图在 deactivated 里负责关闭。
import { nextTick } from 'vue';
import PressButton from '@/components/ui/PressButton.vue';
import SegmentControl from '@/components/ui/SegmentControl.vue';
import { translate } from '@/services/codexLocale.js';
import { useCardStore } from '@/stores/cardStore.js';

export default {
  name: 'CardFilterSheet',
  components: { PressButton, SegmentControl },
  props: {
    open: { type: Boolean, default: false },
  },
  emits: ['close'],
  setup() {
    const cardStore = useCardStore();
    return { cardStore };
  },
  data() {
    return {
      // 打开前的焦点元素（关闭时归还给 chip 钮）与 body 原始 overflow 值
      lastFocused: null,
      prevBodyOverflow: null,
    };
  },
  computed: {
    rarityModel: {
      get() {
        return this.cardStore.filters.rarity;
      },
      set(value) {
        this.cardStore.setFilter({ rarity: value });
      },
    },
    costModel: {
      get() {
        return this.cardStore.filters.cost;
      },
      set(value) {
        this.cardStore.setFilter({ cost: value });
      },
    },
  },
  watch: {
    open(value, oldValue) {
      if (value && !oldValue) {
        this.onOpen();
      } else if (!value && oldValue) {
        this.onClose();
      }
    },
  },
  mounted() {
    // 兜底：组件挂载时抽屉已被打开（正常流程由上方 watch 驱动）
    if (this.open) this.onOpen();
  },
  beforeUnmount() {
    // 路由离开等场景下抽屉仍开着：解除监听与 body 滚动锁定
    this.teardownModal();
  },
  methods: {
    // 词典查找：读取 store.locale，切换语言即时生效
    t(key, params) {
      return translate(this.cardStore.locale, key, params);
    },

    setType(value) {
      this.cardStore.setFilter({ type: value });
    },

    // 全部归默认（cardStore.filters 初始态口径）；search 的输入框投影
    // 与未落地防抖由 CardCodex 对 filters.search 的 watch 收尾
    resetFilters() {
      this.cardStore.setFilter({
        type: 'all',
        rarity: 'all',
        cost: 'all',
        search: '',
      });
    },

    // ---- 打开/关闭的浏览器侧副作用（同 CardDetail；SSR 下不会执行） ----
    onOpen() {
      this.lastFocused =
        typeof document !== 'undefined' ? document.activeElement : null;
      if (typeof document === 'undefined') return;
      this.prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Esc 关闭：监听只在抽屉打开期间挂载
      document.addEventListener('keydown', this.onKeydown);
      // 焦点移入抽屉（× 钮）
      nextTick(() => {
        this.$refs.closeBtn?.focus();
      });
    },
    onClose() {
      this.teardownModal();
      if (this.lastFocused && typeof this.lastFocused.focus === 'function') {
        this.lastFocused.focus();
      }
      this.lastFocused = null;
    },
    teardownModal() {
      if (typeof document === 'undefined') return;
      document.removeEventListener('keydown', this.onKeydown);
      if (this.prevBodyOverflow !== null) {
        document.body.style.overflow = this.prevBodyOverflow;
        this.prevBodyOverflow = null;
      }
    },
    onKeydown(event) {
      if (event.key === 'Escape') this.$emit('close');
    },
  },
};
</script>

<style scoped>
/* 遮罩：覆盖全屏，点空白处关闭（@click.self）；面板贴底铺满 */
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  background: rgba(var(--ink-rgb), 0.55);
}

.sheet-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 85vh;
  background: var(--paper-light);
  border-top: 1.5px solid var(--ink);
  box-shadow: 0 -12px 40px rgba(var(--ink-rgb), 0.35);
}

/* ---- 头部：标题 + × ---- */
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--rule);
}

.sheet-title {
  font-family: var(--font-type);
  font-weight: 400;
  font-size: var(--type-body);
  letter-spacing: 0.18em;
  color: var(--ink);
}

.sheet-close {
  width: 44px;
  height: 44px;
  margin-right: calc(-1 * var(--space-2));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-type);
  font-size: var(--type-title);
  line-height: 1;
  color: var(--ink);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.25s;
}

.sheet-close:hover {
  color: var(--oxblood);
}

.sheet-close:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 1px;
}

/* ---- 内容区：类型分段 / 稀有度 / 费用，区块节奏统一 --space-4 ---- */
.sheet-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  overflow-y: auto;
}

.sheet-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.12em;
  color: var(--ink-faded);
}

.sheet-field select {
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--type-body);
  color: var(--ink);
  background: var(--paper-light);
  border: 1px solid var(--rule);
  border-radius: 2px;
}

.sheet-field select:focus {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 1px;
}

/* ---- footer：命中行 + 重置/应用双钮 ---- */
.sheet-footer {
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-top: 1px solid var(--rule);
}

.sheet-hit {
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.1em;
  color: var(--ink-faded);
}

.sheet-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

/* 双钮等分一行（:deep 穿透 PressButton 的 scoped 根类） */
.sheet-actions :deep(.press-btn) {
  flex: 1;
}

/* ---- 进出场：遮罩淡入淡出 + 抽屉自底滑入，只用 opacity/transform，
        ≤200ms；弱动效偏好下关闭（同 CardDetail） ---- */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.18s ease;
}

.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.18s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .sheet-enter-active,
  .sheet-leave-active,
  .sheet-enter-active .sheet-panel,
  .sheet-leave-active .sheet-panel {
    transition: none;
  }
}
</style>
