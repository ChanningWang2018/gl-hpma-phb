<template>
  <section class="challenge-result" :aria-label="t('resultTitle')">
    <h3 class="result-title">{{ t('resultTitle') }}</h3>

    <div class="result-grade">
      <!-- 复习局：新纪录徽标位改为覆盖行 + 进度条；全覆盖追加里程碑行 -->
      <template v-if="isReviewResult && reviewSummary">
        <p class="record-badge">{{ reviewSummaryLine }}</p>
        <div class="coverage-bar result-coverage-bar" aria-hidden="true">
          <div
            class="coverage-fill"
            :style="{ '--pct': reviewSummary.pct + '%' }"
          ></div>
        </div>
        <p
          v-for="milestone in reviewMilestones"
          :key="milestone"
          class="round-rolled"
        >
          {{ milestone }}
        </p>
      </template>
      <p v-else-if="lastResult && lastResult.newRecord" class="record-badge">
        {{ t('newRecord') }}
      </p>
      <p class="owl-code" aria-hidden="true">{{ owlCode }}</p>
      <p class="owl-name">{{ owlName }}</p>
    </div>

    <div class="stat-table">
      <p v-for="(row, rowIndex) in statRows" :key="rowIndex" class="stat-row">
        {{ row }}
      </p>
    </div>

    <button type="button" class="ghost-btn share-btn" @click="copyShare">
      {{ copied ? t('shareCopied') : t('shareCopy') }}
    </button>

    <!-- 错题回顾 -->
    <section
      v-if="wrongRows.length"
      class="wrong-review"
      :aria-label="t('wrongReview')"
    >
      <h4 class="review-title">{{ t('wrongReview') }}</h4>
      <article v-for="row in wrongRows" :key="row.id" class="review-item">
        <p class="review-stem">
          <template
            v-for="(segment, segmentIndex) in row.stemSegments"
            :key="segmentIndex"
          >
            <span
              v-if="segment.mark"
              class="seg"
              :class="'seg-' + segment.mark"
              >{{ segment.text }}</span
            >
            <template v-else>{{ segment.text }}</template>
          </template>
        </p>
        <p v-if="row.chosenText" class="review-chosen">
          <span class="review-strike">{{ row.chosenText }}</span>
        </p>
        <p class="review-correct">{{ row.correctText }}</p>
        <p class="review-explanation">
          <template
            v-for="(segment, segmentIndex) in row.explanationSegments"
            :key="segmentIndex"
          >
            <span
              v-if="segment.mark"
              class="seg"
              :class="'seg-' + segment.mark"
              >{{ segment.text }}</span
            >
            <template v-else>{{ segment.text }}</template>
          </template>
        </p>
      </article>
    </section>
    <p v-else class="no-wrong">{{ t('noWrong') }}</p>

    <footer class="result-actions">
      <button type="button" class="primary-btn" @click="retry">
        {{ t('retryChallenge') }}
      </button>
      <button type="button" class="ghost-btn" @click="backToSetup">
        {{ t('backToSetup') }}
      </button>
    </footer>
  </section>
</template>

<script>
// ChallengeResult — challenge 成绩单态屏（壳 QuizChallenge 三态路由中
// session 已清空、lastResult 就位的一态）：O.W.L. 评级大字、复习局覆盖
// 汇总、四行统计、复制成绩与错题回顾。复制确认是纯展示状态（2 秒归位），
// 卸载时清掉定时器。
import { lookupText, sanitizeMarkup } from '@/services/quizClient.js';
import { QuizService } from '@/services/quizService.js';
import { translate } from '@/services/quizLocale.js';
import { useQuizStore } from '@/stores/quizStore.js';

