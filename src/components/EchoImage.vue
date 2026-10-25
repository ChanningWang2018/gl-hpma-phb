<template>
  <span class="echo-image" :class="`echo-image--${size}`">
    <img
      v-if="currentUrl"
      class="echo-image-img"
      :class="{ 'is-loaded': loaded }"
      :src="currentUrl"
      :alt="alt"
      :width="boxSize"
      :height="boxSize"
      :loading="size === 'detail' ? 'eager' : 'lazy'"
      :fetchpriority="size === 'detail' ? 'high' : 'auto'"
      decoding="async"
      @load="onLoad"
      @error="onError"
    />
    <!-- 占位层始终先渲染：图片加载完成前显示首字，失败链走完也不出现破图图标 -->
    <span
      v-if="!loaded"
      class="echo-image-placeholder"
      :role="currentUrl ? null : 'img'"
      :aria-label="currentUrl ? null : alt || null"
      :aria-hidden="currentUrl ? 'true' : null"
    >
      {{ placeholder }}
    </span>
  </span>
</template>

<script>
import { EchoService } from '@/services/echoService.js';
import { computed, ref, watch } from 'vue';

// 固定盒子尺寸（px）：列表 72 / 详情首图 168 / 稀有度变体 96。
// 尺寸写死在组件里，图片未加载或降级到首字占位时都不会引起 CLS。
const BOX_SIZES = Object.freeze({ tile: 72, detail: 168, variant: 96 });

// EchoImage — 回响图唯一入口，降级链由 EchoService.imageCandidates 统一推导：
//   L1 WebP -> L1 PNG -> L2 同源 /echoimg/<path> -> L3 本地 echoNN.webp -> 首字占位。
// 图源域名只存在于 version.json（imageBase / imagesWebp），组件不硬编码；
// 直连失败时自动落到同源代理，代理也不可用时 19 名 deck 角色回退本地头像。
export default {
  name: 'EchoImage',
  props: {
    // 发布包内 PNG 相对路径，如 `images/icon_huixiang_hemin_001.png`
    path: {
      type: String,
      default: '',
    },
    // 同层备用路径（icon 缺失时用 big_icon），一般留空
    fallbackPath: {
      type: String,
      default: '',
    },
    // 数据集的 1..19 回响编号；提供时最后回退到本站头像
    statsId: {
      type: [Number, String],
      default: null,
    },
    alt: {
      type: String,
      default: '',
    },
    // 占位首字（中文名取首字；缺省时从 alt 推导）
    initial: {
      type: String,
      default: '',
    },
    // 尺寸语义：tile 列表头像 | detail 详情首图 | variant 稀有度变体图
    size: {
      type: String,
      default: 'tile',
      validator(value) {
        return ['tile', 'detail', 'variant'].includes(value);
      },
    },
  },
  setup(props) {
    const stage = ref(0);
    const loaded = ref(false);

    const candidates = computed(() =>
      EchoService.imageCandidates(props.path, {
        fallbackPath: props.fallbackPath,
        statsId: props.statsId,
      }),
    );
    const currentUrl = computed(() => candidates.value[stage.value] ?? null);
    const boxSize = computed(() => BOX_SIZES[props.size] ?? BOX_SIZES.tile);
    const placeholder = computed(
      () => props.initial || props.alt.slice(0, 1) || '?',
    );

    // 路由切换（详情页同一实例换角色）或数据就绪后重置到链首
    watch(candidates, () => {
      stage.value = 0;
      loaded.value = false;
    });

    const onLoad = () => {
      loaded.value = true;
    };

    // 当前候选失败 -> 下一候选。候选耗尽时 currentUrl 为 null，只留首字占位，
    // 不会触发浏览器破图图标（img 在加载成功前 opacity:0，失败即被移除）。
    const onError = () => {
      loaded.value = false;
      stage.value += 1;
    };

    return {
      boxSize,
      currentUrl,
      loaded,
      onError,
      onLoad,
      placeholder,
    };
  },
};
</script>

<style scoped>
/*
 * 回响图框：固定宽高 + overflow:hidden，宿主只负责边框/间距。
 * 图片在 load 前透明，占位首字垫底；失败后逐级重试，最终停在首字占位。
 */
.echo-image {
  position: relative;
  display: block;
  flex: none;
  overflow: hidden;
  background: var(--paper-deep);
  border-radius: 4px;
}

.echo-image--tile {
  width: 72px;
  height: 72px;
}

.echo-image--detail {
  width: 168px;
  height: 168px;
}

.echo-image--variant {
  width: 96px;
  height: 96px;
}

.echo-image-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.echo-image-img.is-loaded {
  opacity: 1;
}

.echo-image-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-serif);
  color: var(--ink-faded);
  background: var(--paper-deep);
  user-select: none;
}

.echo-image--tile .echo-image-placeholder {
  font-size: 30px;
}

.echo-image--detail .echo-image-placeholder {
  font-size: 64px;
}

.echo-image--variant .echo-image-placeholder {
  font-size: 38px;
}

@media (prefers-reduced-motion: reduce) {
  .echo-image-img {
    transition: none;
  }
}
</style>
