import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { gradeMCQ } from '../utils/grading';
import { useGradingServer } from '../context/GradingServerContext';
import { detectMCQWithServer } from '../utils/gradingServerService';

const CHOICES = ['A', 'B', 'C', 'D'];

export default function MCQAnswerInputScreen({ navigation, route }) {
  const { images, testData, studentName } = route.params || {};
  const markingKey = testData?.markingKey || '';
  const questionCount = markingKey.length || parseInt(testData?.numberOfQuestions, 10) || 0;

  const [answers, setAnswers] = useState(
    Array.from({ length: questionCount }, () => '')
  );
  const [confidence, setConfidence] = useState(
    Array.from({ length: questionCount }, () => 0)
  );
  const [scanning, setScanning] = useState(true);
  const [scanMessage, setScanMessage] = useState('Scanning answer sheet...');
  const [scanDone, setScanDone] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { serverStatus } = useGradingServer();
  const serverOk = serverStatus?.ok;

  // Auto-scan on mount using OpenCV server
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!images?.length || questionCount === 0) {
        setScanMessage('No image or questions. Enter answers manually.');
        setScanning(false);
        setScanDone(true);
        return;
      }

      if (!serverOk) {
        setScanMessage('Grading server not connected. Enter answers manually.');
        setScanning(false);
        setScanDone(true);
        return;
      }

      setScanMessage('Sending image to grading server...');
      try {
        const result = await detectMCQWithServer(images[0], questionCount);
        if (cancelled) return;
        if (result.error) {
          setScanMessage(`Detection failed: ${result.error}. Correct answers below.`);
        } else {
          const newAnswers = result.answers.map((a) => (a === '?' ? '' : a));
          const newConf = result.confidence || Array.from({ length: questionCount }, () => 0);
          setAnswers(newAnswers);
          setConfidence(newConf);
          const detected = newAnswers.filter((a) => a !== '').length;
          if (detected === questionCount) {
            setScanMessage(`All ${questionCount} answers detected! Review and grade.`);
          } else if (detected > 0) {
            setScanMessage(`Detected ${detected}/${questionCount}. Fill in the rest below.`);
          } else {
            setScanMessage('Could not detect answers. Select manually below.');
          }
        }
      } catch {
        if (!cancelled) {
          setScanMessage('Server scan failed. Enter answers manually.');
        }
      }
      if (!cancelled) {
        setScanning(false);
        setScanDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRetry = useCallback(async () => {
    if (!images?.length || !serverOk) return;
    setScanning(true);
    setScanMessage('Retrying scan...');
    try {
      const result = await detectMCQWithServer(images[0], questionCount);
      if (result.error) {
        setScanMessage(`Retry failed: ${result.error}`);
      } else {
        const newAnswers = result.answers.map((a) => (a === '?' ? '' : a));
        const newConf = result.confidence || Array.from({ length: questionCount }, () => 0);
        setAnswers(newAnswers);
        setConfidence(newConf);
        const detected = newAnswers.filter((a) => a !== '').length;
        setScanMessage(detected === questionCount
          ? `All ${questionCount} answers detected!`
          : detected > 0
          ? `Detected ${detected}/${questionCount}.`
          : 'Could not detect answers.');
      }
    } catch {
      setScanMessage('Retry failed. Enter answers manually.');
    }
    setScanning(false);
  }, [images, questionCount, serverOk]);

  const handleSelect = (qIndex, choice) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = next[qIndex] === choice ? '' : choice;
      return next;
    });
    setConfidence((prev) => {
      const next = [...prev];
      next[qIndex] = 100;
      return next;
    });
  };

  const answeredCount = answers.filter((a) => a !== '').length;
  const allAnswered = answeredCount === questionCount;
  const uncertainCount = answers.filter((a, i) => a !== '' && confidence[i] < 50).length;

  const handleGrade = () => {
    const pointsPerQ = testData?.totalPoints
      ? Math.round(Number(testData.totalPoints) / questionCount)
      : 1;
    const result = gradeMCQ(markingKey, answers, pointsPerQ);
    navigation.navigate('Results', {
      images,
      testData,
      studentName: studentName || 'Student',
      score: String(result.score),
      percentage: result.percentage,
      gradingResults: result.results,
      gradingType: 'mcq',
    });
  };

  // Scanning state — full screen loader
  if (scanning && !scanDone) {
    return (
      <View style={styles.container}>
        <Header title="Scanning..." onBack={() => navigation.goBack()} />
        <View style={styles.scanningContainer}>
          {images?.length > 0 && (
            <Image source={{ uri: images[0] }} style={styles.scanningImage} resizeMode="contain" />
          )}
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 20 }} />
          <Text style={styles.scanningText}>{scanMessage}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="MCQ Answers"
        onBack={() => navigation.goBack()}
        rightIcon={showPreview ? 'close-circle-outline' : 'image-outline'}
        onRightPress={() => setShowPreview(!showPreview)}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <AnimatedScreen>
          {/* Status banner */}
          <View style={[styles.statusBanner, {
            backgroundColor: allAnswered && uncertainCount === 0
              ? colors.success + '15'
              : uncertainCount > 0
              ? colors.warning + '15'
              : colors.info + '15',
          }]}>
            <Ionicons
              name={allAnswered && uncertainCount === 0 ? 'checkmark-circle' : uncertainCount > 0 ? 'alert-circle' : 'information-circle'}
              size={20}
              color={allAnswered && uncertainCount === 0 ? colors.success : uncertainCount > 0 ? colors.warning : colors.info}
            />
            <Text style={styles.statusText}>{scanMessage}</Text>
          </View>

          {/* Retry button if server is available */}
          {serverOk && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={handleRetry}
              disabled={scanning}
              activeOpacity={0.7}
            >
              {scanning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="refresh" size={18} color="#fff" />
              )}
              <Text style={styles.retryBtnText}>
                {scanning ? 'Scanning...' : 'Re-scan'}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.title}>Review Answers</Text>
          <Text style={styles.subtitle}>
            Tap A/B/C/D to correct any answer. Marking key will be compared automatically.
          </Text>
          <Text style={styles.progress}>
            {answeredCount} / {questionCount} answered
            {uncertainCount > 0 && `  •  ${uncertainCount} uncertain`}
          </Text>
        </AnimatedScreen>

        {showPreview && images?.length > 0 && (
          <AnimatedScreen>
            <Card style={styles.previewCard}>
              <Image source={{ uri: images[0] }} style={styles.previewImage} resizeMode="contain" />
            </Card>
          </AnimatedScreen>
        )}

        <AnimatedScreen delay={60}>
          {answers.map((selected, qIndex) => {
            const conf = confidence[qIndex] || 0;
            const isUncertain = selected !== '' && conf < 50 && conf > 0;
            return (
              <Card
                key={qIndex}
                style={[styles.questionCard, isUncertain && styles.questionCardUncertain]}
              >
                <View style={styles.questionHeader}>
                  <Text style={styles.questionLabel}>Q{qIndex + 1}</Text>
                  {selected !== '' && conf > 0 && (
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
                          isSelected && isUncertain && styles.choiceUncertain,
                        ]}
                        onPress={() => handleSelect(qIndex, choice)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.choiceText,
                          isSelected && styles.choiceTextSelected,
                          isSelected && isUncertain && styles.choiceTextUncertain,
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
        </AnimatedScreen>

        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button
              title={allAnswered ? 'Grade Now' : `Grade (${answeredCount}/${questionCount})`}
              onPress={handleGrade}
              variant="primary"
              disabled={answeredCount === 0}
            />
          </View>
        </AnimatedScreen>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    height: 300,
    borderRadius: 12,
    opacity: 0.6,
  },
  scanningText: {
    ...typography.h3,
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
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
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  progress: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
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
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  questionCardUncertain: {
    borderWidth: 1,
    borderColor: colors.warning,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  questionLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
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
  choicesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  choiceButton: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 12,
    borderRadius: 10,
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
  choiceUncertain: {
    borderColor: colors.warning,
    backgroundColor: colors.warning + '15',
  },
  choiceText: {
    ...typography.h4,
    color: colors.textSecondary,
  },
  choiceTextSelected: {
    color: colors.secondary,
    fontWeight: '700',
  },
  choiceTextUncertain: {
    color: colors.warning,
  },
  actions: {
    marginTop: 16,
  },
});
