import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestionTree, flattenAssessable } from '../src/utils/questionHierarchy.js';
import {
  normalizeAnswerLabel, resolveLabel, buildQuestionIndex, normalizeRawAnswers, matchAnswersToQuestions,
  deriveQuestionStatuses, answersForGrading, assessBookletCompleteness, lexicalOverlap,
  confirmMatch, reassignAnswer, editAnswerText, markUnreadable, flagForReview, chooseAnswerVersion, combineAnswerVersions, setExcluded,
} from '../src/utils/answerMatching.js';
import { runAnswerExtraction, buildAnswerExtractionPrompt } from '../src/utils/answerExtraction.js';

const noSleep = async () => {};

// Stage 1 question model for the healthcare paper (Questions 3 and 4, parts A–C).
const PAPER = flattenAssessable(buildQuestionTree([
  { number: '3', rawLabel: 'QUESTION THREE (3)', marks: 20, subquestions: [
    { label: 'A', text: 'Explain the different levels of healthcare service delivery in Zambia.', marks: 8 },
    { label: 'B', text: 'Discuss challenges in healthcare delivery.', marks: 6 },
    { label: 'C', text: 'Propose solutions to improve equitable access to healthcare in rural areas.', marks: 6 },
  ] },
  { number: '4', rawLabel: 'QUESTION FOUR (4)', marks: 20, subquestions: [
    { label: 'A', text: 'Describe the principles of primary healthcare.', marks: 6 },
    { label: 'B', text: 'Analyse three health financing models such as insurance and user fees.', marks: 8 },
    { label: 'C', text: 'Evaluate community health worker strategies.', marks: 6 },
  ] },
]).tree, { section: 'Section B', sectionType: 'essay' });

const ANS_3A = 'Healthcare delivery in Zambia has levels. Community level with health posts.\n\nPrimary level health centres, secondary level district and general hospitals, and tertiary level referral hospitals such as UTH.';
const ANS_3B = 'Challenges include staff shortages, lack of medicine availability, long distances and poor infrastructure in health facilities.';
const ANS_3C = 'Improve rural access by building more health posts, mobile clinics, training community workers and improving roads to rural areas.';
const ANS_4A = 'Primary healthcare principles are equity, community participation, intersectoral collaboration and appropriate technology.';

const ans = (label, text, extra = {}) => ({ label, text, labelConfidence: 'high', readability: 'readable', startPage: 1, endPage: 1, ...extra });
const match = (answers, questions = PAPER, opts) => matchAnswersToQuestions(normalizeRawAnswers(answers), questions, opts);
const byLabel = (records, q) => records.filter(r => r.questionId === PAPER.find(p => p.number === q).id);
const qid = (n) => PAPER.find(p => p.number === n).id;

const mockVision = (responses) => {
  const calls = [];
  const fn = async (pages, prompt) => {
    calls.push({ pages, prompt });
    const r = responses[calls.length - 1] ?? responses[responses.length - 1];
    if (r instanceof Error) throw r;
    return typeof r === 'string' ? { response: r } : r;
  };
  fn.calls = calls;
  return fn;
};

describe('labels', () => {
  test('variants normalise to one internal format, original kept', () => {
    for (const raw of ['3(a)', '3 (a)', '3A', '3a', 'Q3(a)', 'Question 3A', 'Ans 3a', 'Question three (a)']) {
      assert.equal(normalizeAnswerLabel(raw).normalized, '3.a', raw);
    }
    assert.equal(normalizeAnswerLabel('3(b)(i)').normalized, '3.b.i');
    const [r] = normalizeRawAnswers([ans('Q3(a)', 'x')]);
    assert.equal(r.rawLabel, 'Q3(a)');
    assert.equal(r.normalizedLabel, '3.a');
  });

  test('labels resolve against the hierarchy and never create questions', () => {
    const idx = buildQuestionIndex(PAPER);
    assert.deepEqual(resolveLabel(['3', 'a'], idx), { kind: 'exact', questionId: 'q3_a', candidates: ['q3_a'] });
    assert.equal(resolveLabel(['3'], idx).kind, 'parent');
    assert.equal(resolveLabel(['3', 'a', 'i'], idx).kind, 'deeper');
    assert.equal(resolveLabel(['3', '1'], idx).kind, 'variant');
    assert.equal(resolveLabel(['9', 'a'], idx).kind, 'none');
  });
});

