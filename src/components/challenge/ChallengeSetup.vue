<template>
  <section class="challenge-setup" :aria-label="t('setupTitle')">
    <h3 class="setup-title">{{ t('setupTitle') }}</h3>

    <div class="setup-field">
      <span class="field-label">{{ t('bankLabel') }}</span>
      <div class="type-segment" role="group" :aria-label="t('bankLabel')">
        <button
          v-for="choice in bankChoices"
          :key="choice.value"
          type="button"
          class="type-btn"
          :class="{ active: draft.bank === choice.value }"
          @click="draft.bank = choice.value"
        >
          {{ choice.label }}
        </button>
      </div>
    </div>

    <div class="setup-field">
      <span class="field-label">{{ t('drawLabel') }}</span>
      <div class="type-segment" role="group" :aria-label="t('drawLabel')">
        <button
          v-for="choice in drawChoices"
          :key="choice.value"
          type="button"
          class="type-btn"
          :class="{ active: draft.draw === choice.value }"
          @click="setDraw(choice.value)"
        >
          {{ choice.label }}
        </button>
      </div>
    </div>

    <div class="setup-field">
      <span class="field-label">{{ t('countLabel') }}</span>
      <div class="type-segment" role="group" :aria-label="t('countLabel')">
        <button
          v-for="choice in countChoices"
          :key="choice.value"
          type="button"
          class="type-btn"
          :class="{ active: draft.count === choice.value }"
          @click="draft.count = choice.value"
        >
          {{ choice.label }}
        </button>
      </div>
    </div>

    <div class="setup-field">
      <span class="field-label">{{ t('modeLabel') }}</span>
      <div class="type-segment" role="group" :aria-label="t('modeLabel')">
        <button
          v-for="choice in modeChoices"
          :key="choice.value"
          type="button"
          class="type-btn"
          :class="{ active: draft.mode === choice.value }"
          @click="draft.mode = choice.value"
        >
          {{ choice.label }}
        </button>
      </div>
      <p v-if="draft.mode === 'prefect'" class="prefect-blurb">
        {{ t('prefectBlurb') }}
      </p>
    </div>

    <!-- 复习抽题：本地最佳换成覆盖块（每相关科目一行 + 报纸风细线进度条） -->
    <div v-if="draft.draw === 'review'" class="coverage-block">
      <div v-for="row in coverageRows" :key="row.bankId" class="coverage-row">
        <p class="coverage-text">{{ row.text }}</p>
        <div class="coverage-bar" aria-hidden="true">
          <div
            class="coverage-fill"
            :style="{ '--pct': row.pct + '%' }"
          ></div>
        </div>
      </div>
      <p class="prefect-blurb">{{ t('reviewBlurb') }}</p>
      <button type="button" class="reset-btn" @click="resetProgress">
        {{ t('resetProgress') }}
      </button>
    </div>
    <p v-else class="best-line" role="status">{{ bestText }}</p>

    <button type="button" class="primary-btn" @click="start">
      {{ t('startChallenge') }}
    </button>
  </section>
</template>

<script>
// ChallengeSetup — challenge 配置态屏：科目 / 抽题方式 / 题量 / 模式四段
// 选择 + 复习覆盖块（或本地最佳行）+ 开考。draft 草稿是纯 UI 选择，不入
// store；开考时整份交给 store.startChallenge，被 session 生命周期接管。
// （壳 QuizChallenge 按三态路由：session 与 lastResult 均为空时渲染本屏。）
import { QuizService } from '@/services/quizService.js';
import { translate } from '@/services/quizLocale.js';
import { useQuizStore } from '@/stores/quizStore.js';

export default {
  name: 'ChallengeSetup',
  setup() {
    const quizStore = useQuizStore();
    return { quizStore };
  },
  data() {
    return {
      // 配置态草稿（纯 UI 选择，不入 store；开考后被 session 覆盖）。
      // draw = 抽题方式：'random' 整池盲抽 | 'review' 未做优先全量复习
      draft: {
        // 默认科目：魔法史（题库主力；mixed 双科仍可手动选）
        bank: 'history_of_magic',
        draw: 'random',
        count: QuizService.CHALLENGE_COUNTS[0],
        mode: QuizService.MODES[0],
      },
    };
  },
  computed: {
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

    start() {
      this.quizStore.startChallenge({ ...this.draft });
    },

    // 切换抽题方式：两档题量分段不同，切档即重置为该档默认题量
    // （随机 10 / 复习 25）——即使旧值在两档都存在也重置，保证切档
    // 后的选中项总是该档的起点，不残留上一档的选择
    setDraw(value) {
      if (this.draft.draw === value) return;
      this.draft.draw = value;
      const counts =
        value === 'review'
          ? QuizService.REVIEW_COUNTS
          : QuizService.CHALLENGE_COUNTS;
      this.draft.count = counts[0];
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
/* ---- 通用控件：分段钮 / 主按钮（仿 CardCodex；三个子屏暂时各自持有，
   后续任务以公共组件收编） ---- */
.field-label {
  display: block;
  margin-bottom: 6px;
  font-family: var(--font-type);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--ink-faded);
}

.type-segment {
  display: inline-flex;
  flex-wrap: wrap;
  border: 1.5px solid var(--ink);
  border-radius: 2px;
  overflow: hidden;
}

.type-btn {
  min-height: 40px;
  padding: 0 16px;
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

.type-btn:last-child {
  border-right: none;
}

.type-btn:hover {
  color: var(--ink);
  background: rgba(var(--ink-rgb), 0.05);
}

.type-btn.active {
  background: var(--ink);
  color: var(--paper-light);
}

.type-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: -2px;
}

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

/* ---- 配置态 ---- */
.challenge-setup {
  max-width: 620px;
}

.setup-title {
  margin: 0 0 16px;
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 22px;
  color: var(--ink);
}

.setup-field {
  margin-bottom: 14px;
}

.prefect-blurb {
  margin: 8px 0 0;
  padding-left: 10px;
  border-left: 3px solid var(--gold-leaf);
  font-family: var(--font-type);
  font-size: 12px;
  line-height: 1.6;
  color: var(--gold-ink);
}

.best-line {
  margin: 4px 0 18px;
  font-family: var(--font-type);
  font-size: 12px;
  color: var(--ink-faded);
}

/* ---- 覆盖块（复习抽题）：细线进度条 --rule 底 / --gold-leaf 填充 ---- */
.coverage-block {
  margin: 4px 0 18px;
}

.coverage-row {
  margin-bottom: 10px;
}

.coverage-text {
  margin: 0 0 6px;
  font-family: var(--font-type);
  font-size: 12px;
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

/* 重置复习进度：小字文本钮，触控高度照守 40px 底线 */
.reset-btn {
  min-height: 40px;
  padding: 0 2px;
  background: none;
  border: none;
  font-family: var(--font-type);
  font-size: 11px;
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
@media (max-width: 768px) {
  .challenge-setup {
    max-width: none;
  }
}

@media (max-width: 480px) {
  .type-segment {
    display: flex;
    width: 100%;
  }

  .type-btn {
    flex: 1;
    justify-content: center;
    padding: 0 8px;
  }
}
</style>
