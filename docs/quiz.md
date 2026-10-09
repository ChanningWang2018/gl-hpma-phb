# 魔法测验页（Quiz）设计与任务分割

> 2026-10-09 制定。数据源为已发布的 hpma-quizbank 题库数据包（生产链路见下），
> 本文是给 subagent 的自包含任务书：每个任务含上下文、要动的文件、验收标准。
> 范本：`docs/card-codex.md`（/cards 页，本页完全克隆其分层与惯例）。

## 0. 背景与数据链路（已建成的部分，不要重建）

```
HPMA-Research (E:\Scripts\HPMA-Research)
  游戏客户端 dbx_new 提取 → export_class_quiz_bundle.py → 打包发布
    ↓ 发布（已自动化）
hpma-quizbank 公开仓 (github.com/hpma-bits/hpma-quizbank，本地 E:\Scripts\hpma-quizbank)
  仓库根: quiz.json (1.9MB raw / ~340KB gzip) + manifest.json + schema/ + check.html
  版本契约: Release tag = quiz-v{schema}.{data}.0，当前 quiz-v2.20261009.0
    ↓ 消费（本次要做）
gl-hpma-phb (本站) 新增 /quiz 魔法测验页
```

### Intent

> **/quiz 是 HPMA 游戏内「魔法史 / 麻瓜研究」课堂答题的仿真训练场**：一面是
> 对照游戏事实的**题库检索工具**（1847 题双语可查，含答案与讲解），一面是
> **计时答题挑战**（含背题库向的「级长模式」地狱难度）。成绩以 O.W.L. 评级
> 呈现、可分享，为核心引流点；排行榜留好数据形状、后续再上。

### 数据形状（schema_version 2，以下均已对真实数据核实）

```jsonc
// quiz.json
{
  "schema_version": 2, "data_version": 20261009, "generated_at": "...",
  "banks": {
    "history_of_magic": {           // 麻瓜拼写梗：源表叫 moggle_question_bank
      "id": "...", "source_table": "...",
      "questions": [ /* 1223 */ ],
      "play_configs": [ /* 8，本站不消费 */ },
    "muggle_studies":   { "questions": [ /* 624 */ ], "play_configs": [ /* 4 */ ] }
  }
}
// Question:
{
  "id": 101301103,                  // bank 内唯一
  "theme": "theme1|theme2|...|ugc", // 内部抽题配额键，无玩家可见分类语义，不消费
  "question":  { "zh": "...", "en": "..." },   // 双语 100% 覆盖
  "options": [ { "no": 1, "is_correct": true, "text": { "zh": "...", "en": "..." } }, /* 共 4 项 */ ],
  "explanation": { "zh": "...", "en": "..." },
  "need_close_bilingual": 0,        // 游戏原字段，语义不明，不消费
  "answer_conflict": true,          // 可选，仅 1 题（101301103）
  "answer_adjudicated": {           // 可选，仅 1 题
    "correct_no": 2,
    "note": "用户裁决(2026-10-09)按原著口径... 游戏运行时仍按 option1 判分..."
  },
  "provider_name": "可爱的小沉沉",   // 可选，UGC 题（568 题），theme 为 "ugc"
  "duplicate_of": [502]             // 可选，重复题（54 题），数组
}
```

**已核实的关键事实（消费端规则由此导出，照做）：**

1. **全库不变量**：每题恰好 4 个选项、恰好一个 `is_correct=true`。
   **除裁决题外正确项恒在 options[0]**（源表 option1 恒为答案、客户端运行时
   洗牌）→ **本站展示前必须 Fisher-Yates 洗牌选项**，`is_correct` 是唯一
   事实来源，重排后跟字段走。题序同样自洗。
2. **裁决题 101301103（魁地奇世界杯年份）在 v2 里 `is_correct` 已翻转到
   option2（1473）**：正确性判定无需特殊逻辑（继续只看 `is_correct`）；
   `answer_conflict`/`answer_adjudicated` 仅作展示徽标——该题游戏内判分与本站
   标答不同（官方录错选项顺序），徽标点开要能看到 note 原文。
3. **内联标记只有两种**：`<color=focus_light>…</color>`（1118 处，游戏内关键
   词高亮）与 `<color=warn_light>…</color>`（5 处）。消费端解析为
   `[{ text, mark }]` 段落（mark ∈ null|'focus'|'warn'）渲染强调样式；其余
   `<…>` 标签一律防御性剥离，绝不 innerHTML。