export default {
  name: 'ChallengeResult',
  setup() {
    const quizStore = useQuizStore();
    return { quizStore };
  },
  data() {
    return {
      // 复制成绩后的 2 秒确认文案
      copied: false,
      copiedTimer: null,
    };
  },
  computed: {
    lastResult() {
      return this.quizStore.lastResult;
    },

    // ---- 成绩单态 ----
    owlCode() {
      return this.lastResult?.owl?.code ?? '';
    },

    owlName() {
      const key = this.lastResult?.owl?.key;
      return key ? this.t(key) : '';
    },

    // ---- 成绩单态（复习局覆盖行） ----
    isReviewResult() {
      return this.lastResult?.config?.draw === 'review';
    },

    // 复习局覆盖汇总：coveredNow 来自 applyProgress；剩余/百分比按本局
    // 相关科目合计（mixed 两科相加），已滚轮科目 seen 清零即自然回到低格
    reviewSummary() {
      const review = this.lastResult?.review;
      if (!review) return null;
      const bank = this.lastResult?.config?.bank;
      const bankIds = bank === 'mixed' ? [...QuizService.BANK_IDS] : [bank];
      let seen = 0;
      let total = 0;
      for (const bankId of bankIds) {
        const stat = review.stats?.[bankId];
        if (!stat) continue;
        seen += stat.seen;
        total += stat.total;
      }
      return {
        coveredNow: review.coveredNow ?? 0,
        remaining: Math.max(0, total - seen),
        pct: total > 0 ? (seen / total) * 100 : 0,
      };
    },

    // 「本轮新覆盖 {n} 题 · 剩 {m} 题」
    reviewSummaryLine() {
      const summary = this.reviewSummary;
      if (!summary) return '';
      return `${this.t('reviewCovered', { n: summary.coveredNow })} · ${this.t('reviewRemaining', { n: summary.remaining })}`;
    },

    // 轮次里程碑行：全覆盖的科目各出一条（取其新轮次）；同轮去重免撞行
    reviewMilestones() {
      const review = this.lastResult?.review;
      if (!review?.rolledBanks?.length) return [];
      const lines = review.rolledBanks.map((bankId) =>
        this.t('roundRolled', { round: review.stats?.[bankId]?.round ?? 1 }),
      );
      return [...new Set(lines)];
    },

    statRows() {
      const result = this.lastResult;
      if (!result) return [];
      const locale = this.quizStore.locale;
      return [
        this.t('statCorrect', {
          correct: result.correctCount,
          total: result.total,
        }),
        this.t('statAccuracy', { pct: Math.round(result.accuracy) }),
        this.t('statTime', {
          // 成绩单精度到 0.01 秒（作答中的读秒仍为整数秒）
          time: QuizService.formatDuration(result.totalMs, locale, 2),
        }),
        this.t('statAvg', {
          time: QuizService.formatDuration(result.avgMs, locale, 2),
        }),
      ];
    },

    // 错题回顾行（correct=false 的 perQuestion，携带渲染所需的全部文本）
    wrongRows() {
      const result = this.lastResult;
      if (!result) return [];
      return result.perQuestion
        .filter((row) => !row.correct)
        .map((row) => ({
          id: row.item.id,
          stemSegments: this.segments(this.lookup(row.item.question)),
          chosenText:
            row.chosenNo != null
              ? this.plain(this.optionTextOf(row.item, row.chosenNo))
              : '',
          correctText: this.plain(this.optionTextOf(row.item, row.correctNo)),
          explanationSegments: this.segments(this.lookup(row.item.explanation)),
        }));
    },
  },

  beforeUnmount() {
    clearTimeout(this.copiedTimer);
  },

  methods: {
    // 词典查找：模板内调用并读取 store.locale，切换语言即时生效
    t(key, params) {
      return translate(this.quizStore.locale, key, params);
    },

    // 双语数据取值（zh 回退内置）
    lookup(bilingual) {
      return lookupText(bilingual, this.quizStore.locale);
    },

    // 内联标记解析为渲染安全的段落
    segments(text) {
      return sanitizeMarkup(text ?? '');
    },

    // 纯文本拼串（回顾里内联引用选项文本时用）
    plain(bilingual) {
      return this.segments(this.lookup(bilingual))
        .map((segment) => segment.text)
        .join('');
    },

    optionTextOf(item, no) {
      const option = (item?.options ?? []).find(
        (candidate) => candidate.no === no,
      );
      return option ? option.text : null;
    },

    // 再来一次：沿用成绩单里的实际作答配置（count 是真实题量）
    retry() {
      const config = this.lastResult?.config;
      if (config) this.quizStore.startChallenge({ ...config });
    },

    // 调整设置：store 的 quitChallenge 同时清 session 与 lastResult，
    // session 已空时即回到配置态
    backToSetup() {
      this.quizStore.quitChallenge();
    },

    // 复制成绩：Clipboard API 优先，execCommand 兜底；成功后展示 2 秒确认
    async copyShare() {
      const result = this.lastResult;
      if (!result) return;
      const text = QuizService.formatShareText({
        result,
        url: `${window.location.origin}/quiz`,
        locale: this.quizStore.locale,
      });
      let copied = false;
      try {
        if (
          typeof navigator !== 'undefined' &&
          navigator.clipboard?.writeText
        ) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch (error) {
        console.error('Clipboard write failed, falling back:', error);
      }
      if (!copied) copied = this.legacyCopy(text);
      if (copied) {
        this.copied = true;
        clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => {
          this.copied = false;
        }, 2000);
      }
    },

    // 降级路径：隐藏 textarea + execCommand('copy')
    legacyCopy(text) {
      if (typeof document === 'undefined') return false;
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (error) {
        console.error('execCommand copy failed:', error);
      }
      document.body.removeChild(textarea);
      return copied;
    },
  },
};
</script>

