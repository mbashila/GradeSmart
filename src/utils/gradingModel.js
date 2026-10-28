// Grading result model: per-item marks, statuses, totals, validation, moderation and audit.
//
// Pure JavaScript (no React Native imports) so it can be unit-tested with `node --test`.
//
// A grading result covers one student's script:
//   {
//     id, version, createdAt, updatedAt, finalized, finalizedAt, finalizedBy,
//     sections: [{ key, label, type, questions, parents, instructions, optionalRule, complete,
//                  completenessReasons, extractionFailed, answers }],
//     items:    [{ id, sectionKey, questionId, number, topLevelId, topLevelNumber, questionText, parentContext,
//                  maxMarks, commandVerb, requestedPoints, answerText, answerIds, pages, hasDiagram,
//                  extractionStatus, matchStatus, sourceStatus, gradingStatus, awarded, proposedAwarded,
//                  confidence, rationale, strengths, missing, improvement, feedbackStatus, criteria,
//                  criteriaSource, markingGuide, flags, failureReason, history }],
//     acknowledged: [issueKey], audit: [{ at, by, action, itemId?, from?, to?, reason? }]
//   }
//
// Only leaf (assessable) items carry marks. Parent totals are cross-checks, never added.

import { answersForGrading, buildQuestionIndex, deriveQuestionStatuses } from './answerMatching.js';

export const GRADING_STATUS = {
  NOT_STARTED: 'not_started',
  PROCESSING: 'processing',
  GRADED: 'graded',          // AI mark accepted by validation
  MANUAL: 'manual',          // mark set or confirmed by a teacher
  NEEDS_REVIEW: 'needs_review', // provisional AI mark that a teacher must confirm
  FAILED: 'failed',          // grading request failed — not a zero
  BLANK: 'blank',            // no response in a complete booklet — 0 is defensible
  UNRESOLVED: 'unresolved',  // unreadable / unmatched / incomplete source / missing max marks
};

const SCORED = new Set([GRADING_STATUS.GRADED, GRADING_STATUS.MANUAL, GRADING_STATUS.BLANK]);
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

const now = () => new Date().toISOString();
let seq = 0;
export function newResultId() {
  seq += 1;
  return `gr_${Date.now().toString(36)}_${seq.toString(36)}`;
}

// ── Question requirements ───────────────────────────────────────────────────

const VERBS = [
  ['define', 'Give an accurate meaning of the term. Credit precise, correct definitions; examples are a bonus only if asked.'],
  ['state', 'Give the requested facts or points briefly. Explanation is not required.'],
  ['list', 'Give the requested number of relevant points. Explanation is not required.'],
  ['name', 'Give the requested number of correct names or terms.'],
  ['identify', 'Pick out the correct items or features. Brief answers are acceptable.'],
  ['outline', 'Give the main points with brief description, without full development.'],
  ['describe', 'Give an accurate account of the features or process, with relevant detail.'],
  ['explain', 'Give each point AND why or how it applies (cause, mechanism or significance). Listing points without explanation earns only partial credit.'],
  ['discuss', 'Give a developed, relevant discussion: points with explanation, examples and, where appropriate, different perspectives or a conclusion.'],
  ['compare', 'Identify meaningful similarities and/or differences, relating both items on the same criteria.'],
  ['contrast', 'Identify meaningful differences between the items on the same criteria.'],
  ['analyse', 'Break the topic into parts and explain relationships, causes or effects with supporting evidence.'],
  ['analyze', 'Break the topic into parts and explain relationships, causes or effects with supporting evidence.'],
  ['evaluate', 'Weigh strengths and weaknesses or evidence and reach a supported judgement.'],
  ['assess', 'Weigh the importance or effectiveness of factors and reach a supported judgement.'],
  ['justify', 'Give reasons or evidence that support the position or decision.'],
  ['propose', 'Suggest appropriate, realistic solutions that address the stated problem; credit practicality and relevance.'],
  ['suggest', 'Put forward plausible, relevant ideas or solutions.'],
  ['recommend', 'Put forward appropriate, justified actions.'],
  ['design', 'Provide a coherent, practical plan whose parts fit together and meet the stated requirements.'],
  ['calculate', 'Show correct working and a correct final answer with units. Award method marks for correct working even if the final answer is wrong.'],
  ['solve', 'Show correct working and a correct final answer. Award method marks for correct working.'],
  ['draw', 'Produce an accurate, labelled drawing or diagram as requested.'],
  ['illustrate', 'Use examples or diagrams that clearly support the point.'],
  ['examine', 'Investigate the topic in detail, explaining key aspects and their implications.'],
];

