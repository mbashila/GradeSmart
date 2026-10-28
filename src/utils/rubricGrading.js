// Rubric-based AI grading of assessable items.
//
// Pure JavaScript; the text model call is injected so it can be unit-tested with `node --test`.
// Each item is graded against ITS OWN question text and maximum marks. Parent question text is
// supplied only as topic context. Marking criteria come from (in order): a teacher-provided
// marking guide, criteria cached from earlier scripts of the same test (for consistency), or new
// AI-generated criteria — always labelled with their source. No official scheme is ever invented.

import { parseExtractionJson, isRetryableError } from './paperExtraction.js';
import { detectCommandVerb, itemsNeedingGrading, markProcessing, applyGradingOutcome, markItemFailed } from './gradingModel.js';

export const CRITERIA_SOURCE_LABEL = {
  teacher: 'Teacher-provided marking guide',
  ai_generated: 'AI-generated criteria (no official marking scheme)',
  none: 'No criteria',
};

export function criteriaKey(item) {
  return `${item.sectionKey}|${item.questionId}|${item.maxMarks}`;
}

function criteriaBlock(item, cached) {
  if (item.markingGuide && item.markingGuide.trim()) {
    return `MARKING GUIDE provided by the teacher (follow it; it takes priority over your own judgement of what is required):\n${item.markingGuide.trim()}`;
  }
  if (cached && cached.length) {
    return `MARKING CRITERIA already used for other students on this question (reuse them exactly, for consistency):\n${cached.map(c => `- ${c.point} (${c.marks} mark${c.marks === 1 ? '' : 's'})`).join('\n')}`;
  }
  return `No official marking scheme was provided. First write your own marking criteria for this question that distribute exactly ${item.maxMarks} mark${item.maxMarks === 1 ? '' : 's'}, then grade against them.`;
}

export function buildGradingPrompt(items, { subject = '', gradeLevel = '', cachedCriteria = {} } = {}) {
  const blocks = items.map((it) => {
    const verb = detectCommandVerb(it.questionText);
    const readNote = it.extractionStatus === 'partial'
      ? 'Some words were unreadable and appear as "[illegible]". Do NOT treat illegible words as wrong; if they could change the mark, set confidence to "low" and explain.'
      : 'The answer was transcribed from handwriting; minor spelling errors are not penalised unless spelling is assessed.';
    return `=== ITEM ${it.id} ===
Question number: ${it.number}
Maximum marks: ${it.maxMarks}
${it.parentContext ? `Topic context from the parent question (use only to understand the topic; do NOT grade against it):\n${it.parentContext}\n` : ''}Question to grade against:
${it.questionText}
Task word: ${verb.verb || 'none detected'} — ${verb.guidance}
${it.requestedPoints ? `Number of points requested: ${it.requestedPoints}. Do not give credit beyond the requested number of points unless the criteria allow it.\n` : ''}${criteriaBlock(it, cachedCriteria[criteriaKey(it)])}
Student answer (${readNote}):
"""
${it.answerText}
"""`;
  }).join('\n\n');

  return `You are an experienced, fair ${subject || ''} examiner${gradeLevel ? ` for ${gradeLevel} students` : ''}. Grade each item below independently.

RULES
- Grade each answer ONLY against its own question and maximum marks. Parent context is background, not a requirement.
- Follow what the task word asks for. "Explain" needs reasons/how/why, "discuss" needs developed points, "list/state" needs the requested facts, "compare" needs both items related on the same criteria, "propose" needs realistic solutions, "calculate" gives method marks.
- Award credit for any valid, relevant point even if worded differently from your criteria. Do not reward irrelevant length.
- Use partial credit. Marks are whole numbers or halves, between 0 and the maximum.
- Base every statement on what the student actually wrote. Quote or paraphrase their answer in the rationale. Never claim the student wrote something they did not.
- Feedback must be specific and constructive, in language suitable for the learner. Avoid vague words like "bad" or "incorrect" without saying why.
- "confidence" is how sure you are about the MARK (not the handwriting): "high", "medium" or "low". Use "low" when the answer is ambiguous, borderline, or partly unreadable in a way that matters, and say why in "uncertainReason".

${blocks}

Respond with ONLY a JSON object:
{"results": [{"id": "<item id exactly as given>", "criteria": [{"point": "…", "marks": 2}], "awarded": 5, "rationale": "Why marks were awarded or withheld, referring to the answer.", "strengths": ["…"], "missing": ["…"], "improvement": "One concrete suggestion.", "confidence": "high", "uncertainReason": ""}]}
There must be exactly ${items.length} result(s), one per item id.`;
}