4. 最长题干/选项 108 个汉字，无排版压力；quiz.json 1.9MB raw / ~340KB gzip，
   仅访问 /quiz 时才 fetch，可整文件加载不分片。
5. manifest.json 的 `coverage`（各 bank 题数、bilingual 1847、answer_conflicts
   id 列表、ugc_questions 568、duplicate_questions 54）是 fetch 脚本与 --verify
   的校验基准。

## 1. 架构决策（已定，照做；未答确认题按推荐项执行，均可逆）

| 决策 | 结论 | 理由 |
| --- | --- | --- |
| 数据 JSON | **提交进仓** `public/data/quiz/{quiz,manifest,version}.json` | 主用户在国内，jsDelivr 直连不稳；数据走本站域名（EdgeOne）最稳。1.9MB/次 git diff 可审、`/data/*` 已有 1h 缓存头。与 spellbook 同款 |
| 版本单一事实源 | `public/data/quiz/version.json`（形状见 T1） | CI 更新它、UI 读它显示数据版本徽标、`--verify` 用它做一致性校验 |
| 加载器 | `src/services/quizClient.js`：零依赖 ESM、纯函数导出、node:fs 分支（单测零 mock 直读真数据）、schema_version 守卫 | 逐行仿 spellbookClient.js |
| 业务逻辑 | `src/services/quizService.js` 静态类门面 + 纯函数（抽题/判分/评级/最佳记录/分享文本） | AGENTS.md 服务层惯例；store 不重复实现规则 |
| 状态 | `src/stores/quizStore.js`（Options 风格，loading/error + try-catch-finally） | AGENTS.md 规约 |
| 计时判分 | **总计时 + 每题毫秒 + O.W.L. 评级**（正确率映射：O≥95 / E≥85 / A≥75 / P≥60 / D≥40 / T<40）。不做每题倒计时 | 简单诚实、天然可排行（用户确认题的推荐项；倒计时速答可作后续模式） |
| 级长模式 | 隐藏题干只出选项（洗牌后），**作答后揭晓题干 + 讲解**；成绩与普通模式分开记最佳 | 「背题库」终极考验，可学习可晒（用户确认题的推荐项） |
| 引流载体 | O.W.L. 成绩单版式（截图友好）+ **一键复制成绩文本**（含模式/评级/用时/站点链接，运行时取 `location.origin`）。零后端 | 用户确认题的推荐项；排行榜后续再上，最佳记录的数据形状即未来上报形状 |
| 本地记录 | localStorage：`hpma-quiz-locale`（zh/en，codexLocale 同款守卫式）+ `hpma-quiz-bests`（`{bank}:{count}:{mode}` → 记录，携带 dataVersion，题库更新即失效） | 全站唯一持久化先例 codexLocale 的风格延续 |
| 反作弊 | v1 不防。挑战中可切去题库 tab 查答案——**计时不停，查题时间自罚**，每题耗时在成绩单可见 | 洗牌随机化使检索慢；服务端防作弊随排行榜再上 |
| 自动更新 | `scripts/fetch-quiz.mjs` + GitHub Actions 周 cron（与 spellbook 错峰），有新版 → 入库 → commit+push → Netlify 自动部署 | spellbook 同款闭环 |
| 拒绝的备选 | jsDelivr 外链取数（国内不稳）；题库分片（340KB gzip 可接受）；倒计时双轨判分（v1 复杂度）；组件级 UI 测试（vitest 是 node 环境，只测逻辑层）；服务端排行榜（v1 零后端） | — |

### 1.1 明确不做

图片/字体素材（无）；题库分片或压缩；theme 分类筛选（无玩家可见语义）；
`play_configs`/`need_close_bilingual` 消费；防作弊；排行榜后端；每题倒计时。

## 2. 任务分割

每个任务的验收底线：`npm run test`、`npm run lint`、`npm run build` 全绿；
不引入新的运行时依赖；遵守 AGENTS.md（paper 调色板 token 禁止硬编码 hex、
2 空格、单引号、分号、scoped style、768/480 断点）。**subagent 不做 git 提交**；
共享文件（router/Header/sitemap/Quiz.vue/README）只由票内指定归属者改动。

---

### T1 数据层：数据入库 + quizClient（所有任务的前置）

