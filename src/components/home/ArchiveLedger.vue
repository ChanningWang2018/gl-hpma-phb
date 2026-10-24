<template>
  <section class="ledger" aria-labelledby="ledger-title">
    <header class="aside-head">
      <p class="kicker">The archive</p>
      <h3 id="ledger-title">Everything so far</h3>
    </header>

    <dl class="figures">
      <div class="figure">
        <dt>Issues</dt>
        <dd>{{ issueLabel }}</dd>
      </div>
      <div class="figure">
        <dt>Echoes</dt>
        <dd>{{ echoLabel }}</dd>
      </div>
      <div class="figure">
        <dt>Brackets</dt>
        <dd>{{ bracketLabel }}</dd>
      </div>
    </dl>

    <RouterLink class="ledger-link" to="/analytics">
      Full standings
      <span class="ledger-arrow" aria-hidden="true">→</span>
    </RouterLink>
  </section>
</template>

<script>
import { RouterLink } from 'vue-router';

// ArchiveLedger — the paper column's closing note: three figures that describe
// the whole archive (not this week) and one way into the full data page. The
// numbers are printed above their labels, so the <dl> order stays semantic.
export default {
  name: 'ArchiveLedger',
  components: { RouterLink },
  props: {
    // Issue count (periods.length); null while loading
    edition: { type: Number, default: null },
    // Echoes charted in the current bracket
    echoCount: { type: Number, default: 0 },
    // Brackets with rows this week
    bracketCount: { type: Number, default: 0 },
  },
  computed: {
    issueLabel() {
      return this.edition ?? '—';
    },
    echoLabel() {
      return this.echoCount ? this.echoCount : '—';
    },
    bracketLabel() {
      return this.bracketCount ? this.bracketCount : '—';
    },
  },
};
</script>

<style scoped>
.ledger {
  padding-top: 13px;
  border-top: 1px solid var(--ink);
}

.kicker {
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--oxblood);
}

.aside-head h3 {
  margin-top: 6px;
  font-family: var(--font-serif);
  font-size: clamp(21px, 1.9vw, 25px);
  font-weight: 400;
  line-height: 1.1;
  color: var(--ink);
}

.figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 15px;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
}

.figure {
  display: flex;
  flex-direction: column-reverse;
  gap: 3px;
  padding: 11px 12px 12px;
  border-left: 1px solid var(--rule);
}

.figure:first-child {
  border-left: 0;
  padding-left: 0;
}

.figure dt {
  font-family: var(--font-type);
  font-size: 7.5px;
  line-height: 1.5;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.figure dd {
  font-family: var(--font-serif);
  font-size: clamp(24px, 2.2vw, 30px);
  line-height: 1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.ledger-link {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-top: 13px;
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--oxblood);
  text-decoration: none;
}

.ledger-link:hover {
  color: var(--ink);
}

.ledger-arrow {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1;
  transition: transform 0.2s;
}

.ledger-link:hover .ledger-arrow {
  transform: translateX(3px);
}

.ledger-link:focus-visible {
  outline: 2px solid var(--gold-ink);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .ledger-arrow {
    transition: none;
  }
}
</style>
