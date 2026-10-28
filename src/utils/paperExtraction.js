// Question-paper extraction pipeline.
//
// Pure JavaScript (the vision call is injected) so it can be unit-tested with `node --test`.
// openaiService.extractQuestionsFromPaperImage wires it to the real OpenAI vision request.

import {
  buildQuestionTree,
  mergeQuestionTrees,
  validateQuestionTree,
  computeCounts,
  flattenAssessable,
  parseMarks,
} from './questionHierarchy.js';

export const MAX_PAGES_PER_REQUEST = 4;
const UNCERTAIN_CODES = new Set(['low_confidence', 'missing_label', 'number_uncertain', 'empty_text']);

export function buildExtractionPrompt({ subject = '', sectionLabel = '', sectionType = '', pageNumbers = [1], totalPages = 1, previousContext = '' } = {}) {
  const subjectHint = subject ? ` for a ${subject} exam` : '';
  const sectionHint = sectionLabel
    ? `\nThe teacher uploaded these pages as Section ${sectionLabel}${sectionType ? ` (default question type: "${sectionType}")` : ''}.`
    : '';
  const pageMap = pageNumbers.map((p, i) => `image ${i + 1} = page ${p}`).join(', ');
  const continuation = previousContext
    ? `\nCONTEXT FROM EARLIER PAGES: ${previousContext} If the first content on these pages continues that question, output it with the SAME number and "continued": true (only include the new parts/text).`
    : '';

  return `You are extracting the questions from a photographed exam question paper${subjectHint}.${sectionHint}
There ${totalPages === 1 ? 'is 1 uploaded page' : `are ${totalPages} uploaded pages`}. In this request: ${pageMap}. Images are in upload order, which may not be the printed order.${continuation}

GOAL: return the paper's question HIERARCHY exactly as printed.

HIERARCHY RULES
- A top-level question is a heading such as "QUESTION THREE (3)", "QUESTION 3", "Q3", "3." (usually bold/larger, left-aligned).
- Subquestions are parts under it labelled like "A.", "(a)", "a)", "1(a)", "3.1". Nested parts like "(i)", "(ii)" or "2(a)(i)" go inside their parent part. Never flatten nesting.
- Example — this text:
    QUESTION THREE (3)
    A. Explain the levels of healthcare delivery. (8 Marks)
    B. Discuss healthcare delivery challenges. (6 Marks)
    C. Propose solutions to improve access. (6 Marks)
    [TOTAL: 20 MARKS]
  is ONE top-level question {"number":"3","rawLabel":"QUESTION THREE (3)","text":"","marks":20} with THREE subquestions A (8), B (6), C (6). It is NOT four questions. "QUESTION FOUR (4)" that follows is a new top-level question.
- A numbered or bulleted list INSIDE a question (e.g. "List three examples: (i) ... (ii) ...", data items, MCQ options, statements to match) is part of that question's text unless each item is its own task with its own marks or answer space. Use indentation, layout and meaning, not just the presence of numbers.
- Use layout cues: indentation level, alignment of labels, bold/larger headings, spacing between blocks, and marks printed at the right margin (they belong to the part on the same line or block).

TEXT RULES
- Copy printed text exactly. Join lines that wrap within the same question; keep separate questions separate.
- Preserve punctuation, symbols, units, equations (write them inline, e.g. "x^2 + 3x = 0") and tables (as "| a | b |" rows separated by \\n).
- Do NOT include the label or the marks in "text". Put the original label in "rawLabel".
- If a parent has introductory/stem text before its parts (a scenario, passage, case study), put it in the parent's "text". If it has none, use "".
- If a word is unreadable write "[illegible]" in its place and set "confidence":"low". If a question number/label is unclear set "numberUncertain": true. Never invent words, questions or numbers.

MARKS RULES
- Only use marks that are printed. If none are shown, use null. Never estimate.
- "[TOTAL: 20 MARKS]" / "(20 marks)" after a question's parts is the PARENT's "marks". Do not copy it onto the parts.
- Per-part marks such as "(8 Marks)" belong to that part.

NOT QUESTIONS (never put these in "questions")
- Exam titles, school names, instructions ("Answer any three questions"), section headings ("SECTION B"), page numbers, headers/footers repeated on each page, "Turn over", total-marks lines on their own.
- Handwritten marks, ticks, circles, teacher or student notes written around the printed questions. List any you notice in "handwrittenAnnotations" (unless the whole paper is handwritten, in which case the handwriting IS the question text).

PAGES
- Pages may be rotated, skewed, shadowed or out of order — read them anyway. Report each image's printed page number (if any) and quality.
- Give every question/part the page number (from the mapping above) where it starts.
- A question that starts on one page and continues on the next is ONE question. Do not duplicate it.
- Missing question numbers can be intentional. Do not invent missing questions.

Respond with ONLY a JSON object:
{
  "pages": [{"image": 1, "printedPageNumber": "2", "quality": "good", "notes": ""}],
  "paperTotalMarks": null,
  "instructions": ["Answer any THREE questions"],
  "sectionHeadings": ["SECTION B"],
  "questions": [
    {"number": "3", "rawLabel": "QUESTION THREE (3)", "text": "", "marks": 20, "page": ${pageNumbers[0]}, "continued": false, "confidence": "high", "numberUncertain": false, "type": "${sectionType || 'essay'}",
     "subquestions": [
       {"label": "A", "rawLabel": "A.", "text": "Explain the levels of healthcare delivery.", "marks": 8, "page": ${pageNumbers[0]}, "confidence": "high", "subquestions": []}
     ]}
  ],
  "handwrittenAnnotations": [],
  "uncertainContent": [{"page": ${pageNumbers[0]}, "description": "bottom-right corner is torn"}]
}
"quality" is one of "good", "blurry", "rotated", "skewed", "shadowed", "cropped". "type" is one of "mcq", "fill_in_blank", "short_notes", "comprehension", "essay", "diagram", "calculation". For MCQs add "options": ["A) ...", "B) ..."].`;
}

