<template>
  <div
    class="card-image"
    :class="[
      `card-image--${size}`,
      `rarity-${card.rarity}`,
      { 'card-image--framed': frameShown },
    ]"
  >
    <img
      v-if="stage !== 'placeholder'"
      class="card-image-img"
      :class="{ 'card-image-img--inset': insetStyle }"
      :style="insetStyle"
      :src="currentUrl"
      :alt="cardName"
      :loading="size === 'detail' ? 'eager' : 'lazy'"
      :fetchpriority="size === 'detail' ? 'high' : 'auto'"
      decoding="async"
      @error="onImageError"
    />
    <!-- L3 占位卡背：rarity token 色块 + 编号/卡名（纯 DOM，无 canvas 依赖） -->
    <div v-else class="card-image-fallback">
      <span class="card-image-fallback-id">No. {{ card.id }}</span>
      <span class="card-image-fallback-name">{{ cardName }}</span>
    </div>
    <!-- 游戏原生品质边框（schema 5 frames 表，imageBase/frames/<file> 外链）：
         花纹带 + 透明卡面窗口，窗口内卡面按 frame.inner 缩进定位。加载失败
         逐级降级，两级都失败时整体回退 CSS 稀有度视觉（色条/发丝边）。 -->
    <img
      v-if="frameShown"
      class="card-image-frame"
      :src="currentFrameUrl"
      alt=""
      aria-hidden="true"
      :loading="size === 'detail' ? 'eager' : 'lazy'"
      decoding="async"
      @error="onFrameError"
    />
    <!-- 网格 tile 的费用徽标 / 稀有度色条等覆盖件由宿主经 slot 注入 -->
    <slot></slot>
  </div>
</template>

<script>
import { joinUrl } from '@/services/spellbookClient.js';
import { SpellbookService } from '@/services/spellbookService.js';
import { useCardStore } from '@/stores/cardStore.js';

