import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { gradeMCQ } from '../utils/grading';
import { detectAnswersWithAI, getOpenAIKey } from '../utils/openaiService';

export default function MCQAnswerInputScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { images: passedImages, testData, studentName: passedName, studentNumber: passedNum } = route.params || {};
  const markingKey = testData?.markingKey || '';
  const questionCount = markingKey.length || parseInt(testData?.numberOfQuestions, 10) || 0;
  const mcqOptions = testData?.mcqOptions || 4;
  const CHOICES = Array.from({ length: mcqOptions }, (_, i) => String.fromCharCode(65 + i));

  // MCQ-only direct flow = no images passed from Scan screen
  const isDirectFlow = !passedImages || passedImages.length === 0;

  // Student details (editable in direct flow)
  const [studentName, setStudentName] = useState(passedName || '');
  const [studentNumber, setStudentNumber] = useState(passedNum || '');

  // Answer sheet images (captured in direct flow)
  const [images, setImages] = useState(passedImages || []);

  const [answers, setAnswers] = useState(
    Array.from({ length: questionCount }, () => '')
  );
  const [confidence, setConfidence] = useState(
    Array.from({ length: questionCount }, () => 0)
  );
  const [scanning, setScanning] = useState(!isDirectFlow);
  const [scanMessage, setScanMessage] = useState(isDirectFlow ? '' : 'Scanning answer sheet...');
  const [scanDone, setScanDone] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // ── Photo capture for direct flow ──
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.length > 0) {
      setImages([result.assets[0].uri]);
    }
  };

  const handlePickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImages([result.assets[0].uri]);
    }
  };

  // ── AI scan logic ──
  const runAIScan = useCallback(async (imageUri) => {
    if (!imageUri || questionCount === 0) {
      setScanMessage('No image or questions.');
      return;
    }
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
      setScanMessage('API key not set. Enter answers manually.');
      setScanning(false);
      setScanDone(true);
      return;
    }
    setScanning(true);
    setScanMessage('Reading answer sheet with AI...');
    try {
      const result = await detectAnswersWithAI(imageUri, questionCount, markingKey, mcqOptions);
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
      setScanMessage('AI scan failed. Enter answers manually.');
    }
    setScanning(false);
    setScanDone(true);
  }, [questionCount, markingKey, mcqOptions]);

  // Auto-scan when images are available (legacy flow or after capture in direct flow)
  useEffect(() => {
    if (images?.length > 0 && !scanDone) {
      runAIScan(images[0]);
    }
  }, [images]);

  const handleRetry = useCallback(async () => {
    if (!images?.length) return;
    await runAIScan(images[0]);
  }, [images, runAIScan]);

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
      studentNumber: studentNumber || '',
      score: String(result.score),
      percentage: result.percentage,
      gradingResults: result.results,
      gradingType: 'mcq',
      isDirectFlow,
    });
  };

  // Reset for next student (direct flow only)
  const handleNextStudent = () => {
    setImages([]);
    setStudentName('');
    setStudentNumber('');
    setAnswers(Array.from({ length: questionCount }, () => ''));
    setConfidence(Array.from({ length: questionCount }, () => 0));
    setScanning(false);
    setScanMessage('');
    setScanDone(false);
    setShowPreview(false);
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

  // ── Direct flow: capture student answer sheet ──
  if (isDirectFlow && images.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="MCQ Grading" onBack={() => navigation.goBack()} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <AnimatedScreen>
              <Text style={styles.title}>Grade Student</Text>
              <Text style={styles.subtitle}>
                Enter student details and scan their answer sheet.
              </Text>

              <Card style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="key-outline" size={18} color={colors.secondary} />
                  <Text style={[typography.bodySmall, { color: colors.secondary, fontWeight: '600', marginLeft: 6 }]}>
                    Marking Key: {markingKey.length} questions
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 2 }]}>
                  {markingKey}
                </Text>
              </Card>

              <Input
                label="Student Name"
                value={studentName}
                onChangeText={setStudentName}
                placeholder="Enter student name"
                iconName="person-outline"
                returnKeyType="next"
              />
              <Input
                label="Student Number (optional)"
                value={studentNumber}
                onChangeText={setStudentNumber}
                placeholder="Enter student number"
                iconName="id-card-outline"
                returnKeyType="done"
              />

              <Text style={[typography.caption, { color: colors.text, fontWeight: '600', marginTop: 12, marginBottom: 8 }]}>
                Scan Answer Sheet
              </Text>
              <View style={styles.uploadRow}>
                <TouchableOpacity style={styles.uploadBtn} onPress={handleTakePhoto} activeOpacity={0.7}>
                  <Ionicons name="camera-outline" size={28} color={colors.secondary} />
                  <Text style={[styles.uploadBtnText]}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadBtn} onPress={handlePickGallery} activeOpacity={0.7}>
                  <Ionicons name="images-outline" size={28} color={colors.secondary} />
                  <Text style={[styles.uploadBtnText]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </AnimatedScreen>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Answer review & grading ──
  return (
    <View style={styles.container}>
      <Header
        title={isDirectFlow ? `Grading: ${studentName || 'Student'}` : 'MCQ Answers'}
        onBack={() => isDirectFlow ? handleNextStudent() : navigation.goBack()}
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

          {/* Retry button */}
          {scanDone && images?.length > 0 && (
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
            Tap {CHOICES.join('/')} to correct any answer. Marking key will be compared automatically.
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
    flexWrap: 'wrap',
    gap: 6,
  },
  choiceButton: {
    minWidth: 40,
    paddingHorizontal: 12,
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
  uploadRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  uploadBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceLight,
  },
  uploadBtnText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '600',
    marginTop: 6,
  },
});
