<template>
  <div
    class="card-image"
    :class="[`card-image--${size}`, `rarity-${card.rarity}`]"
  >
    <img
      v-if="stage !== 'placeholder'"
      class="card-image-img"
      :src="currentUrl"
      :alt="cardName"
      :loading="size === 'detail' ? 'eager' : 'lazy'"
      decoding="async"
      @error="onImageError"
    />
    <!-- L3 占位卡背：rarity token 色块 + 编号/卡名（纯 DOM，无 canvas 依赖） -->
    <div v-else class="card-image-fallback">
      <span class="card-image-fallback-id">No. {{ card.id }}</span>
      <span class="card-image-fallback-name">{{ cardName }}</span>
    </div>
    <!-- 网格 tile 的费用徽标 / 稀有度色条等覆盖件由宿主经 slot 注入 -->
    <slot></slot>
  </div>
</template>

<script>
import { joinUrl } from '@/services/spellbookClient.js';
import { SpellbookService } from '@/services/spellbookService.js';
import { useCardStore } from '@/stores/cardStore.js';

// L2 本站透明代理基地址（netlify.toml: /cardimg/* -> 锁定 tag 的 jsDelivr）。
// 注意红线：L1 默认图源必须经 SpellbookService.imageUrl 解析（version.json
// imageBase / ?img= 覆盖），这里只拼本站同源路径，不手拼任何 CDN 域名。
const CARDIMG_BASE = '/cardimg/';

export default {
  name: 'CardImage',
  props: {
    // 卡牌对象（cards.json 的 Card 结构）
    card: {
      type: Object,
      required: true,
    },
    // 尺寸语义：'tile' 网格小卡格 | 'detail' 详情大图（共用同一条降级链）
    size: {
      type: String,
      default: 'tile',
      validator(value) {
        return ['tile', 'detail'].includes(value);
      },
    },
  },
  setup() {
    const cardStore = useCardStore();
    return { cardStore };
  },
  data() {
    return {
      // 图片降级阶段：'primary'(L1 直连) | 'proxy'(L2 本站代理) | 'placeholder'(L3 占位)
      stage: 'primary',
    };
  },
  computed: {
    cardName() {
      // alt 文案与 L3 占位卡背跟随页面语言（缺失回退 zh 再回退编号）
      return (
        SpellbookService.text(this.card, this.cardStore.locale, 'name') ??
        `No. ${this.card.id}`
      );
    },
    // L1 路径：service 解析默认图源；解析不出时返回 null（交给代理兜底）
    primaryUrl() {
      try {
        return SpellbookService.imageUrl(this.card);
      } catch (error) {
        return null;
      }
    },
    // L2 路径：本站同源代理
    proxyUrl() {
      return joinUrl(CARDIMG_BASE, this.card.img);
    },
    currentUrl() {
      if (this.stage === 'proxy') return this.proxyUrl;
      return this.primaryUrl ?? this.proxyUrl;
    },
  },
  methods: {
    onImageError() {
      if (this.stage === 'primary') {
        // L1 -> L2：代理重试只发生一次。若默认图源本身就是代理路径
        //（T5 拨测后可能把 imageBase 改为 /cardimg/），重试同 URL 无意义，直达 L3。
        const primary = this.primaryUrl;
        this.stage =
          primary && primary !== this.proxyUrl ? 'proxy' : 'placeholder';
      } else {
        // L2 -> L3：安静降级为占位卡背，不弹错误、不打断列表
        this.stage = 'placeholder';
      }
    },
  },
};
</script>

<style scoped>
/*
 * 3:4 卡面框：网格 tile 与详情大图共用同一实现（docs/card-codex.md §1.1）。
 * 宽度由宿主容器决定，size 变体只承载语义钩子与加载策略差异。
 * 覆盖件（费用徽标/稀有度色条）为 slot 内容，样式留在宿主组件。
 */
.card-image {
  position: relative;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: var(--paper-deep);
  border: 1px solid var(--rule);
  border-radius: 2px;
  transition:
    transform 0.25s,
    border-color 0.25s;
}

.card-image-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* L3 占位卡背：游戏内框色 token 色块（与色条同源映射）
 *   common 灰白 | rare 蓝 | epic 紫 | legendary 金 | mythic 银白 | dark 墨绿
 */
.card-image-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  text-align: center;
}

.card-image-fallback.rarity-common {
  background: rgba(var(--rule-rgb), 0.35);
}
.card-image-fallback.rarity-rare {
  background: rgba(var(--blue-rgb), 0.12);
}
.card-image-fallback.rarity-epic {
  background: rgba(var(--violet-rgb), 0.12);
}
.card-image-fallback.rarity-legendary {
  background: rgba(var(--gold-rgb), 0.16);
}
.card-image-fallback.rarity-mythic {
  background: rgba(var(--silver-rgb), 0.3);
}
.card-image-fallback.rarity-dark {
  background: rgba(var(--forest-rgb), 0.12);
}

.card-image-fallback-id {
  font-family: var(--font-type);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--ink-faded);
}

.card-image-fallback-name {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
</style>
