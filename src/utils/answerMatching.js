// Answer-booklet records and question matching.
//
// Pure JavaScript (no React Native imports) so it can be unit-tested with `node --test`.
//
// An answer record is one contiguous handwritten response (possibly spanning pages):
//   {
//     id, sectionLabel, order,
//     rawLabel, normalizedLabel, labelConfidence, labelAlternatives,
//     text, readability ('readable'|'partial'|'unreadable'), handwritingConfidence,
//     boundaryConfidence, pages, regions: [{ page, top, bottom }],
//     continuesFromPrevious, continuationConfidence, continuesOnNextPage,
//     crossedOut, hasDiagram,
//     questionId,          // proposed association (Stage 1 question id) or null
//     matchStatus,         // 'matched' | 'confirmed' | 'suggested' | 'needs_review' | 'unmatched'
//     matchMethod,         // 'label' | 'label_variant' | 'semantic' | 'continuation' | 'manual'
//     matchConfidence,     // 'high' | 'medium' | 'low'
//     matchReasons: [],    // human-readable evidence
//     excluded,            // not graded (crossed out, or another version chosen)
//     flaggedForReview,    // teacher asked for manual review
//     duplicateConflict, needsManualCorrection  // derived by refreshAnswerFlags()
//   }
//
// Confidence values are the model's own categorical self-reports (high/medium/low) or the
// documented heuristics below. No numeric percentages are invented.

import { parseLabelPath, displayLabel } from './questionHierarchy.js';

/**
 * Tunable thresholds for the lexical-similarity heuristic. Similarity is the cosine between the
 * answer's and the question's sets of content words (stop words removed, crude stemming), with
 * each word weighted by IDF across the paper's questions so words shared by many questions
 * ("health", "explain") count less. Range 0..1. It is a coarse signal used only to suggest or
 * flag — never to override an explicit, readable label.
 */
export const MATCH_THRESHOLDS = {
  minAnswerWordsForContent: 8,    // shorter answers are too short to judge content
  suggestMinOverlap: 0.2,         // unlabelled answer: best question must reach this similarity
  suggestMinMargin: 0.08,         // ...and beat the runner-up by this much
  conflictMaxLabelOverlap: 0.1,   // labelled answer's similarity to its own question at most this...
  conflictMinOtherOverlap: 0.3,   // ...while another question reaches at least this
};

const READABILITY_RANK = { readable: 0, partial: 1, unreadable: 2 };
const CONF_RANK = { high: 0, medium: 1, low: 2 };
const GRADABLE_STATUSES = new Set(['matched', 'confirmed']);
const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

function worstConf(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return CONF_RANK[a] >= CONF_RANK[b] ? a : b;
}

function normConf(v) {
  return v === 'high' || v === 'medium' || v === 'low' ? v : null;
}

// ── Labels ──────────────────────────────────────────────────────────────────

/**
 * Normalize a handwritten answer label.
 * "Q3(a)", "3 (a)", "3A", "Question 3A", "Ans 3a" -> { segments: ["3","a"], normalized: "3.a" }
 * "3(b)(i)" -> "3.b.i". Returns null for empty labels.
 */
export function normalizeAnswerLabel(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/^(?:ans(?:wer)?|no)\.?\s*/i, '');
  s = s.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, (w) => String(WORD_NUMBERS[w.toLowerCase()]));
  const segments = parseLabelPath(s).map(x => String(x).toLowerCase());
  if (!segments.length) return null;
  return { segments, normalized: segments.join('.') };
}

/** Build a lookup index from Stage 1 assessable items (flattenAssessable output) or simple numbered questions. */
export function buildQuestionIndex(questions = []) {
  return questions.map((q, i) => {
    const segs = parseLabelPath(String(q.number ?? i + 1)).map(x => String(x).toLowerCase());
    return {
      id: q.id || `q${segs.join('_') || i + 1}`,
      number: String(q.number ?? i + 1),
      path: segs,
      text: q.ownText || q.text || '',
      fullText: q.text || '',
      maxPoints: q.maxPoints || 0,
      type: q.type,
      index: i,
    };
  });
}

