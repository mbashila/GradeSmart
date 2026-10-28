// SIMULATED TEST DATA ONLY — the questions, student answers and AI replies below are fixtures
// written for these tests. They are not real student results.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestionTree, flattenAssessable } from '../src/utils/questionHierarchy.js';
import { normalizeRawAnswers, matchAnswersToQuestions, reassignAnswer } from '../src/utils/answerMatching.js';
import {
  createGradingResult, computeTotals, validateResult, resultStatus, setItemMarks, setItemMaxMarks, confirmItemMark,
  setFeedbackStatus, acknowledgeIssue, finalizeResult, reopenResult, updateSectionAnswers, applyGradingOutcome,
  detectCommandVerb, detectRequestedPoints, parseOptionalRule, GRADING_STATUS, toGradingResultsList,
} from '../src/utils/gradingModel.js';
import { buildGradingPrompt, parseGradingResponse, gradeResultItems, criteriaKey } from '../src/utils/rubricGrading.js';
import { upsertScan } from '../src/utils/scanStore.js';

const noSleep = async () => {};

const TREE = buildQuestionTree([
  { number: '3', rawLabel: 'QUESTION THREE (3)', text: 'Healthcare delivery in Zambia.', marks: 20, subquestions: [
    { label: 'A', text: 'Explain the different levels of healthcare service delivery in Zambia.', marks: 8 },
    { label: 'B', text: 'Discuss challenges in healthcare delivery.', marks: 6 },
    { label: 'C', text: 'Propose solutions to improve equitable access to healthcare in rural areas.', marks: 6 },
  ] },
  { number: '4', rawLabel: 'QUESTION FOUR (4)', marks: 20, subquestions: [
    { label: 'A', text: 'Describe the principles of primary healthcare.', marks: 6 },
    { label: 'B', text: 'Analyse three health financing models.', marks: 8 },
    { label: 'C', text: 'Evaluate community health worker strategies.', marks: 6 },
  ] },
]).tree;
const QUESTIONS = flattenAssessable(TREE, { section: 'Section B', sectionType: 'essay' });

const A = {
  q3a: 'Zambia has community level health posts, primary level health centres, secondary level district hospitals and tertiary referral hospitals such as UTH. Patients are referred upwards when care is not available.',
  q3b: 'Challenges include shortage of health staff, lack of medicines and long distances to facilities.',
  q3c: 'Build more rural health posts, use mobile clinics and improve roads.',
  q4a: 'Principles are equity, community participation, intersectoral collaboration and appropriate technology.',
  q4b: 'Financing models: national health insurance, user fees and tax-based funding.',
  q4c: 'Community health workers extend services to villages but need training and pay.',
};
const ans = (label, text, extra = {}) => ({ label, text, labelConfidence: 'high', readability: 'readable', startPage: 1, endPage: 1, ...extra });
const allAnswers = () => [ans('3(a)', A.q3a), ans('3(b)', A.q3b), ans('3(c)', A.q3c), ans('4(a)', A.q4a), ans('4(b)', A.q4b), ans('4(c)', A.q4c)];

function makeResult({ answers = allAnswers(), complete = true, instructions = [], questions = QUESTIONS, tree = TREE } = {}) {
  const records = matchAnswersToQuestions(normalizeRawAnswers(answers, { idPrefix: 'sb_' }), questions);
  return createGradingResult({ id: 'gr_test', sections: [{ key: 's0', label: 'B', type: 'essay', questions, questionTree: tree, instructions, records, complete }] });
}

/** Simulated grader: returns `score(item)` for each item id found in the prompt. */
function fakeGrader(score = () => 4, extra = {}) {
  const calls = [];
  const fn = async (prompt) => {
    calls.push(prompt);
    const ids = [...prompt.matchAll(/=== ITEM (\S+) ===/g)].map(m => m[1]);
    return { response: JSON.stringify({ results: ids.map(id => ({ id, criteria: [{ point: 'Relevant point', marks: 8 }], awarded: score(id), rationale: `Simulated rationale for ${id}.`, strengths: ['s'], missing: ['m'], improvement: 'i', confidence: 'high', ...extra })) }) };
  };
  fn.calls = calls;
  return fn;
}
const item = (r, n) => r.items.find(i => i.number === n);

