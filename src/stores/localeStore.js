// Locale store — the single site-wide UI language (zh | en), shared by
// /cards and /quiz (locale refactor T1). Owns the only persisted locale key
// ('hpma-locale'); cardStore/quizStore delegate to this store via getters so
// switching language on one page takes effect site-wide.
import { defineStore } from 'pinia';
import {
  normalizeLocale,
  persistLocale,
  resolveInitialLocale,
} from '@/services/siteLocale.js';

export const useLocaleStore = defineStore('locale', {
  state: () => ({
    // 全站 UI 语言：初次进入按 localStorage 迁移链 > 浏览器语言解析，
    // 之后由 setLocale 更新并持久化到 'hpma-locale'（旧键只读迁移不回写）
    locale: resolveInitialLocale(),
  }),

  actions: {
    // 切换全站 UI 语言并持久化（非法值忽略，保持当前语言）
    setLocale(value) {
      const next = normalizeLocale(value);
      if (!next) return;
      this.locale = next;
      persistLocale(next);
    },
  },
});
