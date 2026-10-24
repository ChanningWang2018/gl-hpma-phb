<template>
  <div class="methodology-page">
    <div class="methodology-container">
      <PageHead>
        <h1 class="page-title">
          Methodology <span class="page-title-zh">数据说明</span>
        </h1>
        <template #note>
          Where every number comes from, what it means, and when it refreshes ·
          英文正文 / 中文摘要
        </template>
      </PageHead>

      <p class="lede">
        This almanac is assembled from the daily crawl of the weekly echo table
        and two published data projects. Nothing in the tables is hand-entered:
        every figure traces back to one of the sources below, and every data
        release is pinned to the tag listed on the
        <RouterLink to="/changelog">changelog</RouterLink>.
      </p>
      <p class="zh-summary" lang="zh">
        本站数据来自每周回响统计的每日采集，以及两个已发布的数据项目；表格中的数字均不做手工录入，每一项都能追溯到下列来源，每个数据版本都固定到
        changelog 中列出的 tag。
      </p>

      <section class="method-section" aria-labelledby="sources-heading">
        <h2 id="sources-heading">
          Sources <span class="heading-zh">数据源</span>
        </h2>

        <ul class="source-list" role="list">
          <li v-for="source in sources" :key="source.id" class="source-item">
            <div class="source-head">
              <h3 class="source-name">{{ source.name }}</h3>
              <a
                class="source-link"
                :href="source.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ source.linkLabel }} ↗
              </a>
            </div>
            <p class="source-body">{{ source.body }}</p>
            <p class="zh-summary" lang="zh">{{ source.zh }}</p>
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
          一个周期。胜率（winrate）是该周期内使用该回响的胜场占比；选取率在源字段中叫
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
          The source splits the ladder into four brackets at 7,500 rating
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
                <th scope="col">Source label</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bracket in brackets" :key="bracket.key">
                <th scope="row">{{ bracket.label }}</th>
                <td>{{ bracket.queue }}</td>
                <td>{{ bracket.rating }}</td>
                <td class="source-label" lang="zh">{{ bracket.source }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="zh-summary" lang="zh">
          源数据按 7,500 分把匹配分成四档：1v1 低分（低于 7500）、1v1 高分（7500
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
          回响统计每日 02:30 UTC 抓取，周期随源站换周更新；卡牌与回响每周一
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
          Figures describe the source's own sample, not the whole player base. A
          one-week move can be noise; treat small differences between echoes
          cautiously rather than as proof of a stronger or weaker card.
        </p>
        <p class="zh-summary" lang="zh">
          本站为非官方、非商业的同人项目，与网易及华纳兄弟无隶属或背书关系。游戏数据、卡面、回响图标与题目文案版权归各自权利人所有，仅供个人研究参考。数字反映的是数据源样本而非全体玩家；单周波动可能只是噪声，小幅差距不宜当作强弱结论。
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

const SOURCES = [
  {
    id: 'echoes',
    name: '163hot / 网易大神',
    url: 'https://www.163hot.net/hp/phb/getData',
    linkLabel: 'www.163hot.net/hp/phb/getData',
    body: "The weekly echo table — win rate and pick rate for every echo and bracket — is crawled from 163hot's public HPMA statistics endpoint. A GitHub Actions job requests it once a day at 02:30 UTC, stores the raw JSON in the repository archive (not deployed) and rebuilds the aggregated trends.json the site actually reads. Each response carries its own period label; that label becomes the data week.",
    zh: '周胜率 / 选取率来自 163hot 的 HPMA 公开数据接口。GitHub Actions 每天 02:30 UTC 抓取一次，原始 JSON 存入仓库 archive/（不部署），再聚合成站点读取的 trends.json；每个响应自带周期标签，即站内的「期」。',
  },
  {
    id: 'spellbook',
    name: 'hpma-bits/hpma-spellbook',
    url: 'https://github.com/hpma-bits/hpma-spellbook',
    linkLabel: 'github.com/hpma-bits/hpma-spellbook',
    body: "Cards and echoes are extracted from the game client and published as two independent release modules: cards (cards-v*) for cost, type, rarity, every level and the bilingual text, and echoes (echoes-v*) for the echo list, rarity variants and affixes. The site pins each release in the module's version.json, audits the downloaded files against the release checksums, and refreshes both modules weekly.",
    zh: '卡牌与回响由 hpma-spellbook 从游戏客户端提取，按两个独立模块发布：cards-v*（费用、类型、品质、全部等级与中英文文案）与 echoes-v*（回响列表、品质变体与词条）。站点在各自 version.json 中固定版本，按发布 checksums 校验，并每周同步。',
  },
  {
    id: 'quiz',
    name: 'hpma-bits/hpma-quizbank',
    url: 'https://github.com/hpma-bits/hpma-quizbank',
    linkLabel: 'github.com/hpma-bits/hpma-quizbank',
    body: "The Magic Quiz bank is published by hpma-quizbank from the game's History of Magic and Muggle Studies question tables as quiz-v* releases. The source keeps the correct answer in the first option; the site shuffles options on display and always follows the is_correct flag, so a reshuffled question cannot drift from its answer.",
    zh: '魔法测验题库由 hpma-quizbank 从游戏「魔法史 / 麻瓜研究」题目表导出，以 quiz-v* 发布。源表把正确答案放在第一个选项；站内展示时重新洗牌，并始终以 is_correct 为准，避免洗牌后答案错位。',
  },
];

const FIELDS = [
  {
    id: 'winrate',
    term: 'Win rate',
    field: 'winrate',
    body: 'The share of matches won with the echo in a given period, exactly as reported by the source. The site prints one decimal place and does not re-weight by bracket size or sample count.',
  },
  {
    id: 'pickrate',
    term: 'Pick rate',
    field: 'attendancerate',
    body: 'The share of matches the echo was used in. The source field and the README call it attendance rate; the charts and tables label the same number pick rate. It is a usage share, not a raw number of selections.',
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
    source: '1v1:7500分以下',
  },
  {
    key: '1v1-high',
    label: '1v1 High',
    queue: '1v1',
    rating: '7,500 and above',
    source: '1v1:7500分以上',
  },
  {
    key: '2v2-low',
    label: '2v2 Low',
    queue: '2v2',
    rating: 'Below 7,500',
    source: '2v2:7500分以下',
  },
  {
    key: '2v2-high',
    label: '2v2 High',
    queue: '2v2',
    rating: '7,500 and above',
    source: '2v2:7500分以上',
  },
];

const CADENCE = [
  {
    id: 'echoes',
    dataset: 'Echo statistics',
    when: 'Daily crawl · 02:30 UTC',
    how: 'api_crawler workflow; raw snapshot → trends.json',
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

// Methodology — a plain-language account of the data pipeline. It is static
// on purpose: the page explains definitions, which change far less often than
// the values, and it prerenders as the same bilingual text for every crawler.
export default {
  name: 'Methodology',
  components: { PageHead },
  setup() {
    const title = 'HPMA Methodology — Where the Numbers Come From';
    const description =
      'How my little hpma bits collects and defines its HPMA data: 163hot echo statistics, hpma-bits/hpma-spellbook cards and echoes, hpma-quizbank questions, the four rating brackets and the update cadence.';
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
      sources: SOURCES,
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
.source-body,
.field-body {
  max-width: 70ch;
  font-size: var(--type-body);
  line-height: 1.75;
  color: var(--ink);
}

.method-section p + p {
  margin-top: var(--space-2);
}

.source-list {
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--ink);
}

.source-item {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--rule);
}

.source-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 2px var(--space-3);
  margin-bottom: var(--space-2);
}

.source-name {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 400;
  line-height: 1.2;
}

.source-link {
  max-width: 100%;
  font-family: var(--font-type);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  line-height: 1.5;
  color: var(--oxblood);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.source-link:hover {
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

.source-label {
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

  .source-name {
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
