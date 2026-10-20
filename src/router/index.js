import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    component: () => import('@/views/Home.vue'),
    name: 'home',
  },
  {
    path: '/analytics',
    component: () => import('@/views/Analytics.vue'),
    name: 'analytics',
  },
  {
    path: '/sales-optimizer',
    component: () => import('@/views/SalesOptimizer.vue'),
    name: 'sales-optimizer',
  },
  {
    path: '/cards',
    component: () => import('@/views/CardCodex.vue'),
    name: 'cards',
  },
  {
    path: '/quiz',
    component: () => import('@/views/Quiz.vue'),
    name: 'quiz',
  },
  {
    path: '/resources',
    component: () => import('@/views/ExternalLinks.vue'),
    name: 'resources',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