// L2 本站透明代理基地址（netlify.toml: /cardimg/* -> 锁定 tag 的 jsDelivr）。
// 注意红线：L1 默认图源必须经 SpellbookService.imageUrl / frameUrl 解析
//（version.json imageBase / ?img= 覆盖），这里只拼本站同源路径，不手拼任何
// CDN 域名。
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
      // 原生边框降级阶段：'primary'(L1 直连) | 'proxy'(L2 本站代理) | 'off'(回退 CSS 视觉)
      frameStage: 'primary',
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
    // L1 路径：优先 WebP 副本（version.json imagesWebp 能力 + store 闩），
    // 不可用回落 PNG 原图；service 解析不出 PNG 时返回 null（交给代理兜底）
    primaryUrl() {
      if (!this.cardStore.webpOff) {
        // webp 解析永不抛错：无能力/未就绪/路径不规则一律 null
        const webp = SpellbookService.imageUrl(this.card, 'webp');
        if (webp) return webp;
      }
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
    // 原生边框规格（{ file, size, inner } | null），cards.json frames 表经 store 透传
    frame() {
      return this.cardStore.frameFor(this.card.rarity);
    },
    // L1 路径：imageBase + frames/<file>；无 frames 表 / 未就绪时为 null
    //（frameUrl 不抛错——边框是装饰件，未就绪即走 CSS 兜底）
    framePrimaryUrl() {
      return SpellbookService.frameUrl(this.card.rarity);
    },
    // L2 路径：本站同源代理（/cardimg/* 透传 frames/ 子目录）
    frameProxyUrl() {
      return this.frame?.file
        ? joinUrl(CARDIMG_BASE, `frames/${this.frame.file}`)
        : null;
    },
    currentFrameUrl() {
      if (this.frameStage === 'off') return null;
      if (this.frameStage === 'proxy') return this.frameProxyUrl;
      return this.framePrimaryUrl ?? this.frameProxyUrl;
    },
    frameShown() {
      return Boolean(this.currentFrameUrl);
    },
    // 卡面窗口定位：边框显示中且规格齐全时，把卡面绝对定位到 frame.inner
    //（frame-PNG 像素换算成容器百分比），还原游戏内「花纹压住卡面四缘」的
    // 构图；边框缺席/降级关闭时返回 null，卡面铺满整个容器（原行为）
    insetStyle() {
      const meta = this.frame;
      if (!this.currentFrameUrl || !meta?.inner || !meta?.size) return null;
      const [x, y, w, h] = meta.inner;
      const [sw, sh] = meta.size;
      const numeric = [x, y, w, h, sw, sh].every(
        (n) => Number.isFinite(n) && n >= 0,
      );
      if (!numeric || w <= 0 || h <= 0 || sw <= 0 || sh <= 0) return null;
      return {
        left: `${(x / sw) * 100}%`,
        top: `${(y / sh) * 100}%`,
        width: `${(w / sw) * 100}%`,
        height: `${(h / sh) * 100}%`,
      };
    },
  },
  methods: {
    onImageError() {
      if (this.stage === 'primary') {
        // 失败的是 WebP 副本（闩未扳 + 能力仍在）→ 全局回落 PNG：WebP 可用性
        // 是整个 release 的属性，一张 404 即整套不可信。stage 保持 primary，
        // primaryUrl 重算为 PNG，src 换绑后浏览器自动改拉 PNG（在途 WebP 请求
        // 随 src 变更被浏览器中止，其余瓦片同理一并切换）。
        if (
          !this.cardStore.webpOff &&
          SpellbookService.imageUrl(this.card, 'webp')
        ) {
          this.cardStore.disableWebpImages();
          return;
        }
        // L1(PNG) -> L2：代理重试只发生一次。若默认图源本身就是代理路径
        //（T5 拨测后可能把 imageBase 改为 /cardimg/），重试同 URL 无意义，直达 L3。
        let primary = null;
        try {
          primary = SpellbookService.imageUrl(this.card);
        } catch {
          primary = null;
        }
        this.stage =
          primary && primary !== this.proxyUrl ? 'proxy' : 'placeholder';
      } else {
        // L2 -> L3：安静降级为占位卡背，不弹错误、不打断列表
        this.stage = 'placeholder';
      }
    },
    onFrameError() {
      // 与卡面同构的降级：L1 -> L2 一次代理重试，再失败关掉边框层——
      // 宿主的稀有度色条与容器发丝边随之自动恢复（CSS 兜底视觉）
      if (this.frameStage === 'primary') {
        const primary = this.framePrimaryUrl;
        this.frameStage =
          primary && primary !== this.frameProxyUrl ? 'proxy' : 'off';
      } else {
        this.frameStage = 'off';
      }
    },
  },
};
</script>

<style scoped>
/*
 * 卡面框：网格 tile 与详情大图共用同一实现（docs/card-codex.md §1.1）。
 * 比例锁定为原生边框 PNG 的 frames.size（208:272）——花纹带 1:1 贴合不失真，
 * 无边框降级态同为近 3:4。宽度由宿主容器决定，size 变体只承载语义钩子与
 * 加载策略差异。覆盖件（费用徽标/稀有度色条）为 slot 内容，样式留在宿主组件。
 */
.card-image {
  position: relative;
  aspect-ratio: 208 / 272;
  overflow: hidden;
  background: var(--paper-deep);
  border: 1px solid var(--rule);
  border-radius: 2px;
  transition:
    transform 0.25s,
    border-color 0.25s;
}

/* 边框显示中：原生花纹自带描边，隐藏占位发丝边（保留 1px 占位避免跳动） */
.card-image--framed {
  border-color: transparent;
}

.card-image-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 边框窗口模式：卡面缩进 frame.inner（left/top/width/height 由内联样式给出） */
.card-image-img--inset {
  position: absolute;
}

/* 原生品质边框层：整幅覆盖容器，透明窗口露出下层卡面；z 序在卡面之上、
 * 宿主 slot 覆盖件（z-index 2）之下 */
.card-image-frame {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  /* 容器比例已锁定为 PNG 比例，fill 保证花纹与窗口严格 1:1 贴合 */
  object-fit: fill;
  pointer-events: none;
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
