import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { gradeEssay } from '../utils/grading';
import { transcribeHandwritingWithVision, gradeEssayTextWithOpenAI, gradeDiagramWithVision, getOpenAIKey } from '../utils/openaiService';
import { getGradingMode } from '../components/SubjectPicker';
import { useNotifications } from '../context/NotificationsContext';

/**
 * Split a combined transcription into per-question segments.
 * Looks for question markers (Q1, 1., Question 1, etc.) in the text.
 * Falls back to even splitting if no markers found.
 */
function splitTranscriptionByQuestions(fullText, questionCount) {
  if (questionCount <= 1) return [fullText.trim()];

  const lines = fullText.split('\n');
  const boundaries = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const match = line.match(/^(?:Q|Question|#)?\s*(\d+)[.):]\s*/i);
    if (match) {
      const qNum = parseInt(match[1], 10);
      if (qNum >= 1 && qNum <= questionCount) {
        boundaries.push({ line: li, question: qNum });
      }
    }
  }

  // If we found enough boundaries, split by them
  if (boundaries.length >= Math.ceil(questionCount * 0.5)) {
    return Array.from({ length: questionCount }, (_, q) => {
      const boundary = boundaries.find(b => b.question === q + 1);
      if (!boundary) return '';
      const startLine = boundary.line;
      const nextBoundary = boundaries.find(b => b.question > q + 1);
      const endLine = nextBoundary ? nextBoundary.line : lines.length;
      return lines.slice(startLine, endLine)
        .join('\n')
        .replace(/^(?:Q|Question|#)?\s*\d+[.):]\s*/i, '')
        .trim();
    });
  }

  // Fallback: split text evenly by lines
  const nonEmpty = lines.filter(l => l.trim());
  const linesPerQ = Math.max(1, Math.ceil(nonEmpty.length / questionCount));
  return Array.from({ length: questionCount }, (_, i) => {
    const start = i * linesPerQ;
    const end = i < questionCount - 1 ? start + linesPerQ : nonEmpty.length;
    return nonEmpty.slice(start, end).join('\n').trim();
  });
}

export default function EssayScoringScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { images, testData, studentName, studentNumber } = route.params || {};
  const questionCount = parseInt(testData?.numberOfQuestions, 10) || 1;
  const totalPoints = parseInt(testData?.totalPoints, 10) || questionCount;
  const defaultMax = Math.round(totalPoints / questionCount);

  const [scores, setScores] = useState(
    Array.from({ length: questionCount }, (_, i) => ({
      question: i + 1,
      points: 0,
      maxPoints: i < questionCount - 1
        ? defaultMax
        : totalPoints - defaultMax * (questionCount - 1),
    }))
  );
  const [showPreview, setShowPreview] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [transcriptions, setTranscriptions] = useState(
    Array.from({ length: questionCount }, () => '')
  );
  const [openaiOk, setOpenaiOk] = useState(false);
  const { addNotification } = useNotifications();

  // Check grading key on mount
  useEffect(() => {
    (async () => {
      const key = await getOpenAIKey();
      setOpenaiOk(!!key);
    })();
  }, []);

  const questionTexts = testData?.questionTexts || [];

  // Pipeline state: 'idle' → 'ocr' → 'review' → 'ai' → 'done'
  const [pipelineStep, setPipelineStep] = useState('idle');
  const [pipelineMsg, setPipelineMsg] = useState('');
  const [pipelineDone, setPipelineDone] = useState(false);
  const [ocrPageProgress, setOcrPageProgress] = useState({ current: 0, total: 0 });
  // Store raw OCR text per page
  const [pageTexts, setPageTexts] = useState([]);
  // Combined full text from all pages
  const [fullOcrText, setFullOcrText] = useState('');

  // Run OCR on ALL pages (reads handwriting)
  const runOcrOnAllPages = useCallback(async (imgs) => {
    setPipelineStep('ocr');
    setPageTexts([]);
    setFullOcrText('');
    setOcrPageProgress({ current: 0, total: imgs.length });
    setPipelineMsg(`Reading handwriting from page 1 of ${imgs.length}...`);

    const texts = [];
    for (let i = 0; i < imgs.length; i++) {
      setOcrPageProgress({ current: i + 1, total: imgs.length });
      setPipelineMsg(`Reading handwriting from page ${i + 1} of ${imgs.length}...`);
      try {
        const ocrResult = await transcribeHandwritingWithVision(imgs[i], {
          questionCount,
          questionTexts,
          subject: testData?.subject || '',
        });
        texts.push(ocrResult.error ? '' : (ocrResult.text || ''));
      } catch {
        texts.push('');
      }
    }

    setPageTexts(texts);
    const combined = texts.map(t => t.trim()).filter(Boolean).join('\n\n');
    setFullOcrText(combined);

    if (!combined.trim()) {
      setPipelineMsg('Could not read handwriting from any page. Score manually.');
      setPipelineStep('done');
      setPipelineDone(true);
      return;
    }

    // Intelligently split combined text into per-question transcriptions
    const perQuestion = splitTranscriptionByQuestions(combined, questionCount);
    setTranscriptions(perQuestion);

    const pageCount = texts.filter(t => t.trim()).length;
    setPipelineMsg(`Read handwriting from ${pageCount} page(s). Review below, then continue.`);
    setPipelineStep('review');
    
    // Notify when OCR completes
    addNotification({
      type: 'success',
      title: 'Handwriting extracted',
      message: `Successfully read ${pageCount} page(s) for ${studentName || 'Student'}.`,
    });
  }, [questionCount, questionTexts, testData]);

  // Auto pipeline on mount
  useEffect(() => {
    if (!images?.length) {
      setPipelineMsg('No images captured. Score manually.');
      setPipelineStep('done');
      setPipelineDone(true);
      return;
    }
    if (!openaiOk) {
      setPipelineMsg('API key not set. Score manually.');
      setPipelineStep('done');
      setPipelineDone(true);
      return;
    }
    runOcrOnAllPages(images);
  }, [openaiOk]);

  // Store grading feedback per question
  const [aiFeedback, setAiFeedback] = useState(Array.from({ length: questionCount }, () => ''));

  // Detect diagram-type questions from extracted data
  const extractedQuestions = testData?.extractedQuestions || [];
  const diagramQuestionIndices = React.useMemo(() => {
    const indices = new Set();
    extractedQuestions.forEach((q) => {
      if (q.type === 'diagram') {
        // question numbers are 1-indexed, scores array is 0-indexed
        indices.add(q.number - 1);
      }
    });
    return indices;
  }, [extractedQuestions]);

  // Teacher confirms OCR text → proceed to grading
  const handleConfirmOCR = useCallback(async () => {
    if (!fullOcrText.trim() && diagramQuestionIndices.size === 0) {
      setPipelineMsg('No text to grade. Score manually.');
      setPipelineStep('done');
      setPipelineDone(true);
      return;
    }

    setPipelineStep('ai');
    setPipelineMsg('Grading answers...');
    try {
      // Grade diagram questions using vision (send student answer image directly)
      const diagramResults = {};
      if (diagramQuestionIndices.size > 0 && images?.length > 0) {
        let diagramIdx = 0;
        for (const qIdx of diagramQuestionIndices) {
          diagramIdx++;
          setPipelineMsg(`Grading diagram ${diagramIdx} of ${diagramQuestionIndices.size}...`);
          try {
            const result = await gradeDiagramWithVision(images[0], {
              questionText: questionTexts[qIdx] || `Question ${qIdx + 1}`,
              maxPoints: scores[qIdx]?.maxPoints || 10,
              subject: testData?.subject || '',
            });
            diagramResults[qIdx] = result;
          } catch {
            diagramResults[qIdx] = { score: 0, maxPoints: scores[qIdx]?.maxPoints || 10, feedback: 'Could not grade diagram.' };
          }
        }
      }

      // Grade text-based questions (non-diagram)
      const textQuestions = scores
        .map((s, i) => ({ ...s, index: i }))
        .filter((_, i) => !diagramQuestionIndices.has(i));

      let textResults = [];
      if (textQuestions.length > 0 && fullOcrText.trim()) {
        setPipelineMsg('Grading written answers...');
        const questionsForGrading = textQuestions.map((s) => ({
          questionNumber: s.question,
          questionText: questionTexts[s.index] || `Question ${s.question}`,
          studentAnswer: transcriptions[s.index] || '',
          maxPoints: s.maxPoints,
        }));

        const aiResult = await gradeEssayTextWithOpenAI(questionsForGrading, {
          subject: testData?.subject || '',
          gradeLevel: testData?.grade || '',
        });

        if (!aiResult.error && aiResult.results) {
          textResults = aiResult.results;
        }
      }

      // Merge results: diagram + text
      const newScores = [...scores];
      const newFeedback = [...aiFeedback];
      let textResultIdx = 0;

      for (let i = 0; i < scores.length; i++) {
        if (diagramQuestionIndices.has(i) && diagramResults[i]) {
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

      const finalScore = newScores.reduce((sum, s) => sum + s.points, 0);
      addNotification({
        type: 'success',
        title: 'Grading complete',
        message: `Grading completed for ${studentName || 'Student'}. Score: ${finalScore}/${totalPoints}`,
      });
    } catch {
      setPipelineMsg('Grading failed. Score manually.');
      addNotification({
        type: 'error',
        title: 'Grading failed',
        message: `Could not grade ${studentName || 'Student'}. Please score manually.`,
      });
    }
    setPipelineStep('done');
    setPipelineDone(true);
  }, [scores, transcriptions, questionTexts, fullOcrText, testData, diagramQuestionIndices, images, aiFeedback]);

  // Skip auto-grading, go straight to manual scoring
  const handleSkipAI = useCallback(() => {
    setPipelineMsg('Score manually using the extracted text.');
    setPipelineStep('done');
    setPipelineDone(true);
  }, []);

  const handleRetry = useCallback(async () => {
    if (!images?.length) return;
    setPipelineDone(false);
    runOcrOnAllPages(images);
  }, [images, runOcrOnAllPages]);

  const handleScoreChange = (qIndex, value) => {
    const num = parseInt(value, 10);
    setScores((prev) => {
      const next = [...prev];
      const max = next[qIndex].maxPoints;
      next[qIndex] = {
        ...next[qIndex],
        points: isNaN(num) ? 0 : Math.min(Math.max(num, 0), max),
      };
      return next;
    });
  };

  const handleQuickScore = (qIndex, pts) => {
    setScores((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], points: pts };
      return next;
    });
  };

  const currentScore = scores.reduce((sum, s) => sum + s.points, 0);
  const maxScore = scores.reduce((sum, s) => sum + s.maxPoints, 0);
  const pct = maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : 0;

  const handleGrade = () => {
    const result = gradeEssay(scores);
    navigation.navigate('Results', {
      images,
      testData,
      studentName: studentName || 'Student',
      studentNumber: studentNumber || '',
      score: String(result.score),
      percentage: result.percentage,
      gradingResults: result.results,
      gradingType: 'essay',
    });
  };

  // Full-screen scanning state (OCR running or grading)
  if (pipelineStep === 'ocr' || pipelineStep === 'ai') {
    const currentPageImg = pipelineStep === 'ocr' && images?.length > 0
      ? images[Math.min(ocrPageProgress.current - 1, images.length - 1)] || images[0]
      : images?.[0];
    return (
      <View style={styles.container}>
        <Header title="Processing..." onBack={() => navigation.goBack()} />
        <View style={styles.scanningContainer}>
          {currentPageImg && (
            <Image source={{ uri: currentPageImg }} style={styles.scanningImage} resizeMode="contain" />
          )}
          <ActivityIndicator size="large" color={pipelineStep === 'ai' ? colors.secondary : colors.accent} style={{ marginTop: 20 }} />
          <Text style={styles.scanningText}>{pipelineMsg}</Text>
          {pipelineStep === 'ocr' && ocrPageProgress.total > 1 && (
            <View style={styles.pageProgressBar}>
              <View style={[styles.pageProgressFill, { width: `${(ocrPageProgress.current / ocrPageProgress.total) * 100}%` }]} />
            </View>
          )}
          <View style={styles.pipelineSteps}>
            <View style={[styles.stepDot, pipelineStep === 'ocr' && styles.stepDotActive, pipelineStep === 'ai' && styles.stepDotDone]} />
            <View style={[styles.stepLine, pipelineStep === 'ai' && styles.stepLineDone]} />
            <View style={[styles.stepDot, pipelineStep === 'ai' && styles.stepDotActive]} />
          </View>
          <View style={styles.pipelineLabels}>
            <Text style={[styles.stepLabel, pipelineStep === 'ocr' && { color: colors.accent }]}>OCR ({ocrPageProgress.current}/{ocrPageProgress.total})</Text>
            <Text style={[styles.stepLabel, pipelineStep === 'ai' && { color: colors.secondary }]}>Grading</Text>
          </View>
        </View>
      </View>
    );
  }

  // OCR Review screen — show extracted text (read-only) before grading
  if (pipelineStep === 'review') {
    return (
      <View style={styles.container}>
        <Header title="Review Extracted Text" onBack={() => navigation.goBack()} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <AnimatedScreen>
            <Text style={styles.title}>Extracted Text</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 16 }]}>
              Below is the text extracted from {images?.length || 1} scanned page(s). Review it before proceeding.
            </Text>

            {/* Scanned page thumbnails */}
            {images?.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {images.map((uri, idx) => (
                  <View key={idx} style={styles.pageThumbnailWrap}>
                    <Image source={{ uri }} style={styles.pageThumbnail} resizeMode="cover" />
                    <Text style={styles.pageThumbnailLabel}>Page {idx + 1}</Text>
                    {pageTexts[idx]?.trim() ? (
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ position: 'absolute', top: 4, right: 4 }} />
                    ) : (
                      <Ionicons name="close-circle" size={16} color={colors.error} style={{ position: 'absolute', top: 4, right: 4 }} />
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Full combined OCR text */}
            <Card style={styles.ocrCard}>
              <View style={styles.ocrCardHeader}>
                <Ionicons name="reader-outline" size={18} color={colors.accent} />
                <Text style={styles.ocrCardLabel}>Full Extracted Text</Text>
              </View>
              <View style={styles.ocrTextBox}>
                <Text style={styles.ocrText} selectable>{fullOcrText || '(no text extracted)'}</Text>
              </View>
            </Card>

            {/* Per-question breakdown */}
            {questionCount > 1 && transcriptions.some(t => t.trim()) && (
              <View style={{ marginTop: 8 }}>
                <Text style={[typography.h4, { color: colors.text, marginBottom: 8 }]}>Per Question</Text>
                {transcriptions.map((text, i) => (
                  <Card key={i} style={styles.ocrCard}>
                    <View style={styles.ocrCardHeader}>
                      <Ionicons name="help-circle-outline" size={18} color={colors.secondary} />
                      <Text style={styles.ocrCardLabel}>
                        {questionTexts[i] ? `Q${i + 1}: ${questionTexts[i]}` : `Question ${i + 1}`}
                      </Text>
                    </View>
                    <View style={styles.ocrTextBox}>
                      <Text style={styles.ocrText} selectable>{text || '(no text detected for this question)'}</Text>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </AnimatedScreen>

          <AnimatedScreen delay={60}>
            <View style={{ gap: 10, marginTop: 16 }}>
              <Button title="Continue to Grading" onPress={handleConfirmOCR} variant="primary" />
              <Button title="Score Manually" onPress={handleSkipAI} variant="outline" />
              <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.retryBtnText}>Re-scan All Pages</Text>
              </TouchableOpacity>
            </View>
          </AnimatedScreen>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Score Answers"
        onBack={() => navigation.goBack()}
        rightIcon={showPreview ? 'close-circle-outline' : 'image-outline'}
        onRightPress={() => setShowPreview(!showPreview)}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <AnimatedScreen>
          <Text style={styles.title}>Essay / Handwriting Scoring</Text>

          {/* Grading mode indicator */}
          {(() => {
            const gm = getGradingMode(testData?.subject);
            return (
              <View style={[styles.gradingModeBanner, { backgroundColor: gm.color + '10', borderColor: gm.color + '30' }]}>
                <Ionicons name={gm.icon} size={16} color={gm.color} />
                <Text style={[styles.gradingModeText, { color: gm.color }]}>
                  {gm.label} — {testData?.subject || 'General'}
                </Text>
              </View>
            );
          })()}

          {/* Pipeline status */}
          <View style={[styles.statusBanner, {
            backgroundColor: pipelineStep === 'done' && currentScore > 0 ? colors.success + '15' : colors.info + '15',
          }]}>
            <Ionicons
              name={currentScore > 0 ? 'checkmark-circle' : 'information-circle'}
              size={20}
              color={currentScore > 0 ? colors.success : colors.info}
            />
            <Text style={styles.statusText}>{pipelineMsg}</Text>
          </View>

          {/* Retry button */}
          {openaiOk && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={handleRetry}
              disabled={!pipelineDone}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.retryBtnText}>Re-scan & Re-grade</Text>
            </TouchableOpacity>
          )}

          <Card style={styles.summaryBar}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Score</Text>
                <Text style={styles.summaryValue}>{currentScore} / {maxScore}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Percentage</Text>
                <Text style={[styles.summaryValue, { color: pct >= 50 ? colors.success : colors.error }]}>
                  {pct}%
                </Text>
              </View>
            </View>
          </Card>
        </AnimatedScreen>

        {showPreview && images?.length > 0 && (
          <AnimatedScreen>
            <Card style={styles.previewCard}>
              <Image
                source={{ uri: images[currentImage] }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              {images.length > 1 && (
                <View style={styles.imageNav}>
                  <TouchableOpacity
                    onPress={() => setCurrentImage(Math.max(0, currentImage - 1))}
                    disabled={currentImage === 0}
                  >
                    <Ionicons name="chevron-back" size={28} color={currentImage === 0 ? colors.textLight : colors.secondary} />
                  </TouchableOpacity>
                  <Text style={styles.imageCounter}>Page {currentImage + 1} of {images.length}</Text>
                  <TouchableOpacity
                    onPress={() => setCurrentImage(Math.min(images.length - 1, currentImage + 1))}
                    disabled={currentImage === images.length - 1}
                  >
                    <Ionicons name="chevron-forward" size={28} color={currentImage === images.length - 1 ? colors.textLight : colors.secondary} />
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          </AnimatedScreen>
        )}

        <AnimatedScreen delay={60}>
          {scores.map((item, qIndex) => (
            <Card key={qIndex} style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <Text style={styles.questionLabel}>Question {item.question}</Text>
                <Text style={styles.maxLabel}>Max: {item.maxPoints}</Text>
              </View>

              <View style={styles.scoringRow}>
                <View style={styles.quickButtons}>
                  <TouchableOpacity
                    style={[styles.quickBtn, item.points === 0 && styles.quickBtnActive]}
                    onPress={() => handleQuickScore(qIndex, 0)}
                  >
                    <Text style={[styles.quickBtnText, item.points === 0 && styles.quickBtnTextActive]}>0</Text>
                  </TouchableOpacity>
                  {item.maxPoints > 1 && (
                    <TouchableOpacity
                      style={[styles.quickBtn, item.points === Math.round(item.maxPoints / 2) && styles.quickBtnActive]}
                      onPress={() => handleQuickScore(qIndex, Math.round(item.maxPoints / 2))}
                    >
                      <Text style={[styles.quickBtnText, item.points === Math.round(item.maxPoints / 2) && styles.quickBtnTextActive]}>
                        {Math.round(item.maxPoints / 2)}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.quickBtn, item.points === item.maxPoints && styles.quickBtnActive]}
                    onPress={() => handleQuickScore(qIndex, item.maxPoints)}
                  >
                    <Text style={[styles.quickBtnText, item.points === item.maxPoints && styles.quickBtnTextActive]}>
                      {item.maxPoints}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.manualInput}>
                  <TextInput
                    style={styles.scoreInput}
                    value={String(item.points)}
                    onChangeText={(v) => handleScoreChange(qIndex, v)}
                    keyboardType="number-pad"
                    maxLength={3}
                    selectTextOnFocus
                  />
                  <Text style={styles.ofText}>/ {item.maxPoints}</Text>
                </View>
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, {
                    width: `${item.maxPoints > 0 ? (item.points / item.maxPoints) * 100 : 0}%`,
                    backgroundColor: item.points === item.maxPoints ? colors.success : item.points > 0 ? colors.warning : colors.error,
                  }]}
                />
              </View>
              {transcriptions[qIndex] ? (
                <View style={styles.transcriptionBox}>
                  <Ionicons name="document-text-outline" size={12} color={colors.accent} />
                  <Text style={styles.transcriptionText}>{transcriptions[qIndex]}</Text>
                </View>
              ) : null}
            </Card>
          ))}
        </AnimatedScreen>

        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button title="Finish Grading" onPress={handleGrade} variant="primary" />
          </View>
        </AnimatedScreen>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scanningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scanningImage: {
    width: '80%',
    height: 280,
    borderRadius: 12,
    opacity: 0.6,
  },
  scanningText: {
    ...typography.h3,
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  pipelineSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.accent,
  },
  stepDotDone: {
    backgroundColor: colors.success,
  },
  stepLine: {
    width: 60,
    height: 3,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  stepLineDone: {
    backgroundColor: colors.success,
  },
  pipelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 180,
    marginTop: 6,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: 8,
  },
  gradingModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  gradingModeText: {
    ...typography.caption,
    fontWeight: '700',
    marginLeft: 6,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusText: {
    ...typography.bodySmall,
    color: colors.text,
    marginLeft: 8,
    flex: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.accent,
    marginBottom: 16,
  },
  retryBtnText: {
    ...typography.bodySmall,
    color: '#fff',
    fontWeight: '700',
  },
  summaryBar: {
    marginBottom: 16,
    paddingVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  previewCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 300,
    backgroundColor: colors.surface,
  },
  imageNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  imageCounter: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  questionCard: {
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  questionLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  maxLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scoringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnActive: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondary + '15',
  },
  quickBtnText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  quickBtnTextActive: {
    color: colors.secondary,
  },
  manualInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreInput: {
    ...typography.h4,
    color: colors.text,
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    width: 50,
    height: 44,
    textAlign: 'center',
    fontWeight: '700',
  },
  ofText: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  transcriptionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accent + '10',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    gap: 6,
  },
  transcriptionText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    fontStyle: 'italic',
  },
  ocrCard: {
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ocrCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ocrCardLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  ocrTextBox: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minHeight: 60,
  },
  ocrText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  pageThumbnailWrap: {
    marginRight: 12,
    alignItems: 'center',
    position: 'relative',
  },
  pageThumbnail: {
    width: 80,
    height: 110,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageThumbnailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 11,
  },
  pageProgressBar: {
    width: '60%',
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 12,
  },
  pageProgressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  actions: {
    marginTop: 16,
  },
});
