# 官网架构调研：我们该复刻谁（v2.1）

> 调研日期：2026-10-24
>
> v2 修订：2026-10-24 · 补对象层（HF）、修正三处事实、调整优先级
>
> v2.1 修订：2026-10-24 · 站长决策：SEO 做 P0a+P0b；砍掉 archive / issue 编辑层；Optimizer 保持一级；period/issue slug 用日期
>
> 问题：哪家科技公司的官网**架构**（信息架构 + 页面骨架 + 模板体系）与本站内容最适配？不考虑视觉风格。
>
> 方法：一手抓取候选官网的首页与关键子页，提取导航、分节顺序、模板清单。openai.com / huggingface.co 抓取受限（403 / 网络不可达），hoyolab.com 纯客户端渲染；相关结论标注为低分辨率。
>
> 结论先行：**主架构 = Hugging Face（对象层）× DeepSeek（纪律层）× 自建数据浏览器（`/analytics` + URL state）**。Anthropic 只借首页节奏与页脚，不借 archive 流；Linear / Vercel 只借“最近更新”的首页文案；Stripe 是长大后的远期。

---

## 0. 本站内容画像（判断适配的基准）

| 路由               | 内容                                                                     | 本质                 |
| ------------------ | ------------------------------------------------------------------------ | -------------------- |
| `/`                | 本周快照：本周 meta、19 回响散点、涨跌榜、栏目索引、更新栏（已出 40 期） | **数据可视化**       |
| `/analytics`       | 赛况图表：散点、榜单、趋势、明细表                                       | 数据浏览器           |
| `/sales-optimizer` | LP 算法交易优化器                                                        | 工具                 |
| `/cards`           | 卡牌图鉴：**141 张**，可按类型 / 稀有度 / 费用 / 关键词筛选              | 索引型工具（小目录） |
| `/quiz`            | 魔法测验：**1,847 题 / 2 个题库**；题库检索 + 计时挑战                   | **应用 + 索引**      |
| `/resources`       | 外链资料库（7 条）                                                       | 索引页               |

五个结构性事实：

1. 内容 = **一份周更数据（可视化）+ 一套工具**；`/analytics` 是数据浏览器，首页是本周快照，不是一份需要编辑部维护的“周刊”。
2. 大量子页面本质是**长列表 + 少量实体详情**；141 张卡、19 个回响是「小目录」，40 期只是时间序列——不是 HF 级 Hub，不需要分页、账号、上传。
3. 语言 = **zh/en**（[siteLocale.js](../src/services/siteLocale.js:19)）；实际覆盖 cards / quiz（优化器部分），首页与导航仍是英文 chrome。`labels.json` 另有 ja，但只服务优化器文案，且 `labels.ui` 读取 bug 尚未修（[locale-refactor.md](./locale-refactor.md) §1.1）。动效限 compositor-only，性能敏感（trends.json 已优化到 ~18KB gzipped）。
4. **对象缺 URL**：卡牌是弹层（[CardDetail.vue](../src/components/CardDetail.vue)）、回响是页内切换、period 是 store 状态。这是当前最大的架构缺口，也是本方案 P0。
5. **archive 是原始数据，不是内容产品**：40 期来自网易大神的采集，字段杂乱、没有标题/摘要/编辑口径。网站的价值是把这些数据可视化，不是给每期再包一层“issue 页”。

---

## 1. 逐家调研

### 1.1 DeepSeek — 克制的单产品门厅

