<template>
  <div class="card-codex-page">
    <!-- 栏目标题 + 数据说明（公共页头；语言切换在全局 SiteHeader） -->
    <PageHead>
      <h1 class="page-title">
        Card Codex <span class="page-title-zh">卡牌图鉴</span>
      </h1>
      <template #note>{{ t('note', { total: totalCards }) }}</template>
    </PageHead>

    <!-- 工具栏（数据就绪后出现） -->
    <section
      v-if="!cardStore.loading && !cardStore.error"
      class="codex-toolbar"
    >
      <SegmentControl
        class="codex-segment"
        role="group"
        :aria-label="t('filterByType')"
        :options="typeOptions"
        :model-value="filters.type"
        @update:model-value="setType"
      />

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
            :aria-label="t('labelSearch')"
            @input="queueSearch"
          />
        </label>

        <!-- 筛选 chip：仅移动端显示（桌面沿用上方横排工具栏）；
             徽标为非默认筛选条件数，0 个不渲染 -->
        <button
          type="button"
          class="filter-chip"
          :aria-label="chipAria"
          @click="sheetOpen = true"
        >
          {{ t('filters') }}
          <span
            v-if="activeFilterCount > 0"
            class="chip-count"
            aria-hidden="true"
            >· {{ activeFilterCount }}</span
          >
        </button>
      </div>

      <p class="hit-line" role="status">
        {{ t('hitLine', { shown: filteredCards.length, total: totalCards }) }}
      </p>
    </section>

    <!-- 加载 / 错误 / 空态 -->
    <p v-if="cardStore.loading" class="codex-state">{{ t('loading') }}</p>
    <div v-else-if="cardStore.error" class="codex-state codex-error">
      <p>{{ t('loadError') }}</p>
      <PressButton @click="cardStore.loadCards()">{{ t('retry') }}</PressButton>
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
          @click="openDetail(card.id)"
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

    <!-- 移动端筛选抽屉（Teleport 到 body；开关状态在本视图） -->
    <CardFilterSheet :open="sheetOpen" @close="sheetOpen = false" />
  </div>
</template>

<script>
import CardFilterSheet from '@/components/CardFilterSheet.vue';
import CardImage from '@/components/CardImage.vue';
import PageHead from '@/components/ui/PageHead.vue';
import PressButton from '@/components/ui/PressButton.vue';
import SegmentControl from '@/components/ui/SegmentControl.vue';
import { computed } from 'vue';
import { useHead } from '@vueuse/head';
import { translate } from '@/services/codexLocale.js';
import { lookupLabel } from '@/services/spellbookClient.js';
import { SpellbookService } from '@/services/spellbookService.js';
import { useCardStore } from '@/stores/cardStore.js';

