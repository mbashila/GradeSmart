import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export default function ReviewCorrectionScreen({ navigation, route }) {
  const { studentName, results, testData } = route.params || {};
  const [editedResults, setEditedResults] = useState(results || []);
  const [editedScore, setEditedScore] = useState(
    results?.reduce((sum, r) => sum + (r.status === 'correct' ? r.points : 0), 0) || 0
  );
  
  const handleAnswerChange = (index, newAnswer) => {
    const updated = [...editedResults];
    updated[index].student = newAnswer;
    updated[index].status = updated[index].correct === newAnswer ? 'correct' : 'incorrect';
    setEditedResults(updated);
    
    // Recalculate score
    const newScore = updated.reduce((sum, r) => 
      sum + (r.status === 'correct' ? r.points : 0), 0
    );
    setEditedScore(newScore);
  };
  
  const handlePointsChange = (index, newPoints) => {
    const updated = [...editedResults];
    updated[index].points = parseInt(newPoints) || 0;
    setEditedResults(updated);
    
    const newScore = updated.reduce((sum, r) => 
      sum + (r.status === 'correct' ? r.points : 0), 0
    );
    setEditedScore(newScore);
  };
  
  const handleSave = () => {
    // Save corrections and navigate back
    navigation.goBack();
  };
  
  const totalPoints = testData?.totalPoints || 100;
  const percentage = Math.round((editedScore / totalPoints) * 100);
  
  return (
    <View style={styles.container}>
      <Header
        title="Review & Correct"
        onBack={() => navigation.goBack()}
        rightAction="Save"
        onRightPress={handleSave}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <AnimatedScreen>
          <View style={styles.content}>
            <Text style={styles.title}>Manual Grade Adjustment</Text>
            <Text style={styles.subtitle}>
              Review and correct answers for {studentName}
            </Text>
            
            {/* Updated Score Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Updated Score:</Text>
                <Text style={styles.summaryValue}>{editedScore} / {totalPoints}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Percentage:</Text>
                <Text style={[styles.summaryValue, styles.percentageValue]}>
                  {percentage}%
                </Text>
              </View>
            </Card>
            
            {/* Editable Results */}
            <View style={styles.resultsSection}>
              <Text style={styles.sectionTitle}>Question Details</Text>
              
              {editedResults.map((result, index) => (
                <Card key={index} style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.questionNumber}>Question {result.question}</Text>
                    <View style={[
                      styles.statusBadge,
                      result.status === 'correct' ? styles.statusBadgeCorrect : styles.statusBadgeIncorrect
                    ]}>
                      <Ionicons 
                        name={result.status === 'correct' ? 'checkmark' : 'close'} 
                        size={16} 
                        color={result.status === 'correct' ? colors.success : colors.error} 
                      />
                      <Text style={[
                        styles.statusText,
                        result.status === 'correct' ? styles.statusTextCorrect : styles.statusTextIncorrect
                      ]}>
                        {result.status === 'correct' ? 'Correct' : 'Incorrect'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.answerSection}>
                    <View style={styles.answerGroup}>
                      <Text style={styles.answerLabel}>Correct Answer:</Text>
                      <View style={styles.answerDisplay}>
                        <Text style={styles.answerDisplayText}>{result.correct}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.answerGroup}>
                      <Text style={styles.answerLabel}>Student Answer:</Text>
                      <View style={styles.answerInputContainer}>
                        <TextInput
                          style={[
                            styles.answerInput,
                            result.status === 'correct' ? styles.answerInputCorrect : styles.answerInputIncorrect
                          ]}
                          value={result.student}
                          onChangeText={(text) => handleAnswerChange(index, text.toUpperCase())}
                          maxLength={1}
                          selectTextOnFocus
                        />
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.pointsSection}>
                    <Text style={styles.pointsLabel}>Points:</Text>
                    <TextInput
                      style={styles.pointsInput}
                      value={result.points.toString()}
                      onChangeText={(text) => handlePointsChange(index, text)}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                  </View>
                </Card>
              ))}
            </View>
            
            {/* Notes Section */}
            <Card style={styles.notesCard}>
              <Text style={styles.notesLabel}>Additional Notes:</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add any notes about this grading..."
                multiline
                numberOfLines={4}
                placeholderTextColor={colors.textLight}
              />
            </Card>
          </View>
        </AnimatedScreen>
      </ScrollView>
      
      <AnimatedScreen delay={120}>
        <View style={styles.actions}>
          <Button
            title="Save Changes"
            onPress={handleSave}
            variant="primary"
          />
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
    marginBottom: 24,
  },
  summaryCard: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  percentageValue: {
    color: colors.secondary,
    fontSize: 20,
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
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionNumber: {
    ...typography.h4,
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeCorrect: {
    backgroundColor: colors.success + '20',
  },
  statusBadgeIncorrect: {
    backgroundColor: colors.error + '20',
  },
  statusText: {
    ...typography.bodySmall,
    marginLeft: 6,
    fontWeight: '600',
  },
  statusTextCorrect: {
    color: colors.success,
  },
  statusTextIncorrect: {
    color: colors.error,
  },
  answerSection: {
    marginBottom: 16,
  },
  answerGroup: {
    marginBottom: 12,
  },
  answerLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  answerDisplay: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    padding: 12,
  },
  answerDisplayText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 18,
  },
  answerInputContainer: {
    alignItems: 'flex-start',
  },
  answerInput: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    width: 60,
    textAlign: 'center',
    borderColor: colors.border,
  },
  answerInputCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.success + '10',
    color: colors.success,
  },
  answerInputIncorrect: {
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
    color: colors.error,
  },
  pointsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pointsLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginRight: 12,
  },
  pointsInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: 'center',
    backgroundColor: colors.surfaceLight,
  },
  notesCard: {
    marginTop: 8,
  },
  notesLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  notesInput: {
    ...typography.body,
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
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
});