const samePath = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);
const isPrefix = (pre, full) => pre.length < full.length && pre.every((s, i) => s === full[i]);

function ordinalSwap(seg) {
  if (/^\d+$/.test(seg)) { const n = parseInt(seg, 10); return n >= 1 && n <= 26 ? String.fromCharCode(96 + n) : null; }
  if (/^[a-z]$/.test(seg)) return String(seg.charCodeAt(0) - 96);
  return null;
}

/**
 * Resolve label segments against the question hierarchy (never creates questions).
 * kind: 'exact' | 'variant' (1<->a style equivalence) | 'deeper' (more specific than the paper)
 *     | 'parent' (refers to a question that has parts) | 'none'
 */
export function resolveLabel(segments, index) {
  if (!segments || !segments.length) return { kind: 'none', questionId: null, candidates: [] };
  const exact = index.find(q => samePath(q.path, segments));
  if (exact) return { kind: 'exact', questionId: exact.id, candidates: [exact.id] };

  const children = index.filter(q => isPrefix(segments, q.path));
  if (children.length) return { kind: 'parent', questionId: null, candidates: children.map(c => c.id) };

  const ancestor = index.find(q => isPrefix(q.path, segments));
  if (ancestor) return { kind: 'deeper', questionId: ancestor.id, candidates: [ancestor.id] };

  if (segments.length > 1) {
    const swapped = segments.map((s, i) => (i === 0 ? s : (ordinalSwap(s) || s)));
    const v = index.find(q => samePath(q.path, swapped));
    if (v) return { kind: 'variant', questionId: v.id, candidates: [v.id] };
  }
  return { kind: 'none', questionId: null, candidates: [] };
}

const CONFUSABLE = {
  '3': ['8', '5', 'B'], '8': ['3', 'B', '0', '6'], 'B': ['8', '3'], 'b': ['6', 'h'],
  '1': ['7', 'I', 'l'], '7': ['1'], 'I': ['1'], 'l': ['1'],
  '5': ['S', '6', '3'], 'S': ['5'], '6': ['b', '0', '8'], '0': ['O', '6', '8'], 'O': ['0'],
  '4': ['9'], '9': ['4'], '2': ['Z'], 'Z': ['2'],
  'a': ['d', 'o'], 'd': ['a'], 'c': ['e'], 'e': ['c'], 'i': ['1', 'l'],
};

/** Labels one handwriting confusion away from `raw` that resolve to an existing question. */
export function confusableMatches(raw, index, excludeId = null) {
  const s = String(raw || '');
  const found = new Map();
  for (let i = 0; i < s.length; i++) {
    for (const alt of CONFUSABLE[s[i]] || []) {
      const variant = s.slice(0, i) + alt + s.slice(i + 1);
      const n = normalizeAnswerLabel(variant);
      const r = n && resolveLabel(n.segments, index);
      if (r && (r.kind === 'exact' || r.kind === 'variant') && r.questionId !== excludeId && !found.has(r.questionId)) {
        found.set(r.questionId, variant);
      }
    }
  }
  return [...found.entries()].map(([questionId, label]) => ({ questionId, label }));
}

// ── Lexical overlap heuristic ───────────────────────────────────────────────

const STOP = new Set(('the a an and or of to in on for with by from at as is are was were be been being this that these those it its '
  + 'their there which what when where who whom how why your you they them his her our can could should would will may might must '
  + 'explain discuss describe state outline identify define list give name propose suggest analyse analyze evaluate examine compare '
  + 'contrast justify illustrate briefly using use used marks mark answer question following each two three four five main some '
  + 'also into about more most than other such very well have has had does did done make made way ways').split(' '));

function stem(w) {
  return (w.replace(/(ations?|ings?|ments?|ness|ities|ity|ies|es|ed|ly|s)$/, '') || w).replace(/e$/, '');
}

export function contentWords(text) {
  return (String(text || '').toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])
    .filter(w => !STOP.has(w))
    .map(stem)
    .filter(w => w.length >= 3);
}

