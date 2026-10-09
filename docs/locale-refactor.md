# 中英切换重构（locale 统一 + 版次式控件）

> 2026-10-10 制定。范围 = /cards 与 /quiz 两页的语言切换机制重构。
> 本文是给 subagent 的自包含任务书：每个任务含上下文、要动的文件、验收标准。
> 范本：`docs/quiz.md` 的票制与规约。

## 0. 背景与用户决策（已定，照做）

现状三硬伤：

1. **语言不是全站属性**：/cards 存 `hpma-codex-locale`，/quiz 存
   `hpma-quiz-locale`，两个独立 Pinia store + 两份逐字复制的引擎代码
   （`codexLocale.js` / `quizLocale.js` 各自实现 normalize/translate/
   resolveInitialLocale/persistLocale）。在 /cards 切英文不影响 /quiz。
2. **按钮费解**：两页各有一枚方形钮显示*目标*语言（中文界面显示 "EN"），
   ~30 行 `.locale-btn` CSS 在两个 SFC 里逐字重复。
3. 引用面（已 grep 核实）：`resolveInitialLocale` 仅被 cardStore/quizStore/
   两个 locale 测试引用；feature store 的 `setLocale` 仅被两个 view 调用。

**用户三项决策**（2026-10-10，AskUserQuestion 确认）：

| 决策点 | 结论 |
| --- | --- |
| 控件位置 | **保留在两页页头**（标题行右侧，现状位置），不进全局 Header |
| 控件形态 | **双标签版次式**：并排 `中文 · EN`，当前版墨色+金线下划，非当前淡墨 |
| 双语范围 | **Header 保持纯英文**（导航/副标/masthead 均不翻译） |

参考系：SCMP 式「语言=报纸版次」的全站状态；两语言站点不设下拉菜单。

## 1. 架构决策（已定，照做）

| 决策 | 结论 | 理由 |
| --- | --- | --- |
| 状态归一 | 新 `localeStore`（Pinia）持唯一 locale，单一 localStorage 键 `hpma-locale` | 两页共享一个语言；切换即全站生效 |
| 旧键迁移 | resolve 顺序：`hpma-locale` → `hpma-codex-locale` → `hpma-quiz-locale` → navigator.language（`zh*`→zh，其他→en）→ `'zh'`；**只读不写**，首次用户切换才写新键；旧键保留不删 | 可回滚；迁移确定性可测 |
| 引擎归一 | 新 `siteLocale.js` 承载引擎（normalize/resolve/persist/translate 内核）；`codexLocale.js`/`quizLocale.js` 只留各自词典 + `translate`（签名不变）+ normalizeLocale；codex 的 `VALUE_LABELS`/`valueLabel` 原样保留 | 消除 ~100 行重复；现有 `import { translate }` 全部不动 |
| feature store 兼容 | cardStore/quizStore 的 `locale` 改为**委托 getter**（内部 `useLocaleStore()`），`setLocale` 改为转发 action；对外 API 表面不变 | CardDetail/QuizBankBrowser/QuizChallenge 等只读 `store.locale` 的组件零改动 |
| 组件 | 新共享 `src/components/LocaleSwitch.vue`（文件名 PascalCase，跟随现状，无视 AGENTS.md 的 kebab-case 字样）；直接使用 localeStore，无 props/emits | 删两页重复按钮与 CSS |
| `<html lang>` | App.vue watch localeStore.locale，immediate 写 `document.documentElement.lang` | 语义/无障碍正确 |
| useHead | /cards /quiz 的 title/description 改为 computed 双语 | 中文模式下标题不再是英文 |
| 词典防漏译 | codexLocale 补导出 `MESSAGES` + zh/en 键集合全等测试（quizLocale 已有同款） | 补齐守卫 |

### 1.1 明确不做（本轮）

- Header 导航/副标/masthead 双语化（用户裁决：保持纯英文）。
- URL 路径 locale（`/zh-CN/…`，MDN 式）与 sitemap hreflang——留作后续迭代。
- SalesOptimizer 的 `labels.ui` 读取 bug（模板读 `labels.ui.*` 但 labels.json
  顶层是 en/cn/ja，三语数据从未渲染）——已记录，另行修。
- Analytics / ExternalLinks 翻译。
- 删除旧 localStorage 键、旧键写入。
- 组件级 UI 测试（vitest 为 node 环境，只测逻辑层——与 quiz.md 同一取舍）。

