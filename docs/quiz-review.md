# 魔法测验·全量复习（未做优先轮次制）设计与任务分割

> 2026-10-10 制定。范围 = /quiz 答题挑战新增「全量复习」抽题方式，
> 解决纯随机抽题覆盖效率低的问题（每局有放回抽样，25 局 50 题后期望仍有
> 约半数题从未见过）。本文是给 subagent 的自包含任务书。
> 母文档：`docs/quiz.md`（/quiz 页总体架构；本特性不改动其已定决策）。

## 0. 背景与用户决策

现状：`QuizService.buildChallenge` 把选中科目池整池洗牌取前 `count` 题，
局与局之间无记忆；最佳记录 `bests` 按 `{bank}:{count}:{mode}` 键存
`hpma-quiz-bests`，dataVersion 变即全弃；题库数据每周一自动更新
（`fetch-quiz` cron），题目 id 来自源库、跨版本稳定。

**四项确认题用户未答，按推荐项执行（均可逆，2026-10-10）：**

| 决策点 | 结论 | 翻案成本 |
| --- | --- | --- |
| 抽题策略 | **未做优先·每批洗牌**：每批只从「本轮未做」的题里随机抽 | 换固定序列/加权需重写 buildReviewChallenge，接口不变 |
| 进度 vs 周更 | **进度跨版本保留**：加载时剔除已消失的题 id，其余照留（与 bests 的「版本即弃」刻意不同：成绩可比性 ≠ 覆盖连续性） | 收紧为全清只需 reconcile 改判 dataVersion |
| 复习局成绩 | **不进 bests**：二刷成绩与盲抽不可比；成就感由覆盖率承担（成绩单显新覆盖/剩余，全覆盖显轮次里程碑） | bestKey 加 draw 维度即可另立记录 |
| 错题重练 | **本轮不做，数据就位**：progress 逐题记 wrong 集，下一票加「错题重练」模式零迁移 | 直接加第三档抽题方式 |

另定默认（可逆）：复习模式题量分段 **REVIEW_COUNTS = [25, 50, 100]**
（随机维持 [10, 25, 50]）；分享文本复习局的模式名追加「全量复习」；
**中途放弃也计覆盖**（已作答题照常入进度，第 49 题放弃 50 题批次不白做）。

## 1. 模型：轮次（round）+ 未做优先（unseen-first）

```
hpma-quiz-progress（新 localStorage 键，守卫式读写，坏 JSON → 空进度）
{
  banks: {
    history_of_magic: { round: 1, seen: { [questionId]: 1 }, wrong: { [questionId]: 1 } },
    muggle_studies:   { round: 1, seen: {...}, wrong: {...} }
  }
}
```

- **开一局复习**：从选中科目（mixed = 两科并集）的「本轮未做」题里
  洗牌抽前 `count` 题；题序与选项序照旧洗牌，markers（stemShared 等）
  与随机局完全同源。
- **作答落进度**：已作答的题（`chosenNo != null`）记入 `seen`；答错记入
  `wrong`（同轮重复答对则移出，防御性）。未作答的题不影响进度。
- **轮次滚动（eager，apply 时逐科目判定）**：某科目在标记后「未做集
  变空」→ 该科目立刻 round+1、清空 seen/wrong，成绩单提示
  「题库已全覆盖，开启第 N 轮」。build 侧因此无需滚动逻辑，永不面对
  「抽空」状态（进度里未做集恒非空，除非整轮刚滚完——那时本就该从全量抽）。
  边界：混合局做完抽干麻瓜研究时，只有麻雀研究滚轮，魔法史不动——
  覆盖行显示「当前轮进度」，语义自洽。
- **放弃语义**：quitChallenge 时若为复习局且已有作答 → 对已作答部分
  applyProgress 并落盘，然后清会话。**applyProgress 每局至多一次**
  （store 保证：交卷路径与放弃路径互斥）。

## 2. API 钉死（两任务都依赖此契约，不得偏移）

