import React from 'react';
import { transcribeHandwritingWithVision, gradeEssayTextWithOpenAI, gradeDiagramWithVision, gradeSectionAnswersWithVision } from '../utils/openaiService';
import { splitTranscriptionByQuestions } from '../utils/questionUtils';
import { useNotifications } from '../context/NotificationsContext';

export default function useEssayGradingPipeline(params) {
  const {
    images = [],
    sectionImages = null, // Array of { sectionIndex, label, type, images, questions?, questionTexts? }
    sectionData = [],     // From testData.sectionData — used to map section questions
    questionCount = 0,
    questionTexts = [],
    scores = [],
    setScores = () => {},
    subject = '',
    gradeLevel = '',
    diagramIndices = new Set(),
    studentName = 'Student',
  } = params || {};

  const { addNotification } = useNotifications();

  const [transcriptions, setTranscriptions] = React.useState(
    Array.from({ length: questionCount }, () => '')
  );

  const [aiFeedback, setAiFeedback] = React.useState(
    Array.from({ length: questionCount }, () => '')
  );

  const [pipelineStep, setPipelineStep] = React.useState('idle');
  const [pipelineMsg, setPipelineMsg] = React.useState('');
  const [pipelineDone, setPipelineDone] = React.useState(false);

  const [ocrPageProgress, setOcrPageProgress] = React.useState({ current: 0, total: 0 });
  const [pageTexts, setPageTexts] = React.useState([]);
  const [fullOcrText, setFullOcrText] = React.useState('');

  // Cache of vision-based section grading results, keyed by global question index:
  // { [globalQIdx]: { score, feedback } }. Set during section OCR, applied on confirm.
  const visionResultsRef = React.useRef(null);

  const markDone = React.useCallback((message = '') => {
    setPipelineMsg(message);
    setPipelineStep('done');
    setPipelineDone(true);
  }, []);

  // Build section-to-question mapping for section-by-section OCR
  const sectionQuestionMap = React.useMemo(() => {
    if (!sectionImages || !sectionData || sectionData.length === 0) return null;
    let globalIdx = 0;
    return sectionData.map((sec, secIdx) => {
      const secQuestions = Array.isArray(sec.questions) ? sec.questions : [];
      const qCount = secQuestions.length;
      const qTexts = secQuestions.map(q => q.text || `Question ${q.number || ''}`);
      const features = {
        hasDiagrams: !!sec.hasDiagrams,
        hasCalculations: !!sec.hasCalculations,
        hasGraphs: !!sec.hasGraphs,
        hasTables: !!sec.hasTables,
        hasMaps: !!sec.hasMaps,
        hasCodeSnippets: !!sec.hasCodeSnippets,
        hasTrueFalse: !!sec.hasTrueFalse,
      };
      const startIdx = globalIdx;
      globalIdx += qCount;
      return { secIdx, qCount, qTexts, questions: secQuestions, startIdx, type: sec.type, label: sec.label, features };
    });
  }, [sectionImages, sectionData]);

  const runOcrOnAllPages = React.useCallback(async (imgs, cancelled = { value: false }) => {
    setPipelineStep('ocr');
    setPageTexts([]);
    setFullOcrText('');
    visionResultsRef.current = null;

    // ── Section-by-section VISION grading ──
    // For each section, send the answer image(s) + that section's questions to the
    // vision model in ONE call. The model reads handwriting, matches each answer to
    // its question, and grades — far more reliable than OCR-then-regex-split.
    if (sectionImages && sectionQuestionMap && sectionQuestionMap.length > 0) {
      const gradableSections = sectionImages.filter((s, i) => (s.images?.length || 0) > 0 && sectionQuestionMap[i]?.qCount > 0);
      setOcrPageProgress({ current: 0, total: gradableSections.length });
      let sectionsDone = 0;

      const perQuestion = Array.from({ length: questionCount }, () => '');
      const visionResults = {}; // globalQIdx -> { score, feedback }
      let anyAnswer = false;
      let anyError = null;

      for (let si = 0; si < sectionImages.length; si++) {
        if (cancelled.value) return;
        const secImgs = sectionImages[si]?.images || [];
        const mapping = sectionQuestionMap[si];
        if (!mapping || secImgs.length === 0 || mapping.qCount === 0) continue;

        sectionsDone++;
        setOcrPageProgress({ current: sectionsDone, total: gradableSections.length });
        setPipelineMsg(`Grading Section ${mapping.label} (${mapping.qCount} question${mapping.qCount > 1 ? 's' : ''})...`);

        // Build the questions payload using global maxPoints (from scores) when available
        const sectionQuestions = mapping.questions.map((q, qi) => {
          const globalQIdx = mapping.startIdx + qi;
          return {
            number: q.number || (globalQIdx + 1),
            text: q.text || `Question ${q.number || globalQIdx + 1}`,
            maxPoints: scores[globalQIdx]?.maxPoints || q.maxPoints || 0,
            type: q.type,
          };
        });

        let secResult;
        try {
          secResult = await gradeSectionAnswersWithVision(secImgs, sectionQuestions, {
            subject,
            gradeLevel,
            sectionLabel: mapping.label,
            sectionType: mapping.type,
            features: mapping.features,
          });
        } catch (e) {
          secResult = { results: [], error: e.message };
        }
        if (cancelled.value) return;

        if (secResult.error) anyError = secResult.error;

        const results = secResult.results || [];
        for (let qi = 0; qi < mapping.qCount; qi++) {
          const globalQIdx = mapping.startIdx + qi;
          if (globalQIdx >= questionCount) break;
          const r = results[qi] || {};
          const answer = String(r.transcribedAnswer || '').trim();
          perQuestion[globalQIdx] = answer;
          if (answer) anyAnswer = true;
          visionResults[globalQIdx] = {
            score: typeof r.score === 'number' ? r.score : 0,
            feedback: r.feedback || '',
          };
        }
      }

      if (cancelled.value) return;

      // Build a readable combined transcript for the "Full Extracted Text" view
      const combinedParts = [];
      for (let si = 0; si < sectionQuestionMap.length; si++) {
        const mapping = sectionQuestionMap[si];
        if (!mapping || mapping.qCount === 0) continue;
        for (let qi = 0; qi < mapping.qCount; qi++) {
          const globalQIdx = mapping.startIdx + qi;
          const ans = perQuestion[globalQIdx];
          if (ans) combinedParts.push(`Q${globalQIdx + 1}: ${ans}`);
        }
      }
      const combined = combinedParts.join('\n\n');
      setPageTexts(combinedParts);
      setFullOcrText(combined);
      setTranscriptions(perQuestion);

      if (!anyAnswer) {
        visionResultsRef.current = null;
        markDone(anyError ? `Could not read answers: ${anyError}. Score manually.` : 'Could not read any answers. Score manually.');
        return;
      }

      // Cache the vision scores so handleConfirmOCR applies them without re-calling AI
      visionResultsRef.current = visionResults;

      setPipelineMsg(`Read & graded ${gradableSections.length} section(s). Review the answers below, then continue.`);
      setPipelineStep('review');

      addNotification({
        type: 'success',
        title: 'Answers read & graded',
        message: `Graded ${gradableSections.length} section(s) for ${studentName}.`,
      });
      return;
    }

    // ── Flat OCR (legacy, no sections) ──
    setOcrPageProgress({ current: 0, total: imgs.length });
    setPipelineMsg(`Reading handwriting from page 1 of ${imgs.length}...`);

    const texts = [];
    for (let i = 0; i < imgs.length; i++) {
      if (cancelled.value) return;
      setOcrPageProgress({ current: i + 1, total: imgs.length });
      setPipelineMsg(`Reading handwriting from page ${i + 1} of ${imgs.length}...`);
      try {
        const ocrResult = await transcribeHandwritingWithVision(imgs[i], {
          questionCount,
          questionTexts,
          subject,
        });
        texts.push(ocrResult.error ? '' : (ocrResult.text || ''));
      } catch {
        texts.push('');
      }
    }
    if (cancelled.value) return;

    setPageTexts(texts);
    const combined = texts.map(t => String(t || '').trim()).filter(Boolean).join('\n\n');
    setFullOcrText(combined);

    if (!combined.trim()) {
      markDone('Could not read handwriting from any page. Score manually.');
      return;
    }

    const perQuestion = splitTranscriptionByQuestions(combined, questionCount);
    setTranscriptions(perQuestion);

    const pageCount = texts.filter(t => String(t || '').trim()).length;
    setPipelineMsg(`Read handwriting from ${pageCount} page(s). Review below, then continue.`);
    setPipelineStep('review');

    addNotification({
      type: 'success',
      title: 'Handwriting extracted',
      message: `Successfully read ${pageCount} page(s) for ${studentName}.`,
    });
  }, [questionCount, questionTexts, subject, gradeLevel, scores, addNotification, studentName, markDone, sectionImages, sectionQuestionMap]);

  const handleConfirmOCR = React.useCallback(async () => {
    // Fast path: section-based vision grading already produced scores + feedback.
    // Apply them directly without another AI call.
    if (visionResultsRef.current) {
      const vr = visionResultsRef.current;
      const newScores = [...scores];
      const newFeedback = [...aiFeedback];
      for (let i = 0; i < questionCount; i++) {
        if (vr[i]) {
          newScores[i] = { ...newScores[i], points: Math.min(vr[i].score || 0, newScores[i].maxPoints) };
          newFeedback[i] = vr[i].feedback || '';
        }
      }
      setScores(newScores);
      setAiFeedback(newFeedback);
      setPipelineMsg('Review scores below.');
      setPipelineStep('done');
      setPipelineDone(true);

      const finalScore = newScores.reduce((sum, s) => sum + (s.points || 0), 0);
      const total = newScores.reduce((sum, s) => sum + (s.maxPoints || 0), 0);
      addNotification({
        type: 'success',
        title: 'Grading complete',
        message: `Grading completed for ${studentName}. Score: ${finalScore}/${total}`,
      });
      return;
    }

    if (!String(fullOcrText || '').trim() && diagramIndices.size === 0) {
      markDone('No text to grade. Score manually.');
      return;
    }

    setPipelineStep('ai');
    setPipelineMsg('Grading answers...');

    try {
      const diagramResults = {};
      if (diagramIndices.size > 0 && images?.length > 0) {
        let diagramIdx = 0;
        for (const eIdx of diagramIndices) {
          diagramIdx++;
          setPipelineMsg(`Grading diagram ${diagramIdx} of ${diagramIndices.size}...`);
          try {
            const result = await gradeDiagramWithVision(images[0], {
              questionText: questionTexts[eIdx] || `Question ${scores[eIdx]?.question || eIdx + 1}`,
              maxPoints: scores[eIdx]?.maxPoints || 10,
              subject,
            });
            diagramResults[eIdx] = result;
          } catch {
            diagramResults[eIdx] = { score: 0, maxPoints: scores[eIdx]?.maxPoints || 10, feedback: 'Could not grade diagram.' };
          }
        }
      }

      const textEssayItems = scores
        .map((s, i) => ({ ...s, essayIndex: i }))
        .filter((_, i) => !diagramIndices.has(i));

      let textResults = [];
      if (textEssayItems.length > 0 && String(fullOcrText || '').trim()) {
        setPipelineMsg('Grading written answers...');
        const questionsForGrading = textEssayItems.map((s) => ({
          questionNumber: s.question,
          questionText: questionTexts[s.essayIndex] || `Question ${s.question}`,
          studentAnswer: transcriptions[s.essayIndex] || '',
          maxPoints: s.maxPoints,
        }));

        const aiResult = await gradeEssayTextWithOpenAI(questionsForGrading, {
          subject,
          gradeLevel,
        });

        if (!aiResult.error && aiResult.results) {
          textResults = aiResult.results;
        }
      }

      const newScores = [...scores];
      const newFeedback = [...aiFeedback];
      let textResultIdx = 0;

      for (let i = 0; i < questionCount; i++) {
        if (diagramIndices.has(i) && diagramResults[i]) {
          newScores[i] = { ...newScores[i], points: Math.min(diagramResults[i].score, newScores[i].maxPoints) };
          newFeedback[i] = diagramResults[i].feedback || '';
        } else if (textResults[textResultIdx]) {
          newScores[i] = { ...newScores[i], points: Math.min(textResults[textResultIdx].score || 0, newScores[i].maxPoints) };
          newFeedback[i] = textResults[textResultIdx].feedback || '';
          textResultIdx++;
        }
      }

      setScores(newScores);
      setAiFeedback(newFeedback);
      setPipelineMsg('Review scores below.');

      const finalScore = newScores.reduce((sum, s) => sum + (s.points || 0), 0);
      const total = newScores.reduce((sum, s) => sum + (s.maxPoints || 0), 0);
      addNotification({
        type: 'success',
        title: 'Grading complete',
        message: `Grading completed for ${studentName}. Score: ${finalScore}/${total}`,
      });
    } catch {
      setPipelineMsg('Grading failed. Score manually.');
      addNotification({
        type: 'error',
        title: 'Grading failed',
        message: `Could not grade ${studentName}. Please score manually.`,
      });
    }

    setPipelineStep('done');
    setPipelineDone(true);
  }, [diagramIndices, images, questionTexts, scores, transcriptions, aiFeedback, subject, gradeLevel, addNotification, studentName, questionCount, markDone, setScores]);

  const handleSkipAI = React.useCallback(() => {
    setPipelineMsg('Score manually using the extracted text.');
    setPipelineStep('done');
    setPipelineDone(true);
  }, []);

  const handleRetry = React.useCallback(async () => {
    if (!images?.length) return;
    setPipelineDone(false);
    await runOcrOnAllPages(images);
  }, [images, runOcrOnAllPages]);

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
    runOcrOnAllPages,
    handleConfirmOCR,
    handleSkipAI,
    handleRetry,
    markDone,
  };
}
