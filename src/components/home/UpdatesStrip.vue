<template>
  <div class="updates">
    <span id="updates-label" class="updates-label">Latest</span>
    <ul class="updates-list" role="list" aria-labelledby="updates-label">
      <li v-for="item in items" :key="`${item.date}-${item.label}`">
        <span class="updates-date">{{ item.date }}</span> · {{ item.label }}
      </li>
    </ul>
  </div>
</template>

<script>
// UpdatesStrip — 目录下方的一行更新：纯文本，不做链接，也不写数据源名。
// 期号与期号日期来自共享数据；两个数据版本暂时是静态文案。
export default {
  name: 'UpdatesStrip',
  props: {
    edition: { type: Number, default: null },
    periodLabel: { type: String, default: '' },
  },
  computed: {
    items() {
      const parts = this.periodLabel ? this.periodLabel.split(/[–-]/) : [];
      const end = (parts[parts.length - 1] || '').trim().replace(/ \d{4}$/, '');
      return [
        {
          date: end || '—',
          label: `Issue No. ${this.edition ?? '—'}`,
        },
        { date: '04 Oct', label: 'Spellbook v6' },
        { date: '09 Oct', label: 'Quiz bank v2' },
      ];
    },
  },
};
</script>

<style scoped>
.updates {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 26px;
  margin-top: clamp(42px, 5vw, 62px);
  padding: 14px var(--home-gutter);
  border-top: 1px solid var(--rule);
  /* 下缘那条线由 SiteFooter 的 border-top 画，避免叠成 2px 双线 */
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.6;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.updates-label {
  color: var(--oxblood);
}

.updates-list {
  display: flex;
  flex-wrap: wrap;
  gap: 9px 26px;
  list-style: none;
}

.updates-date {
  color: var(--ink);
}

@media (max-width: 768px) {
  .updates {
    gap: 9px 18px;
  }

  .updates-list {
    gap: 9px 18px;
  }
}
</style>
