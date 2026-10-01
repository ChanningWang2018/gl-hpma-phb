# 卡牌图鉴页（Card Codex）设计与任务分割

> 2026-10-01 制定。数据源为已上线的 hpma-spellbook 数据包（生产链路见下），
> 本文是给 subagent 的自包含任务书：每个任务含上下文、要动的文件、验收标准。

## 0. 背景与数据链路（已建成的部分，不要重建）

```
HPMA-Research (E:\Scripts\HPMA-Research)
  游戏客户端提取 → export_spellbook_web_bundle.py → 打包发布
    ↓ 发布（游戏热更后 3 条命令，已自动化）
hpma-data 公开仓 (github.com/ChanningWang2018/hpma-data)
  spellbook/ : cards.json (2.2MB, 141 卡) + manifest.json + images/*.png (34MB)
               + schema/*.schema.json + checksums.txt
  版本契约:  Release tag = spellbook-v{schema}.{data}.0，当前 spellbook-v1.1.0
  npm 包:    hpma-spellbook-data
    ↓ 消费（本次要做）
gl-hpma-phb (本站) 新增 /cards 图鉴页
```

参考消费者（loader 的移植来源，只读参考，不要改它）：
`E:\Scripts\hpma-cards-consumer\src\hpma-cards.js` — 零依赖 ESM loader，
`createClient({ baseUrl })`，含 schema_version 守卫、zh 回退、type/rarity 索引。

### 数据形状（schema_version 1）

```jsonc
// cards.json
{
  "schema_version": 1, "data_version": 1, "generated_at": "...",
  "labels": { "type": {"spell": {"zh": "咒语卡", "en": "Spell"}, ...},
              "rarity": {"common".."mythic"/"dark": {"zh","en"}} },
  "cards": [ { "id": 1001, "type": "spell|summon|companion",
               "rarity": "common|rare|epic|legendary|mythic|dark",
               "cost": 5, "img": "images/1001.png", "spell_word": "GLACIUS",
               "tags": ["输出","控制"],
               "i18n": { "zh": {"name","desc","quote","stats"},
                         "en": {"name","desc","quote"} },   // en 可缺失，回退 zh
               "levels": [ {"lv":1, "v": <number|string 联合>}, ... ] } ]
}
```

## 1. 架构决策（已定，照做）

| 决策           | 结论                                                                                                                                  | 理由                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 数据 JSON      | **提交进仓** `public/data/spellbook/{cards,manifest}.json`                                                                            | dev 免网络、构建无外部依赖、每次更新的 git diff 可审；`/data/*` 在 netlify.toml 已有 1h 缓存头；2.2MB/次可接受                                                                                                                         |
| 卡面 PNG       | **不进本站仓库**，运行时外链 jsDelivr 锁 tag：`https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@spellbook-v1.1.0/spellbook/` | 版权约束（hpma-data LICENSE-NOTES：禁止再分发卡面图源）→ 只引用不复制；jsDelivr 对 tag 内容 immutable 缓存一年。**大陆可用性因运营商/地区而异（jsDelivr 主域 2021 年底失去 ICP 备案后长期不稳），默认源待拨测后定，三级降级链见 §1.1** |
| 版本单一事实源 | `public/data/spellbook/version.json`：`{ "tag", "version", "schemaVersion", "dataVersion", "imageBase", "generatedAt" }`              | CI 更新它、UI 读它显示数据版本徽标、`--verify` 用它做一致性校验                                                                                                                                                                        |
| 加载器         | 移植 `hpma-cards.js` → `src/services/spellbookClient.js`（保留纯函数导出），外面包 `src/services/spellbookService.js` 静态类门面      | 纯函数便于 vitest（node 环境）直测；门面符合 AGENTS.md 服务层惯例。**关键改造**：数据 base 与卡面 base 分离（数据来自本站 `/data/spellbook/`，图来自 `version.json` 的 `imageBase`），`createClient({ dataBaseUrl, imageBaseUrl })`    |
| 状态           | `src/stores/cardStore.js`（Options 风格 defineStore，仿 chartStore：loading/error + try-catch-finally）                               | AGENTS.md 规约                                                                                                                                                                                                                         |
| 兜底           | 卡面三级降级（§1.1）：直连 jsDelivr → 失败自动换本站代理 `/cardimg/*` → 占位卡背；另留 `?img=<base>` 手动覆盖                         | 大陆 jsDelivr 波动时的逃生门，占位复用站内头像 canvas fallback 模式                                                                                                                                                                    |
| 自动更新       | GitHub Actions 定时跑 `scripts/fetch-spellbook.mjs`（见任务 T4），有新版 → 数据入库 → commit+push → Netlify 自动部署                  | 本仓库已有 cron workflow 先例（api_crawler.yaml）；`releases/latest` API 匿名可查，GITHUB_TOKEN 即可                                                                                                                                   |
| 拒绝的备选     | npm 依赖（node_modules 膨胀/更新链多一环）、纯运行时 jsDelivr 取数据（国内可用性风险不可控、无回退）                                  | —                                                                                                                                                                                                                                      |

