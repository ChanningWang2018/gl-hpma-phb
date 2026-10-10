<template>
  <section class="quiz-bank-browser" :aria-label="t('tabBank')">
    <!-- 工具栏：科目三分段 + 检索框 + 命中行 -->
    <div class="bank-toolbar">
      <SegmentControl
        class="bank-segment"
        role="group"
        :aria-label="t('bankLabel')"
        :options="quizStore.bankOptions"
        :model-value="quizStore.searchFilters.bank"
        @update:model-value="setBank"
      />

      <label class="toolbar-field toolbar-search">
        <span class="field-label">{{ t('searchLabel') }}</span>
        <input
          :value="searchInput"
          type="search"
          :placeholder="t('searchPlaceholder')"
          @input="queueSearch"
        />
      </label>

      <p class="hit-line" role="status">
        {{
          t('hitLine', {
            shown: searchResults.length,
            total: quizStore.totalQuestions,
          })
        }}
      </p>
    </div>

    <!-- 空态（加载/错误态由 Quiz.vue 壳统一处理） -->
    <p v-if="searchResults.length === 0" class="bank-state bank-empty">
      {{ t('empty') }}
    </p>

    <template v-else>
      <!-- 答题卡列表 -->
      <div class="question-list">
        <article
          v-for="row in pageRows"
          :key="rowKey(row)"
          class="question-card"
        >
          <div class="card-head">
            <h3 class="card-stem">
              <template
                v-for="(seg, segIndex) in textSegments(row.question)"
                :key="segIndex"
              >
                <span v-if="seg.mark === 'focus'" class="seg-focus">{{
                  seg.text
                }}</span>
                <span v-else-if="seg.mark === 'warn'" class="seg-warn">{{
                  seg.text
                }}</span>
                <template v-else>{{ seg.text }}</template>
              </template>
            </h3>
            <div v-if="badges(row).length" class="badge-group">
              <span
                v-for="badge in badges(row)"
                :key="badge.key"
                class="badge"
                :class="`badge-${badge.key}`"
                :title="badge.title"
                >{{ badge.label }}</span
              >
            </div>
          </div>

          <!-- 答案行：常显——正确项只按 is_correct 定位，与数组顺序无关 -->
          <p v-if="answerText(row)" class="answer-line">
            <span class="answer-label">{{ t('answerPrefix') }}</span>
            <template
              v-for="(seg, segIndex) in textSegments(answerText(row))"
              :key="segIndex"
            >
              <span v-if="seg.mark === 'focus'" class="seg-focus">{{
                seg.text
              }}</span>
              <span v-else-if="seg.mark === 'warn'" class="seg-warn">{{
                seg.text
              }}</span>
              <template v-else>{{ seg.text }}</template>
            </template>
          </p>

          <!-- 选项与讲解：默认收起，展开后才渲染（展示序走 SHUFFLE_CACHE 洗牌缓存） -->
          <template v-if="isRevealed(row)">
            <ol class="option-list">
              <li
                v-for="(opt, optIndex) in displayOptions(row)"
                :key="opt.no"
                class="option-row"
                :class="{ 'option-correct': opt.is_correct }"
              >
                <span class="option-letter">{{ optionLetter(optIndex) }}</span>
                <span class="option-text">
                  <template
                    v-for="(seg, segIndex) in textSegments(opt.text)"
                    :key="segIndex"
                  >
                    <span v-if="seg.mark === 'focus'" class="seg-focus">{{
                      seg.text
                    }}</span>
                    <span v-else-if="seg.mark === 'warn'" class="seg-warn">{{
                      seg.text
                    }}</span>
                    <template v-else>{{ seg.text }}</template>
                  </template>
                </span>
                <span v-if="opt.is_correct" class="option-tag"
                  >✔ {{ t('correctLabel') }}</span
                >
              </li>
            </ol>

            <!-- 讲解（展开态，跟随后） -->
            <div class="explanation">
              <span class="explanation-label">{{ t('explanationLabel') }}</span>
              <p class="explanation-text">
                <template
                  v-for="(seg, segIndex) in textSegments(row.explanation)"
                  :key="segIndex"
                >
                  <span v-if="seg.mark === 'focus'" class="seg-focus">{{
                    seg.text
                  }}</span>
                  <span v-else-if="seg.mark === 'warn'" class="seg-warn">{{
                    seg.text
                  }}</span>
                  <template v-else>{{ seg.text }}</template>
                </template>
              </p>
            </div>
          </template>

          <button
            type="button"
            class="reveal-btn"
            :aria-expanded="isRevealed(row)"
            @click="toggleReveal(row)"
          >
            {{ isRevealed(row) ? t('collapseOptions') : t('expandOptions') }}
            <span class="reveal-caret" aria-hidden="true">{{
              isRevealed(row) ? '▴' : '▾'
            }}</span>
          </button>
        </article>
      </div>

      <!-- 分页（50/页；单页时省略） -->
      <nav v-if="totalPages > 1" class="pager">
        <button
          type="button"
          class="pager-btn"
          :disabled="safePage <= 1"
          @click="quizStore.setPage(safePage - 1)"
        >
          {{ t('pagePrev') }}
        </button>
        <span class="pager-count">{{ safePage }} / {{ totalPages }}</span>
        <button
          type="button"
          class="pager-btn"
          :disabled="safePage >= totalPages"
          @click="quizStore.setPage(safePage + 1)"
        >
          {{ t('pageNext') }}
        </button>
      </nav>
    </template>
  </section>