describe('grading at the correct hierarchy level', () => {
  test('each subquestion is graded against its own text and max marks; parent text is context only', () => {
    const r = makeResult();
    const a = item(r, '3A');
    assert.equal(a.questionText, 'Explain the different levels of healthcare service delivery in Zambia.');
    assert.equal(a.parentContext, 'Healthcare delivery in Zambia.');
    assert.equal(a.maxMarks, 8);
    const prompt = buildGradingPrompt([a]);
    assert.match(prompt, /Question to grade against:\nExplain the different levels/);
    assert.match(prompt, /Topic context from the parent question \(use only to understand the topic; do NOT grade against it\):\nHealthcare delivery in Zambia\./);
    assert.match(prompt, /Maximum marks: 8/);
    assert.match(prompt, /Task word: explain — Give each point AND why or how/);
  });

  test('correctly matched answers are graded; totals come from leaves only (no parent double count)', async () => {
    const r0 = makeResult();
    const { result } = await gradeResultItems(r0, { callText: fakeGrader(id => (id.endsWith('q3_a') ? 6 : 4)) });
    const t = computeTotals(result);
    assert.equal(t.available, 40); // 2 × 20, not 80
    assert.equal(t.awarded, 6 + 5 * 4);
    assert.equal(t.percentage, 65);
    const q3 = t.groups.find(g => g.number === '3');
    assert.deepEqual({ awarded: q3.awarded, available: q3.available, declared: q3.declared }, { awarded: 14, available: 20, declared: 20 });
    assert.equal(resultStatus(result), 'graded'); // unreviewed AI feedback is a warning, not a blocker
    assert.ok(validateResult(result).warnings.some(w => w.code === 'feedback_unreviewed'));
  });

  test('nested subquestions are separate items grouped under the top-level question', () => {
    const tree = buildQuestionTree([{ number: '2', marks: 10, text: 'Osmosis', subquestions: [
      { label: '(a)', text: 'Define osmosis.', subquestions: [{ label: '(i)', text: 'Give one example in plants.', marks: 2 }, { label: '(ii)', text: 'Give one example in animals.', marks: 2 }] },
      { label: '(b)', text: 'Explain why plant cells do not burst.', marks: 6 },
    ] }]).tree;
    const qs = flattenAssessable(tree);
    const r = makeResult({ questions: qs, tree, answers: [ans('2(a)(i)', 'Root hair cells absorb water.'), ans('2(a)(ii)', 'Kidney tubules.'), ans('2(b)', 'The cell wall resists pressure.')] });
    assert.deepEqual(r.items.map(i => i.number), ['2(a)(i)', '2(a)(ii)', '2(b)']);
    assert.ok(r.items.every(i => i.topLevelNumber === '2'));
    const t = computeTotals(r);
    assert.equal(t.groups.length, 1);
    assert.equal(t.available, 10);
  });
});

describe('marks validation', () => {
  test('AI mark above the maximum is not capped — it is held for review', () => {
    let r = makeResult();
    r = applyGradingOutcome(r, item(r, '3A').id, { awarded: 10, confidence: 'high', rationale: 'x' });
    const a = item(r, '3A');
    assert.equal(a.awarded, null);
    assert.equal(a.proposedAwarded, 10);
    assert.equal(a.gradingStatus, GRADING_STATUS.NEEDS_REVIEW);
    assert.ok(a.flags.some(f => f.code === 'ai_score_out_of_range'));
    assert.throws(() => setItemMarks(r, a.id, 9, 'typo'), /between 0 and 8/);
    assert.throws(() => setItemMarks(r, a.id, -1, 'x'), /between 0 and 8/);
  });

  test('parent total inconsistent with its parts is flagged and blocks finalization', () => {
    const tree = buildQuestionTree([{ number: '3', marks: 20, subquestions: [
      { label: 'A', text: 'Explain levels.', marks: 8 }, { label: 'B', text: 'Discuss challenges.', marks: 6 }, { label: 'C', text: 'Propose solutions.', marks: 5 },
    ] }]).tree;
    const qs = flattenAssessable(tree);
    const r = makeResult({ questions: qs, tree, answers: [ans('3(a)', 'a'), ans('3(b)', 'b'), ans('3(c)', 'c')] });
    const t = computeTotals(r);
    assert.equal(t.available, 19); // parts, not the stated 20, and never 39
    assert.ok(t.issues.some(i => i.code === 'parent_total_mismatch'));
  });

  test('missing maximum marks are flagged, never invented', () => {
    const qs = [{ number: 1, text: 'Explain photosynthesis.', maxPoints: 0 }];
    const r = makeResult({ questions: qs, tree: [], answers: [ans('1', 'Plants make food using light.')] });
    assert.equal(r.items[0].maxMarks, null);
    assert.equal(r.items[0].gradingStatus, GRADING_STATUS.UNRESOLVED);
    assert.equal(computeTotals(r).percentage, null);
    assert.ok(validateResult(r).blocking.some(b => b.code === 'total_unknown'));
    const fixed = setItemMaxMarks(r, r.items[0].id, 5);
    assert.equal(fixed.items[0].gradingStatus, GRADING_STATUS.NOT_STARTED);
  });
});

