import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Image, ActivityIndicator, Linking } from 'react-native';
import storage from './src/utils/storage';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { useColors, useTheme } from './src/context/ThemeContext';

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
import PaymentScreen from './src/screens/PaymentScreen';
import VerifyOTPScreen from './src/screens/VerifyOTPScreen';
import AppVersionScreen from './src/screens/AppVersionScreen';
import PrivacySettingsScreen from './src/screens/PrivacySettingsScreen';
import HelpCenterScreen from './src/screens/HelpCenterScreen';
import ContactSupportScreen from './src/screens/ContactSupportScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import ProfileDetailsScreen from './src/screens/ProfileDetailsScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import AdminUsersScreen from './src/screens/AdminUsersScreen';
import AdminUserDetailScreen from './src/screens/AdminUserDetailScreen';
import AdminQueriesScreen from './src/screens/AdminQueriesScreen';
import TermsOfServiceScreen from './src/screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import NotificationDetailScreen from './src/screens/NotificationDetailScreen';
import ThemePickerScreen from './src/screens/ThemePickerScreen';
import LanguagePickerScreen from './src/screens/LanguagePickerScreen';
import { AdminProvider } from './src/context/AdminContext';
import './src/i18n';
import { supabase } from './src/lib/supabase';

const Stack = createStackNavigator();

const HAS_SEEN_KEY = '@gradesmart:has_seen_app';

function RootNavigator() {
  const { user, loading, isGuest } = useAuth();
  const colors = useColors();
  const [hasSeen, setHasSeen] = useState(null); // null = loading

  useEffect(() => {
    (async () => {
      const val = await storage.getItem(HAS_SEEN_KEY);
      setHasSeen(val === 'true');
    })();
  }, []);

  // Mark app as seen once user navigates past auth screens
  useEffect(() => {
    if (user || isGuest) {
      storage.setItem(HAS_SEEN_KEY, 'true').catch(() => {});
      setHasSeen(true);
    }
  }, [user, isGuest]);

  if (loading || hasSeen === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={require('./assets/logo.png')} style={{ width: 120, height: 120 }} resizeMode="contain" />
        <ActivityIndicator size="small" color={colors.secondary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  // Determine initial route:
  // - Logged in / guest → Dashboard
  // - Has used app before (logged out) → Login
  // - Brand new user (first time ever) → SignUp
  const initialRoute = (user || isGuest) ? 'Dashboard' : hasSeen ? 'Login' : 'SignUp';

  const authKey = (user || isGuest) ? 'auth' : 'noauth';

  return (
    <Stack.Navigator
      key={authKey}
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        ...TransitionPresets.SlideFromRightIOS,
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
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
      <Stack.Screen name="AppVersion" component={AppVersionScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
      <Stack.Screen name="AdminQueries" component={AdminQueriesScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
      <Stack.Screen name="ThemePicker" component={ThemePickerScreen} />
      <Stack.Screen name="LanguagePicker" component={LanguagePickerScreen} />
    </Stack.Navigator>
  );
}

const linking = {
  prefixes: ['gradesmart://', 'https://gradesmart.app'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

function AppInner() {
  const colors = useColors();
  const { isDark } = useTheme();
  const navigationRef = useRef(null);

  // Listen for Supabase PASSWORD_RECOVERY event and navigate to reset screen
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          navigationRef.current?.navigate('ResetPassword');
        }, 300);
      }
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <StatusBar style={isDark ? 'light' : 'dark'} translucent={false} backgroundColor={colors.background} />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
      <NotificationsProvider>
        <AuthProvider>
          <AIProvider>
          <GradingServerProvider>
          <LikesProvider>
          <SubscriptionProvider>
          <AdminProvider>
            <HapticsProvider>
              <TestsProvider>
                <ScansProvider>
                  <ToastProvider>
                    <AppInner />
                </ToastProvider>
              </ScansProvider>
            </TestsProvider>
          </HapticsProvider>
          </AdminProvider>
          </SubscriptionProvider>
          </LikesProvider>
          </GradingServerProvider>
          </AIProvider>
        </AuthProvider>
      </NotificationsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