明确不做：图片本地化/自建代理（需重估版权）；cards.json 分片压缩（gzip 后体积可接受，先不过度设计）；组件级 UI 测试（vitest 是 node 环境，与现状一致只测逻辑层）。

### 1.1 卡面源与大陆可用性（三级降级链）

数据 JSON 走本站域名（EdgeOne 加速）不受影响；**唯一暴露在 jsDelivr 波动下的环节是卡面**。
jsDelivr 主域 cdn.jsdelivr.net 自 2021 年底失去 ICP 备案后大陆可用性长期
"因运营商/地区而异"（部分网络直连顺畅、部分 DNS 污染/超时），fastly.jsdelivr.net
是大陆相对常用的镜像域但同样无法承诺。因此卡面加载设计为三级降级：

- **L1 直连**：默认 `imageBase`（version.json，候选 fastly.jsdelivr.net），
  快、零本站流量；对可达用户是最优路径。
- **L2 本站透明代理**：`<img>` onerror 时自动把 src 换成
  `/cardimg/images/{id}.png` 再试一次。netlify.toml 一个 redirect 块实现：
  ```toml
  [[redirects]]
    from = "/cardimg/*"
    to = "https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@spellbook-v1.1.0/spellbook/:splat"
    status = 200
    force = true
  ```
  路径 = 大陆用户 → EdgeOne（本站已跑通的跨境链路）→ Netlify 边缘 → jsDelivr，
  用户侧不直连 jsDelivr；jsDelivr 的 immutable 缓存头被边缘继承，热身后边缘命中。
  版本升级时 redirect 内 tag 与 version.json 同步换。
- **L3 占位卡背**：L2 也失败才渲染（token 色块 + 卡名），不阻塞列表。

版权口径：L1 纯引用；L2 是 CDN 式代理缓存（源站仍是 hpma-data 公开仓，
本站仓库不存储任何卡面字节），比 L1 更进一步、比"图进仓"保守；若将来改选
"卡面入本站仓库/部署"则是明确的再分发，需重新拍板。

**默认源裁决（T5 执行）**：用大陆拨测（itdog.cn / 17ce / 阿里云拨测）对
fastly 与 cdn 两域的目标图片 URL 实测各省可用率——可用率高（约 >95%）则
L1 直连为默认（L2 仅作自动降级）；不稳则把 version.json 的 `imageBase`
直接设为 `/cardimg/`（L2 为默认，L1 作 `?img=` 逃生门）。

2026-10-01：暂维持 L1 直连（fastly.jsdelivr.net）为默认；大陆拨测待站长执行后裁决（工具 itdog.cn/17ce，判据见上）。

### 1.2 明确不做（续）

明确不做：图片本地化/自建代理（需重估版权）；cards.json 分片压缩（gzip 后体积可接受，先不过度设计）；组件级 UI 测试（vitest 是 node 环境，与现状一致只测逻辑层）。

## 2. 任务分割（T1 → (T2 → T3) ∥ T4 → T5）

每个任务的验收底线：`npm run test`、`npm run lint`、`npm run build` 全绿；不引入新的运行时依赖；遵守 AGENTS.md（paper 调色板 token 禁止硬编码 hex、2 空格、单引号、分号、scoped style）。

---

### T1 数据层：加载器移植 + 首版数据入库

**上下文**：本任务建立其他所有任务依赖的数据契约。数据形状见 §0；loader 原型在
`E:\Scripts\hpma-cards-consumer\src\hpma-cards.js`（连同其测试
`E:\Scripts\hpma-cards-consumer\test\loader.test.mjs`，断言可大量移植）。

**产出**：