describe('uncertain sources are never zero by default', () => {
  test('unreadable response -> unresolved, no mark, provisional total', () => {
    const answers = allAnswers();
    answers[1] = ans('3(b)', '', { readability: 'unreadable' });
    const r = makeResult({ answers });
    const b = item(r, '3B');
    assert.equal(b.gradingStatus, GRADING_STATUS.UNRESOLVED);
    assert.equal(b.awarded, null);
    assert.equal(b.extractionStatus, 'unreadable');
    assert.equal(computeTotals(r).provisional, true);
  });

  test('partially readable answer is graded but needs confirmation', async () => {
    const answers = allAnswers();
    answers[0] = ans('3(a)', 'Community level, [illegible] level and tertiary hospitals.');
    const { result } = await gradeResultItems(makeResult({ answers }), { callText: fakeGrader(() => 5) });
    const a = item(result, '3A');
    assert.equal(a.gradingStatus, GRADING_STATUS.NEEDS_REVIEW);
    assert.equal(a.awarded, 5);
    assert.ok(a.flags.some(f => f.code === 'partial_text'));
    assert.match(buildGradingPrompt([a]), /Do NOT treat illegible words as wrong/);
  });

  test('missing answer in a complete booklet -> blank (0, defensible); incomplete booklet -> unresolved', () => {
    const answers = allAnswers().filter(a => a.label !== '4(c)');
    const complete = makeResult({ answers });
    assert.equal(item(complete, '4C').gradingStatus, GRADING_STATUS.BLANK);
    assert.equal(item(complete, '4C').awarded, 0);
    const incomplete = makeResult({ answers, complete: false });
    assert.equal(item(incomplete, '4C').gradingStatus, GRADING_STATUS.UNRESOLVED);
    assert.equal(item(incomplete, '4C').awarded, null);
    assert.ok(validateResult(incomplete).blocking.some(b => b.code === 'incomplete_source'));
  });

  test('unconfirmed (suggested) association is not graded', () => {
    const answers = allAnswers();
    answers[2] = ans(null, A.q3c, { suggestedQuestion: '3(c)' });
    const r = makeResult({ answers });
    assert.equal(item(r, '3C').gradingStatus, GRADING_STATUS.UNRESOLVED);
    assert.equal(item(r, '3C').matchStatus, 'uncertain');
  });
});

describe('failures and recovery', () => {
  test('AI request failure marks items failed (not zero); retry grades only failed items', async () => {
    const down = async () => ({ response: '', error: 'API error 503: overloaded' });
    const first = await gradeResultItems(makeResult(), { callText: down, friendlyError: () => 'The AI service is busy. Try again.' });
    assert.equal(first.failed, 6);
    assert.ok(first.result.items.every(i => i.gradingStatus === GRADING_STATUS.FAILED && i.awarded === null));
    assert.equal(first.result.items[0].failureReason, 'The AI service is busy. Try again.');
    assert.equal(resultStatus(first.result), 'failed');
    const grader = fakeGrader(() => 3);
    const second = await gradeResultItems(first.result, { callText: grader });
    assert.equal(second.graded, 6);
    assert.ok(second.result.items.every(i => i.awarded === 3));
  });

  test('partial grading: an item missing from the AI reply is retried alone; still missing -> failed', async () => {
    let n = 0;
    const flaky = async (prompt) => {
      n++;
      const ids = [...prompt.matchAll(/=== ITEM (\S+) ===/g)].map(m => m[1]).filter(id => !id.endsWith('q4_c'));
      return { response: JSON.stringify({ results: ids.map(id => ({ id, awarded: 2, rationale: 'r', confidence: 'high' })) }) };
    };
    const { result, failed } = await gradeResultItems(makeResult(), { callText: flaky, sleep: noSleep });
    assert.equal(failed, 1);
    assert.equal(item(result, '4C').gradingStatus, GRADING_STATUS.FAILED);
    assert.equal(item(result, '3A').awarded, 2);
    // Recovery: only 4C is sent next time.
    const grader = fakeGrader(() => 1);
    const rec = await gradeResultItems(result, { callText: grader });
    assert.equal(grader.calls.length, 1);
    assert.deepEqual([...grader.calls[0].matchAll(/=== ITEM (\S+) ===/g)].map(m => m[1]), [item(result, '4C').id]);
    assert.equal(item(rec.result, '4C').awarded, 1);
    assert.ok(n >= 2);
  });

  test('malformed / duplicate / unknown results are handled', () => {
    const r = makeResult();
    const items = r.items.slice(0, 2);
    const raw = '```json\n{"results":[{"id":"' + items[0].id + '","awarded":3,"rationale":"a","confidence":"high"},{"id":"' + items[0].id + '","awarded":8,"rationale":"dup"},{"id":"nope","awarded":1}],}\n```';
    const { outcomes, problems } = parseGradingResponse(raw, items);
    assert.equal(outcomes[items[0].id].awarded, 3);
    assert.equal(outcomes[items[1].id], undefined);
    assert.equal(problems.length, 2);
  });

  test('missing confidence or rationale forces review', async () => {
    const { result } = await gradeResultItems(makeResult(), { callText: fakeGrader(() => 4, { confidence: undefined }) });
    assert.ok(result.items.filter(i => i.gradingStatus === GRADING_STATUS.NEEDS_REVIEW).length === 6);
  });
});

