import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import Input from '../components/Input';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export default function ScanConfirmationScreen({ navigation, route }) {
  const { imageUri, images: imagesParam, testData } = route.params || {};
  const images = React.useMemo(() => {
    if (imagesParam && Array.isArray(imagesParam) && imagesParam.length > 0) return imagesParam;
    return imageUri ? [imageUri] : [];
  }, [imagesParam, imageUri]);
  const [studentName, setStudentName] = React.useState(route?.params?.studentName || '');
  const questionType = testData?.questionType || 'essay';

  const getGradingScreen = () => {
    switch (questionType) {
      case 'multiple-choice':
        return 'MCQAnswerInput';
      case 'mixed':
        return 'MixedScoring';
      case 'essay':
      default:
        return 'EssayScoring';
    }
  };

  const handleConfirm = () => {
    const screen = getGradingScreen();
    navigation.navigate(screen, {
      images,
      testData,
      studentName: studentName || 'Student',
    });
  };
  
  const handleRetake = () => {
    navigation.goBack();
  };
  
  return (
    <View style={styles.container}>
      <Header
        title="Confirm Scan"
        onBack={handleRetake}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        <AnimatedScreen>
          <View style={styles.content}>
            <Text style={styles.title}>Scan Preview</Text>
            <Text style={styles.subtitle}>
              Review the scanned paper before proceeding
            </Text>
            {!!images?.length && (
              <Text style={styles.pagesCaptured}>Pages captured: {images.length}</Text>
            )}
            <Input
              label="Student Name"
              value={studentName}
              onChangeText={setStudentName}
              placeholder="Enter student name"
              iconName="person-outline"
              returnKeyType="done"
              style={{ marginBottom: 16 }}
            />
            
            {/* Scanned Image */}
            <Card style={styles.imageCard}>
              <Image
                source={{ uri: images[0] }}
                style={styles.scannedImage}
                resizeMode="contain"
              />
            </Card>
            
            {/* Scan Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <Text style={styles.summaryTitle}>Scan Successful</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pages Captured:</Text>
                <Text style={styles.summaryValue}>{images.length || 1}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Student Name:</Text>
                <Text style={styles.summaryValue}>{studentName || 'Student'}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Question Type:</Text>
                <Text style={styles.summaryValue}>
                  {questionType === 'multiple-choice' ? 'Multiple Choice'
                    : questionType === 'mixed' ? 'Mixed'
                    : 'Essay / Handwriting'}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Questions:</Text>
                <Text style={styles.summaryValue}>
                  {testData?.numberOfQuestions || '—'}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Points:</Text>
                <Text style={styles.summaryValue}>
                  {testData?.totalPoints || '—'}
                </Text>
              </View>
            </Card>
            
            {/* Info card */}
            <View style={styles.warningCard}>
              <Ionicons name="information-circle" size={20} color={colors.info} />
              <Text style={styles.warningText}>
                {questionType === 'multiple-choice'
                  ? 'Next: Enter the student\'s answers to grade against the marking key.'
                  : questionType === 'mixed'
                  ? 'Next: Enter MCQ answers and score essay questions.'
                  : 'Next: Score each written answer manually.'}
              </Text>
            </View>
          </View>
        </AnimatedScreen>
        
        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button
              title="Retake Photo"
              onPress={handleRetake}
              variant="outline"
              style={styles.retakeButton}
            />
            <Button
              title={questionType === 'multiple-choice' ? 'Enter Answers' : questionType === 'mixed' ? 'Start Grading' : 'Score Answers'}
              onPress={handleConfirm}
              variant="primary"
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
    marginBottom: 24,
  },
  pagesCaptured: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  imageCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  scannedImage: {
    width: '100%',
    height: 400,
    backgroundColor: colors.surface,
  },
  summaryCard: {
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    ...typography.h4,
    color: colors.text,
    marginLeft: 8,
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
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningText: {
    ...typography.bodySmall,
    color: colors.text,
    marginLeft: 12,
    flex: 1,
  },
  actions: {
    marginTop: 20,
  },
  retakeButton: {
    marginBottom: 12,
  },
});
