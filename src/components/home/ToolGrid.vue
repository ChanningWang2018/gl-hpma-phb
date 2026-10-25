<template>
  <ol class="index" role="list">
    <li v-for="tool in tools" :key="tool.no" class="index-item">
      <RouterLink class="index-row" :to="tool.to">
        <span class="index-no">{{ tool.no }}</span>
        <ToolIcon class="index-icon" :name="tool.icon" />
        <h3 class="index-title">{{ tool.title }}</h3>
        <span class="index-desc">{{ tool.desc }}</span>
        <span class="index-count">{{ tool.count }}</span>
        <span class="index-arrow" aria-hidden="true">→</span>
      </RouterLink>
    </li>
  </ol>
</template>

<script>
import ToolIcon from '@/components/home/ToolIcon.vue';
import { RouterLink } from 'vue-router';

// ToolGrid — the paper's contents table. Five numbered entries, one rule per
// row, title and one-line description on a single reading line, the archive
// size closing on the right. Hover moves the arrow and warms the row; the whole
// row is the link. Counts other than the week count are static copy, because
// the front page never loads cards.json or quiz.json.
export default {
  name: 'ToolGrid',
  components: { RouterLink, ToolIcon },
  props: {
    // Week count from the shared chart store; null while loading.
    edition: { type: Number, default: null },
  },
  computed: {
    tools() {
      const weekCount = this.edition ? `${this.edition} weeks` : '— weeks';
      return [
        {
          no: '01',
          icon: 'analytics',
          title: 'Echo analytics',
          desc: 'Standings, trends and every bracket.',
          count: weekCount,
          to: '/analytics',
        },
        {
          no: '02',
          icon: 'cards',
          title: 'Card codex',
          desc: '141 cards, every level, both languages.',
          count: '141 cards',
          to: '/cards',
        },
        {
          no: '03',
          icon: 'optimizer',
          title: 'Sales optimizer',
          desc: 'The best haul from a bag of duplicates.',
          count: 'LP solver',
          to: '/sales-optimizer',
        },
        {
          no: '04',
          icon: 'quiz',
          title: 'Magic quiz',
          desc: 'A 1,847-question class quiz bank.',
          count: '2 banks',
          to: '/quiz',
        },
        {
          no: '05',
          icon: 'library',
          title: 'The library',
          desc: 'Seven outside tools worth keeping.',
          count: '7 links',
          to: '/resources',
        },
      ];
    },
  },
};
</script>

<style scoped>
.index {
  list-style: none;
  border-top: 1px solid var(--ink);
}

.index-item {
  min-width: 0;
}

.index-row {
  display: grid;
  grid-template-columns:
    46px 30px minmax(150px, 0.9fr) minmax(0, 1.25fr)
    108px 20px;
  align-items: center;
  gap: clamp(10px, 1.5vw, 22px);
  padding: 18px 10px 18px 4px;
  border-bottom: 1px solid var(--rule);
  color: var(--ink);
  text-decoration: none;
  transition:
    background 0.22s,
    border-color 0.22s;
}

.index-row:hover {
  border-bottom-color: var(--ink);
  background: linear-gradient(
    90deg,
    rgba(var(--gold-rgb), 0.08),
    transparent 72%
  );
}

.index-row:focus-visible {
  outline: 2px solid var(--gold-ink);
  outline-offset: 2px;
}

.index-no {
  font-family: var(--font-type);
  font-size: 9px;
  line-height: 1.5;
  letter-spacing: 0.16em;
  color: var(--gold-ink);
}

.index-icon {
  color: var(--ink-faded);
  transition:
    color 0.22s,
    transform 0.22s;
}

.index-row:hover .index-icon {
  color: var(--oxblood);
  transform: translateY(-1px);
}

.index-title {
  font-family: var(--font-serif);
  font-size: clamp(21px, 1.85vw, 25px);
  line-height: 1.15;
  color: var(--ink);
}

.index-desc {
  max-width: 52ch;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink-faded);
  text-wrap: pretty;
}

.index-count {
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faded);
  text-align: right;
  white-space: nowrap;
}

.index-arrow {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1;
  color: var(--oxblood);
  text-align: right;
  transition: transform 0.22s;
}

.index-row:hover .index-arrow {
  transform: translateX(4px);
}

@media (max-width: 980px) {
  .index-row {
    grid-template-columns:
      40px 26px minmax(130px, 0.9fr) minmax(0, 1.2fr)
      92px 18px;
    gap: 12px;
  }

  .index-desc {
    font-size: 12px;
  }
}

@media (max-width: 768px) {
  .index-row {
    grid-template-columns: 26px 24px minmax(0, 1fr) 18px;
    grid-template-areas:
      'no icon title arrow'
      'no icon desc desc'
      'no icon count count';
    align-items: start;
    gap: 3px 10px;
    padding: 15px 4px 16px 0;
  }

  .index-no {
    grid-area: no;
    padding-top: 6px;
  }

  .index-icon {
    grid-area: icon;
    padding-top: 2px;
  }

  .index-title {
    grid-area: title;
    font-size: 21px;
  }

  .index-desc {
    grid-area: desc;
    max-width: none;
    font-size: 12px;
  }

  .index-count {
    grid-area: count;
    text-align: left;
  }

  .index-arrow {
    grid-area: arrow;
    padding-top: 4px;
  }
}

@media (max-width: 480px) {
  .index-row {
    grid-template-columns: 22px 20px minmax(0, 1fr) 16px;
    gap: 2px 8px;
  }

  .index-title {
    font-size: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .index-row,
  .index-icon,
  .index-arrow {
    transition: none;
  }
}
</style>