describe('moderation', () => {
  test('editing marks recalculates totals, requires a reason, and keeps history', async () => {
    let { result } = await gradeResultItems(makeResult(), { callText: fakeGrader(() => 4) });
    const id = item(result, '3A').id;
    assert.throws(() => setItemMarks(result, id, 7), /reason/);
    result = setItemMarks(result, id, 7, 'Student explained referral clearly', 'user-1');
    assert.equal(computeTotals(result).awarded, 7 + 5 * 4);
    const h = item(result, '3A').history;
    assert.deepEqual(h.slice(-2).map(x => [x.action, x.from, x.to]), [['ai_graded', null, 4], ['mark_set', 4, 7]]);
    assert.equal(result.audit.at(-1).by, 'user-1');
    result = confirmItemMark(result, item(result, '3B').id);
    result = setFeedbackStatus(result, item(result, '3C').id, 'rejected');
    assert.equal(item(result, '3C').feedbackStatus, 'rejected');
  });

  test('correcting an answer association regrades only the affected items', async () => {
    // Student labelled the 4(b) answer as 4(c) and vice versa for 4(c): simulate one wrong label.
    const answers = allAnswers().filter(a => a.label !== '4(b)');
    answers.push(ans('4(c)', A.q4b, { startPage: 2, endPage: 2 })); // duplicate label: wrong subquestion
    let r = makeResult({ answers });
    assert.equal(item(r, '4C').gradingStatus, GRADING_STATUS.UNRESOLVED); // answered twice
    let { result } = await gradeResultItems(r, { callText: fakeGrader(() => 4) });
    const sec = result.sections[0];
    const wrong = sec.answers.find(a => a.text === A.q4b);
    const fixedRecords = reassignAnswer(sec.answers, wrong.id, 'q4_b', '4B');
    const upd = updateSectionAnswers(result, 's0', fixedRecords, 'user-1');
    assert.deepEqual(upd.changedItemIds.sort(), ['s0:q4_b', 's0:q4_c']);
    const grader = fakeGrader(() => 5);
    const after = await gradeResultItems(upd.result, { callText: grader, ids: upd.changedItemIds });
    const sent = [...grader.calls.join('\n').matchAll(/=== ITEM (\S+) ===/g)].map(m => m[1]).sort();
    assert.deepEqual(sent, ['s0:q4_b', 's0:q4_c']);
    assert.equal(item(after.result, '4B').awarded, 5);
    assert.equal(item(after.result, '3A').awarded, 4); // untouched
    assert.match(item(after.result, '4B').answerText, /Financing models/);
  });
});

describe('optional questions', () => {
  test('instruction parsing', () => {
    assert.deepEqual(parseOptionalRule(['Answer any THREE (3) questions']), { choose: 3, complex: false, text: 'Answer any THREE (3) questions' });
    assert.equal(parseOptionalRule(['Answer ALL questions']), null);
    assert.equal(parseOptionalRule(['Question one is compulsory. Answer any two other questions'])?.complex, true);
  });

  test('"answer any one": one attempted counts 20 available; both attempted counts the best one, flagged', async () => {
    const only3 = makeResult({ answers: allAnswers().slice(0, 3), instructions: ['Answer any ONE question.'] });
    let t = computeTotals(only3);
    assert.equal(t.available, 20);
    assert.equal(t.groups.find(g => g.number === '4').counted, false);

    const { result } = await gradeResultItems(makeResult({ instructions: ['Answer any ONE question.'] }), { callText: fakeGrader(id => (id.includes('q4') ? 5 : 2)) });
    t = computeTotals(result);
    assert.equal(t.available, 20);
    assert.equal(t.awarded, 15); // Q4 (5+5+5) counted, Q3 not
    assert.ok(t.issues.some(i => i.code === 'optional_extra_answered'));
    assert.equal(validateResult(result).ok, false);
  });
});

