import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { 
    path: '/', 
    component: () => import('@/views/Analytics.vue'),
    name: 'analytics' 
  },
  { 
    path: '/sales-optimizer', 
    component: () => import('@/views/SalesOptimizer.vue'),
    name: 'sales-optimizer' 
  },
  { 
    path: '/resources', 
    component: () => import('@/views/ExternalLinks.vue'),
    name: 'resources' 
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