```js
// quizService.js 新增（静态类成员；既有 API 一律不动）
static REVIEW_COUNTS = [25, 50, 100];
static PROGRESS_STORAGE_KEY = 'hpma-quiz-progress';

static readProgressRaw();      // 守卫式读 + 归一化：两科齐全、round≥1、seen/wrong 为对象；坏 JSON/无存储 → 空 progress
static writeProgressRaw(p);    // 守卫式写，异常吞掉
static reconcileProgress(progress, banks);  // 纯函数：剔除 banks 中已不存在的题 id（两科各自），round 保留；返回新对象
static coverageStats(progress, banks);      // → { [bankId]: { round, seen, total, remaining, wrong } }（total=bank 题数）
static buildReviewChallenge({ bank, count, mode, progress, rng = Math.random });
  // 与 buildChallenge 同形状 session；config = { bank, count: 实抽数, mode, draw: 'review' }
  // 未做集 = 选中科目池 − 各自 seen；mixed 为并集；洗牌抽前 count
static applyProgress(progress, session, answers);
  // → { progress: 新对象, coveredNow, rolledBanks: [bankId...] }
  // 只记 answers[i].chosenNo != null 的题；对错按 answerKey 现算；
  // 逐 involved 科目判滚动（eager，见 §1）；纯函数不改入参
static clearProgress();        // 守护式删键

// buildChallenge 内部重构（公开行为不变，既有测试必须保持全绿）：
//   抽 module 私有 poolRows(bankIds)（含 stemKey/stemCounts 逻辑）与
//   toItems(rows, rng)（markers 组装）；random 与 review 两路共用。
```

```
// quizStore.js 变更
state 新增 progress: null（loadQuiz 成功后 = reconcileProgress(readProgressRaw(), banks)）
startChallenge(config)  // config 增可省略字段 draw: 'random' | 'review'，缺省 'random'
  // review 路径走 buildReviewChallenge（传 this.progress）
advance() 末题判分后分流：
  draw 'review' → applyProgress + writeProgressRaw；result.review =
    { coveredNow, rolledBanks, stats: coverageStats(新进度, banks) }；不碰 bests
  draw 'random' → 现状 recordBest 路径不变
quitChallenge() // 复习局且有作答 → 同上 apply（coveredNow 用于……不展示，静默落盘）后清空
resetProgress() // clearProgress + this.progress = readProgressRaw()
```

```
// quizLocale.js 新增键（zh 文案为准，en 地道翻译；parity 测试自动防漏译）
drawLabel（抽题方式）/ drawRandom（随机抽题）/ drawReview（全量复习）
reviewBlurb（只出本轮还没做过的题，刷完全库自动开新一轮。）
progressRound（第 {round} 轮）/ coverageLine（{bank}：已做 {seen} / {total}）
reviewCovered（本轮新覆盖 {n} 题）/ reviewRemaining（剩 {n} 题）
roundRolled（题库已全覆盖，开启第 {round} 轮！）
resetProgress（重置复习进度）/ resetProgressConfirm（清空复习进度，从第 1 轮重刷？）
// formatShareText：config.draw === 'review' 时 mode 文案 = 模式名 + ' · ' + drawReview 译文
```

## 3. UI（QuizChallenge.vue，配置态与成绩单态；作答态零改动）

- 配置态新增「抽题方式」分段（随机抽题 | 全量复习，`.type-segment` 式
  scoped 实现，词典文案）；选复习时：
  - 题量分段切换为 REVIEW_COUNTS，count 重置为 25；
  - 「本地最佳」块替换为**覆盖块**：每相关科目一行
    `第 {round} 轮 · {bank}：已做 {seen} / {total}` + 报纸风细线进度条
    （`--rule` 底、`--gold-leaf` 填充，高度 2-3px，token-only）；
  - reviewBlurb 说明行（仿 prefectBlurb 版式）；
  - 「重置复习进度」小字按钮（`confirm()` 一次 → store.resetProgress()）。
- 成绩单态（复习局）：O.W.L. 评级照显（参考性质）；`newRecord` 徽标位置
  改为覆盖行——`本轮新覆盖 {n} 题 · 剩 {m} 题` + 进度条；若 rolledBanks
  非空追加 `roundRolled` 里程碑行（`--gold-ink`）；复制成绩/错题回顾/
  再来一次/调整设置全部照旧（再来一次 = 下一批复习，天然成立）。
- 检索 tab、级长模式逻辑、stemShared 直出规则：零改动。

## 4. 任务分割

验收底线同 `docs/quiz.md` §2：`npm run test` / `npm run lint` /
`npm run build` 全绿；无新运行时依赖；AGENTS.md 规约（token-only 色、
scoped、单引号分号、768/480 断点、`:focus-visible`、触控 ≥40px）。
**subagent 不做 git 提交**；不改动 docs/。

---

### T1 服务层：复习引擎 + 进度存储 + 词典（先行）

