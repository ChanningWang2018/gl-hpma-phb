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
      <PressButton @click="retryLoad">{{ t('retry') }}</PressButton>
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
import {
  collectThemes,
  parseQuizQuery,
  resolveQuestion,
  sameQuery,
  serializeQuizQuery,
} from '@/services/quizQuery.js';
import { computed, nextTick, onActivated, onMounted, watch } from 'vue';
import { useHead } from '@vueuse/head';
import { useRoute, useRouter } from 'vue-router';
import { translate } from '@/services/quizLocale.js';
import {
  absoluteUrl,
  buildWebApplicationStructuredData,
  jsonLdScript,
} from '@/services/structuredData.js';
import { useQuizStore } from '@/stores/quizStore.js';

const DESCRIPTION_EN =
  '1847 Harry Potter: Magic Awakened class quiz questions - History of Magic and Muggle Studies - searchable in Chinese/English, plus a timed O.W.L.-graded challenge with the options-only Prefect mode.';
const DESCRIPTION_ZH =
  '收录《哈利波特：魔法觉醒》1847 道课堂问答题——魔法史与麻瓜研究——支持中英文检索，另有计时 O.W.L. 评级挑战与只有选项的级长模式。';

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
    const route = useRoute();
    const router = useRouter();

    // Query <-> store 双向同步（仿 Analytics/CardCodex 的既有模式）。
    // queryReady：首屏加载/回填完成前不写 URL；applyingQuery：query -> store
    // 期间压住反向写，避免 replace 循环；syncingQuery：replace 在途去重。
    let queryReady = false;
    let applyingQuery = 0;
    let syncingQuery = false;

    const isQuestionVisible = ({ bank, id }) =>
      quizStore.searchResults.some(
        (row) => row.bank === bank && Number(row.id) === id,
      );

    // query -> store：?tab / ?bank / ?theme / ?q / ?question。
    // 进行中的挑战会话优先于 URL：keep-alive 切页回来时 URL 绝不覆盖
    // session（session/答案/成绩永远不进 URL）。
    const applyQuery = () => {
      if (route.name !== 'quiz') return;
      applyingQuery += 1;
      try {
        if (quizStore.session) return;
        // Own-sync no-op: if the incoming query is already the canonical
        // projection of the current store, do not re-apply it (this keeps the
        // page/filter state stable after router.replace, e.g. collapsing a
        // question permalink must not jump back to page 1).
        const current = serializeQuizQuery({
          tab: quizStore.tab,
          filters: quizStore.searchFilters,
          challenge: quizStore.setupDraft,
          question: quizStore.highlight,
        });
        if (sameQuery(current, route.query)) return;
        const parsed = parseQuizQuery(route.query, {
          knownThemes: collectThemes(quizStore.banks),
        });
        const question = resolveQuestion(
          quizStore.banks,
          parsed.question,
          parsed.questionBank,
        );
        if (question) {
          // 题目直达优先：打开所属题库并定位；q/theme 若还能看见该题就
          // 保留，否则清掉过滤，保证被分享的题一定出现并高亮
          quizStore.setSearch({
            bank: question.bank,
            theme: parsed.filters.theme,
            query: parsed.filters.query,
          });
          if (!isQuestionVisible(question)) {
            quizStore.setSearch({
              bank: question.bank,
              theme: 'all',
              query: '',
            });
          }
          quizStore.focusQuestion(question);
          return;
        }
        quizStore.setTab(parsed.tab);
        if (parsed.tab === 'challenge') {
          quizStore.clearHighlight();
          quizStore.updateSetupDraft(parsed.challenge);
          return;
        }
        quizStore.setSearch(parsed.filters);
        quizStore.setPage(1);
      } finally {
        // store watcher 在本次 flush 内还会跑；等它们全部结束再放开反向写
        nextTick(() => {
          applyingQuery = Math.max(0, applyingQuery - 1);
        });
      }
    };

    // store -> URL（replace：筛选/配置不该堆历史）。只在 /quiz 路由上写：
    // keep-alive 下组件离开后 watcher 仍活着，不守卫会把 query 写到别页。
    // 分页、session、lastResult 都不在 URL 里。
    const syncQuery = () => {
      if (route.name !== 'quiz') return;
      if (!queryReady || applyingQuery > 0 || syncingQuery) return;
      const query = serializeQuizQuery({
        tab: quizStore.tab,
        filters: quizStore.searchFilters,
        challenge: quizStore.setupDraft,
        question: quizStore.highlight,
      });
      if (sameQuery(query, route.query)) return;
      syncingQuery = true;
      router
        .replace({ name: 'quiz', query })
        .catch(() => {})
        .finally(() => {
          syncingQuery = false;
        });
    };

    // query -> store：浏览器前进/后退、站内链接进站、首次加载都走这里
    watch(() => route.query, applyQuery, { deep: true });

    // store -> URL：页签、题库过滤、挑战草稿、题目锚点变化
    watch(
      () => [
        quizStore.tab,
        quizStore.searchFilters.bank,
        quizStore.searchFilters.theme,
        quizStore.searchFilters.query,
        quizStore.setupDraft.bank,
        quizStore.setupDraft.draw,
        quizStore.setupDraft.count,
        quizStore.setupDraft.mode,
        quizStore.highlight?.bank,
        quizStore.highlight?.id,
      ],
      syncQuery,
    );

    // 首次加载：等题库就绪后再回填 URL（题目直达需要 bank 数据）。首屏
    // 不回写，避免把用户粘贴的合法 URL 立刻改写成规范化形式。
    onMounted(async () => {
      await quizStore.loadQuiz();
      applyQuery();
      await nextTick();
      queryReady = true;
    });

    // keep-alive 重新激活：route.query watcher 一般已触发，这里兜底；
    // 首次 mount 时 queryReady 仍为 false，不会抢跑
    onActivated(() => {
      if (queryReady) applyQuery();
    });

    // 错误态重试：加载成功后补一次回填（题目直达依赖数据）
    const retryLoad = async () => {
      await quizStore.loadQuiz();
      applyQuery();
      await nextTick();
      queryReady = true;
      syncQuery();
    };

    // 页面标题/描述随全站语言切换；en 文案维持原样，zh 为对应自然翻译
    useHead(
      computed(() => {
        const title =
          quizStore.locale === 'zh'
            ? '魔法测验 · my little hpma bits'
            : 'HPMA Magic Quiz - Every Question, Answered';
        const description =
          quizStore.locale === 'zh' ? DESCRIPTION_ZH : DESCRIPTION_EN;
        return {
          title,
          meta: [
            { name: 'description', content: description },
            {
              property: 'og:url',
              content: 'https://grimmauldplace.top/quiz',
            },
          ],
          link: [
            {
              rel: 'canonical',
              href: 'https://grimmauldplace.top/quiz',
            },
          ],
          script: [
            jsonLdScript(
              buildWebApplicationStructuredData({
                name: 'HPMA Magic Quiz',
                description: DESCRIPTION_EN,
                url: absoluteUrl('/quiz'),
              }),
            ),
          ],
        };
      }),
    );
    return { quizStore, retryLoad };
  },
  computed: {
    tabs() {
      return [
        { value: 'bank', label: this.t('tabBank') },
        { value: 'challenge', label: this.t('tabChallenge') },
      ];
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