## 2. API 钉死（两任务都依赖此契约，不得偏移）

```js
// src/services/siteLocale.js —— 全新文件
export const STORAGE_KEY = 'hpma-locale';
export const LEGACY_KEYS = ['hpma-codex-locale', 'hpma-quiz-locale'];
export const SUPPORTED_LOCALES = ['zh', 'en'];
export const DEFAULT_LOCALE = 'zh';
export function normalizeLocale(value);            // → 'zh' | 'en' | null
export function resolveInitialLocale();           // → 键迁移链（见上表），只读不写
export function persistLocale(locale);            // try/catch 守卫写 STORAGE_KEY，非法值 no-op
export function translateMessage(messages, locale, key, params);
// 词典内核：查 messages[locale][key] → 缺键回退 messages.zh → 再回退 key 原串；
// {placeholder} replaceAll 插值。codexLocale/quizLocale 的 translate 内部改调它。
export const MESSAGES = {                         // 组件自用小词典
  zh: { languageToggle: '切换语言' },
  en: { languageToggle: 'Switch language' },
};

// src/stores/localeStore.js —— 全新文件，Options 风格（AGENTS.md 规约）
// state: locale = resolveInitialLocale()
// actions: setLocale(value) —— normalizeLocale 非法即忽略；合法则赋值 + persistLocale
```

```js
// codexLocale.js / quizLocale.js 改造后保留的导出（translate/normalizeLocale 签名不变）
export const MESSAGES;            // 词典本体（codexLocale 新增导出，测试需要）
export function normalizeLocale(value);
export function translate(locale, key, params);
// codexLocale 额外保留：VALUE_LABELS、valueLabel(locale, code)
// 删除：STORAGE_KEY、resolveInitialLocale、persistLocale
```

## 3. 任务分割

每个任务的验收底线：`npm run test`、`npm run lint`、`npm run build` 全绿；
不引入新的运行时依赖；遵守 AGENTS.md（paper 调色板 token 禁止硬编码 hex、
2 空格、单引号、分号、scoped style、768/480 断点、`:focus-visible` 金色描边、
触控目标 ≥40px）。**subagent 不做 git 提交**。

---

### T1 引擎与状态：siteLocale + localeStore + store 委托（先行）

**上下文**：现状代码先读一遍——`src/services/codexLocale.js`（143 行）、
`src/services/quizLocale.js`（引擎部分 209 行起与 codex 逐字同构）、
`src/stores/cardStore.js`（state.locale + setLocale，行 29/150）、
`src/stores/quizStore.js`（行 17/121）、四个相关测试文件。

**产出**：

1. `src/services/siteLocale.js` —— 按 §2 契约实现。localStorage 与
   navigator 访问全部 try/catch 守卫（vitest 纯 node 可跑，照抄现状守卫写法）。
2. `src/stores/localeStore.js` —— 按 §2 契约。
3. 改造 `codexLocale.js` / `quizLocale.js`：删引擎，留词典；`translate`
   内部改调 `translateMessage`；codexLocale 导出 `MESSAGES`。
4. 改造 `cardStore.js` / `quizStore.js`：删 `state.locale` 与
   resolve/persist import；加委托 getter `locale()`（getter 体内调
   `useLocaleStore().locale`——Pinia 跨 store 标准用法）与转发 action
   `setLocale(value)`。对外读 `store.locale` 的组件无需任何改动。
5. 测试：
   - 新 `tests/unit/siteLocale.test.js`：normalizeLocale 合法/非法；
     resolveInitialLocale 迁移链（新键优先 → codex 旧键 → quiz 旧键 →
     navigator zh-CN/ja-JP/en-US → 默认 zh；守卫：localStorage 抛错不炸）；
     persistLocale 写入/非法 no-op/抛错吞掉；translateMessage 插值与回退。
   - `tests/unit/codexLocale.test.js`：删 resolve/persist 用例；translate
     用例保留；**新增 zh/en MESSAGES 键集合全等 parity**（仿
     quizLocale.test.js 行 24-29 的写法）。
   - `tests/unit/quizLocale.test.js`：删 resolve/persist 用例；其余保留。
   - 注意旧测试用 `DEFAULT_LOCALE` 等具名 import 的地方同步清理。

**验收**：三件套绿；`node -e` 直调 `resolveInitialLocale` 在无存储环境下返回
`'zh'` 不抛错。

---

### T2 组件与接线：LocaleSwitch + 两页换控件 + html lang + useHead（依赖 T1）

