// Answer-booklet extraction: read handwritten responses and their boundaries (NO grading).
//
// Pure JavaScript; the vision call is injected so it can be unit-tested with `node --test`.
// openaiService.extractStudentAnswers wires it to the real OpenAI vision request.

import { parseExtractionJson, isRetryableError } from './paperExtraction.js';
import {
  normalizeRawAnswers,
  matchAnswersToQuestions,
  assessBookletCompleteness,
  deriveQuestionStatuses,
} from './answerMatching.js';

export const MAX_ANSWER_PAGES_PER_REQUEST = 4;

function shortText(s, n = 140) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function buildAnswerExtractionPrompt({ subject = '', sectionLabel = '', questions = [], pageNumbers = [1], totalPages = 1, previousContext = '' } = {}) {
  const qList = questions.map(q => `- ${q.number}${q.maxPoints ? ` (${q.maxPoints} marks)` : ''}: ${shortText(q.ownText || q.text)}`).join('\n');
  const pageMap = pageNumbers.map((p, i) => `image ${i + 1} = page ${p}`).join(', ');
  return `You are reading a student's HANDWRITTEN exam answer booklet${subject ? ` for ${subject}` : ''}${sectionLabel ? ` (Section ${sectionLabel})` : ''}.
Your job is ONLY to transcribe the answers and mark where each one starts and ends. Do NOT grade.
There ${totalPages === 1 ? 'is 1 uploaded page' : `are ${totalPages} uploaded pages`}. In this request: ${pageMap}. Read them in this order.
${previousContext ? `\nCONTEXT FROM EARLIER PAGES: ${previousContext}\n` : ''}
For reference only, the question paper contains:
${qList || '(question list not available)'}

ANSWER BOUNDARIES
- One answer record per response. A new record starts where the student writes a new question/part label (e.g. "3(a)", "3A", "Q3(a)", "Question 3A", "3(b)(i)") or clearly starts a different response (new block, ruled line, large gap).
- New paragraphs, bullet points or numbered points inside ONE response are part of the same record. Do not split them.
- Never merge two differently-labelled responses into one record.
- If text at the top of a page continues an earlier answer without a new label, output it as a separate record with "label": null and "continuesFromPreviousPage": true, put the label of the answer it continues in "continuesLabel" (this may not be the last answer on the previous page — e.g. a sentence cut off mid-way), and say how sure you are in "continuationConfidence".
- If an answer appears to run past the bottom of the page, set "continuesOnNextPage": true.

LABELS
- Copy the label EXACTLY as the student wrote it into "label". Do NOT renumber, do not infer labels from the order of answers, and do not change a label to match the question list.
- If no label is written, use null. You may then propose "suggestedQuestion" (a label from the list above) with a short "suggestionReason" based on content.
- If a label is hard to read (e.g. 3 vs 8, B vs 3, 1 vs 7), set "labelConfidence": "low" and list other readings in "labelAlternatives".
- "contentMatchesLabel": false if the content clearly answers a different question than its label; otherwise true.

TRANSCRIPTION
- Transcribe exactly what is written, including spelling mistakes. Keep paragraph breaks as \\n.
- Equations/calculations: write inline (e.g. "x^2 + 3x = 10", "sqrt(16) = 4"), keep working steps. Tables as "| a | b |" rows.
- Diagrams: set "hasDiagram": true and briefly describe the diagram and its labels in "diagramDescription".
- Words you cannot read: write "[illegible]". Never guess or invent words. Set "readability": "readable", "partial" (some words illegible) or "unreadable".
- Crossed-out work: if a whole response is crossed out, keep it as its own record with "crossedOut": true. Ignore small struck-out words inside an otherwise valid answer, and include inserted corrections where the student placed them.
- If the same question is answered twice, output both records. Do not decide which one counts.
- Ignore printed booklet text (headers, "Do not write in this margin"), and the teacher's marks/ticks.

REGIONS
- For each record give approximate vertical regions per page as fractions of the page height: {"page": 1, "top": 0.12, "bottom": 0.48}.

Respond with ONLY a JSON object:
{
  "pages": [{"image": 1, "printedPageNumber": null, "blank": false, "quality": "good", "notes": ""}],
  "answers": [
    {"label": "3(a)", "labelConfidence": "high", "labelAlternatives": [], "text": "...", "readability": "readable",
     "handwritingConfidence": "high", "boundaryConfidence": "high", "startPage": ${pageNumbers[0]}, "endPage": ${pageNumbers[0]},
     "regions": [{"page": ${pageNumbers[0]}, "top": 0.05, "bottom": 0.4}], "continuesFromPreviousPage": false, "continuesLabel": null, "continuationConfidence": null,
     "continuesOnNextPage": false, "crossedOut": false, "hasDiagram": false, "diagramDescription": "",
     "suggestedQuestion": null, "suggestionReason": "", "contentMatchesLabel": true}
  ],
  "bookletAppearsIncomplete": false,
  "incompleteReason": ""
}
Confidence values are "high", "medium" or "low". "quality" is one of "good", "blurry", "rotated", "skewed", "shadowed", "cropped". Use the page numbers from the mapping above for startPage/endPage/regions.`;
}

function rangeLabel(pages) {
  return pages.length === 1 ? `Page ${pages[0]}` : `Pages ${pages[0]}–${pages[pages.length - 1]}`;
}

/**
 * Extract answer records from booklet pages and match them to the Stage 1 questions.
 *
 * @param {object} args
 * @param {number} args.pageCount
 * @param {Array} args.questions - Stage 1 assessable items (flattenAssessable) or simple numbered questions
 * @param {(pageIndexes: number[], prompt: string) => Promise<{response: string, error?: string, truncated?: boolean}>} args.callVision
 * @param {number} [args.expectedPages] - pages the teacher said the booklet has
 * @returns {Promise<{status: 'success'|'partial'|'error', records, questionStatuses, completeness, failedPages, issues, error?}>}
 */
