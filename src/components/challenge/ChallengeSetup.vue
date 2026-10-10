<template>
  <section class="challenge-setup" :aria-label="t('setupTitle')">
    <h3 class="setup-title">{{ t('setupTitle') }}</h3>

    <div class="setup-field">
      <span class="field-label">{{ t('bankLabel') }}</span>
      <SegmentControl
        role="group"
        :aria-label="t('bankLabel')"
        :options="bankChoices"
        :model-value="draft.bank"
        @update:model-value="updateDraft({ bank: $event })"
      />
    </div>

    <div class="setup-field">
      <span class="field-label">{{ t('drawLabel') }}</span>
      <SegmentControl
        role="group"
        :aria-label="t('drawLabel')"
        :options="drawChoices"
        :model-value="draft.draw"
        @update:model-value="setDraw"
      />
    </div>

    <div class="setup-field">
      <span class="field-label">{{ t('countLabel') }}</span>
      <SegmentControl
        role="group"
        :aria-label="t('countLabel')"
        :options="countChoices"
        :model-value="draft.count"
        @update:model-value="updateDraft({ count: $event })"
      />
    </div>

    <div class="setup-field">
      <span class="field-label">{{ t('modeLabel') }}</span>
      <SegmentControl
        role="group"
        :aria-label="t('modeLabel')"
        :options="modeChoices"
        :model-value="draft.mode"
        @update:model-value="updateDraft({ mode: $event })"
      />
      <p v-if="draft.mode === 'prefect'" class="prefect-blurb">
        {{ t('prefectBlurb') }}
      </p>
    </div>

    <!-- 复习抽题：本地最佳换成覆盖块（每相关科目一行 + 报纸风细线进度条） -->
    <div v-if="draft.draw === 'review'" class="coverage-block">
      <div v-for="row in coverageRows" :key="row.bankId" class="coverage-row">
        <p class="coverage-text">{{ row.text }}</p>
        <div class="coverage-bar" aria-hidden="true">
          <div class="coverage-fill" :style="{ '--pct': row.pct + '%' }"></div>
        </div>
      </div>
      <p class="prefect-blurb">{{ t('reviewBlurb') }}</p>
      <button type="button" class="reset-btn" @click="resetProgress">
        {{ t('resetProgress') }}
      </button>
    </div>
    <p v-else class="best-line" role="status">{{ bestText }}</p>

    <PressButton class="start-btn" @click="start">
      {{ t('startChallenge') }}
    </PressButton>
  </section>
</template>

<script>
// ChallengeSetup — challenge 配置态屏：科目 / 抽题方式 / 题量 / 模式四段
// 选择 + 复习覆盖块（或本地最佳行）+ 开考。draft 草稿挂 quizStore
// （setupDraft + updateSetupDraft）：作答/成绩单态期间本组件被卸载，
// 草稿仍在 store 里，成绩单「调整设置」返回时保留用户选择。开考时整份
// 交给 store.startChallenge，被 session 生命周期接管。
// （壳 QuizChallenge 按三态路由：session 与 lastResult 均为空时渲染本屏。）
import PressButton from '@/components/ui/PressButton.vue';
import SegmentControl from '@/components/ui/SegmentControl.vue';
import { QuizService } from '@/services/quizService.js';
import { translate } from '@/services/quizLocale.js';
import { useQuizStore } from '@/stores/quizStore.js';

