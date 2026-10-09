<template>
  <section class="quiz-challenge" :aria-label="t('tabChallenge')">
    <!-- 配置态：session 与 lastResult 均为空 -->
    <section
      v-if="isSetup"
      class="challenge-setup"
      :aria-label="t('setupTitle')"
    >
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

      <p class="best-line" role="status">{{ bestText }}</p>

      <button type="button" class="primary-btn" @click="start">
        {{ t('startChallenge') }}
      </button>
    </section>

    <!-- 作答态：session 非空（选项已由 buildChallenge 洗牌，按序直出） -->
    <section v-else-if="session" class="challenge-run">
      <header class="run-progress">
        <p class="progress-question">
          {{ t('questionN', { n: questionNo, total: questionTotal }) }}
        </p>
        <p class="progress-meta">
          <span class="progress-answered"
            >{{ quizStore.answeredCount }}/{{ questionTotal }}</span
          >
          <span class="progress-clock" role="timer">{{ elapsedLabel }}</span>
        </p>
      </header>

      <p v-if="isPrefect && !answeredFlag" class="prefect-running-tag">
        {{ t('prefectRunning') }}
      </p>

      <div v-if="badges.length" class="badge-row">
        <span
          v-for="badge in badges"
          :key="badge.kind"
          class="q-badge"
          :class="'badge-' + badge.kind"
          :title="
            badge.kind === 'adjudicated' ? t('adjudicatedNote') : undefined
          "
        >
          {{ badge.label }}
        </span>
      </div>

      <!-- 题干区：normal 直出；prefect 作答前隐藏、作答后揭晓 -->
      <div class="stem-block">
        <p v-if="!isPrefect" class="stem-text">
          <template
            v-for="(segment, segmentIndex) in stemSegments"
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
        <p v-else-if="!answeredFlag" class="stem-hidden" aria-hidden="true">
          ？
        </p>
        <div v-else class="stem-reveal">
          <span class="reveal-label">{{ t('prefectReveal') }}</span>
          <p class="stem-text">
            <template
              v-for="(segment, segmentIndex) in stemSegments"
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
        </div>
      </div>

      <!-- 选项：四个大按钮，作答后整体锁定 -->
      <div class="option-list" role="group" :aria-label="t('chooseAnswer')">
        <button
          v-for="(option, optionIndex) in optionRows"
          :key="option.no"
          type="button"
          class="option-btn"
          :class="{
            'is-correct': answeredFlag && option.no === correctNo,
            'is-wrong':
              answeredFlag && option.no === chosenNo && option.no !== correctNo,
          }"
          :disabled="answeredFlag"
          :aria-keyshortcuts="optionIndex + 1 + ' ' + option.letter"
          @click="choose(option.no)"
        >
          <span class="option-key" aria-hidden="true"
            >{{ option.letter }}.</span
          >
          <span class="option-text">
            <template
              v-for="(segment, segmentIndex) in option.segments"
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
          </span>
        </button>
      </div>

      <!-- 即时反馈（锁定后出现，读屏同步播报） -->
      <p
        v-if="answeredFlag"
        class="feedback"
        :class="feedbackClass"
        aria-live="polite"
      >
        {{ feedbackText }}
      </p>

      <div v-if="answeredFlag" class="explanation">
        <span class="explanation-label">{{ t('explanationLabel') }}</span>
        <p class="explanation-text">
          <template
            v-for="(segment, segmentIndex) in explanationSegments"
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
      </div>

      <footer class="run-actions">
        <button type="button" class="primary-btn" @click="next">
          {{ nextLabel }}
        </button>
        <button type="button" class="ghost-btn" @click="quit">
          {{ t('quitChallenge') }}
        </button>
      </footer>
    </section>

    <!-- 成绩单态：session 已清空、lastResult 就位 -->
    <section v-else class="challenge-result" :aria-label="t('resultTitle')">
      <h3 class="result-title">{{ t('resultTitle') }}</h3>

      <div class="result-grade">
        <p v-if="lastResult && lastResult.newRecord" class="record-badge">
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
  </section>
</template>