export default {
  name: 'CardCodex',
  components: {
    CardFilterSheet,
    CardImage,
    PageHead,
    PressButton,
    SegmentControl,
  },
  setup() {
    const cardStore = useCardStore();
    // 页面标题/描述随全站语言切换；en 文案维持原样，zh 为对应自然翻译
    useHead(
      computed(() => ({
        title:
          cardStore.locale === 'zh'
            ? '卡牌图鉴 · my little hpma bits'
            : 'HPMA Card Codex - Every Card, Catalogued',
        meta: [
          {
            name: 'description',
            content:
              cardStore.locale === 'zh'
                ? '浏览《哈利波特：魔法觉醒》全部卡牌档案——咒语 / 召唤 / 伙伴——支持类型、稀有度、费用筛选及中英文名检索。'
                : 'Browse all Harry Potter: Magic Awakened cards — spells, summons and companions — with type, rarity and cost filters plus zh/en name search.',
          },
          {
            property: 'og:url',
            content: 'https://hpma-phb.netlify.app/cards',
          },
        ],
        link: [
          {
            rel: 'canonical',
            href: 'https://hpma-phb.netlify.app/cards',
          },
        ],
      })),
    );
    return { cardStore };
  },
  data() {
    return {
      searchInput: '',
      searchTimer: null,
      // 移动端筛选抽屉开关（CardFilterSheet 的 open prop）
      sheetOpen: false,
      // route.query -> store 回填期间抑制反向写回，避免 replace 循环
      syncingQuery: false,
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
    // 激活筛选数：type/rarity/cost ≠ 默认各计 1，search trim 后非空计 1
    //（与 SpellbookService.filterCards 的 trim 口径一致；默认值即
    // cardStore filters 初始态 'all'/'all'/'all'/''）
    activeFilterCount() {
      const f = this.filters;
      let count = 0;
      if (f.type !== 'all') count += 1;
      if (f.rarity !== 'all') count += 1;
      if (f.cost !== 'all') count += 1;
      if (f.search.trim() !== '') count += 1;
      return count;
    },
    chipAria() {
      const n = this.activeFilterCount;
      return n > 0 ? this.t('openFiltersActive', { n }) : this.t('openFilters');
    },
  },
  watch: {
    // 筛选抽屉「重置」等外部来源清空 search 时收尾：撤销未落地的防抖并
    // 把输入框同步归零——store 是唯一事实源，输入框只是它的投影
    'cardStore.filters.search'(value) {
      if (value !== this.searchInput) {
        clearTimeout(this.searchTimer);
        this.searchInput = value;
      }
    },

    // 筛选状态是 URL 的一部分：store 变 -> query 变（replace，不堆历史）。
    'cardStore.filters': {
      deep: true,
      handler() {
        this.syncQuery();
      },
    },

    // 浏览器前进/后退或外部链接进站：query 变 -> store 回填。
    '$route.query': {
      deep: true,
      handler() {
        this.applyRouteQuery();
      },
    },
  },
  async mounted() {
    await this.cardStore.loadCards();
    this.applyRouteQuery();
    this.syncQuery();
  },
  deactivated() {
    // keep-alive 下路由离开 /cards：只关闭筛选抽屉。App.vue 的 keep-alive
    // 意味着 CardFilterSheet 的 beforeUnmount 在切页时不触发，残留的打开状态
    // 会把 body 滚动锁定（overflow:hidden）带到其他页面；sheetOpen 复位触发
    // CardFilterSheet 的 watch -> onClose，恢复滚动并移除 Esc 监听。
    //（详情自 P0a 起是独立页，不再有需要复位的弹层选中态。）
    this.sheetOpen = false;
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer);
  },
  methods: {
    // Card detail is a canonical page now; filters live in the store so they
    // survive the back/forward trip.
    openDetail(id) {
      this.$router.push({ name: 'card-detail', params: { id } });
    },

    // Read ?type=&rarity=&cost=&q= into the store. Invalid values fall back
    // to the unfiltered state rather than filtering everything out.
    applyRouteQuery() {
      if (this.$route.name !== 'cards') return;
      if (this.syncingQuery) return;
      const query = this.$route.query;
      const type = this.typeOptions.some((opt) => opt.value === query.type)
        ? query.type
        : 'all';
      const rarity = this.rarityOptions.some(
        (opt) => opt.value === query.rarity,
      )
        ? query.rarity
        : 'all';
      const cost = this.costOptions.some(
        (opt) => String(opt.value) === String(query.cost),
      )
        ? query.cost === 'all'
          ? 'all'
          : Number(query.cost)
        : 'all';
      const search = typeof query.q === 'string' ? query.q : '';

      const next = { type, rarity, cost, search };
      if (
        next.type !== this.filters.type ||
        next.rarity !== this.filters.rarity ||
        next.cost !== this.filters.cost ||
        next.search !== this.filters.search
      ) {
        this.cardStore.setFilter(next);
      }
      if (search !== this.searchInput) {
        clearTimeout(this.searchTimer);
        this.searchInput = search;
      }
    },

    // Store -> URL. Only non-default values are written, so the clean
    // /cards URL stays clean.
    syncQuery() {
      if (this.$route.name !== 'cards') return;
      if (this.syncingQuery) return;
      const f = this.filters;
      const query = {};
      if (f.type !== 'all') query.type = f.type;
      if (f.rarity !== 'all') query.rarity = f.rarity;
      if (f.cost !== 'all') query.cost = String(f.cost);
      if (f.search.trim()) query.q = f.search.trim();

      const current = this.$route.query;
      const same =
        Object.keys(query).length === Object.keys(current).length &&
        Object.entries(query).every(([key, value]) => current[key] === value);
      if (same) return;

      this.syncingQuery = true;
      this.$router
        .replace({ name: 'cards', query })
        .catch(() => {})
        .finally(() => {
          this.syncingQuery = false;
        });
    },

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
 * 稀有度视觉：主视觉是 CardImage 叠加的游戏原生品质边框（schema 5 frames 表）；
 * CSS 色条（全局 --rarity-* token）降级兜底——仅当边框图两级加载都失败时显示。
 *   common    普通 -> 灰白
 *   rare      稀有 -> 蓝
 *   epic      史诗 -> 紫
 *   legendary 传说 -> 金
 *   mythic    光辉 -> 银白
 *   dark      深渊 -> 墨绿
 */
.card-codex-page {
  padding: var(--space-5) var(--space-6) var(--space-7);
}

/* ---- 工具栏 ---- */
.codex-toolbar {
  margin-bottom: var(--space-4);
}

/* 类型分段与正文的间距留在使用方（分段钮本身不带外边距）；
 * 各带间距统一 --space-3 */
.codex-segment {
  margin-bottom: var(--space-3);
}

.toolbar-fields {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  align-items: flex-end;
  margin-bottom: var(--space-3);
}

.toolbar-field {
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

.toolbar-field select,
.toolbar-field input {
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--type-body);
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
  font-size: var(--type-caption);
  letter-spacing: 0.1em;
  color: var(--ink-faded);
}

/* 筛选 chip：仅移动端工具栏显示（桌面由横排工具栏承担，见媒体查询） */
.filter-chip {
  display: none;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  min-height: 40px;
  padding: 0 var(--space-3);
  font-family: var(--font-type);
  font-size: var(--type-body);
  color: var(--ink);
  background: var(--paper-light);
  border: 1px solid var(--rule);
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 0.25s,
    border-color 0.25s;
}

.filter-chip:hover {
  color: var(--oxblood);
  border-color: var(--oxblood);
}

.filter-chip:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 1px;
}

/* 激活筛选数徽标：非默认条件数，随 store 实时变化，0 个不渲染 */
.chip-count {
  color: var(--oxblood);
}

/* ---- 加载 / 错误 / 空态 ---- */
.codex-state {
  font-family: var(--font-type);
  font-size: var(--type-body);
  color: var(--ink-faded);
  padding: var(--space-7) 0;
  text-align: center;
}

.codex-error p {
  margin-bottom: var(--space-3);
}

/* ---- 卡格 ---- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-4) var(--space-3);
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

/* 悬停抬升作用在 CardImage 根元素（scoped 可达子组件根节点）；发丝边提亮
 * 只对无边框降级态有意义——带原生边框时描边由花纹承担，边已透明 */
.tile-hit:hover .card-image {
  transform: translateY(-2px);
}

.tile-hit:hover .card-image:not(.card-image--framed) {
  border-color: var(--ink-faded);
}

/* 费用徽标：左上角，打字机体 */
.cost-badge {
  position: absolute;
  top: var(--space-1);
  left: var(--space-1);
  z-index: 2;
  min-width: var(--space-5);
  height: var(--space-5);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-1);
  font-family: var(--font-type);
  font-size: var(--type-body);
  color: var(--paper-light);
  background: rgba(var(--ink-rgb), 0.88);
  border-radius: 2px;
}

