import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { ToastProvider } from './src/components/Toast';
import { ScansProvider } from './src/context/ScansContext';
import { TestsProvider } from './src/context/TestsContext';
import { HapticsProvider } from './src/context/HapticsContext';
import { AuthProvider } from './src/context/AuthContext';
import { useAuth } from './src/context/AuthContext';
import { LikesProvider } from './src/context/LikesContext';
import { AIProvider } from './src/context/AIContext';
import { GradingServerProvider } from './src/context/GradingServerContext';
import { colors } from './src/theme/colors';

import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CreateTestScreen from './src/screens/CreateTestScreen';
import QuestionTypeScreen from './src/screens/QuestionTypeScreen';
import ReviewTestScreen from './src/screens/ReviewTestScreen';
import ScanScreen from './src/screens/ScanScreen';
import ScanConfirmationScreen from './src/screens/ScanConfirmationScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import ReviewCorrectionScreen from './src/screens/ReviewCorrectionScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import TestDetailsScreen from './src/screens/TestDetailsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import MCQAnswerInputScreen from './src/screens/MCQAnswerInputScreen';
import EssayScoringScreen from './src/screens/EssayScoringScreen';
import MixedScoringScreen from './src/screens/MixedScoringScreen';

const Stack = createStackNavigator();

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    return null;
  }
  return (
    <Stack.Navigator
      initialRouteName={user ? 'Dashboard' : 'Welcome'}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        ...TransitionPresets.ModalSlideFromBottomIOS,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="CreateTest" component={CreateTestScreen} />
      <Stack.Screen name="QuestionType" component={QuestionTypeScreen} />
      <Stack.Screen name="ReviewTest" component={ReviewTestScreen} />
      <Stack.Screen name="Scan" component={ScanScreen} />
      <Stack.Screen name="ScanConfirmation" component={ScanConfirmationScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="ReviewCorrection" component={ReviewCorrectionScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="TestDetails" component={TestDetailsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="MCQAnswerInput" component={MCQAnswerInputScreen} />
      <Stack.Screen name="EssayScoring" component={EssayScoringScreen} />
      <Stack.Screen name="MixedScoring" component={MixedScoringScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NotificationsProvider>
        <AuthProvider>
          <AIProvider>
          <GradingServerProvider>
          <LikesProvider>
            <HapticsProvider>
              <TestsProvider>
                <ScansProvider>
                  <ToastProvider>
                  <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
                    <NavigationContainer>
                      <StatusBar style="dark" translucent={false} backgroundColor={colors.background} />
                      <RootNavigator />
                    </NavigationContainer>
                  </SafeAreaView>
                </ToastProvider>
              </ScansProvider>
            </TestsProvider>
          </HapticsProvider>
          </LikesProvider>
          </GradingServerProvider>
          </AIProvider>
        </AuthProvider>
      </NotificationsProvider>
    </SafeAreaProvider>
  );
}
