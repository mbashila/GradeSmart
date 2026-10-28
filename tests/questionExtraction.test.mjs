import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuestionTree, computeCounts, flattenAssessable, validateQuestionTree,
  normalizeTopNumber, parseLabelPath, normalizeSubLabel, displayLabel, parseMarks,
  moveNode, indentNode, outdentNode, updateNode, removeNode, addNode, findNode, suggestNextLabel,
} from '../src/utils/questionHierarchy.js';
import { runPaperExtraction, parseExtractionJson, isRetryableError, buildExtractionPrompt } from '../src/utils/paperExtraction.js';

const codes = (issues) => issues.map(i => i.code);
const noSleep = async () => {};

// Simulated model output for the supplied image (Questions 3 and 4, each with A, B, C).
const Q3_Q4 = {
  pages: [{ image: 1, printedPageNumber: '2', quality: 'good' }],
  instructions: ['Answer ALL questions'],
  questions: [
    { number: '3', rawLabel: 'QUESTION THREE (3)', text: '', marks: 20, page: 1, subquestions: [
      { label: 'A', rawLabel: 'A.', text: 'Explain the levels of healthcare delivery.', marks: 8, page: 1, subquestions: [] },
      { label: 'B', rawLabel: 'B.', text: 'Discuss healthcare delivery challenges.', marks: 6, page: 1, subquestions: [] },
      { label: 'C', rawLabel: 'C.', text: 'Propose solutions to improve access.', marks: 6, page: 1, subquestions: [] },
    ] },
    { number: '4', rawLabel: 'QUESTION FOUR (4)', text: '', marks: 20, page: 1, subquestions: [
      { label: 'A', rawLabel: 'A.', text: 'Describe primary healthcare.', marks: 6, page: 1 },
      { label: 'B', rawLabel: 'B.', text: 'Analyse health financing models.', marks: 8, page: 1 },
      { label: 'C', rawLabel: 'C.', text: 'Evaluate community health strategies.', marks: 6, page: 1 },
    ] },
  ],
};

const mockVision = (responses) => {
  const calls = [];
  const fn = async (pages, prompt) => {
    calls.push({ pages, prompt });
    const r = responses[calls.length - 1] ?? responses[responses.length - 1];
    if (typeof r === 'function') return r(pages, prompt);
    if (r instanceof Error) throw r;
    return typeof r === 'string' ? { response: r } : r;
  };
  fn.calls = calls;
  return fn;
};

describe('supplied example: Questions 3 and 4 with A, B, C', () => {
  test('hierarchical model output -> 2 top-level, 6 subquestions, 40 marks', async () => {
    const vision = mockVision([JSON.stringify(Q3_Q4)]);
    const r = await runPaperExtraction({ pageCount: 1, callVision: vision, sectionLabel: 'B', sectionType: 'essay', sleep: noSleep });
    assert.equal(r.status, 'success');
    assert.deepEqual(
      { top: r.counts.topLevel, sub: r.counts.subquestions, assessable: r.counts.assessable, marks: r.counts.totalMarks },
      { top: 2, sub: 6, assessable: 6, marks: 40 },
    );
    assert.deepEqual(r.questions.map(q => `${q.number}:${q.maxPoints}`), ['3A:8', '3B:6', '3C:6', '4A:6', '4B:8', '4C:6']);
    assert.equal(r.tree[0].marks, 20);
    assert.equal(r.tree[0].rawLabel, 'QUESTION THREE (3)');
    assert.equal(r.questions[0].ownText, 'Explain the levels of healthcare delivery.');
    assert.equal(r.questions[0].section, 'Section B');
    assert.equal(r.questions[0].page, 1);
    assert.deepEqual(r.instructions, ['Answer ALL questions']);
    assert.equal(r.issues.filter(i => i.level !== 'info').length, 0);
  });

  test('old-style flat output (the previous failure mode) is repaired into the same hierarchy', () => {
    const flat = [
      { number: 'QUESTION THREE (3)', text: '' },
      { number: '3A', text: 'Explain the levels of healthcare delivery. (8 Marks)' },
      { number: '3B', text: 'Discuss healthcare delivery challenges. (6 Marks)' },
      { number: '3C', text: 'Propose solutions to improve access. (6 Marks)' },
      { number: null, text: '[TOTAL: 20 MARKS]' },
      { number: '4(a)', text: 'Describe primary healthcare.', maxPoints: 6 },
      { number: '4(b)', text: 'Analyse health financing models.', maxPoints: 8 },
      { number: '4(c)', text: 'Evaluate community health strategies.', maxPoints: 6 },
      { number: null, text: 'Page 2' },
    ];
    const { tree } = buildQuestionTree(flat);
    const c = computeCounts(tree);
    assert.equal(c.topLevel, 2);
    assert.equal(c.subquestions, 6);
    assert.equal(c.totalMarks, 40);
    assert.equal(tree[0].marks, 20);
    assert.equal(tree[0].children[0].text, 'Explain the levels of healthcare delivery.');
    assert.deepEqual(flattenAssessable(tree).map(q => q.number), ['3A', '3B', '3C', '4(a)', '4(b)', '4(c)']);
  });
});