/**
 * Parse and validate the model output. Returns { outcomes: {id: outcome}, problems: [string] }.
 * Duplicate results for an id are ignored after the first; unknown ids are ignored.
 */
export function parseGradingResponse(text, items, cachedCriteria = {}) {
  const problems = [];
  const obj = parseExtractionJson(text);
  const list = Array.isArray(obj) ? obj : obj?.results;
  if (!Array.isArray(list)) throw new Error('Response had no "results" list');
  const byId = new Map(items.map(i => [i.id, i]));
  const outcomes = {};
  for (const r of list) {
    const id = r && String(r.id ?? '').trim();
    const item = byId.get(id);
    if (!item) { problems.push(`Ignored result for unknown item "${id}".`); continue; }
    if (outcomes[id]) { problems.push(`Ignored duplicate result for item ${item.number}.`); continue; }
    const criteria = (Array.isArray(r.criteria) ? r.criteria : [])
      .map(c => ({ point: String(c?.point || '').trim(), marks: Number(c?.marks) }))
      .filter(c => c.point && Number.isFinite(c.marks));
    const source = item.markingGuide?.trim() ? 'teacher' : 'ai_generated';
    const useCriteria = source === 'ai_generated' && cachedCriteria[criteriaKey(item)]?.length ? cachedCriteria[criteriaKey(item)] : criteria;
    const sum = useCriteria.reduce((s, c) => s + c.marks, 0);
    const awardedRaw = r.awarded ?? r.score ?? r.marks;
    outcomes[id] = {
      awarded: awardedRaw === null || awardedRaw === undefined || awardedRaw === '' ? NaN : Number(awardedRaw),
      confidence: ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : 'low',
      uncertainReason: r.uncertainReason ? String(r.uncertainReason) : (['high', 'medium', 'low'].includes(r.confidence) ? '' : 'The AI did not report its confidence.'),
      rationale: String(r.rationale || '').trim(),
      strengths: (Array.isArray(r.strengths) ? r.strengths : []).map(String).filter(Boolean),
      missing: (Array.isArray(r.missing) ? r.missing : []).map(String).filter(Boolean),
      improvement: String(r.improvement || '').trim(),
      criteria: useCriteria,
      criteriaSource: source,
      criteriaSumMismatch: useCriteria.length > 0 && Math.abs(sum - item.maxMarks) > 1e-9,
    };
    if (!outcomes[id].rationale) outcomes[id].confidence = 'low';
  }
  return { outcomes, problems };
}

/**
 * Grade items in batches; retry only failed items (first as a batch, then individually).
 *
 * @param {object} args
 * @param {Array} args.items - grading-model items to grade
 * @param {(prompt: string) => Promise<{response: string, error?: string, truncated?: boolean}>} args.callText
 * @returns {Promise<{ outcomes: object, failures: object, newCriteria: object, problems: string[] }>}
 *   failures: { itemId: friendly reason } — these must NOT be treated as zero.
 */
