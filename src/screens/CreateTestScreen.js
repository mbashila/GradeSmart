import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Header from '../components/Header';
import Input from '../components/Input';
import Button from '../components/Button';
import Dropdown from '../components/Dropdown';
import AnimatedScreen from '../components/AnimatedScreen';
import Stepper from '../components/Stepper';
import { useToast } from '../components/Toast';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export default function CreateTestScreen({ navigation, route }) {
  const { showToast } = useToast();
  const [testName, setTestName] = useState(route?.params?.testName || '');
  const [subject, setSubject] = useState(route?.params?.subject || '');
  const [classRoom, setClassRoom] = useState(route?.params?.classRoom || '');
  const [numberOfQuestions, setNumberOfQuestions] = useState(route?.params?.numberOfQuestions || '');
  const [totalPoints, setTotalPoints] = useState(route?.params?.totalPoints || '');
  
  const subjects = [
    { label: 'Math', value: 'Math' },
    { label: 'Science', value: 'Science' },
    { label: 'History', value: 'History' },
    { label: 'English', value: 'English' },
    { label: 'Geography', value: 'Geography' },
    { label: 'Physics', value: 'Physics' },
    { label: 'Chemistry', value: 'Chemistry' },
  ];
  
  const classes = [
    { label: '5A', value: '5A' },
    { label: '5B', value: '5B' },
    { label: '6A', value: '6A' },
    { label: '6B', value: '6B' },
    { label: '6C', value: '6C' },
    { label: '7A', value: '7A' },
    { label: '7B', value: '7B' },
    { label: '8A', value: '8A' },
    { label: '8B', value: '8B' },
  ];
  
  const handleContinue = () => {
    if (!testName || !subject || !classRoom) {
      showToast('Please complete required fields', 'error');
      return;
    }
    showToast('Details saved', 'success');
    navigation.navigate('QuestionType', {
      testName,
      subject,
      classRoom,
      numberOfQuestions,
      totalPoints,
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
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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
            
            <Dropdown
              label="Subject"
              value={subject}
              options={subjects}
              onValueChange={setSubject}
              placeholder="Select Subject"
            />
            
            <Dropdown
              label="Class"
              value={classRoom}
              options={classes}
              onValueChange={setClassRoom}
              placeholder="Select Class"
            />
            
            <Input
              label="Number of Questions"
              value={numberOfQuestions}
              onChangeText={setNumberOfQuestions}
              placeholder="12"
              keyboardType="numeric"
            />
            
            <Input
              label="Total Points"
              value={totalPoints}
              onChangeText={setTotalPoints}
              placeholder="100"
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
  actions: {
    marginTop: 20,
  },
});
