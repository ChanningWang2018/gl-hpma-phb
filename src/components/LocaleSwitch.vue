<template>
  <!-- 版次式语言切换：并排两个"版次"，当前版墨色 + 金线下划，非当前淡墨。
       文案恒为 中文 / EN（标签本身不随语言变化）。 -->
  <div
    class="locale-switch"
    role="group"
    :aria-label="toggleLabel"
    :title="toggleLabel"
  >
    <button
      type="button"
      class="locale-option"
      :class="{ current: isCurrent('zh') }"
      :aria-pressed="isCurrent('zh') ? 'true' : 'false'"
      @click="switchTo('zh')"
    >
      中文
    </button>
    <span class="locale-sep" aria-hidden="true">·</span>
    <button
      type="button"
      class="locale-option"
      :class="{ current: isCurrent('en') }"
      :aria-pressed="isCurrent('en') ? 'true' : 'false'"
      @click="switchTo('en')"
    >
      EN
    </button>
  </div>
</template>

<script>
import { computed } from 'vue';
import { MESSAGES, translateMessage } from '@/services/siteLocale.js';
import { useLocaleStore } from '@/stores/localeStore.js';

export default {
  name: 'LocaleSwitch',
  setup() {
    const localeStore = useLocaleStore();

    // 可及性文案随当前语言走（"切换语言" / "Switch language"）
    const toggleLabel = computed(() =>
      translateMessage(MESSAGES, localeStore.locale, 'languageToggle'),
    );

    const isCurrent = (value) => localeStore.locale === value;

    // 点当前版是无效操作，点另一版切全站语言（setLocale 内部规范化 + 持久化）
    const switchTo = (value) => localeStore.setLocale(value);

    return { localeStore, toggleLabel, isCurrent, switchTo };
  },
};
</script>

<style scoped>
.locale-switch {
  display: inline-flex;
  align-items: baseline;
  /* 控件整体不拆散：窄屏随头行（flex-wrap）整体换行，两个版次永不分离 */
  flex-wrap: nowrap;
  white-space: nowrap;
  gap: 8px;
}

.locale-option {
  font-family: var(--font-type);
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--ink-faded);
  background: transparent;
  border: none;
  /* 两侧常驻 2px 透明下边线：切到当前版出金线时不跳动；
     13px 文字 + 上下 13px padding + 2px 边线 ≈ 41px 触控高度（不设死 height） */
  border-bottom: 2px solid transparent;
  padding: 13px 2px;
  cursor: pointer;
  transition:
    color 0.25s,
    border-color 0.25s;
}

.locale-option:hover {
  color: var(--ink);
}

.locale-option.current {
  color: var(--ink);
  border-bottom-color: var(--gold-leaf);
}

.locale-option:focus-visible {
  outline: none;
  border-radius: 2px;
  box-shadow: 0 0 0 2px rgba(var(--gold-rgb), 0.25);
}

.locale-sep {
  font-family: var(--font-type);
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--rule);
}
</style>