export async function runRubricGrading({
  items, callText, subject = '', gradeLevel = '', cachedCriteria = {}, batchSize = 5, maxAttempts = 2,
  sleep = (ms) => new Promise(r => setTimeout(r, ms)), onProgress,
}) {
  const outcomes = {};
  const failures = {};
  const problems = [];
  let fatal = '';

  const gradeBatch = async (batch) => {
    const prompt = buildGradingPrompt(batch, { subject, gradeLevel, cachedCriteria });
    let lastError = '';
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let res;
      try {
        res = await callText(prompt + (attempt > 1 ? '\n\nIMPORTANT: your previous reply could not be used. Reply with ONLY the JSON object.' : ''));
      } catch (e) {
        res = { response: '', error: `AI error: ${e?.message || e}` };
      }
      if (res?.error) {
        lastError = res.error;
        if (!isRetryableError(res.error)) { fatal = res.error; return lastError; }
        if (attempt < maxAttempts) await sleep(1500 * attempt);
        continue;
      }
      try {
        const parsed = parseGradingResponse(res.response, batch, cachedCriteria);
        problems.push(...parsed.problems);
        Object.assign(outcomes, parsed.outcomes);
        if (batch.every(i => outcomes[i.id])) return '';
        lastError = 'The AI response was missing some items.';
        if (res.truncated) return lastError;
      } catch (e) {
        lastError = `Could not read the AI response (${e.message}).`;
      }
    }
    return lastError;
  };

  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) batches.push(items.slice(i, i + batchSize));
  let done = 0;
  for (const batch of batches) {
    if (fatal) break;
    onProgress?.({ done, total: items.length });
    const err = await gradeBatch(batch);
    const missing = batch.filter(i => !outcomes[i.id]);
    if (missing.length && missing.length < batch.length && !fatal) {
      for (const it of missing) {
        if (fatal) break;
        const e2 = await gradeBatch([it]);
        if (!outcomes[it.id]) failures[it.id] = e2 || err;
      }
    } else {
      missing.forEach((it) => { failures[it.id] = err; });
    }
    done += batch.length;
  }
  if (fatal) items.filter(i => !outcomes[i.id]).forEach((i) => { failures[i.id] = fatal; });

  const newCriteria = {};
  for (const it of items) {
    const o = outcomes[it.id];
    if (o && o.criteriaSource === 'ai_generated' && o.criteria.length && !o.criteriaSumMismatch && !cachedCriteria[criteriaKey(it)]) {
      newCriteria[criteriaKey(it)] = o.criteria;
    }
  }
  onProgress?.({ done: items.length, total: items.length });
  return { outcomes, failures, newCriteria, problems };
}

/**
 * Grade (or regrade) items of a grading result. Only items that need grading are sent — teacher
 * (manual) marks and items with unchanged, already-graded answers are never re-sent unless listed in `ids`.
 *
 * @param {object} result - grading result (gradingModel)
 * @param {object} opts
 * @param {string[]} [opts.ids] - restrict to these item ids (regrade after a correction)
 * @param {Function} opts.callText - text model call
 * @param {(item) => Promise<{awarded, rationale, confidence, error?}>} [opts.gradeDiagram] - vision grading for diagram items
 * @param {(msg: string) => string} [opts.friendlyError] - converts provider errors to user-safe text
 * @returns {Promise<{ result, newCriteria, failed: number, graded: number }>}
 */
export async function gradeResultItems(result, opts) {
  const { ids = null, callText, gradeDiagram, friendlyError = (e) => e, cachedCriteria = {}, subject, gradeLevel, onProgress } = opts;
  const targets = itemsNeedingGrading(result, ids);
  if (!targets.length) return { result, newCriteria: {}, failed: 0, graded: 0 };
  let next = markProcessing(result, targets.map(t => t.id));

  const diagramItems = gradeDiagram ? targets.filter(t => t.questionType === 'diagram' && t.pages?.length) : [];
  const textItems = targets.filter(t => !diagramItems.includes(t));
  let failed = 0;

  for (const it of diagramItems) {
    try {
      const r = await gradeDiagram(it);
      if (r?.error) { next = markItemFailed(next, it.id, friendlyError(r.error)); failed++; }
      else next = applyGradingOutcome(next, it.id, { awarded: r.awarded, confidence: r.confidence || 'medium', rationale: r.rationale || '', criteriaSource: 'ai_generated' });
    } catch (e) {
      next = markItemFailed(next, it.id, friendlyError(e?.message || String(e))); failed++;
    }
  }

  let newCriteria = {};
  if (textItems.length) {
    const run = await runRubricGrading({ items: textItems, callText, subject, gradeLevel, cachedCriteria, onProgress });
    newCriteria = run.newCriteria;
    for (const it of textItems) {
      if (run.outcomes[it.id]) next = applyGradingOutcome(next, it.id, run.outcomes[it.id]);
      else { next = markItemFailed(next, it.id, friendlyError(run.failures[it.id] || 'Grading failed.')); failed++; }
    }
  }
  return { result: { ...next, updatedAt: new Date().toISOString() }, newCriteria, failed, graded: targets.length - failed };
}
