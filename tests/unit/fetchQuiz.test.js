// Tests for scripts/fetch-quiz.mjs pure helpers only — the network code paths
// (GitHub API / raw downloads) are intentionally not tested. Fixtures mirror
// the schema_version 2 shapes documented in docs/quiz.md §0: banks object,
// 4 options per question with exactly one is_correct, manifest coverage
// counts plus a datasets[id=quiz].count grand total.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  EXPECTED_SCHEMA_VERSION,
  matchQuizTag,
  compareVersions,
  buildVersionJson,
  diffQuestionIds,
  formatQuizDiffList,
  validateQuizSchemaVersion,
  checkQuestionInvariants,
  checkCoverageCounts,
  validateQuizBundle,
} from '../../scripts/fetch-quiz.mjs';

// ========== Fixture builders ==========

const makeOptions = (correctNo, count = 4) =>
  Array.from({ length: count }, (_, i) => ({
    no: i + 1,
    is_correct: i + 1 === correctNo,
    text: { zh: `选项${i + 1}`, en: `Option ${i + 1}` },
  }));

const makeQuestion = (id, { correctNo = 1, optionCount = 4 } = {}) => ({
  id,
  theme: 'theme1',
  question: { zh: `题干${id}`, en: `Question ${id}` },
  options: makeOptions(correctNo, optionCount),
  explanation: { zh: '讲解', en: 'Explanation' },
});

const makeBank = (bankId, questions) => ({
  id: bankId,
  source_table: 'dbx_new/some_table',
  questions,
  play_configs: [],
});

const makeQuiz = ({ schemaVersion = 2, banks } = {}) => ({
  schema_version: schemaVersion,
  data_version: 20261009,
  generated_at: '2026-10-09T22:59:16+08:00',
  banks,
});

// Two banks (the real shape): history_of_magic 2 题 + muggle_studies 1 题.
const goodQuiz = () =>
  makeQuiz({
    banks: {
      history_of_magic: makeBank('history_of_magic', [
        makeQuestion(1),
        makeQuestion(2, { correctNo: 3 }),
      ]),
      muggle_studies: makeBank('muggle_studies', [
        makeQuestion(101, { correctNo: 2 }),
      ]),
    },
  });

const manifestFor = (quizJson) => {
  const questions = {};
  let total = 0;
  for (const [bankId, bank] of Object.entries(quizJson.banks)) {
    questions[bankId] = bank.questions.length;
    total += bank.questions.length;
  }
  return {
    schema_version: quizJson.schema_version,
    data_version: quizJson.data_version,
    generated_at: quizJson.generated_at,
    locales: ['zh', 'en'],
    datasets: [{ id: 'quiz', file: 'quiz.json', count: total }],
    coverage: { banks: Object.keys(questions).length, questions },
  };
};

// ========== Tag parsing & version comparison ==========

describe('matchQuizTag', () => {
  it('extracts the version from a conforming tag', () => {
    expect(matchQuizTag('quiz-v2.20261009.0')).toBe('2.20261009.0');
    expect(matchQuizTag('quiz-v1.20240101.0')).toBe('1.20240101.0');
    expect(matchQuizTag('quiz-v10.20301231.0')).toBe('10.20301231.0');
  });

  it('rejects tags outside the quiz-vX.YYYYMMDD.0 contract', () => {
    expect(matchQuizTag('v2.20261009.0')).toBe(null);
    expect(matchQuizTag('quiz-v2.20261009')).toBe(null);
    // Patch digit is pinned to 0 (republish = new tag, never .1).
    expect(matchQuizTag('quiz-v2.20261009.1')).toBe(null);
    // Date segment is exactly 8 digits.
    expect(matchQuizTag('quiz-v2.2026100.0')).toBe(null);
    expect(matchQuizTag('quiz-v2.202610090.0')).toBe(null);
    expect(matchQuizTag('quiz-vx.20261009.0')).toBe(null);
    expect(matchQuizTag('quiz-v2.20261009.0-rc1')).toBe(null);
    expect(matchQuizTag('quiz-V2.20261009.0')).toBe(null);
    expect(matchQuizTag('spellbook-v1.1.0')).toBe(null);
    expect(matchQuizTag('')).toBe(null);
    expect(matchQuizTag(null)).toBe(null);
    expect(matchQuizTag(undefined)).toBe(null);
    expect(matchQuizTag(42)).toBe(null);
  });
});

