import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import Stepper from '../components/Stepper';
import { useToast } from '../components/Toast';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import Input from '../components/Input';

export default function QuestionTypeScreen({ navigation, route }) {
  const { showToast } = useToast();
  const [questionType, setQuestionType] = useState(route?.params?.questionType || '');
  const [markingKey, setMarkingKey] = useState(route?.params?.markingKey || '');
  const [mcqCount, setMcqCount] = useState(route?.params?.mcqCount || '');
  const [questionTexts, setQuestionTexts] = useState(route?.params?.questionTexts || []);
  
  const testData = route.params || {};
  const expectedCount = Number.isFinite(parseInt(testData.numberOfQuestions)) ? parseInt(testData.numberOfQuestions) : null;

  // Compute essay question count for input fields
  const essayQuestionCount = (() => {
    if (questionType === 'essay') return expectedCount || 0;
    if (questionType === 'mixed') {
      const mc = parseInt(mcqCount, 10) || 0;
      return expectedCount ? Math.max(expectedCount - mc, 0) : 0;
    }
    return 0;
  })();

  const handleQuestionTextChange = (index, text) => {
    setQuestionTexts((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const numericMcqCount = (() => {
    const n = parseInt(mcqCount, 10);
    if (Number.isFinite(n)) return n; 
    return null;
  })();

  const handleKeyChange = (txt) => {
    let v = (txt || '').toUpperCase().replace(/[^A-D]/g, '');
    const limit = questionType === 'mixed' ? (numericMcqCount || 0) : (expectedCount || 0);
    if (limit && v.length > limit) v = v.slice(0, limit);
    setMarkingKey(v);
  };

  const handleMcqCountChange = (txt) => {
    let cleaned = (txt || '').replace(/[^0-9]/g, '');
    if (cleaned.length > 0) {
      let n = parseInt(cleaned, 10);
      if (expectedCount && n > expectedCount) n = expectedCount;
      if (n < 0) n = 0;
      cleaned = String(n);
    }
    setMcqCount(cleaned);
    setMarkingKey((prev) => {
      const limit = parseInt(cleaned || '0', 10) || 0;
      return limit && prev ? prev.slice(0, limit) : '';
    });
  };
  
  const handleContinue = () => {
    if (!questionType) return;
    if (questionType === 'multiple-choice') {
      if (!markingKey) {
        showToast('Please enter the MCQ marking key', 'error');
        return;
      }
      if (expectedCount && markingKey.length !== expectedCount) {
        showToast(`Marking key must have ${expectedCount} answers`, 'error');
        return;
      }
    }
    if (questionType === 'mixed') {
      const n = numericMcqCount || 0;
      if (!n || n <= 0) {
        showToast('Enter how many MCQs are in this mixed test', 'error');
        return;
      }
      if (expectedCount && n > expectedCount) {
        showToast(`MCQ count cannot exceed total questions (${expectedCount})`, 'error');
        return;
      }
      if (!markingKey || markingKey.length !== n) {
        showToast(`Enter a ${n}-answer MCQ key (A-D)`, 'error');
        return;
      }
    }
    showToast('Question type saved', 'success');
    navigation.navigate('ReviewTest', {
      ...testData,
      questionType,
      mcqCount: questionType === 'mixed' ? (numericMcqCount || null) : undefined,
      markingKey: questionType === 'multiple-choice' || questionType === 'mixed' ? markingKey : undefined,
      questionTexts: (questionType === 'essay' || questionType === 'mixed') ? questionTexts : undefined,
    });
  };
  
  return (
    <View style={styles.container}>
      <Header
        title="Question Type"
        onBack={() => navigation.goBack()}
      />
      
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Stepper steps={['Details', 'Questions', 'Review']} current={1} />
        <AnimatedScreen>
          <View style={styles.content}>
            <Text style={styles.title}>Choose Question Type</Text>
            <Text style={styles.subtitle}>
              Select the type of questions in your test
            </Text>
            
            <View style={styles.options}>
              <TouchableOpacity
                style={[
                  styles.option,
                  questionType === 'multiple-choice' && styles.optionSelected,
                ]}
                onPress={() => setQuestionType('multiple-choice')}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="radio-button-on" 
                    size={32} 
                    color={questionType === 'multiple-choice' ? colors.secondary : colors.textLight} 
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionTitle,
                    questionType === 'multiple-choice' && styles.optionTitleSelected,
                  ]}>
                    Multiple Choice
                  </Text>
                  <Text style={styles.optionDescription}>
                    OMR sheets with A, B, C, D options
                  </Text>
                </View>
                {questionType === 'multiple-choice' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.option,
                  questionType === 'essay' && styles.optionSelected,
                ]}
                onPress={() => setQuestionType('essay')}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="document-text" 
                    size={32} 
                    color={questionType === 'essay' ? colors.secondary : colors.textLight} 
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionTitle,
                    questionType === 'essay' && styles.optionTitleSelected,
                  ]}>
                    Essay-Based
                  </Text>
                  <Text style={styles.optionDescription}>
                    Written answers requiring manual review
                  </Text>
                </View>
                {questionType === 'essay' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.option,
                  questionType === 'mixed' && styles.optionSelected,
                ]}
                onPress={() => setQuestionType('mixed')}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="layers" 
                    size={32} 
                    color={questionType === 'mixed' ? colors.secondary : colors.textLight} 
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionTitle,
                    questionType === 'mixed' && styles.optionTitleSelected,
                  ]}>
                    Mixed
                  </Text>
                  <Text style={styles.optionDescription}>
                    Combination of multiple choice and essay questions
                  </Text>
                </View>
                {questionType === 'mixed' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                )}
              </TouchableOpacity>
            </View>

            {/* Essay question text inputs */}
            {(questionType === 'essay' || questionType === 'mixed') && essayQuestionCount > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[typography.h4, { color: colors.text, marginBottom: 4 }]}>Essay Questions</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Enter the question text so the AI knows what was asked.
                </Text>
                {Array.from({ length: essayQuestionCount }, (_, i) => {
                  const qNum = questionType === 'mixed' ? (parseInt(mcqCount, 10) || 0) + i + 1 : i + 1;
                  return (
                    <Input
                      key={`essay-q-${i}`}
                      label={`Question ${qNum}`}
                      value={questionTexts[i] || ''}
                      onChangeText={(v) => handleQuestionTextChange(i, v)}
                      placeholder={`e.g., Explain the causes of...`}
                      multiline
                      style={{ marginBottom: 8 }}
                    />
                  );
                })}
              </View>
            )}

            {(questionType === 'multiple-choice' || questionType === 'mixed') && (
              <View style={{ marginTop: 8 }}>
                {questionType === 'mixed' && (
                  <View style={{ marginBottom: 12 }}>
                    <Input
                      label={`Number of MCQs${expectedCount ? ` (max ${expectedCount})` : ''}`}
                      value={String(mcqCount)}
                      onChangeText={handleMcqCountChange}
                      placeholder={expectedCount ? `e.g., ${Math.min(10, expectedCount)}` : 'e.g., 10'}
                      keyboardType="number-pad"
                    />
                  </View>
                )}
                <Input
                  label={`MCQ Marking Key${questionType === 'multiple-choice' ? (expectedCount ? ` (${expectedCount} answers)` : '') : (numericMcqCount ? ` (${numericMcqCount} answers)` : '')}`}
                  value={markingKey}
                  onChangeText={handleKeyChange}
                  placeholder={(questionType === 'multiple-choice')
                    ? (expectedCount ? 'e.g., ' + 'ABCD'.repeat(Math.ceil(expectedCount/4)).slice(0, expectedCount) : 'e.g., ABCDABCD')
                    : (numericMcqCount ? ('e.g., ' + 'ABCD'.repeat(Math.ceil(numericMcqCount/4)).slice(0, numericMcqCount)) : 'Enter number of MCQs first')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={questionType === 'multiple-choice' ? true : !!numericMcqCount}
                  error={(questionType === 'multiple-choice')
                    ? (expectedCount && markingKey && markingKey.length !== expectedCount ? `Must be ${expectedCount} answers` : '')
                    : (numericMcqCount && markingKey && markingKey.length !== numericMcqCount ? `Must be ${numericMcqCount} answers` : '')}
                />
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: -12 }}>
                  Use letters A-D only, one per question (e.g., ABCD...)
                </Text>
              </View>
            )}
          </View>
        </AnimatedScreen>
        
        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button
              title="Continue"
              onPress={handleContinue}
              variant="primary"
              disabled={!questionType}
            />
          </View>
        </AnimatedScreen>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  options: {
    marginTop: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryLight + '10',
  },
  optionIcon: {
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: colors.secondary,
  },
  optionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: 20,
  },
});