**上下文**：建立数据契约。数据源 = 本地 `E:\Scripts\hpma-quizbank\`（已发布
v2）。loader 范本 = `src/services/spellbookClient.js`（loadJson 的 node:fs
分支、schema 守卫中文报错、createClient 单例缓存模式全部照搬）。

**产出**：

1. `public/data/quiz/quiz.json`、`manifest.json` — **已由主会话从
   `E:\Scripts\hpma-quizbank\` 原样字节拷贝就位**，T1 校验即可（勿重写）。
2. `public/data/quiz/version.json` — 已由主会话按下述形状放置，T1 校验即可：
   ```json
   {
     "tag": "quiz-v2.20261009.0",
     "version": "2.20261009.0",
     "schemaVersion": 2,
     "dataVersion": 20261009,
     "sourceRepo": "hpma-bits/hpma-quizbank",
     "sourceUrl": "https://github.com/hpma-bits/hpma-quizbank/tree/quiz-v2.20261009.0",
     "generatedAt": "<取 manifest.json 的 generated_at>"
   }
   ```
3. `src/services/quizClient.js` — 纯函数导出（签名钉死，T2/T5/T6 依赖）：
   - `EXPECTED_SCHEMA_VERSION = 2`；`DEFAULT_DATA_BASE_URL = '/data/quiz/'`
   - `joinUrl(base, relative)`、`normalizeBaseUrl(base)`（照搬 spellbook）
   - `lookupText(bilingual, locale, fallbackLocale = 'zh')` → 双语对象取值，
     请求 locale 缺失/空时回退 zh，再退 null
   - `correctOption(question)` → `options.find(o => o.is_correct)`（不变量
     保证存在；防御：找不到返回 null）
   - `shuffle(array, rng = Math.random)` → Fisher-Yates，**返回新数组**不改入参
   - `shuffledOptions(question, rng)` → `shuffle(question.options, rng)`
   - `sanitizeMarkup(text)` → `Array<{ text: string, mark: null | 'focus' | 'warn' }>`
     解析两种已知 color 标签为段落；其余 `<…>` 剥离；`<` 无闭合 `>` 按字面
     保留；返回段落拼回原文本（除被剥标签外逐字符一致）
   - `createClient({ dataBaseUrl })`：`load()` 并发取 quiz/manifest/version
     三文件（幂等、in-flight 共享）；schema_version ≠ 2 抛中文友好错（仿
     spellbook 文案）；暴露 `banks`（原始对象）、`versionInfo`、`manifest`、
     `bankQuestions(bankId)`（数组引用）、`questionCount(bankId)`、
     `allQuestions()`（`[{ bank, ...question }]` 両库拼接）
4. `tests/unit/quizClient.test.js` — 真数据集成（dataBaseUrl 指向
   `public/data/quiz/`）：
   - 计数 1223 / 624 / 1847；versionInfo 与 manifest 一致；schema 守卫抛错
     （喂 `{ schema_version: 99 }` fixture）
   - `correctOption`：随机抽 20 题，每题恰一个 is_correct 且等于返回值；
     裁决题 101301103 返回 option2（1473）
   - `shuffledOptions`：注入固定 rng（如 `() => 0.999`）断言顺序变化且为原
     集合的排列；默认 rng 下 20 题洗牌后无"4 题全部仍为源序"的退化
   - `sanitizeMarkup` 用例：无标签 / focus / warn / 未知标签剥离 / 裸 `<`；
     真数据抽样：任取 30 题题干，段落数 ≥ 含标签题的标记数
   - `lookupText` zh 回退

**验收**：三件套绿；`node -e "import('./src/services/quizClient.js').then(async m => { const c = m.createClient({ dataBaseUrl: 'public/data/quiz/' }); await c.load(); console.log(c.questionCount('history_of_magic'), c.questionCount('muggle_studies')); })"`
打印 `1223 624`。

---

### T2 服务层：quizService + quizLocale + quizStore（依赖 T1）

**上下文**：范本 = `spellbookService.js`（静态门面 + configure()）、
`codexLocale.js`（zh/en 词典 + {placeholder} 插值 + localStorage 守卫）、
`cardStore.js`（Options 风格）。词典文案与 store API 在此钉死，T5/T6 按名引用。

**产出**：

1. `src/services/quizLocale.js` — `STORAGE_KEY = 'hpma-quiz-locale'`，
   `normalizeLocale` / `translate(locale, key, params)` / `resolveInitialLocale()`
   / `persistLocale()` 全部仿 codexLocale（浏览器全局守卫、zh 缺键回退）。
   词典键（zh 文案为准，en 由实现者给出地道翻译）：
   - 壳：`note`（全站共 {total} 道课堂问答题：魔法史与麻瓜研究，支持检索与计时挑战。）、
     `tabBank`（题库检索）/ `tabChallenge`（答题挑战）、`languageToggle`、
     `loading`（正在翻开课本……）、`loadError`、`retry`、
     `versionBadge`（数据 {version} · {total} 题）
   - 检索：`searchLabel`（检索）、`searchPlaceholder`（题干 / 选项 / 讲解关键词）、
     `bankAll`（全部科目）/ `bankHistory`（魔法史）/ `bankMuggle`（麻瓜研究）、
     `hitLine`（命中 {shown} / {total} 题）、`pagePrev`（上一页）/ `pageNext`（下一页）、
     `revealAnswer`（查看答案与讲解）/ `hideAnswer`（收起）、`correctLabel`（正确答案）、
     `explanationLabel`（讲解）、`badgeAdjudicated`（裁决题）/ `badgeConflict`（数据冲突）/
     `badgeUgc`（玩家投稿）/ `badgeDuplicate`（重复题）、`adjudicatedNote`（该题游戏内判分与本站标答不同（官方录错选项顺序），详见数据集裁决记录。）、
     `empty`（没有命中的题目——换个关键词试试。）
   - 挑战：`setupTitle`（挑战设置）、`bankLabel`（科目）、`bankMixed`（混合双科）、
     `countLabel`（题量）、`modeLabel`（模式）、`modeNormal`（普通模式）、
     `modePrefect`（级长模式）、`prefectBlurb`（只有选项，没有题干——凭题库记忆盲选，作答后揭晓题目。）、
     `bestLabel`（本地最佳：{grade} · {correct}/{total} · {time}）、`bestEmpty`（尚无记录）、
     `startChallenge`（开始挑战）、`questionN`（第 {n} / {total} 题）、
     `prefectRunning`（级长模式：题干已隐藏）、`chooseAnswer`（选择答案）、
     `feedbackCorrect`（回答正确）、`feedbackWrong`（错误，正确答案：{answer}）、
     `prefectReveal`（题目是：）、`nextQuestion`（下一题）、`finishChallenge`（交卷）、
     `quitChallenge`（放弃本次）、
     `resultTitle`（O.W.L. 成绩单）、`statCorrect`（正确 {correct} / {total}）、
     `statAccuracy`（正确率 {pct}%）、`statTime`（总用时 {time}）、`statAvg`（平均每题 {time}）、
     `newRecord`（新纪录！）、`shareCopy`（复制成绩）、`shareCopied`（已复制——去群里晒吧。）、
     `retryChallenge`（再来一次）、`backToSetup`（调整设置）、`wrongReview`（错题回顾）、
     `noWrong`（全对，没有错题！）、
     `owlO`（O · 杰出）/ `owlE`（E · 良好）/ `owlA`（A · 及格）/ `owlP`（P · 差）/
     `owlD`（D · 糟糕）/ `owlT`（T · 巨怪）
   - 分享文本 `shareText`（多行，{placeholders}）：
     zh：`【HPMA 魔法测验】{bank} · {count} 题 · {mode}\nO.W.L. 评级：{grade}\n正确 {correct}/{total}（{pct}%）· 用时 {time}\n你也来试试 → {url}`
2. `src/services/quizService.js` — 静态类（签名钉死）：
   - `configure(options)` / `load()` / `client` / `versionInfo` / `manifest`
     （门面透传，仿 SpellbookService）
   - `BANK_IDS = ['history_of_magic', 'muggle_studies']`；
     `CHALLENGE_COUNTS = [10, 25, 50]`；`MODES = ['normal', 'prefect']`
   - `searchQuestions(allQuestions, { bank = 'all', query = '' })` — bank 过滤 +
     关键词大小写不敏感匹配 zh/en 的题干、全部选项、讲解（用 sanitizeMarkup
     的纯文本拼串做 haystack，命中任一保留）
   - `buildChallenge({ bank, count, mode, dataVersion, rng })` → session：
     `{ config: { bank, count, mode }, items: [...], dataVersion }`；
     items = 从选中科目池（`mixed` = 両库并集）`shuffle` 抽前 count 题（池小于
     count 时取整池），每项 `{ bank, id, question, options: shuffledOptions(q, rng), explanation, markers: { adjudicated, conflict, ugc, duplicate } }`
   - `answerKey(item)` → 正确项 no（`correctOption(item.options)?.no`，防御 null）
   - `gradeResult(session, answers)` → `{ config, correctCount, total, accuracy,
     totalMs, avgMs, owl, perQuestion }`；answers = `[{ chosenNo, correct, ms }]`
     （answerKey 比对）；`owl = owlGrade(accuracy)`
   - `owlGrade(accuracyPercent)` → `{ code: 'O'|'E'|'A'|'P'|'D'|'T', key: 'owlO'... }`
     阈值 95/85/75/60/40
   - `formatDuration(ms, locale)` → zh `3分21秒`（0 分省略）en `3m 21s`
   - `formatShareText({ result, url, locale })` → 用词典 `shareText` 模板拼
     （bank/mode/grade 走词典；duration 走 formatDuration）
   - 最佳记录：`BEST_STORAGE_KEY = 'hpma-quiz-bests'`、`bestKey(config)` →
     `'{bank}:{count}:{mode}'`、`loadBests()`（守卫式读，坏 JSON 回退 {}，丢弃
     dataVersion ≠ 当前传入的条目）、`recordBest({ result, dataVersion })` →
     `{ improved, previous }` 并持久化（更优 = accuracy 更高，平局取 totalMs
     更低）；`clearBests()`
3. `src/stores/quizStore.js` — state：`locale`（resolveInitialLocale）、
   `loading/error`、`tab: 'bank' | 'challenge'`、`versionInfo`、
   `banks: { history_of_magic: [], muggle_studies: [] }`、
   `searchFilters: { bank: 'all', query: '' }`、`session: null`、
   `lastResult: null`、`bests: {}`、`page: 1`。
   getters：`totalQuestions`、`searchResults`（service.searchQuestions）、
   `bankOptions`（all/魔法史/麻瓜研究 带计数，label 走词典）、`currentItem`
     （session.items[session.index]）、`answeredCount`。
   actions：`loadQuiz()`（try-catch-finally，error 存码 'load-failed'，成功时
     顺带 loadBests）、`setLocale`、`setTab`、`setSearch(patch)`（query 变化
     时 page 回 1）、`setPage(n)`、`startChallenge(config)`（buildChallenge +
     `presentedAt = Date.now()`、session/lastResult 复位）、`answerCurrent(optionNo)`
     （计时 `Date.now() - presentedAt`，写 answers[current]，不自动前进）、
     `advance()`（未末题：index+1 并刷新 presentedAt；末题：gradeResult →
     lastResult、recordBest、session 置 null）、`quitChallenge()`（session 与
     lastResult 置 null）、`resetBests()`。
4. `tests/unit/quizService.test.js` + `tests/unit/quizLocale.test.js`：
   - 真数据：buildChallenge('mixed', 50) 恰 50 题、両库均出现（大概率断言不
     稳——改为固定 rng 或断言 count 与去重 no 数）；prefect 与 normal 的 items
     选项均已洗牌（注入使顺序必变的 rng）
   - gradeResult/owlGrade 阈值边界（95/85/75/60/40 与 94.9）；accuracy =
     correct/total 百分比
   - bestKey/recordBest：accuracy 高者破纪录、平局比 totalMs、dataVersion
     变化后 loadBests 丢弃旧条目（stub localStorage）
   - formatDuration 0 分/超 1 分/超 10 分；formatShareText 含 {url} 与评级
   - locale：插值、zh 缺键回退、非法 locale 归一化、词典 zh/en 键集合一致
     （两边 key 排序后全等——防漏译）

**验收**：三件套绿。

---

### T3 更新管道（只依赖 T1 的数据格式，与 T2 并行）

**上下文**：范本 = `scripts/fetch-spellbook.mjs`（仅 node 内置模块、纯函数
导出、update/--check/--verify、main/直跑判定）。**差异**：上游 Release 资产
是 zip+.sha256、仓库无 checksums.txt，不下载 zip（零依赖解 zip 不值得）——
改从 `https://raw.githubusercontent.com/hpma-bits/hpma-quizbank/<tag>/` 下载
裸文件 `quiz.json` + `manifest.json`；完整性 = tag 不可变 + 下述结构门（比
spellbook 的 sha256 弱，是有意识取舍；上游补 checksums.txt 后可加验）。

