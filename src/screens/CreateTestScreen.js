import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Header from '../components/Header';
import Input from '../components/Input';
import Button from '../components/Button';
import AnimatedScreen from '../components/AnimatedScreen';
import Stepper from '../components/Stepper';
import SubjectPicker from '../components/SubjectPicker';
import { useToast } from '../components/Toast';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useTests } from '../context/TestsContext';
import { useSubscription, PLANS } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';

export default function CreateTestScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { showToast } = useToast();
  const { addTest, tests } = useTests();
  const { isPro, currentPlan } = useSubscription();
  const { isGuest } = useAuth();
  const isEditing = !!(route?.params?.id || route?.params?.testId);
  const [testName, setTestName] = useState(route?.params?.testName || '');
  const [subject, setSubject] = useState(route?.params?.subject || '');
  const [classRoom, setClassRoom] = useState(route?.params?.classRoom || '');
  const [numberOfQuestions, setNumberOfQuestions] = useState(route?.params?.numberOfQuestions || '');
  const [totalPoints, setTotalPoints] = useState(route?.params?.totalPoints || '');
  const [numberOfStudents, setNumberOfStudents] = useState(route?.params?.numberOfStudents || '');
  
  
  const handleContinue = () => {
    if (!testName || !subject || !classRoom) {
      showToast('Please complete required fields', 'error');
      return;
    }
    const id = route?.params?.id || route?.params?.testId || Date.now().toString();
    // Enforce test limit for free/guest users (skip check if editing existing test)
    if (!isEditing) {
      const limit = isGuest ? 1 : (currentPlan?.testsLimit ?? PLANS.free.testsLimit);
      if (limit > 0 && tests.length >= limit && !isPro) {
        showToast(`Free plan allows only ${limit} test. Upgrade to create more!`, 'error');
        navigation.navigate('Payment');
        return;
      }
    }
    try {
      addTest({ id, name: testName, testName, subject, classRoom, numberOfQuestions, totalPoints, numberOfStudents });
    } catch {}
    showToast('Details saved', 'success');
    navigation.navigate('QuestionType', {
      id,
      testId: id,
      testName,
      subject,
      classRoom,
      numberOfQuestions,
      totalPoints,
      numberOfStudents,
    });
  };
  
  return (
    <View style={styles.container}>
      <Header
        title="Create New Test"
        onBack={() => navigation.goBack()}
        rightAction="Save"
        onRightPress={handleContinue}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <Stepper steps={['Details', 'Questions', 'Review']} current={0} />
        <AnimatedScreen>
          <View style={styles.content}>
            <Input
            label="Test Name"
            value={testName}
            onChangeText={setTestName}
            placeholder="e.g., Science Exam - Class 6C"
            />
            
            <SubjectPicker
              label="Subject"
              value={subject}
              onSelect={setSubject}
              placeholder="Select a subject"
            />
            
            <Input
              label="Class"
              value={classRoom}
              onChangeText={setClassRoom}
              placeholder="e.g., Grade 5A, Form 2B"
            />
            
            <Input
              label="Number of Questions (approx.)"
              value={numberOfQuestions}
              onChangeText={setNumberOfQuestions}
              placeholder="e.g., 20 or leave blank if unsure"
              keyboardType="numeric"
            />
            
            <Input
              label="Total Points"
              value={totalPoints}
              onChangeText={setTotalPoints}
              placeholder="100"
              keyboardType="numeric"
            />
            
            <Input
              label="Number of Students"
              value={numberOfStudents}
              onChangeText={setNumberOfStudents}
              placeholder="e.g., 30"
              keyboardType="numeric"
            />
          </View>
        </AnimatedScreen>
        
        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button
              title="Continue"
              onPress={handleContinue}
              variant="primary"
              disabled={!testName || !subject || !classRoom}
            />
          </View>
        </AnimatedScreen>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
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
    flexGrow: 1,
  },
  content: {
    flex: 1,
  },
  actions: {
    marginTop: 20,
  },
});