<style scoped>
/* ---- 通用控件：主按钮 / 幽灵按钮（仿 CardCodex；三个子屏暂时各自持有，
   后续任务以公共组件收编） ---- */
.primary-btn {
  min-height: 44px;
  padding: 0 26px;
  font-family: var(--font-type);
  font-size: 14px;
  letter-spacing: 0.06em;
  color: var(--paper-light);
  background: var(--oxblood);
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: background-color 0.25s;
}

.primary-btn:hover {
  background: var(--ink);
}

.primary-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 2px;
}

.ghost-btn {
  min-height: 44px;
  padding: 0 22px;
  font-family: var(--font-type);
  font-size: 13px;
  color: var(--ink-faded);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 0.25s,
    border-color 0.25s;
}

.ghost-btn:hover {
  color: var(--oxblood);
  border-color: var(--oxblood);
}

.ghost-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 2px;
}

/* ---- 内联标记段落：focus 金墨下划线、warn 血红 ---- */
.seg-focus {
  text-decoration: underline;
  text-decoration-color: var(--gold-ink);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.seg-warn {
  color: var(--oxblood);
  text-decoration: underline;
  text-decoration-color: var(--oxblood);
  text-underline-offset: 3px;
}

/* ---- 成绩单态 ---- */
.challenge-result {
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
}

.result-title {
  margin: 0 0 6px;
  padding-bottom: 12px;
  border-bottom: 3px double var(--ink);
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 20px;
  letter-spacing: 0.04em;
  color: var(--ink);
}

.result-grade {
  margin: 18px 0 8px;
}

.record-badge {
  display: inline-block;
  margin: 0 0 10px;
  padding: 3px 12px;
  border: 1.5px solid var(--gold-leaf);
  border-radius: 2px;
  font-family: var(--font-type);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--gold-ink);
}

/* 复习局覆盖条：与配置态同一条细线，居中收窄配合成绩单版式
   （.coverage-bar/.coverage-fill 与配置态暂时重复，后续任务收编） */
.result-coverage-bar {
  max-width: 320px;
  margin: 2px auto 0;
}

.coverage-bar {
  height: 3px;
  background: var(--rule);
  border-radius: 1px;
  overflow: hidden;
}

.coverage-fill {
  width: var(--pct, 0%);
  height: 100%;
  background: var(--gold-leaf);
}

.round-rolled {
  margin: 10px 0 0;
  font-family: var(--font-type);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--gold-ink);
}

.owl-code {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(64px, 14vw, 110px);
  line-height: 1;
  color: var(--ink);
}

.owl-name {
  margin: 6px 0 0;
  font-family: var(--font-type);
  font-size: 14px;
  letter-spacing: 0.1em;
  color: var(--oxblood);
}

.stat-table {
  max-width: 380px;
  margin: 18px auto 20px;
}

.stat-row {
  margin: 0;
  padding: 9px 0;
  border-top: 1px solid var(--rule);
  font-family: var(--font-type);
  font-size: 13px;
  color: var(--ink);
}

.stat-row:last-child {
  border-bottom: 1px solid var(--rule);
}

.share-btn {
  margin-bottom: 4px;
}

.wrong-review {
  margin-top: 22px;
  padding-top: 14px;
  border-top: 3px double var(--ink);
  text-align: left;
}

.review-title {
  margin: 0 0 4px;
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 17px;
  color: var(--ink);
}

.review-item {
  padding: 12px 0;
  border-top: 1px solid var(--rule);
}

.review-item:first-of-type {
  border-top: none;
  padding-top: 8px;
}

.review-stem {
  margin: 0 0 6px;
  font-size: 14px;
  line-height: 1.6;
}

.review-chosen {
  margin: 0 0 4px;
  font-family: var(--font-type);
  font-size: 12px;
  color: var(--oxblood);
}

.review-strike {
  text-decoration: line-through;
}

.review-correct {
  margin: 0 0 6px;
  font-family: var(--font-type);
  font-size: 12px;
  color: var(--teal-ink);
}

.review-explanation {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-faded);
}

.no-wrong {
  margin: 22px 0;
  font-family: var(--font-type);
  font-size: 13px;
  color: var(--teal-ink);
}

.result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 8px;
  padding-top: 18px;
  border-top: 3px double var(--ink);
}

/* ---- 响应式 ---- */
@media (max-width: 768px) {
  .challenge-result {
    max-width: none;
  }
}

@media (max-width: 480px) {
  .owl-code {
    font-size: 64px;
  }

  .result-actions .primary-btn,
  .result-actions .ghost-btn {
    flex: 1;
  }
}
</style>