export async function runAnswerExtraction({
  pageCount,
  questions = [],
  callVision,
  subject = '',
  sectionLabel = '',
  expectedPages = null,
  maxPagesPerRequest = MAX_ANSWER_PAGES_PER_REQUEST,
  maxAttempts = 2,
  thresholds,
  sleep = (ms) => new Promise(r => setTimeout(r, ms)),
  onProgress,
}) {
  const issues = [];
  const failedPages = [];
  const printed = [];
  const raw = [];
  let incomplete = false;
  let incompleteReason = '';
  let lastError = '';
  let fatal = false;
  let order = 0;

  const fail = (error) => {
    const completeness = { complete: false, reasons: [error] };
    return {
      status: 'error', error, records: [], failedPages: Array.from({ length: pageCount || 0 }, (_, i) => i + 1), issues,
      completeness, questionStatuses: deriveQuestionStatuses(questions, [], { complete: false, extractionFailed: true }),
    };
  };
  if (!pageCount) return fail('No answer pages were uploaded.');

  const queue = [];
  for (let i = 0; i < pageCount; i += maxPagesPerRequest) {
    queue.push(Array.from({ length: Math.min(maxPagesPerRequest, pageCount - i) }, (_, k) => i + k));
  }

  while (queue.length && !fatal) {
    const batch = queue.shift();
    const pageNumbers = batch.map(i => i + 1);
    onProgress?.({ pages: pageNumbers, total: pageCount });
    const last = raw[raw.length - 1];
    const previousContext = last
      ? `The previous page ended inside ${last.label ? `the answer labelled "${last.label}"` : 'an unlabelled answer'}${last.continuesOnNextPage ? ', which seemed to continue onto the next page' : ''}. Its last words were: "${shortText(String(last.text || '').slice(-120), 120)}".`
      : '';
    const prompt = buildAnswerExtractionPrompt({ subject, sectionLabel, questions, pageNumbers, totalPages: pageCount, previousContext });

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
        const answers = Array.isArray(obj) ? obj : obj?.answers;
        if (!Array.isArray(answers)) throw new Error('Response had no "answers" list');
        parsed = Array.isArray(obj) ? { answers: obj } : obj;
        truncated = !!res.truncated;
      } catch (e) {
        lastError = `Could not read the AI response (${e.message}).`;
      }
    }

    if (parsed && truncated && batch.length > 1) {
      const mid = Math.ceil(batch.length / 2);
      queue.unshift(batch.slice(0, mid), batch.slice(mid));
      continue;
    }
    if (!parsed) {
      failedPages.push(...pageNumbers);
      if (!fatal) issues.push({ level: 'error', code: 'pages_failed', message: `${rangeLabel(pageNumbers)} could not be read. ${lastError}`.trim(), pages: pageNumbers });
      continue;
    }
    if (truncated) issues.push({ level: 'warning', code: 'truncated', message: `${rangeLabel(pageNumbers)}: the AI response was cut off — later answers on this page may be missing.`, pages: pageNumbers });

    const valid = new Set(pageNumbers);
    const fixPage = (p) => {
      const n = parseInt(p, 10);
      if (valid.has(n)) return n;
      if (n >= 1 && n <= batch.length) return pageNumbers[n - 1];
      return pageNumbers[0];
    };
    for (const a of parsed.answers) {
      if (!a || typeof a !== 'object') continue;
      raw.push({
        ...a,
        order: order++,
        startPage: fixPage(a.startPage ?? a.page),
        endPage: fixPage(a.endPage ?? a.startPage ?? a.page),
        regions: (Array.isArray(a.regions) ? a.regions : []).map(r => ({ ...r, page: fixPage(r?.page) })),
      });
    }
    (Array.isArray(parsed.pages) ? parsed.pages : []).forEach((p) => {
      const pageNo = pageNumbers[(parseInt(p?.image, 10) || 0) - 1];
      if (!pageNo) return;
      const n = parseInt(p.printedPageNumber, 10);
      if (Number.isFinite(n)) printed.push(n);
      if (p.quality && p.quality !== 'good') issues.push({ level: 'warning', code: 'page_quality', message: `Page ${pageNo} looks ${p.quality}${p.notes ? ` (${p.notes})` : ''} — check its answers carefully.`, pages: [pageNo] });
    });
    if (parsed.bookletAppearsIncomplete === true) {
      incomplete = true;
      incompleteReason = parsed.incompleteReason ? String(parsed.incompleteReason) : incompleteReason;
    }
  }

  if (fatal) return fail(lastError || 'Answer extraction failed.');

  const prefix = sectionLabel ? `s${String(sectionLabel).toLowerCase()}_` : '';
  const records = matchAnswersToQuestions(normalizeRawAnswers(raw, { sectionLabel, idPrefix: prefix }), questions, { thresholds });
  const completeness = assessBookletCompleteness({
    pageCount, expectedPages, failedPages, printedPageNumbers: printed,
    bookletAppearsIncomplete: incomplete, incompleteReason, records,
  });

  if (failedPages.length === pageCount) {
    return { ...fail(lastError || 'Could not read the uploaded pages.'), issues };
  }
  if (!records.length) {
    issues.push({ level: 'warning', code: 'no_answers', message: 'No handwritten answers were found on the uploaded pages. Check that the right pages were photographed.' });
  }
  const questionStatuses = deriveQuestionStatuses(questions, records, { complete: completeness.complete });
  return {
    status: failedPages.length || issues.some(i => i.code === 'truncated') ? 'partial' : 'success',
    records,
    questionStatuses,
    completeness,
    failedPages,
    issues,
  };
}