**产出**：

1. `scripts/fetch-quiz.mjs`：
   - tag 约定 `^quiz-v(\d+)\.(\d{8})\.0$`（版本比较：逐段数值，spellbook 的
     compareVersions 思路）
   - `update`（默认）：latest release → tag 匹配 → 与本地 version.json tag 比，
     相同则 "already up to date" 退出 0 → 下载两文件 → **结构门**（不过则
     拒绝入库、退出 1，中文报错）：
     a. `schema_version === 2`（否则"消费端需升级"）；
     b. 每 bank questions 非空数组，且每题恰 4 选项、恰一个 `is_correct`；
     c. 各 bank 题数 === manifest.coverage.questions 对应值，总题数 ===
        manifest.datasets[id=quiz].count；
     d. manifest.schema_version 与 quiz.schema_version 一致。
     → 覆盖写 `public/data/quiz/` 三文件（version.json 按 T1 形状组装，含
     sourceUrl 拼 tag）→ 打印摘要（版本、各 bank 题数、与旧版 diff：新增/移除
     题目 id 集合差 + 数量）
   - `--check`：有新版退出 2；`--verify`：纯本地一致性（无网络）——version.json
     与 manifest/quiz 的 tag、schemaVersion、dataVersion、generatedAt 互恰 +
     结构门 b/c 重跑 + version.json sourceUrl 含当前 tag；不一致退出 1
   - `--repo owner/name` 覆盖（默认 hpma-bits/hpma-quizbank，env HPMA_QUIZ_REPO）
