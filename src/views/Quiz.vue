<template>
  <div class="quiz-page">
    <!-- 栏目标题 + 数据说明（公共页头；语言切换在全局 SiteHeader） -->
    <PageHead>
      <h1 class="page-title">
        Magic Quiz <span class="page-title-zh">魔法测验</span>
      </h1>
      <template #note>
        {{ t('note', { total: quizStore.totalQuestions }) }}
        <span v-if="quizStore.versionInfo" class="version-badge">{{
          t('versionBadge', {
            version: quizStore.versionInfo.version,
            total: quizStore.totalQuestions,
          })
        }}</span>
      </template>
    </PageHead>

    <!-- 双栏切换（数据就绪后出现）。作答会话进行中隐藏：session 即沉浸，
         答题期间不再提供切去题库检索的入口；交卷进成绩单 / 放弃回配置后
         session 清空，tab 条恢复（成绩单态显示 tab 是预期） -->
    <SegmentControl
      v-if="!quizStore.loading && !quizStore.error && !quizStore.session"
      class="tab-segment"
      role="tablist"
      :options="tabs"
      :model-value="quizStore.tab"
      @update:model-value="quizStore.setTab($event)"
    />

    <!-- 加载 / 错误态 -->
    <p v-if="quizStore.loading" class="quiz-state">{{ t('loading') }}</p>
    <div v-else-if="quizStore.error" class="quiz-state quiz-error">
      <p>{{ t('loadError') }}</p>
      <PressButton @click="quizStore.loadQuiz()">{{ t('retry') }}</PressButton>
    </div>

    <!-- 内容区：题库检索 / 答题挑战 -->
    <template v-else>
      <QuizBankBrowser v-if="quizStore.tab === 'bank'" />
      <QuizChallenge v-else />
    </template>
  </div>
</template>

<script>
import QuizBankBrowser from '@/components/QuizBankBrowser.vue';
import QuizChallenge from '@/components/QuizChallenge.vue';
import PageHead from '@/components/ui/PageHead.vue';
import PressButton from '@/components/ui/PressButton.vue';
import SegmentControl from '@/components/ui/SegmentControl.vue';
import { computed } from 'vue';
import { useHead } from '@vueuse/head';
import { translate } from '@/services/quizLocale.js';
import { useQuizStore } from '@/stores/quizStore.js';

export default {
  name: 'Quiz',
  components: {
    PageHead,
    PressButton,
    QuizBankBrowser,
    QuizChallenge,
    SegmentControl,
  },
  setup() {
    const quizStore = useQuizStore();
    // 页面标题/描述随全站语言切换；en 文案维持原样，zh 为对应自然翻译
    useHead(
      computed(() => ({
        title:
          quizStore.locale === 'zh'
            ? '魔法测验 · my little hpma bits'
            : 'HPMA Magic Quiz - Every Question, Answered',
        meta: [
          {
            name: 'description',
            content:
              quizStore.locale === 'zh'
                ? '收录《哈利波特：魔法觉醒》全部 1847 道课堂问答题——魔法史与麻瓜研究——支持中英文检索，另有计时 O.W.L. 评级挑战与只有选项的级长模式。'
                : 'All 1847 Harry Potter: Magic Awakened class quiz questions - History of Magic and Muggle Studies - searchable in Chinese/English, plus a timed O.W.L.-graded challenge with the options-only Prefect mode.',
          },
        ],
      })),
    );
    return { quizStore };
  },
  computed: {
    tabs() {
      return [
        { value: 'bank', label: this.t('tabBank') },
        { value: 'challenge', label: this.t('tabChallenge') },
      ];
    },
  },
  mounted() {
    this.quizStore.loadQuiz();
  },
  methods: {
    // 词典查找：模板内调用并读取 store.locale，切换语言即时生效
    t(key, params) {
      return translate(this.quizStore.locale, key, params);
    },
  },
};
</script>

<style scoped>
.quiz-page {
  padding: var(--space-5) var(--space-6) var(--space-7);
}

/* tab 条与正文的间距留在使用方（分段钮本身不带外边距） */
.tab-segment {
  margin-bottom: var(--space-4);
}

/* 纯文本徽标（不做超链接跳转，2026-10-10 用户要求） */
.version-badge {
  margin-left: var(--space-2);
  color: var(--teal-ink);
}

/* ---- 加载 / 错误态 ---- */
.quiz-state {
  font-family: var(--font-type);
  font-size: var(--type-body);
  color: var(--ink-faded);
  padding: var(--space-7) 0;
  text-align: center;
}

.quiz-error p {
  margin-bottom: var(--space-3);
}

@media (max-width: 768px) {
  .quiz-page {
    padding: var(--space-5) var(--space-4) var(--space-5);
  }
}

@media (max-width: 480px) {
  .quiz-page {
    padding: var(--space-4) var(--space-3) var(--space-5);
  }
}
</style>