describe('boundaries and matching', () => {
  test('clearly labelled answers -> four distinct records matched by label', () => {
    const recs = match([ans('3(a)', ANS_3A), ans('3(b)', ANS_3B), ans('3(c)', ANS_3C), ans('4(a)', ANS_4A)]);
    assert.equal(recs.length, 4);
    assert.deepEqual(recs.map(r => r.questionId), ['q3_a', 'q3_b', 'q3_c', 'q4_a']);
    assert.ok(recs.every(r => r.matchStatus === 'matched' && r.matchMethod === 'label' && r.matchConfidence === 'high'));
    assert.ok(recs.every(r => !r.needsManualCorrection));
  });

  test('mixed label styles 3(a), 3A and Q3(a) style labels resolve', () => {
    const recs = match([ans('3A', ANS_3A), ans('Q3(b)', ANS_3B), ans('Question 3 (c)', ANS_3C)]);
    assert.deepEqual(recs.map(r => r.questionId), ['q3_a', 'q3_b', 'q3_c']);
  });

  test('a long multi-paragraph answer stays one record and its text is preserved', () => {
    const long = `${ANS_3A}\n\n1. Community level\n2. Primary level\n\nIn conclusion the system is layered.`;
    const recs = match([ans('3(a)', long)]);
    assert.equal(recs.length, 1);
    assert.equal(recs[0].text, long);
  });

  test('multiple answers on one page keep their own regions', () => {
    const recs = match([
      ans('3(a)', ANS_3A, { regions: [{ page: 1, top: 0.05, bottom: 0.4 }] }),
      ans('3(b)', ANS_3B, { regions: [{ page: 1, top: 0.42, bottom: 0.7 }] }),
    ]);
    assert.equal(recs.length, 2);
    assert.deepEqual(recs[1].regions, [{ page: 1, top: 0.42, bottom: 0.7 }]);
  });

  test('answer continuing across pages is joined; next labelled answer stays separate', () => {
    const recs = match([
      ans('3(a)', 'Community level and primary level health centres', { startPage: 1, endPage: 1, continuesOnNextPage: true }),
      ans(null, 'secondary level hospitals and tertiary level referral hospitals.', { startPage: 2, endPage: 2, continuesFromPreviousPage: true, continuationConfidence: 'high' }),
      ans('3(b)', ANS_3B, { startPage: 2, endPage: 2 }),
    ]);
    assert.equal(recs.length, 2);
    assert.equal(recs[0].questionId, 'q3_a');
    assert.deepEqual(recs[0].pages, [1, 2]);
    assert.match(recs[0].text, /primary level health centres\nsecondary level/);
    assert.equal(recs[1].questionId, 'q3_b');
  });

  test('continuation of an earlier (not the last) answer joins the named answer', () => {
    const recs = match([
      ans('3(a)', 'The secondary level includes district hospitals where patients', { startPage: 1 }),
      ans('3(b)', ANS_3B, { startPage: 1 }),
      ans(null, 'are referred to tertiary hospitals.', { startPage: 2, endPage: 2, continuesFromPreviousPage: true, continuesLabel: '3(a)', continuationConfidence: 'high' }),
    ]);
    assert.equal(recs.length, 2);
    assert.match(recs.find(r => r.questionId === 'q3_a').text, /patients\nare referred/);
    assert.equal(recs.find(r => r.questionId === 'q3_b').text, ANS_3B);
  });

  test('uncertain continuation is NOT merged; it is flagged with a suggestion', () => {
    const recs = match([
      ans('3(a)', ANS_3A, { startPage: 1 }),
      ans(null, 'and also referral hospitals.', { startPage: 2, endPage: 2, continuesFromPreviousPage: true, continuationConfidence: 'low' }),
    ]);
    assert.equal(recs.length, 2);
    assert.equal(recs[1].matchStatus, 'suggested');
    assert.equal(recs[1].matchMethod, 'continuation');
    assert.ok(recs[1].needsManualCorrection);
  });

  test('unlabelled answer is preserved, suggested from content with a reason, never auto-assigned', () => {
    const recs = match([ans('3(a)', ANS_3A), ans(null, ANS_3C, { suggestedQuestion: '3(c)', suggestionReason: 'discusses improving rural access' })]);
    const u = recs[1];
    assert.equal(u.rawLabel, null);
    assert.equal(u.questionId, 'q3_c');
    assert.equal(u.matchStatus, 'suggested');
    assert.ok(u.matchReasons.some(m => /No question number.*rural access/.test(m)));
    // Not graded until confirmed.
    assert.equal(answersForGrading(PAPER, recs, { complete: true }).find(g => g.questionId === 'q3_c').autoGradable, false);
  });

  test('unlabelled answer: lexical heuristic suggests when content is distinctive', () => {
    const recs = match([ans(null, 'Financing models: national health insurance, user fees at the facility, and donor funding models with insurance pooling.')]);
    assert.equal(recs[0].questionId, 'q4_b');
    assert.equal(recs[0].matchStatus, 'suggested');
    assert.equal(recs[0].matchConfidence, 'low');
  });

  test('unlabelled answer with no clear content match stays unmatched (not "next unanswered question")', () => {
    const recs = match([ans('3(a)', ANS_3A), ans(null, 'I am not sure about this one.')]);
    assert.equal(recs[1].matchStatus, 'unmatched');
    assert.equal(recs[1].questionId, null);
    assert.equal(recs.length, 2);
  });

  test('ambiguous handwritten label (3 vs 8) is flagged, not silently assigned', () => {
    const recs = match([ans('8(b)', ANS_3B, { labelConfidence: 'low', labelAlternatives: ['3(b)'] })]);
    assert.equal(recs[0].matchStatus, 'needs_review');
    assert.equal(recs[0].questionId, 'q3_b'); // proposal only
    assert.ok(recs[0].matchReasons.some(m => /not a question on this paper/.test(m)));
    assert.equal(answersForGrading(PAPER, recs).find(g => g.questionId === 'q3_b').autoGradable, false);
  });

  test('low-confidence label that resolves but has a plausible alternative is flagged', () => {
    const recs = match([ans('3(a)', ANS_3A, { labelConfidence: 'low' })]); // "3" could be "8" (no Q8) or "5" (no Q5); B? -> 3B? no
    assert.equal(recs[0].matchStatus, 'needs_review');
    const alt = match([ans('3(b)', ANS_3B, { labelConfidence: 'low', labelAlternatives: ['4(b)'] })]);
    assert.deepEqual(alt[0].candidateQuestionIds, ['q3_b', 'q4_b']);
  });

  test('content conflicting with label keeps the label but flags review', () => {
    const recs = match([ans('3(a)', 'Financing models include health insurance schemes, user fees paid at facilities and tax based financing models for health.')]);
    const r = recs[0];
    assert.equal(r.questionId, 'q3_a');
    assert.equal(r.matchStatus, 'needs_review');
    assert.equal(r.suggestedQuestionId, 'q4_b');
    const modelFlag = match([ans('3(b)', ANS_3B, { contentMatchesLabel: false })]);
    assert.equal(modelFlag[0].matchStatus, 'needs_review');
  });

  test('clear label is not overridden when another question is only semantically similar', () => {
    // 3C's content overlaps 3B somewhat (rural, health) but label is explicit and consistent enough.
    const recs = match([ans('3(c)', ANS_3C)]);
    assert.equal(recs[0].questionId, 'q3_c');
    assert.equal(recs[0].matchStatus, 'matched');
  });

  test('answers written out of order are matched by label, not by position', () => {
    const recs = match([ans('4(a)', ANS_4A), ans('3(c)', ANS_3C), ans('3(a)', ANS_3A)]);
    assert.deepEqual(recs.map(r => r.questionId), ['q4_a', 'q3_c', 'q3_a']);
  });

  test('label "3" for a question with parts asks which part', () => {
    const recs = match([ans('3', 'Something short')]);
    assert.equal(recs[0].matchStatus, 'needs_review');
    assert.deepEqual(recs[0].candidateQuestionIds, ['q3_a', 'q3_b', 'q3_c']);
  });
});