2. `tests/unit/fetchQuiz.test.js` — 纯函数：tag 解析与比较、结构门（好坏
   fixture 各一：坏 = 双 is_correct / 题数与 coverage 不符 / schema=3）、
   version.json 组装（含 sourceUrl）、id diff。
3. `.github/workflows/quiz-update.yml` — 仿 spellbook-update.yml：cron
   `30 3 * * 1`（与 spellbook 错峰半小时）+ workflow_dispatch；update →
   `git diff --quiet || (git add public/data/quiz && git commit -m
   "chore(quiz): data <tag>" && git push)`；job summary 输出版本与 diff。
4. README 开发工作流一节补三行（quiz 更新链路 + 手动触发入口），紧挨
   spellbook 段落。

**验收**：`node scripts/fetch-quiz.mjs --verify` 通过；`--check` 退出 0（当前
已是 latest）；三件套绿。

---

### T4 页面壳与接线（主会话执行，T2 完成后、T5/T6 开工前）

1. `src/components/QuizBankBrowser.vue`、`src/components/QuizChallenge.vue`
   先落**占位实现**（`<template><section /></template>` 级别的空壳，props/
   emits 无要求），让 build 全链路可跑。
2. `src/views/Quiz.vue` — 仿 CardCodex.vue 骨架：useHead（title/description
   仿 CardCodex 措辞风格）；scoped 报纸风头区（栏目标题 + zh 副标 + note +
   数据版本徽标链 versionInfo.sourceUrl + locale 切换钮）；两个 tab（词典
   tabBank/tabChallenge）切换 store.setTab；loading/error/retry 分支；
   `deactivated()` 复位无弹窗状态（本页无弹层，仅确认无需处理）。内容区
   分别渲染两个子组件。
