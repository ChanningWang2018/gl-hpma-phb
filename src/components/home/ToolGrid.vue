<template>
  <ul class="tools" role="list">
    <li v-for="tool in tools" :key="tool.no" class="tool-item">
      <RouterLink class="tool" :to="tool.to">
        <span class="tool-top">
          <span class="tool-no">{{ tool.no }}</span>
          <ToolIcon class="tool-icon" :name="tool.icon" />
        </span>
        <h3>{{ tool.title }}</h3>
        <p>{{ tool.desc }}</p>
        <span class="tool-meta">
          <span>{{ tool.count }}</span>
          <span class="tool-arrow" aria-hidden="true">→</span>
        </span>
      </RouterLink>
    </li>
  </ul>
</template>

<script>
import ToolIcon from '@/components/home/ToolIcon.vue';
import { RouterLink } from 'vue-router';

// ToolGrid — 目录的五栏（01–05）：编号 / 28px 线图标 / 标题 / 一行说明 /
// 计数 + 箭头。整卡是一个链接，顶栏细线在悬停时转金、图标转赭红、箭头
// 右移。≤980 三栏，≤768 两栏且第 5 栏横铺，≤480 单栏；除期号外计数是
// 静态文案（首页不加载 cards.json / quiz.json）。
export default {
  name: 'ToolGrid',
  components: { RouterLink, ToolIcon },
  props: {
    // Issue count from the shared chart store; null while loading.
    edition: { type: Number, default: null },
  },
  computed: {
    tools() {
      const issueCount = this.edition ? `${this.edition} issues` : '— issues';
      return [
        {
          no: '01',
          icon: 'analytics',
          title: 'Echo analytics',
          desc: 'Rankings, trends and every bracket.',
          count: issueCount,
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
          desc: 'Best haul from a bag of duplicates.',
          count: 'LP solver',
          to: '/sales-optimizer',
        },
        {
          no: '04',
          icon: 'quiz',
          title: 'Magic quiz',
          desc: "1,847 questions from the game's banks.",
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
.tools {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: clamp(16px, 2.2vw, 30px);
  list-style: none;
}

.tool-item {
  min-width: 0;
}

.tool {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 198px;
  padding: 15px 2px 0;
  border-top: 1px solid var(--rule);
  color: var(--ink);
  text-decoration: none;
  transition:
    border-color 0.25s,
    background 0.25s;
}

.tool:hover {
  border-top-color: var(--gold);
  background: linear-gradient(
    180deg,
    rgba(var(--gold-rgb), 0.07),
    transparent 60%
  );
}

.tool:focus-visible {
  outline: 2px solid var(--gold-ink);
  outline-offset: 3px;
}

.tool-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.tool-no {
  padding-top: 4px;
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.12em;
  color: var(--gold-ink);
}

.tool-icon {
  color: var(--ink-faded);
  transition:
    color 0.25s,
    transform 0.25s;
}

.tool:hover .tool-icon {
  color: var(--oxblood);
  transform: translateY(-2px);
}

.tool h3 {
  margin-top: 14px;
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--ink);
}

.tool p {
  max-width: 23ch;
  margin-top: 5px;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--ink-faded);
}

.tool-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
  font-family: var(--font-type);
  font-size: 8px;
  line-height: 1.5;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.tool-arrow {
  font-size: 15px;
  line-height: 1;
  color: var(--oxblood);
  transition: transform 0.2s;
}

.tool:hover .tool-arrow {
  transform: translateX(4px);
}

@media (max-width: 980px) {
  .tools {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .tools {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 18px;
  }

  .tool {
    min-height: 170px;
  }

  .tool p {
    font-size: 11px;
  }

  /* 第 5 栏横铺，避免落单 */
  .tool-item:last-child {
    grid-column: 1 / -1;
  }

  .tool-item:last-child .tool {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 14px;
    min-height: 0;
  }

  .tool-item:last-child .tool-top {
    display: block;
    grid-row: 1 / span 2;
  }

  .tool-item:last-child .tool-no {
    display: none;
  }

  .tool-item:last-child h3 {
    margin-top: 0;
  }

  .tool-item:last-child p {
    max-width: none;
    margin-top: 2px;
  }

  .tool-item:last-child .tool-meta {
    grid-column: 3;
    grid-row: 1 / span 2;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    margin-top: 0;
    padding-top: 0;
  }
}

@media (max-width: 480px) {
  .tools {
    grid-template-columns: minmax(0, 1fr);
  }

  .tool,
  .tool-item .tool {
    min-height: 0;
  }

  .tool p {
    max-width: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool,
  .tool-icon,
  .tool-arrow {
    transition: none;
  }
}
</style>
