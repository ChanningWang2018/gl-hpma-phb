<template>
  <div class="card-codex-page">
    <!-- 栏目标题 + 语言切换 -->
    <header class="codex-head">
      <div class="codex-head-row">
        <h2 class="codex-title">
          Card Codex <span class="codex-title-zh">卡牌图鉴</span>
        </h2>
        <button
          type="button"
          class="locale-btn"
          :aria-label="t('languageToggle')"
          :title="t('languageToggle')"
          @click="toggleLocale"
        >
          {{ cardStore.locale === 'zh' ? 'EN' : '中文' }}
        </button>
      </div>
      <p class="codex-note">{{ t('note', { total: totalCards }) }}</p>
    </header>

    <!-- 工具栏（数据就绪后出现） -->
    <section
      v-if="!cardStore.loading && !cardStore.error"
      class="codex-toolbar"
    >
      <div class="type-segment" role="group" :aria-label="t('filterByType')">
        <button
          v-for="opt in typeOptions"
          :key="opt.value"
          type="button"
          class="type-btn"
          :class="{ active: filters.type === opt.value }"
          @click="setType(opt.value)"
        >
          {{ opt.label }}
          <span class="type-count">{{ opt.count }}</span>
        </button>
      </div>

      <div class="toolbar-fields">
        <label class="toolbar-field">
          <span class="field-label">{{ t('labelRarity') }}</span>
          <select v-model="rarityModel">
            <option
              v-for="opt in rarityOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}（{{ opt.count }}）
            </option>
          </select>
        </label>

        <label class="toolbar-field">
          <span class="field-label">{{ t('labelCost') }}</span>
          <select v-model="costModel">
            <option
              v-for="opt in costOptions"
              :key="String(opt.value)"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </label>

        <label class="toolbar-field toolbar-search">
          <span class="field-label">{{ t('labelSearch') }}</span>
          <input
            :value="searchInput"
            type="search"
            :placeholder="t('searchPlaceholder')"
            @input="queueSearch"
          />
        </label>
      </div>

      <p class="hit-line" role="status">
        {{ t('hitLine', { shown: filteredCards.length, total: totalCards }) }}
      </p>
    </section>

    <!-- 加载 / 错误 / 空态 -->
    <p v-if="cardStore.loading" class="codex-state">{{ t('loading') }}</p>
    <div v-else-if="cardStore.error" class="codex-state codex-error">
      <p>{{ t('loadError') }}</p>
      <button type="button" class="retry-btn" @click="cardStore.loadCards()">
        {{ t('retry') }}
      </button>
    </div>
    <p v-else-if="filteredCards.length === 0" class="codex-state codex-empty">
      {{ t('empty') }}
    </p>

    <!-- 卡格 -->
    <section v-else class="card-grid" :aria-label="t('cardList')">
      <article v-for="card in filteredCards" :key="card.id" class="card-tile">
        <!-- 整 tile 可点击，键盘可达（原生 button） -->
        <button
          type="button"
          class="tile-hit"
          :aria-label="t('viewDetail', { name: primaryName(card) })"
          @click="cardStore.openCard(card.id)"
        >
          <CardImage :card="card" size="tile">
            <span
              class="cost-badge"
              :title="t('costTitle', { n: card.cost })"
              >{{ card.cost }}</span
            >
            <span
              class="rarity-stripe"
              :class="`rarity-${card.rarity}`"
              :title="rarityLabel(card.rarity)"
            ></span>
          </CardImage>
          <p class="tile-name" :title="primaryName(card)">
            {{ primaryName(card) }}
          </p>
          <p
            v-if="secondaryName(card)"
            class="tile-name-en"
            :title="secondaryName(card)"
          >
            {{ secondaryName(card) }}
          </p>
        </button>
      </article>
    </section>

    <!-- 详情弹层（Teleport 到 body；打开状态在 store） -->
    <CardDetail />
  </div>
</template>

<script>
import { useHead } from '@vueuse/head';
import CardDetail from '@/components/CardDetail.vue';
import CardImage from '@/components/CardImage.vue';
import { translate } from '@/services/codexLocale.js';
import { lookupLabel } from '@/services/spellbookClient.js';
import { SpellbookService } from '@/services/spellbookService.js';
import { useCardStore } from '@/stores/cardStore.js';