3. `src/router/index.js` 加 `/quiz`（懒加载，name `'quiz'`）；
   `src/components/Header.vue` nav 加 tab + `subtitles.quiz`；
   `src/sitemap.js` 加条目（priority 0.9，weekly）。netlify.toml 无需改
   （`/data/*` 缓存已覆盖）。
4. 三件套绿后 T5/T6 才开工。

---

### T5 题库检索 UI：QuizBankBrowser.vue（依赖 T2+T4 壳）

**上下文**：美学 = CardCodex.vue（token-only、`--font-serif` 标题、
`--font-type` 控件说明、`.type-segment` 式分段钮的 scoped 实现、768/480
断点、触控 ≥40px、`:focus-visible` 金色描边）。所有文案走词典，不写死。

**产出**：组件内完成：
- 工具栏：科目三分段（全部/魔法史/麻瓜研究，带计数）+ 搜索框（防抖 200ms，
  `v-model` → store.setSearch）；命中行（hitLine）。
- 列表：分页 50/页（页码 + 上一页/下一页，词典 pagePrev/pageNext）。
  每题一张"答题卡"条目：
  - 题干：`sanitizeMarkup` 段落渲染，focus 段 `--gold-ink` 下划线强调、warn
    段 `--oxblood` 强调；右侧小徽标组（adjudicated→`--gold-leaf` 边、
    conflict→`--oxblood`、ugc/duplicate→`--ink-faded` 描边小签，词典文案，
    adjudicated 徽标 title=adjudicatedNote 全文）
  - 选项：默认只列文本（A./B./C./D. 前缀，`--font-type`）；「查看答案与讲解」
    点击展开后：正确项标 `--teal-ink` + ✔ + correctLabel，讲解段
    explanationLabel 引导；再点收起
  - 空态 empty；加载/错误态由 Quiz.vue 壳统一处理
- locale=en 时题干/选项/讲解走 `lookupText(obj, locale)`；页面响应
  store.locale 变化即时切换

