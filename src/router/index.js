import { createRouter, createWebHistory } from 'vue-router';
import Analytics from '@/views/Analytics.vue';
import SalesOptimizer from '@/views/SalesOptimizer.vue';
import ExternalLinks from '@/views/ExternalLinks.vue';

const routes = [
  { path: '/', component: Analytics, name: 'analytics' },
  { path: '/sales-optimizer', component: SalesOptimizer, name: 'sales-optimizer' },
  { path: '/resources', component: ExternalLinks, name: 'resources' }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