describe('corrections and repeated answers', () => {
  test('crossed-out answer is preserved but excluded; the correction is graded', () => {
    const recs = match([ans('3(a)', 'Wrong first attempt about something', { crossedOut: true }), ans('3(a)', ANS_3A)]);
    assert.equal(recs.length, 2);
    assert.equal(recs[0].excluded, true);
    assert.equal(recs[1].duplicateConflict, false);
    const g = answersForGrading(PAPER, recs, { complete: true }).find(x => x.questionId === 'q3_a');
    assert.equal(g.text, ANS_3A);
  });

  test('only crossed-out work is not reported as "no answer"', () => {
    const recs = match([ans('3(a)', ANS_3A, { crossedOut: true })]);
    assert.equal(deriveQuestionStatuses(PAPER, recs, { complete: true }).q3_a.status, 'crossed_out_only');
  });

  test('same question answered twice is flagged; no version is silently dropped', () => {
    const recs = match([ans('3(b)', ANS_3B, { startPage: 1 }), ans('3(b)', 'Second attempt: shortage of nurses and drugs.', { startPage: 3, endPage: 3 })]);
    assert.ok(recs.every(r => r.duplicateConflict));
    assert.equal(deriveQuestionStatuses(PAPER, recs, { complete: true }).q3_b.status, 'multiple_answers');
    assert.equal(answersForGrading(PAPER, recs).find(g => g.questionId === 'q3_b').autoGradable, false);
    const chosen = chooseAnswerVersion(recs, recs[1].id);
    assert.equal(chosen.find(r => r.id === recs[0].id).excluded, true);
    assert.equal(answersForGrading(PAPER, chosen, { complete: true }).find(g => g.questionId === 'q3_b').text, 'Second attempt: shortage of nurses and drugs.');
    const combined = combineAnswerVersions(recs, 'q3_b');
    assert.match(answersForGrading(PAPER, combined, { complete: true }).find(g => g.questionId === 'q3_b').text, /staff shortages[\s\S]*Second attempt/);
  });
});