describe('numbering formats', () => {
  test('top-level number normalisation', () => {
    assert.equal(normalizeTopNumber('QUESTION ONE (1)'), '1');
    assert.equal(normalizeTopNumber('QUESTION THREE'), '3');
    assert.equal(normalizeTopNumber('Question 12'), '12');
    assert.equal(normalizeTopNumber('Q.4'), '4');
    assert.equal(normalizeTopNumber('QUESTION IV'), '4');
    assert.equal(normalizeTopNumber('QUESTION THREE (20 Marks)'), '3');
    assert.equal(normalizeTopNumber(7), '7');
  });

  test('composite labels', () => {
    assert.deepEqual(parseLabelPath('1(a)'), ['1', 'a']);
    assert.deepEqual(parseLabelPath('2(a)(ii)'), ['2', 'a', 'ii']);
    assert.deepEqual(parseLabelPath('3A'), ['3', 'A']);
    assert.deepEqual(parseLabelPath('1.2'), ['1', '2']);
    assert.deepEqual(parseLabelPath('(iii)'), ['iii']);
    assert.deepEqual(parseLabelPath('Question 3 (20 marks)'), ['3']);
    assert.equal(normalizeSubLabel('A.', ['3']), 'A');
    assert.equal(normalizeSubLabel('3B', ['3']), 'B');
    assert.equal(normalizeSubLabel('(ii)', ['2', 'a']), 'ii');
    assert.equal(normalizeSubLabel('2(a)(i)', ['2', 'a']), 'i');
    assert.equal(displayLabel(['2', 'a', 'i']), '2(a)(i)');
    assert.equal(displayLabel(['3', 'A']), '3A');
    assert.equal(displayLabel(['1', '2']), '1.2');
  });

  test('nested Roman numerals keep their hierarchy', () => {
    const { tree } = buildQuestionTree([{ number: 2, text: 'Answer the following.', subquestions: [
      { label: '(a)', text: 'Define osmosis.', subquestions: [
        { label: '(i)', text: 'Give one example in plants.', marks: 2 },
        { label: '(ii)', text: 'Give one example in animals.', marks: 2 },
      ] },
      { label: '(b)', text: 'Explain diffusion.', marks: 4 },
    ] }]);
    const c = computeCounts(tree);
    assert.equal(c.topLevel, 1);
    assert.equal(c.subquestions, 4); // a, i, ii, b
    assert.equal(c.assessable, 3); // i, ii, b
    assert.equal(c.totalMarks, 8);
    const flat = flattenAssessable(tree);
    assert.deepEqual(flat.map(q => q.number), ['2(a)(i)', '2(a)(ii)', '2(b)']);
    assert.equal(flat[0].text, 'Answer the following.\nDefine osmosis.\n\nGive one example in plants.');
  });

  test('flat Roman output like "2(a)(i)" is nested', () => {
    const { tree } = buildQuestionTree([
      { number: '2(a)(i)', text: 'x', marks: 2 }, { number: '2(a)(ii)', text: 'y', marks: 3 }, { number: '2(b)', text: 'z', marks: 5 },
    ]);
    assert.equal(tree.length, 1);
    assert.equal(tree[0].children[0].children.length, 2);
    assert.equal(computeCounts(tree).totalMarks, 10);
  });

  test('a list inside a question is not split, and parts without marks are flagged', () => {
    const { tree } = buildQuestionTree([{ number: 5, text: 'List three examples of renewable energy.', marks: 3, subquestions: [] }]);
    assert.equal(computeCounts(tree).assessable, 1);
    const suspicious = buildQuestionTree([{ number: 5, text: 'List three renewable sources:', marks: 3, subquestions: [
      { label: 'i', text: 'Solar' }, { label: 'ii', text: 'Wind' }, { label: 'iii', text: 'Hydro' },
    ] }]);
    assert.ok(codes(validateQuestionTree(suspicious.tree)).includes('children_marks_missing'));
    assert.equal(computeCounts(suspicious.tree).totalMarks, 3); // falls back to the stated parent total
  });
});

