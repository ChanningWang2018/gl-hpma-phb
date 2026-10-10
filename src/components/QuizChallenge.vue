<template>
  <section class="quiz-challenge" :aria-label="t('tabChallenge')">
    <!-- 配置态：session 与 lastResult 均为空 -->
    <ChallengeSetup v-if="isSetup" />
    <!-- 作答态：session 非空 -->
    <ChallengeRun v-else-if="session" />
    <!-- 成绩单态：session 已清空、lastResult 就位 -->
    <ChallengeResult v-else />
  </section>
</template>

<script>
// QuizChallenge — the timed challenge flow of /quiz (docs/quiz.md T6):
// setup -> play -> O.W.L. report card. All business state lives in the
// quiz store (session lifecycle, grading, best records); this component is
// only the three-state shell and routes to the state screens, each of which
// reads the store directly and owns its own display concerns:
// - challenge/ChallengeSetup   配置态：draft 草稿、覆盖块/本地最佳、开考
// - challenge/ChallengeRun     作答态：读秒时钟、快捷键、反馈讲解、钉底条
// - challenge/ChallengeResult  成绩单态：评级大字、统计、复制成绩、错题回顾
import ChallengeResult from '@/components/challenge/ChallengeResult.vue';
import ChallengeRun from '@/components/challenge/ChallengeRun.vue';
import ChallengeSetup from '@/components/challenge/ChallengeSetup.vue';
import { translate } from '@/services/quizLocale.js';
import { useQuizStore } from '@/stores/quizStore.js';

export default {
  name: 'QuizChallenge',
  components: { ChallengeSetup, ChallengeRun, ChallengeResult },
  setup() {
    const quizStore = useQuizStore();
    return { quizStore };
  },
  computed: {
    // 三态路由（startChallenge 复位 lastResult、advance 清空 session，
    // 所以三者互斥）：isSetup = 无 session 且无 lastResult
    isSetup() {
      return !this.quizStore.session && !this.quizStore.lastResult;
    },

    session() {
      return this.quizStore.session;
    },
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
.quiz-challenge {
  font-family: var(--font-sans);
  color: var(--ink);
}

/* 弱动效偏好下关掉全部按钮过渡：三个子屏的按钮也要覆盖，故用 :deep
   下探（scoped 只作用到本壳自身的元素） */
@media (prefers-reduced-motion: reduce) {
  .quiz-challenge :deep(button) {
    transition: none;
  }
}
</style>
