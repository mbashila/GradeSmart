import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { gradeMixed } from '../utils/grading';
import { getOpenAIKey, detectAnswersWithAI } from '../utils/openaiService';
import { getGradingMode } from '../components/SubjectPicker';
import { deriveQuestionStats } from '../utils/questionUtils';
import useEssayGradingPipeline from '../hooks/useEssayGradingPipeline';

export default function MixedScoringScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { images, sectionImages, testData, studentName, studentNumber } = route.params || {};
  const markingKey = testData?.markingKey || '';
  const sectionData = testData?.sectionData || [];
  const derived = deriveQuestionStats(sectionData);
  const mcqCount = (derived.totalQuestions > 0 ? derived.mcqCount : (parseInt(testData?.mcqCount, 10) || markingKey.length || 0));
  const mcqOptions = testData?.mcqOptions || 4;
  const CHOICES = Array.from({ length: mcqOptions }, (_, i) => String.fromCharCode(65 + i));

  // Determine total questions — use derived if essay sections have questions populated,
  // otherwise fall back to testData.numberOfQuestions to account for essay sections with empty question arrays
  const hasNonMcqSections = sectionData.some(s => s.type !== 'mcq');
  const derivedEssayHasQuestions = derived.essayCount > 0;
  const totalQuestions = (() => {
    if (derived.totalQuestions > 0 && derivedEssayHasQuestions) {
      return derived.totalQuestions;
    }
    const fromTestData = parseInt(testData?.numberOfQuestions, 10) || 0;
    if (fromTestData > mcqCount) return fromTestData;
    if (derived.totalQuestions > mcqCount) return derived.totalQuestions;
    // If we have non-MCQ sections but no question count, estimate at least 1 essay question per section
    if (hasNonMcqSections) {
      const nonMcqSectionCount = sectionData.filter(s => s.type !== 'mcq').length;
      return mcqCount + Math.max(nonMcqSectionCount, 1);
    }
    return derived.totalQuestions || mcqCount;
  })();
  const essayCount = Math.max(totalQuestions - mcqCount, 0);
  const totalPoints = parseInt(testData?.totalPoints, 10) || totalQuestions;

  // Distribute points: MCQ gets equal share, essay gets the rest
  const mcqPointsEach = mcqCount > 0 ? Math.round(totalPoints / totalQuestions) : 0;
  const essayTotalPoints = totalPoints - mcqPointsEach * mcqCount;
  const essayPointsEach = essayCount > 0 ? Math.round(essayTotalPoints / essayCount) : 0;

  const [mcqAnswers, setMcqAnswers] = useState(
    Array.from({ length: mcqCount }, () => '')
  );
  const [mcqConfidence, setMcqConfidence] = useState(
    Array.from({ length: mcqCount }, () => 0)
  );
  const [essayScores, setEssayScores] = useState(
    Array.from({ length: essayCount }, (_, i) => ({
      question: mcqCount + i + 1,
      points: 0,
      maxPoints: i < essayCount - 1
        ? essayPointsEach
        : Math.max(essayTotalPoints - essayPointsEach * (essayCount - 1), 0),
    }))
  );
  const [showPreview, setShowPreview] = useState(false);
  const [section, setSection] = useState('mcq'); // 'mcq' or 'essay'

  const [openaiOk, setOpenaiOk] = useState(false);

  // Check grading key on mount
  useEffect(() => {
    (async () => {
      const key = await getOpenAIKey();
      setOpenaiOk(!!key);
    })();
  }, []);

  const questionTexts = React.useMemo(() => {
    // Derive essay question texts from extracted questions (non-MCQ) if available
    const extracted = testData?.extractedQuestions || [];
    if (extracted.length > 0) {
      const nonMcq = extracted.filter(q => q.type !== 'mcq');
      if (nonMcq.length > 0) return nonMcq.map(q => q.text || `Question ${q.number || ''}`);
    }
    // Fall back to questionTexts from test setup (non-MCQ section texts)
    return testData?.questionTexts || [];
  }, [testData?.extractedQuestions, testData?.questionTexts]);

  // For mixed tests, filter sectionImages to non-MCQ sections only
  const essaySectionImages = React.useMemo(() => {
    if (!sectionImages) return null;
    return sectionImages.filter(s => s.type !== 'mcq');
  }, [sectionImages]);

  const essaySectionData = React.useMemo(() => {
    return sectionData.filter(s => s.type !== 'mcq');
  }, [sectionData]);

  // Essay pipeline via shared hook
  const {
    transcriptions,
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
  } = useEssayGradingPipeline({
    images,
    sectionImages: essaySectionImages,
    sectionData: essaySectionData,
    questionCount: essayCount,
    questionTexts,
    scores: essayScores,
    setScores: setEssayScores,
    subject: testData?.subject || '',
    gradeLevel: testData?.grade || '',
    diagramIndices: React.useMemo(() => {
      if (Array.isArray(sectionData) && sectionData.length > 0) {
        const nonMcqSections = sectionData.filter(s => s.type !== 'mcq');
        const indices = new Set();
        let essayIdx = 0;
        for (const sec of nonMcqSections) {
          const qs = Array.isArray(sec.questions) ? sec.questions : [];
          for (const q of qs) {
            if (q.type === 'diagram') indices.add(essayIdx);
            essayIdx++;
          }
        }
        return indices;
      }
      const indices = new Set();
      const extractedQuestions = testData?.extractedQuestions || [];
      extractedQuestions.forEach((q) => {
        if (q.type === 'diagram') {
          const eIdx = q.number - 1 - mcqCount;
          if (eIdx >= 0 && eIdx < Math.max(totalQuestions - mcqCount, 0)) indices.add(eIdx);
        }
      });
      return indices;
    }, [sectionData, testData?.extractedQuestions, mcqCount, totalQuestions]),
    studentName: studentName || 'Student',
  });

  const [mcqPhase, setMcqPhase] = useState(false);
  const [mcqMsg, setMcqMsg] = useState('');

  // Auto pipeline — runs once openaiOk is resolved
  useEffect(() => {
    if (!openaiOk) return; // wait for key check
    const cancelled = { value: false };
    (async () => {
      if (!images?.length) {
        markDone('No image. Enter answers manually.');
        setMcqPhase(false);
        return;
      }

      // Determine MCQ and essay images from section tags or legacy flat array
      const mcqSectionImgs = sectionImages
        ? sectionImages.filter(s => s.type === 'mcq').flatMap(s => s.images || [])
        : null;
      const mcqImage = mcqSectionImgs && mcqSectionImgs.length > 0
        ? mcqSectionImgs[0]
        : images[0];

      // Step 1: MCQ detection with OpenAI Vision
      if (mcqCount > 0) {
        setMcqPhase(true);
        setMcqMsg('Reading MCQ answers with AI...');
        try {
          const mcqResult = await detectAnswersWithAI(mcqImage, mcqCount, markingKey, mcqOptions);
          if (cancelled.value) return;
          if (!mcqResult.error) {
            const newAnswers = mcqResult.answers.map((a) => (a === '?' ? '' : a));
            const newConf = mcqResult.confidence || Array.from({ length: mcqCount }, () => 0);
            setMcqAnswers(newAnswers);
            setMcqConfidence(newConf);
            const detected = newAnswers.filter((a) => a !== '').length;
            setMcqMsg(`MCQ: ${detected}/${mcqCount} detected.`);
          } else {
            setMcqMsg(`MCQ detection failed: ${mcqResult.error}`);
          }
        } catch {
          if (!cancelled.value) setMcqMsg('MCQ scan failed.');
        }
      }

      // Step 2: Essay OCR — section-by-section if available, otherwise legacy
      if (essayCount > 0 && !cancelled.value && openaiOk) {
        setMcqPhase(false);
        if (essaySectionImages && essaySectionImages.length > 0) {
          // Section-by-section: the pipeline handles it via sectionImages param
          const essayFlatImgs = essaySectionImages.flatMap(s => s.images || []);
          await runOcrOnAllPages(essayFlatImgs, cancelled);
        } else {
          // Legacy: skip MCQ page if multiple images
          const essayImages = (mcqCount > 0 && images.length > 1)
            ? images.slice(1)
            : images;
          await runOcrOnAllPages(essayImages, cancelled);
        }
        return; // pause at review or done
      } else if (essayCount > 0 && !openaiOk) {
        setMcqPhase(false);
        markDone('API key not set. Score essays manually.');
      }

      if (!cancelled.value) {
        setMcqPhase(false);
        markDone(mcqCount > 0 && essayCount === 0 ? 'MCQ scan complete. Review below.' : 'Processing complete. Review below.');
      }
    })();
    return () => { cancelled.value = true; };
  }, [openaiOk]);

  const handleSkipEssayAI = useCallback(() => {
    handleSkipAI();
  }, [handleSkipAI]);

  const handleMcqSelect = (qIndex, choice) => {
    setMcqAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = next[qIndex] === choice ? '' : choice;
      return next;
    });
    setMcqConfidence((prev) => {
      const next = [...prev];
      next[qIndex] = 100;
      return next;
    });
  };

  const handleEssayScore = (eIndex, value) => {
    const num = parseInt(value, 10);
    setEssayScores((prev) => {
      const next = [...prev];
      const max = next[eIndex].maxPoints;
      next[eIndex] = { ...next[eIndex], points: isNaN(num) ? 0 : Math.min(Math.max(num, 0), max) };
      return next;
    });
  };

  const handleEssayQuick = (eIndex, pts) => {
    setEssayScores((prev) => {
      const next = [...prev];
      next[eIndex] = { ...next[eIndex], points: pts };
      return next;
    });
  };

  const mcqAnswered = mcqAnswers.filter((a) => a !== '').length;
  const essayTotal = essayScores.reduce((s, e) => s + e.points, 0);
  const essayMax = essayScores.reduce((s, e) => s + e.maxPoints, 0);

  const handleGrade = () => {
    const result = gradeMixed(markingKey, mcqAnswers, mcqPointsEach, essayScores);
    navigation.navigate('Results', {
      images,
      testData,
      studentName: studentName || 'Student',
      studentNumber: studentNumber || '',
      score: String(result.score),
      percentage: result.percentage,
      gradingResults: result.results,
      gradingType: 'mixed',
      mcqResults: result.mcqResults,
      essayResults: result.essayResults,
    });
  };

  // Full-screen scanning state (MCQ/OCR/grading running)
  const currentMsg = mcqPhase ? mcqMsg : pipelineMsg;
  if (mcqPhase || pipelineStep === 'ocr' || pipelineStep === 'ai') {
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
          <ActivityIndicator size="large" color={(pipelineStep === 'ai' || mcqPhase) ? colors.secondary : colors.accent} style={{ marginTop: 20 }} />
          <Text style={styles.scanningText}>{currentMsg}</Text>
          {pipelineStep === 'ocr' && ocrPageProgress.total > 1 && (
            <View style={styles.pageProgressBar}>
              <View style={[styles.pageProgressFill, { width: `${(ocrPageProgress.current / ocrPageProgress.total) * 100}%` }]} />
            </View>
          )}
          <View style={styles.pipelineSteps}>
            <View style={[styles.stepDot, mcqPhase && styles.stepDotActive, (!mcqPhase && (pipelineStep === 'ocr' || pipelineStep === 'ai')) && styles.stepDotDone]} />
            <View style={[styles.stepLine, (!mcqPhase && (pipelineStep === 'ocr' || pipelineStep === 'ai')) && styles.stepLineDone]} />
            <View style={[styles.stepDot, pipelineStep === 'ocr' && styles.stepDotActive, pipelineStep === 'ai' && styles.stepDotDone]} />
            <View style={[styles.stepLine, pipelineStep === 'ai' && styles.stepLineDone]} />
            <View style={[styles.stepDot, pipelineStep === 'ai' && styles.stepDotActive]} />
          </View>
          <View style={styles.pipelineLabels}>
            <Text style={[styles.stepLabel, mcqPhase && { color: colors.accent }]}>MCQ</Text>
            <Text style={[styles.stepLabel, pipelineStep === 'ocr' && { color: colors.accent }]}>OCR ({ocrPageProgress.current}/{ocrPageProgress.total})</Text>
            <Text style={[styles.stepLabel, pipelineStep === 'ai' && { color: colors.secondary }]}>Grading</Text>
          </View>
        </View>
      </View>
    );
  }

  // OCR Review screen — show extracted essay text (read-only) before grading
  if (pipelineStep === 'review') {
    return (
      <View style={styles.container}>
        <Header title="Review Extracted Text" onBack={() => navigation.goBack()} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <AnimatedScreen>
            <Text style={styles.sectionTitle}>Extracted Text</Text>
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
            {essayCount > 1 && transcriptions.some(t => String(t || '').trim()) && (
              <View style={{ marginTop: 8 }}>
                <Text style={[typography.h4, { color: colors.text, marginBottom: 8 }]}>Per Question</Text>
                {transcriptions.map((text, i) => (
                  <Card key={i} style={styles.ocrCard}>
                    <View style={styles.ocrCardHeader}>
                      <Ionicons name="help-circle-outline" size={18} color={colors.secondary} />
                      <Text style={styles.ocrCardLabel}>
                        {questionTexts[i] ? `Q${mcqCount + i + 1}: ${questionTexts[i]}` : `Question ${mcqCount + i + 1}`}
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
              <Button title="Score Manually" onPress={handleSkipEssayAI} variant="outline" />
            </View>
          </AnimatedScreen>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Mixed Grading"
        onBack={() => navigation.goBack()}
        rightIcon={showPreview ? 'close-circle-outline' : 'image-outline'}
        onRightPress={() => setShowPreview(!showPreview)}
      />

      {/* Section tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, section === 'mcq' && styles.tabActive]}
          onPress={() => setSection('mcq')}
        >
          <Ionicons name="radio-button-on" size={18} color={section === 'mcq' ? colors.secondary : colors.textLight} />
          <Text style={[styles.tabText, section === 'mcq' && styles.tabTextActive]}>
            MCQ ({mcqAnswered}/{mcqCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, section === 'essay' && styles.tabActive]}
          onPress={() => setSection('essay')}
        >
          <Ionicons name="document-text" size={18} color={section === 'essay' ? colors.secondary : colors.textLight} />
          <Text style={[styles.tabText, section === 'essay' && styles.tabTextActive]}>
            Essay ({essayTotal}/{essayMax})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Grading mode indicator */}
        {essayCount > 0 && (() => {
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
          backgroundColor: pipelineStep === 'done' ? colors.success + '15' : colors.info + '15',
        }]}>
          <Ionicons
            name={pipelineStep === 'done' ? 'checkmark-circle' : 'information-circle'}
            size={18}
            color={pipelineStep === 'done' ? colors.success : colors.info}
          />
          <Text style={styles.statusText}>{pipelineMsg}</Text>
        </View>

        {showPreview && images?.length > 0 && (
          <AnimatedScreen>
            <Card style={styles.previewCard}>
              <Image
                source={{ uri: images[0] }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </Card>
          </AnimatedScreen>
        )}

        {section === 'mcq' && (
          <AnimatedScreen>
            <Text style={styles.sectionTitle}>Multiple Choice Questions</Text>
            <Text style={styles.sectionSub}>Tap A/B/C/D to correct any answer.</Text>
            {mcqAnswers.map((selected, qIndex) => {
              const conf = mcqConfidence[qIndex] || 0;
              const isUncertain = selected !== '' && conf < 50;
              const isEmpty = selected === '';
              return (
                <Card key={qIndex} style={[
                  styles.questionCard,
                  isUncertain && { borderWidth: 1, borderColor: colors.warning },
                  isEmpty && { borderWidth: 1, borderColor: colors.error + '60' },
                ]}>
                  <View style={styles.questionHeader}>
                    <Text style={styles.questionLabel}>Q{qIndex + 1}</Text>
                    {selected !== '' && (
                      <View style={[styles.confBadge, {
                        backgroundColor: conf >= 70 ? colors.success + '20' : conf >= 40 ? colors.warning + '20' : colors.error + '20',
                      }]}>
                        <Text style={[styles.confText, {
                          color: conf >= 70 ? colors.success : conf >= 40 ? colors.warning : colors.error,
                        }]}>
                          {conf >= 70 ? 'High' : conf >= 40 ? 'Med' : 'Low'}
                        </Text>
                      </View>
                    )}
                    {isEmpty && (
                      <View style={[styles.confBadge, { backgroundColor: colors.error + '20' }]}>
                        <Text style={[styles.confText, { color: colors.error }]}>Not detected</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.choicesRow}>
                    {CHOICES.map((choice) => {
                      const isSelected = selected === choice;
                      return (
                        <TouchableOpacity
                          key={choice}
                          style={[
                            styles.choiceButton,
                            isSelected && styles.choiceSelected,
                            isSelected && isUncertain && { borderColor: colors.warning, backgroundColor: colors.warning + '15' },
                          ]}
                          onPress={() => handleMcqSelect(qIndex, choice)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.choiceText,
                            isSelected && styles.choiceTextSelected,
                            isSelected && isUncertain && { color: colors.warning },
                          ]}>
                            {choice}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Card>
              );
            })}
            {essayCount > 0 && (
              <Button
                title="Next: Essay Questions"
                onPress={() => setSection('essay')}
                variant="outline"
                style={{ marginTop: 8 }}
              />
            )}
          </AnimatedScreen>
        )}

        {section === 'essay' && (
          <AnimatedScreen>
            <Text style={styles.sectionTitle}>Essay / Written Questions</Text>
            <Text style={styles.sectionSub}>Review suggested scores or assign points manually.</Text>
            {essayScores.map((item, eIndex) => (
              <Card key={eIndex} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionLabel}>Question {item.question}</Text>
                  <Text style={styles.maxLabel}>Max: {item.maxPoints}</Text>
                </View>
                <View style={styles.scoringRow}>
                  <View style={styles.quickButtons}>
                    <TouchableOpacity
                      style={[styles.quickBtn, item.points === 0 && styles.quickBtnActive]}
                      onPress={() => handleEssayQuick(eIndex, 0)}
                    >
                      <Text style={[styles.quickBtnText, item.points === 0 && styles.quickBtnTextActive]}>0</Text>
                    </TouchableOpacity>
                    {item.maxPoints > 1 && (
                      <TouchableOpacity
                        style={[styles.quickBtn, item.points === Math.round(item.maxPoints / 2) && styles.quickBtnActive]}
                        onPress={() => handleEssayQuick(eIndex, Math.round(item.maxPoints / 2))}
                      >
                        <Text style={[styles.quickBtnText, item.points === Math.round(item.maxPoints / 2) && styles.quickBtnTextActive]}>
                          {Math.round(item.maxPoints / 2)}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.quickBtn, item.points === item.maxPoints && styles.quickBtnActive]}
                      onPress={() => handleEssayQuick(eIndex, item.maxPoints)}
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
                      onChangeText={(v) => handleEssayScore(eIndex, v)}
                      keyboardType="number-pad"
                      maxLength={3}
                      selectTextOnFocus
                    />
                    <Text style={styles.ofText}>/ {item.maxPoints}</Text>
                  </View>
                </View>
                <View style={styles.statusBar}>
                  <View
                    style={[
                      styles.statusFill,
                      {
                        width: `${item.maxPoints > 0 ? (item.points / item.maxPoints) * 100 : 0}%`,
                        backgroundColor: item.points === item.maxPoints
                          ? colors.success
                          : item.points > 0
                          ? colors.warning
                          : colors.error,
                      },
                    ]}
                  />
                </View>
                {transcriptions[eIndex] ? (
                  <View style={styles.transcriptionBox}>
                    <Ionicons name="server-outline" size={12} color={colors.accent} />
                    <Text style={styles.transcriptionText}>{transcriptions[eIndex]}</Text>
                  </View>
                ) : null}
              </Card>
            ))}
          </AnimatedScreen>
        )}

        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button
              title="Grade Now"
              onPress={handleGrade}
              variant="primary"
              disabled={mcqAnswered === 0 && essayTotal === 0}
            />
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
    width: 40,
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
  transcriptionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accent + '08',
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
  confBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabActive: {
    borderBottomColor: colors.secondary,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.textLight,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 4,
  },
  sectionSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  previewCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 250,
    backgroundColor: colors.surface,
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
    marginBottom: 8,
  },
  maxLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  choicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  choiceButton: {
    minWidth: 40,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceSelected: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondary + '15',
  },
  choiceText: {
    ...typography.h4,
    color: colors.textSecondary,
  },
  choiceTextSelected: {
    color: colors.secondary,
    fontWeight: '700',
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
  statusBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  statusFill: {
    height: '100%',
    borderRadius: 2,
  },
  actions: {
    marginTop: 16,
  },
});