test('multiple questions on one page', async () => {
  const vision = mockVision([JSON.stringify({ questions: [
    { number: '1', text: 'Define photosynthesis.', marks: 5 },
    { number: '2', text: 'State Newton\'s second law: F = ma.', marks: 5 },
    { number: '3', text: 'Solve x^2 - 4 = 0.', marks: 10 },
  ] })]);
  const r = await runPaperExtraction({ pageCount: 1, callVision: vision, sleep: noSleep });
  assert.equal(r.counts.topLevel, 3);
  assert.equal(r.counts.subquestions, 0);
  assert.equal(r.counts.assessable, 3);
  assert.equal(r.counts.totalMarks, 20);
  assert.equal(r.questions[1].text, 'State Newton\'s second law: F = ma.');
});

test('question continuing across pages is merged, not duplicated', async () => {
  const vision = mockVision([
    JSON.stringify({ questions: [{ number: '1', text: 'Read the case study about Kenya\'s health system.', marks: 20, page: 1, subquestions: [
      { label: 'a', text: 'Identify two challenges.', marks: 4, page: 1 },
      { label: 'b', text: 'Explain the role of', marks: 6, page: 1 },
    ] }] }),
    JSON.stringify({ questions: [
      { number: '1', continued: true, text: '', page: 2, subquestions: [
        { label: 'b', continued: true, text: 'community health workers.', page: 2 },
        { label: 'c', text: 'Recommend improvements.', marks: 10, page: 2 },
      ] },
      { number: '2', text: 'Define epidemiology.', marks: 5, page: 2 },
    ] }),
  ]);
  const r = await runPaperExtraction({ pageCount: 2, callVision: vision, maxPagesPerRequest: 1, sleep: noSleep });
  assert.equal(r.counts.topLevel, 2);
  assert.deepEqual(r.questions.map(q => q.number), ['1(a)', '1(b)', '1(c)', '2']);
  assert.equal(r.questions[1].ownText, 'Explain the role of community health workers.');
  assert.equal(r.questions[1].maxPoints, 6);
  assert.equal(r.counts.totalMarks, 25);
  assert.match(vision.calls[1].prompt, /ended in Question 1/);
  assert.equal(r.status, 'success');
});

test('pages uploaded in the wrong order are sorted and flagged', async () => {
  const vision = mockVision([JSON.stringify({
    pages: [{ image: 1, printedPageNumber: '2', quality: 'good' }, { image: 2, printedPageNumber: '1', quality: 'good' }],
    questions: [{ number: '3', text: 'c', marks: 5, page: 1 }, { number: '1', text: 'a', marks: 5, page: 2 }, { number: '2', text: 'b', marks: 5, page: 2 }],
  })]);
  const r = await runPaperExtraction({ pageCount: 2, callVision: vision, sleep: noSleep });
  assert.deepEqual(r.tree.map(t => t.label), ['1', '2', '3']);
  assert.ok(codes(r.issues).includes('pages_out_of_order'));
});