describe('finalization and persistence', () => {
  test('cannot finalize with unresolved items; can after resolving; edits blocked until reopened', async () => {
    const answers = allAnswers();
    answers[1] = ans('3(b)', '', { readability: 'unreadable' });
    let { result } = await gradeResultItems(makeResult({ answers }), { callText: fakeGrader(() => 4) });
    assert.throws(() => finalizeResult(result), (e) => e.validation.blocking.some(b => b.itemId === item(result, '3B').id));
    result = setItemMarks(result, item(result, '3B').id, 3, 'Read from the page by teacher');
    const v = validateResult(result);
    assert.equal(v.ok, true, JSON.stringify(v.blocking));
    result = finalizeResult(result, 'user-1');
    assert.equal(resultStatus(result), 'finalized');
    assert.throws(() => setItemMarks(result, item(result, '3A').id, 5, 'x'), /finalized/);
    assert.throws(() => reopenResult(result, ''), /reason/);
    result = reopenResult(result, 'Moderator query', 'user-2');
    assert.equal(result.finalized, false);
    assert.deepEqual(result.audit.slice(-2).map(a => a.action), ['finalized', 'reopened']);
  });

  test('incomplete booklet can be finalized only after explicit acknowledgement', async () => {
    let { result } = await gradeResultItems(makeResult({ complete: false }), { callText: fakeGrader(() => 4) });
    assert.ok(validateResult(result).blocking.some(b => b.code === 'incomplete_source'));
    result = acknowledgeIssue(result, 'incomplete:s0', 'All pages present on inspection');
    assert.equal(validateResult(result).ok, true);
  });

  test('reopening a saved result: JSON round trip preserves marks, statuses, history and totals', async () => {
    let { result } = await gradeResultItems(makeResult(), { callText: fakeGrader(() => 4) });
    result = setItemMarks(result, item(result, '3A').id, 6, 'Good examples');
    const saved = JSON.parse(JSON.stringify({ id: result.id, gradingResult: result, gradingResults: toGradingResultsList(result) }));
    assert.deepEqual(computeTotals(saved.gradingResult), computeTotals(result));
    assert.equal(item(saved.gradingResult, '3A').history.length, 2);
    assert.equal(saved.gradingResults.find(r => r.question === '3A').points, 6);
  });

  test('saving twice (retry after a sync failure) does not duplicate the record', () => {
    let scans = [{ id: 'other', studentName: 'Ann' }];
    scans = upsertScan(scans, { id: 'gr_test', studentName: 'Bo', score: 20 });
    scans = upsertScan(scans, { id: 'gr_test', studentName: 'Bo', score: 22 });
    assert.equal(scans.length, 2);
    assert.equal(scans.find(s => s.id === 'gr_test').score, 22);
  });
});

describe('rubric criteria', () => {
  test('command verbs and requested points', () => {
    assert.equal(detectCommandVerb('Define osmosis.').verb, 'define');
    assert.equal(detectCommandVerb('Discuss the challenges.').verb, 'discuss');
    assert.equal(detectCommandVerb('Compare X and Y').verb, 'compare');
    assert.equal(detectCommandVerb('Propose two solutions').verb, 'propose');
    assert.equal(detectRequestedPoints('Give three reasons why'), 3);
    assert.equal(detectRequestedPoints('List 4 examples of'), 4);
    assert.equal(detectRequestedPoints('Explain the levels'), null);
  });

  test('teacher marking guide takes priority and is labelled; AI criteria are labelled and cached for consistency', async () => {
    let r = makeResult();
    const a = item(r, '3A');
    assert.match(buildGradingPrompt([{ ...a, markingGuide: 'Community 2, primary 2, secondary 2, tertiary 2' }]), /MARKING GUIDE provided by the teacher/);
    assert.match(buildGradingPrompt([a]), /No official marking scheme was provided/);
    const first = await gradeResultItems(r, { callText: fakeGrader(() => 4) });
    assert.equal(item(first.result, '3A').criteriaSource, 'ai_generated');
    assert.ok(first.newCriteria[criteriaKey(a)]);
    const prompt = buildGradingPrompt([a], { cachedCriteria: first.newCriteria });
    assert.match(prompt, /already used for other students/);
  });
});
