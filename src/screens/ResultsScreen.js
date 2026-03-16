import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useScans } from '../context/ScansContext';
import { useToast } from '../components/Toast';

export default function ResultsScreen({ navigation, route }) {
  const { studentName, score, percentage, testData, images, gradingResults, gradingType } = route.params || {};
  const [currentView, setCurrentView] = useState('individual'); // 'individual' or 'list'
  const { scans, addScan } = useScans();
  const { showToast } = useToast();
  const testId = route?.params?.testId || testData?.id || null;
  const normalizedName = (studentName || 'Student').trim().toLowerCase();
  const isExisting = scans?.some((s) => (s.testId === testId) && ((s.studentName || '').trim().toLowerCase() === normalizedName));
  
  const individualResults = gradingResults || [];
  const correctCount = individualResults.filter(r => r.status === 'correct').length;
  const incorrectCount = individualResults.filter(r => r.status === 'incorrect').length;
  const partialCount = individualResults.filter(r => r.status === 'partial').length;
  
  const handleNext = () => {
    if (isExisting) {
      showToast('A saved result already exists for this student in this test and cannot be edited.', 'error');
      return;
    }
    // Save scanned paper to context, then navigate to next student or back to scan
    try {
      addScan({
        studentName: studentName || 'Student',
        score: score || null,
        percentage: percentage || null,
        testData: testData || {},
        images: images || [],
        pages: Array.isArray(images) ? images.length : (images ? 1 : 0),
        testId,
        gradingResults: gradingResults || [],
        gradingType: gradingType || null,
      });
    } catch (e) {
      // no-op; saving is best-effort for now
    }
    showToast('Saved to Recent Scans', 'success');
    navigation.navigate('Dashboard');
  };
  
  return (
    <View style={styles.container}>
      <Header
        title="Grading Results"
        onBack={() => navigation.goBack()}
        rightIcon="ellipsis-vertical"
        onRightPress={() => {}}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <AnimatedScreen>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{studentName || 'Student Name'}</Text>
            {!!images?.length && (
              <Text style={styles.pagesInfo}>Pages captured: {images.length}</Text>
            )}
          </View>
        </AnimatedScreen>
        
        <AnimatedScreen delay={60}>
          <Card style={styles.scoreCard}>
            <View style={styles.scoreMain}>
              <View style={styles.scoreLeft}>
                <Text style={styles.scoreValue}>{score || '0'}</Text>
                <Text style={styles.scoreLabel}>Points Total</Text>
                {incorrectCount > 0 && (
                  <Text style={styles.incorrectText}>
                    {incorrectCount} Incorrect
                  </Text>
                )}
                {partialCount > 0 && (
                  <Text style={[styles.incorrectText, { color: colors.warning }]}>
                    {partialCount} Partial
                  </Text>
                )}
              </View>
              <View style={styles.scoreRight}>
                <View style={[styles.percentageCircle, {
                  backgroundColor: (parseInt(percentage) >= 50 ? colors.success : colors.error) + '20',
                }]}>
                  <Text style={[styles.percentageValue, {
                    color: parseInt(percentage) >= 50 ? colors.success : colors.error,
                  }]}>{percentage || '0%'}</Text>
                  <Ionicons
                    name={parseInt(percentage) >= 50 ? 'checkmark-circle' : 'close-circle'}
                    size={40}
                    color={parseInt(percentage) >= 50 ? colors.success : colors.error}
                  />
                </View>
              </View>
            </View>
          </Card>
        </AnimatedScreen>
        
        <AnimatedScreen delay={120}>
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Question Results</Text>
            
            {individualResults.map((result, index) => (
              <Card key={index} style={styles.resultCard}>
                <View style={styles.resultRow}>
                  <View style={styles.resultLeft}>
                    <Text style={styles.questionNumber}>Question {result.question}</Text>
                    {(gradingType === 'mcq' || (result.correct && result.student && result.correct.length === 1)) ? (
                      <View style={styles.answerRow}>
                        <View style={styles.answerBadge}>
                          <Text style={styles.answerLabel}>Correct</Text>
                          <Text style={styles.answerValue}>{result.correct}</Text>
                        </View>
                        <Text style={styles.answerSeparator}>→</Text>
                        <View style={styles.answerBadge}>
                          <Text style={styles.answerLabel}>Student</Text>
                          <Text style={styles.answerValue}>{result.student}</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.answerRow}>
                        <View style={styles.answerBadge}>
                          <Text style={styles.answerLabel}>Score</Text>
                          <Text style={styles.answerValue}>{result.points} / {result.maxPoints || result.points}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <View style={styles.resultRight}>
                    {result.status === 'correct' ? (
                      <View style={styles.statusCorrect}>
                        <Text style={styles.statusText}>{result.points}</Text>
                      </View>
                    ) : result.status === 'partial' ? (
                      <View style={[styles.statusCorrect, { backgroundColor: colors.warning + '20' }]}>
                        <Text style={[styles.statusText, { color: colors.warning }]}>{result.points}</Text>
                      </View>
                    ) : (
                      <View style={styles.statusIncorrect}>
                        <Ionicons name="close" size={20} color={colors.error} />
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </AnimatedScreen>
      </ScrollView>
      
      {/* Action Buttons */}
      <AnimatedScreen delay={180}>
        <View style={styles.actions}>
          {!isExisting && (
            <Button
              title="Save & Next"
              onPress={handleNext}
              variant="primary"
            />
          )}
        </View>
      </AnimatedScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 100,
  },
  studentInfo: {
    marginBottom: 16,
  },
  studentName: {
    ...typography.h2,
    color: colors.text,
  },
  scoreCard: {
    marginBottom: 24,
  },
  scoreMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLeft: {
    flex: 1,
  },
  scoreValue: {
    ...typography.h1,
    color: colors.text,
    fontSize: 48,
    marginBottom: 8,
  },
  scoreLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  incorrectText: {
    ...typography.bodySmall,
    color: colors.error,
  },
  scoreRight: {
    alignItems: 'center',
  },
  percentageCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageValue: {
    ...typography.h2,
    color: colors.success,
    fontWeight: '700',
  },
  resultsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 16,
  },
  resultCard: {
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLeft: {
    flex: 1,
  },
  questionNumber: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  answerBadge: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  answerLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  answerValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  answerSeparator: {
    ...typography.body,
    color: colors.textLight,
    marginHorizontal: 12,
  },
  resultRight: {
    marginLeft: 16,
  },
  statusCorrect: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    ...typography.body,
    color: colors.success,
    fontWeight: '600',
  },
  statusIncorrect: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewButton: {
    marginBottom: 12,
  },
});