test('missing or blurry question numbers are flagged, gaps are not filled', async () => {
  const vision = mockVision([JSON.stringify({ questions: [
    { number: '1', text: 'Define a cell.', marks: 2 },
    { number: '2', text: 'Name the [illegible] of the cell.', marks: 2, confidence: 'low' },
    { number: null, text: 'Explain mitosis.', marks: 4 },
    { number: '5', numberUncertain: true, text: 'Explain meiosis.', marks: 4 },
  ] })]);
  const r = await runPaperExtraction({ pageCount: 1, callVision: vision, sleep: noSleep });
  assert.equal(r.status, 'partial');
  assert.equal(r.counts.topLevel, 4);
  const c = codes(r.issues);
  assert.ok(c.includes('low_confidence'));
  assert.ok(c.includes('missing_label'));
  assert.ok(c.includes('number_uncertain'));
  const gap = r.issues.find(i => i.code === 'number_gap');
  assert.equal(gap.level, 'info');
  assert.equal(r.tree.some(t => t.label === '3' || t.label === '4'), false);
});

test('handwritten annotations, page numbers and footers do not become questions', async () => {
  const vision = mockVision([JSON.stringify({
    handwrittenAnnotations: ['✓ 7/8 (teacher)', 'student doodle near Q1'],
    questions: [
      { number: '1', text: 'Explain the water cycle.', marks: 8 },
      { number: null, text: 'Page 3' },
      { number: null, text: 'Turn over' },
      { number: null, text: '[TOTAL: 8 MARKS]' },
    ],
  })]);
  const r = await runPaperExtraction({ pageCount: 1, callVision: vision, sleep: noSleep });
  assert.equal(r.counts.topLevel, 1);
  assert.equal(r.counts.totalMarks, 8);
  assert.equal(r.status, 'success');
});

describe('marks', () => {
  test('parent total is not double counted', () => {
    const { tree } = buildQuestionTree(Q3_Q4.questions);
    assert.equal(computeCounts(tree).totalMarks, 40); // not 80
  });

  test('discrepancies and missing marks are flagged, never guessed', () => {
    const { tree } = buildQuestionTree([
      { number: '1', marks: 20, subquestions: [{ label: 'a', text: 'x', marks: 8 }, { label: 'b', text: 'y', marks: 6 }, { label: 'c', text: 'z', marks: 5 }] },
      { number: '2', marks: 10, subquestions: [{ label: 'a', text: 'p', marks: 4 }, { label: 'b', text: 'q' }] },
      { number: '3', text: 'Essay question with no marks shown.' },
    ]);
    const issues = validateQuestionTree(tree, { paperTotalMarks: 100 });
    const c = codes(issues);
    assert.ok(c.includes('marks_mismatch'));
    assert.equal(issues.filter(i => i.code === 'missing_marks').length, 2);
    const counts = computeCounts(tree);
    assert.equal(counts.marksComplete, false);
    assert.equal(counts.totalMarks, 19 + 10); // Q1 uses parts (19), Q2 falls back to stated 10, Q3 unknown
    assert.equal(flattenAssessable(tree).find(q => q.number === '3').marksMissing, true);
  });

  test('paper total mismatch is informational', () => {
    const { tree } = buildQuestionTree(Q3_Q4.questions);
    const issue = validateQuestionTree(tree, { paperTotalMarks: 60 }).find(i => i.code === 'paper_total_mismatch');
    assert.equal(issue.level, 'info');
  });

  test('marks parsing', () => {
    assert.equal(parseMarks('(8 Marks)'), 8);
    assert.equal(parseMarks('[TOTAL: 20 MARKS]'), 20);
    assert.equal(parseMarks(null), null);
    assert.equal(parseMarks('n/a'), null);
    assert.equal(parseMarks(2.5), 2.5);
  });
});