/* 稀有度细色条：贴 tile 底边——原生边框显示中时隐藏（frameShown 由
 * CardImage 根类 card-image--framed 反映），边框加载失败后自动恢复 */
.rarity-stripe {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  z-index: 2;
}

.card-image--framed .rarity-stripe {
  display: none;
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
.rarity-stripe.rarity-mythic {
  background: var(--rarity-mythic);
}
.rarity-stripe.rarity-dark {
  background: var(--rarity-dark);
}

/* tile 下方卡名 */
.tile-name {
  margin-top: var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--type-body);
  color: var(--ink);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-name-en {
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--ink-faded);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 768px) {
  .card-codex-page {
    padding: var(--space-5) var(--space-4) var(--space-5);
  }

  /* 工具栏瘦身为单行两件：搜索 + 筛选 chip（Scryfall 式）。
     类型分段与稀有度/费用下拉移入 CardFilterSheet，命中行移入其 footer */
  .codex-segment,
  .toolbar-field:not(.toolbar-search),
  .hit-line {
    display: none;
  }

  .toolbar-fields {
    flex-wrap: nowrap;
    align-items: stretch;
  }

  /* 裸搜索框：吃满剩余行宽，可访问名由 aria-label + placeholder 兜底 */
  .toolbar-search {
    flex: 1;
    min-width: 0;
  }

  .toolbar-search .field-label {
    display: none;
  }

  .toolbar-search input {
    width: 100%;
  }

  .filter-chip {
    display: inline-flex;
  }
}

@media (max-width: 480px) {
  .card-codex-page {
    padding: var(--space-4) var(--space-3) var(--space-5);
  }

  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: var(--space-3) var(--space-2);
  }

  /* 12px 无对应 token：窄格卡名的移动端降档保留原值 */
  .tile-name {
    font-size: 12px;
  }

  .tile-name-en {
    font-size: 10px;
  }
}
</style>
