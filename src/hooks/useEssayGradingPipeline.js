import React from 'react';
import { extractStudentAnswers, gradeEssayTextWithOpenAI, gradeDiagramWithVision } from '../utils/openaiService';
import { answersForGrading, deriveQuestionStatuses, buildQuestionIndex, reviewSummary } from '../utils/answerMatching';
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
    diagramIndices = new Set(),
    studentName = 'Student',
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
        };
      }).filter(u => u.questions.length > 0);
    }
    const qs = Array.isArray(questions) && questions.length
      ? questions.slice(0, questionCount || questions.length)
      : Array.from({ length: questionCount }, (_, i) => ({ number: i + 1, text: questionTexts[i] || `Question ${i + 1}`, maxPoints: scores[i]?.maxPoints || 0 }));
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

  const handleConfirmOCR = React.useCallback(async () => {
    const sections = answerReview?.sections || [];
    if (!sections.length) {
      markDone('No answers to grade. Score manually.');
      return;
    }
    setPipelineStep('ai');
    setPipelineMsg('Grading confirmed answers...');

    // Build per-question grading input from the reviewed associations.
    const items = [];
    for (const sec of sections) {
      const grading = answersForGrading(sec.questions, sec.records || [], { complete: isComplete(sec), extractionFailed: sec.status === 'error' });
      const index = buildQuestionIndex(sec.questions);
      grading.forEach((g, qi) => {
        const globalIdx = sec.startIdx + qi;
        if (globalIdx >= questionCount) return;
        const q = sec.questions[qi] || {};
        items.push({
          ...g,
          globalIdx,
          key: `${sec.label ? `${sec.label}.` : ''}${g.number}`,
          questionText: q.text || index[qi]?.text || `Question ${g.number}`,
          isDiagram: q.type === 'diagram' || diagramIndices.has(globalIdx),
          pageImage: g.pages.length ? sec.images[g.pages[0] - 1] : null,
        });
      });
    }

    const newScores = [...scores];
    const newFeedback = [...aiFeedback];
    const newTranscriptions = [...transcriptions];
    let needsManual = 0;

    const applyManual = (it, feedback, points = 0, manual = true) => {
      const s = newScores[it.globalIdx];
      if (!s) return;
      newScores[it.globalIdx] = { ...s, points: Math.min(points, s.maxPoints), answerStatus: it.status, needsManual: manual, answerIds: it.answerIds };
      newFeedback[it.globalIdx] = feedback;
      if (manual) needsManual++;
    };

    try {
      for (const it of items) {
        newTranscriptions[it.globalIdx] = it.text;
        if (it.autoGradable) continue;
        if (it.status === 'no_answer_detected') applyManual(it, 'No response detected in the supplied pages.', 0, false);
        else applyManual(it, `${it.message}. Score manually.`);
      }

      const diagramItems = items.filter(it => it.autoGradable && it.isDiagram && it.pageImage);
      let d = 0;
      for (const it of diagramItems) {
        d++;
        setPipelineMsg(`Grading diagram ${d} of ${diagramItems.length}...`);
        const max = newScores[it.globalIdx]?.maxPoints || 0;
        try {
          const res = await gradeDiagramWithVision(it.pageImage, { questionText: it.questionText, maxPoints: max, subject });
          if (res.error) applyManual(it, 'AI could not grade this diagram. Score manually.');
          else applyManual(it, res.feedback || '', res.score || 0, false);
        } catch {
          applyManual(it, 'AI could not grade this diagram. Score manually.');
        }
      }

      const textItems = items.filter(it => it.autoGradable && !(it.isDiagram && it.pageImage));
      if (textItems.length) {
        setPipelineMsg(`Grading ${textItems.length} written answer${textItems.length === 1 ? '' : 's'}...`);
        const aiResult = await gradeEssayTextWithOpenAI(textItems.map(it => ({
          questionNumber: it.key,
          questionText: it.questionText,
          studentAnswer: it.text,
          maxPoints: newScores[it.globalIdx]?.maxPoints || 0,
        })), { subject, gradeLevel });
        textItems.forEach((it, i) => {
          const r = aiResult.results?.[i];
          if (aiResult.error || !r || r.missing) applyManual(it, 'AI grading did not return a score for this answer. Score manually.');
          else applyManual(it, r.feedback || '', r.score || 0, false);
        });
      }
    } catch {
      setPipelineMsg('Grading failed. Score manually.');
    }

    setScores(newScores);
    setAiFeedback(newFeedback);
    setTranscriptions(newTranscriptions);
    setPipelineMsg(needsManual
      ? `Graded. ${needsManual} question${needsManual === 1 ? ' needs' : 's need'} a manual score — see the flagged items.`
      : 'Review scores below.');
    setPipelineStep('done');
    setPipelineDone(true);

    const finalScore = newScores.reduce((sum, s) => sum + (s.points || 0), 0);
    const total = newScores.reduce((sum, s) => sum + (s.maxPoints || 0), 0);
    addNotification({ type: 'success', title: 'Grading complete', message: `Grading completed for ${studentName}. Score: ${finalScore}/${total}` });
  }, [answerReview, scores, aiFeedback, transcriptions, questionCount, diagramIndices, subject, gradeLevel, setScores, markDone, addNotification, studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkipAI = React.useCallback(() => {
    setPipelineMsg('Score manually using the extracted answers.');
    setPipelineStep('done');
    setPipelineDone(true);
  }, []);

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
    runOcrOnAllPages,
    handleConfirmOCR,
    handleSkipAI,
    handleRetry,
    markDone,
  };
}