export default {
  name: 'CardCodex',
  components: { CardDetail, CardImage },
  setup() {
    useHead({
      title: 'HPMA Card Codex - Every Card, Catalogued',
      meta: [
        {
          name: 'description',
          content:
            'Browse all Harry Potter: Magic Awakened cards — spells, summons and companions — with type, rarity and cost filters plus zh/en name search.',
        },
      ],
    });
    const cardStore = useCardStore();
    return { cardStore };
  },
  data() {
    return {
      searchInput: '',
      searchTimer: null,
    };
  },
  computed: {
    filters() {
      return this.cardStore.filters;
    },
    typeOptions() {
      return this.cardStore.typeOptions;
    },
    rarityOptions() {
      return this.cardStore.rarityOptions;
    },
    costOptions() {
      return this.cardStore.costOptions;
    },
    filteredCards() {
      return this.cardStore.filteredCards;
    },
    totalCards() {
      return this.cardStore.totalCards;
    },
    rarityModel: {
      get() {
        return this.filters.rarity;
      },
      set(value) {
        this.cardStore.setFilter({ rarity: value });
      },
    },
    costModel: {
      get() {
        return this.filters.cost;
      },
      set(value) {
        this.cardStore.setFilter({ cost: value });
      },
    },
  },
  mounted() {
    this.cardStore.loadCards();
  },
  deactivated() {
    // keep-alive 下路由离开 /cards：复位详情弹层选中态。App.vue 的 keep-alive
    // 意味着 CardDetail 的 beforeUnmount 在切页时不触发，selectedCardId 残留
    // 会让 body 滚动锁定（overflow:hidden）带到其他页面、返回时弹层自动重开；
    // closeCard 触发 CardDetail 的 watch -> onClose，恢复滚动并移除 Esc 监听。
    this.cardStore.closeCard();
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer);
  },
  methods: {
    setType(value) {
      this.cardStore.setFilter({ type: value });
    },

    // 搜索 200ms 防抖后再写入 store，避免每击键全量过滤 141+ 张卡
    queueSearch(event) {
      this.searchInput = event.target.value;
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.cardStore.setFilter({ search: this.searchInput });
      }, 200);
    },

    // 词典查找：模板内调用并读取 store.locale，切换语言即时生效
    t(key, params) {
      return translate(this.cardStore.locale, key, params);
    },

    toggleLocale() {
      this.cardStore.setLocale(this.cardStore.locale === 'zh' ? 'en' : 'zh');
    },

    // 主卡名：当前语言优先，缺失回退 zh（lookupText 内置回退）再回退编号
    primaryName(card) {
      return (
        SpellbookService.text(card, this.cardStore.locale, 'name') ??
        `No. ${card.id}`
      );
    },

    // 副卡名：另一语言的卡名；与主名相同（en 缺失回退撞车）时不显示
    secondaryName(card) {
      const other = this.cardStore.locale === 'zh' ? 'en' : 'zh';
      const name = SpellbookService.text(card, other, 'name');
      return name && name !== this.primaryName(card) ? name : '';
    },

    rarityLabel(code) {
      return lookupLabel(
        this.cardStore.labels,
        'rarity',
        code,
        this.cardStore.locale,
      );
    },
  },
};
</script>

<style scoped>
/*
 * 稀有度 -> 游戏内框色映射（全局 --rarity-* token，与占位卡背/详情徽标同源）：
 *   common    普通 -> 灰白
 *   rare      稀有 -> 蓝
 *   epic      史诗 -> 紫
 *   legendary 传说 -> 金
 *   brilliant 光辉 -> 银白
 *   forbidden 禁忌 -> 墨绿
 */
.card-codex-page {
  padding: 26px 30px 40px;
}

/* ---- 头部 ---- */
.codex-head {
  border-bottom: 3px double var(--ink);
  padding-bottom: 14px;
  margin-bottom: 18px;
}

.codex-head-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.codex-title {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: clamp(26px, 4vw, 36px);
  color: var(--ink);
  line-height: 1.15;
}

.codex-title-zh {
  font-family: var(--font-sans);
  font-size: 0.55em;
  color: var(--ink-faded);
  margin-left: 8px;
  letter-spacing: 0.2em;
}

.locale-btn {
  min-height: 40px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-type);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ink-faded);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 2px;
  padding: 9px 10px;
  cursor: pointer;
  transition:
    color 0.25s,
    border-color 0.25s;
}

.locale-btn:hover {
  color: var(--oxblood);
  border-color: var(--oxblood);
}

.locale-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 1px;
}

.codex-note {
  font-family: var(--font-type);
  font-size: 12px;
  color: var(--ink-faded);
  margin-top: 8px;
}