/** The task word of a question ("explain", "discuss" …) and how to grade it. */
export function detectCommandVerb(text) {
  const t = String(text || '').toLowerCase();
  let best = null;
  for (const [verb, guidance] of VERBS) {
    const m = t.match(new RegExp(`\\b${verb}(?:s|d|e)?\\b`));
    if (m && (best === null || m.index < best.index)) best = { verb, guidance, index: m.index };
  }
  return best ? { verb: best.verb, guidance: best.guidance } : { verb: null, guidance: 'Grade on relevance, accuracy and completeness relative to what the question asks.' };
}

/** "List three…", "Give 2 reasons", "any four examples" -> 3 / 2 / 4. */
export function detectRequestedPoints(text) {
  const t = String(text || '').toLowerCase();
  const m = t.match(/\b(?:any\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\(\d+\)\s+)?(?:main\s+|key\s+|major\s+|different\s+|possible\s+)?(?:reasons?|points?|examples?|ways?|factors?|causes?|effects?|advantages?|disadvantages?|benefits?|challenges?|functions?|types?|levels?|features?|characteristics?|principles?|strategies|solutions?|methods?|roles?|differences?|similarities?|steps?|stages?|measures?|uses?|problems?|components?|elements?)\b/);
  if (!m) return null;
  return WORDS[m[1]] || parseInt(m[1], 10) || null;
}