**验收**：三件套绿；`npm run dev` 手检由 T7 统一做。

---

### T6 答题挑战 UI：QuizChallenge.vue（依赖 T2+T4 壳，与 T5 并行）

**上下文**：同 T5 美学与词典约束。组件按 store.session/lastResult 三态渲染
（配置 → 作答 → 成绩单），逻辑全部走 store actions，组件不自持业务状态。

**产出**：

1. **配置态**（session 与 lastResult 均 null）：科目分段（魔法史/麻瓜研究/
   混合双科）+ 题量分段（10/25/50）+ 模式分段（普通/级长，选中级长时展示
   prefectBlurb）+ 该配置组合的本地最佳（bests 按 bestKey 查，bestLabel /
   bestEmpty）+ 开始挑战（startChallenge）。
2. **作答态**：进度行（questionN + 已答 x/N + 总计时读秒，读秒用 1s interval
   的 computed now，`prefers-reduced-motion` 下仍走文本不动画；级长模式加
   prefectRunning 提示签）；题干区（normal：sanitizeMarkup 渲染；prefect：
   隐藏，占位一行「？」装饰）；选项四个大按钮（A-D，`--font-type`，≥48px
   触控）；点击即 `answerCurrent(optionNo)` 并锁定：
   - 即时反馈：正确项 `--teal-ink` 高亮 + feedbackCorrect（答错时另将误选
     项标 `--oxblood` + feedbackWrong）；**prefect 模式此时揭晓题干**
     （prefectReveal 前缀 + 完整题干渲染）；讲解段随之展开
   - 徽标：adjudicated/conflict 小签照 T5 规则带出（该题大概率抽不到，但
     渲染逻辑要有）
   - 按钮：nextQuestion / 末题 finishChallenge；放弃本次（quitChallenge，
     `confirm()` 一次）
3. **成绩单态**（lastResult 非 null）："O.W.L. 成绩单"报纸版式——居中大号
   等第（`--font-serif` 巨字 + 词典 owlX 名），statCorrect/statAccuracy/
   statTime/statAvg 四行（`--font-type` 表格线风格 `border-top: 1px solid
   var(--rule)`），newRecord 徽标（recordBest.improved）；**复制成绩**按钮
   （formatShareText，`navigator.clipboard` 优先、`document.execCommand`
   兜底、降级为选中 textarea，成功后按钮文案变 shareCopied 2s）；错题回顾
   列表（perQuestion 里 correct=false 的：题干 + 你的误选（划线）+ 正确项
   （teal）+ 讲解；noWrong 空态）；再来一次（同 config startChallenge）/
   调整设置（lastResult 置 null 走 store action）。
4. 键盘可选加分项：作答态 1-4 / A-D 快捷选答（不喧宾夺主，注明 aria）。

**验收**：三件套绿；T7 统一手检。

---

### T7 集成验收（主会话收尾）

1. `npm run test` + `npm run lint` + `npm run build` + `npm run preview`
   实开 /quiz 手检：加载/错误态、检索（中英关键词、分页、展开、徽标）、
   挑战全流程（normal + prefect 各一局、计时读秒、成绩单、复制成绩、最佳
   记录读写、locale 切换、数据版本徽标链接）。
2. 响应式与可达性过一遍（768/480、触控 ≥40px、focus-visible、对比度）。
3. docs/quiz.md §4 变更记录补记；必要时 README 校对。

---

## 3. 执行顺序与并行

```
T1 ──→ T2 ──┬─→ T4（壳+接线，主会话）─→ T5 ∥ T6 ──→ T7（主会话）
    └→ T3 ──┘
```

- T1 是所有人的前置（数据契约 + client 签名）。
- T3 只依赖 T1 的数据/版本文件格式，与 T2 并行。
- T4（主会话）落占位组件与接线后，T5/T6 并行开发，各自整文件替换占位。
- subagent 各守文件归属清单；git 提交只由主会话做。

## 4. 变更记录

### 2026-10-10 初版交付（quiz-v2.20261009.0 入库）

- T1–T7 全部完成。新增文件：`public/data/quiz/`（三件）、`src/services/quizClient.js`、
  `src/services/quizService.js`、`src/services/quizLocale.js`、`src/stores/quizStore.js`、
  `src/views/Quiz.vue`、`src/components/QuizBankBrowser.vue`、`src/components/QuizChallenge.vue`、
  `scripts/fetch-quiz.mjs`、`.github/workflows/quiz-update.yml`、
  4 个测试文件；接线 router/Header/sitemap/README。
