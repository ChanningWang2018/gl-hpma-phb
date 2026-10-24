<template>
  <button
    ref="trigger"
    type="button"
    class="search-trigger"
    aria-label="Search cards, echoes and questions"
    aria-haspopup="dialog"
    aria-keyshortcuts="/ Control+K Meta+K"
    :aria-expanded="open ? 'true' : 'false'"
    title="Search ( / )"
    @click="openOverlay"
  >
    <svg
      class="search-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.6 12.6 17 17" />
    </svg>
    <span class="search-trigger-label">Search</span>
    <kbd class="search-trigger-key" aria-hidden="true">/</kbd>
  </button>

  <Teleport to="body">
    <Transition name="search-fade">
      <div v-if="open" class="search-overlay" @click.self="closeOverlay">
        <section
          ref="panel"
          class="search-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Site search"
        >
          <header class="search-head">
            <svg
              class="search-icon search-icon--head"
              viewBox="0 0 20 20"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M12.6 12.6 17 17" />
            </svg>
            <input
              ref="input"
              v-model="query"
              class="search-input"
              type="search"
              role="combobox"
              aria-label="Search cards, echoes and questions"
              aria-autocomplete="list"
              aria-expanded="true"
              :aria-controls="resultsId"
              :aria-activedescendant="activeDescendant"
              placeholder="Search cards, echoes and questions…"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
            />
            <button
              ref="closeBtn"
              type="button"
              class="search-close"
              aria-label="Close search"
              @click="closeOverlay"
            >
              ×
            </button>
          </header>

          <p class="search-sr-only" role="status" aria-live="polite">
            {{ announcement }}
          </p>

          <div class="search-body">
            <p v-if="loading" class="search-state">Loading the index…</p>
            <p v-else-if="loadError" class="search-state search-error">
              {{ loadError }}
              <button type="button" class="search-retry" @click="retryLoad">
                Retry
              </button>
            </p>
            <p v-else-if="!hasQuery" class="search-state">
              Type a card, echo or quiz keyword to search the whole site.
            </p>
            <p v-else-if="!groups.length" class="search-state">
              No results for “{{ query.trim() }}”.
            </p>

            <div
              v-else
              :id="resultsId"
              class="search-results"
              role="listbox"
              aria-label="Search results"
            >
              <div
                v-for="group in displayGroups"
                :key="group.type"
                class="search-group"
                role="group"
                :aria-labelledby="`search-group-${group.type}`"
              >
                <p :id="`search-group-${group.type}`" class="search-group-head">
                  <span class="search-group-label">{{ group.label }}</span>
                  <span class="search-group-count">{{ group.total }}</span>
                </p>

                <div
                  v-for="row in group.results"
                  :id="row.domId"
                  :key="row.id"
                  class="search-result"
                  :class="{ 'is-active': row.flatIndex === activeIndex }"
                  role="option"
                  :aria-selected="
                    row.flatIndex === activeIndex ? 'true' : 'false'
                  "
                  @mouseenter="setActive(row.flatIndex)"
                  @mousedown.prevent
                  @click="navigate(row)"
                >
                  <span class="search-result-name">{{ row.name }}</span>
                  <span v-if="secondary(row)" class="search-result-meta">
                    {{ secondary(row) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <footer class="search-foot">
            <span class="search-hint">
              <kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> open ·
              <kbd>Esc</kbd> close
            </span>
            <span v-if="indexCount" class="search-count">
              {{ indexCount }} entries
            </span>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
// SearchOverlay — the site-wide command palette in the header.
//
// Index: public/search-index.json is built by scripts/build-search-index.mjs
// at dev/build time. The client never touches cards.json / quiz.json at
// runtime and never requests the index during first paint: SearchService
// fetches it the first time this overlay opens, then keeps it in memory.
//
// Keyboard: `/` or Ctrl/Cmd+K opens (unless focus is in a text field), Esc
// closes, ↑/↓ move the active row, Enter opens it, Tab is trapped inside the
// dialog. Focus returns to the trigger (or whichever element opened it) when
// the overlay closes without navigating.
import { computed, nextTick } from 'vue';
import {
  RESULT_LIMIT,
  SearchService,
  searchIndex,
} from '@/services/searchService.js';

const RESULTS_ID = 'site-search-results';

/** Stable, CSS-safe DOM id for an aria-activedescendant target. */
function optionDomId(row) {
  return `search-option-${String(row.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export default {
  name: 'SearchOverlay',
  data() {
    return {
      open: false,
      query: '',
      index: null,
      loading: false,
      loadError: '',
      activeIndex: -1,
      // Focus/scroll side effects are browser-only; falsy during prerender.
      lastFocused: null,
      prevBodyOverflow: null,
      skipFocusReturn: false,
    };
  },
  computed: {
    hasQuery() {
      return this.query.trim() !== '';
    },
    searchState() {
      return searchIndex(this.index, this.query, { limit: RESULT_LIMIT });
    },
    groups() {
      return this.searchState.groups;
    },
    displayGroups() {
      let flatIndex = 0;
      return this.groups.map((group) => ({
        ...group,
        results: group.results.map((row) => {
          const decorated = {
            ...row,
            flatIndex,
            domId: optionDomId(row),
          };
          flatIndex += 1;
          return decorated;
        }),
      }));
    },
    flatResults() {
      return this.displayGroups.flatMap((group) => group.results);
    },
    activeResult() {
      return this.flatResults[this.activeIndex] ?? null;
    },
    activeDescendant() {
      return this.activeResult ? this.activeResult.domId : undefined;
    },
    resultsId() {
      return this.groups.length ? RESULTS_ID : undefined;
    },
    indexCount() {
      return this.index?.counts?.total ?? 0;
    },
    announcement() {
      if (!this.open) return '';
      if (this.loading) return 'Loading the search index.';
      if (this.loadError) return this.loadError;
      if (!this.hasQuery) return '';
      return this.searchState.total === 0
        ? 'No search results.'
        : `${this.searchState.total} search results across ${this.groups.length} groups.`;
    },
  },
  watch: {
    // Every query/index change produces a fresh flat list: highlight the first
    // row so Enter always does something predictable.
    flatResults() {
      this.activeIndex = this.flatResults.length ? 0 : -1;
    },
  },
  mounted() {
    document.addEventListener('keydown', this.onGlobalKeydown);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onGlobalKeydown);
    this.teardownModal();
  },
  methods: {
    // ---- global shortcuts -------------------------------------------------
    onGlobalKeydown(event) {
      if (event.defaultPrevented) return;
      // Never hijack keys while an IME (e.g. Chinese pinyin) is composing.
      if (event.isComposing || event.keyCode === 229) return;
      if (this.open) {
        this.onOpenKeydown(event);
        return;
      }
      // Never steal `/` (or Cmd+K) while the user is typing in a form control
      // or a contenteditable region.
      if (this.isTypingTarget(event.target)) return;

      const key = event.key;
      if (key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.openOverlay();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        this.openOverlay();
      }
    },
    onOpenKeydown(event) {
      // IME candidate selection owns Enter/Arrow keys until composition ends.
      if (event.isComposing || event.keyCode === 229) return;
      // Re-focus the field if Cmd/Ctrl+K fires again while the dialog is up.
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key?.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        this.$refs.input?.focus();
        return;
      }
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          this.closeOverlay();
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.moveActive(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.moveActive(-1);
          break;
        case 'Enter':
          if (this.activeResult) {
            event.preventDefault();
            this.navigate(this.activeResult);
          }
          break;
        case 'Tab':
          this.trapTab(event);
          break;
        default:
          break;
      }
    },
    isTypingTarget(target) {
      if (!target || typeof target !== 'object') return false;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable === true
      );
    },

    // ---- open / close -----------------------------------------------------
    openOverlay() {
      if (this.open) {
        this.$refs.input?.focus();
        return;
      }
      const body = typeof document !== 'undefined' ? document.body : null;
      const active =
        typeof document !== 'undefined' ? document.activeElement : null;
      this.lastFocused =
        active && active !== body && typeof active.focus === 'function'
          ? active
          : this.$refs.trigger;
      this.skipFocusReturn = false;
      this.open = true;
      // Reopening keeps the last query but restarts keyboard selection at the
      // top, so Enter follows the visible first row rather than a stale index.
      this.activeIndex = this.flatResults.length ? 0 : -1;
      if (typeof document !== 'undefined') {
        this.prevBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }
      nextTick(() => {
        this.$refs.input?.focus();
        this.$refs.input?.select?.();
      });
      this.ensureIndex();
    },
    closeOverlay() {
      if (!this.open) return;
      this.open = false;
      this.teardownModal();
      const target = this.lastFocused;
      this.lastFocused = null;
      if (
        !this.skipFocusReturn &&
        target &&
        typeof target.focus === 'function'
      ) {
        nextTick(() => target.focus());
      }
      this.skipFocusReturn = false;
    },
    teardownModal() {
      if (typeof document === 'undefined') return;
      if (this.prevBodyOverflow !== null) {
        document.body.style.overflow = this.prevBodyOverflow;
        this.prevBodyOverflow = null;
      }
    },
    trapTab(event) {
      const panel = this.$refs.panel;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll(
          'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.disabled);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    },

    // ---- data -------------------------------------------------------------
    async ensureIndex() {
      if (this.index || this.loading) return;
      this.loading = true;
      this.loadError = '';
      try {
        this.index = await SearchService.loadIndex();
      } catch (error) {
        console.error('Failed to load the search index:', error);
        this.loadError = 'Search is unavailable right now.';
      } finally {
        this.loading = false;
      }
    },
    retryLoad() {
      this.loadError = '';
      this.ensureIndex();
    },

    // ---- results / selection ---------------------------------------------
    setActive(index) {
      this.activeIndex = index;
    },
    moveActive(delta) {
      const count = this.flatResults.length;
      if (!count) return;
      const next =
        this.activeIndex < 0
          ? delta > 0
            ? 0
            : count - 1
          : (this.activeIndex + delta + count) % count;
      this.activeIndex = next;
      nextTick(() => {
        const row = this.activeResult;
        if (!row) return;
        document
          .getElementById(row.domId)
          ?.scrollIntoView({ block: 'nearest' });
      });
    },
    secondary(row) {
      const alias = row.aliases?.[0];
      if (!alias) return '';
      return alias.toLowerCase() === row.name.toLowerCase() ? '' : alias;
    },
    navigate(row) {
      this.skipFocusReturn = true;
      this.closeOverlay();
      this.$router.push(row.url).catch((error) => {
        console.error('Search navigation failed:', error);
      });
    },
  },
};
</script>

<style scoped>
/* ---- header trigger ---------------------------------------------------- */
.search-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 5px 8px;
  font-family: var(--font-type);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-faded);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 0.22s,
    border-color 0.22s,
    background-color 0.22s;
}

.search-trigger:hover {
  color: var(--ink);
  border-color: var(--gold-leaf);
  background: rgba(var(--gold-rgb), 0.08);
}

.search-trigger:focus-visible {
  outline: 2px solid var(--gold-ink);
  outline-offset: 2px;
}

.search-icon {
  flex: none;
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.search-trigger-key {
  padding: 0 4px;
  font-family: var(--font-type);
  font-size: 9px;
  line-height: 1.6;
  color: var(--ink-faded);
  border: 1px solid var(--rule);
  border-radius: 2px;
}

/* ---- dialog shell ------------------------------------------------------ */
.search-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(48px, 10vh, 112px) var(--space-3) var(--space-3);
  background: rgba(var(--ink-rgb), 0.5);
}

.search-panel {
  display: flex;
  flex-direction: column;
  width: min(720px, 100%);
  max-height: min(72vh, 660px);
  background: var(--paper-light);
  border: 1px solid var(--ink);
  border-top: 3px double var(--ink);
  box-shadow: 0 24px 64px rgba(var(--ink-rgb), 0.38);
}

.search-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--rule);
}

.search-icon--head {
  width: 16px;
  height: 16px;
  color: var(--ink-faded);
}

.search-input {
  flex: 1;
  min-width: 0;
  padding: 0;
  font-family: var(--font-serif);
  font-size: 22px;
  line-height: 1.3;
  color: var(--ink);
  background: transparent;
  border: none;
  border-radius: 0;
}

.search-input::placeholder {
  font-size: 16px;
  font-style: italic;
  color: var(--ink-faded);
}

.search-input:focus {
  outline: none;
}

/* The dialog's × is the only clear control — hide WebKit's extra button. */
.search-input::-webkit-search-cancel-button {
  display: none;
}

.search-close {
  flex: none;
  width: 40px;
  height: 40px;
  margin-right: calc(-1 * var(--space-2));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-type);
  font-size: 22px;
  line-height: 1;
  color: var(--ink-faded);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.22s;
}

.search-close:hover {
  color: var(--oxblood);
}

.search-close:focus-visible {
  outline: 2px solid var(--gold-ink);
  outline-offset: 1px;
}

/* ---- body / states ----------------------------------------------------- */
.search-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-2) 0;
}

.search-state {
  padding: var(--space-5) var(--space-4);
  font-family: var(--font-type);
  font-size: var(--type-caption);
  letter-spacing: 0.08em;
  color: var(--ink-faded);
}

.search-error {
  color: var(--oxblood);
}

.search-retry {
  margin-left: var(--space-2);
  padding: 0;
  font-family: var(--font-type);
  font-size: var(--type-caption);
  color: var(--oxblood);
  background: transparent;
  border: none;
  border-bottom: 1px solid currentColor;
  cursor: pointer;
}

.search-retry:focus-visible {
  outline: 2px solid var(--gold-ink);
  outline-offset: 2px;
}

/* Screen-reader-only live region announcing result counts. */
.search-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ---- grouped results --------------------------------------------------- */
.search-results {
  padding: 0 var(--space-2);
}

.search-group {
  padding: var(--space-2) 0;
}

.search-group + .search-group {
  border-top: 1px solid var(--rule);
}

.search-group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-type);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.search-group-count {
  color: var(--rule);
}

.search-result {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px var(--space-2);
  border-left: 2px solid transparent;
  cursor: pointer;
  transition:
    background-color 0.16s,
    border-color 0.16s;
}

.search-result.is-active {
  background: rgba(var(--gold-rgb), 0.14);
  border-left-color: var(--gold-leaf);
}

.search-result-name {
  font-family: var(--font-serif);
  font-size: 17px;
  line-height: 1.3;
  color: var(--ink);
}

.search-result-meta {
  overflow: hidden;
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.4;
  color: var(--ink-faded);
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ---- footer ------------------------------------------------------------ */
.search-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-type);
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--ink-faded);
  border-top: 1px solid var(--rule);
}

.search-hint kbd {
  display: inline-block;
  min-width: 14px;
  padding: 0 3px;
  margin-right: 2px;
  font-family: var(--font-type);
  font-size: 9px;
  line-height: 1.5;
  text-align: center;
  color: var(--ink-faded);
  border: 1px solid var(--rule);
  border-radius: 2px;
}

.search-count {
  flex: none;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

/* ---- transition -------------------------------------------------------- */
.search-fade-enter-active,
.search-fade-leave-active {
  transition: opacity 0.16s ease;
}

.search-fade-enter-active .search-panel,
.search-fade-leave-active .search-panel {
  transition: transform 0.16s ease;
}

.search-fade-enter-from,
.search-fade-leave-to {
  opacity: 0;
}

.search-fade-enter-from .search-panel,
.search-fade-leave-to .search-panel {
  transform: translateY(-8px);
}

/* ---- responsive -------------------------------------------------------- */
@media (max-width: 768px) {
  .search-trigger {
    width: 40px;
    height: 40px;
    min-height: 40px;
    padding: 0;
    justify-content: center;
  }

  .search-trigger-label,
  .search-trigger-key {
    display: none;
  }

  .search-overlay {
    padding: 0;
  }

  .search-panel {
    width: 100%;
    max-height: 88vh;
    border-right: none;
    border-bottom: none;
    border-left: none;
  }

  .search-input {
    font-size: 18px;
  }

  .search-result-name {
    font-size: 16px;
  }

  .search-foot {
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .search-fade-enter-active,
  .search-fade-leave-active,
  .search-fade-enter-active .search-panel,
  .search-fade-leave-active .search-panel,
  .search-result,
  .search-trigger {
    transition: none;
  }
}
</style>
