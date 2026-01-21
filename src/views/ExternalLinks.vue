<template>
  <div class="external-links-page">
    <div class="page-header">
      <h2>Resources</h2>
      <p>A curated collection of the best resources created by the incredible HPMA community</p>
    </div>

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

export default {
  name: 'ExternalLinks',
  data() {
    return {
      links: []
    };
  },
  mounted() {
    this.links = LinksService.getAllLinks();
  }
};
</script>

<style scoped>
.external-links-page {
  padding: 30px;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h2 {
  font-size: 2em;
  color: #495057;
  margin-bottom: 10px;
}

.page-header p {
  font-size: 1.1em;
  color: #6c757d;
}

.links-container {
  max-width: 800px;
  margin: 0 auto;
}

.link-item {
  background: white;
  border: 2px solid #dee2e6;
  border-radius: 10px;
  padding: 20px 25px;
  margin-bottom: 15px;
  transition: all 0.3s;
}

.link-item:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
  transform: translateX(5px);
}

.link-title {
  display: inline-flex;
  align-items: center;
  font-size: 1.2em;
  font-weight: 600;
  color: #667eea;
  text-decoration: none;
  margin-bottom: 8px;
  transition: color 0.3s;
}

.link-title:hover {
  color: #764ba2;
}

.external-icon {
  margin-left: 8px;
  font-size: 1.1em;
}

.link-description {
  color: #6c757d;
  line-height: 1.6;
  margin: 8px 0 0 0;
}

@media (max-width: 768px) {
  .external-links-page {
    padding: 20px 15px;
  }

  .page-header h2 {
    font-size: 1.6em;
  }

  .page-header p {
    font-size: 1em;
  }

  .link-item {
    padding: 15px 20px;
  }

  .link-title {
    font-size: 1.1em;
  }

  .link-description {
    font-size: 0.95em;
  }
}

@media (max-width: 480px) {
  .external-links-page {
    padding: 15px 12px;
  }

  .page-header {
    margin-bottom: 30px;
  }

  .page-header h2 {
    font-size: 1.4em;
  }

  .page-header p {
    font-size: 0.95em;
  }

  .link-item {
    padding: 12px 15px;
    margin-bottom: 12px;
  }

  .link-title {
    font-size: 1em;
  }

  .link-description {
    font-size: 0.9em;
  }
}
</style>