/** Weighted cosine similarity between the content-word sets of an answer and a question (0..1). */
export function lexicalOverlap(answerText, questionText, weight = () => 1) {
  const q = new Set(contentWords(questionText));
  const a = new Set(contentWords(answerText));
  if (!q.size || !a.size) return 0;
  let dot = 0; let nq = 0; let na = 0;
  for (const w of q) { const x = weight(w) ** 2; nq += x; if (a.has(w)) dot += x; }
  for (const w of a) na += weight(w) ** 2;
  return dot / Math.sqrt(nq * na);
}

function rankByContent(text, index) {
  const df = new Map();
  const qWords = index.map(q => new Set(contentWords(q.fullText || q.text)));
  qWords.forEach(set => set.forEach(w => df.set(w, (df.get(w) || 0) + 1)));
  const n = index.length || 1;
  const weight = (w) => Math.log(1 + n / (df.get(w) || 1));
  return index
    .map(q => ({ id: q.id, overlap: lexicalOverlap(text, q.fullText || q.text, weight) }))
    .sort((x, y) => y.overlap - x.overlap);
}

// ── Building records ────────────────────────────────────────────────────────

function readabilityOf(raw, text) {
  if (raw.readability === 'unreadable' || raw.readability === 'partial' || raw.readability === 'readable') {
    if (raw.readability === 'readable' && /\[(?:illegible|unclear|\?)[^\]]*\]/i.test(text)) return 'partial';
    return raw.readability;
  }
  if (!text.trim()) return 'unreadable';
  return /\[(?:illegible|unclear|\?)[^\]]*\]/i.test(text) ? 'partial' : 'readable';
}

/** Normalize raw extraction output into answer records (before matching). */
export function normalizeRawAnswers(rawAnswers, { sectionLabel = '', idPrefix = '' } = {}) {
  const list = Array.isArray(rawAnswers) ? rawAnswers : [];
  return list.filter(a => a && typeof a === 'object').map((a, i) => {
    const text = String(a.text ?? a.answer ?? '').trim();
    const rawLabel = a.label === null || a.label === undefined || String(a.label).trim() === '' ? null : String(a.label).trim();
    const norm = normalizeAnswerLabel(rawLabel);
    const start = parseInt(a.startPage ?? a.page, 10) || null;
    const end = parseInt(a.endPage, 10) || start;
    const pages = start ? Array.from({ length: Math.max(1, (end || start) - start + 1) }, (_, k) => start + k) : [];
    const regions = (Array.isArray(a.regions) ? a.regions : [])
      .map(r => ({ page: parseInt(r.page, 10) || start, top: clamp01(r.top), bottom: clamp01(r.bottom) }))
      .filter(r => r.page && r.top !== null && r.bottom !== null && r.bottom > r.top);
    return {
      id: a.id || `${idPrefix}a${i + 1}`,
      sectionLabel,
      order: Number.isFinite(a.order) ? a.order : i,
      rawLabel,
      normalizedLabel: norm ? norm.normalized : null,
      labelSegments: norm ? norm.segments : [],
      labelConfidence: rawLabel ? (normConf(a.labelConfidence) || 'medium') : null,
      labelAlternatives: (Array.isArray(a.labelAlternatives) ? a.labelAlternatives : []).map(String).filter(Boolean),
      text,
      readability: readabilityOf(a, text),
      handwritingConfidence: normConf(a.handwritingConfidence),
      boundaryConfidence: normConf(a.boundaryConfidence) || 'medium',
      pages,
      regions,
      continuesFromPrevious: a.continuesFromPreviousPage === true || a.continuesFromPrevious === true,
      continuesLabel: a.continuesLabel ? normalizeAnswerLabel(a.continuesLabel)?.normalized || null : null,
      continuationConfidence: normConf(a.continuationConfidence),
      continuesOnNextPage: a.continuesOnNextPage === true,
      crossedOut: a.crossedOut === true,
      hasDiagram: a.hasDiagram === true,
      diagramDescription: a.diagramDescription ? String(a.diagramDescription) : '',
      modelSuggestion: a.suggestedQuestion ? String(a.suggestedQuestion) : null,
      modelSuggestionReason: a.suggestionReason ? String(a.suggestionReason) : '',
      modelContentMatchesLabel: a.contentMatchesLabel === false ? false : (a.contentMatchesLabel === true ? true : null),
      notes: a.notes ? String(a.notes) : '',
      questionId: null,
      matchStatus: 'unmatched',
      matchMethod: null,
      matchConfidence: null,
      matchReasons: [],
      suggestedQuestionId: null,
      candidateQuestionIds: [],
      excluded: a.crossedOut === true,
      flaggedForReview: false,
      duplicateConflict: false,
      needsManualCorrection: false,
    };
  });
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n > 1 && n <= 100 ? n / 100 : n));
}

