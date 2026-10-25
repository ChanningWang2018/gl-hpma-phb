<template>
  <div class="methodology-page">
    <div class="methodology-container">
      <PageHead>
        <h1 class="page-title">
          Methodology <span class="page-title-zh">数据说明</span>
        </h1>
        <template #note>
          Data &amp; definitions — what each figure means and when it refreshes
          · 英文正文 / 中文摘要
        </template>
      </PageHead>

      <p class="lede">
        This almanac is assembled from the weekly echo statistics and two
        published data modules; each release is mirrored in the site's data
        directory and pinned to the tag listed on the
        <RouterLink to="/changelog">changelog</RouterLink>. Nothing in the
        tables is hand-entered.
      </p>
      <p class="zh-summary" lang="zh">
        本站数据由每周回响统计与两个已发布的数据模块组成；每个版本都镜像在站内数据目录，并固定到
        changelog 中列出的 tag。表格中的数字均不做手工录入。
      </p>

      <section class="method-section" aria-labelledby="modules-heading">
        <h2 id="modules-heading">
          Data modules <span class="heading-zh">数据模块</span>
        </h2>

        <ul class="module-list" role="list">
          <li v-for="module in modules" :key="module.id" class="module-item">
            <div class="module-head">
              <h3 class="module-name">{{ module.name }}</h3>
              <a
                class="module-link"
                :href="module.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ module.linkLabel }} ↗
              </a>
            </div>
            <p class="module-body">{{ module.body }}</p>
            <p class="zh-summary" lang="zh">{{ module.zh }}</p>
          </li>
        </ul>

        <p class="method-note">
          Card art and echo icons are hot-linked from the immutable release tag
          on <code>raw.githubusercontent.com</code>; the same-origin
          <code>/cardimg/*</code> and <code>/echoimg/*</code> redirects are the
          fallback for networks that cannot reach GitHub. Artwork stays ©
          NetEase and the rights holders.
        </p>
      </section>

      <section class="method-section" aria-labelledby="fields-heading">
        <h2 id="fields-heading">
          Fields <span class="heading-zh">字段口径</span>
        </h2>

        <p>
          Every echo row is one echo × one bracket × one period. Three values do
          all the work:
        </p>

        <dl class="field-grid">
          <div v-for="field in fields" :key="field.id" class="field-card">
            <dt class="field-term">
              {{ field.term }}
              <code class="field-code">{{ field.field }}</code>
            </dt>
            <dd class="field-body">{{ field.body }}</dd>
          </div>
        </dl>

        <p class="zh-summary" lang="zh">
          每行数据 = 一个回响 × 一个 bracket ×
          一个周期。胜率（winrate）是该周期内使用该回响的胜场占比；选取率在数据集字段中叫
          attendancerate（README 称 attendance
          rate），指该回响在比赛中的出场占比，不是出场次数。Δ
          是同回响、同档位相邻两期的百分点差：首页保留一位小数，上一期缺失按 0
          处理；排行榜显示箭头与绝对值，无可比数据时显示「—」。站点不做插值、补行或加权。
        </p>
      </section>

      <section class="method-section" aria-labelledby="brackets-heading">
        <h2 id="brackets-heading">
          Brackets <span class="heading-zh">四档</span>
        </h2>

        <p>
          The dataset splits the ladder into four brackets at 7,500 rating
          points. The site keeps all four separate; every chart, plate and
          standings table has a bracket switch, and no view averages across
          brackets.
        </p>

        <div class="table-scroll">
          <table class="bracket-table">
            <caption class="visually-hidden">
              The four rating brackets used across the site
            </caption>
            <thead>
              <tr>
                <th scope="col">Bracket</th>
                <th scope="col">Queue</th>
                <th scope="col">Rating</th>
                <th scope="col">Dataset label</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bracket in brackets" :key="bracket.key">
                <th scope="row">{{ bracket.label }}</th>
                <td>{{ bracket.queue }}</td>
                <td>{{ bracket.rating }}</td>
                <td class="dataset-label" lang="zh">
                  {{ bracket.datasetLabel }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="zh-summary" lang="zh">
          数据集按 7,500 分把匹配分成四档：1v1 低分（低于 7500）、1v1 高分（7500
          及以上）、2v2 低分、2v2 高分。站内四档始终分开呈现，不做跨档平均。
        </p>
      </section>

      <section class="method-section" aria-labelledby="cadence-heading">
        <h2 id="cadence-heading">
          Update cadence <span class="heading-zh">更新节奏</span>
        </h2>

        <p>
          Scheduled workflows keep the data current; the deploy is triggered by
          the resulting commit. Times below are UTC.
        </p>

        <div class="table-scroll">
          <table class="cadence-table">
            <caption class="visually-hidden">
              Data refresh schedule
            </caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Refresh</th>
                <th scope="col">Mechanism</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in cadence" :key="row.id">
                <th scope="row">{{ row.dataset }}</th>
                <td>{{ row.when }}</td>
                <td>{{ row.how }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="zh-summary" lang="zh">
          回响统计每日 02:30 UTC 归档，周期随数据仓换周更新；卡牌与回响每周一
          03:00 UTC 同步；题库每周一 03:30 UTC 同步；数据提交后 Netlify
          自动执行预渲染构建并部署。定时任务可能被 GitHub
          延迟，延迟只会推后数据，不改变口径。
        </p>
      </section>

      <section class="method-section" aria-labelledby="disclaimer-heading">
        <h2 id="disclaimer-heading">
          Disclaimer <span class="heading-zh">免责声明</span>
        </h2>

        <p>
          An unofficial, non-commercial fan project. Not affiliated with or
          endorsed by NetEase or Warner Bros. Game data, card art, echo icons
          and quiz text remain © their rights holders and are shown for personal
          research and reference only.
        </p>
        <p class="disclaimer-caution">
          Figures describe the data sample, not the whole player base. A
          one-week move can be noise; treat small differences between echoes
          cautiously rather than as proof of a stronger or weaker card.
        </p>
        <p class="zh-summary" lang="zh">
          本站为非官方、非商业的同人项目，与网易及华纳兄弟无隶属或背书关系。游戏数据、卡面、回响图标与题目文案版权归各自权利人所有，仅供个人研究参考。数字反映的是数据样本而非全体玩家；单周波动可能只是噪声，小幅差距不宜当作强弱结论。
        </p>

        <p class="corrections">
          Spotted a wrong number or an out-of-date tag?
          <a
            href="https://github.com/ChanningWang2018/gl-hpma-phb/issues"
            target="_blank"
            rel="noopener noreferrer"
            >Open an issue on GitHub ↗</a
          >
        </p>
      </section>
    </div>
  </div>
</template>

<script>
import PageHead from '@/components/ui/PageHead.vue';
import {
  buildWebPageStructuredData,
  FALLBACK_OG_IMAGE,
  jsonLdScript,
  SITE_ORIGIN,
} from '@/services/structuredData.js';
import { useHead } from '@vueuse/head';

const MODULES = [
  {
    id: 'echoes',
    name: '163hot / 网易大神',
    url: 'https://www.163hot.net/hp/phb/getData',
    linkLabel: 'www.163hot.net/hp/phb/getData',
    body: 'The weekly echo table — win rate and pick rate for every echo and bracket — is archived daily as raw snapshots in the repository archive/ (not deployed) and rebuilt into the aggregated trends.json the site actually reads. Each snapshot carries its own period label; that label becomes the data week.',
    zh: '周胜率 / 选取率数据每日归档为仓库 archive/ 下的原始快照（不部署），再聚合成站点读取的 trends.json；每个快照自带周期标签，即站内的「期」。',
  },
  {
    id: 'spellbook',
    name: 'hpma-bits/hpma-spellbook',
    url: 'https://github.com/hpma-bits/hpma-spellbook',
    linkLabel: 'github.com/hpma-bits/hpma-spellbook',
    body: "Cards and echoes are published as two independent release modules in hpma-bits/hpma-spellbook: cards (cards-v*) for cost, type, rarity, every level and the bilingual text, and echoes (echoes-v*) for the echo list, rarity variants and affixes. The site pins each release in the module's version.json, verifies the downloaded files against the release checksums, and refreshes both modules weekly.",
    zh: '卡牌与回响以 hpma-spellbook 数据仓的两个独立模块发布：cards-v*（费用、类型、品质、全部等级与中英文文案）与 echoes-v*（回响列表、品质变体与词条）。站点在各自 version.json 中固定版本，按发布 checksums 校验，并每周同步。',
  },
  {
    id: 'quiz',
    name: 'hpma-bits/hpma-quizbank',
    url: 'https://github.com/hpma-bits/hpma-quizbank',
    linkLabel: 'github.com/hpma-bits/hpma-quizbank',
    body: 'The Magic Quiz bank is published by hpma-quizbank as quiz-v* releases. The dataset keeps the correct answer in the first option; the site shuffles options on display and always follows the is_correct flag, so a reshuffled question cannot drift from its answer.',
    zh: '魔法测验题库由 hpma-quizbank 以 quiz-v* 发布。数据集中正确答案固定于第一个选项；站内展示时重新洗牌，并始终以 is_correct 为准，避免洗牌后答案错位。',
  },
];

const FIELDS = [
  {
    id: 'winrate',
    term: 'Win rate',
    field: 'winrate',
    body: 'The share of matches won with the echo in a given period, exactly as reported in the dataset. The site prints one decimal place and does not re-weight by bracket size or sample count.',
  },
  {
    id: 'pickrate',
    term: 'Pick rate',
    field: 'attendancerate',
    body: 'The share of matches the echo was used in. The dataset field and the README call it attendance rate; the charts and tables label the same number pick rate. It is a usage share, not a raw number of selections.',
  },
  {
    id: 'delta',
    term: 'Delta (Δ)',
    field: 'win(t) − win(t−1)',
    body: 'The week-over-week move for the same echo in the same bracket, in percentage points. The front page rounds it to one decimal and treats a missing previous row as 0; the standings table prints an arrow and the absolute move, or — when there is nothing to compare.',
  },
];

const BRACKETS = [
  {
    key: '1v1-low',
    label: '1v1 Low',
    queue: '1v1',
    rating: 'Below 7,500',
    datasetLabel: '1v1:7500分以下',
  },
  {
    key: '1v1-high',
    label: '1v1 High',
    queue: '1v1',
    rating: '7,500 and above',
    datasetLabel: '1v1:7500分以上',
  },
  {
    key: '2v2-low',
    label: '2v2 Low',
    queue: '2v2',
    rating: 'Below 7,500',
    datasetLabel: '2v2:7500分以下',
  },
  {
    key: '2v2-high',
    label: '2v2 High',
    queue: '2v2',
    rating: '7,500 and above',
    datasetLabel: '2v2:7500分以上',
  },
];

const CADENCE = [
  {
    id: 'echoes',
    dataset: 'Echo statistics',
    when: 'Daily archive · 02:30 UTC',
    how: 'archive workflow; raw snapshot → trends.json',
  },
  {
    id: 'spellbook',
    dataset: 'Cards & echoes',
    when: 'Mondays · 03:00 UTC',
    how: 'Spellbook Data Update workflow',
  },
  {
    id: 'quiz',
    dataset: 'Quiz',
    when: 'Mondays · 03:30 UTC',
    how: 'Quiz Data Update workflow',
  },
  {
    id: 'site',
    dataset: 'Site build',
    when: 'On every push to main',
    how: 'Netlify runs the prerender build',
  },
];

// Methodology — a plain-language account of the data modules and field
// definitions. It is static on purpose: the page explains definitions, which
// change far less often than the values, and it prerenders as the same
// bilingual text for every search engine.
export default {
  name: 'Methodology',
  components: { PageHead },
  setup() {
    const title = 'HPMA Methodology — Data & Definitions';
    const description =
      'How my little hpma bits versions and verifies its HPMA data: the weekly echo statistics, the spellbook cards and echoes, the quiz bank, the four rating brackets and the update cadence.';
    const pageUrl = `${SITE_ORIGIN}/methodology`;
    const ogImage = `${SITE_ORIGIN}${FALLBACK_OG_IMAGE}`;

    useHead({
      title,
      meta: [
        { name: 'description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: pageUrl },
        { property: 'og:image', content: ogImage },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: ogImage },
      ],
      link: [{ rel: 'canonical', href: pageUrl }],
      script: [
        jsonLdScript(
          buildWebPageStructuredData({
            name: title,
            description,
            url: pageUrl,
          }),
        ),
      ],
    });

    return {
      brackets: BRACKETS,
      cadence: CADENCE,
      fields: FIELDS,
      modules: MODULES,
    };
  },
};
</script>

<style scoped>
.methodology-page {
  padding: var(--space-5) var(--space-6) var(--space-7);
}

.methodology-container {
  max-width: 860px;
  margin: 0 auto;
}

.lede {
  max-width: 70ch;
  font-family: var(--font-serif);
  font-size: 19px;
  line-height: 1.6;
  color: var(--ink);
}

.zh-summary {
  max-width: 70ch;
  margin-top: var(--space-2);
  padding-left: var(--space-3);
  border-left: 2px solid var(--rule);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.8;
  color: var(--ink-faded);
}

.method-section {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--rule);
}

.method-section h2 {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px var(--space-2);
  margin-bottom: var(--space-3);
  font-size: clamp(22px, 3vw, 27px);
  line-height: 1.2;
}

.heading-zh {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.18em;
  color: var(--ink-faded);
}

.method-section > p,
.module-body,
.field-body {
  max-width: 70ch;
  font-size: var(--type-body);
  line-height: 1.75;
  color: var(--ink);
}

.method-section p + p {
  margin-top: var(--space-2);
}

.module-list {
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--ink);
}

.module-item {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--rule);
}

.module-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 2px var(--space-3);
  margin-bottom: var(--space-2);
}

.module-name {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 400;
  line-height: 1.2;
}

.module-link {
  max-width: 100%;
  font-family: var(--font-type);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  line-height: 1.5;
  color: var(--oxblood);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.module-link:hover {
  text-decoration: underline;
}

.method-note {
  margin-top: var(--space-3);
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faded);
}

.method-note code,
.field-code {
  font-family: var(--font-type);
  font-size: 0.92em;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0 var(--space-5);
  margin-top: var(--space-3);
  border-top: 1px solid var(--ink);
}

.field-card {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--rule);
}

.field-term {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px var(--space-2);
  margin-bottom: 6px;
  font-family: var(--font-serif);
  font-size: 19px;
  line-height: 1.2;
}

.field-code {
  font-size: 9.5px;
  color: var(--ink-faded);
}

.field-body {
  margin: 0;
  font-size: 13px;
}

.table-scroll {
  max-width: 100%;
  margin-top: var(--space-3);
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 1.5;
}

th,
td {
  padding: 8px 10px 8px 0;
  border-bottom: 1px solid var(--rule);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

thead th {
  padding-top: 0;
  border-bottom: 1px solid var(--ink);
  font-family: var(--font-type);
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

tbody th {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
}

.dataset-label {
  color: var(--ink-faded);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.disclaimer-caution {
  margin-top: var(--space-2);
  font-style: italic;
  color: var(--ink-faded);
}

.corrections {
  margin-top: var(--space-3);
  font-family: var(--font-type);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--ink-faded);
}

.corrections a {
  color: var(--oxblood);
}

@media (max-width: 768px) {
  .methodology-page {
    padding: var(--space-3) var(--space-3) var(--space-5);
  }

  .lede {
    font-size: 17px;
  }

  .field-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  table {
    font-size: 12px;
  }

  th,
  td {
    padding: 6px 8px 6px 0;
  }
}

@media (max-width: 480px) {
  .methodology-page {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .lede {
    font-size: 16px;
  }

  .module-name {
    font-size: 18px;
  }

  .field-term {
    font-size: 18px;
  }

  th,
  td {
    padding: 6px 6px 6px 0;
  }
}
</style>
