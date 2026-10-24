// Quiz store — quizbank data + search/challenge state for /quiz (T2).
// Options-style defineStore per AGENTS.md (loading/error + try-catch-finally),
// rules delegated to QuizService (pure, unit-tested) — the store only wires
// state: search filters, the challenge session lifecycle and best records.
// The UI locale is site-wide: state lives in localeStore, exposed here as a
// delegating getter + forwarding action so the store's API surface is
// unchanged for the views/components.
import { QuizService } from '@/services/quizService.js';
import {
  DEFAULT_CHALLENGE_SETUP,
  DEFAULT_FILTERS,
  QUIZ_PAGE_SIZE,
} from '@/services/quizQuery.js';
import { translate } from '@/services/quizLocale.js';
import { useLocaleStore } from '@/stores/localeStore.js';
import { defineStore } from 'pinia';

export const useQuizStore = defineStore('quiz', {
  state: () => ({
    // 加载状态（error 存语言无关码 'load-failed'，UI 文案走词典）
    loading: false,
    error: null,

    // 当前页签：'bank'（题库检索）| 'challenge'（答题挑战）
    tab: 'bank',

    // version.json 内容（数据版本徽标 + 链接），loadQuiz() 成功后填充
    versionInfo: null,

    // 两科原始题目（quiz.json banks.<id>.questions，数组引用）
    banks: { history_of_magic: [], muggle_studies: [] },

    // 检索过滤（'all' 表示不筛科目/主题；query 跨语言匹配题干/选项/讲解）。
    // theme 仅由 URL ?theme= 驱动（题库数据无玩家可见分类语义，UI 不设控件）
    searchFilters: { ...DEFAULT_FILTERS },

    // 题目直达高亮：{ bank, id } | null。只作展示锚点，不写进成绩/会话；
    // bank 前缀消除两库 id 冲突（531 个 id 跨库重名）
    highlight: null,

    // 挑战会话：buildChallenge 产物 + 运行时字段
    // （index 当前题下标 / answers 每题作答 / presentedAt 本题出题时刻）
    session: null,

    // 最近一局成绩（gradeResult 产物 + newRecord 标记），交卷后展示成绩单
    lastResult: null,

    // 本地最佳记录（仅含当前 dataVersion 的条目，见 QuizService.loadBests）
    bests: {},

    // 全量复习进度（reconcileProgress 归一后的文档，形状见 docs/quiz-review.md
    // §1；loadQuiz 成功后装配，交卷/放弃复习局时更新）
    progress: null,

    // 检索结果分页（当前页，从 1 起；query 变化时归位）
    page: 1,

    // 挑战配置态草稿（ChallengeSetup 读写，updateSetupDraft 合并式更新）。
    // 挂 store 而非组件 data：作答/成绩单态期间配置屏被卸载，草稿不丢，
    // 「调整设置」返回时保留用户四项选择（#9 拆分时回归的原行为）。
    // 初始值 = 默认配置：魔法史 / 随机盲抽 / 10 题 / 标准模式
    setupDraft: { ...DEFAULT_CHALLENGE_SETUP },
  }),

  getters: {
    // UI 语言（'zh' | 'en'）：全站唯一语言，委托 localeStore（跨 store
    // getter，两页共享一次切换）；题目侧文案由 lookupText 按 locale 取
    locale() {
      return useLocaleStore().locale;
    },

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

    // 科目分段选项：'all' 置顶，其后両科，均带计数（label 走词典；
    // 读委托 getter locale 须走 this，不能用 state 形参）
    bankOptions() {
      const count = (bank) => this.banks[bank].length;
      return [
        {
          value: 'all',
          label: translate(this.locale, 'bankAll'),
          count:
            this.banks.history_of_magic.length +
            this.banks.muggle_studies.length,
        },
        ...QuizService.BANK_IDS.map((bank) => ({
          value: bank,
          label: translate(
            this.locale,
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
        // 复习进度跨 dataVersion 保留（与 bests 刻意不同）：加载时剔除
        // 数据里已消失的题 id，其余照留
        this.progress = QuizService.reconcileProgress(
          QuizService.readProgressRaw(),
          this.banks,
        );
      } catch (error) {
        console.error('Failed to load quiz data:', error);
        // 存语言无关的错误码，UI 文案由视图按 locale 走词典
        this.error = 'load-failed';
      } finally {
        this.loading = false;
      }
    },

    // 切换 UI 语言（转发全站 localeStore：赋值 + 持久化，非法值由其忽略）
    setLocale(value) {
      useLocaleStore().setLocale(value);
    },

    // 切换页签（非法值忽略）。切到另一页签时清掉题目直达锚点：
    // question 只属于题库页，跨页签保留会在写 URL 时变成幽灵参数
    setTab(tab) {
      if (tab !== 'bank' && tab !== 'challenge') return;
      if (tab !== this.tab) this.highlight = null;
      this.tab = tab;
    },

    // 合并式更新检索过滤（setSearch({ bank: 'history_of_magic' }) 等）。
    // 任一过滤变化时分页归位到第 1 页，并清掉题目直达锚点（用户已离开
    // 该题的筛选上下文；question 不应在 URL 里残留）
    setSearch(patch) {
      const changed =
        patch != null &&
        ['bank', 'theme', 'query'].some(
          (key) =>
            patch[key] !== undefined && patch[key] !== this.searchFilters[key],
        );
      Object.assign(this.searchFilters, patch ?? {});
      if (changed) this.page = 1;
      this.highlight = null;
    },

    // 题目直达：切到题库页并定位到该题所在页（高亮由 QuizBankBrowser 渲染）。
    // bank 前缀消除跨库 id 冲突；非法入参防御性忽略
    focusQuestion({ bank, id } = {}) {
      const numericId = Number(id);
      if (
        !QuizService.BANK_IDS.includes(bank) ||
        !Number.isSafeInteger(numericId) ||
        numericId <= 0
      ) {
        return;
      }
      this.setTab('bank');
      this.highlight = { bank, id: numericId };
      const index = this.searchResults.findIndex(
        (row) => row.bank === bank && Number(row.id) === numericId,
      );
      this.page = index >= 0 ? Math.floor(index / QUIZ_PAGE_SIZE) + 1 : 1;
    },

    // 清掉题目直达锚点（离开该题/改筛选/翻页时调用）
    clearHighlight() {
      this.highlight = null;
    },

    // 检索翻页（防御非法值：最小第 1 页）
    setPage(page) {
      this.page = Math.max(1, Number(page) || 1);
    },

    // 合并式更新挑战配置草稿（updateSetupDraft({ bank: 'mixed' }) 等）；
    // 切抽题方式重置题量的档位规则仍在 ChallengeSetup.setDraw，这里只收值
    updateSetupDraft(patch) {
      Object.assign(this.setupDraft, patch ?? {});
    },

    // 开考：抽题建会话 + 复位上局成绩；presentedAt 从此刻起算第 1 题用时。
    // config.draw 选抽题方式：'review' 走未做优先复习抽题（传当前进度），
    // 缺省/'random' 走原随机整池抽题
    startChallenge(config) {
      const session =
        config?.draw === 'review'
          ? QuizService.buildReviewChallenge({
              ...config,
              progress: this.progress,
            })
          : QuizService.buildChallenge({
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
    // 末题则判分 → 记成绩单 → 按抽题方式分流（复习局落进度不碰最佳，
    // 随机局照旧写最佳）→ 会话清空。会话在此清空，quitChallenge 的放弃
    // 落盘路径与之天然互斥：applyProgress 每局至多一次
    advance() {
      const session = this.session;
      if (!session) return;
      if (session.index < session.items.length - 1) {
        session.index += 1;
        session.presentedAt = Date.now();
        return;
      }
      const result = QuizService.gradeResult(session, session.answers);
      if (session.config?.draw === 'review') {
        // 复习局：已作答部分折算进覆盖进度并落盘；成绩不进 bests
        //（二刷与盲抽不可比），成就感由覆盖行承担
        const { progress, coveredNow, rolledBanks } = QuizService.applyProgress(
          this.progress,
          session,
          session.answers,
        );
        QuizService.writeProgressRaw(progress);
        this.progress = progress;
        result.review = {
          coveredNow,
          rolledBanks,
          stats: QuizService.coverageStats(progress, this.banks),
        };
      } else {
        const { improved } = QuizService.recordBest({
          result,
          dataVersion: session.dataVersion,
        });
        result.newRecord = improved;
        this.bests = QuizService.loadBests(session.dataVersion);
      }
      this.lastResult = result;
      this.session = null;
    },

    // 放弃本次（成绩单态的「调整设置」也走这里：session 已空时即清成绩单）。
    // 复习局且已有作答 → 已作答部分静默折算进进度并落盘（无成绩单）；
    // advance 交卷时已清空 session，两条路径不会重复 apply
    quitChallenge() {
      const session = this.session;
      if (
        session &&
        session.config?.draw === 'review' &&
        this.answeredCount > 0
      ) {
        const { progress } = QuizService.applyProgress(
          this.progress,
          session,
          session.answers,
        );
        QuizService.writeProgressRaw(progress);
        this.progress = progress;
      }
      this.session = null;
      this.lastResult = null;
    },

    // 清空本地最佳记录（持久层 + 状态同步归零）
    resetBests() {
      QuizService.clearBests();
      this.bests = {};
    },

    // 重置全量复习进度（持久层删键 + 状态同步回空进度）
    resetProgress() {
      QuizService.clearProgress();
      this.progress = QuizService.readProgressRaw();
    },
  },
});