**上下文**：T1 已落地 `localeStore`（§2 契约）。美学参照
`CardCodex.vue:314-342` 的 `.locale-btn`（要删的旧钮）与
`Header.vue:151-173` 的 `.nav-tab` 激活态（要借的金线下划语言）。

**产出**：

1. `src/components/LocaleSwitch.vue`：
   - 结构：两枚 `<button type="button">` + 中缝分隔符 `·`（`--rule` 或
     `--ink-faded` 色）；文案恒为 `中文` / `EN`（不随 locale 变化）。
   - 状态：当前版 `color: var(--ink)` + `border-bottom: 2px solid
     var(--gold-leaf)`；非当前 `var(--ink-faded)`、无下划、hover 变
     `var(--ink)`。`aria-pressed` 标注当前侧；`title`/容器 `aria-label`
     走 siteLocale 的 `MESSAGES.languageToggle`（用 translateMessage 取）。
   - 字体：`var(--font-type)`、~13px、`letter-spacing: 0.08em`；触控高度
     ≥40px（padding 撑，不设死 height）；`:focus-visible` 金色描边照站内
     现有写法（`box-shadow` + `--gold-rgb`）。
   - 行为：点击非当前侧 → `localeStore.setLocale`。直接 use localeStore。
   - scoped style；480 断点自查在两页头行的换行表现（头行是 flex
     space-between，窄屏允许换行，控件整体不拆散）。
2. `src/views/CardCodex.vue` / `src/views/Quiz.vue`：
   - 删 `.locale-btn` 按钮块、`toggleLocale()` 方法、`.locale-btn` CSS；
     头行同位置嵌 `<LocaleSwitch />`（components 注册）。
   - useHead 的 title/description 改 computed：en 文案维持现状原文不动；
     zh 文案——cards：title `卡牌图鉴 · my little hpma bits`，description
     由现有 en 版自然翻译；quiz：title `魔法测验 · my little hpma bits`，
     同理。
   - 页面其他词典用法不动（`t()` 走各自 store 的 locale 委托 getter，
     响应性由 Pinia 传递）。
3. `src/App.vue`：`watch(() => localeStore.locale, v => {
   document.documentElement.lang = v; }, { immediate: true })`（setup 内，
   import localeStore）。守卫 document 存在性不必（App.vue 仅浏览器跑）。

**验收**：三件套绿；`npm run dev` 手检归主会话（切语言后：两页文案/数据侧
双语即时切换、`<html lang>` 跟随、刷新后记忆、两页语言一致、标题栏随语言变）。

---

## 4. 执行顺序

```
T1 ──→ T2 ──→ 主会话集成验收（三件套 + dev/preview 手检 + 本文档变更记录）
```

T2 依赖 T1 的 localeStore 契约，串行执行，不并行。

## 5. 变更记录

### 2026-10-10 初版交付

- T1/T2 全部完成，主会话集成验收通过。新增：`src/services/siteLocale.js`、
  `src/stores/localeStore.js`、`src/components/LocaleSwitch.vue`、
  `tests/unit/siteLocale.test.js`；改造：`codexLocale.js` / `quizLocale.js`
  （引擎删除、词典保留、codex 补导出 MESSAGES）、`cardStore.js` / `quizStore.js`
  （locale 委托 getter + setLocale 转发）、`CardCodex.vue` / `Quiz.vue`
  （旧 `.locale-btn` 移除、useHead 双语 computed）、`App.vue`（html lang watch）。
- 测试 251→253 全绿；lint/build 干净。
- 实测（preview 4174）：两页语言全站联动、刷新持久化、`<html lang>` 跟随、
  useHead 标题随语言切换（unhead 补丁为异步，有约百毫秒延迟，属正常）、
  旧键迁移链（新键 > codex 旧键 > quiz 旧键 > navigator > zh，resolve 只读
  不写）、中文/英文态控件视觉（金线下划当前版、淡墨非当前版、切换零位移）、
  480px 手机档不裁切可点按。
- T1 合理偏差两处：`DEFAULT_LOCALE` 导出移至 siteLocale（feature 词典模块
  保留 `CODEX_LOCALES`/`QUIZ_LOCALES` 供测试遍历）；feature store 中读取
  locale 的选项 getter（typeOptions 等）由 `(state) =>` 箭头改为 method
  简写以经 `this.locale` 访问委托 getter，行为等价。
