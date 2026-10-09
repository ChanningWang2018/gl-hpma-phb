// Card Codex store — spellbook data + filter state for /cards (T2).
// Options-style defineStore per AGENTS.md (loading/error + try-catch-finally),
// filtering delegated to SpellbookService.filterCards (pure, unit-tested).
// The UI locale is site-wide: state lives in localeStore, exposed here as a
// delegating getter + forwarding action so the store's API surface is
// unchanged for the views/components.
import { translate } from '@/services/codexLocale.js';
import { useLocaleStore } from '@/stores/localeStore.js';
import { lookupLabel } from '@/services/spellbookClient.js';
import { SpellbookService } from '@/services/spellbookService.js';
import { defineStore } from 'pinia';

export const useCardStore = defineStore('card', {
  state: () => ({
    // spellbook data (populated by loadCards(); empty until then)
    cards: [],
    labels: {},
    // 原生品质边框表（schema 5，cards.json 顶层 frames；缺失时保持空对象）
    frames: {},

    // 卡面 WebP 全局降级闩：false = 优先加载 WebP 副本（version.json
    // imagesWebp 声明能力）；任一张 WebP 加载失败即置 true——WebP 可用性是
    // 整个 release 的属性（整目录有或没有），一张 404 意味着整套不可信，
    // 全局回退 PNG 比逐卡重试省心。会话级不持久化：下次进入重新尝试。
    webpOff: false,

    // 加载状态
    loading: false,
    error: null,

    // 筛选与搜索（'all' 表示不筛）
    filters: {
      type: 'all', // 'all' | 'spell' | 'summon' | 'companion'
      rarity: 'all', // 'all' | rarity code (common...mythic/dark)
      cost: 'all', // 'all' | number
      search: '', // zh/en 卡名、spell_word 跨语言匹配
    },

    // 详情弹层当前选中的卡 id（null = 弹层关闭；URL 不同步，刷新即复位）
    selectedCardId: null,
  }),

  getters: {
    // UI 语言（'zh' | 'en'）：全站唯一语言，委托 localeStore（跨 store
    // getter，两页共享一次切换）；数据侧文案由 lookup* 按 locale 取
    locale() {
      return useLocaleStore().locale;
    },

    // 组合筛选 + 搜索（交给 service 的纯函数，store 不重复实现规则）
    filteredCards: (state) =>
      SpellbookService.filterCards(state.cards, state.filters),

    totalCards: (state) => state.cards.length,

    // 某稀有度的原生边框规格（{ file, size, inner } | null），CardImage 叠加层用
    frameFor: (state) => (rarity) => state.frames?.[rarity] ?? null,

    // 类型分段选项：'all' 置顶，其后按 labels.type 的声明顺序（spell/summon/companion）
    // （读委托 getter locale 须走 this，不能用 state 形参）
    typeOptions() {
      const counts = {};
      for (const card of this.cards) {
        counts[card.type] = (counts[card.type] ?? 0) + 1;
      }
      const options = [
        {
          value: 'all',
          label: translate(this.locale, 'all'),
          count: this.cards.length,
        },
      ];
      for (const code of Object.keys(this.labels.type ?? {})) {
        options.push({
          value: code,
          label: lookupLabel(this.labels, 'type', code, this.locale),
          count: counts[code] ?? 0,
        });
      }
      return options;
    },

    // 稀有度下拉选项：'all' 置顶，带计数
    rarityOptions() {
      const counts = {};
      for (const card of this.cards) {
        counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
      }
      const options = [
        {
          value: 'all',
          label: translate(this.locale, 'allRarities'),
          count: this.cards.length,
        },
      ];
      for (const code of Object.keys(this.labels.rarity ?? {})) {
        options.push({
          value: code,
          label: lookupLabel(this.labels, 'rarity', code, this.locale),
          count: counts[code] ?? 0,
        });
      }
      return options;
    },

    // 费用下拉选项：'all' 置顶，其余升序去重（来自 service 的 costOptions）
    costOptions() {
      const costs = SpellbookService.costOptions(this.cards);
      return [
        { value: 'all', label: translate(this.locale, 'allCosts') },
        ...costs.map((cost) => ({
          value: cost,
          label: translate(this.locale, 'costN', { n: cost }),
        })),
      ];
    },

    // 详情弹层选中的卡（byId 语义；未选或找不到时返回 null）
    selectedCard: (state) =>
      state.cards.find((card) => card.id === state.selectedCardId) ?? null,
  },

  actions: {
    // 加载卡牌数据（client 层幂等，重复/并发调用共享同一次请求）
    async loadCards() {
      this.loading = true;
      try {
        const snapshot = await SpellbookService.load();
        this.cards = snapshot.cards;
        this.labels = snapshot.labels;
        this.frames = snapshot.frames ?? {};
        this.error = null;
      } catch (error) {
        console.error('Failed to load spellbook data:', error);
        // 存语言无关的错误码，UI 文案由视图按 locale 走词典
        this.error = 'load-failed';
      } finally {
        this.loading = false;
      }
    },

    // 合并式更新筛选（setFilter({ type: 'spell' }) 等）
    setFilter(patch) {
      Object.assign(this.filters, patch);
    },

    // 全局关闭卡面 WebP（CardImage 的 @error 降级链调用），全部卡面回落 PNG
    disableWebpImages() {
      this.webpOff = true;
    },

    // 切换 UI 语言（转发全站 localeStore：赋值 + 持久化，非法值由其忽略）
    setLocale(value) {
      useLocaleStore().setLocale(value);
    },

    // 打开详情弹层（记录卡 id；由 CardDetail.vue 消费）
    openCard(id) {
      this.selectedCardId = id;
    },

    // 关闭详情弹层
    closeCard() {
      this.selectedCardId = null;
    },
  },
});
