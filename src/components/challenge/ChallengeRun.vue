<template>
  <!-- is-answered 供移动端「答后操作条钉底」样式作用域使用 -->
  <section class="challenge-run" :class="{ 'is-answered': answeredFlag }">
    <header ref="runProgress" class="run-progress">
      <div class="progress-row">
        <p class="progress-question">
          {{ t('questionN', { n: questionNo, total: questionTotal }) }}
        </p>
        <div class="progress-side">
          <span class="progress-answered"
            >{{ quizStore.answeredCount }}/{{ questionTotal }}</span
          >
          <span class="progress-clock" role="timer">{{ elapsedLabel }}</span>
          <!-- 放弃钮从底部操作条上移到进度行右端：与主按钮拉开距离防误触；
               window.confirm 确认与放弃逻辑不变，padding 撑出 ≥40px 触控 -->
          <button type="button" class="quit-btn" @click="quit">
            {{ t('quitChallenge') }}
          </button>
        </div>
      </div>
      <!-- 已答进度轨道：--rule 底 + --gold-leaf 填充，宽度 = 已答/总题 -->
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" :style="{ width: progressPct }"></div>
      </div>
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
        :title="badge.kind === 'adjudicated' ? t('adjudicatedNote') : undefined"
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
      <p v-else-if="!answeredFlag" class="stem-hidden" aria-hidden="true">？</p>
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
        <span class="option-key" aria-hidden="true">{{ option.letter }}.</span>
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

    <!-- 即时反馈 + 讲解合并块（锁定后出现）：反馈语作块首行、读屏同步播报
         （aria-live 保留在反馈语上），讲解正文随后；左边框颜色随对错
         teal / oxblood -->
    <div v-if="answeredFlag" class="verdict-block" :class="feedbackClass">
      <p class="feedback" aria-live="polite">
        {{ feedbackText }}
      </p>
      <div class="explanation">
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
    </div>

    <!-- 答后操作条：只留主按钮（移动端 is-answered 时钉底）；放弃钮已
         上移至进度行右端 -->
    <footer class="run-actions">
      <button type="button" class="primary-btn" @click="next">
        {{ nextLabel }}
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

    // 进度轨道填充宽度（已答 / 总题，百分号字符串供 style width 绑定）
    progressPct() {
      const total = this.questionTotal;
      if (!total) return '0%';
      const pct = (this.quizStore.answeredCount / total) * 100;
      return `${Math.round(pct * 10) / 10}%`;
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
/* ---- 通用控件：主按钮（仿 CardCodex；三个子屏暂时各自持有，
   后续任务以公共组件收编。本屏的幽灵按钮已随「放弃本次」上移进度行
   改为 quit-btn 文字钮，样式随之删除） ---- */
.primary-btn {
  min-height: 44px;
  padding: 0 var(--space-5);
  font-family: var(--font-type);
  font-size: var(--type-body);
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

/* 进度区：单行「题号 | 已答数 · 计时 · 放弃」+ 2px 进度轨道 */
.run-progress {
  margin-bottom: var(--space-4);
}

.progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding-bottom: var(--space-2);
}

.progress-question {
  margin: 0;
  font-family: var(--font-type);
  font-size: var(--type-body);
  color: var(--ink);
}

.progress-side {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
}

.progress-answered {
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--ink-faded);
  font-variant-numeric: tabular-nums;
}

.progress-clock {
  min-width: 5em;
  text-align: right;
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--ink-faded);
  font-variant-numeric: tabular-nums;
}

/* 放弃本次：小字号文字钮，上下 padding 撑出 ≥40px 触控命中 */
.quit-btn {
  padding: var(--space-4) var(--space-2);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.06em;
  color: var(--ink-faded);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.25s;
}

.quit-btn:hover {
  color: var(--oxblood);
}

.quit-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: -1px;
}

/* 2px 进度轨道：--rule 底 + --gold-leaf 填充，兼作进度区分隔线 */
.progress-track {
  height: 2px;
  background: var(--rule);
  border-radius: 1px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--gold-leaf);
}

.prefect-running-tag {
  display: inline-block;
  margin: 0 0 var(--space-3);
  padding: var(--space-1) var(--space-3);
  border: 1px dashed var(--gold-leaf);
  border-radius: 2px;
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--gold-ink);
}

/* 重复题干直出的变体：虚线改为 teal，与「已隐藏」状态一眼区分 */
.prefect-stem-shown {
  border-color: var(--teal-ink);
  color: var(--teal-ink);
}

.badge-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-2);
}

.q-badge {
  padding: 2px var(--space-2);
  border: 1px solid var(--rule);
  border-radius: 2px;
  font-family: var(--font-type);
  font-size: var(--type-caption);
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
  margin-bottom: var(--space-4);
}

.stem-text {
  margin: 0;
  font-size: var(--type-stem);
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
  margin-bottom: var(--space-1);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.08em;
  color: var(--gold-ink);
}

.option-list {
  display: grid;
  gap: var(--space-3);
  margin: 0 0 var(--space-4);
}

.option-btn {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  width: 100%;
  min-height: 48px;
  padding: var(--space-3) var(--space-4);
  text-align: left;
  font-family: var(--font-type);
  font-size: var(--type-body);
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

/* 反馈 + 讲解合并块：反馈语为首行，讲解正文随后，块内垂直间距 space-2；
   左边框颜色随对错 teal / oxblood（默认 --rule 兜底） */
.verdict-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  padding-left: var(--space-3);
  border-left: 3px solid var(--rule);
}

.verdict-block.is-correct {
  border-left-color: var(--teal-ink);
}

.verdict-block.is-wrong {
  border-left-color: var(--oxblood);
}

.feedback {
  margin: 0;
  font-family: var(--font-type);
  font-size: var(--type-body);
}

/* 对错 class 挂在合并块上，反馈文字配色经后代选择器继承 */
.verdict-block.is-correct .feedback {
  color: var(--teal-ink);
}

.verdict-block.is-wrong .feedback {
  color: var(--oxblood);
}

.explanation {
  margin: 0;
}

.explanation-label {
  display: block;
  margin-bottom: var(--space-1);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.12em;
  color: var(--ink-faded);
}

.explanation-text {
  margin: 0;
  font-size: var(--type-body);
  line-height: 1.7;
}

.run-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}

/* ---- 响应式 ---- */
@media (max-width: 768px) {
  .challenge-run {
    max-width: none;
  }

  /* 答后操作条钉底：反馈/讲解插在选项与操作行之间，会把「下一题」挤出
     视口，每题都要多滑一次。已作答（is-answered）时把操作条吸在视口底，
     选完即可直接翻题。sticky 随文档流参与布局、不遮内容，无需旧 fixed
     方案的滚动余量补偿；.container 的 overflow: hidden 移除后全站可用 */
  .challenge-run.is-answered .run-actions {
    position: sticky;
    bottom: 0;
    /* 页面 body::before/::after 纸纹装饰层（z-index 998/999）是
       pointer-events: none，条在其下仍可点，不必盖过装饰层 */
    z-index: 10;
    /* 下一整行为不支持 env() 的旧浏览器回退 */
    padding: var(--space-3) var(--space-4);
    padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
    background: var(--paper);
    border-top: 1px solid var(--rule);
  }

  /* 主按钮占主导宽度（条内只剩主按钮，放弃钮已上移进度行） */
  .challenge-run.is-answered .run-actions .primary-btn {
    flex: 1 1 auto;
  }
}

@media (max-width: 480px) {
  .run-actions .primary-btn {
    flex: 1;
  }
}
</style>