export default {
  name: 'ChallengeSetup',
  components: { PressButton, SegmentControl },
  setup() {
    const quizStore = useQuizStore();
    return { quizStore };
  },
  computed: {
    // 配置态草稿：直接读 store（写入走 updateSetupDraft action）
    draft() {
      return this.quizStore.setupDraft;
    },

    // ---- 配置态 ----
    bankChoices() {
      return [
        { value: 'history_of_magic', label: this.t('bankHistory') },
        { value: 'muggle_studies', label: this.t('bankMuggle') },
        { value: 'mixed', label: this.t('bankMixed') },
      ];
    },

    // 抽题方式两档（词典文案；顺序即模板顺序：随机在前为默认）
    drawChoices() {
      return [
        { value: 'random', label: this.t('drawRandom') },
        { value: 'review', label: this.t('drawReview') },
      ];
    },

    // 题量分段随抽题方式切换：随机 [10, 25, 50] / 复习 [25, 50, 100]
    countChoices() {
      const counts =
        this.draft.draw === 'review'
          ? QuizService.REVIEW_COUNTS
          : QuizService.CHALLENGE_COUNTS;
      return counts.map((count) => ({ value: count, label: String(count) }));
    },

    modeChoices() {
      return QuizService.MODES.map((mode) => ({
        value: mode,
        label: this.t(mode === 'normal' ? 'modeNormal' : 'modePrefect'),
      }));
    },

    bestText() {
      const record =
        this.quizStore.bests[QuizService.bestKey(this.draft)] ?? null;
      if (!record || !record.key) return this.t('bestEmpty');
      return this.t('bestLabel', {
        grade: this.t(record.key),
        correct: record.correctCount,
        total: record.total,
        // 最佳记录与成绩语境用 2 位小数：很多玩家的单题速度在 1 秒内
        time: QuizService.formatDuration(
          record.totalMs,
          this.quizStore.locale,
          2,
        ),
      });
    },

    // 覆盖块行（draw=review 时替换「本地最佳」）：每个相关科目一行
    // 「第 {round} 轮 · 科目：已做 x / y」；mixed 两科都显示。数据取自
    // store.progress（resetProgress 换新对象，这里随响应式即时归零）
    coverageRows() {
      const stats = QuizService.coverageStats(
        this.quizStore.progress,
        this.quizStore.banks,
      );
      const bankIds =
        this.draft.bank === 'mixed'
          ? [...QuizService.BANK_IDS]
          : [this.draft.bank];
      return bankIds
        .filter((bankId) => stats[bankId])
        .map((bankId) => {
          const { round, seen, total } = stats[bankId];
          const label = this.t(
            bankId === 'history_of_magic' ? 'bankHistory' : 'bankMuggle',
          );
          return {
            bankId,
            text: `${this.t('progressRound', { round })} · ${this.t('coverageLine', { bank: label, seen, total })}`,
            pct: total > 0 ? (seen / total) * 100 : 0,
          };
        });
    },
  },

  methods: {
    // 词典查找：模板内调用并读取 store.locale，切换语言即时生效
    t(key, params) {
      return translate(this.quizStore.locale, key, params);
    },

    // 草稿写入统一走 store action（合并式）
    updateDraft(patch) {
      this.quizStore.updateSetupDraft(patch);
    },

    start() {
      this.quizStore.startChallenge({ ...this.draft });
    },

    // 切换抽题方式：两档题量分段不同，切档即重置为该档默认题量
    // （随机 10 / 复习 25）——即使旧值在两档都存在也重置，保证切档
    // 后的选中项总是该档的起点，不残留上一档的选择
    setDraw(value) {
      if (this.draft.draw === value) return;
      const counts =
        value === 'review'
          ? QuizService.REVIEW_COUNTS
          : QuizService.CHALLENGE_COUNTS;
      this.updateDraft({ draw: value, count: counts[0] });
    },

    // 重置复习进度：一次确认后清持久层与 store 状态，覆盖块随之归零
    resetProgress() {
      if (
        typeof window === 'undefined' ||
        window.confirm(this.t('resetProgressConfirm'))
      ) {
        this.quizStore.resetProgress();
      }
    },
  },
};
</script>

<style scoped>
/* ---- 配置态 ---- */
.challenge-setup {
  max-width: 620px;
}

.setup-title {
  margin: 0 0 var(--space-4);
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: var(--type-title);
  color: var(--ink);
}

.setup-field {
  margin-bottom: var(--space-3);
}

.field-label {
  display: block;
  margin-bottom: var(--space-1);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.12em;
  color: var(--ink-faded);
}

.prefect-blurb {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-2);
  border-left: 3px solid var(--gold-leaf);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  line-height: 1.6;
  color: var(--gold-ink);
}

.best-line {
  margin: var(--space-1) 0 var(--space-4);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--ink-faded);
}

/* ---- 覆盖块（复习抽题）：细线进度条 --rule 底 / --gold-leaf 填充 ---- */
.coverage-block {
  margin: var(--space-1) 0 var(--space-4);
}

.coverage-row {
  margin-bottom: var(--space-2);
}

.coverage-text {
  margin: 0 0 var(--space-1);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--ink-faded);
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

/* 重置复习进度：小字文本钮（三级动作，不上 PressButton 档位），触控
   高度照守 40px 底线 */
.reset-btn {
  min-height: 40px;
  padding: 0 2px;
  background: none;
  border: none;
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.08em;
  color: var(--ink-faded);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--rule);
  cursor: pointer;
  transition: color 0.25s;
}

.reset-btn:hover {
  color: var(--oxblood);
}

.reset-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 2px;
}

/* ---- 响应式 ---- */
/* 桌面双列（≥769）：四个 setup-field 两两并排；标题/覆盖块/最佳记录/
   开始按钮横贯整行，行距统一交给 grid gap（覆盖各子块自身外边距） */
@media (min-width: 769px) {
  .challenge-setup {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .setup-title,
  .setup-field,
  .coverage-block,
  .best-line,
  .start-btn {
    margin: 0;
  }

  .setup-title,
  .coverage-block,
  .best-line,
  .start-btn {
    grid-column: 1 / -1;
  }

  /* 按钮保持内容宽，不横贯拉伸 */
  .start-btn {
    justify-self: start;
  }
}

@media (max-width: 768px) {
  .challenge-setup {
    max-width: none;
  }
}
</style>