test('rotated / shadowed / skewed pages are surfaced for review', async () => {
  const vision = mockVision([JSON.stringify({
    pages: [{ image: 1, quality: 'rotated', notes: 'page photographed sideways' }, { image: 2, quality: 'shadowed' }],
    questions: [{ number: '1', text: 'a', marks: 5, page: 1 }, { number: '2', text: 'b', marks: 5, page: 2 }],
  })]);
  const r = await runPaperExtraction({ pageCount: 2, callVision: vision, sleep: noSleep });
  assert.equal(r.issues.filter(i => i.code === 'page_quality').length, 2);
  assert.equal(r.counts.topLevel, 2);
});

describe('duplicate or malformed AI output', () => {
  test('duplicate entries are merged', () => {
    const dup = [...Q3_Q4.questions, Q3_Q4.questions[0], { number: '3B', text: 'Discuss healthcare delivery challenges.', marks: 6 }];
    const { tree } = buildQuestionTree(dup);
    const c = computeCounts(tree);
    assert.equal(c.topLevel, 2);
    assert.equal(c.subquestions, 6);
    assert.equal(c.totalMarks, 40);
  });

  test('same label with different text is kept and flagged', () => {
    const { tree } = buildQuestionTree([{ number: '1', subquestions: [{ label: 'a', text: 'First', marks: 2 }, { label: 'a', text: 'Different', marks: 2 }] }]);
    assert.equal(tree[0].children.length, 2);
    assert.ok(codes(validateQuestionTree(tree)).includes('duplicate_label'));
  });

  test('code fences, prose and trailing commas', () => {
    const obj = parseExtractionJson('Sure! Here it is:\n```json\n{"questions": [{"number": "1", "text": "a",},],}\n```\nHope that helps');
    assert.equal(obj.questions.length, 1);
  });

  test('truncated JSON is recovered as far as possible', () => {
    const obj = parseExtractionJson('{"questions": [{"number": "1", "text": "a", "marks": 2}, {"number": "2", "text": "Explain the ro');
    assert.ok(obj.questions.length >= 1);
    assert.equal(obj.questions[0].number, '1');
  });

  test('unparseable output is retried, then succeeds', async () => {
    const vision = mockVision(['I cannot help with that.', JSON.stringify(Q3_Q4)]);
    const r = await runPaperExtraction({ pageCount: 1, callVision: vision, sleep: noSleep });
    assert.equal(vision.calls.length, 2);
    assert.match(vision.calls[1].prompt, /ONLY the JSON object/);
    assert.equal(r.counts.totalMarks, 40);
  });

  test('unparseable output twice -> clear error', async () => {
    const vision = mockVision(['nope', 'still nope']);
    const r = await runPaperExtraction({ pageCount: 1, callVision: vision, sleep: noSleep });
    assert.equal(r.status, 'error');
    assert.match(r.error, /Could not read the AI response/);
  });

  test('truncated multi-page response is re-run in smaller batches', async () => {
    const vision = mockVision([
      { response: '{"questions": [{"number": "1", "text": "a"', truncated: true },
      JSON.stringify({ questions: [{ number: '1', text: 'a', marks: 5, page: 1 }] }),
      JSON.stringify({ questions: [{ number: '2', text: 'b', marks: 5, page: 2 }] }),
    ]);
    const r = await runPaperExtraction({ pageCount: 2, callVision: vision, sleep: noSleep });
    assert.deepEqual(vision.calls.map(c => c.pages), [[0, 1], [0], [1]]);
    assert.equal(r.counts.topLevel, 2);
  });
});

