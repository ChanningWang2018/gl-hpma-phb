<template>
  <!-- is-answered 供移动端「答后操作条钉底」样式作用域使用 -->
  <section class="challenge-run" :class="{ 'is-answered': answeredFlag }">
    <header ref="runProgress" class="run-progress">
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

    <p
      v-if="isPrefect && !answeredFlag && !stemShown"
      class="prefect-running-tag"
    >
      {{ t('prefectRunning') }}
    </p>
    <!-- 重复题干的题在级长模式下直接显示题干（否则盲选会撞变体互斥的坑） -->
    <p
      v-else-if="isPrefect && !answeredFlag && stemShown"
      class="prefect-running-tag prefect-stem-shown"
    >
      {{ t('prefectStemShown') }}
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

    <!-- 题干区：normal 直出；prefect 作答前隐藏、作答后揭晓；
         重复题干（stemShared）在 prefect 下也直出——盲选无法区分同题干
         的不同变体（部分变体正确答案互不相同），见 quizService.buildChallenge -->
    <div class="stem-block">
      <p v-if="!isPrefect || stemShown" class="stem-text">
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
</template>

<script>
// ChallengeRun — challenge 作答态屏（壳 QuizChallenge 三态路由中 session
// 非空的一态，选项已由 buildChallenge 洗牌、按序直出）。业务状态全在
// quiz store（会话生命周期、判分），本屏只负责展示层：读秒时钟、键盘
// 快捷选答、级长模式题干隐藏/揭示、反馈讲解与钉底操作条。会话出现即起
// 秒表 + 挂快捷键，清空（交卷/放弃）即全部摘除。
import { lookupText, sanitizeMarkup } from '@/services/quizClient.js';
import { QuizService } from '@/services/quizService.js';
import { translate } from '@/services/quizLocale.js';
import { useQuizStore } from '@/stores/quizStore.js';

/** Display letters for the (shuffled) option slots. */
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/** Digit aliases for the optional keyboard shortcuts (1-4 / A-D). */
const DIGIT_KEYS = ['1', '2', '3', '4'];

export default {
  name: 'ChallengeRun',
  setup() {
    const quizStore = useQuizStore();
    return { quizStore };
  },
  data() {
    return {
      // 读秒节拍：每秒推进的展示时钟。判分毫秒一律以 store.answerCurrent
      // 内部记录为准，这里只负责把已计入的毫秒 + 当前题未答部分显示出来
      now: Date.now(),
      clock: null,
    };
  },
  computed: {
    // ---- 作答态 ----
    session() {
      return this.quizStore.session;
    },

    item() {
      return this.quizStore.currentItem;
    },

    isPrefect() {
      return this.session?.config?.mode === 'prefect';
    },

    // 重复题干：级长模式下不隐藏（同题干变体的正确答案可能互不相同）
    stemShown() {
      return this.item?.markers?.stemShared === true;
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
  },

  // 会话出现即起秒表 + 挂键盘快捷选答；清空（交卷/放弃）即全部摘除
  //（本屏只在 session 非空时被壳渲染，immediate 分支即「出现即起表」）
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

    // 纯文本拼串（反馈里内联引用正确选项文本时用）
    plain(bilingual) {
      return this.segments(this.lookup(bilingual))
        .map((segment) => segment.text)
        .join('');
    },

    // 选答：锁定后忽略（store.answerCurrent 自带防御，这里省一次无效写入）
    choose(optionNo) {
      if (this.answeredFlag) return;
      this.now = Date.now();
      this.quizStore.answerCurrent(optionNo);
    },

    // 下一题/交卷：会话继续时把新题题首滚回视口顶——换题只换 DOM 内容、
    // 滚动位置不动，新题题干会留在视口上方。$nextTick 等新题渲染完、布局
    // 稳定后再滚；末题交卷清空 session（切成绩单态）与放弃流程都不滚动。
    // 全站无 sticky/fixed 页头，block: 'start' 顶部对齐无需偏移补偿
    next() {
      this.quizStore.advance();
      if (!this.session) return;
      this.$nextTick(() => {
        if (typeof window === 'undefined' || !this.$refs.runProgress) return;
        // 减弱动效偏好下瞬时定位，避免平滑滚动引起晕动不适
        const reducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;
        this.$refs.runProgress.scrollIntoView({
          block: 'start',
          behavior: reducedMotion ? 'auto' : 'smooth',
        });
      });
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

/* 重复题干直出的变体：虚线改为 teal，与「已隐藏」状态一眼区分 */
.prefect-stem-shown {
  border-color: var(--teal-ink);
  color: var(--teal-ink);
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

/* ---- 响应式 ---- */
@media (max-width: 768px) {
  .challenge-run {
    max-width: none;
  }

  /* 答后操作条钉底：反馈/讲解插在选项与操作行之间，会把「下一题」挤出
     视口，每题都要多滑一次。已作答（is-answered）时把操作条钉在视口底，
     选完即可直接翻题。这里只能用 fixed 而非 sticky：App 根 .container
     （global.css）带 overflow: hidden，会成为 sticky 的吸附基准并随文档流
     一起滚动，sticky 永远够不到视口底；本组件只许改自己，祖先链又无
     transform/filter，fixed 是唯一能把条钉上视口的定位方式。 */
  .challenge-run.is-answered .run-actions {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    /* 页面 body::before/::after 纸纹装饰层（z-index 998/999）是
       pointer-events: none，条在其下仍可点，不必盖过装饰层 */
    z-index: 10;
    flex-wrap: nowrap;
    /* 下一整行为不支持 env() 的旧浏览器回退 */
    padding: 10px 16px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
    background: var(--paper);
    border-top: 1px solid var(--rule);
  }

  /* 主按钮占主导宽度；「放弃本次」收为次要小钮（基础 min-height: 44px
     原样保留，触控 ≥40px 底线不破）。这两个选择器比 480px 断点里
     .run-actions .{primary,ghost}-btn { flex: 1 } 深两级，窄屏下主按钮
     仍主导、放弃钮收缩，不会被旧 flex:1 反超 */
  .challenge-run.is-answered .run-actions .primary-btn {
    flex: 1 1 auto;
  }

  .challenge-run.is-answered .run-actions .ghost-btn {
    flex: 0 0 auto;
    padding: 0 14px;
  }

  /* 钉底条会盖住反馈/讲解末尾几行：给作答区补一段滚动余量（72px ≈
     条高 65px + 视觉余量），保证末行能完整滚上来读。未作答时无此补偿，
     避免常驻条遮挡选项 */
  .challenge-run.is-answered {
    /* 不支持 env() 的回退 */
    padding-bottom: 72px;
    padding-bottom: calc(72px + env(safe-area-inset-bottom));
  }
}

@media (max-width: 480px) {
  .run-actions .primary-btn,
  .run-actions .ghost-btn {
    flex: 1;
  }
}
</style>