1. `public/data/spellbook/cards.json`、`manifest.json` — 从
   `E:\Scripts\hpma-data\spellbook\` 原样拷贝（不要重排格式、不要二次序列化）。
2. `public/data/spellbook/version.json`：
   ```json
   {
     "tag": "spellbook-v1.1.0",
     "version": "1.1.0",
     "schemaVersion": 1,
     "dataVersion": 1,
     "imageBase": "https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@spellbook-v1.1.0/spellbook/",
     "generatedAt": "<取 manifest.json 的 generated_at>"
   }
   ```
3. `src/services/spellbookClient.js` — 移植 loader：
   - 保留 `EXPECTED_SCHEMA_VERSION`、`joinUrl`、`normalizeBaseUrl`、`lookupLabel`、
     `lookupText`（zh 回退）、`resolveImageUrl` 纯函数导出。
   - `createClient({ dataBaseUrl, imageBaseUrl })`：数据取
     `{dataBaseUrl}/cards.json` + `manifest.json`（Node 环境非 http 路径走
     `node:fs` 读盘的分支**保留**——单测靠它零 mock 直读真数据）；图片 URL 一律
     join `imageBaseUrl`。加载时同时读 `version.json` 暴露为
     `client.versionInfo`。
   - schema_version ≠ 1 时抛出原 loader 那样的中文友好错误（说明需升级消费端）。
4. `src/services/spellbookService.js` — 静态类门面（仿 dataService 风格）：
   单例化 createClient（数据 base 默认 `/data/spellbook/`，图 base 从
   version.json 读，支持 URL `?img=` 覆盖）、`load()`、按 type/rarity/cost
   过滤、name/spell_word 跨 zh+en 搜索、levels 数值表行格式化（`v` 是
   number|string 联合）。
5. `tests/unit/spellbookClient.test.js`（+ spellbookService 的过滤/搜索/回退用例）：
   baseUrl 直接指向 `public/data/spellbook/` 做真数据集成断言（141 张、三类计数
   65/52/24、en 缺失时 zh 回退、schema 守卫抛错）。

**验收**：`npm run test` 全绿；`node -e` 冒烟调用 createClient 读盘成功。

---

### T2 cardStore + 图鉴页骨架（网格、筛选、搜索）

**上下文**：依赖 T1 的 spellbookService。页面美学 = 本站报纸风：纸面/油墨
token（global.css `:root`）、标题 IM Fell English、说明/控件 Special Elite、
数据正文系统 sans；UI 文案中文优先。

**产出**：

1. `src/stores/cardStore.js`：
   - state：`cards/labels/versionInfo/loading/error` +
     `filters: { type: 'all'|'spell'|'summon'|'companion', rarity: 'all'|<code>,
  cost: 'all'|<n>, search: '' }`
   - getters：`filteredCards`（组合筛选 + 搜索）、`typeOptions/rarityOptions/
costOptions`（从 labels 与数据派生，带 zh 显示名与计数）。
   - action：`loadCards()`（try-catch-finally，error 落 state 供 UI 显示）。
2. `src/views/CardCodex.vue`：
   - 顶部：栏目标题（IM Fell English）+ 数据版本徽标（"数据 v1.1.0 · 141 卡"，
     读 versionInfo，链到 hpma-data 仓 tag）。
   - 工具栏：类型三分段（咒语/召唤/伙伴 + 全部）、稀有度下拉、费用筛选、
     搜索框（防抖 200ms）；显示当前命中数与空态。
   - 卡格：CSS grid `repeat(auto-fill, minmax(140px, 1fr))`（480px 以下
     minmax(110px,1fr)）；卡 tile = 3:4 aspect-ratio 占位 + `loading="lazy"`
     `decoding="async"` 的卡面 img + 底部小字（zh 名，en 名次要色）；稀有度用
     细色条/角标区分（--oxblood/--teal-ink/--gold-leaf/--violet-ink 等 token），
     费用徽标左上角。
   - img 三级降级（§1.1）：onerror 先自动把 src 换成本站代理
     `/cardimg/images/{id}.png`（netlify.toml 的 redirect 代理到同一 jsDelivr
     tag，本任务一并加上该 redirect 块），再失败才渲染占位卡背（token 色块 +
     卡名，复用 dataService 头像 canvas fallback 思路）；全程不弹错误、不打断
     列表。
3. `useHead({ title, description })`（仿 ExternalLinks.vue）。

**验收**：三件套绿；`npm run dev` 逻辑上无引用断裂（build 通过即证明）。

---

### T3 详情弹层 + 等级数值表（依赖 T2）

**产出**：

1. `src/components/CardDetail.vue`：Teleport 弹层；左侧 3:4 大卡面（同一
   onerror 兜底），右侧信息栏——
   - zh 名（大）+ en 名 + spell_word（印刷体小标）；
   - cost / type / rarity 徽标（labels zh 名）；
   - desc 全文、quote（引用体例，若缺失不渲染）、tags 徽标行；
   - **levels 数值表**：列 = 等级 lv，行 = 各等级 `v`（number|string 联合
     原样显示）；stats 文本若缺失不渲染。
   - 关闭：Esc、遮罩点击、右上 ×；焦点圈定在弹层内，打开时 focus 到关闭钮
     （基础可达性）。
2. CardCodex 卡 tile 点击 → 打开详情（选中卡 id 进 store，URL 无需同步）。
3. 弹层进出场只用 transform/opacity，且包 `prefers-reduced-motion` 关闭。

**验收**：三件套绿。

---

### T4 自动更新管道（只依赖 T1 的 version.json 契约，可与 T2/T3 并行）

**上下文**：目标是"游戏热更 → 生产端发布（已有链路）→ 本站最迟下个周期自动跟上，
全程零人工"。检测端：`GET https://api.github.com/repos/ChanningWang2018/hpma-data/releases/latest`
（已实测匿名可查；workflow 里用 GITHUB_TOKEN 提限额）。**取数端**：不下载
release zip（Node 零依赖解 zip 不值得），改为按 tag 从
`https://raw.githubusercontent.com/ChanningWang2018/hpma-data/<tag>/spellbook/`
下载三个裸文件：`checksums.txt` + `cards.json` + `manifest.json`，用
`node:crypto` 计算 sha256 与 checksums.txt 逐条比对（来源是不可变 tag，
完整性等价于 release zip + sha256；实施时先看一眼
`E:\Scripts\hpma-data\spellbook\checksums.txt` 的实际行格式再写解析）。