</template>

<script>
// QuizBankBrowser — the question-bank browser tab of /quiz (docs/quiz.md T5).
// Presentational only: filters/pagination live in quizStore, business rules in
// quizService/quizClient, copy in quizLocale. The Quiz.vue shell owns page
// chrome, tabs and the loading/error states — this component only handles the
// empty-search state of the list itself.
import {
  correctOption,
  lookupText,
  sanitizeMarkup,
  shuffledOptions,
} from '@/services/quizClient.js';
import { translate } from '@/services/quizLocale.js';
import { useQuizStore } from '@/stores/quizStore.js';
import SegmentControl from '@/components/ui/SegmentControl.vue';

/** Display letters for the four options, in shuffled display order. */
const LETTERS = ['A', 'B', 'C', 'D'];

/** Hits per page (docs/quiz.md T5). */
const PAGE_SIZE = 50;

/** Keystroke debounce before the search box writes to the store (ms). */
const SEARCH_DEBOUNCE_MS = 200;

/**
 * Shuffled display order per question row, cached by row identity. The raw
 * data parks the correct answer at options[0], so the source order must never
 * be shown — shuffledOptions() on every render would reshuffle under the
 * reader on each unrelated re-render (reveal toggles, paging), hence the
 * WeakMap: one shuffle per row object for the row's lifetime.
 */
const SHUFFLE_CACHE = new WeakMap();