describe('missing vs unreadable vs incomplete', () => {
  test('question with no response in a complete booklet -> "no response detected"', () => {
    const recs = match([ans('3(a)', ANS_3A), ans('3(b)', ANS_3B), ans('3(c)', ANS_3C)]);
    const st = deriveQuestionStatuses(PAPER, recs, { complete: true });
    assert.equal(st.q4_a.status, 'no_answer_detected');
    assert.equal(st.q3_a.status, 'answered');
  });

  test('missing page -> uncertain "not found", never "unanswered"', () => {
    const recs = match([ans('3(a)', ANS_3A)]);
    const c = assessBookletCompleteness({ pageCount: 2, expectedPages: 3, failedPages: [], printedPageNumbers: [1, 3], records: recs });
    assert.equal(c.complete, false);
    assert.equal(c.reasons.length, 2);
    assert.equal(deriveQuestionStatuses(PAPER, recs, { complete: c.complete }).q4_a.status, 'not_found_incomplete');
  });

  test('an unmatched answer means other blank questions are uncertain', () => {
    const recs = match([ans(null, 'I am not sure about this one.')]);
    assert.equal(deriveQuestionStatuses(PAPER, recs, { complete: true }).q4_c.status, 'not_found_incomplete');
  });

  test('readable / partly unreadable / unreadable are distinct', () => {
    const recs = match([
      ans('3(a)', ANS_3A),
      ans('3(b)', 'Staff [illegible] and medicine'),
      ans('3(c)', '', { readability: 'unreadable' }),
    ]);
    const st = deriveQuestionStatuses(PAPER, recs, { complete: true });
    assert.equal(st.q3_a.status, 'answered');
    assert.equal(st.q3_b.status, 'answered_partial');
    assert.equal(st.q3_c.status, 'unreadable');
    assert.equal(answersForGrading(PAPER, recs).find(g => g.questionId === 'q3_c').autoGradable, false);
  });

  test('answer continuing past the last page marks the booklet incomplete', () => {
    const recs = match([ans('4(a)', ANS_4A, { startPage: 2, endPage: 2, continuesOnNextPage: true })]);
    assert.equal(assessBookletCompleteness({ pageCount: 2, records: recs }).complete, false);
  });
});