- 测试 137→247 全绿（quizClient 29 + fetchQuiz 34 + quizService 31 + quizLocale 16）；
  lint/build 干净；preview 浏览器实测通过（检索/裁决题徽标/展开/级长全流程/
  成绩单/复制成绩/双语切换/1280 与 375 视口）。
- 四个确认题用户未答，按推荐项执行（可逆）：总计时+O.W.L. 评级、级长模式答后
  揭晓题干、成绩单版式+一键复制文本、数据提交进仓。
- 实现层钉死项的微调记录：`rng=()=>0.999` 是 4 元素恒等排列（T1 改用 0.5 断言）；
  `answerKey` 按语义实现为 `correctOption(item)?.no`；`loadBests(dataVersion)` 带
  参（丢弃旧 dataVersion 条目）；quizLocale 额外导出 `MESSAGES`（键集合全等测试
  需要）；gradeResult 忽略 answers 预存 correct 标记、一律按 answerKey 重算，
  perQuestion 行携带 `{ item, chosenNo, correctNo, correct, ms }`。
- 已知取舍：T5 发现 store.setSearch 只在 query 变化时归页，bank 切换的归页由
  QuizBankBrowser 组件内补 setPage(1)（组件级修复，未动 store）；挑战中可切
  题库 tab 查答案——计时不停，查题时间自罚（§1 反作弊决策）。

### 2026-10-10 打磨：级长模式重复题干直出 + 计时精度（用户反馈）

- **级长模式重复题干**：用户裁决**推翻**「抽题按题干去重」的中间方案——所有
  题目必须保持可覆盖（1847 行全在池内）。改为 `markers.stemShared` 标记
  （清洗后 zh 题干在本池出现 ≥2 次；池 = 所选科目并集，无跨库重复），
  级长模式遇 stemShared 题直接显示题干（teal 提示签，词典键
  `prefectStemShown`），仅唯一题干隐藏。动机：73 组同题干变体中 6 组正确
  答案互不相同（如「老魔杖的杖芯」夜骐尾毛/夜骐的尾毛），盲选会误伤背题库
  玩家；同题干双变体同局出现也被允许（各自直出，可区分）。
- **计时精度**：`formatDuration` 增加 `decimals` 参数（整数毫秒截断——浮点
  `floor(16.83×100)` 会漂成 16.82）；成绩单/本地最佳/分享文本用 2 位小数
  （总用时 9.74秒、平均每题 0.97秒），作答中的读秒仍为整数秒。
- 测试 247→251（stemShared 真数据+合成组、decimals 边界）；preview 实测：
  级长 50 题第 4 题命中直出（麻瓜舞蹈题），普通局成绩单小数正常。

### 2026-10-10 微调：数据版本徽标去超链接（用户反馈）

- Quiz.vue 头部「数据 {version} · {total} 题」由 `<a target=_blank>` 改为
  纯文本 `<span>`（去掉 teal 点状下划线与 hover，保留文字与颜色）。

### 2026-10-10 答题挑战新增「全量复习」抽题方式

- 轮次制（unseen-first）：每批只抽本轮未做题，抽干自动开新轮；进度存
  `hpma-quiz-progress`（跨周更保留，reconcile 剔除消失题）；复习局不进
  bests，成绩单显覆盖；错题集已逐题记录（错题重练模式待下一票）。
  设计与验收详见 `docs/quiz-review.md`（四项确认题未答按推荐执行）。

### 2026-10-10 挑战作答态移动端体验优化（用户反馈）

- **答后操作条钉底**（≤768px）：已作答（`is-answered`）时把 `.run-actions`
  fixed 于视口底（bottom 0 + safe-area padding），选完即见「下一题」，免得
  反馈/讲解插入后把按钮挤出视口、每题多滑一次；`.challenge-run` 随之补一段
  滚动余量 padding，防止钉底条遮挡反馈/讲解末行。只能用 fixed 而非 sticky：
  祖先 `.container`（global.css）带 `overflow: hidden`，会成为 sticky 的吸附
  基准并随文档流滚动，sticky 够不到视口底。
- **「下一题」后题首滚动复位**：`advance()` 未交卷时 `$nextTick` 后把
  `.run-progress` scrollIntoView({ block: 'start' })，新题题首对齐视口顶
  （全站无 sticky/fixed 页头，无需偏移补偿）；`prefers-reduced-motion: reduce`
  下 behavior 用 `'auto'` 瞬时定位，否则 `'smooth'`。末题交卷与放弃流程不滚动。
