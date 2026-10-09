<template>
  <div class="quiz-page">
    <!-- 栏目标题 + 语言切换 -->
    <header class="quiz-head">
      <div class="quiz-head-row">
        <h2 class="quiz-title">
          Magic Quiz <span class="quiz-title-zh">魔法测验</span>
        </h2>
        <button
          type="button"
          class="locale-btn"
          :aria-label="t('languageToggle')"
          :title="t('languageToggle')"
          @click="toggleLocale"
        >
          {{ quizStore.locale === 'zh' ? 'EN' : '中文' }}
        </button>
      </div>
      <p class="quiz-note">
        {{ t('note', { total: quizStore.totalQuestions }) }}
        <span v-if="quizStore.versionInfo" class="version-badge">{{
          t('versionBadge', {
            version: quizStore.versionInfo.version,
            total: quizStore.totalQuestions,
          })
        }}</span>
      </p>
    </header>

    <!-- 双栏切换（数据就绪后出现） -->
    <nav
      v-if="!quizStore.loading && !quizStore.error"
      class="tab-segment"
      role="tablist"
    >
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        class="tab-btn"
        :class="{ active: quizStore.tab === tab.value }"
        :aria-selected="quizStore.tab === tab.value"
        @click="quizStore.setTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- 加载 / 错误态 -->
    <p v-if="quizStore.loading" class="quiz-state">{{ t('loading') }}</p>
    <div v-else-if="quizStore.error" class="quiz-state quiz-error">
      <p>{{ t('loadError') }}</p>
      <button type="button" class="retry-btn" @click="quizStore.loadQuiz()">
        {{ t('retry') }}
      </button>
    </div>

    <!-- 内容区：题库检索 / 答题挑战 -->
    <template v-else>
      <QuizBankBrowser v-if="quizStore.tab === 'bank'" />
      <QuizChallenge v-else />
    </template>
  </div>
</template>

<script>
import { useHead } from '@vueuse/head';
import QuizBankBrowser from '@/components/QuizBankBrowser.vue';
import QuizChallenge from '@/components/QuizChallenge.vue';
import { translate } from '@/services/quizLocale.js';
import { useQuizStore } from '@/stores/quizStore.js';

export default {
  name: 'Quiz',
  components: { QuizBankBrowser, QuizChallenge },
  setup() {
    useHead({
      title: 'HPMA Magic Quiz - Every Question, Answered',
      meta: [
        {
          name: 'description',
          content:
            'All 1847 Harry Potter: Magic Awakened class quiz questions - History of Magic and Muggle Studies - searchable in Chinese/English, plus a timed O.W.L.-graded challenge with the options-only Prefect mode.',
        },
      ],
    });
    const quizStore = useQuizStore();
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

    toggleLocale() {
      this.quizStore.setLocale(this.quizStore.locale === 'zh' ? 'en' : 'zh');
    },
  },
};
</script>

<style scoped>
.quiz-page {
  padding: 26px 30px 40px;
}

/* ---- 头部 ---- */
.quiz-head {
  border-bottom: 3px double var(--ink);
  padding-bottom: 14px;
  margin-bottom: 18px;
}

.quiz-head-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.quiz-title {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: clamp(26px, 4vw, 36px);
  color: var(--ink);
  line-height: 1.15;
}

.quiz-title-zh {
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

.quiz-note {
  font-family: var(--font-type);
  font-size: 12px;
  color: var(--ink-faded);
  margin-top: 8px;
}

/* 纯文本徽标（不做超链接跳转，2026-10-10 用户要求） */
.version-badge {
  margin-left: 10px;
  color: var(--teal-ink);
}

/* ---- 双栏切换 ---- */
.tab-segment {
  display: inline-flex;
  flex-wrap: wrap;
  border: 1.5px solid var(--ink);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 16px;
}

.tab-btn {
  min-height: 40px;
  padding: 0 20px;
  display: inline-flex;
  align-items: center;
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

.tab-btn:last-child {
  border-right: none;
}

.tab-btn:hover {
  color: var(--ink);
  background: rgba(var(--ink-rgb), 0.05);
}

.tab-btn.active {
  background: var(--ink);
  color: var(--paper-light);
}

.tab-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: -2px;
}

/* ---- 加载 / 错误态 ---- */
.quiz-state {
  font-family: var(--font-type);
  font-size: 14px;
  color: var(--ink-faded);
  padding: 48px 0;
  text-align: center;
}

.quiz-error p {
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

@media (max-width: 768px) {
  .quiz-page {
    padding: 20px 15px 30px;
  }
}

@media (max-width: 480px) {
  .quiz-page {
    padding: 16px 12px 26px;
  }

  .tab-segment {
    display: flex;
    width: 100%;
  }

  .tab-btn {
    flex: 1;
    justify-content: center;
    padding: 0 8px;
  }
}
</style>