<script>
// QuizChallenge — the timed challenge flow of /quiz (docs/quiz.md T6):
// setup -> play -> O.W.L. report card. All business state lives in the
// quiz store (session lifecycle, grading, best records); this component only
// drafts the setup choices and drives display-only concerns (elapsed clock,
// copy confirmation). Question/options/explanation text is bilingual data
// resolved via lookupText per store.locale; inline game markup is sanitized
// into marked segments — never rendered as HTML.
import { lookupText, sanitizeMarkup } from '@/services/quizClient.js';
import { QuizService } from '@/services/quizService.js';
import { translate } from '@/services/quizLocale.js';
import { useQuizStore } from '@/stores/quizStore.js';

/** Display letters for the (shuffled) option slots. */
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/** Digit aliases for the optional keyboard shortcuts (1-4 / A-D). */
const DIGIT_KEYS = ['1', '2', '3', '4'];

export default {
  name: 'QuizChallenge',
  setup() {
    const quizStore = useQuizStore();
    return { quizStore };
  },
  data() {
    return {
      // 配置态草稿（纯 UI 选择，不入 store；开考后被 session 覆盖）
      draft: {
        bank: 'mixed',
        count: QuizService.CHALLENGE_COUNTS[0],
        mode: QuizService.MODES[0],
      },
      // 读秒节拍：每秒推进的展示时钟。判分毫秒一律以 store.answerCurrent
      // 内部记录为准，这里只负责把已计入的毫秒 + 当前题未答部分显示出来
      now: Date.now(),
      clock: null,
      // 复制成绩后的 2 秒确认文案
      copied: false,
      copiedTimer: null,
    };
  },
  computed: {
    // 三态路由（startChallenge 复位 lastResult、advance 清空 session，
    // 所以三者互斥）
    isSetup() {
      return !this.session && !this.lastResult;
    },

    session() {
      return this.quizStore.session;
    },

    lastResult() {
      return this.quizStore.lastResult;
    },

    // ---- 作答态 ----
    item() {
      return this.quizStore.currentItem;
    },

    isPrefect() {
      return this.session?.config?.mode === 'prefect';
    },

    questionNo() {
      return (this.session?.index ?? 0) + 1;
    },

    questionTotal() {
      return this.session?.items?.length ?? 0;
    },

    currentAnswer() {
      return this.session?.answers?.[this.session.index] ?? null;
    },

    answeredFlag() {
      const answer = this.currentAnswer;
      return (
        answer != null &&
        answer.chosenNo !== null &&
        answer.chosenNo !== undefined
      );
    },

    chosenNo() {
      return this.currentAnswer?.chosenNo ?? null;
    },

    stemSegments() {
      if (!this.item) return [];
      return this.segments(this.lookup(this.item.question));
    },

    optionRows() {
      if (!this.item) return [];
      return this.item.options.map((option, index) => ({
        no: option.no,
        letter: OPTION_LETTERS[index] ?? '',
        segments: this.segments(this.lookup(option.text)),
      }));
    },

    correctNo() {
      return this.item ? QuizService.answerKey(this.item) : null;
    },

    correctText() {
      if (!this.item || this.correctNo == null) return '';
      const option = this.item.options.find(
        (candidate) => candidate.no === this.correctNo,
      );
      return option ? this.plain(option.text) : '';
    },

    feedbackClass() {
      return this.currentAnswer?.correct ? 'is-correct' : 'is-wrong';
    },

    feedbackText() {
      const answer = this.currentAnswer;
      if (!answer) return '';
      return answer.correct
        ? this.t('feedbackCorrect')
        : this.t('feedbackWrong', { answer: this.correctText });
    },

    explanationSegments() {
      if (!this.item) return [];
      return this.segments(this.lookup(this.item.explanation));
    },

    badges() {
      const markers = this.item?.markers;
      if (!markers) return [];
      const rows = [];
      if (markers.adjudicated) {
        rows.push({ kind: 'adjudicated', label: this.t('badgeAdjudicated') });
      }
      if (markers.conflict) {
        rows.push({ kind: 'conflict', label: this.t('badgeConflict') });
      }
      return rows;
    },

    nextLabel() {
      return this.questionNo < this.questionTotal
        ? this.t('nextQuestion')
        : this.t('finishChallenge');
    },

    /**
     * 展示用时（毫秒）：已答题各题 store 记录的 ms 累加，当前题未答部分
     * 补上 now - presentedAt。与 gradeResult 的 totalMs 口径一致——读到
     * 的秒数就是最终会计入成绩的秒数。
     */
    elapsedMs() {
      const session = this.session;
      if (!session) return 0;
      let total = 0;
      for (const answer of session.answers ?? []) {
        if (answer && typeof answer.ms === 'number') total += answer.ms;
      }
      const current = session.answers?.[session.index];
      const currentDone =
        current != null &&
        current.chosenNo !== null &&
        current.chosenNo !== undefined;
      if (!currentDone) {
        total += Math.max(0, this.now - (session.presentedAt ?? this.now));
      }
      return total;
    },

    elapsedLabel() {
      return QuizService.formatDuration(this.elapsedMs, this.quizStore.locale);
    },

    // ---- 配置态 ----
    bankChoices() {
      return [
        { value: 'history_of_magic', label: this.t('bankHistory') },
        { value: 'muggle_studies', label: this.t('bankMuggle') },
        { value: 'mixed', label: this.t('bankMixed') },
      ];
    },

    countChoices() {
      return QuizService.CHALLENGE_COUNTS.map((count) => ({
        value: count,
        label: String(count),
      }));
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
        time: QuizService.formatDuration(record.totalMs, this.quizStore.locale),
      });
    },

    // ---- 成绩单态 ----
    owlCode() {
      return this.lastResult?.owl?.code ?? '';
    },

    owlName() {
      const key = this.lastResult?.owl?.key;
      return key ? this.t(key) : '';
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
          time: QuizService.formatDuration(result.totalMs, locale),
        }),
        this.t('statAvg', {
          time: QuizService.formatDuration(result.avgMs, locale),
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

  // 会话出现即起秒表 + 挂键盘快捷选答；清空（交卷/放弃）即全部摘除
  watch: {
    session: {
      immediate: true,
      handler(value) {
        this.now = Date.now();
        if (typeof window === 'undefined') return;
        if (value) {
          this.startClock();
          window.addEventListener('keydown', this.onKeydown);
        } else {
          this.stopClock();
          window.removeEventListener('keydown', this.onKeydown);
        }
      },
    },
  },

  activated() {
    // keep-alive 返回本页：恢复读秒与快捷键。计时本身在 store（切去题库
    // tab 查答案时读秒不停，属设计内的自罚），这里只恢复展示层
    this.now = Date.now();
    if (this.session && typeof window !== 'undefined') {
      this.startClock();
      window.addEventListener('keydown', this.onKeydown);
    }
  },

  deactivated() {
    this.stopClock();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeydown);
    }
  },

  beforeUnmount() {
    this.stopClock();
    clearTimeout(this.copiedTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeydown);
    }
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

    // 纯文本拼串（反馈/回顾里内联引用选项文本时用）
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

    // 选答：锁定后忽略（store.answerCurrent 自带防御，这里省一次无效写入）
    choose(optionNo) {
      if (this.answeredFlag) return;
      this.now = Date.now();
      this.quizStore.answerCurrent(optionNo);
    },

    next() {
      this.quizStore.advance();
    },

    start() {
      this.quizStore.startChallenge({ ...this.draft });
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

    quit() {
      if (
        typeof window !== 'undefined' &&
        window.confirm(this.t('quitChallenge'))
      ) {
        this.quizStore.quitChallenge();
      }
    },

    startClock() {
      if (this.clock != null) return;
      this.clock = setInterval(() => {
        this.now = Date.now();
      }, 1000);
    },

    stopClock() {
      if (this.clock != null) {
        clearInterval(this.clock);
        this.clock = null;
      }
    },

    // 键盘快捷选答（1-4 / A-D）：仅作答态且未锁定时生效；输入控件聚焦时
    // 让位。快捷键映射随按钮的 aria-keyshortcuts 公开
    onKeydown(event) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!this.session || this.answeredFlag) return;
      const digitSlot = DIGIT_KEYS.indexOf(event.key);
      const letterSlot = OPTION_LETTERS.indexOf(
        String(event.key).toUpperCase(),
      );
      const slot = digitSlot !== -1 ? digitSlot : letterSlot;
      if (slot === -1 || slot >= this.optionRows.length) return;
      event.preventDefault();
      this.choose(this.optionRows[slot].no);
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
.quiz-challenge {
  font-family: var(--font-sans);
  color: var(--ink);
}