export default {
  name: 'QuizBankBrowser',
  components: { SegmentControl },
  setup() {
    const quizStore = useQuizStore();
    return { quizStore };
  },
  data() {
    return {
      // 输入框即时回显，防抖后才写入 store（CardCodex queueSearch 同款）
      searchInput: '',
      searchTimer: null,
      // 每题独立的「展开选项」状态（bank:id -> boolean）
      revealed: {},
    };
  },
  computed: {
    searchResults() {
      return this.quizStore.searchResults;
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.searchResults.length / PAGE_SIZE));
    },
    // 防御性夹取：结果集收窄后残留的超界页码不渲染成空页
    safePage() {
      return Math.min(Math.max(1, this.quizStore.page), this.totalPages);
    },
    pageRows() {
      const start = (this.safePage - 1) * PAGE_SIZE;
      return this.searchResults.slice(start, start + PAGE_SIZE);
    },
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer);
  },
  methods: {
    setBank(value) {
      this.quizStore.setSearch({ bank: value });
      // store.setSearch 只在 query 变化时归位页码，科目切换在此显式回第 1 页
      this.quizStore.setPage(1);
    },

    // 搜索 200ms 防抖后再写入 store，避免每击键全量过滤 1847 题
    queueSearch(event) {
      this.searchInput = event.target.value;
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.quizStore.setSearch({ query: this.searchInput });
      }, SEARCH_DEBOUNCE_MS);
    },

    // id 仅 bank 内唯一，跨库键需带 bank 前缀
    rowKey(row) {
      return `${row.bank}:${row.id}`;
    },

    // 双语字段 -> 渲染安全段落：lookupText 按 locale 取值（缺气回退 zh），
    // sanitizeMarkup 解析 focus/warn 标记并防御性剥离其余标签，绝不 innerHTML
    textSegments(bilingual) {
      return sanitizeMarkup(lookupText(bilingual, this.quizStore.locale) ?? '');
    },

    displayOptions(row) {
      let options = SHUFFLE_CACHE.get(row);
      if (!options) {
        options = shuffledOptions(row);
        SHUFFLE_CACHE.set(row, options);
      }
      return options;
    },

    // 答案行文本：正确项只按 is_correct 标记定位（源数据 options[0] 恒为
    // 正确项，顺序绝不可直出），与选项区的洗牌展示序互不依赖；取值后仍交
    // textSegments 渲染 focus/warn 标记并剥离其余标签
    answerText(row) {
      return lookupText(correctOption(row)?.text, this.quizStore.locale) ?? '';
    },

    // 徽标组：裁决/冲突/玩家投稿/重复题（判据与 QuizService.buildChallenge
    // 的 markers 一致，检索侧就地重算——searchResults 行不携带预计算字段）
    badges(row) {
      const list = [];
      if (row.answer_adjudicated != null) {
        list.push({
          key: 'adjudicated',
          label: this.t('badgeAdjudicated'),
          title: this.t('adjudicatedNote'),
        });
      }
      if (row.answer_conflict != null) {
        list.push({ key: 'conflict', label: this.t('badgeConflict') });
      }
      if (row.theme === 'ugc') {
        list.push({ key: 'ugc', label: this.t('badgeUgc') });
      }
      if (Array.isArray(row.duplicate_of) && row.duplicate_of.length > 0) {
        list.push({ key: 'duplicate', label: this.t('badgeDuplicate') });
      }
      return list;
    },

    isRevealed(row) {
      return !!this.revealed[this.rowKey(row)];
    },

    toggleReveal(row) {
      const key = this.rowKey(row);
      if (this.revealed[key]) {
        delete this.revealed[key];
      } else {
        this.revealed[key] = true;
      }
    },

    optionLetter(index) {
      return LETTERS[index] ?? '';
    },

    // 词典查找：模板内调用并读取 store.locale，切换语言即时生效
    t(key, params) {
      return translate(this.quizStore.locale, key, params);
    },
  },
};
</script>

<style scoped>
/* ---- 工具栏 ---- */
.bank-toolbar {
  margin-bottom: var(--space-4);
}

/* 科目分段与检索框的间距留在使用方（分段钮本身不带外边距） */
.bank-segment {
  margin-bottom: var(--space-3);
}

.toolbar-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.12em;
  color: var(--ink-faded);
}

.toolbar-field input {
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--type-body);
  color: var(--ink);
  background: var(--paper-light);
  border: 1px solid var(--rule);
  border-radius: 2px;
}

.toolbar-field input:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 1px;
}

.toolbar-search input {
  width: 280px;
}

.hit-line {
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.1em;
  color: var(--ink-faded);
  margin-top: var(--space-3);
}

/* ---- 空态 ---- */
.bank-state {
  font-family: var(--font-type);
  font-size: var(--type-body);
  color: var(--ink-faded);
  padding: var(--space-7) 0;
  text-align: center;
}

/* ---- 答题卡列表 ---- */
.question-list {
  display: grid;
  gap: var(--space-3);
  /* 桌面端限宽居中：50 张卡的长题干不拉满整行（移动端父容器更窄，无副作用） */
  max-width: 760px;
  margin-inline: auto;
}

.question-card {
  background: var(--paper-light);
  border: 1px solid var(--rule);
  border-radius: 2px;
  padding: var(--space-4);
  transition: border-color 0.25s;
}