**上下文**：先读 `src/services/quizService.js`（重点 buildChallenge 的
rows/stemCounts/items 组装，160-199 行——重构为 poolRows/toItems 私有函数
后 random 路径行为必须逐字节等价）、`src/services/quizLocale.js`、
`tests/unit/quizService.test.js`、`tests/unit/quizLocale.test.js`。

**产出**：§2 契约的全部 service/locale 代码与测试：

1. `quizService.js`：REVIEW_COUNTS / PROGRESS_STORAGE_KEY /
   readProgressRaw / writeProgressRaw / reconcileProgress / coverageStats /
   buildReviewChallenge / applyProgress / clearProgress + poolRows/toItems
   重构。applyProgress 与 buildReviewChallenge 均为纯函数（不改入参，
   返回新对象）。
2. `quizLocale.js`：§2 新键（zh/en）。
3. 测试（`tests/unit/quizService.test.js` 扩充，真数据 + 合成 fixture）：
   - buildReviewChallenge：固定 rng 下只抽未做题、不与 seen 相交；
     mixed 并集正确；seen 全满时从全量抽（滚动后的自然态）；count 截断；
     markers 与随机局同源（stemShared 题在复习局同样带出）；
     **既有 buildChallenge 测试保持全绿**。
   - applyProgress：seen/wrong 标记；未作答题（chosenNo null/缺位）不记；
     答对移出 wrong；滚动只发生在「该科目未做集被抽干」的科目，
     混合局部分抽干只滚干的那科；返回 coveredNow 正确；不改入参。
   - reconcileProgress：消失 id 剔除、存留 id 保留、round 保留、
     形状缺失归一化。
   - readProgressRaw：坏 JSON → 空、无 localStorage（node）→ 空、
     归一化（缺科补默认）。
   - coverageStats 计数正确（真数据 1223/624）。
   - quizLocale parity（既有测试自动覆盖新键，无需额外用例，跑绿即可）。

---

### T2 状态与 UI：store 接线 + 挑战面板（依赖 T1）

**上下文**：T1 已落地 §2 契约。先读 `src/stores/quizStore.js`、
`src/components/QuizChallenge.vue`（配置态/成绩单态结构）、
`src/views/CardCodex.vue` 的分段钮与进度样式参照。

**产出**：

1. `quizStore.js` 按 §2：progress 状态 + loadQuiz 装配 + startChallenge
   分流 + advance/quit 分流 + resetProgress。注意 apply 每局至多一次的
   互斥保证。
2. `QuizChallenge.vue` 按 §3：抽题方式分段、覆盖块 + 进度条 + 重置钮、
   成绩单覆盖行与轮次里程碑。全部文案走词典，无硬编码。
3. 自查 480px：配置面板分段与覆盖块换行良好。

---

## 5. 执行顺序

```
T1 ──→ T2 ──→ 主会话集成验收（三件套 + preview 手检全流程 + 变更记录）
```

## 6. 变更记录

### 2026-10-10 初版交付

- T1/T2 全部完成，主会话集成验收通过。改动文件：`quizService.js`
  （poolRows/toItems 重构 + 复习引擎与进度存储）、`quizLocale.js`
  （11 个新键）、`quizStore.js`（progress 状态 + 交卷/放弃分流 +
  resetProgress）、`QuizChallenge.vue`（抽题方式分段/覆盖块/成绩单覆盖行）、
  `tests/unit/quizService.test.js`。
- 测试 253→276 全绿；lint/build 干净。
- 实测（preview 4175）：25/50/100 档与覆盖块切换、答 3 题放弃 → seen=3
  落盘、注入 near-full 进度抽干 → 「新覆盖 2 题」+ 里程碑「开启第 2 轮」+
  存储滚动（round=2/seen 清零）、随机模式回归（进度不受影响、档位复原）、
  重置进度（键清除）、EN 文案切换、视觉验收（覆盖条 26% 填充与 320/1223
  吻合、里程碑金墨强调）。
- T1 合理偏差：formatShareText 的复习后缀在 T1 落地（任务书两侧都未
  明确归属，避免掉缝）；`reconcileProgress`/`coverageStats` 的 banks
  参数兼容 store 形状与 client 原始形状。
- 可选打磨项（未做，视觉验收发现）：成绩单覆盖徽标与里程碑相邻同为金调，
  可将徽标描边改 `--rule` 降调；抽干局「剩 ~全量」时进度条填充率≈0 不可见
  （数学上正确，如需可给 0 填充加最小可见宽度）。