/**
 * Parse model output into an object, tolerating code fences, prose around the JSON,
 * trailing commas and truncated output. Throws if nothing usable can be recovered.
 */
export function parseExtractionJson(text) {
  const raw = String(text || '').replace(/```(?:json)?/gi, '').trim();
  if (!raw) throw new Error('Empty response');
  try { return JSON.parse(raw); } catch { /* fall through */ }

  const start = raw.search(/[{[]/);
  if (start < 0) throw new Error('No JSON found in response');
  const body = raw.slice(start);
  const balanced = scanJson(body);
  const candidate = balanced.complete ? body.slice(0, balanced.end + 1) : body;
  const attempts = [candidate, stripTrailingCommas(candidate)];
  if (!balanced.complete) attempts.push(repairTruncated(body));
  for (const a of attempts) {
    try { return JSON.parse(a); } catch { /* next */ }
  }
  throw new Error('Response JSON was malformed');
}

function scanJson(s) {
  const stack = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      stack.pop();
      if (stack.length === 0) return { complete: true, end: i, stack };
    }
  }
  return { complete: false, end: s.length - 1, stack, inStr };
}

function stripTrailingCommas(s) {
  return s.replace(/,\s*([}\]])/g, '$1');
}

/** Close a truncated JSON document by dropping the last incomplete value and closing open brackets. */
function repairTruncated(s) {
  let body = s;
  for (let tries = 0; tries < 50 && body.length > 1; tries++) {
    const state = scanJson(body);
    let closed = body;
    if (state.inStr) closed += '"';
    closed = stripTrailingCommas(closed.replace(/[,:]\s*$/, ''));
    closed += state.stack.slice().reverse().map(c => (c === '{' ? '}' : ']')).join('');
    try { JSON.parse(closed); return closed; } catch { /* trim and retry */ }
    const cut = Math.max(body.lastIndexOf(','), body.lastIndexOf('{'), body.lastIndexOf('['));
    if (cut <= 0) break;
    body = body.slice(0, body[cut] === ',' ? cut : cut + 1);
  }
  return s;
}

export function isRetryableError(error) {
  const e = String(error || '').toLowerCase();
  if (!e) return false;
  if (/no api key|api error 40[0-4]|invalid api key/.test(e)) return false;
  return /timed out|timeout|api error (408|409|429|5\d\d)|network|too many requests|failed to fetch|ai error/.test(e);
}

function rangeLabel(pages) {
  return pages.length === 1 ? `Page ${pages[0]}` : `Pages ${pages[0]}–${pages[pages.length - 1]}`;
}

function describeLastQuestion(tree) {
  const last = tree[tree.length - 1];
  if (!last) return '';
  let deepest = last;
  const labels = [];
  while (deepest.children && deepest.children.length) {
    deepest = deepest.children[deepest.children.length - 1];
    labels.push(deepest.label);
  }
  return `The previous page(s) ended in Question ${last.label}${labels.length ? `, last part "${labels.join(' > ')}"` : ''}.`;
}

/**
 * Re-derive the grading list, counts and validation issues for a (possibly user-edited) tree.
 * `staticIssues` are extraction-time issues (failed pages, page quality) that edits cannot fix.
 */
export function summarizeQuestionTree(tree, { paperTotalMarks = null, section = '', sectionType = '', staticIssues = [] } = {}) {
  const issues = [...staticIssues, ...validateQuestionTree(tree, { paperTotalMarks })];
  return {
    questions: flattenAssessable(tree, { section, sectionType }),
    counts: computeCounts(tree),
    issues,
  };
}

/**
 * Run the extraction for `pageCount` pages.
 *
 * @param {object} args
 * @param {number} args.pageCount
 * @param {(pageIndexes: number[], prompt: string) => Promise<{response: string, error?: string, truncated?: boolean}>} args.callVision
 *        pageIndexes are 0-based indexes into the uploaded pages, in upload order.
 * @returns {Promise<{status: 'success'|'partial'|'error', tree, questions, counts, issues, staticIssues, instructions, sectionHeadings, paperTotalMarks, failedPages, error?}>}
 */
export async function runPaperExtraction({
  pageCount,
  callVision,
  subject = '',
  sectionLabel = '',
  sectionType = '',
  maxPagesPerRequest = MAX_PAGES_PER_REQUEST,
  maxAttempts = 2,
  sleep = (ms) => new Promise(r => setTimeout(r, ms)),
  onProgress,
}) {
  const empty = { tree: [], questions: [], counts: computeCounts([]), issues: [], staticIssues: [], instructions: [], sectionHeadings: [], paperTotalMarks: null, failedPages: [] };
  if (!pageCount) return { ...empty, status: 'error', error: 'No pages uploaded.' };

  const staticIssues = [];
  const batchTrees = [];
  const pagesMeta = [];
  const instructions = [];
  const sectionHeadings = [];
  const failedPages = [];
  let paperTotalMarks = null;
  let lastError = '';
  let fatal = false;

  const queue = [];
  for (let i = 0; i < pageCount; i += maxPagesPerRequest) {
    queue.push(Array.from({ length: Math.min(maxPagesPerRequest, pageCount - i) }, (_, k) => i + k));
  }

  while (queue.length && !fatal) {
    const batch = queue.shift();
    const pageNumbers = batch.map(i => i + 1);
    onProgress?.({ pages: pageNumbers, total: pageCount });
    const prompt = buildExtractionPrompt({
      subject, sectionLabel, sectionType, pageNumbers, totalPages: pageCount,
      previousContext: describeLastQuestion(batchTrees[batchTrees.length - 1] || []),
    });

    let parsed = null;
    let truncated = false;
    for (let attempt = 1; attempt <= maxAttempts && !parsed; attempt++) {
      const retryNote = attempt > 1 ? '\n\nIMPORTANT: your previous reply could not be used. Reply with ONLY the JSON object.' : '';
      let res;
      try {
        res = await callVision(batch, prompt + retryNote);
      } catch (e) {
        res = { response: '', error: `AI error: ${e?.message || e}` };
      }
      if (res?.error) {
        lastError = res.error;
        if (!isRetryableError(res.error)) { fatal = true; break; }
        if (attempt < maxAttempts) await sleep(1500 * attempt);
        continue;
      }
      try {
        const obj = parseExtractionJson(res?.response);
        const qs = Array.isArray(obj) ? obj : obj?.questions;
        if (!Array.isArray(qs)) throw new Error('Response had no "questions" list');
        parsed = Array.isArray(obj) ? { questions: obj } : obj;
        truncated = !!res.truncated;
      } catch (e) {
        lastError = `Could not read the AI response (${e.message}).`;
      }
    }

    if (parsed && truncated && batch.length > 1) {
      // Output was cut off: re-run the batch as smaller batches instead of trusting a partial answer.
      const mid = Math.ceil(batch.length / 2);
      queue.unshift(batch.slice(0, mid), batch.slice(mid));
      continue;
    }

    if (!parsed) {
      failedPages.push(...pageNumbers);
      if (!fatal) staticIssues.push({ level: 'error', code: 'pages_failed', message: `${rangeLabel(pageNumbers)} could not be read. ${lastError}`.trim() });
      continue;
    }
    if (truncated) {
      staticIssues.push({ level: 'warning', code: 'truncated', message: `${rangeLabel(pageNumbers)}: the AI response was cut off, so the last questions on this page may be missing.` });
    }

    const { tree, issues } = buildQuestionTree(parsed.questions, { defaultType: sectionType });
    const validPages = new Set(pageNumbers);
    // Pages should use global numbering; accept per-request image indexes as a fallback.
    const fixPages = (nodes) => nodes.forEach((n) => {
      if (!validPages.has(n.page)) {
        n.page = batch.length === 1 ? pageNumbers[0] : (n.page >= 1 && n.page <= batch.length ? pageNumbers[n.page - 1] : null);
      }
      fixPages(n.children);
    });
    fixPages(tree);
    batchTrees.push(tree);
    staticIssues.push(...issues);

    (Array.isArray(parsed.pages) ? parsed.pages : []).forEach((p) => {
      const pageNo = pageNumbers[(parseInt(p?.image, 10) || 0) - 1];
      if (!pageNo) return;
      pagesMeta.push({ page: pageNo, printed: p.printedPageNumber, quality: p.quality });
      if (p.quality && p.quality !== 'good') {
        staticIssues.push({ level: 'warning', code: 'page_quality', message: `Page ${pageNo} looks ${p.quality}${p.notes ? ` (${p.notes})` : ''}. Check its questions carefully.` });
      }
    });
    (Array.isArray(parsed.uncertainContent) ? parsed.uncertainContent : []).forEach((u) => {
      if (u?.description) staticIssues.push({ level: 'warning', code: 'uncertain_content', message: `${u.page ? `Page ${u.page}: ` : ''}${u.description}` });
    });
    for (const s of (Array.isArray(parsed.instructions) ? parsed.instructions : [])) if (s && !instructions.includes(s)) instructions.push(String(s));
    for (const s of (Array.isArray(parsed.sectionHeadings) ? parsed.sectionHeadings : [])) if (s && !sectionHeadings.includes(s)) sectionHeadings.push(String(s));
    if (paperTotalMarks === null) paperTotalMarks = parseMarks(parsed.paperTotalMarks);
  }

  if (fatal) {
    return { ...empty, status: 'error', error: lastError || 'Extraction failed.' };
  }

  let { tree, issues: mergeIssues } = mergeQuestionTrees(batchTrees);
  staticIssues.push(...mergeIssues);

  const printed = pagesMeta.sort((a, b) => a.page - b.page).map(p => parseInt(p.printed, 10)).filter(n => Number.isFinite(n));
  const outOfOrder = printed.some((n, i) => i > 0 && n < printed[i - 1]);
  if (outOfOrder && tree.every(t => /^\d+$/.test(t.label))) {
    tree = [...tree].sort((a, b) => parseInt(a.label, 10) - parseInt(b.label, 10));
    staticIssues.push({ level: 'info', code: 'pages_out_of_order', message: 'Pages seem to have been uploaded out of order. Questions were sorted by their printed numbers — please confirm the order.' });
  }

  if (tree.length === 0) {
    const error = failedPages.length ? (lastError || 'Could not read the uploaded pages.') : 'No questions were found on the uploaded pages. Try a clearer, well-lit photo.';
    return { ...empty, staticIssues, issues: staticIssues, failedPages, status: 'error', error };
  }

  const summary = summarizeQuestionTree(tree, { paperTotalMarks, section: sectionLabel ? `Section ${sectionLabel}` : '', sectionType, staticIssues });
  const uncertain = summary.issues.some(i => UNCERTAIN_CODES.has(i.code));
  return {
    status: failedPages.length || uncertain || staticIssues.some(i => i.code === 'truncated') ? 'partial' : 'success',
    tree,
    ...summary,
    staticIssues,
    instructions,
    sectionHeadings,
    paperTotalMarks,
    failedPages,
  };
}