describe('compareVersions', () => {
  it('orders versions numerically', () => {
    expect(compareVersions('2.20261010.0', '2.20261009.0')).toBe(1);
    expect(compareVersions('2.20261009.0', '2.20261010.0')).toBe(-1);
    expect(compareVersions('2.20261009.0', '2.20261009.0')).toBe(0);
  });

  it('lets the schema segment dominate the data date', () => {
    expect(compareVersions('3.20260101.0', '2.20261231.0')).toBe(1);
    expect(compareVersions('2.20261231.0', '3.20260101.0')).toBe(-1);
  });

  it('compares components numerically, not lexicographically', () => {
    expect(compareVersions('2.9999999.0', '2.20261009.0')).toBe(-1);
    expect(compareVersions('2.20261009.0', '2.9999999.0')).toBe(1);
    expect(compareVersions('10.20261009.0', '9.20261231.0')).toBe(1);
  });

  it('treats missing components as zero', () => {
    expect(compareVersions('2.20261009', '2.20261009.0')).toBe(0);
    expect(compareVersions('2.20261009.0', '2.20261009')).toBe(0);
    expect(compareVersions('2.20261009', '2.20261010')).toBe(-1);
  });
});

// ========== version.json assembly ==========

describe('buildVersionJson', () => {
  it('assembles the version.json contract from tag + repo + manifest', () => {
    const info = buildVersionJson({
      tag: 'quiz-v2.20261009.0',
      repo: 'hpma-bits/hpma-quizbank',
      manifest: {
        schema_version: 2,
        data_version: 20261009,
        generated_at: '2026-10-09T22:59:16+08:00',
      },
    });
    expect(info).toEqual({
      tag: 'quiz-v2.20261009.0',
      version: '2.20261009.0',
      schemaVersion: 2,
      dataVersion: 20261009,
      sourceRepo: 'hpma-bits/hpma-quizbank',
      sourceUrl:
        'https://github.com/hpma-bits/hpma-quizbank/tree/quiz-v2.20261009.0',
      generatedAt: '2026-10-09T22:59:16+08:00',
    });
    // Key order matches the T1-committed file shape.
    expect(Object.keys(info)).toEqual([
      'tag',
      'version',
      'schemaVersion',
      'dataVersion',
      'sourceRepo',
      'sourceUrl',
      'generatedAt',
    ]);
  });

  it('serializes byte for byte to the committed version.json (real data)', () => {
    const committed = readFileSync('public/data/quiz/version.json', 'utf8');
    const committedInfo = JSON.parse(committed);
    const realManifest = JSON.parse(
      readFileSync('public/data/quiz/manifest.json', 'utf8'),
    );
    const rebuilt = buildVersionJson({
      tag: committedInfo.tag,
      repo: committedInfo.sourceRepo,
      manifest: realManifest,
    });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});

// ========== Question id diff ==========

describe('diffQuestionIds', () => {
  it('reports added and removed questions with bank-qualified keys', () => {
    const oldQuiz = goodQuiz();
    const newQuiz = makeQuiz({
      banks: {
        history_of_magic: makeBank('history_of_magic', [
          makeQuestion(2, { correctNo: 3 }),
          makeQuestion(3),
        ]),
        muggle_studies: makeBank('muggle_studies', [
          makeQuestion(101, { correctNo: 2 }),
        ]),
      },
    });
    const diff = diffQuestionIds(oldQuiz, newQuiz);
    expect(diff.added.map((e) => e.key)).toEqual(['history_of_magic:3']);
    expect(diff.added[0].name).toBe('题干3');
    expect(diff.removed.map((e) => e.key)).toEqual(['history_of_magic:1']);
  });

  it('never conflates equal ids across banks (independent id spaces)', () => {
    const oldQuiz = makeQuiz({
      banks: {
        history_of_magic: makeBank('history_of_magic', [makeQuestion(1)]),
        muggle_studies: makeBank('muggle_studies', [makeQuestion(1)]),
      },
    });
    // Same numeric ids on both sides, only the muggle copy's text changes —
    // still no add/remove because the bank-qualified keys are unchanged.
    const newQuiz = makeQuiz({
      banks: {
        history_of_magic: makeBank('history_of_magic', [makeQuestion(1)]),
        muggle_studies: makeBank('muggle_studies', [
          { ...makeQuestion(1), question: { zh: '改题', en: 'Changed' } },
        ]),
      },
    });
    expect(diffQuestionIds(oldQuiz, newQuiz)).toEqual({
      added: [],
      removed: [],
    });
  });

  it('falls back to the en question text and then the raw id', () => {
    const enOnly = {
      id: 7,
      question: { en: 'Only English' },
      options: makeOptions(1),
    };
    const noText = { id: 8, options: makeOptions(1) };
    const oldQuiz = makeQuiz({
      banks: {
        history_of_magic: makeBank('history_of_magic', [enOnly, noText]),
      },
    });
    const diff = diffQuestionIds(oldQuiz, null);
    expect(diff.removed).toEqual([
      { key: 'history_of_magic:7', name: 'Only English' },
      { key: 'history_of_magic:8', name: '8' },
    ]);
  });

  it('returns empty lists when nothing changed and tolerates null inputs', () => {
    const quiz = goodQuiz();
    expect(diffQuestionIds(quiz, goodQuiz())).toEqual({
      added: [],
      removed: [],
    });
    expect(diffQuestionIds(null, quiz).added).toHaveLength(3);
    expect(diffQuestionIds(quiz, null).removed).toHaveLength(3);
  });
});

describe('formatQuizDiffList', () => {
  const entries = (n) =>
    Array.from({ length: n }, (_, i) => ({
      key: `history_of_magic:${i + 1}`,
      name: `题干${i + 1}`,
    }));

  it('joins bank:id + question previews and truncates beyond the limit', () => {
    expect(formatQuizDiffList(entries(2))).toBe(
      'history_of_magic:1 题干1、history_of_magic:2 题干2',
    );
    const long = formatQuizDiffList(entries(20));
    expect(long).toContain(' ...等 20 题');
    expect(long.startsWith('history_of_magic:1 题干1')).toBe(true);
    expect(formatQuizDiffList([])).toBe('（无）');
    expect(formatQuizDiffList(null)).toBe('（无）');
  });

  it('truncates overlong question texts in the preview', () => {
    const text = '魁'.repeat(100);
    const out = formatQuizDiffList([{ key: 'history_of_magic:1', name: text }]);
    expect(out).toBe(`history_of_magic:1 ${'魁'.repeat(24)}…`);
  });
});

// ========== Structural gates ==========

describe('validateQuizSchemaVersion (gate a)', () => {
  it('accepts a payload at the expected schema version', () => {
    expect(validateQuizSchemaVersion(goodQuiz())).toBe(null);
  });

  it('rejects a newer schema with the consumer-upgrade message', () => {
    const newer = EXPECTED_SCHEMA_VERSION + 1;
    const message = validateQuizSchemaVersion(
      makeQuiz({ schemaVersion: newer, banks: {} }),
    );
    expect(message).toContain(`schema_version=${newer}`);
    expect(message).toContain('quizClient 需升级');
    expect(message).toContain(
      `EXPECTED_SCHEMA_VERSION=${EXPECTED_SCHEMA_VERSION}`,
    );
    expect(message).toContain('拒绝入库');
  });

  it('rejects missing/other schema versions and non-object payloads', () => {
    expect(
      validateQuizSchemaVersion({ data_version: 20261009, banks: {} }),
    ).toContain('缺失');
    expect(validateQuizSchemaVersion({ schema_version: 99 })).toContain(
      'schema_version=99',
    );
    expect(validateQuizSchemaVersion(null)).toContain('顶层不是 JSON 对象');
    expect(validateQuizSchemaVersion([1, 2])).toContain('顶层不是 JSON 对象');
  });
});

describe('checkQuestionInvariants (gate b)', () => {
  it('accepts a well-formed bundle', () => {
    expect(checkQuestionInvariants(goodQuiz())).toEqual([]);
  });

  it('rejects a question with two correct options', () => {
    const quiz = goodQuiz();
    const q = quiz.banks.history_of_magic.questions[0];
    q.options[1].is_correct = true; // now options 1 and 2 are both correct
    const problems = checkQuestionInvariants(quiz);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('history_of_magic');
    expect(problems[0]).toContain('is_correct 标记数不为 1（实际 2）');
    expect(problems[0]).toContain(`id=${q.id}`);
  });

  it('rejects a question with zero correct options and wrong option counts', () => {
    const quiz = goodQuiz();
    const bank = quiz.banks.history_of_magic;
    bank.questions[0].options.forEach((o) => {
      o.is_correct = false;
    });
    bank.questions[1].options = makeOptions(1, 3); // only 3 options
    const problems = checkQuestionInvariants(quiz);
    expect(
      problems.some((p) => p.includes('is_correct 标记数不为 1（实际 0）')),
    ).toBe(true);
    expect(problems.some((p) => p.includes('选项数不为 4（实际 3）'))).toBe(
      true,
    );
  });

  it('rejects empty questions arrays and a missing banks object', () => {
    const quiz = goodQuiz();
    quiz.banks.muggle_studies.questions = [];
    expect(checkQuestionInvariants(quiz)[0]).toContain(
      'muggle_studies 的 questions 为空或不是数组',
    );
    expect(checkQuestionInvariants({})[0]).toContain('缺少 banks 对象');
    expect(checkQuestionInvariants(null)[0]).toContain('缺少 banks 对象');
  });
});

describe('checkCoverageCounts (gate c)', () => {
  it('accepts counts that agree with the manifest', () => {
    const quiz = goodQuiz();
    expect(checkCoverageCounts(quiz, manifestFor(quiz))).toEqual([]);
  });

  it('rejects a bank count that disagrees with coverage.questions', () => {
    const quiz = goodQuiz();
    const manifest = manifestFor(quiz);
    manifest.coverage.questions.history_of_magic = 999;
    const problems = checkCoverageCounts(quiz, manifest);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      'history_of_magic 题数不一致：quiz.json=2，manifest.coverage.questions=999',
    );
  });

  it('rejects a grand total that disagrees with datasets[quiz].count', () => {
    const quiz = goodQuiz();
    const manifest = manifestFor(quiz);
    manifest.datasets[0].count = 1847;
    expect(checkCoverageCounts(quiz, manifest)[0]).toContain(
      '总题数不一致：quiz.json 各 bank 合计=3，manifest.datasets[quiz].count=1847',
    );
  });

  it('rejects missing coverage.questions or datasets[quiz] entries', () => {
    const quiz = goodQuiz();
    const noCoverage = manifestFor(quiz);
    delete noCoverage.coverage;
    expect(checkCoverageCounts(quiz, noCoverage)[0]).toContain(
      'manifest.json 缺少 coverage.questions',
    );
    const noDataset = manifestFor(quiz);
    noDataset.datasets = [];
    expect(checkCoverageCounts(quiz, noDataset)[0]).toContain(
      'datasets 中没有 id=quiz 的条目',
    );
  });

  it('flags banks declared on only one side of quiz/coverage', () => {
    // quiz is missing a bank that coverage still declares.
    const quiz = goodQuiz();
    const manifest = manifestFor(goodQuiz()); // coverage keeps muggle_studies: 1
    delete quiz.banks.muggle_studies;
    const problems = checkCoverageCounts(quiz, manifest);
    expect(problems[0]).toContain('muggle_studies 的 questions 缺失或不是数组');
    expect(problems.some((p) => p.includes('总题数不一致'))).toBe(true);

    // coverage declares a bank quiz has never heard of.
    const quiz2 = goodQuiz();
    const manifest2 = manifestFor(quiz2);
    manifest2.coverage.questions.unicode_patronus = 10;
    expect(
      checkCoverageCounts(quiz2, manifest2).some((p) =>
        p.includes('unicode_patronus 的 questions 缺失'),
      ),
    ).toBe(true);
  });
});

describe('validateQuizBundle (full gate)', () => {
  it('accepts a consistent quiz/manifest pair', () => {
    const quiz = goodQuiz();
    expect(validateQuizBundle(quiz, manifestFor(quiz))).toEqual([]);
  });

  it('refuses a schema bump fast with the consumer-upgrade message', () => {
    const quiz = makeQuiz({ schemaVersion: 3, banks: {} });
    const manifest = manifestFor(quiz);
    const problems = validateQuizBundle(quiz, manifest);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('schema_version=3');
    expect(problems[0]).toContain('拒绝入库');
  });

  it('rejects quiz/manifest schema disagreement (gate d)', () => {
    const quiz = goodQuiz();
    const manifest = manifestFor(quiz);
    manifest.schema_version = 3;
    const problems = validateQuizBundle(quiz, manifest);
    expect(problems).toContain(
      'schema 版本不一致：quiz.json=2，manifest.json=3',
    );
  });

  it('collects multiple problems from gates b/c at once', () => {
    const quiz = goodQuiz();
    quiz.banks.history_of_magic.questions[0].options = makeOptions(1, 5);
    const manifest = manifestFor(quiz);
    manifest.coverage.questions.muggle_studies = 624;
    const problems = validateQuizBundle(quiz, manifest);
    expect(problems.some((p) => p.includes('选项数不为 4（实际 5）'))).toBe(
      true,
    );
    expect(problems.some((p) => p.includes('muggle_studies 题数不一致'))).toBe(
      true,
    );
  });

  it('rejects a non-object manifest (version.json assembly impossible)', () => {
    const quiz = goodQuiz();
    const problems = validateQuizBundle(quiz, null);
    expect(problems).toContain('manifest.json 顶层不是 JSON 对象');
  });
});

// ========== Real committed data (integration with the T1 files) ==========

describe('real committed quiz data', () => {
  const realQuiz = JSON.parse(
    readFileSync('public/data/quiz/quiz.json', 'utf8'),
  );
  const realManifest = JSON.parse(
    readFileSync('public/data/quiz/manifest.json', 'utf8'),
  );

  it('passes the structural gates b and c', () => {
    expect(checkQuestionInvariants(realQuiz)).toEqual([]);
    expect(checkCoverageCounts(realQuiz, realManifest)).toEqual([]);
  });

  it('matches the coverage numbers the task book pins', () => {
    expect(realQuiz.schema_version).toBe(2);
    expect(realQuiz.banks.history_of_magic.questions).toHaveLength(1223);
    expect(realQuiz.banks.muggle_studies.questions).toHaveLength(624);
    expect(realManifest.datasets[0]).toEqual({
      id: 'quiz',
      file: 'quiz.json',
      count: 1847,
    });
  });

  it('diffs to an empty set against itself', () => {
    expect(diffQuestionIds(realQuiz, realQuiz)).toEqual({
      added: [],
      removed: [],
    });
  });
});
