import React from 'react';
import { extractStudentAnswers, gradeResultWithAI } from '../utils/openaiService';
import { deriveQuestionStatuses, buildQuestionIndex, reviewSummary } from '../utils/answerMatching';
import { createGradingResult, newResultId, updateSectionAnswers, computeTotals, resultStatus, toLegacyScores } from '../utils/gradingModel';
import { getAiErrorMessage } from '../utils/errors';
import { useNotifications } from '../context/NotificationsContext';

// Pipeline: 'idle' -> 'ocr' (read booklet) -> 'review' (teacher checks answer matches)
//           -> 'ai' (grade confirmed answers) -> 'done'.
// Answers are only graded through matched/confirmed associations. Questions whose answers
// could not be read or matched are flagged for manual scoring instead of being given zero.

export default function useEssayGradingPipeline(params) {
  const {
    images = [],
    sectionImages = null, // Array of { sectionIndex, label, type, images, expectedPages? }
    sectionData = [],     // From testData.sectionData — the Stage 1 question model per section
    questionCount = 0,
    questionTexts = [],
    questions = null,     // Flat question list for tests without sections (testData.extractedQuestions)
    scores = [],
    setScores = () => {},
    subject = '',
    gradeLevel = '',
    studentName = 'Student',
    testId = '',
    reviewerId = 'teacher',
  } = params || {};

  const { addNotification } = useNotifications();

  const [transcriptions, setTranscriptions] = React.useState(() => Array.from({ length: questionCount }, () => ''));
  const [aiFeedback, setAiFeedback] = React.useState(() => Array.from({ length: questionCount }, () => ''));
  const [pipelineStep, setPipelineStep] = React.useState('idle');
  const [pipelineMsg, setPipelineMsg] = React.useState('');
  const [pipelineDone, setPipelineDone] = React.useState(false);
  const [ocrPageProgress, setOcrPageProgress] = React.useState({ current: 0, total: 0 });
  const [pageTexts, setPageTexts] = React.useState([]);
  const [fullOcrText, setFullOcrText] = React.useState('');
  // { sections: [{ key, label, type, images, questions, startIdx, features, status, error, records, completeness, completeOverride, failedPages, issues, questionStatuses }] }
  const [answerReview, setAnswerReview] = React.useState(null);
  const lastImagesRef = React.useRef(null);
  // Stage 3 grading result (gradingModel). One stable id per script so re-saves update, not duplicate.
  const [gradingResult, setGradingResult] = React.useState(null);
  const [gradingBusyIds, setGradingBusyIds] = React.useState([]);
  const resultIdRef = React.useRef(null);

  const markDone = React.useCallback((message = '') => {
    setPipelineMsg(message);
    setPipelineStep('done');
    setPipelineDone(true);
  }, []);

  // One reading unit per section that has answer pages; without sections, the whole booklet.
  const readingUnits = React.useMemo(() => {
    if (sectionImages && sectionData.length > 0) {
      let globalIdx = 0;
      return sectionData.map((sec, secIdx) => {
        const qs = Array.isArray(sec.questions) ? sec.questions : [];
        const startIdx = globalIdx;
        globalIdx += qs.length;
        return {
          key: `s${secIdx}`,
          label: sec.label || '',
          type: sec.type,
          images: sectionImages[secIdx]?.images || [],
          expectedPages: sectionImages[secIdx]?.expectedPages || null,
          questions: qs,
          startIdx,
          features: { hasDiagrams: !!sec.hasDiagrams },
          questionTree: sec.questionTree || [],
          instructions: sec.instructions || [],
        };
      }).filter(u => u.questions.length > 0);
    }
    // Without extracted questions, max marks come from an even split of the test total — flagged as assumed.
    const qs = Array.isArray(questions) && questions.length
      ? questions.slice(0, questionCount || questions.length)
      : Array.from({ length: questionCount }, (_, i) => ({ number: i + 1, text: questionTexts[i] || `Question ${i + 1}`, maxPoints: scores[i]?.maxPoints || 0, maxAssumed: true }));
    return [{ key: 's0', label: '', type: '', images: images || [], expectedPages: null, questions: qs, startIdx: 0, features: {} }];
  }, [sectionImages, sectionData, questions, questionCount, questionTexts, images]); // eslint-disable-line react-hooks/exhaustive-deps

  const isComplete = (sec) => (sec.completeOverride !== undefined && sec.completeOverride !== null ? sec.completeOverride : !!sec.completeness?.complete);

  const withStatuses = (sec) => ({
    ...sec,
    questionStatuses: deriveQuestionStatuses(sec.questions, sec.records || [], { complete: isComplete(sec), extractionFailed: sec.status === 'error' }),
  });

  const readUnit = React.useCallback(async (unit, onProgress) => {
    if (!unit.images.length) {
      return withStatuses({ ...unit, status: 'error', error: 'No answer pages were captured for this section.', records: [], failedPages: [], issues: [], completeness: { complete: false, reasons: ['No pages captured.'] } });
    }
    try {
      const res = await extractStudentAnswers(unit.images, unit.questions, {
        subject,
        sectionLabel: unit.label,
        expectedPages: unit.expectedPages,
        onProgress,
      });
      return withStatuses({
        ...unit,
        status: res.status,
        error: res.status === 'error' ? getAiErrorMessage(res.error) : '',
        records: res.records,
        completeness: res.completeness,
        failedPages: res.failedPages,
        issues: res.issues,
      });
    } catch (e) {
      return withStatuses({ ...unit, status: 'error', error: getAiErrorMessage(e?.message || e), records: [], failedPages: [], issues: [], completeness: { complete: false, reasons: ['Extraction failed.'] } });
    }
  }, [subject]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncTexts = React.useCallback((sections) => {
    const parts = [];
    sections.forEach((sec) => (sec.records || []).forEach((r) => {
      if (r.text) parts.push(`${sec.label ? `[Section ${sec.label}] ` : ''}${r.rawLabel || '(no label)'}: ${r.text}`);
    }));
    setPageTexts(parts);
    setFullOcrText(parts.join('\n\n'));
  }, []);

  const runOcrOnAllPages = React.useCallback(async (imgs, cancelled = { value: false }) => {
    setPipelineStep('ocr');
    setPipelineDone(false);
    setAnswerReview(null);
    lastImagesRef.current = imgs;
    // Without sections, read the pages the caller passed (e.g. Mixed skips its MCQ sheet).
    const units = (sectionImages ? readingUnits : readingUnits.map(u => ({ ...u, images: Array.isArray(imgs) && imgs.length ? imgs : u.images })))
      .filter(u => u.images.length > 0 || sectionImages);
    if (!units.length || units.every(u => !u.images.length)) {
      markDone('No answer pages captured. Score manually.');
      return;
    }
    setOcrPageProgress({ current: 0, total: units.length });
    const done = [];
    for (let i = 0; i < units.length; i++) {
      if (cancelled.value) return;
      const u = units[i];
      setOcrPageProgress({ current: i + 1, total: units.length });
      setPipelineMsg(`Reading ${u.label ? `Section ${u.label} ` : ''}answers (${u.images.length} page${u.images.length === 1 ? '' : 's'})...`);
      done.push(await readUnit(u, ({ pages, total }) => {
        if (total > pages.length) setPipelineMsg(`Reading ${u.label ? `Section ${u.label}, ` : ''}page${pages.length > 1 ? 's' : ''} ${pages.join(', ')} of ${total}...`);
      }));
    }
    if (cancelled.value) return;

    setAnswerReview({ sections: done });
    syncTexts(done);
    const failed = done.filter(s => s.status === 'error').length;
    const summary = done.reduce((acc, s) => {
      const r = reviewSummary(s.records || []);
      return { total: acc.total + r.total, needsReview: acc.needsReview + r.needsReview };
    }, { total: 0, needsReview: 0 });
    setPipelineMsg(failed === done.length
      ? "Couldn't read the answer pages. Retry, or score manually."
      : `Found ${summary.total} answer${summary.total === 1 ? '' : 's'}${summary.needsReview ? ` — ${summary.needsReview} need${summary.needsReview === 1 ? 's' : ''} your review` : ''}.`);
    setPipelineStep('review');
    if (failed < done.length) {
      addNotification({ type: 'success', title: 'Answers read', message: `Read ${summary.total} answer(s) for ${studentName}. Review the matches before grading.` });
    }
  }, [readingUnits, sectionImages, readUnit, syncTexts, markDone, addNotification, studentName]);

  /** Replace a section's answer records after a review edit. */
  const updateSectionRecords = React.useCallback((key, records) => {
    setAnswerReview((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map(s => (s.key === key ? withStatuses({ ...s, records }) : s));
      syncTexts(sections);
      return { sections };
    });
  }, [syncTexts]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Teacher confirms the booklet is (or isn't) complete — affects "no response detected" vs "not found". */
  const setSectionComplete = React.useCallback((key, complete) => {
    setAnswerReview(prev => (prev ? { sections: prev.sections.map(s => (s.key === key ? withStatuses({ ...s, completeOverride: complete }) : s)) } : prev));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const retrySection = React.useCallback(async (key) => {
    const current = answerReview?.sections.find(s => s.key === key);
    if (!current) return;
    setAnswerReview(prev => ({ sections: prev.sections.map(s => (s.key === key ? { ...s, status: 'loading', error: '' } : s)) }));
    const next = await readUnit({ ...current, completeOverride: undefined });
    setAnswerReview((prev) => {
      const sections = prev.sections.map(s => (s.key === key ? next : s));
      syncTexts(sections);
      return { sections };
    });
  }, [answerReview, readUnit, syncTexts]);

  // ── Grading (Stage 3): build a grading result from the reviewed answers, grade per item ──
  const buildResult = React.useCallback((sections) => {
    if (!resultIdRef.current) resultIdRef.current = newResultId();
    return createGradingResult({
      id: resultIdRef.current,
      sections: sections.map(sec => ({
        key: sec.key,
        label: sec.label,
        type: sec.type,
        questions: sec.questions,
        questionTree: sec.questionTree,
        instructions: sec.instructions,
        records: sec.records || [],
        complete: isComplete(sec),
        completenessReasons: sec.completeness?.reasons || [],
        extractionFailed: sec.status === 'error',
        images: sec.images,
      })),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the legacy per-question arrays (used by the Mixed screen and older UI) in sync with the result.
  const syncLegacy = React.useCallback((result) => {
    setScores(prev => toLegacyScores(result, prev));
    setAiFeedback(result.items.map(i => i.rationale || i.flags[0]?.message || i.failureReason || ''));
    setTranscriptions(result.items.map(i => i.answerText || ''));
  }, [setScores]);

  const updateGradingResult = React.useCallback((updater) => {
    setGradingResult((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next) syncLegacy(next);
      return next;
    });
  }, [syncLegacy]);

  const summaryMessage = (result) => {
    const t = computeTotals(result);
    const status = resultStatus(result);
    if (status === 'failed') return "Grading failed. Your answers are kept — retry grading, or score manually.";
    return `${t.scored} of ${t.assessable} item${t.assessable === 1 ? '' : 's'} graded${t.needsReview ? ` — ${t.needsReview} need${t.needsReview === 1 ? 's' : ''} review` : ''}. Results are provisional until finalized.`;
  };

  const handleConfirmOCR = React.useCallback(async () => {
    const sections = answerReview?.sections || [];
    if (!sections.length) {
      markDone('No answers to grade. Score manually.');
      return;
    }
    setPipelineStep('ai');
    setPipelineMsg('Grading confirmed answers...');
    let result = buildResult(sections);
    try {
      const run = await gradeResultWithAI(result, {
        subject,
        gradeLevel,
        testId,
        onProgress: ({ done, total }) => setPipelineMsg(`Grading answers (${done}/${total})...`),
      });
      result = run.result;
    } catch {
      // gradeResultWithAI does not throw by design; keep the ungraded result if it ever does.
    }
    updateGradingResult(result);
    setPipelineMsg(summaryMessage(result));
    setPipelineStep('done');
    setPipelineDone(true);
    const t = computeTotals(result);
    addNotification({ type: 'success', title: 'Grading complete', message: `Provisional result for ${studentName}: ${t.awarded}${t.available !== null ? `/${t.available}` : ''}${t.needsReview ? ` — ${t.needsReview} item(s) need review` : ''}.` });
  }, [answerReview, buildResult, subject, gradeLevel, testId, markDone, updateGradingResult, addNotification, studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkipAI = React.useCallback(() => {
    if (answerReview?.sections?.length) updateGradingResult(buildResult(answerReview.sections));
    setPipelineMsg('Score manually using the extracted answers.');
    setPipelineStep('done');
    setPipelineDone(true);
  }, [answerReview, buildResult, updateGradingResult]);

  /** Regrade only the listed items (e.g. after an edit or a failed request). Other items are untouched. */
  const regradeItems = React.useCallback(async (ids, base = null) => {
    const source = base || gradingResult;
    if (!source || !ids?.length) return;
    setGradingBusyIds(prev => [...new Set([...prev, ...ids])]);
    try {
      const run = await gradeResultWithAI(source, { ids, subject, gradeLevel, testId });
      updateGradingResult(prev => ({
        ...(prev || run.result),
        items: (prev || run.result).items.map(i => (ids.includes(i.id) ? run.result.items.find(x => x.id === i.id) || i : i)),
        updatedAt: run.result.updatedAt,
      }));
    } finally {
      setGradingBusyIds(prev => prev.filter(id => !ids.includes(id)));
    }
  }, [gradingResult, subject, gradeLevel, testId, updateGradingResult]);

  /** Apply corrected answer records (association or text) and regrade only the affected items. */
  const applyAnswerChange = React.useCallback(async (sectionKey, records) => {
    if (!gradingResult) return;
    const { result, changedItemIds } = updateSectionAnswers(gradingResult, sectionKey, records, reviewerId);
    updateGradingResult(result);
    setAnswerReview(prev => (prev ? { sections: prev.sections.map(s => (s.key === sectionKey ? withStatuses({ ...s, records }) : s)) } : prev));
    if (changedItemIds.length) await regradeItems(changedItemIds, result);
  }, [gradingResult, reviewerId, updateGradingResult, regradeItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = React.useCallback(async () => {
    setPipelineDone(false);
    await runOcrOnAllPages(lastImagesRef.current || images);
  }, [images, runOcrOnAllPages]);

  /** Answer records with their final associations, for saving with the scan result. */
  const getAnswerRecordsForSave = React.useCallback(() => (answerReview?.sections || []).flatMap(sec => (sec.records || []).map((r) => {
    const q = buildQuestionIndex(sec.questions).find(x => x.id === r.questionId);
    return {
      id: r.id,
      section: sec.label,
      rawLabel: r.rawLabel,
      normalizedLabel: r.normalizedLabel,
      text: r.text,
      pages: r.pages,
      regions: r.regions,
      questionId: r.questionId,
      questionNumber: q ? q.number : null,
      matchStatus: r.matchStatus,
      matchMethod: r.matchMethod,
      matchConfidence: r.matchConfidence,
      labelConfidence: r.labelConfidence,
      handwritingConfidence: r.handwritingConfidence,
      boundaryConfidence: r.boundaryConfidence,
      readability: r.readability,
      continuesFromPrevious: r.continuesFromPrevious || !!r.mergedFrom,
      crossedOut: r.crossedOut,
      excluded: r.excluded,
      needsManualCorrection: r.needsManualCorrection,
      matchReasons: r.matchReasons,
    };
  })), [answerReview]);

  return {
    transcriptions,
    setTranscriptions,
    aiFeedback,
    pipelineStep,
    pipelineMsg,
    pipelineDone,
    ocrPageProgress,
    pageTexts,
    fullOcrText,
    answerReview,
    updateSectionRecords,
    setSectionComplete,
    retrySection,
    getAnswerRecordsForSave,
    gradingResult,
    updateGradingResult,
    regradeItems,
    applyAnswerChange,
    gradingBusyIds,
    runOcrOnAllPages,
    handleConfirmOCR,
    handleSkipAI,
    handleRetry,
    markDone,
  };
}