function firstPage(r) { return r.pages[0] ?? Infinity; }
function lastPage(r) { return r.pages[r.pages.length - 1] ?? -Infinity; }

/**
 * Join unlabelled continuations onto the answer they continue. Only merges when the model
 * reported a continuation without low confidence and the pages are adjacent; otherwise the
 * record stays separate and is flagged with a suggestion.
 */
export function mergeContinuations(records) {
  const sorted = [...records].sort((a, b) => firstPage(a) - firstPage(b) || a.order - b.order);
  const out = [];
  for (const r of sorted) {
    // Target: the answer named in `continuesLabel` (latest with that label), otherwise the immediately preceding answer.
    let targetIdx = out.length - 1;
    if (r.continuesLabel) {
      const named = out.map((o, i) => (o.normalizedLabel === r.continuesLabel ? i : -1)).filter(i => i >= 0).pop();
      targetIdx = named ?? -1;
    }
    const prev = targetIdx >= 0 ? out[targetIdx] : null;
    const adjacent = prev && (firstPage(r) === lastPage(prev) + 1 || firstPage(r) === lastPage(prev));
    if (!r.rawLabel && r.continuesFromPrevious && prev && adjacent && r.continuationConfidence !== 'low' && !r.crossedOut && !prev.crossedOut) {
      out[targetIdx] = {
        ...prev,
        text: [prev.text, r.text].filter(Boolean).join('\n'),
        pages: [...new Set([...prev.pages, ...r.pages])].sort((x, y) => x - y),
        regions: [...prev.regions, ...r.regions],
        readability: READABILITY_RANK[r.readability] > READABILITY_RANK[prev.readability] ? r.readability : prev.readability,
        handwritingConfidence: worstConf(prev.handwritingConfidence, r.handwritingConfidence),
        boundaryConfidence: worstConf(prev.boundaryConfidence, r.continuationConfidence || 'medium'),
        continuesOnNextPage: r.continuesOnNextPage,
        hasDiagram: prev.hasDiagram || r.hasDiagram,
        mergedFrom: [...(prev.mergedFrom || [prev.id]), r.id],
      };
      continue;
    }
    if (!r.rawLabel && r.continuesFromPrevious && prev) {
      out.push({ ...r, possibleContinuationOf: prev.id });
      continue;
    }
    out.push(r);
  }
  return out;
}

// ── Matching ────────────────────────────────────────────────────────────────

function setMatch(r, fields) {
  Object.assign(r, fields);
  return r;
}

/**
 * Match answer records to the Stage 1 question hierarchy.
 * Evidence order: explicit label -> hierarchy consistency -> page/sequence (continuations)
 * -> content similarity (model suggestion + lexical overlap). A clear label is never
 * overridden by content; a conflict is flagged for review instead.
 */