/* ---- 工具栏 ---- */
.codex-toolbar {
  margin-bottom: 16px;
}

.type-segment {
  display: inline-flex;
  flex-wrap: wrap;
  border: 1.5px solid var(--ink);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 12px;
}

.type-btn {
  min-height: 40px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-type);
  font-size: 13px;
  color: var(--ink-faded);
  background: transparent;
  border: none;
  border-right: 1px solid var(--rule);
  cursor: pointer;
  transition:
    color 0.25s,
    background-color 0.25s;
}

.type-btn:last-child {
  border-right: none;
}

.type-btn:hover {
  color: var(--ink);
  background: rgba(var(--accent-rgb), 0.05);
}

.type-btn.active {
  background: var(--ink);
  color: var(--paper-light);
}

.type-count {
  /* 无 opacity：0.7 叠 paper 底对比度仅约 2.8:1，继承 token 色即可过 AA */
  font-size: 11px;
}

.toolbar-fields {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.toolbar-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-family: var(--font-type);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--ink-faded);
}

.toolbar-field select,
.toolbar-field input {
  min-height: 40px;
  padding: 6px 10px;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--ink);
  background: var(--paper-light);
  border: 1px solid var(--rule);
  border-radius: 2px;
}

.toolbar-field select:focus,
.toolbar-field input:focus {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 1px;
}

.toolbar-search input {
  width: 240px;
}

.hit-line {
  font-family: var(--font-type);
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--ink-faded);
  margin-top: 10px;
}

/* ---- 加载 / 错误 / 空态 ---- */
.codex-state {
  font-family: var(--font-type);
  font-size: 14px;
  color: var(--ink-faded);
  padding: 48px 0;
  text-align: center;
}

.codex-error p {
  margin-bottom: 14px;
}

.retry-btn {
  min-height: 40px;
  padding: 0 22px;
  font-family: var(--font-type);
  font-size: 13px;
  color: var(--paper-light);
  background: var(--oxblood);
  border: none;
  border-radius: 2px;
  cursor: pointer;
}

.retry-btn:hover {
  background: var(--ink);
}

/* ---- 卡格 ---- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px 12px;
}

.card-tile {
  min-width: 0;
}

/* 整 tile 命中区（原生 button，键盘可达）；视觉与 T2 的静态 tile 一致 */
.tile-hit {
  display: block;
  width: 100%;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: center;
  background: transparent;
  border: none;
  border-radius: 2px;
  cursor: pointer;
}

.tile-hit:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 2px;
}

/* 悬停抬升作用在 CardImage 根元素（scoped 可达子组件根节点） */
.tile-hit:hover .card-image {
  transform: translateY(-2px);
  border-color: var(--ink-faded);
}

/* 费用徽标：左上角，打字机体 */
.cost-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  min-width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  font-family: var(--font-type);
  font-size: 13px;
  color: var(--paper-light);
  background: rgba(var(--ink-rgb), 0.88);
  border-radius: 2px;
}

/* 稀有度细色条：贴 tile 底边 */
.rarity-stripe {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  z-index: 2;
}

.rarity-stripe.rarity-common {
  background: var(--rarity-common);
}
.rarity-stripe.rarity-rare {
  background: var(--rarity-rare);
}
.rarity-stripe.rarity-epic {
  background: var(--rarity-epic);
}
.rarity-stripe.rarity-legendary {
  background: var(--rarity-legendary);
}
.rarity-stripe.rarity-brilliant {
  background: var(--rarity-brilliant);
}
.rarity-stripe.rarity-forbidden {
  background: var(--rarity-forbidden);
}

/* tile 下方卡名 */
.tile-name {
  margin-top: 7px;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-name-en {
  font-family: var(--font-type);
  font-size: 11px;
  color: var(--ink-faded);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 768px) {
  .card-codex-page {
    padding: 20px 15px 30px;
  }

  .toolbar-search input {
    width: 200px;
  }
}

@media (max-width: 480px) {
  .card-codex-page {
    padding: 16px 12px 26px;
  }

  .type-segment {
    display: flex;
    width: 100%;
  }

  .type-btn {
    flex: 1;
    justify-content: center;
    padding: 0 8px;
  }

  .toolbar-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .toolbar-search {
    grid-column: 1 / -1;
  }

  .toolbar-search input {
    width: 100%;
  }

  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 12px 8px;
  }

  .tile-name {
    font-size: 12px;
  }

  .tile-name-en {
    font-size: 10px;
  }
}
</style>