describe('review corrections feed the next stage', () => {
  test('fixing a wrong match changes what gets graded', () => {
    // Student wrote 3(a) but it's actually the 4(b) answer: conflict is flagged.
    let recs = match([ans('3(a)', 'Financing models include health insurance schemes, user fees paid at facilities and tax based financing models for health.')]);
    assert.equal(recs[0].matchStatus, 'needs_review');
    recs = reassignAnswer(recs, recs[0].id, 'q4_b', '4B');
    assert.equal(recs[0].matchStatus, 'confirmed');
    assert.equal(recs[0].matchMethod, 'manual');
    const grading = answersForGrading(PAPER, recs, { complete: true });
    assert.equal(grading.find(g => g.questionId === 'q4_b').autoGradable, true);
    assert.match(grading.find(g => g.questionId === 'q4_b').text, /Financing models/);
    assert.equal(grading.find(g => g.questionId === 'q3_a').autoGradable, false);
    // Correction survives serialization (navigation params / scan storage).
    const restored = JSON.parse(JSON.stringify(recs));
    assert.equal(answersForGrading(PAPER, restored, { complete: true }).find(g => g.questionId === 'q4_b').autoGradable, true);
  });

  test('confirm, edit text, mark unreadable, flag, include crossed-out', () => {
    let recs = match([ans(null, ANS_3C, { suggestedQuestion: '3C' }), ans('3(a)', ANS_3A, { crossedOut: true })]);
    assert.equal(recs[0].questionId, 'q3_c');
    recs = confirmMatch(recs, recs[0].id);
    assert.equal(recs[0].matchStatus, 'confirmed');
    recs = editAnswerText(recs, recs[0].id, 'Build more rural health posts.');
    assert.equal(answersForGrading(PAPER, recs, { complete: true }).find(g => g.questionId === 'q3_c').text, 'Build more rural health posts.');
    recs = markUnreadable(recs, recs[0].id);
    assert.equal(deriveQuestionStatuses(PAPER, recs, { complete: true }).q3_c.status, 'unreadable');
    recs = markUnreadable(recs, recs[0].id, false);
    recs = flagForReview(recs, recs[0].id);
    assert.equal(answersForGrading(PAPER, recs).find(g => g.questionId === 'q3_c').autoGradable, false);
    recs = setExcluded(recs, recs[1].id, false);
    recs = confirmMatch(recs, recs[1].id);
    assert.equal(answersForGrading(PAPER, recs, { complete: true }).find(g => g.questionId === 'q3_a').autoGradable, true);
  });
});