来源：[deepseek.com](https://www.deepseek.com)、[deepseek.com/news](https://www.deepseek.com/news)（2026-10-24 抓取）

- **导航**：顶栏只有 logo + 获取 APP + 中英切换；产品入口收在下拉菜单与页脚（网页版 / Harness / API 开放平台 / API 文档 / 应用下载 / 加入我们）。原稿的「6 项」是产品清单，不是顶栏项数；可抄的是「每个入口一次点击」，不是数字 6。
- **首页**：公告条 → hero（一句口号 + 三个 CTA）→ 页脚。**全站约 1.5 屏**。
- **首页之外**：真实内容全在子域（chat. / platform. / api-docs. / status. / talent.），首页是门厅。
- **`/news` 模板**：头条一条放大 + 动态列表（日期 + 分类 + 标题 + 一句话摘要）+ 研究索引（纯「日期 + 标题」扁平行）+ 「查看全部」。
- **页脚 = 站点地图**：产品 / 研究（历代模型）/ 法务安全 / 加入我们。
- **结论**：用户欣赏它是对的——它好在**克制**：入口一次点击、索引是扁平行而不是卡片瀑布。但架构上它是**单一产品 + 文档**的形态；我们是五个内容面 + 周更数据，照搬会得到一个门厅套空壳。**学它的纪律，不学它的骨架。**

### 1.2 Anthropic — 编辑部型信息架构（首页节奏参考）

来源：[anthropic.com](https://www.anthropic.com)、[anthropic.com/research](https://www.anthropic.com/research)（2026-10-24 抓取）

- **导航**：News / Research / Policy / Commitments / Company + Try Claude + 搜索。按**内容流**组织，不按产品功能组织。
- **首页骨架（4–6 屏）**：使命 hero（一句话）→ 特写报告块 → **带日期的公告卡片**（每卡：标题 + 摘要 + 详情链接）→ Learn more 轮播（4 卡）→ 页脚多栏索引。
- **`/research` 索引页模板**（全站最值得抄的单页）：一句使命 → 团队/专题目录（每项带计数）→ 特写轮播 → **单行列表**（专题标签 + 日期 + 标题 + 摘要），197 条，带筛选与加载更多。
- **页脚**：九个链接栏（Research / Policy / Products / Models / Solutions …），站点地图式。
- **短板**：无语言切换；有轮播（我们可不抄）；**没有对象目录/详情体系**——它的详情页是编辑文章，不是 141 张卡的实体页。
- **结论**：样本内它最接近「把研究流做成一等公民索引页」的形态（DeepSeek / Stripe 也有三条流，但研究只是新闻列表或文档）。首页节奏与头版逐节对应；索引模板适合 `/cards`、`/echoes`。但 **archive 流不适用**：我们的 40 期是原始采集数据，没有编辑 metadata，做不出它的“带日期公告卡”。**首页节奏参考**；对象层要另找。

### 1.3 Hugging Face — 对象层蓝本（新增，低分辨率）

> 抓取受限：本机与一台备用远程主机均无法访问（DNS 非公网 / 连接超时），以下为公开架构观察，未做逐页抓取；标注为低分辨率，不据此判断站点状态。

- **Hub 三类对象**：Models / Datasets / Spaces。每类都有：
  - **Index**：左侧 facet 栏（任务 / 库 / 语言 / 许可证 / 大小…）+ 搜索 + 排序 + 结果计数 + 分页/加载更多；
  - **Detail**：model card / dataset card / Space README + 元数据侧栏（作者、更新时间、标签、许可证、版本）+ tabs（Card / Files / Community，Deploy 入口）；
  - **App**：Space 页把「说明 + 可运行应用 + 文件/社区」放在同一路由下。
- **时间流**：Papers / Blog；**参考**：Docs；**首页**：Trending models / datasets / spaces + 任务目录。
- **结论**：它不是「公司介绍站」，是「内容入口站」——与本站「五个内容面 + 周更数据」的处境同构。规模上我们不需要 Hub 的账号/上传/点赞/分页；**模式上需要它的对象模型**：每个实体一个稳定 URL、index/detail 分工、筛选进 URL、交叉链接、工具 = 说明页 + 应用页。**对象层蓝本**；视觉密度、首页信息瀑布、平台组件不抄。

### 1.4 Kaggle — 对照项（低分辨率）

> 抓取只取到标题「Kaggle: The World's AI Proving Ground」。

- **公开架构**：Competitions / Datasets / Code / Models / Learn / Discussions。
- **映射**：Competitions（时间 + 榜单）↔ 周刊 / 榜单；Datasets ↔ 卡牌 / 题库；Code / Notebooks ↔ 优化器；Learn ↔ 测验。
- **结论**：内容映射比 HF 更像「游戏数据站」的三合一（对象 + 时间 + 学习），但社区/平台组件更重、视觉更工具化；不列为主蓝本，只作对照。**备选对照**。

### 1.5 Linear — changelog 进一级导航

来源：[linear.app](https://linear.app)（2026-10-24 抓取）

- **导航**：Product / Resources / Customers / Pricing / **Now** / Contact + Docs + Open app。
- **首页 11 节**：hero + 产品演示 mock → 客户 logo 条 → 三个价值点 → 四段功能分节 → **changelog 精选** → 客户证言 → CTA → 页脚。
- 长滚动、单产品、功能巡礼式（feature-tour）营销架构。
- **结论**：整体骨架不适用（我们是数据可视化 + 工具，不是单产品营销页）。「Now」作为一级导航项的**思路**值得借鉴——前提是有一个值得进的“本期/过刊”页；我们没有 archive（见 §3.2），所以不设该导航项，只借它“把最近更新放在首页可见处”的做法。**辅助组件**。

### 1.6 Stripe — 多产品目录的成熟形态

来源：[stripe.com/cn](https://stripe.com/cn)（2026-10-24 抓取）

- **导航**：产品（mega-menu）/ 解决方案 / 开发者 / 资源 / 定价 + 登录/CTA。
- **首页 12–15 屏**：hero（标语 + GDP 份额数据）→ 客户 logo → 产品能力总览 → 大数字数据段（135+ 货币、99.999% 可用性）→ 企业段 → 初创段 → 平台段 → 开发者段 → 新闻轮播 → 出版物 → CTA → 页脚大链接表。
- **docs 独立分域**（docs.stripe.com）；**本地化走路径**（/cn/）；客户案例是独立模板（/customers/xxx）。
- **结论**：今天抄是杀鸡用牛刀——5 个一级栏目不需要 mega-menu 和 15 屏。但它是**长大后的蓝图**：产品分类目录 + docs 分域 + 路径级 i18n 是成熟答案。它的「大数字段」也证明数据证明块可以成为首页脊柱。**远期**。

### 1.7 Vercel — 产品网格 + Recently shipped

来源：[vercel.com](https://vercel.com)（2026-10-24 抓取，导航只取到部分）

- **首页骨架（4–6 屏）**：hero「Agentic Infrastructure」→ 三段客户证明 → **Recently shipped 三张产品卡** → 收尾 CTA。
- 有 /backends /agents /sandbox 独立产品页与 /new changelog 路径。
- **结论**：多产品以「卡片网格 + 各自独立页」组织，节奏紧凑。「Recently shipped」与 Linear 的 Now 同一课：**把出货节奏放在首页可见处**。**辅助组件**。

### 1.8 Cloudflare — 产品按类编目（低分辨率）

来源：[cloudflare.com](https://www.cloudflare.com)（抓取拿到的是其 AI 侧 markdown 版本，导航未取到）

- 产品目录按 **Compute / Storage / AI / Media / Network 五类分组**编目，每产品独立路径（/products/workers 等）。
- **结论**：仅补充一点——当产品多到十几二十个，「按类编目 + 每产品一页」是终局形态。对我们现阶段参考价值低于 Stripe。**暂不需要**。

### 1.9 OpenAI / HoYoLAB — 拒抓，低分辨率

来源：openai.com（403，webReader 仅取到标题「Research & Deployment」）；hoyolab.com（403，首屏仅「数据加载中」）

- **HoYoLAB** 是体裁内的对照项：游戏数据 + 社区**门户**，纯客户端渲染的信息流应用。它证明游戏数据站的常态是「客户端渲染的 feed 门户」；走科技公司编辑部级架构反而是我们的差异点。同时它是 SEO 反面教材——内容全在 JS 后面。
- **OpenAI** 以重度动效的电影感著称，与本站 compositor-only 动效预算相抵，仅作对照，不列为候选。
- **结论**：不适用。

---

## 2. 适配度矩阵

| 站点             | 导航纪律              | 首页骨架            | 索引页模板            | 对象/详情页           | 工具/App 页          | 更新节奏                 | i18n                 | 综合                                 |
| ---------------- | --------------------- | ------------------- | --------------------- | --------------------- | -------------------- | ------------------------ | -------------------- | ------------------------------------ |
| **Anthropic**    | ★★★★（内容流 5 项）   | ★★★★★（逐节对应）   | ★★★★★（单行+筛选）    | ★★（编辑型详情）      | ★★★（产品卡+独立页） | ★★★★（带日期公告卡）     | ✗ 无                 | **首页节奏参考**（archive 流不适用） |
| **Hugging Face** | ★★★（Hub 导航）       | ★★★（信息瀑布）     | ★★★★★（facet 索引）   | ★★★★★（model card）   | ★★★★★（Spaces）      | ★★★★（papers/blog）      | ★★                   | **对象层蓝本**                       |
| **DeepSeek**     | ★★★★★（入口一次点击） | ★★★（门厅式，空）   | ★★★★（扁平行）        | ★★（单产品）          | ★★                   | ★★★（/news 两段式）      | ★★★★（中英切换）     | **纪律层**                           |
| **Linear**       | ★★★                   | ★★（营销长卷）      | ★★★（changelog 列表） | ★★                    | ★★                   | ★★★★★（Now 一级导航）    | ✗                    | 辅助组件                             |
| **Vercel**       | ★★★                   | ★★★★（紧凑 4–6 屏） | ★★★                   | ★★★                   | ★★★★（产品卡网格）   | ★★★★（Recently shipped） | ✗                    | 辅助组件                             |
| **Stripe**       | ★★★（重但成熟）       | ★★（15 屏企业营销） | ★★★（案例模板）       | ★★★★（产品/案例详情） | ★★★★★（产品目录）    | ★★★（新闻轮播）          | ★★★★★（路径级 /cn/） | 远期蓝图                             |
| **Kaggle**       | ★★★                   | ★★★                 | ★★★★                  | ★★★★                  | ★★★★                 | ★★★★（competitions）     | ★★                   | 备选对照                             |
| Cloudflare       | ★★                    | ★★                  | ★★                    | ★★★                   | ★★★★（五类编目）     | ★★                       | ★★                   | 暂不需要                             |
| OpenAI / HoYoLAB | —                     | —                   | —                     | —                     | —                    | —                        | —                    | 不适用                               |

★ 是相对适配度，不是站点质量。HF 的首页和视觉不适合我们；它只在对象层得分最高。Anthropic 的“出版节奏”和“索引页模板”仍然高分，但它的 archive 流需要一个我们没有的编辑层，所以从“叙事层蓝本”降为“首页节奏参考”。

---

## 3. 复刻方案：对象 × 数据浏览器 × 纪律

### 3.1 分层蓝图

| 层             | 蓝本                 | 管什么                                                    | 明确不抄                                                |
| -------------- | -------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| **对象层**     | Hugging Face         | 实体 URL、index / detail / app 模板、筛选进 URL、交叉链接 | 登录 / 上传 / 点赞 / 下载计数、信息瀑布、密集 dashboard |
| **纪律层**     | DeepSeek             | 5 项导航、扁平行、一次点击、页脚 sitemap                  | 子域拆分、单产品门厅                                    |
| **数据浏览器** | 自建（`/analytics`） | period / mode / echo 选择、图表、表格、URL state          | `/archive` 索引、issue 编辑层、40 个周度页面            |
| **首页节奏**   | Anthropic            | 首页 hero → 本周快照 → 入口 → 更新栏；页脚 sitemap        | archive 流、轮播、客户证言、编辑型 issue 页             |
| 辅助组件       | Linear / Vercel      | 首页“最近更新”文案、最近一次数据版本                      | “Now”进导航（我们没有 archive 可进）、营销长卷          |
| 远期           | Stripe               | 产品目录、docs 分域、路径级 i18n                          | mega-menu、15 屏首页                                    |

一句话：**HF 决定「每个对象怎么活」，DeepSeek 决定「导航多克制」，自建数据浏览器决定「原始数据怎么看」；Anthropic 只负责首页的叙事节奏。**

### 3.2 信息架构（导航 + 路由）

```
现：Data · Cards · Optimizer · Quiz · Library
改：Data · Cards · Optimizer · Quiz · Library   ← 5 项不变
```

- Logo → `/`（本周快照），不再设 “This week” 导航项。
- `Data` → `/analytics`，它是**数据浏览器（按周浏览）**：period / mode / echo 都进 URL（`?period=2026-09-24&mode=2v2-high`），不另做 `/archive` 索引。
- `Cards` → `/cards`；`Quiz` → `/quiz`；`Optimizer` → `/sales-optimizer`；`Library` → `/resources`。
- 不设 Tools 分组：Sales Optimizer 是当前重要流量入口，必须一级；Quiz 也是第二大内容面，必须一级。

```text
/                         本周快照（logo 入口）
├─ /analytics             Data：数据浏览器（period / mode / echo 进 query）
├─ /echoes                回响索引（新增）
│  └─ /echoes/:id         回响详情（趋势 / 分档 / 关联卡）
├─ /cards                 卡牌索引（现有，补 URL 状态）
│  └─ /cards/:id          卡牌详情（弹层改路由）
├─ /quiz                  测验（bank / challenge 两个面）
│  ├─ /quiz/banks/:id     题库详情
│  └─ /quiz/questions/:id 题目 permalink（可选）
├─ /sales-optimizer       优化器（保持一级）
├─ /methodology           方法 / 数据字典（新增）
├─ /changelog             数据版本 / 更新记录（新增）
└─ /resources             Library（外链资料库，保留现路径）
```

**不做 `/archive`**：40 期是原始采集数据，没有标题 / 摘要 / 编辑口径；`/analytics` 的 period 选择器已经承担“按周浏览数据”的职责。给同一张图套 40 个页面，只会得到薄内容，不会得到多少 SEO。

若未来某周的数据值得单独做 SEO 页，再加 `/issues/YYYY-MM-DD`（日期 slug），**不加索引页**；那是后话，不是本轮 P0。

工具不改路径；`/tools/*` 不引入。

### 3.3 对象模型与 URL 规则（新增）

| 对象             | 索引                          | 详情                           | 状态 / 筛选               | 规模  |
| ---------------- | ----------------------------- | ------------------------------ | ------------------------- | ----- |
| 期（Period）     | `/analytics`（period 选择器） | 无独立页；`?period=YYYY-MM-DD` | `?period=&mode=&echo=`    | 40    |
| 回响（Echo）     | `/echoes`                     | `/echoes/:id`                  | `?mode=&period=`          | 19    |
| 卡牌（Card）     | `/cards`                      | `/cards/:id`                   | `?type=&rarity=&cost=&q=` | 141   |
| 题库（Bank）     | `/quiz`（bank tab）           | `/quiz/banks/:id`              | `?theme=`                 | 2     |
| 题目（Question） | `/quiz/banks/:id`             | `/quiz/questions/:id`（可选）  | `?theme=`                 | 1,847 |
| 工具（Tool）     | —（工具少，不做目录页）       | `/sales-optimizer`、`/quiz`    | 输入进 query              | 2     |
| 外链（Link）     | `/resources`                  | —                              | `?tag=`                   | 7     |

六条规则：

1. **每个对象一个稳定 URL**：卡牌从 [CardDetail.vue](../src/components/CardDetail.vue) 弹层改成 `/cards/:id`；回响从 analytics 的页内切换改成 `/echoes/:id`；期不做独立页，period 进 `/analytics` 的 query（`?period=2026-09-24`）。弹层可以保留作快速预览，但详情页必须存在。
2. **Index 与 Detail 分工**：index 拥有筛选 / 排序 / 搜索 / 计数；detail 拥有元数据 / 正文 / 关联 / 历史。不要把筛选器放详情页，也不要把详情塞进列表弹层。
3. **筛选与 period 进 URL**：`/cards?type=spell&rarity=epic&cost=5&q=...`、`/analytics?period=2026-09-24&mode=2v2-high`；返回 / 分享 / 刷新可复现。当前 `/cards` 的筛选状态在 store 里、`/analytics` 的 period/mode 也在 store 里，刷新即丢——这是最容易修、收益最高的一步。
4. **交叉链接**：card ↔ echo ↔ period ↔ question；每个详情页底部 related，索引页不堆关联。
5. **工具 = 说明页 + 应用页**：`/sales-optimizer` 讲 LP 模型与输入，应用就在同一页下方；quiz 的 bank / challenge 两面用 tab + URL 状态（`?tab=challenge`）；输入参数进 query（`?budget=12000&strategy=minimize_stock`）。
6. **数据分实体加载（P0.5，不阻塞 P0）**：构建期把 `cards.json` / `quiz.json` 拆成 per-entity payload + 索引 JSON；详情页冷启动不加载整包。现在 cards.json 约 19.5 万行、quiz.json 约 8.8 万行；但从 `/cards` 进 `/cards/:id` 可复用已加载的 store，P0 第一步没有新增加载成本。

### 3.4 页面模板（五类）

1. **索引页模板**（Anthropic `/research` × HF index）：一句定位 → 分类目录（带计数）→ 单行列表（标签 + 标题 + 摘要）或网格（卡牌）→ 筛选 + 结果计数。分页 / 加载更多**按规模裁剪**：19 个回响、141 张卡都不需要；1,847 题的全量浏览才需要。
2. **详情页模板**（HF model card）：标题 + 元信息（ID、版本、数据日期、标签）→ 正文 / 数据块（卡牌：数值 / 等级；回响：趋势 / 分档）→ tabs（概览 / 数值 / 关联 / 历史）→ 底部 related。
3. **App 页模板**（HF Space）：说明（这是什么、输入 / 输出、算法 / 规则）→ 嵌入式应用 → 可分享参数 → 结果态 / 空态 / 错误态。用于 `/quiz` 的 challenge 面与优化器。
4. **数据浏览器模板**（自建）：`/analytics` 的 period / mode / echo 控件 → 图表网格（散点、趋势）→ 明细表 → URL state。它是按周浏览数据的入口，不是 `/archive` 索引页。
5. **首页新闻卡模板**（Anthropic）：日期 + 标题 + 一句摘要 + 链接；只用于 `UpdatesStrip` 与首页“最近更新”，不用于 archive 列表。

### 3.5 首页骨架映射

| Anthropic           | 本站对应                              | 现状               |
| ------------------- | ------------------------------------- | ------------------ |
| 使命 hero 一句话    | Masthead 定位句                       | 已有               |
| 带日期公告卡        | WeekPlate（No. 40 · 日期）            | 已有               |
| Learn more 入口轮播 | ToolGrid 栏目索引（改静态，不抄轮播） | 已有               |
| 页脚多栏站点地图    | SiteFooter                            | 待升级             |
| Now / 本期          | 首页即本期；不设“本期”导航项          | 已有（logo → `/`） |

首页映射说明我们不是重做，而是把已有的 Masthead / WeekPlate / ToolGrid 重新排序；对象层的工作在详情页与 `/analytics` 的 URL state，不在首页。首页不承担 archive 索引。

### 3.6 不做 issue 编辑层（决策）

`trends.json` 只有 `generatedAt / periods / modes / rows`，没有每期的标题、摘要、封面、标签；40 期是网易大神的原始采集，字段杂乱。**结论：不做 `/archive`，不做 `issues.json`，不做生成式/手写 issue 摘要。**

- 按周浏览 = `/analytics` 的 period 选择器 + URL state；用户看到的是数据，不是“第 40 期专题”。
- 如果未来某周值得单独做 SEO 页，用 `/issues/YYYY-MM-DD`，内容就是该周的图表 + 榜单 + 数据表；不写编辑判断，也不加索引页。
- `No. 40` 只作为首页 / 图表上的显示标签，不是路由。
- 即使未来做，也不写生成式头条（[homepage-redesign.md](./homepage-redesign.md) §1.3）；issue 页只放数据块。

### 3.7 优先级（v2.1：SEO 拆成 P0a / P0b）

1. **P0a — URL state + 对象路由**：`/analytics?period=&mode=&echo=`、`/cards?type=&rarity=&cost=&q=`、`/cards/:id`、`/echoes/:id`。先把「可分享、可回退、可引用」打通；这是 P0 的即时收益，也是 P0b 的前置。
2. **P0b — 预渲染 + per-entity meta + sitemap**：构建期预渲染首页、`/analytics`（默认态）、`/cards`、141 个 `/cards/:id`、`/echoes`、19 个 `/echoes/:id`、`/quiz`、`/sales-optimizer`、`/resources`。`useHead` 输出 per-entity title / description / canonical / OG；sitemap 由构建期数据生成，不再只列 6 条。Chart.js 只在客户端渲染；静态 HTML 保留标题 / 表格 / 正文，不把图表变成静态图。
3. **P1 — 工具 URL 化**：`/quiz` 的 bank / challenge 两面、`/sales-optimizer` 输入进 query；题库页按需，题目 permalink 可选。
4. **P2 — 首页 / 页脚 / 方法页**：`/methodology`、`/changelog`；首页的 UpdatesStrip 接数据版本。
5. **P3 — i18n 路径级**：只有 zh/en；等 P0b 的 canonical / hreflang 需要时再做。

P0b 有两条实现路径：`vite-ssg`（干净，但要把 `fetch('/archive/*.json')` 改成 build-time 数据加载）或 build 后 Puppeteer 逐路由预渲染（不改运行时，先落地；Chart.js 画布内容不可索引，但标题 / 表格 / 正文可索引）。建议先 B 验证 160 页，再评估 A。

**不做 `/archive`**：40 期是原始数据，没有编辑 metadata；`/analytics` 的 period 选择器就是按周浏览。把 40 期做成 40 个薄页面，SEO 收益低于 141 张卡 + 19 个回响的实体页。

对象路由是 P0a 的一部分；P0b 紧随其后，因为你确认 SEO 是目标。先 P0a 再 P0b 不是因为 SEO 可以等，而是预渲染需要稳定的路由和 URL 约定——没有 P0a，P0b 没有东西可预渲染。

### 3.8 不抄什么

- `/archive` 索引与 issue 编辑层（原始数据没有编辑 metadata；`/analytics` 已是数据浏览器）；
- 40 个周度页面（薄内容；除非未来某周有独特内容，再单开）；
- Anthropic 的轮播（与 compositor-only 预算相抵，且索引轮播信息密度低）；
- DeepSeek 的子域拆分（我们没有那么多面，拆域反而碎）；
- Stripe 的 mega-menu 与 15 屏营销长卷（5 条路由用不上）；
- 任何一家的「客户 logo 墙 / 证言段」（我们无此内容）；
- HF 的登录 / 上传 / 点赞 / 下载计数、首页信息瀑布、密集 dashboard chrome（我们不是平台）；
- 规模不符的「加载更多」：19 个回响、141 张卡不需要；只有 1,847 题的全量浏览才需要。

### 3.9 i18n 处理

- 现在只有 **zh/en**（[siteLocale.js](../src/services/siteLocale.js:19)）；`labels.json` 的 ja 只服务优化器文案，且 `labels.ui` 读取 bug 尚未修（[locale-refactor.md](./locale-refactor.md) §1.1）——不要把它算进「三语架构」。
- DeepSeek 的头部中英切换（本站 `LocaleSwitch` 已是此形态，保留）。
- Stripe 的路径级本地化（/zh/、/en/）——若未来要 SEO，迁移到路径级；当前 SPA 阶段维持现状即可。
- P0b 先用单语 canonical（按目标搜索市场定 zh 或 en），per-entity title / description 用对应语言；路径级 `/zh/`、`/en/` 与 hreflang 仍 P3。
- 对象详情页的 `useHead` title / description 要按实体 + locale 生成；这是 P0b 的前置条件。

### 3.10 远期：Stripe 形态

- 产品目录：工具多到十几个时，再做 `/tools` 分类目录；
- docs 分域：`/methodology`、`/changelog` 长大后再拆独立 docs；
- 路径级 i18n：`/zh/`、`/en/`；
- 客户案例模板 → 我们的「卡 / 回响」详情模板。

不是现在。

---

## 4. 结论

如果只能记住一句：**首页借 Anthropic 的节奏，详情页借 HF 的对象模型，导航守 DeepSeek 的 5 项；周度数据不建页面，做 `/analytics` 的 period state。**

这套组合不冲突：Anthropic 只解决首页“怎么读本周”，HF 解决“141 张卡 / 19 个回响怎么被浏览和引用”，DeepSeek 解决“不要为了架构而加导航”。数据浏览器是自建层：`/analytics` 用 period / mode / echo 的 URL state 承担按周浏览，不做 `/archive`、不做 issue 编辑页。P0a 打通 URL，P0b 预渲染 + meta + sitemap；先对象层，再 SEO 层，最后才是视觉。

---

## 5. 参考来源与抓取状态

| 站点         | URL                                          | 抓取状态                                                    | 用途               |
| ------------ | -------------------------------------------- | ----------------------------------------------------------- | ------------------ |
| DeepSeek     | [deepseek.com](https://www.deepseek.com)     | 200，首页 + /news                                           | 纪律层             |
| Anthropic    | [anthropic.com](https://www.anthropic.com)   | 200，首页 + /research（内容截断）                           | 首页节奏           |
| Hugging Face | [huggingface.co](https://huggingface.co)     | 本机与备用主机均不可达（DNS 非公网 / 连接超时），未逐页抓取 | 对象层（低分辨率） |
| Kaggle       | [kaggle.com](https://www.kaggle.com)         | 200，仅标题                                                 | 对照（低分辨率）   |
| Linear       | [linear.app](https://linear.app)             | 200                                                         | 辅助组件           |
| Stripe       | [stripe.com/cn](https://stripe.com/cn)       | 200                                                         | 远期               |
| Vercel       | [vercel.com](https://vercel.com)             | 200，导航部分                                               | 辅助组件           |
| Cloudflare   | [cloudflare.com](https://www.cloudflare.com) | 低分辨率                                                    | 暂不需要           |
| OpenAI       | [openai.com](https://openai.com)             | 403                                                         | 不适用             |
| HoYoLAB      | [hoyolab.com](https://www.hoyolab.com)       | 403 / 纯客户端渲染                                          | 体裁对照           |

---

## 6. 变更记录（v1 → v2.1）

- **修正**：141 张卡（原「数千张」）；zh/en（原「cn/en/ja 三语」，ja 只在优化器 labels）；DeepSeek 6 项是产品下拉（原「导航 6 项」）。
- **新增**：HF 对象层、Kaggle 对照、App 页模板、对象模型 / URL 规则、issue metadata 缺口、抓取状态表。
- **调整**：结论从「Anthropic × DeepSeek」改为「Anthropic × HF × DeepSeek」；`/archive` 从 P0 降为 P1，对象路由升为 P0。
- **保留**：Anthropic 首页 / 索引分析、Linear / Vercel / Stripe / Cloudflare / OpenAI / HoYoLAB 判断、i18n 方向、不抄清单。
- **v2.1**：见 §8 站长决策（SEO 拆 P0a/P0b；砍 archive / issue 编辑层；5 项导航；日期 slug）。

---

## 7. v2 评审（2026-10-24，ZCode）

> 结论：**批准 v2**——HF 对象层补上了 v1 的盲区（对象没有 URL），优先级调整成立。改掉下述两处论据后即可作为重构任务书基线。所有事实断言已逐条对代码库核实。
>
> v2.1 回应：见 §8。

### 7.1 事实核查（全部通过）

- ✅ 141 张卡（`spellbook/cards.json` 实测）；cards.json 195,457 行、quiz.json 87,798 行，与文中约数一致
- ✅ 1,847 题 / 2 题库（history_of_magic 1223 + muggle_studies 624）
- ✅ 仅 zh/en，`siteLocale.js:19` 行级引用精确；trends.json 仅 `generatedAt / periods / modes / rows` 四键
- ✅ CardDetail 确为弹层（`role="dialog"` + fixed overlay）；`/resources` 7 条（`externalLinks.json`）
- ✅ `/cards` 筛选态在 cardStore、全文件无 `route.query`，「刷新即丢」属实
- ⚠️ DeepSeek 顶栏项数无法独立复核（抓取的 markdown 分不出下拉与顶栏），但修正后的表述更保守、结论更稳，按修正版采用

### 7.2 定稿前应改的两处

1. **§3.7 P0 的 SEO 论据**：与本文件 §1.9 的 HoYoLAB 批评相抵——纯 CSR 路由页在预渲染落地前对爬虫同样不可见。P0 的即时收益改写为「可分享、可引用的稳定 URL」；SEO 收益注明依赖 §3.9 的 `useHead` + 预渲染前置条件。若 SEO 是真实驱动力，则预渲染次序应提前，而非维持 P3。
2. **§3.3 规则 6 降级为非阻塞**：实测 `/cards` 目前已是整包加载 cards.json（`spellbookService.load()` 单文件 fetch），弹层改路由第一步零新增加载成本；per-entity 拆分只对 deep-link 直达详情页有意义。标注为「P0.5 优化项」，避免 P0 工作量被高估到不敢开工。

### 7.3 口味意见（两可，需有意识决策）

- **5 项导航版优于 6 项版**（Logo 已承担回首页，Linear 的 Now 是独立页不是首页）。但 **Quiz 入 Tools 是取舍而非顺手合并**：按 §0 画像 quiz 是「应用 + 索引」、全站第二大内容面（1,847 题），并入 Tools 会藏掉一个内容入口。可以合，但要写明是有意为之。
- HF 的「DNS 非公网」更像本机网络环境问题（污染 / 公司 DNS），不像 HF 本身的事。建议换网络复验一次，把对象层蓝本从低分辨率升级为一手抓取——它承担着 P0 的理论支撑。当前描述与公开事实相符，不影响结论。

### 7.4 小点

- `/issues/:slug` 的 slug 方案（`no-37` vs 日期区间）尽早定死一个永不变的；
- Kaggle 维持对照即可，不必展开；
- P0 最轻的切入口：给 `cardStore.filters` 接上 `route.query` 双向同步——即本文件规则 3 说的「最容易修、收益最高的一步」，已核实属实。

---

## 8. 站长决策（2026-10-24）

| 决策        | 结论                                                                                   |
| ----------- | -------------------------------------------------------------------------------------- |
| SEO         | 做 P0a + P0b；P0b 含预渲染、per-entity meta、动态 sitemap                              |
| archive     | 不做 `/archive` 索引；不做 issue 编辑层 / `issues.json`；`/analytics` 是按周数据浏览器 |
| 导航        | 保持 5 项：`Data · Cards · Optimizer · Quiz · Library`                                 |
| Optimizer   | 保持一级（重要流量入口），不并入 Tools                                                 |
| Quiz        | 保持一级（应用 + 题库，第二大内容面）                                                  |
| slug        | `YYYY-MM-DD`（周期开始日）；`No. 40` 只做显示                                          |
| ZCode 7.2.1 | 采纳：P0 即时收益改为分享 / 深链；SEO 依赖 P0b                                         |
| ZCode 7.2.2 | 采纳：规则 6 → P0.5，不阻塞 P0                                                         |
| ZCode 7.3.1 | 部分采纳：Quiz 不藏；因无 archive，导航维持 5 项，不是“5 > 6”                          |
| ZCode 7.3.2 | 记录：本机 + 备用主机均不可达；不据此判断 HF                                           |
| ZCode 7.4.1 | 采纳：日期 slug                                                                        |
| ZCode 7.4.3 | 采纳：先做 `cardStore.filters` ↔ `route.query`                                         |

待定（P0b 前定）：

- canonical 语言用 zh 还是 en（影响 141 张卡 + 19 个回响的 title / description）；
- `/cards/:id` 用嵌套路由（列表保留、详情覆盖）还是兄弟路由（独立页、滚动还原）；
- issue 页是否永远不做——当前决策是不做；若未来做，按 `/issues/YYYY-MM-DD`，不加索引。

---

## 9. 实施状态（2026-10-24）

已完成：

- **数据仓**：cards / echoes 双模块切到 `hpma-bits/hpma-spellbook`（`cards-v1.20261024.0` / `echoes-v1.20261024.0`，各自 schema 1）；新增 `public/data/echoes/`；图片 raw L1 + `/cardimg/*`、`/echoimg/*` 同源 L2；`scripts/fetch-spellbook-modules.mjs`、workflow、README 已切新仓。
- **P0a**：`/cards/:id`、`/echoes`、`/echoes/:id` 独立页；`/analytics?period=&mode=&echo=` 与 `/cards?type=&rarity=&cost=&q=` 双向 URL state；`scrollBehavior` 改为 `savedPosition`。
- **P0b**：167 个静态页（7 个主页面 + 141 张卡 + 19 个回响）；每页恰好 1 条 canonical；卡/回响页双语 title / description；`sitemap.xml` 167 条；Netlify 构建命令为 `npm run build:prerender`。
- **决策落地**：canonical 采用“单 URL + 双语 meta”，不选 zh/en 单语、暂不做 hreflang；`/cards/:id` 用独立页而非嵌套弹层。

仍待：

- 路径级 i18n / hreflang（P3）。
- 若未来做 issue 页，按 `/issues/YYYY-MM-DD`，不加索引。
- 可选清理：旧 `CardDetail` 弹层组件、`/echoes` 图标的组件化 L2 fallback。
