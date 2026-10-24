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
    path: '/cards/:id',
    component: () => import('@/views/CardDetailPage.vue'),
    name: 'card-detail',
    props: true,
  },
  {
    path: '/echoes',
    component: () => import('@/views/EchoIndex.vue'),
    name: 'echoes',
  },
  {
    path: '/echoes/:id',
    component: () => import('@/views/EchoDetail.vue'),
    name: 'echo-detail',
    props: true,
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
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 };
  },
});

export default router;