describe('failed requests and retry', () => {
  test('timeout is retried once then succeeds', async () => {
    const vision = mockVision([{ response: '', error: 'AI request timed out.' }, JSON.stringify(Q3_Q4)]);
    const r = await runPaperExtraction({ pageCount: 1, callVision: vision, sleep: noSleep });
    assert.equal(vision.calls.length, 2);
    assert.equal(r.status, 'success');
  });

  test('network exception is retried', async () => {
    const vision = mockVision([new Error('Network request failed'), JSON.stringify(Q3_Q4)]);
    const r = await runPaperExtraction({ pageCount: 1, callVision: vision, sleep: noSleep });
    assert.equal(r.status, 'success');
  });

  test('auth error is not retried and returns an error', async () => {
    const vision = mockVision([{ response: '', error: 'API error 401: invalid key' }]);
    const r = await runPaperExtraction({ pageCount: 1, callVision: vision, sleep: noSleep });
    assert.equal(vision.calls.length, 1);
    assert.equal(r.status, 'error');
    assert.match(r.error, /401/);
  });

  test('a failed page batch keeps the other pages\' results (partial)', async () => {
    const vision = mockVision([
      JSON.stringify({ questions: [{ number: '1', text: 'a', marks: 5, page: 1 }] }),
      { response: '', error: 'API error 503: overloaded' },
    ]);
    const r = await runPaperExtraction({ pageCount: 2, callVision: vision, maxPagesPerRequest: 1, sleep: noSleep });
    assert.equal(r.status, 'partial');
    assert.deepEqual(r.failedPages, [2]);
    assert.equal(r.counts.topLevel, 1);
    assert.ok(r.issues.some(i => i.code === 'pages_failed' && i.level === 'error'));
  });

  test('all requests fail -> error, nothing invented', async () => {
    const vision = mockVision([{ response: '', error: 'AI request timed out.' }]);
    const r = await runPaperExtraction({ pageCount: 1, callVision: vision, sleep: noSleep });
    assert.equal(r.status, 'error');
    assert.equal(r.questions.length, 0);
  });

  test('retryable classification', () => {
    assert.equal(isRetryableError('AI request timed out.'), true);
    assert.equal(isRetryableError('API error 429: rate limit'), true);
    assert.equal(isRetryableError('API error 500: x'), true);
    assert.equal(isRetryableError('API error 400: bad image'), false);
    assert.equal(isRetryableError('No API key configured.'), false);
  });
});

describe('review edits', () => {
  const base = () => buildQuestionTree(Q3_Q4.questions).tree;

  test('edit marks, label and text recompute counts', () => {
    let t = base();
    t = updateNode(t, 'q3_c', { marks: 10, text: 'Propose two solutions.' });
    assert.equal(computeCounts(t).totalMarks, 44);
    assert.ok(codes(validateQuestionTree(t)).includes('marks_mismatch'));
    t = updateNode(t, 'q3', { label: '5' });
    assert.equal(flattenAssessable(t)[0].number, '5A');
    assert.equal(findNode(t, 'q3_c').node.text, 'Propose two solutions.');
  });

  test('indent / outdent change the parent, move changes order', () => {
    let t = base();
    t = outdentNode(t, 'q3_c'); // 3C becomes a top-level sibling after Q3
    assert.equal(computeCounts(t).topLevel, 3);
    t = indentNode(t, 'q3_c'); // back under Q3
    assert.equal(computeCounts(t).topLevel, 2);
    assert.equal(t[0].children[2].id, 'q3_c');
    t = moveNode(t, 'q4', -1);
    assert.deepEqual(t.map(n => n.label), ['4', '3']);
    t = removeNode(t, 'q4_b');
    assert.equal(computeCounts(t).assessable, 5);
    const added = addNode(t, 'q3', { label: suggestNextLabel(findNode(t, 'q3').node.children, 1) });
    assert.equal(added.node.label, 'D');
    assert.equal(computeCounts(added.tree).assessable, 6);
  });
});

test('prompt states the hierarchy example and forbids estimating marks', () => {
  const p = buildExtractionPrompt({ pageNumbers: [1, 2], totalPages: 2, sectionLabel: 'B', sectionType: 'essay' });
  assert.match(p, /NOT four questions/);
  assert.match(p, /Never estimate/);
  assert.match(p, /image 2 = page 2/);
});
