// Provenance copy guard — owner compliance directive 2026-10-25.
//
// The site must never state where the data comes from or how it was produced;
// see the "Data Provenance Copy Rule" section in AGENTS.md. This test walks
// the text surfaces that ship to readers (src/**/*.{vue,js,json}, index.html,
// the deployed data-package manifests, labels.json and the three version.json
// files) and fails when any forbidden provenance wording appears, reporting
// every hit as file:line:text so it can be fixed at the exact spot.
//
// Deliberately NOT scanned: public/data/{cards,exports}/... game-data bodies
// (cards.json / echoes.json / quiz.json contain in-game content the owner
// protects verbatim) and docs/tech-site-benchmark.md (third-party website
// research, out of scope per the directive).
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Forbidden provenance wording (zh + en). Matching is case-insensitive.
const FORBIDDEN_TERMS = [
  '提取自',
  '游戏客户端',
  'PC 客户端',
  '客户端提取',
  '抓取',
  '爬虫',
  '抓包',
  '解包',
  '逆向',
  '反编译',
  'extracted from',
  'game client',
  'datamined',
  'crawled',
  "from the game's",
];

// Files outside src/ that ship to readers and must stay clean.
const EXTRA_FILES = [
  'index.html',
  'public/data/labels.json',
  'public/data/spellbook/manifest.json',
  'public/data/echoes/manifest.json',
  'public/data/quiz/manifest.json',
  'public/data/spellbook/version.json',
  'public/data/echoes/version.json',
  'public/data/quiz/version.json',
];

const SCANNED_EXTENSIONS = new Set(['.vue', '.js', '.json']);

/** Recursively collect .vue/.js/.json files under dir (stable order). */
function walkSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(fullPath));
    } else if (SCANNED_EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Collect every forbidden-term hit as a "file:line:text" report string. */
function findForbiddenHits() {
  const targets = [
    ...walkSourceFiles(join(ROOT, 'src')),
    ...EXTRA_FILES.map((file) => join(ROOT, file)).filter((file) =>
      existsSync(file),
    ),
  ];

  const hits = [];
  for (const file of targets) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, lineIndex) => {
      const haystack = line.toLowerCase();
      const term = FORBIDDEN_TERMS.find((candidate) =>
        haystack.includes(candidate.toLowerCase()),
      );
      if (term !== undefined) {
        hits.push(
          `${relative(ROOT, file)}:${lineIndex + 1}: ${line.trim()} [matched: ${term}]`,
        );
      }
    });
  }
  return hits;
}

describe('provenance copy guard (owner directive 2026-10-25)', () => {
  it('keeps forbidden provenance wording out of src and deployed data meta', () => {
    // Empty array = clean. On failure Vitest prints each file:line:text hit.
    expect(findForbiddenHits()).toEqual([]);
  });

  it('scans a non-empty set of targets (guard must never silently pass)', () => {
    const scanned = walkSourceFiles(join(ROOT, 'src'));
    expect(scanned.length).toBeGreaterThan(0);
    for (const file of EXTRA_FILES) {
      expect(existsSync(join(ROOT, file)), `missing scan target: ${file}`).toBe(
        true,
      );
    }
  });
});