export function matchAnswersToQuestions(rawRecords, questions, options = {}) {
  const t = { ...MATCH_THRESHOLDS, ...(options.thresholds || {}) };
  const index = buildQuestionIndex(questions);
  const byId = new Map(index.map(q => [q.id, q]));
  const label = (id) => (byId.get(id) ? byId.get(id).number : '?');
  const records = mergeContinuations(rawRecords.map(r => ({ ...r, matchReasons: [] })));

  for (const r of records) {
    const enoughWords = contentWords(r.text).length >= t.minAnswerWordsForContent;
    const ranking = enoughWords ? rankByContent(r.text, index) : [];

    if (r.rawLabel) {
      const res = resolveLabel(r.labelSegments, index);
      const altMatches = [
        ...r.labelAlternatives.map((alt) => {
          const n = normalizeAnswerLabel(alt);
          const ar = n && resolveLabel(n.segments, index);
          return ar && ar.questionId && ar.questionId !== res.questionId ? { questionId: ar.questionId, label: alt } : null;
        }).filter(Boolean),
        ...(r.labelConfidence === 'low' ? confusableMatches(r.rawLabel, index, res.questionId) : []),
      ].filter((m, i, arr) => arr.findIndex(x => x.questionId === m.questionId) === i);

      if (res.kind === 'exact' || res.kind === 'variant' || res.kind === 'deeper') {
        setMatch(r, { questionId: res.questionId, matchMethod: res.kind === 'exact' ? 'label' : 'label_variant' });
        r.matchReasons.push(res.kind === 'exact'
          ? `Labelled "${r.rawLabel}" → Question ${label(res.questionId)}.`
          : res.kind === 'deeper'
            ? `Labelled "${r.rawLabel}", which is more specific than the paper's Question ${label(res.questionId)}.`
            : `Labelled "${r.rawLabel}"; the paper numbers this part ${label(res.questionId)}.`);
        let status = res.kind === 'exact' ? 'matched' : 'suggested';
        let conf = res.kind === 'exact' ? (r.labelConfidence === 'high' ? 'high' : 'medium') : 'medium';

        if (r.labelConfidence === 'low' || altMatches.length) {
          status = 'needs_review';
          conf = 'low';
          r.candidateQuestionIds = [res.questionId, ...altMatches.map(m => m.questionId)];
          r.matchReasons.push(altMatches.length
            ? `The handwritten label is unclear — it could also be ${altMatches.map(m => `"${m.label}" (Question ${label(m.questionId)})`).join(' or ')}.`
            : 'The handwritten label is hard to read.');
        }

        const own = ranking.find(x => x.id === res.questionId)?.overlap ?? null;
        const best = ranking.find(x => x.id !== res.questionId);
        const lexicalConflict = own !== null && best && own <= t.conflictMaxLabelOverlap && best.overlap >= t.conflictMinOtherOverlap;
        if (r.modelContentMatchesLabel === false || lexicalConflict) {
          status = 'needs_review';
          conf = 'low';
          const other = lexicalConflict ? best.id : null;
          if (other && !r.candidateQuestionIds.includes(other)) r.candidateQuestionIds = [res.questionId, ...r.candidateQuestionIds.filter(x => x !== res.questionId), other];
          r.suggestedQuestionId = other;
          r.matchReasons.push(other
            ? `The content looks closer to Question ${label(other)} than to ${label(res.questionId)}. The label was kept — please check.`
            : 'The reader reported that the content does not seem to answer the labelled question. The label was kept — please check.');
        }
        setMatch(r, { matchStatus: status, matchConfidence: conf });
        continue;
      }

      if (res.kind === 'parent') {
        const childRank = ranking.filter(x => res.candidates.includes(x.id));
        const [c1, c2] = childRank;
        r.candidateQuestionIds = res.candidates;
        const topNumber = r.labelSegments[0];
        if (c1 && c1.overlap >= t.suggestMinOverlap && (!c2 || c1.overlap - c2.overlap >= t.suggestMinMargin)) {
          setMatch(r, { questionId: c1.id, suggestedQuestionId: c1.id, matchStatus: 'suggested', matchMethod: 'semantic', matchConfidence: 'low' });
          r.matchReasons.push(`Labelled "${r.rawLabel}", but Question ${topNumber} has several parts. The content is closest to ${label(c1.id)}.`);
        } else {
          setMatch(r, { questionId: null, matchStatus: 'needs_review', matchMethod: null, matchConfidence: 'low' });
          r.matchReasons.push(`Labelled "${r.rawLabel}", but Question ${topNumber} has several parts — choose which part this answers.`);
        }
        continue;
      }

      // Label does not exist on the paper.
      const variants = [...confusableMatches(r.rawLabel, index), ...altMatches].filter((m, i, arr) => arr.findIndex(x => x.questionId === m.questionId) === i);
      r.candidateQuestionIds = variants.map(v => v.questionId);
      if (variants.length === 1) {
        setMatch(r, { questionId: variants[0].questionId, suggestedQuestionId: variants[0].questionId, matchStatus: 'needs_review', matchMethod: 'label_variant', matchConfidence: 'low' });
        r.matchReasons.push(`"${r.rawLabel}" is not a question on this paper. It may be "${variants[0].label}" (Question ${label(variants[0].questionId)}).`);
      } else {
        setMatch(r, { questionId: null, matchStatus: 'needs_review', matchMethod: null, matchConfidence: 'low' });
        r.matchReasons.push(`"${r.rawLabel}" is not a question on this paper${variants.length ? ` (could be ${variants.map(v => `"${v.label}"`).join(' or ')})` : ''}.`);
      }
      continue;
    }

    // ── Unlabelled ──
    if (r.possibleContinuationOf) {
      const prev = records.find(x => x.id === r.possibleContinuationOf);
      if (prev && prev.questionId) {
        setMatch(r, { questionId: prev.questionId, suggestedQuestionId: prev.questionId, matchStatus: 'suggested', matchMethod: 'continuation', matchConfidence: 'low' });
        r.matchReasons.push(`No label. It may continue the answer to Question ${label(prev.questionId)} from the previous page, but this is uncertain.`);
        continue;
      }
    }
    const modelRes = r.modelSuggestion ? resolveLabel(normalizeAnswerLabel(r.modelSuggestion)?.segments, index) : null;
    const modelId = modelRes && ['exact', 'variant'].includes(modelRes.kind) ? modelRes.questionId : null;
    const [b1, b2] = ranking;
    const lexicalId = b1 && b1.overlap >= t.suggestMinOverlap && (!b2 || b1.overlap - b2.overlap >= t.suggestMinMargin) ? b1.id : null;
    // The reader model's content-based suggestion outranks the coarse lexical heuristic; disagreement lowers confidence.
    const pick = modelId || lexicalId;
    if (pick) {
      setMatch(r, { questionId: pick, suggestedQuestionId: pick, matchStatus: 'suggested', matchMethod: 'semantic', matchConfidence: modelId && lexicalId === modelId ? 'medium' : 'low' });
      r.matchReasons.push(`No question number written. Suggested Question ${label(pick)}${
        pick === modelId && r.modelSuggestionReason ? `: ${r.modelSuggestionReason}` : ' because the answer uses the same key terms.'}`);
      if (modelId && lexicalId && modelId !== lexicalId) r.matchReasons.push(`Key terms also point to Question ${label(lexicalId)}.`);
      r.candidateQuestionIds = [...new Set([modelId, lexicalId].filter(Boolean))];
    } else {
      setMatch(r, { questionId: null, matchStatus: 'unmatched', matchMethod: null, matchConfidence: null });
      r.matchReasons.push('No question number written and the content does not clearly match one question.');
    }
  }
  return refreshAnswerFlags(records);
}