describe('extraction pipeline', () => {
  const page = (answers, extra = {}) => JSON.stringify({ pages: [{ image: 1, quality: 'good' }], answers, ...extra });

  test('prompt forbids grading, renumbering and order-based labelling', () => {
    const p = buildAnswerExtractionPrompt({ questions: PAPER, pageNumbers: [1, 2], totalPages: 2 });
    assert.match(p, /Do NOT grade/);
    assert.match(p, /do not infer labels from the order/);
    assert.match(p, /3A \(8 marks\)/);
  });

  test('clearly labelled booklet end-to-end', async () => {
    const vision = mockVision([page([ans('3(a)', ANS_3A), ans('3(b)', ANS_3B), ans('3(c)', ANS_3C), ans('4(a)', ANS_4A)])]);
    const r = await runAnswerExtraction({ pageCount: 1, questions: PAPER, callVision: vision, sectionLabel: 'B', sleep: noSleep });
    assert.equal(r.status, 'success');
    assert.equal(r.records.length, 4);
    assert.ok(r.records[0].id.startsWith('sb_'));
    assert.equal(r.questionStatuses.q4_b.status, 'no_answer_detected');
  });

  test('continuation across request batches is joined using page order', async () => {
    const vision = mockVision([
      page([ans('3(a)', 'Community level and primary level', { startPage: 1, endPage: 1, continuesOnNextPage: true })]),
      page([ans(null, 'secondary and tertiary hospitals.', { startPage: 2, endPage: 2, continuesFromPreviousPage: true, continuationConfidence: 'medium' }), ans('3(b)', ANS_3B, { startPage: 2 })]),
    ]);
    const r = await runAnswerExtraction({ pageCount: 2, questions: PAPER, callVision: vision, maxPagesPerRequest: 1, sleep: noSleep });
    assert.match(vision.calls[1].prompt, /answer labelled "3\(a\)"/);
    assert.equal(r.records.length, 2);
    assert.deepEqual(r.records[0].pages, [1, 2]);
  });

  test('network failure is retried; OCR failure on one batch keeps the other answers', async () => {
    const vision = mockVision([
      new Error('Network request failed'),
      page([ans('3(a)', ANS_3A, { startPage: 1 })]),
      { response: '', error: 'API error 503: overloaded' },
      { response: '', error: 'API error 503: overloaded' },
    ]);
    const r = await runAnswerExtraction({ pageCount: 2, questions: PAPER, callVision: vision, maxPagesPerRequest: 1, sleep: noSleep });
    assert.equal(r.status, 'partial');
    assert.equal(r.records.length, 1);
    assert.deepEqual(r.failedPages, [2]);
    assert.equal(r.completeness.complete, false);
    assert.equal(r.questionStatuses.q4_a.status, 'not_found_incomplete'); // not "unanswered", not zero
  });

  test('total failure -> extraction_failed statuses, no records invented', async () => {
    const vision = mockVision([{ response: '', error: 'API error 401: bad key' }]);
    const r = await runAnswerExtraction({ pageCount: 1, questions: PAPER, callVision: vision, sleep: noSleep });
    assert.equal(r.status, 'error');
    assert.equal(r.records.length, 0);
    assert.equal(r.questionStatuses.q3_a.status, 'extraction_failed');
    assert.equal(vision.calls.length, 1);
  });

  test('malformed then empty output is retried; empty twice fails clearly', async () => {
    const ok = await runAnswerExtraction({ pageCount: 1, questions: PAPER, callVision: mockVision(['```json\n{"answers": [{"label": "3(a)", "text": "x",},]}\n```']), sleep: noSleep });
    assert.equal(ok.records.length, 1);
    const bad = await runAnswerExtraction({ pageCount: 1, questions: PAPER, callVision: mockVision(['', '']), sleep: noSleep });
    assert.equal(bad.status, 'error');
    assert.match(bad.error, /Could not read the AI response/);
  });

  test('duplicate records from the model are kept and flagged', async () => {
    const vision = mockVision([page([ans('3(a)', ANS_3A), ans('3(a)', ANS_3A, { startPage: 1 })])]);
    const r = await runAnswerExtraction({ pageCount: 1, questions: PAPER, callVision: vision, sleep: noSleep });
    assert.equal(r.records.length, 2);
    assert.ok(r.records.every(x => x.duplicateConflict));
  });

  test('blank booklet is reported, not treated as an error', async () => {
    const r = await runAnswerExtraction({ pageCount: 1, questions: PAPER, callVision: mockVision([page([])]), sleep: noSleep });
    assert.equal(r.status, 'success');
    assert.ok(r.issues.some(i => i.code === 'no_answers'));
  });
});

test('lexical overlap heuristic', () => {
  assert.ok(lexicalOverlap(ANS_3C, PAPER[2].ownText) > lexicalOverlap(ANS_3C, PAPER[4].ownText));
  assert.equal(lexicalOverlap('', PAPER[0].ownText), 0);
});

test('works with simple numbered questions (no Stage 1 hierarchy)', () => {
  const simple = [{ number: 1, text: 'Define osmosis.' }, { number: 2, text: 'Define diffusion.' }];
  const recs = match([ans('2', 'Diffusion is movement of particles'), ans('Q1', 'Osmosis is water movement')], simple);
  assert.deepEqual(recs.map(r => r.questionId), ['q2', 'q1']);
});
