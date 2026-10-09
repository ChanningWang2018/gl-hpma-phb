// QuizLocale — UI language layer for the /quiz page (zh | en).
//
// Same shape as codexLocale.js on purpose: a flat zh/en dictionary, no
// vue-i18n. Only the page chrome lives here — data-side bilingual text
// (question/options/explanation) comes from quiz.json itself through
// quizClient's lookupText().
//
// Dictionary keys and zh copy are pinned by docs/quiz.md (T2); en copy is the
// idiomatic counterpart. Both key sets MUST stay identical (guarded by
// tests/unit/quizLocale.test.js so a missing translation cannot slip in).
//
// Resolution/persistence and the dictionary-lookup kernel live in
// siteLocale.js (site-wide locale refactor); this module keeps only the
// dictionary, and translate() delegates to translateMessage with it.
import { translateMessage } from '@/services/siteLocale.js';

/** Supported locales; matches the data's CN-first fallback. */
export const QUIZ_LOCALES = ['zh', 'en'];

/** Exported so tests can assert the zh/en key sets stay in lockstep. */
export const MESSAGES = {
  zh: {
    // 壳（页面头区 / 加载 / 版本徽标）
    note: '全站共 {total} 道课堂问答题：魔法史与麻瓜研究，支持检索与计时挑战。',
    tabBank: '题库检索',
    tabChallenge: '答题挑战',
    languageToggle: '切换到英文',
    loading: '正在翻开课本……',
    loadError: '题库数据加载失败，请稍后重试。',
    retry: '重试',
    versionBadge: '数据 {version} · {total} 题',

    // 检索
    searchLabel: '检索',
    searchPlaceholder: '题干 / 选项 / 讲解关键词',
    bankAll: '全部科目',
    bankHistory: '魔法史',
    bankMuggle: '麻瓜研究',
    hitLine: '命中 {shown} / {total} 题',
    pagePrev: '上一页',
    pageNext: '下一页',
    revealAnswer: '查看答案与讲解',
    hideAnswer: '收起',
    correctLabel: '正确答案',
    explanationLabel: '讲解',
    badgeAdjudicated: '裁决题',
    badgeConflict: '数据冲突',
    badgeUgc: '玩家投稿',
    badgeDuplicate: '重复题',
    adjudicatedNote:
      '该题游戏内判分与本站标答不同（官方录错选项顺序），详见数据集裁决记录。',
    empty: '没有命中的题目——换个关键词试试。',

    // 挑战
    setupTitle: '挑战设置',
    bankLabel: '科目',
    bankMixed: '混合双科',
    countLabel: '题量',
    modeLabel: '模式',
    modeNormal: '普通模式',
    modePrefect: '级长模式',
    prefectBlurb: '只有选项，没有题干——凭题库记忆盲选，作答后揭晓题目。',
    bestLabel: '本地最佳：{grade} · {correct}/{total} · {time}',
    bestEmpty: '尚无记录',
    startChallenge: '开始挑战',
    questionN: '第 {n} / {total} 题',
    prefectRunning: '级长模式：题干已隐藏',
    prefectStemShown: '级长模式：此题题干与其他题重复，题干已直接显示',
    chooseAnswer: '选择答案',
    feedbackCorrect: '回答正确',
    feedbackWrong: '错误，正确答案：{answer}',
    prefectReveal: '题目是：',
    nextQuestion: '下一题',
    finishChallenge: '交卷',
    quitChallenge: '放弃本次',
    resultTitle: 'O.W.L. 成绩单',
    statCorrect: '正确 {correct} / {total}',
    statAccuracy: '正确率 {pct}%',
    statTime: '总用时 {time}',
    statAvg: '平均每题 {time}',
    newRecord: '新纪录！',
    shareCopy: '复制成绩',
    shareCopied: '已复制——去群里晒吧。',
    retryChallenge: '再来一次',
    backToSetup: '调整设置',
    wrongReview: '错题回顾',
    noWrong: '全对，没有错题！',
    owlO: 'O · 杰出',
    owlE: 'E · 良好',
    owlA: 'A · 及格',
    owlP: 'P · 差',
    owlD: 'D · 糟糕',
    owlT: 'T · 巨怪',

    // 分享文本（多行模板）
    shareText:
      '【HPMA 魔法测验】{bank} · {count} 题 · {mode}\n' +
      'O.W.L. 评级：{grade}\n' +
      '正确 {correct}/{total}（{pct}%）· 用时 {time}\n' +
      '你也来试试 → {url}',
  },
  en: {
    // Chrome (masthead / loading / version badge)
    note: 'All {total} in-class quiz questions — History of Magic and Muggle Studies — with search and timed challenges.',
    tabBank: 'Question Bank',
    tabChallenge: 'Challenge',
    languageToggle: 'Switch to Chinese',
    loading: 'Opening the textbook…',
    loadError: 'Failed to load the quiz bank — please try again later.',
    retry: 'Retry',
    versionBadge: 'Data {version} · {total} questions',

    // Bank browser
    searchLabel: 'Search',
    searchPlaceholder: 'Keywords in questions, options or explanations',
    bankAll: 'All subjects',
    bankHistory: 'History of Magic',
    bankMuggle: 'Muggle Studies',
    hitLine: '{shown} / {total} questions',
    pagePrev: 'Previous',
    pageNext: 'Next',
    revealAnswer: 'Show answer & explanation',
    hideAnswer: 'Hide',
    correctLabel: 'Correct answer',
    explanationLabel: 'Explanation',
    badgeAdjudicated: 'Adjudicated',
    badgeConflict: 'Data conflict',
    badgeUgc: 'Player-made',
    badgeDuplicate: 'Duplicate',
    adjudicatedNote:
      "The in-game scoring marks a different option than this site's answer (an official data-entry mistake) — see the dataset's adjudication note for details.",
    empty: 'No matching questions — try another keyword.',

    // Challenge
    setupTitle: 'Challenge setup',
    bankLabel: 'Subject',
    bankMixed: 'Mixed',
    countLabel: 'Questions',
    modeLabel: 'Mode',
    modeNormal: 'Normal mode',
    modePrefect: 'Prefect mode',
    prefectBlurb:
      'Options only, no question stem — answer blind from memory of the bank; the question is revealed once you answer.',
    bestLabel: 'Local best: {grade} · {correct}/{total} · {time}',
    bestEmpty: 'No record yet',
    startChallenge: 'Start challenge',
    questionN: 'Question {n} / {total}',
    prefectRunning: 'Prefect mode: the question is hidden',
    prefectStemShown:
      'Prefect mode: this stem repeats another question — shown directly',
    chooseAnswer: 'Pick an answer',
    feedbackCorrect: 'Correct!',
    feedbackWrong: 'Wrong — the correct answer is {answer}',
    prefectReveal: 'The question was:',
    nextQuestion: 'Next question',
    finishChallenge: 'Submit',
    quitChallenge: 'Quit this run',
    resultTitle: 'O.W.L. Report Card',
    statCorrect: '{correct} / {total} correct',
    statAccuracy: 'Accuracy {pct}%',
    statTime: 'Total time {time}',
    statAvg: 'Average per question {time}',
    newRecord: 'New record!',
    shareCopy: 'Copy result',
    shareCopied: 'Copied — now go show it off.',
    retryChallenge: 'Try again',
    backToSetup: 'Adjust settings',
    wrongReview: 'Wrong-answer review',
    noWrong: 'A perfect score — nothing to review!',
    owlO: 'O · Outstanding',
    owlE: 'E · Exceeds Expectations',
    owlA: 'A · Acceptable',
    owlP: 'P · Poor',
    owlD: 'D · Dreadful',
    owlT: 'T · Troll',

    // Share text (multi-line template)
    shareText:
      'HPMA Quiz — {bank} · {count} questions · {mode}\n' +
      'O.W.L. grade: {grade}\n' +
      '{correct}/{total} correct ({pct}%) · Time {time}\n' +
      'Give it a try → {url}',
  },
};

/** 'en' -> 'en'; anything else -> null (unknown locales are not accepted). */
export function normalizeLocale(value) {
  return QUIZ_LOCALES.includes(value) ? value : null;
}

/**
 * Dictionary lookup with {placeholder} interpolation and zh fallback
 * (missing keys degrade to the zh message, then the key itself).
 */
export function translate(locale, key, params) {
  return translateMessage(MESSAGES, locale, key, params);
}