// ── Derived flags, statuses and grading input ───────────────────────────────

function isGradable(r) {
  return GRADABLE_STATUSES.has(r.matchStatus) && !r.excluded && !r.flaggedForReview && r.readability !== 'unreadable' && !!r.questionId;
}

/** Recompute duplicate conflicts and manual-correction flags. Call after every edit. */
export function refreshAnswerFlags(records) {
  const active = records.filter(r => r.questionId && !r.excluded);
  const groups = new Map();
  for (const r of active) {
    if (!groups.has(r.questionId)) groups.set(r.questionId, []);
    groups.get(r.questionId).push(r);
  }
  return records.map((r) => {
    const group = r.questionId && !r.excluded ? groups.get(r.questionId) || [] : [];
    // Several pieces labelled more specifically than the paper (e.g. 3(a)(i), 3(a)(ii) under 3A) are one answer.
    const allSubParts = group.length > 1 && group.every(g => g.matchMethod === 'label_variant' && g.normalizedLabel)
      && new Set(group.map(g => g.normalizedLabel)).size === group.length;
    const duplicateConflict = group.length > 1 && !allSubParts && !r.duplicateResolved;
    const needsManualCorrection = duplicateConflict || r.flaggedForReview || ['suggested', 'needs_review', 'unmatched'].includes(r.matchStatus);
    return { ...r, duplicateConflict, duplicateIds: duplicateConflict ? group.filter(g => g.id !== r.id).map(g => g.id) : [], needsManualCorrection };
  });
}

