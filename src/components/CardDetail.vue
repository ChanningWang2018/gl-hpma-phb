<template>
  <Teleport to="body">
    <Transition name="detail">
      <div v-if="card" class="detail-overlay" @click.self="closeCard">
        <section
          class="detail-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="cardName"
        >
          <button
            ref="closeBtn"
            type="button"
            class="detail-close"
            :aria-label="t('closeDetail')"
            @click="closeCard"
          >
            ×
          </button>

          <div class="detail-body">
            <!-- 左：3:4 大卡面（与网格 tile 共用 CardImage 三级降级链） -->
            <div class="detail-figure">
              <CardImage :card="card" size="detail" />
            </div>

            <!-- 右：档案信息栏 -->
            <div class="detail-info">
              <header class="detail-head">
                <h3 class="detail-name">{{ cardName }}</h3>
                <!-- 副名：另一语言卡名，缺失或与主名相同时不渲染 -->
                <p v-if="secondaryName" class="detail-name-en">
                  {{ secondaryName }}
                </p>
                <p v-if="spellWord" class="detail-spell-word">
                  {{ spellWord }}
                </p>
              </header>

              <div class="detail-badges">
                <span
                  class="badge badge-cost"
                  :title="t('costTitle', { n: card.cost })"
                  >{{ t('costTitle', { n: card.cost }) }}</span
                >
                <span class="badge">{{ typeLabel }}</span>
                <span
                  class="badge badge-rarity"
                  :class="`rarity-${card.rarity}`"
                  >{{ rarityLabel }}</span
                >
              </div>

              <!-- desc 保留原文换行 -->
              <p v-if="desc" class="detail-desc">{{ desc }}</p>

              <!-- quote 引用体例；缺失不渲染 -->
              <blockquote v-if="quote" class="detail-quote">
                {{ quote }}
              </blockquote>

              <div v-if="hasTags" class="detail-tags">
                <span
                  v-for="tag in localizedTags"
                  :key="tag"
                  class="badge badge-tag"
                  >{{ tag }}</span
                >
              </div>

              <!-- 等级数值表：无 levels 的卡整个区块不渲染 -->
              <section
                v-if="levelRows.length"
                class="detail-levels"
                :aria-label="t('levelStatsAria')"
              >
                <h4 class="detail-levels-title">{{ t('levelStats') }}</h4>
                <div class="level-grid">
                  <!-- 等级键不保证连续（如 30 后跳 41）：按实际键分组，空洞如实保留 -->
                  <div
                    v-for="group in levelRows"
                    :key="group.lv"
                    class="level-group"
                  >
                    <p class="level-head">Lv.{{ group.lv }}</p>
                    <!-- schema 2：unit 标记数值所属主体（如召唤物两阶段各自一套属性），
                         同级内按主体分组；无 unit = 卡自身效果，不加小标题 -->
                    <div
                      v-for="(unitGroup, unitIndex) in unitGroups(
                        group.entries,
                      )"
                      :key="unitIndex"
                      class="level-unit-block"
                    >
                      <p v-if="unitGroup.unit" class="level-unit">
                        {{ statUnitLabel(unitGroup) }}
                      </p>
                      <dl class="level-rows">
                        <div
                          v-for="(entry, index) in unitGroup.entries"
                          :key="`${entry.k}-${index}`"
                          class="level-row"
                        >
                          <dt class="level-k">{{ statLabel(entry) }}</dt>
                          <dd class="level-v">
                            {{ displayValue(entry)
                            }}<span v-if="showPct(entry)" class="level-pct"
                              >%</span
                            >
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { nextTick } from 'vue';
import CardImage from '@/components/CardImage.vue';
import { translate, valueLabel } from '@/services/codexLocale.js';
import { lookupLabel } from '@/services/spellbookClient.js';
import { SpellbookService } from '@/services/spellbookService.js';
import { useCardStore } from '@/stores/cardStore.js';