/** Parse exam instructions for optional-question rules: "Answer any THREE (3) questions" -> { choose: 3 }. */
export function parseOptionalRule(instructions = []) {
  const text = (Array.isArray(instructions) ? instructions : [instructions]).join(' ').toLowerCase();
  if (!text) return null;
  if (/\banswer\s+all\b|\battempt\s+all\b/.test(text) && !/\bany\b/.test(text)) return null;
  const m = text.match(/\b(?:answer|attempt|choose|select)\s+(?:any\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b(?:\s*\(\d+\))?\s+(?:other\s+)?(?:of\s+the\s+(?:following\s+)?)?questions?/);
  if (!m) return null;
  const choose = WORDS[m[1]] || parseInt(m[1], 10);
  if (!choose) return null;
  return { choose, complex: /compulsory|mandatory|must\s+answer|question\s+\w+\s+and\s+any/.test(text), text: (Array.isArray(instructions) ? instructions : [instructions]).join(' ') };
}

// ── Building a result ───────────────────────────────────────────────────────

function parentsFromTree(tree = [], questions = []) {
  const ids = new Set(questions.map(q => q.topLevelId).filter(Boolean));
  return (Array.isArray(tree) ? tree : []).filter(n => n.children?.length && (ids.has(n.id) || !ids.size)).map(n => ({
    id: n.id,
    number: n.label,
    declaredMarks: n.marks ?? null,
    text: n.text || '',
  }));
}

function extractionStatusOf(records) {
  if (!records.length) return 'none';
  if (records.every(r => r.readability === 'unreadable')) return 'unreadable';
  if (records.some(r => r.readability === 'partial')) return 'partial';
  return 'readable';
}

function matchStatusOf(records) {
  if (!records.length) return 'none';
  if (records.every(r => r.matchStatus === 'confirmed')) return 'confirmed';
  if (records.every(r => ['confirmed', 'matched'].includes(r.matchStatus))) return 'matched';
  return records.some(r => r.matchStatus === 'unmatched') ? 'unmatched' : 'uncertain';
}

const SOURCE_REASON = {
  unreadable: 'The answer could not be read. Check the page and type the answer, or score manually.',
  uncertain_match: 'The answer has not been confirmed as belonging to this question.',
  multiple_answers: 'The question was answered more than once — choose which version to grade.',
  crossed_out_only: 'Only crossed-out work was found — decide whether to grade it.',
  not_found_incomplete: 'No answer found, but the booklet may be incomplete — check for missing pages.',
  extraction_failed: 'The answer pages could not be read.',
};

function buildItem(section, q, g, previous) {
  const questionText = q.ownText || q.text || '';
  const parentContext = q.ownText && q.text && q.text !== q.ownText
    ? q.text.slice(0, q.text.length - q.ownText.length).replace(/QUESTION:\s*$/, '').replace(/^PASSAGE:\s*/, '').trim()
    : '';
  const maxMarks = Number(q.maxPoints) > 0 ? Number(q.maxPoints) : null;
  const records = (section.answers || []).filter(r => g.answerIds.includes(r.id) || (r.questionId === q.id && !r.excluded));
  const verb = detectCommandVerb(questionText);
  const base = {
    id: `${section.key}:${q.id}`,
    sectionKey: section.key,
    sectionLabel: section.label,
    questionId: q.id,
    number: String(q.number),
    topLevelId: q.topLevelId || q.id,
    topLevelNumber: String(q.topLevelNumber ?? q.number),
    questionText,
    parentContext,
    questionType: q.type || section.type || '',
    maxMarks,
    maxAssumed: !!q.maxAssumed && maxMarks !== null,
    commandVerb: verb.verb,
    requestedPoints: detectRequestedPoints(questionText),
    answerText: g.text,
    answerIds: g.answerIds,
    pages: g.pages,
    hasDiagram: g.hasDiagram,
    extractionStatus: section.extractionFailed ? 'failed' : extractionStatusOf(records),
    matchStatus: matchStatusOf(records),
    sourceStatus: g.status,
    markingGuide: previous?.markingGuide || '',
    history: previous?.history || [],
    flags: [],
  };

  // Unchanged answer: keep previous grading decisions.
  if (previous && previous.answerText === base.answerText && previous.maxMarks === base.maxMarks
    && JSON.stringify(previous.answerIds) === JSON.stringify(base.answerIds)) {
    return { ...previous, ...base, gradingStatus: previous.gradingStatus, flags: previous.flags };
  }

  const fresh = {
    ...base,
    gradingStatus: GRADING_STATUS.NOT_STARTED,
    awarded: null,
    proposedAwarded: null,
    confidence: null,
    rationale: '',
    strengths: [],
    missing: [],
    improvement: '',
    feedbackStatus: 'pending',
    criteria: previous?.criteria || [],
    criteriaSource: previous?.criteriaSource || 'none',
    failureReason: '',
  };
  if (previous && previous.awarded !== null && previous.awarded !== undefined) {
    fresh.history = [...fresh.history, { at: now(), by: 'system', action: 'answer_changed', from: previous.awarded, to: null, reason: 'The answer for this question changed; previous mark cleared for regrading.' }];
  }
  if (maxMarks === null) {
    return { ...fresh, gradingStatus: GRADING_STATUS.UNRESOLVED, flags: [{ code: 'missing_max', level: 'error', message: 'Maximum marks for this question are missing. Set them before grading.' }] };
  }
  if (g.status === 'no_answer_detected') {
    return { ...fresh, gradingStatus: GRADING_STATUS.BLANK, awarded: 0, rationale: 'No response was detected in the supplied pages, and the booklet appears complete.', feedbackStatus: 'accepted' };
  }
  if (!g.autoGradable) {
    return { ...fresh, gradingStatus: GRADING_STATUS.UNRESOLVED, flags: [{ code: g.status, level: 'error', message: SOURCE_REASON[g.status] || 'This answer cannot be graded automatically.' }] };
  }
  return fresh;
}

/**
 * Create a grading result from reviewed sections.
 * @param {object} args
 * @param {Array<{key, label, type, questions, questionTree?, instructions?, records, complete, completenessReasons?, extractionFailed?}>} args.sections
 */
export function createGradingResult({ id, sections }) {
  const secs = sections.map(s => ({
    key: s.key,
    label: s.label || '',
    type: s.type || '',
    questions: s.questions || [],
    parents: parentsFromTree(s.questionTree, s.questions || []),
    instructions: s.instructions || [],
    optionalRule: parseOptionalRule(s.instructions || []),
    complete: !!s.complete,
    completenessReasons: s.completenessReasons || [],
    extractionFailed: !!s.extractionFailed,
    answers: s.records || [],
    images: s.images || [],
  }));
  const result = { id: id || newResultId(), version: 1, createdAt: now(), updatedAt: now(), finalized: false, sections: secs, items: [], acknowledged: [], audit: [] };
  result.items = secs.flatMap(sec => buildSectionItems(sec, []));
  return result;
}

function buildSectionItems(sec, previousItems) {
  const grading = answersForGrading(sec.questions, sec.answers, { complete: sec.complete, extractionFailed: sec.extractionFailed });
  return sec.questions.map((q, i) => {
    const g = grading[i];
    const prev = previousItems.find(p => p.questionId === (q.id || buildQuestionIndex([q])[0].id));
    return buildItem(sec, { ...q, id: q.id || g.questionId }, g, prev);
  });
}

/**
 * Replace a section's answer records (e.g. corrected association or edited text) and rebuild its items.
 * Items whose answer did not change keep their grading. Returns { result, changedItemIds }.
 */
export function updateSectionAnswers(result, sectionKey, records, by = 'teacher') {
  if (result.finalized) throw new Error('Reopen the result before making changes.');
  const sections = result.sections.map(s => (s.key === sectionKey ? { ...s, answers: records } : s));
  const sec = sections.find(s => s.key === sectionKey);
  const oldItems = result.items.filter(i => i.sectionKey === sectionKey);
  const newItems = buildSectionItems(sec, oldItems);
  const changed = newItems.filter((n) => {
    const o = oldItems.find(x => x.id === n.id);
    return !o || o.answerText !== n.answerText || JSON.stringify(o.answerIds) !== JSON.stringify(n.answerIds);
  }).map(n => n.id);
  const items = result.items.map(i => (i.sectionKey === sectionKey ? newItems.find(n => n.id === i.id) || i : i));
  return {
    result: touch({ ...result, sections, items }, by, 'answers_updated', { reason: `Answers changed for ${changed.length} item(s).` }),
    changedItemIds: changed,
  };
}

function touch(result, by, action, extra = {}) {
  return { ...result, updatedAt: now(), audit: [...(result.audit || []), { at: now(), by, action, ...extra }] };
}

function updateItem(result, itemId, fn) {
  return { ...result, items: result.items.map(i => (i.id === itemId ? fn(i) : i)) };
}

// ── Applying AI outcomes ────────────────────────────────────────────────────

/** Items that should be sent to the AI grader. */
export function itemsNeedingGrading(result, ids = null) {
  return result.items.filter(i => (ids ? ids.includes(i.id) : true)
    && i.maxMarks !== null && i.answerText && i.sourceStatus && ['answered', 'answered_partial'].includes(i.sourceStatus)
    && [GRADING_STATUS.NOT_STARTED, GRADING_STATUS.FAILED, GRADING_STATUS.PROCESSING].concat(ids ? [GRADING_STATUS.GRADED, GRADING_STATUS.NEEDS_REVIEW] : []).includes(i.gradingStatus));
}

export function markProcessing(result, ids) {
  return { ...result, items: result.items.map(i => (ids.includes(i.id) ? { ...i, gradingStatus: GRADING_STATUS.PROCESSING, failureReason: '' } : i)) };
}

/**
 * Apply a validated AI grading outcome. Out-of-range marks are NOT capped: the proposal is kept,
 * the mark stays empty and the item needs review.
 * outcome: { awarded, confidence, rationale, strengths, missing, improvement, criteria, criteriaSource, uncertainReason }
 */
export function applyGradingOutcome(result, itemId, outcome) {
  return updateItem(result, itemId, (item) => {
    const flags = item.flags.filter(f => !['ai_score_out_of_range', 'ai_low_confidence', 'partial_text', 'ai_invalid_score', 'criteria_sum_mismatch'].includes(f.code));
    const value = typeof outcome.awarded === 'number' ? outcome.awarded : Number(outcome.awarded);
    let status = GRADING_STATUS.GRADED;
    let awarded = value;
    if (!Number.isFinite(value)) {
      status = GRADING_STATUS.NEEDS_REVIEW; awarded = null;
      flags.push({ code: 'ai_invalid_score', level: 'error', message: 'The AI did not return a valid mark. Score this item manually or regrade.' });
    } else if (value < 0 || value > item.maxMarks) {
      status = GRADING_STATUS.NEEDS_REVIEW; awarded = null;
      flags.push({ code: 'ai_score_out_of_range', level: 'error', message: `The AI proposed ${value} marks, outside the allowed 0–${item.maxMarks}. It was not applied — set the mark manually.` });
    }
    if (awarded !== null && outcome.confidence === 'low') {
      status = GRADING_STATUS.NEEDS_REVIEW;
      flags.push({ code: 'ai_low_confidence', level: 'warning', message: `The AI was unsure about this mark${outcome.uncertainReason ? `: ${outcome.uncertainReason}` : ''}. Confirm or adjust it.` });
    }
    if (outcome.criteriaSumMismatch) {
      flags.push({ code: 'criteria_sum_mismatch', level: 'warning', message: `The AI's marking criteria do not add up to ${item.maxMarks} marks. Check the rationale.` });
    }
    if (awarded !== null && item.extractionStatus === 'partial') {
      status = GRADING_STATUS.NEEDS_REVIEW;
      flags.push({ code: 'partial_text', level: 'warning', message: 'Part of this answer was unreadable, so the mark may be too low. Check the page, then confirm or adjust.' });
    }
    return {
      ...item,
      gradingStatus: status,
      awarded,
      proposedAwarded: Number.isFinite(value) ? value : null,
      confidence: outcome.confidence || null,
      rationale: outcome.rationale || '',
      strengths: outcome.strengths || [],
      missing: outcome.missing || [],
      improvement: outcome.improvement || '',
      criteria: outcome.criteria?.length ? outcome.criteria : item.criteria,
      criteriaSource: outcome.criteriaSource || item.criteriaSource,
      feedbackStatus: 'pending',
      failureReason: '',
      flags,
      history: [...item.history, { at: now(), by: 'ai', action: 'ai_graded', from: item.awarded, to: awarded, reason: Number.isFinite(value) && awarded === null ? `Proposed ${value} (not applied)` : '' }],
    };
  });
}

export function markItemFailed(result, itemId, reason) {
  return updateItem(result, itemId, item => ({
    ...item,
    gradingStatus: GRADING_STATUS.FAILED,
    awarded: item.gradingStatus === GRADING_STATUS.MANUAL ? item.awarded : null,
    failureReason: reason || 'Grading failed. Retry or score manually.',
  }));
}

// ── Moderation ──────────────────────────────────────────────────────────────

function assertOpen(result) {
  if (result.finalized) throw new Error('This result is finalized. Reopen it to make changes.');
}

/** Set a mark. Rejects out-of-range values (never caps). A reason is required when changing an existing mark. */
export function setItemMarks(result, itemId, awarded, reason = '', by = 'teacher') {
  assertOpen(result);
  const item = result.items.find(i => i.id === itemId);
  if (!item) throw new Error('Item not found.');
  if (item.maxMarks === null) throw new Error('Set the maximum marks for this question first.');
  const v = Number(awarded);
  if (!Number.isFinite(v) || v < 0 || v > item.maxMarks) throw new Error(`Marks must be between 0 and ${item.maxMarks}.`);
  if (item.awarded !== null && item.awarded !== undefined && item.awarded !== v && !String(reason).trim()) {
    throw new Error('Give a reason for changing the mark.');
  }
  const next = updateItem(result, itemId, i => ({
    ...i,
    awarded: v,
    gradingStatus: GRADING_STATUS.MANUAL,
    flags: i.flags.filter(f => !['ai_score_out_of_range', 'ai_low_confidence', 'partial_text', 'ai_invalid_score'].includes(f.code)),
    failureReason: '',
    history: [...i.history, { at: now(), by, action: 'mark_set', from: i.awarded, to: v, reason: String(reason).trim() }],
  }));
  return touch(next, by, 'mark_set', { itemId, from: item.awarded, to: v, reason: String(reason).trim() });
}

/** Accept the AI's provisional mark for an item that needed review. */
export function confirmItemMark(result, itemId, by = 'teacher') {
  assertOpen(result);
  const item = result.items.find(i => i.id === itemId);
  if (!item || item.awarded === null) throw new Error('There is no mark to confirm — set one manually.');
  const next = updateItem(result, itemId, i => ({
    ...i,
    gradingStatus: GRADING_STATUS.MANUAL,
    flags: i.flags.filter(f => !['ai_low_confidence', 'partial_text'].includes(f.code)),
    history: [...i.history, { at: now(), by, action: 'mark_confirmed', from: i.awarded, to: i.awarded, reason: '' }],
  }));
  return touch(next, by, 'mark_confirmed', { itemId, to: item.awarded });
}

/** Set missing or wrong maximum marks (clears any mark so it can be regraded). */
export function setItemMaxMarks(result, itemId, maxMarks, reason = '', by = 'teacher') {
  assertOpen(result);
  const v = Number(maxMarks);
  if (!Number.isFinite(v) || v <= 0) throw new Error('Maximum marks must be greater than 0.');
  const item = result.items.find(i => i.id === itemId);
  if (item.maxMarks !== null && item.maxMarks !== v && !String(reason).trim()) throw new Error('Give a reason for changing the maximum marks.');
  const next = updateItem(result, itemId, i => {
    const keep = i.awarded !== null && i.awarded <= v && i.gradingStatus === GRADING_STATUS.MANUAL;
    const autoGradable = ['answered', 'answered_partial'].includes(i.sourceStatus) && !!i.answerText;
    return {
      ...i,
      maxMarks: v,
      maxAssumed: false,
      awarded: keep ? i.awarded : (i.sourceStatus === 'no_answer_detected' ? 0 : null),
      gradingStatus: keep ? i.gradingStatus : i.sourceStatus === 'no_answer_detected' ? GRADING_STATUS.BLANK : autoGradable ? GRADING_STATUS.NOT_STARTED : GRADING_STATUS.UNRESOLVED,
      flags: i.flags.filter(f => f.code !== 'missing_max'),
      history: [...i.history, { at: now(), by, action: 'max_set', from: i.maxMarks, to: v, reason: String(reason).trim() }],
    };
  });
  return touch(next, by, 'max_set', { itemId, from: item.maxMarks, to: v, reason: String(reason).trim() });
}

export function setFeedbackStatus(result, itemId, status, by = 'teacher', editedText = null) {
  assertOpen(result);
  const next = updateItem(result, itemId, i => ({
    ...i,
    feedbackStatus: status,
    ...(editedText !== null ? { rationale: editedText } : null),
    history: [...i.history, { at: now(), by, action: `feedback_${status}`, reason: '' }],
  }));
  return touch(next, by, `feedback_${status}`, { itemId });
}

export function setMarkingGuide(result, itemId, guide, by = 'teacher') {
  assertOpen(result);
  return touch(updateItem(result, itemId, i => ({ ...i, markingGuide: guide })), by, 'marking_guide_set', { itemId });
}

export function acknowledgeIssue(result, key, reason = '', by = 'teacher') {
  assertOpen(result);
  if (result.acknowledged.includes(key)) return result;
  return touch({ ...result, acknowledged: [...result.acknowledged, key] }, by, 'issue_acknowledged', { reason: `${key}${reason ? `: ${reason}` : ''}` });
}

// ── Totals ──────────────────────────────────────────────────────────────────

function isAttempted(items) {
  return items.some(i => !['blank'].includes(i.gradingStatus) && !['no_answer_detected', 'not_found_incomplete', 'extraction_failed'].includes(i.sourceStatus));
}

/**
 * Totals from leaf items only (parents are cross-checks). Applies optional-question rules.
 * Returns { awarded, available, percentage, provisional, assessable, scored, needsReview, groups, issues }.
 */
export function computeTotals(result) {
  const issues = [];
  const groups = [];
  for (const sec of result.sections) {
    const items = result.items.filter(i => i.sectionKey === sec.key);
    const tops = [];
    for (const it of items) {
      let g = tops.find(t => t.topLevelId === it.topLevelId);
      if (!g) {
        const parent = sec.parents.find(p => p.id === it.topLevelId);
        g = { sectionKey: sec.key, sectionLabel: sec.label, topLevelId: it.topLevelId, number: it.topLevelNumber, declared: parent ? parent.declaredMarks : null, itemIds: [], counted: true };
        tops.push(g);
      }
      g.itemIds.push(it.id);
    }
    for (const g of tops) {
      const its = items.filter(i => g.itemIds.includes(i.id));
      g.maxKnown = its.every(i => i.maxMarks !== null);
      g.available = its.reduce((s, i) => s + (i.maxMarks || 0), 0);
      g.awarded = its.reduce((s, i) => s + (SCORED.has(i.gradingStatus) || i.gradingStatus === GRADING_STATUS.NEEDS_REVIEW ? (i.awarded || 0) : 0), 0);
      g.complete = its.every(i => SCORED.has(i.gradingStatus));
      g.attempted = isAttempted(its);
      if (g.declared !== null && g.maxKnown && Math.abs(g.available - g.declared) > 1e-9) {
        issues.push({ key: `parent_total:${sec.key}:${g.topLevelId}`, level: 'blocking', code: 'parent_total_mismatch',
          message: `Question ${g.number}: its parts are worth ${g.available} marks but the paper states ${g.declared}.`,
          fix: 'Check the maximum marks of its parts, then acknowledge if the paper itself is inconsistent.' });
      }
    }
    const rule = sec.optionalRule;
    if (rule && tops.length > rule.choose) {
      const attempted = tops.filter(t => t.attempted);
      if (attempted.length > rule.choose) {
        const ranked = [...attempted].sort((a, b) => b.awarded - a.awarded);
        const keep = new Set(ranked.slice(0, rule.choose).map(t => t.topLevelId));
        tops.forEach((t) => { t.counted = keep.has(t.topLevelId); });
        issues.push({ key: `optional_extra:${sec.key}`, level: 'blocking', code: 'optional_extra_answered',
          message: `${sec.label ? `Section ${sec.label}: ` : ''}the instructions say "${rule.text}", but ${attempted.length} questions were attempted. The best ${rule.choose} are counted provisionally.`,
          fix: 'Check the school\'s policy for extra answers, adjust if needed, then acknowledge.' });
      } else {
        const unattempted = tops.filter(t => !t.attempted).sort((a, b) => b.available - a.available);
        const filler = unattempted.slice(0, rule.choose - attempted.length);
        const keep = new Set([...attempted, ...filler].map(t => t.topLevelId));
        tops.forEach((t) => { t.counted = keep.has(t.topLevelId); });
        if (new Set(tops.map(t => t.available)).size > 1) {
          issues.push({ key: `optional_unequal:${sec.key}`, level: 'blocking', code: 'optional_unequal_marks',
            message: `${sec.label ? `Section ${sec.label}: ` : ''}optional questions have different marks, so the total available is uncertain.`,
            fix: 'Confirm the total available marks for this section, then acknowledge.' });
        }
      }
      if (rule.complex) {
        issues.push({ key: `optional_complex:${sec.key}`, level: 'blocking', code: 'optional_rule_complex',
          message: `${sec.label ? `Section ${sec.label}: ` : ''}the instructions ("${rule.text}") include compulsory questions; check which questions should count.`,
          fix: 'Verify the counted questions, then acknowledge.' });
      }
    }
    groups.push(...tops);
  }

  const counted = groups.filter(g => g.counted);
  const countedItems = result.items.filter(i => counted.some(g => g.itemIds.includes(i.id)));
  const maxKnown = countedItems.every(i => i.maxMarks !== null);
  const available = countedItems.reduce((s, i) => s + (i.maxMarks || 0), 0);
  const awarded = countedItems.reduce((s, i) => s + (SCORED.has(i.gradingStatus) || i.gradingStatus === GRADING_STATUS.NEEDS_REVIEW ? (i.awarded || 0) : 0), 0);
  const scored = result.items.filter(i => SCORED.has(i.gradingStatus)).length;
  const needsReview = result.items.filter(i => !SCORED.has(i.gradingStatus)).length;
  const provisional = needsReview > 0 || issues.some(i => !result.acknowledged.includes(i.key));
  return {
    awarded,
    available: maxKnown ? available : null,
    percentage: maxKnown && available > 0 ? Math.round((awarded / available) * 1000) / 10 : null,
    provisional,
    assessable: result.items.length,
    scored,
    needsReview,
    groups,
    issues,
  };
}

// ── Validation & lifecycle ──────────────────────────────────────────────────

const STATUS_FIX = {
  [GRADING_STATUS.NOT_STARTED]: 'Run grading, or score it manually.',
  [GRADING_STATUS.PROCESSING]: 'Wait for grading to finish.',
  [GRADING_STATUS.NEEDS_REVIEW]: 'Confirm the AI mark or set the mark manually.',
  [GRADING_STATUS.FAILED]: 'Retry grading, or score it manually.',
  [GRADING_STATUS.UNRESOLVED]: 'Resolve the answer (read, match or locate it) and regrade, or score it manually.',
};

/** Pre-finalization checks. Returns { ok, blocking: [{code, message, itemId?, fix, key?}], warnings }. */
export function validateResult(result) {
  const blocking = [];
  const warnings = [];
  const totals = computeTotals(result);
  for (const i of result.items) {
    const name = `Question ${i.number}${i.sectionLabel ? ` (Section ${i.sectionLabel})` : ''}`;
    if (!SCORED.has(i.gradingStatus)) {
      blocking.push({ code: `item_${i.gradingStatus}`, itemId: i.id, message: `${name}: ${i.flags[0]?.message || i.failureReason || 'not graded yet.'}`, fix: STATUS_FIX[i.gradingStatus] || 'Score it manually.' });
      continue;
    }
    if (i.maxMarks === null) blocking.push({ code: 'missing_max', itemId: i.id, message: `${name}: maximum marks missing.`, fix: 'Set the maximum marks.' });
    if (i.awarded === null || i.awarded < 0 || (i.maxMarks !== null && i.awarded > i.maxMarks)) {
      blocking.push({ code: 'mark_out_of_range', itemId: i.id, message: `${name}: mark ${i.awarded} is outside 0–${i.maxMarks}.`, fix: 'Set a valid mark.' });
    }
    if (i.gradingStatus === GRADING_STATUS.GRADED && i.matchStatus !== 'none' && !['matched', 'confirmed'].includes(i.matchStatus)) {
      blocking.push({ code: 'graded_unresolved_match', itemId: i.id, message: `${name}: graded against an unconfirmed answer match.`, fix: 'Confirm the answer match, then regrade.' });
    }
    if (i.gradingStatus === GRADING_STATUS.GRADED && i.feedbackStatus === 'pending') {
      warnings.push({ code: 'feedback_unreviewed', itemId: i.id, message: `${name}: AI feedback not yet reviewed.` });
    }
  }
  for (const sec of result.sections) {
    if (!sec.complete) {
      const key = `incomplete:${sec.key}`;
      if (!result.acknowledged.includes(key)) {
        blocking.push({ code: 'incomplete_source', key, message: `${sec.label ? `Section ${sec.label}: ` : ''}the answer booklet may be incomplete${sec.completenessReasons.length ? ` (${sec.completenessReasons.join(' ')})` : ''}.`, fix: 'Add the missing pages and regrade, or acknowledge that the booklet is complete as supplied.' });
      }
    }
    const orphans = (sec.answers || []).filter(r => !r.questionId && !r.excluded);
    if (orphans.length) {
      blocking.push({ code: 'unmatched_answers', message: `${sec.label ? `Section ${sec.label}: ` : ''}${orphans.length} answer${orphans.length === 1 ? ' is' : 's are'} not assigned to any question.`, fix: 'Assign each answer to a question, or mark it as not graded.' });
    }
  }
  for (const iss of totals.issues) {
    if (!result.acknowledged.includes(iss.key)) blocking.push(iss);
  }
  if (result.items.some(i => i.maxAssumed) && !result.acknowledged.includes('assumed_max')) {
    blocking.push({ code: 'assumed_max', key: 'assumed_max', message: 'Maximum marks were not on the question paper; they were split evenly from the test total.', fix: 'Check each question\'s maximum marks (edit any that are wrong), then acknowledge.' });
  }
  const ids = result.items.map(i => i.id);
  if (new Set(ids).size !== ids.length) blocking.push({ code: 'duplicate_items', message: 'Duplicate grading records were found.', fix: 'Regrade the script.' });
  if (totals.available === null) blocking.push({ code: 'total_unknown', message: 'The total available marks are unknown because some maximum marks are missing.', fix: 'Set the missing maximum marks.' });
  return { ok: blocking.length === 0, blocking, warnings, totals };
}

/** Overall state: not_started | processing | graded | needs_review | failed | finalized. */
export function resultStatus(result) {
  if (!result || !result.items?.length) return 'not_started';
  if (result.finalized) return 'finalized';
  if (result.items.some(i => i.gradingStatus === GRADING_STATUS.PROCESSING)) return 'processing';
  const gradable = result.items.filter(i => i.gradingStatus !== GRADING_STATUS.BLANK);
  if (gradable.length && gradable.every(i => i.gradingStatus === GRADING_STATUS.FAILED)) return 'failed';
  if (result.items.every(i => i.gradingStatus === GRADING_STATUS.NOT_STARTED)) return 'not_started';
  return validateResult(result).ok ? 'graded' : 'needs_review';
}

export function finalizeResult(result, by = 'teacher') {
  const v = validateResult(result);
  if (!v.ok) {
    const err = new Error(`Cannot finalize: ${v.blocking.length} issue${v.blocking.length === 1 ? '' : 's'} remaining.`);
    err.validation = v;
    throw err;
  }
  return touch({ ...result, finalized: true, finalizedAt: now(), finalizedBy: by }, by, 'finalized', { to: v.totals.awarded });
}

export function reopenResult(result, reason = '', by = 'teacher') {
  if (!result.finalized) return result;
  if (!String(reason).trim()) throw new Error('Give a reason for reopening a finalized result.');
  return touch({ ...result, finalized: false, finalizedAt: null, finalizedBy: null }, by, 'reopened', { reason: String(reason).trim() });
}

/** Map items back to the legacy flat scores array ({ question, points, maxPoints }) used by older screens. */
export function toLegacyScores(result, scores = []) {
  return scores.map((s, idx) => {
    const item = result.items[idx];
    if (!item) return s;
    return {
      ...s,
      points: item.awarded ?? 0,
      maxPoints: item.maxMarks ?? s.maxPoints,
      needsManual: !SCORED.has(item.gradingStatus),
      answerStatus: item.sourceStatus,
    };
  });
}

/** Compact per-item summary for saving with a scan and for the PDF export. */
export function toGradingResultsList(result) {
  const totals = computeTotals(result);
  const counted = new Set(totals.groups.filter(g => g.counted).flatMap(g => g.itemIds));
  return result.items.map(i => ({
    question: i.number,
    section: i.sectionLabel,
    points: i.awarded,
    maxPoints: i.maxMarks,
    gradingStatus: i.gradingStatus,
    counted: counted.has(i.id),
    status: i.awarded === null ? 'review' : i.awarded >= i.maxMarks ? 'correct' : i.awarded > 0 ? 'partial' : 'incorrect',
  }));
}

export { deriveQuestionStatuses };
