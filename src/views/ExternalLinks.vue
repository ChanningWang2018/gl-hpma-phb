<template>
  <div class="external-links-page">
    <div class="links-container">
      <div v-for="link in links" :key="link.id" class="link-item">
        <div class="link-content">
          <a
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="link-title"
          >
            {{ link.title }}
            <span class="external-icon">↗</span>
          </a>
          <p class="link-description">{{ link.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { LinksService } from '@/services/linksService.js';
import { useHead } from '@vueuse/head';

export default {
  name: 'ExternalLinks',
  setup() {
    useHead({
      title: 'HPMA Resources - Created by HPMA community',
      meta: [
        {
          name: 'description',
          content:
            'Curated HPMA community resources including guides, calculators, and tools for Harry Potter: Magic Awakened players.',
        },
      ],
    });
  },
  data() {
    return {
      links: [],
    };
  },
  mounted() {
    this.links = LinksService.getAllLinks();
  },
};
</script>

<style scoped>
.external-links-page {
  padding: 26px 30px 34px;
}

.links-container {
  max-width: 800px;
  margin: 0 auto;
  border-top: 3px double var(--ink);
}

/* Classifieds: printed notices separated by hairlines, no boxes */
.link-item {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--rule);
  border-radius: 0;
  padding: 18px 6px;
  margin-bottom: 0;
  transition: background 0.25s;
}

.link-item:hover {
  background: rgba(var(--accent-rgb), 0.05);
  box-shadow: none;
  transform: none;
}

.link-title {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-serif);
  font-size: 1.3em;
  font-weight: 400;
  color: var(--oxblood);
  text-decoration: none;
  margin-bottom: 6px;
  transition: color 0.25s;
}

.link-title:hover {
  color: var(--teal-ink);
  text-decoration: underline;
}

.external-icon {
  margin-left: 8px;
  font-size: 0.9em;
}

.link-description {
  color: var(--ink-faded);
  line-height: 1.6;
  margin: 4px 0 0 0;
  font-size: 0.95em;
}

@media (max-width: 768px) {
  .external-links-page {
    padding: 20px 15px;
  }

  .link-item {
    padding: 15px 4px;
  }

  .link-title {
    font-size: 1.15em;
  }
}

@media (max-width: 480px) {
  .external-links-page {
    padding: 15px 12px;
  }

  .link-item {
    padding: 12px 2px;
  }

  .link-title {
    font-size: 1.05em;
  }

  .link-description {
    font-size: 0.9em;
  }
}
</style>
