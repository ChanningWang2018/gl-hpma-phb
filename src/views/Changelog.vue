<template>
  <div class="changelog-page">
    <div class="changelog-container">
      <PageHead>
        <h1 class="page-title">
          Changelog <span class="page-title-zh">更新记录</span>
        </h1>
        <template #note>
          Data versions and site changes · 数据版本与站点更新 · updated
          {{ updatedLabel }}
        </template>
      </PageHead>

      <p class="lede">
        Every data release is pinned to a tag and every site change is recorded
        here. The list below is the current state of each dataset, not a full
        history: older releases stay on the source repositories.
      </p>
      <p class="zh-summary" lang="zh">
        每一次数据发布都固定到
        tag，每一次站点改动都记录在此。下列是各数据集的当前版本；历史版本保留在数据源仓库。
      </p>
      <p class="crosslink">
        How the numbers are collected and defined:
        <RouterLink to="/methodology">Methodology 数据说明 →</RouterLink>
      </p>

      <section class="change-section" aria-labelledby="data-versions-heading">
        <h2 id="data-versions-heading">
          Data versions <span class="heading-zh">数据版本</span>
        </h2>

        <ul class="version-list" role="list">
          <li
            v-for="version in dataVersions"
            :key="version.id"
            class="version-item"
          >
            <div class="version-head">
              <h3 class="version-name">
                {{ version.name.en }}
                <span class="version-name-zh" lang="zh">{{
                  version.name.zh
                }}</span>
              </h3>
              <span class="tag-kind">{{ version.tagKind }}</span>
            </div>

            <code class="version-tag">{{ version.tag }}</code>

            <div class="version-meta">
              <time :datetime="version.date">{{
                formatDate(version.date)
              }}</time>
              <a
                :href="version.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                >{{ version.sourceLabel }} ↗</a
              >
            </div>

            <p class="version-note">{{ version.note.en }}</p>
            <p class="version-note version-note-zh" lang="zh">
              {{ version.note.zh }}
            </p>
          </li>
        </ul>

        <p class="method-note">
          Weekly trends has no release tag of its own. It is rebuilt from the
          archive snapshot taken by the crawler, and the tag above is that
          snapshot's git tag (<code>vYYYYMMDD-HHMMSS</code>).
        </p>
        <p class="zh-summary" lang="zh">
          周趋势没有独立发布 tag：它由爬虫抓取的归档快照重新聚合，上表的 tag
          就是该快照的 git tag（格式 <code>vYYYYMMDD-HHMMSS</code>）。
        </p>
      </section>

      <section class="change-section" aria-labelledby="site-changes-heading">
        <h2 id="site-changes-heading">
          Site changes <span class="heading-zh">站点更新</span>
        </h2>

        <ol class="change-list">
          <li
            v-for="change in siteChanges"
            :key="`${change.date}-${change.title.en}`"
            class="change-item"
          >
            <div class="change-head">
              <time class="change-date" :datetime="change.date">{{
                formatDate(change.date)
              }}</time>
              <span v-if="change.refs.length" class="change-refs">
                <a
                  v-for="ref in change.refs"
                  :key="ref"
                  :href="issueUrl(ref)"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ ref }}</a
                >
              </span>
            </div>

            <h3 class="change-title">{{ change.title.en }}</h3>
            <p class="change-body">{{ change.summary.en }}</p>
            <p class="change-body change-body-zh" lang="zh">
              <strong>{{ change.title.zh }}</strong
              >：{{ change.summary.zh }}
            </p>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<script>
import PageHead from '@/components/ui/PageHead.vue';
import changelog from '@/data/changelog.json';
import {
  buildWebPageStructuredData,
  FALLBACK_OG_IMAGE,
  jsonLdScript,
  SITE_ORIGIN,
} from '@/services/structuredData.js';
import { useHead } from '@vueuse/head';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Changelog — the one hand-maintained data file in the repo
// (src/data/changelog.json). Data versions mirror the manifests and
// version.json files under public/data/; site changes mirror the issue log.
// Keeping it as JSON means a data update only needs one small edit here, and
// the page stays static, indexable and free of fetch/loading states.
function formatDate(value) {
  const [year, month, day] = String(value ?? '')
    .split('-')
    .map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return String(value ?? '');
  }
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function issueUrl(ref) {
  const number = String(ref ?? '').replace(/^#/, '');
  return `https://github.com/ChanningWang2018/gl-hpma-phb/issues/${number}`;
}

export default {
  name: 'Changelog',
  components: { PageHead },
  setup() {
    const title = 'HPMA Data Changelog — Versions and Site Changes';
    const description =
      'Current cards, echoes, quiz and weekly-trends data versions, plus a dated log of site features and fixes for my little hpma bits.';
    const pageUrl = `${SITE_ORIGIN}/changelog`;
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
      dataVersions: changelog.dataVersions ?? [],
      formatDate,
      issueUrl,
      siteChanges: changelog.siteChanges ?? [],
      updatedLabel: formatDate(changelog.updated),
    };
  },
};
</script>

<style scoped>
.changelog-page {
  padding: var(--space-5) var(--space-6) var(--space-7);
}

.changelog-container {
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

.crosslink {
  margin-top: var(--space-2);
  font-family: var(--font-type);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--ink-faded);
}

.crosslink a {
  color: var(--oxblood);
}

.change-section {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--rule);
}

.change-section h2 {
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

.version-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--ink);
}

.version-item {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--rule);
}

.version-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.version-name {
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 400;
  line-height: 1.2;
}

.version-name-zh {
  margin-left: 6px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--ink-faded);
}

.tag-kind {
  padding: 1px 5px;
  border: 1px solid var(--rule);
  font-family: var(--font-type);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.version-tag {
  display: inline-block;
  max-width: 100%;
  margin-top: 5px;
  font-family: var(--font-type);
  font-size: 11px;
  line-height: 1.5;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.version-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px var(--space-4);
  margin-top: 4px;
  font-family: var(--font-type);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  color: var(--ink-faded);
}

.version-meta a {
  max-width: 100%;
  color: var(--oxblood);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.version-meta a:hover {
  text-decoration: underline;
}

.version-note {
  max-width: 70ch;
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--ink);
}

.version-note-zh {
  margin-top: 3px;
  font-size: 12px;
  color: var(--ink-faded);
}

.method-note {
  max-width: 70ch;
  margin-top: var(--space-3);
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faded);
}

.method-note code {
  font-family: var(--font-type);
  font-size: 0.92em;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.change-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--ink);
}

.change-item {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--rule);
}

.change-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px var(--space-3);
}

.change-date {
  font-family: var(--font-type);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.change-refs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.change-refs a {
  font-family: var(--font-type);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  color: var(--oxblood);
  text-decoration: none;
}

.change-refs a:hover {
  text-decoration: underline;
}

.change-title {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 400;
  line-height: 1.25;
}

.change-body {
  max-width: 70ch;
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--ink);
}

.change-body-zh {
  margin-top: 5px;
  padding-left: var(--space-3);
  border-left: 2px solid var(--rule);
  font-family: var(--font-sans);
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--ink-faded);
}

.change-body-zh strong {
  font-weight: 600;
  color: var(--ink);
}

@media (max-width: 768px) {
  .changelog-page {
    padding: var(--space-3) var(--space-3) var(--space-5);
  }

  .lede {
    font-size: 17px;
  }
}

@media (max-width: 480px) {
  .changelog-page {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .lede {
    font-size: 16px;
  }

  .version-name {
    font-size: 19px;
  }

  .change-title {
    font-size: 18px;
  }
}
</style>