export default {
  name: 'CardDetail',
  components: { CardImage },
  setup() {
    const cardStore = useCardStore();
    return { cardStore };
  },
  data() {
    return {
      // 打开前的焦点元素（关闭时归还给触发控件）与 body 原始 overflow 值
      lastFocused: null,
      prevBodyOverflow: null,
    };
  },
  computed: {
    card() {
      return this.cardStore.selectedCard;
    },
    cardName() {
      // 主名：当前语言优先，缺失回退 zh（lookupText 内置）再回退编号
      return (
        SpellbookService.text(this.card, this.cardStore.locale, 'name') ??
        `No. ${this.card.id}`
      );
    },
    secondaryName() {
      const other = this.cardStore.locale === 'zh' ? 'en' : 'zh';
      const name = SpellbookService.text(this.card, other, 'name');
      return name && name !== this.cardName ? name : '';
    },
    spellWord() {
      return this.card.spell_word || '';
    },
    typeLabel() {
      return lookupLabel(
        this.cardStore.labels,
        'type',
        this.card.type,
        this.cardStore.locale,
      );
    },
    rarityLabel() {
      return lookupLabel(
        this.cardStore.labels,
        'rarity',
        this.card.rarity,
        this.cardStore.locale,
      );
    },
    desc() {
      return SpellbookService.text(this.card, this.cardStore.locale, 'desc');
    },
    quote() {
      return SpellbookService.text(this.card, this.cardStore.locale, 'quote');
    },
    localizedTags() {
      return SpellbookService.tags(this.card, this.cardStore.locale);
    },
    hasTags() {
      return this.localizedTags.length > 0;
    },
    // [{ lv, entries: [{ k, v, pct, unit, display }] }]，等级升序、保留空洞
    levelRows() {
      return SpellbookService.formatLevelRows(this.card);
    },
  },
  watch: {
    card(value, oldValue) {
      if (value && !oldValue) {
        this.onOpen();
      } else if (!value && oldValue) {
        this.onClose();
      }
    },
  },
  mounted() {
    // 兜底：组件挂载时弹层已被打开（正常流程由下方 watch 驱动）
    if (this.card) this.onOpen();
  },
  beforeUnmount() {
    // 路由离开等场景下弹层仍开着：解除监听与 body 滚动锁定
    //（焦点不强制归还——触发它的 tile 很可能已随页面销毁）
    this.teardownModal();
  },
  methods: {
    closeCard() {
      this.cardStore.closeCard();
    },

    // 词典查找：读取 store.locale，切换语言即时生效
    t(key, params) {
      return translate(this.cardStore.locale, key, params);
    },

    // 等级行字段名：en 语言用数据自带的 k_en（缺失回退 zh 原值）
    statLabel(entry) {
      return this.cardStore.locale === 'en' && entry.kEn ? entry.kEn : entry.k;
    },

    // 等级块主体名：unit 的 en 对译（缺失回退 zh 原值）
    statUnitLabel(group) {
      return this.cardStore.locale === 'en' && group.unitEn
        ? group.unitEn
        : group.unit;
    },

    // 数值展示：en 语言对枚举型字符串值（ground/speed_fast 等）做映射，
    // 其余（数字、"40%"、"8×28"）原样；zh 一律原样
    displayValue(entry) {
      return valueLabel(this.cardStore.locale, entry.display);
    },

    // ---- 打开/关闭的浏览器侧副作用（SSR 下不会执行） ----
    onOpen() {
      this.lastFocused =
        typeof document !== 'undefined' ? document.activeElement : null;
      if (typeof document === 'undefined') return;
      this.prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Esc 关闭：监听只在弹层打开期间挂载
      document.addEventListener('keydown', this.onKeydown);
      // 焦点移入弹层（× 按钮）
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
      if (event.key === 'Escape') this.closeCard();
    },

    // pct 是百分比型数值的标记：只对数值行补 %。字符串行按数据原样渲染
    //（如 "40%" 已含百分号、"air&ground" 等目标值也带 pct 标志），
    // 二次加工反而出错——见 formatLevelRows 的数据形状注释。
    showPct(entry) {
      return entry.pct === true && typeof entry.v === 'number';
    },

    // schema 2 的 unit = 数值所属主体：把同级 entries 按 unit 切成连续块，
    // 无 unit（卡自身效果）排在最前、不加小标题；保持数据原顺序。
    // unitEn 取组内首个非空对译（同组 unit 相同，en 对译一致）。
    unitGroups(entries) {
      const groups = [];
      for (const entry of entries) {
        const last = groups[groups.length - 1];
        if (last && last.unit === entry.unit) {
          last.entries.push(entry);
          if (!last.unitEn && entry.unitEn) last.unitEn = entry.unitEn;
        } else {
          groups.push({
            unit: entry.unit,
            unitEn: entry.unitEn,
            entries: [entry],
          });
        }
      }
      // 稳定排序：无 unit 的块（卡自身）置顶，其余按首次出现顺序
      const rank = (group) => (group.unit === null ? 0 : 1);
      return groups.sort((a, b) => rank(a) - rank(b));
    },
  },
};
</script>

<style scoped>
/* 遮罩：覆盖全屏，点击空白处关闭（@click.self） */
.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 20px;
  background: rgba(var(--ink-rgb), 0.55);
}

/* 居中面板：右栏内部滚动，× 与卡面保持可见 */
.detail-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(860px, 100%);
  max-height: min(86vh, 100%);
  background: var(--paper-light);
  border: 1.5px solid var(--ink);
  border-radius: 3px;
  box-shadow: 0 18px 60px rgba(var(--ink-rgb), 0.4);
}

.detail-body {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  gap: 22px;
  padding: 26px;
  overflow: hidden;
}

.detail-figure {
  min-width: 0;
}

.detail-info {
  min-width: 0;
  overflow-y: auto;
  padding-right: 6px;
}

/* ---- 右上角 ×：≥40px 命中区 ---- */
.detail-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-type);
  font-size: 20px;
  line-height: 1;
  color: var(--ink);
  background: var(--paper-light);
  border: 1px solid var(--rule);
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 0.25s,
    border-color 0.25s;
}

