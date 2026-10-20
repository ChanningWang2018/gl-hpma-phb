// Generates docs/design/home.data.js from the real archive aggregate.
// Run from the repo root, after a new snapshot: node docs/design/gen-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const trends = JSON.parse(readFileSync('public/archive/trends.json', 'utf8'));
const NAMES = {
  1: 'Hermione Granger',
  2: 'Harry Potter',
  3: 'Dobby',
  4: 'Rubeus Hagrid',
  5: 'Weasley Twins',
  6: 'Newt Scamander',
  7: 'Severus Snape',
  8: 'Neville Longbottom',
  9: 'Bellatrix Lestrange',
  10: 'Luna Lovegood',
  11: 'Filius Flitwick',
  12: 'Sirius Black',
  13: 'Ron Weasley',
  14: 'Ginny Weasley',
  15: 'Albus Dumbledore',
  16: 'Minerva McGonagall',
  17: 'Lord Voldemort',
  18: 'Cedric Diggory',
  19: 'Gellert Grindelwald',
};
const MODE_KEYS = ['1v1-high', '1v1-low', '2v2-high', '2v2-low'];
const MODE_LABELS = {
  '1v1-high': '1v1 · 7500+',
  '1v1-low': '1v1 · under 7500',
  '2v2-high': '2v2 · 7500+',
  '2v2-low': '2v2 · under 7500',
};

const byKey = new Map();
for (const row of trends.rows) byKey.set(`${row[0]}|${row[1]}|${row[2]}`, row);

const lastPeriod = trends.periods.length - 1;

const modes = {};
MODE_KEYS.forEach((key, mi) => {
  const rows = [];
  for (let echo = 1; echo <= 19; echo++) {
    const r = byKey.get(`${lastPeriod}|${echo}|${mi}`);
    const prev = byKey.get(`${lastPeriod - 1}|${echo}|${mi}`);
    if (!r) continue;
    rows.push({
      id: echo,
      name: NAMES[echo],
      win: r[3],
      pick: r[4],
      dWin: prev ? +(r[3] - prev[3]).toFixed(1) : 0,
      dPick: prev ? +(r[4] - prev[4]).toFixed(1) : 0,
    });
  }
  rows.sort((a, b) => b.win - a.win);
  modes[key] = { label: MODE_LABELS[key], rows };
});

const data = {
  edition: trends.periods.length,
  generatedAt: trends.generatedAt,
  currentPeriod: trends.periods[lastPeriod],
  modes,
  counts: { issues: 37, echoes: 19, cards: 141, questions: 1847 },
};

writeFileSync(
  'docs/design/home.data.js',
  '/* Generated from public/archive/trends.json by docs/design/gen-data.mjs — do not edit by hand. */\n' +
    'window.HOME_DATA = ' +
    JSON.stringify(data) +
    ';\n',
);
console.log(
  'wrote docs/design/home.data.js',
  JSON.stringify(data).length,
  'bytes',
);
