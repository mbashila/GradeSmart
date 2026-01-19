import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import Stepper from '../components/Stepper';
import { useToast } from '../components/Toast';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export default function QuestionTypeScreen({ navigation, route }) {
  const { showToast } = useToast();
  const [questionType, setQuestionType] = useState(route?.params?.questionType || '');
  
  const testData = route.params || {};
  
  const handleContinue = () => {
    showToast('Question type saved', 'success');
    navigation.navigate('ReviewTest', {
      ...testData,
      questionType,
    });
  };
  
  return (
    <View style={styles.container}>
      <Header
        title="Question Type"
        onBack={() => navigation.goBack()}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