/* ---- 通用控件：分段钮 / 主按钮 / 幽灵按钮（仿 CardCodex） ---- */
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

/* ---- 作答态 ---- */
.challenge-run {
  max-width: 720px;
}

.run-progress {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--rule);
  margin-bottom: 16px;
}

.progress-question {
  margin: 0;
  font-family: var(--font-type);
  font-size: 14px;
  color: var(--ink);
}

.progress-meta {
  display: flex;
  gap: 14px;
  margin: 0;
  font-family: var(--font-type);
  font-size: 12px;
  color: var(--ink-faded);
}

.progress-clock {
  min-width: 5em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.prefect-running-tag {
  display: inline-block;
  margin: 0 0 12px;
  padding: 4px 10px;
  border: 1px dashed var(--gold-leaf);
  border-radius: 2px;
  font-family: var(--font-type);
  font-size: 12px;
  color: var(--gold-ink);
}

.badge-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.q-badge {
  padding: 2px 8px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  font-family: var(--font-type);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--ink-faded);
}

.badge-adjudicated {
  border-color: var(--gold-leaf);
  color: var(--gold-ink);
}

.badge-conflict {
  border-color: var(--oxblood);
  color: var(--oxblood);
}

.stem-block {
  margin-bottom: 16px;
}

.stem-text {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
}

