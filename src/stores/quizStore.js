// Quiz store — quizbank data + search/challenge state for /quiz (T2).
// Options-style defineStore per AGENTS.md (loading/error + try-catch-finally),
// rules delegated to QuizService (pure, unit-tested) — the store only wires
// state: search filters, the challenge session lifecycle and best records.
import { QuizService } from '@/services/quizService.js';
import {
  persistLocale,
  resolveInitialLocale,
  translate,
} from '@/services/quizLocale.js';
import { defineStore } from 'pinia';

export const useQuizStore = defineStore('quiz', {
  state: () => ({
    // UI 语言（'zh' | 'en'）：初次进入按 localStorage > 浏览器语言解析，
    // 之后由 setLocale 更新并持久化；题目侧文案由 lookupText 按 locale 取
    locale: resolveInitialLocale(),

    // 加载状态（error 存语言无关码 'load-failed'，UI 文案走词典）
    loading: false,
    error: null,

    // 当前页签：'bank'（题库检索）| 'challenge'（答题挑战）
    tab: 'bank',

    // version.json 内容（数据版本徽标 + 链接），loadQuiz() 成功后填充
    versionInfo: null,

    // 两科原始题目（quiz.json banks.<id>.questions，数组引用）
    banks: { history_of_magic: [], muggle_studies: [] },

    // 检索过滤（'all' 表示不筛科目；query 跨语言匹配题干/选项/讲解）
    searchFilters: { bank: 'all', query: '' },

    // 挑战会话：buildChallenge 产物 + 运行时字段
    // （index 当前题下标 / answers 每题作答 / presentedAt 本题出题时刻）
    session: null,

    // 最近一局成绩（gradeResult 产物 + newRecord 标记），交卷后展示成绩单
    lastResult: null,

    // 本地最佳记录（仅含当前 dataVersion 的条目，见 QuizService.loadBests）
    bests: {},

    // 检索结果分页（当前页，从 1 起；query 变化时归位）
    page: 1,
  }),

  getters: {
    // 両库总题数（版本徽标与 note 文案的 {total}）
    totalQuestions: (state) =>
      state.banks.history_of_magic.length + state.banks.muggle_studies.length,

    // 组合科目过滤 + 关键词搜索（交给 service 的纯函数，store 不重复实现规则）
    searchResults: (state) => {
      const rows = QuizService.BANK_IDS.flatMap((bank) =>
        state.banks[bank].map((question) => ({ bank, ...question })),
      );
      return QuizService.searchQuestions(rows, state.searchFilters);
    },

    // 科目分段选项：'all' 置顶，其后両科，均带计数（label 走词典）
    bankOptions: (state) => {
      const count = (bank) => state.banks[bank].length;
      return [
        {
          value: 'all',
          label: translate(state.locale, 'bankAll'),
          count:
            state.banks.history_of_magic.length +
            state.banks.muggle_studies.length,
        },
        ...QuizService.BANK_IDS.map((bank) => ({
          value: bank,
          label: translate(
            state.locale,
            bank === 'history_of_magic' ? 'bankHistory' : 'bankMuggle',
          ),
          count: count(bank),
        })),
      ];
    },

    // 挑战当前题（未开考或已交卷时为 null）
    currentItem: (state) => state.session?.items?.[state.session.index] ?? null,

    // 已作答题数（answers 按题下标写入，跳位/未答为空位）
    answeredCount: (state) => {
      if (!state.session) return 0;
      return state.session.answers.filter(
        (answer) =>
          answer && answer.chosenNo !== null && answer.chosenNo !== undefined,
      ).length;
    },
  },

  actions: {
    // 加载题库数据（client 层幂等，重复/并发调用共享同一次请求）；
    // 成功后顺带按当前 dataVersion 读入本地最佳记录
    async loadQuiz() {
      this.loading = true;
      try {
        const snapshot = await QuizService.load();
        this.versionInfo = snapshot.versionInfo;
        this.banks = {
          history_of_magic: snapshot.banks?.history_of_magic?.questions ?? [],
          muggle_studies: snapshot.banks?.muggle_studies?.questions ?? [],
        };
        this.error = null;
        this.bests = QuizService.loadBests(this.versionInfo?.dataVersion);
      } catch (error) {
        console.error('Failed to load quiz data:', error);
        // 存语言无关的错误码，UI 文案由视图按 locale 走词典
        this.error = 'load-failed';
      } finally {
        this.loading = false;
      }
    },

    // 切换 UI 语言并持久化（非法值忽略，保持当前语言）
    setLocale(value) {
      if (value !== 'zh' && value !== 'en') return;
      this.locale = value;
      persistLocale(value);
    },

    // 切换页签（非法值忽略）
    setTab(tab) {
      if (tab === 'bank' || tab === 'challenge') this.tab = tab;
    },

    // 合并式更新检索过滤（setSearch({ bank: 'history_of_magic' }) 等）；
    // query 变化时分页归位到第 1 页
    setSearch(patch) {
      const queryChanged =
        patch != null &&
        patch.query !== undefined &&
        patch.query !== this.searchFilters.query;
      Object.assign(this.searchFilters, patch ?? {});
      if (queryChanged) this.page = 1;
    },

    // 检索翻页（防御非法值：最小第 1 页）
    setPage(page) {
      this.page = Math.max(1, Number(page) || 1);
    },

    // 开考：抽题建会话 + 复位上局成绩；presentedAt 从此刻起算第 1 题用时
    startChallenge(config) {
      const session = QuizService.buildChallenge({
        ...config,
        dataVersion: this.versionInfo?.dataVersion ?? null,
      });
      session.index = 0;
      session.answers = [];
      session.presentedAt = Date.now();
      this.lastResult = null;
      this.session = session;
    },

    // 作答当前题：记下选项、对错与本题毫秒用时；不自动前进（交给 advance）。
    // 已作答的题锁定（防御重复点击写脏成绩）
    answerCurrent(optionNo) {
      const session = this.session;
      const item = session?.items?.[session.index];
      if (!item) return;
      const existing = session.answers[session.index];
      if (
        existing &&
        existing.chosenNo !== null &&
        existing.chosenNo !== undefined
      ) {
        return;
      }
      session.answers[session.index] = {
        chosenNo: optionNo,
        correct: optionNo === QuizService.answerKey(item),
        ms: Date.now() - session.presentedAt,
      };
    },

    // 前进：未到末题则 index+1 并刷新 presentedAt（每题独立计时）；
    // 末题则判分 → 记成绩单 → 尝试写入最佳 → 会话清空
    advance() {
      const session = this.session;
      if (!session) return;
      if (session.index < session.items.length - 1) {
        session.index += 1;
        session.presentedAt = Date.now();
        return;
      }
      const result = QuizService.gradeResult(session, session.answers);
      const { improved } = QuizService.recordBest({
        result,
        dataVersion: session.dataVersion,
      });
      result.newRecord = improved;
      this.lastResult = result;
      this.bests = QuizService.loadBests(session.dataVersion);
      this.session = null;
    },

    // 放弃本次（成绩单态的「调整设置」也走这里：session 已空时即清成绩单）
    quitChallenge() {
      this.session = null;
      this.lastResult = null;
    },

    // 清空本地最佳记录（持久层 + 状态同步归零）
    resetBests() {
      QuizService.clearBests();
      this.bests = {};
    },
  },
});
