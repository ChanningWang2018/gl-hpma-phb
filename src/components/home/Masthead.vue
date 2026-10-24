<template>
  <header class="masthead">
    <div class="running-head">
      <span class="running-edition">The weekly data</span>
      <span class="running-subject">Unofficial · non-commercial</span>
      <span class="running-data">Data through {{ throughLabel }}</span>
    </div>

    <div class="masthead-body">
      <div class="masthead-lead">
        <h1 class="wordmark">my little hpma bits</h1>
        <p class="deck">
          An unofficial almanac of echoes, cards and drills<br
            class="deck-break"
          />
          for <em>Harry Potter: Magic Awakened</em>.
        </p>
      </div>

      <div class="issue-block">
        <p class="issue-label">Data week</p>
        <p class="issue-range">{{ rangeLabel }}</p>
      </div>
    </div>
  </header>
</template>

<script>
import { periodEndLabel } from '@/services/homeStats.js';

// Masthead — the paper front page's nameplate. A running head (weekly cadence,
// provenance, data cut-off), the blackletter wordmark and one deck line on the
// left; the data week's date range on the right, closed by a double rule. The
// page has exactly one h1 and this is it.
export default {
  name: 'Masthead',
  props: {
    // Full range label, e.g. '24–30 Sep 2026'
    periodLabel: { type: String, default: '' },
  },
  computed: {
    rangeLabel() {
      return this.periodLabel || '—';
    },
    throughLabel() {
      return periodEndLabel(this.periodLabel);
    },
  },
};
</script>

<style scoped>
.masthead {
  padding-top: clamp(20px, 2.6vw, 32px);
}

.running-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 18px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ink);
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faded);
}

.running-subject {
  color: var(--oxblood);
}

.running-data {
  color: var(--ink);
  white-space: nowrap;
}

.masthead-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: clamp(24px, 4vw, 64px);
  padding: clamp(22px, 3vw, 34px) 0 clamp(18px, 2.2vw, 26px);
  border-bottom: 3px double var(--ink);
}

.masthead-lead {
  min-width: 0;
}

.wordmark {
  font-family: var(--font-blackletter);
  font-size: clamp(46px, 6.3vw, 88px);
  font-weight: 400;
  line-height: 0.92;
  letter-spacing: 0.5px;
  color: var(--ink);
  text-wrap: balance;
}

.deck {
  max-width: 58ch;
  margin-top: 14px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: clamp(15px, 1.25vw, 17.5px);
  line-height: 1.5;
  color: var(--ink-faded);
  text-wrap: pretty;
}

.deck em {
  font-style: italic;
  color: var(--ink);
}

.issue-block {
  min-width: 172px;
  padding-top: 9px;
  border-top: 1px solid var(--ink);
  text-align: right;
}

.issue-label {
  font-family: var(--font-type);
  font-size: 8px;
  line-height: 1.5;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--oxblood);
}

.issue-range {
  margin-top: 7px;
  font-family: var(--font-type);
  font-size: 8.5px;
  line-height: 1.5;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-faded);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .running-subject {
    display: none;
  }

  .masthead-body {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }

  .wordmark {
    font-size: clamp(42px, 12.4vw, 66px);
  }

  .deck {
    margin-top: 12px;
    font-size: 15px;
  }

  .issue-block {
    min-width: 0;
    padding-top: 8px;
    text-align: left;
  }

  .issue-range {
    margin-top: 0;
  }
}

@media (max-width: 480px) {
  .running-head {
    font-size: 7.5px;
    letter-spacing: 0.12em;
  }

  .running-data {
    white-space: normal;
  }
}
</style>