.stem-hidden {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 48px;
  line-height: 1;
  color: rgba(var(--ink-rgb), 0.18);
  user-select: none;
}

.reveal-label {
  display: block;
  margin-bottom: 6px;
  font-family: var(--font-type);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--gold-ink);
}

.option-list {
  display: grid;
  gap: 10px;
  margin: 0 0 14px;
}

.option-btn {
  display: flex;
  align-items: baseline;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 12px 14px;
  text-align: left;
  font-family: var(--font-type);
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink);
  background: var(--paper-light);
  border: 1px solid var(--rule);
  border-radius: 2px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}

.option-btn:hover:not(:disabled) {
  border-color: var(--ink);
}

.option-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 2px;
}

.option-btn:disabled {
  cursor: default;
}

.option-key {
  flex: none;
  color: var(--ink-faded);
}

.option-btn.is-correct {
  border-color: var(--teal-ink);
  background: rgba(var(--teal-rgb), 0.12);
}

.option-btn.is-correct .option-key {
  color: var(--teal-ink);
}

.option-btn.is-wrong {
  border-color: var(--oxblood);
  background: rgba(var(--accent-rgb), 0.1);
}

.option-btn.is-wrong .option-key {
  color: var(--oxblood);
}

.feedback {
  margin: 0 0 14px;
  font-family: var(--font-type);
  font-size: 13px;
}

.feedback.is-correct {
  color: var(--teal-ink);
}

.feedback.is-wrong {
  color: var(--oxblood);
}

.explanation {
  margin-bottom: 18px;
  padding: 2px 0 2px 12px;
  border-left: 3px solid var(--rule);
}

.explanation-label {
  display: block;
  margin-bottom: 4px;
  font-family: var(--font-type);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--ink-faded);
}

.explanation-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
}

.run-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
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
  .challenge-setup,
  .challenge-run,
  .challenge-result {
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

  .owl-code {
    font-size: 64px;
  }

  .run-actions .primary-btn,
  .run-actions .ghost-btn,
  .result-actions .primary-btn,
  .result-actions .ghost-btn {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .quiz-challenge button {
    transition: none;
  }
}
</style>