.detail-close:hover {
  color: var(--oxblood);
  border-color: var(--oxblood);
}

.detail-close:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 1px;
}

/* ---- 头部：zh 名（衬线大字）+ en 名 + 咒语词 ---- */
.detail-head {
  padding-right: 44px;
}

.detail-name {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: clamp(24px, 3.4vw, 32px);
  color: var(--ink);
  line-height: 1.2;
}

.detail-name-en {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 16px;
  color: var(--ink-faded);
  margin-top: 2px;
}

.detail-spell-word {
  font-family: var(--font-type);
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-faded);
  margin-top: 8px;
}

/* ---- 徽标行：cost / type / rarity（token 色映射）+ tags ---- */
.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.badge {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  font-family: var(--font-type);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--ink);
  background: rgba(var(--ink-rgb), 0.04);
  border: 1px solid var(--rule);
  border-radius: 2px;
}

.badge-cost {
  color: var(--paper-light);
  background: rgba(var(--ink-rgb), 0.88);
  border-color: transparent;
}

.badge-tag {
  background: rgba(var(--gold-rgb), 0.1);
  border-color: rgba(var(--gold-rgb), 0.5);
}

/* rarity 徽标沿用既有 token 映射（与色条/占位卡背同源，浅色 wash + 描边） */
.badge-rarity.rarity-common {
  border-color: var(--rule);
  background: rgba(var(--ink-rgb), 0.06);
}
.badge-rarity.rarity-rare {
  border-color: var(--teal-ink);
  background: rgba(var(--teal-rgb), 0.1);
}
.badge-rarity.rarity-epic {
  border-color: var(--violet-ink);
  background: rgba(var(--violet-rgb), 0.1);
}
.badge-rarity.rarity-legendary {
  border-color: var(--gold-leaf);
  background: rgba(var(--gold-rgb), 0.14);
}
.badge-rarity.rarity-brilliant {
  border-color: var(--gold-ink);
  background: rgba(var(--gold-rgb), 0.08);
}
.badge-rarity.rarity-forbidden {
  border-color: var(--oxblood);
  background: rgba(var(--accent-rgb), 0.1);
}

/* ---- desc / quote ---- */
.detail-desc {
  margin-top: 14px;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.75;
  color: var(--ink);
  white-space: pre-line;
}

.detail-quote {
  margin-top: 12px;
  padding: 10px 14px;
  border-left: 3px solid var(--gold-leaf);
  background: rgba(var(--gold-rgb), 0.07);
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.7;
  color: var(--ink-faded);
  white-space: pre-line;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

/* ---- 等级数值表：按等级分组，空洞如实保留 ---- */
.detail-levels {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--rule);
}

.detail-levels-title {
  font-family: var(--font-type);
  font-weight: 400;
  font-size: 13px;
  letter-spacing: 0.18em;
  color: var(--ink);
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.level-group {
  min-width: 0;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: rgba(var(--paper-light-rgb), 0.6);
}

.level-head {
  padding: 5px 10px;
  font-family: var(--font-type);
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--paper-light);
  background: rgba(var(--ink-rgb), 0.82);
}

/* schema 2：同级内按数值主体（召唤物阶段等）分块的小标题 */
.level-unit {
  padding: 6px 10px 0;
  font-family: var(--font-type);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--ink-faded);
}

.level-rows {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px 10px;
}

.level-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.level-k {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--ink-faded);
}

.level-v {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  text-align: right;
  overflow-wrap: anywhere;
}

.level-pct {
  font-size: 11px;
  font-weight: 400;
  color: var(--ink-faded);
}

/* ---- 响应式：768 两栏 -> 上下堆叠；480 全宽贴底 ---- */
@media (max-width: 768px) {
  .detail-overlay {
    padding: 18px 14px;
  }

  .detail-panel {
    width: min(560px, 100%);
  }

  .detail-body {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 20px;
  }

  .detail-figure {
    width: 100%;
    max-width: 220px;
    margin: 0 auto;
  }
}

@media (max-width: 480px) {
  .detail-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .detail-panel {
    width: 100%;
    max-height: 92vh;
    border-radius: 0;
    border-top-width: 1.5px;
    border-right: none;
    border-bottom: none;
    border-left: none;
  }

  .detail-body {
    padding: 18px 14px 22px;
  }
}

/* ---- 进出场：只用 transform/opacity，≤200ms；弱动效偏好下关闭 ---- */
.detail-enter-active,
.detail-leave-active {
  transition: opacity 0.18s ease;
}

.detail-enter-active .detail-panel,
.detail-leave-active .detail-panel {
  transition: transform 0.18s ease;
}

.detail-enter-from,
.detail-leave-to {
  opacity: 0;
}

.detail-enter-from .detail-panel,
.detail-leave-to .detail-panel {
  transform: translateY(16px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .detail-enter-active,
  .detail-leave-active,
  .detail-enter-active .detail-panel,
  .detail-leave-active .detail-panel {
    transition: none;
  }
}
</style>
