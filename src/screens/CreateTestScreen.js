import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Header from '../components/Header';
import Input from '../components/Input';
import FormScrollView from '../components/FormScrollView';
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
  const classRef = useRef(null);
  const questionsRef = useRef(null);
  const pointsRef = useRef(null);
  const studentsRef = useRef(null);
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
      addTest({ id, name: testName, testName, subject, classRoom, numberOfQuestions, totalPoints, numberOfStudents }).then((res) => {
        if (res?.error) showToast("Saved on this device only. Couldn't sync to your account.", 'warning');
      });
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
      <FormScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Stepper steps={['Details', 'Questions', 'Review']} current={0} />
        <AnimatedScreen>
          <View style={styles.content}>
            <Input
            label="Test Name"
            value={testName}
            onChangeText={setTestName}
            placeholder="e.g., Science Exam - Class 6C"
            autoCapitalize="sentences"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => classRef.current?.focus()}
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
              ref={classRef}
              placeholder="e.g., Grade 5A, Form 2B"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => questionsRef.current?.focus()}
            />
            
            <Input
              label="Number of Questions (approx.)"
              value={numberOfQuestions}
              onChangeText={setNumberOfQuestions}
              ref={questionsRef}
              placeholder="e.g., 20 or leave blank if unsure"
              keyboardType="number-pad"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => pointsRef.current?.focus()}
            />
            
            <Input
              label="Total Points"
              value={totalPoints}
              onChangeText={setTotalPoints}
              ref={pointsRef}
              placeholder="100"
              keyboardType="numeric"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => studentsRef.current?.focus()}
            />
            
            <Input
              label="Number of Students"
              value={numberOfStudents}
              onChangeText={setNumberOfStudents}
              ref={studentsRef}
              placeholder="e.g., 30"
              keyboardType="number-pad"
              returnKeyType="done"
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
      </FormScrollView>
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