/**
 * Decide whether the uploaded booklet is complete enough to say "no answer found" means unanswered.
 * Returns { complete: boolean, reasons: string[] }.
 */
export function assessBookletCompleteness({ pageCount = 0, expectedPages = null, failedPages = [], printedPageNumbers = [], bookletAppearsIncomplete = false, incompleteReason = '', records = [] } = {}) {
  const reasons = [];
  if (!pageCount) reasons.push('No answer pages were uploaded.');
  if (expectedPages && pageCount < expectedPages) reasons.push(`Only ${pageCount} of ${expectedPages} expected pages were uploaded.`);
  if (failedPages.length) reasons.push(`Page${failedPages.length > 1 ? 's' : ''} ${failedPages.join(', ')} could not be read.`);
  const printed = printedPageNumbers.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  for (let i = 1; i < printed.length; i++) {
    if (printed[i] - printed[i - 1] > 1) reasons.push(`Booklet page numbers jump from ${printed[i - 1]} to ${printed[i]} — a page may be missing.`);
  }
  if (bookletAppearsIncomplete) reasons.push(incompleteReason || 'The booklet looks incomplete.');
  const lastPageNo = Math.max(0, ...records.flatMap(r => r.pages));
  if (records.some(r => r.continuesOnNextPage && r.pages.includes(lastPageNo) && lastPageNo >= pageCount)) {
    reasons.push('An answer continues beyond the last uploaded page.');
  }
  return { complete: reasons.length === 0, reasons };
}

export const QUESTION_STATUS_TEXT = {
  answered: 'Answer detected',
  answered_partial: 'Answer detected — partly unreadable',
  unreadable: 'Answer detected but unreadable',
  uncertain_match: 'Answer found but not confidently matched',
  multiple_answers: 'Answered more than once — choose which to grade',
  crossed_out_only: 'Only crossed-out work found — decide whether to grade it',
  no_answer_detected: 'No response detected in the supplied pages',
  not_found_incomplete: 'No response found — booklet may be incomplete',
  extraction_failed: 'Answer extraction failed',
};

/**
 * Per-question status. Distinguishes readable / partly unreadable / unreadable / unmatched answers,
 * "no response detected" (complete booklet) and "not found" (incomplete booklet or failed extraction).
 */
export function deriveQuestionStatuses(questions, records, { complete = false, extractionFailed = false } = {}) {
  const index = buildQuestionIndex(questions);
  const unresolvedOrphans = records.some(r => !r.questionId && !r.excluded);
  const out = {};
  for (const q of index) {
    const mine = records.filter(r => r.questionId === q.id && !r.excluded);
    const gradable = mine.filter(isGradable);
    const crossedOnly = records.some(r => r.questionId === q.id && r.excluded && r.crossedOut);
    let status;
    if (extractionFailed && !mine.length) status = 'extraction_failed';
    else if (!mine.length && crossedOnly) status = 'crossed_out_only';
    else if (!mine.length) status = complete && !unresolvedOrphans ? 'no_answer_detected' : 'not_found_incomplete';
    else if (mine.some(r => r.duplicateConflict)) status = 'multiple_answers';
    else if (!mine.some(r => GRADABLE_STATUSES.has(r.matchStatus)) || mine.some(r => r.flaggedForReview)) status = 'uncertain_match';
    else if (!gradable.length) status = 'unreadable';
    else if (gradable.some(r => r.readability === 'partial')) status = 'answered_partial';
    else status = 'answered';
    out[q.id] = { status, message: QUESTION_STATUS_TEXT[status], answerIds: mine.map(r => r.id) };
  }
  return out;
}

/**
 * Grading input per question, using ONLY confirmed/matched associations.
 * Returns [{ questionId, number, text, answerIds, pages, hasDiagram, status, autoGradable }].
 */