**产出**：

1. `scripts/fetch-spellbook.mjs`（**仅 node 内置模块，零依赖**；风格对齐
   scripts/build-trends.mjs：顶部注释说明用途、纯函数导出便于测试、`--verify`
   模式）：
   - `update`（默认）：拉 latest release → tag 必须匹配 `^spellbook-v` → 与
     `public/data/spellbook/version.json` 的 tag 比对，相同则打印
     "already up to date" 退出 0 → 按上文取数端下载三文件 → sha256 校验 →
     结构断言（cards 数组非空、schema_version === 1，若为 2
     则明确报错"消费端需升级，拒绝入库"）→ 覆盖写入 `public/data/spellbook/`
     的 cards/manifest/version.json（imageBase 里的 tag 同步换成新 tag）→
     打印摘要（版本、新增/移除卡 id diff——对比新旧 cards.json 的 id 集合）。
   - `--check`：只检测是否有新版，有则退出码 2，无则 0（供 workflow/人工快速判断）。
   - `--verify`：本地 cards/manifest/version.json 与 version.json 所指 tag 的
     release 重新下载比对（或至少 sha256 自洽 + version.json 与 manifest 的
     schema/data_version 一致），不一致退出 1——供 CI 防手改漂移。
   - 参数可覆盖数据仓名（默认 `ChanningWang2018/hpma-data`）。
2. `tests/unit/fetchSpellbook.test.js`：版本比对逻辑、id diff 计算、tag 解析、
   version.json 组装（纯函数；网络部分不测）。
3. `.github/workflows/spellbook-update.yml`：
   - `schedule: cron "0 3 * * 1"`（周一 03:00 UTC ≈ 北京 11:00）+
     `workflow_dispatch`；`permissions: contents: write`。
   - steps：checkout → `node scripts/fetch-spellbook.mjs update` →
     `git diff --quiet && echo noop || (git add public/data/spellbook && git
commit -m "chore(spellbook): data <version>" && git push)` →
     job summary 输出版本与 diff 摘要。push 到 main 触发 Netlify 自动部署。
   - 失败依赖 GitHub 默认邮件通知（不额外接通知渠道）。
4. `.github/workflows/ci.yml` 追加一步
   `node scripts/fetch-spellbook.mjs --verify`。
5. README 的开发工作流一节补三行说明（更新链路 + 手动触发入口）。

**验收**：本地 `node scripts/fetch-spellbook.mjs --check` 退出 0（当前已是
latest）；`--verify` 通过；`npm run test` 全绿；workflow YAML 语法经
`node -e`/yaml 解析或 `gh workflow list` 本地无断言（CI 上验证）。

---

### T5 集成与打磨（收尾）

**产出**：

1. `src/router/index.js`：`/cards` 懒加载路由，name `'cards'`。
2. `src/components/Header.vue`：nav 加 "Card Codex" tab；subtitles 映射加
   `cards: 'Every card, catalogued'`。