.question-card:hover {
  border-color: var(--ink-faded);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.card-stem {
  min-width: 0;
  font-family: var(--font-sans);
  font-size: var(--type-stem);
  font-weight: 600;
  line-height: 1.55;
  color: var(--ink);
}

/* 内联标记段：<color=focus_light> 金墨下划线、<color=warn_light> 牛血色 */
.seg-focus {
  color: var(--gold-ink);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.seg-warn {
  color: var(--oxblood);
}

/* 徽标组：卡片右上角的小签 */
.badge-group {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-1);
  padding-top: var(--space-1);
}

.badge {
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.08em;
  line-height: 1.4;
  padding: var(--space-1) var(--space-2);
  border-radius: 2px;
  white-space: nowrap;
}

.badge-adjudicated {
  color: var(--gold-ink);
  border: 1px solid var(--gold-leaf);
}

.badge-conflict {
  color: var(--oxblood);
  border: 1px solid var(--oxblood);
}

.badge-ugc,
.badge-duplicate {
  color: var(--ink-faded);
  border: 1px solid var(--ink-faded);
}

/* ---- 答案行（常显，teal 强调） ---- */
.answer-line {
  margin-top: var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--type-body);
  line-height: 1.5;
  color: var(--teal-ink);
}

.answer-label {
  font-family: var(--font-type);
  letter-spacing: 0.06em;
}

/* ---- 选项（展开态） ---- */
.option-list {
  list-style: none;
  margin-top: var(--space-3);
  display: grid;
  gap: var(--space-2);
}

.option-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--type-body);
  line-height: 1.5;
  color: var(--ink);
}

.option-letter {
  flex-shrink: 0;
  /* 固定 20px 字母槽：A-D 同宽，选项文本列对齐 */
  width: 20px;
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--ink-faded);
}

.option-text {
  min-width: 0;
}

.option-tag {
  flex-shrink: 0;
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--teal-ink);
  white-space: nowrap;
}

/* 展开后正确项整行走 teal（tag 同色已含 ✔ 与 correctLabel） */
.option-row.option-correct .option-letter,
.option-row.option-correct .option-text {
  color: var(--teal-ink);
}

/* ---- 讲解 ---- */
.explanation {
  margin-top: var(--space-3);
  border-top: 1px solid var(--rule);
  padding-top: var(--space-2);
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
  font-family: var(--font-sans);
  font-size: var(--type-body);
  line-height: 1.55;
  color: var(--ink);
}

/* ---- 展开按钮 ---- */
.reveal-btn {
  margin-top: var(--space-3);
  min-height: 40px;
  padding: 0 var(--space-4);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.06em;
  color: var(--ink-faded);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 0.25s,
    border-color 0.25s;
}

.reveal-btn:hover {
  color: var(--oxblood);
  border-color: var(--oxblood);
}

.reveal-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 1px;
}

/* ---- 分页 ---- */
.pager {
  margin-top: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
}

.pager-btn {
  min-height: 40px;
  min-width: 48px;
  padding: 0 var(--space-4);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.06em;
  color: var(--ink-faded);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 0.25s,
    border-color 0.25s;
}

.pager-btn:hover:not(:disabled) {
  color: var(--oxblood);
  border-color: var(--oxblood);
}

.pager-btn:disabled {
  color: var(--rule);
  border-color: var(--rule);
  cursor: default;
}

.pager-btn:focus-visible {
  outline: 2px solid var(--gold-leaf);
  outline-offset: 1px;
}

.pager-count {
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.1em;
  color: var(--ink-faded);
}

@media (max-width: 768px) {
  .toolbar-search input {
    width: 200px;
  }

  .question-card {
    padding: var(--space-3) var(--space-4) var(--space-4);
  }
}

@media (max-width: 480px) {
  .toolbar-search,
  .toolbar-search input {
    width: 100%;
  }

  .card-head {
    flex-direction: column;
    gap: var(--space-2);
  }

  .badge-group {
    justify-content: flex-start;
    padding-top: 0;
  }
}
</style>
