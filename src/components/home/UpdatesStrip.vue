<template>
  <div class="updates">
    <span id="updates-label" class="updates-label">Latest</span>
    <ul class="updates-list" role="list" aria-labelledby="updates-label">
      <li v-for="item in items" :key="`${item.date}-${item.label}`">
        <span class="updates-date">{{ item.date }}</span>
        <span class="updates-what">{{ item.label }}</span>
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
  gap: 12px 30px;
  margin-top: clamp(40px, 5vw, 58px);
  padding-top: 13px;
  border-top: 1px solid var(--ink);
  font-family: var(--font-type);
  line-height: 1.6;
}

.updates-label {
  font-size: 8.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--oxblood);
}

.updates-list {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 8px 34px;
  list-style: none;
}

.updates-list li {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.updates-date {
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.2;
  color: var(--ink);
  white-space: nowrap;
}

.updates-what {
  font-size: 8px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

@media (max-width: 768px) {
  .updates {
    gap: 8px 18px;
  }

  .updates-list {
    gap: 6px 20px;
  }
}
</style>