export function answersForGrading(questions, records, statusOptions = {}) {
  const index = buildQuestionIndex(questions);
  const statuses = deriveQuestionStatuses(questions, records, statusOptions);
  return index.map((q) => {
    const st = statuses[q.id];
    const use = ['answered', 'answered_partial'].includes(st.status)
      ? records.filter(r => r.questionId === q.id && isGradable(r)).sort((a, b) => firstPage(a) - firstPage(b) || a.order - b.order)
      : [];
    return {
      questionId: q.id,
      number: q.number,
      text: use.map(r => (r.hasDiagram && r.diagramDescription ? `${r.text}\n[Diagram: ${r.diagramDescription}]` : r.text)).join('\n\n'),
      answerIds: use.map(r => r.id),
      pages: [...new Set(use.flatMap(r => r.pages))],
      hasDiagram: use.some(r => r.hasDiagram),
      status: st.status,
      message: st.message,
      autoGradable: use.length > 0,
    };
  });
}

export function reviewSummary(records) {
  return {
    total: records.length,
    needsReview: records.filter(r => r.needsManualCorrection && !r.excluded).length,
    unmatched: records.filter(r => !r.questionId && !r.excluded).length,
  };
}

// ── Review edits (immutable) ────────────────────────────────────────────────

function edit(records, id, fn) {
  return refreshAnswerFlags(records.map(r => (r.id === id ? fn({ ...r }) : r)));
}

export function confirmMatch(records, id) {
  return edit(records, id, r => (r.questionId
    ? { ...r, matchStatus: 'confirmed', matchConfidence: 'high', flaggedForReview: false, matchReasons: [...r.matchReasons, 'Confirmed by teacher.'] }
    : r));
}

export function reassignAnswer(records, id, questionId, questionLabel = '') {
  return edit(records, id, r => ({
    ...r,
    questionId: questionId || null,
    matchStatus: questionId ? 'confirmed' : 'unmatched',
    matchMethod: questionId ? 'manual' : null,
    matchConfidence: questionId ? 'high' : null,
    duplicateResolved: false,
    excluded: questionId ? (r.crossedOut ? r.excluded : false) : r.excluded,
    matchReasons: [...r.matchReasons, questionId ? `Assigned to Question ${questionLabel || questionId} by teacher.` : 'Association removed by teacher.'],
  }));
}

export function editAnswerText(records, id, text) {
  return edit(records, id, r => ({
    ...r,
    text,
    readability: r.readability === 'unreadable' && text.trim() ? 'readable' : (/\[(?:illegible|unclear|\?)[^\]]*\]/i.test(text) ? 'partial' : (r.readability === 'partial' ? 'readable' : r.readability)),
    textEdited: true,
  }));
}

export function markUnreadable(records, id, unreadable = true) {
  return edit(records, id, r => ({ ...r, readability: unreadable ? 'unreadable' : (r.text.trim() ? 'readable' : 'unreadable') }));
}

export function flagForReview(records, id, flagged = true) {
  return edit(records, id, r => ({ ...r, flaggedForReview: flagged }));
}

export function setExcluded(records, id, excluded) {
  return edit(records, id, r => ({ ...r, excluded }));
}

/** Use one answer for its question; other versions for the same question are kept but excluded. */
export function chooseAnswerVersion(records, id) {
  const chosen = records.find(r => r.id === id);
  if (!chosen || !chosen.questionId) return records;
  return refreshAnswerFlags(records.map((r) => {
    if (r.id === id) return { ...r, excluded: false, matchStatus: 'confirmed', matchConfidence: 'high', duplicateResolved: true };
    if (r.questionId === chosen.questionId && !r.excluded) return { ...r, excluded: true, matchReasons: [...r.matchReasons, `Not graded: teacher chose another answer for Question ${chosen.questionId}.`] };
    return r;
  }));
}

/** Combine several answers to the same question into one graded answer (e.g. continued elsewhere). */
export function combineAnswerVersions(records, questionId) {
  return refreshAnswerFlags(records.map(r => (r.questionId === questionId && !r.excluded
    ? { ...r, matchStatus: 'confirmed', duplicateResolved: true }
    : r)));
}

export { displayLabel };