3. `src/sitemap.js`：加 `/cards` 条目（priority 0.9，changefreq weekly）。
4. 检查 netlify.toml：`/data/*` 1h 缓存已覆盖 spellbook 路径，确认无需新增。
5. **卡面默认源裁决（§1.1）**：用 itdog.cn / 17ce / 阿里云拨测对
   `https://fastly.jsdelivr.net/gh/ChanningWang2018/hpma-data@spellbook-v1.1.0/spellbook/images/1001.png`
   与同路径 cdn.jsdelivr.net 域名实测各省可用率 → 可用率高则维持 L1 直连为
   默认；不稳则把 `public/data/spellbook/version.json` 的 `imageBase` 改为
   `/cardimg/`（代理为默认），并把结论记回本文档。
6. 响应式与可达性过一遍（768/480 断点、触控目标 ≥40px、对比度）。
7. 全量验收：`npm run test` + `npm run lint` + `npm run build` +
   `npm run preview` 实际打开 /cards 抽查（数据加载、筛选、弹层、占位图、
   `?img=` 覆盖生效）。

---

## 3. 执行顺序与并行

```
T1 ──→ T2 ──→ T3 ──┐
  └───→ T4 ────────┴──→ T5
```

- T1 是所有人的前置（数据契约）。
- T4 只依赖 version.json 的文件格式，与 T2/T3 并行。
- T5 收尾集成 + 验收。

---

## 4. 变更记录

### 2026-10-01 schema 2 适配（spellbook-v2.20261001.0 入库）

上游发布 `spellbook-v2.20261001.0`（schema_version 2，data_version 改为日期制
20261001）。全量结构对比结论：卡 id 集合/数量（141）、类型计数（65/52/24）、
levels 外层形状（等级键 → 条目数组）均不变；破坏点与内容变化：

1. **levels 条目新增可选 `unit` 字段**：`{k, v, pct, unit?}` —— 数值所属主体
   实体（同一张卡可同时给"挪威脊背龙蛋"与孵出的"挪威脊背龙"各一套属性；
   无 unit 或 "增益效果" = 卡自身/增益效果）。适配：`formatLevelRows` 透传
   `unit`，CardDetail 同级内按 unit 分组、组前加小标题（无 unit 的卡自身块
   置顶无标题）。
2. **英文覆盖率补全**：en desc 61→141、en quote 39→141（内容刷新）。
3. 消费端守卫：`spellbookClient.EXPECTED_SCHEMA_VERSION` 1→2；
   `fetch-spellbook.mjs` 同步接受 schema 2。
4. **管道补强**：`fetch-spellbook.mjs` update 现在自动把 netlify.toml 的
   `/cardimg/*` 代理 tag 与 version.json 的 imageBase 同步换（此前是漏项，
   本次实战已验证生效）。
5. 测试改造：真实数据断言（versionInfo/imageUrl）改为从
   `public/data/spellbook/version.json` 派生，此后数据升级零测试改动；
   schema 守卫用例跟随 EXPECTED 常量。108/108 绿。

### 卡面默认源裁决（挂起）

2026-10-01：暂维持 L1 直连（fastly.jsdelivr.net）为默认；大陆拨测待站长执行后裁决
（工具 itdog.cn/17ce，判据见 §1.1）。

### 2026-10-01 schema 3/4 适配（spellbook-v4.20261001.0 入库）

上游同日连发 schema 3（i18n 双语补全：zh/en tags、en stats、levels 行级
k_en/unit_en、en name 补满 141/141）与 schema 4（spellbook-v4.20261001.0）。
schema 4 相对 3 的实质变化与适配：

1. **稀有度枚举改名**：`brilliant`→`mythic`（11 张，zh 名仍"光辉"）、
   `forbidden`→`dark`（4 张，"禁忌"→"深渊"）；等级成员不变，纯改名。
2. 内容仅一处修正：1197 隐身衣→隐形衣；卡 id 集合、类型计数（65/52/24）、
   levels、en 内容全部不变。
3. 消费端适配：`EXPECTED_SCHEMA_VERSION` 3→4（spellbookClient.js +
   fetch-spellbook.mjs）；稀有度 CSS token/类名跟随改名（global.css
   `--rarity-mythic/--rarity-dark`，CardCodex 色条、CardDetail 徽标、
   CardImage 占位卡背），颜色映射不变（mythic 继承银白、dark 继承墨绿）；
   两个 label 集成断言跟随数据（mythic→Mythic、dark→深渊）。筛选下拉等
   稀有度 UI 均由 labels 数据驱动，零改动。
4. 管道：`fetch update` 一次入库 v4（sha256 过，netlify.toml `/cardimg/`
   代理 tag 已同步 spellbook-v4.20261001.0），`--verify` 通过。
