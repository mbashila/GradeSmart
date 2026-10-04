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
import ErrorBoundary, { withScreenErrorBoundary } from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import './src/i18n';
import { supabase } from './src/lib/supabase';

const Stack = createStackNavigator();

// Each screen gets its own error boundary so a render crash shows a
// recoverable fallback and leaves the rest of the app navigable.
const guardedScreens = Object.fromEntries(Object.entries({
  Welcome: WelcomeScreen,
  Login: LoginScreen,
  SignUp: SignUpScreen,
  Dashboard: DashboardScreen,
  CreateTest: CreateTestScreen,
  QuestionType: QuestionTypeScreen,
  ReviewTest: ReviewTestScreen,
  Scan: ScanScreen,
  ScanConfirmation: ScanConfirmationScreen,
  Results: ResultsScreen,
  ReviewCorrection: ReviewCorrectionScreen,
  History: HistoryScreen,
  TestDetails: TestDetailsScreen,
  Profile: ProfileScreen,
  Notifications: NotificationsScreen,
  MCQAnswerInput: MCQAnswerInputScreen,
  EssayScoring: EssayScoringScreen,
  MixedScoring: MixedScoringScreen,
  Payment: PaymentScreen,
  VerifyOTP: VerifyOTPScreen,
  AppVersion: AppVersionScreen,
  PrivacySettings: PrivacySettingsScreen,
  HelpCenter: HelpCenterScreen,
  ContactSupport: ContactSupportScreen,
  EditProfile: EditProfileScreen,
  ProfileDetails: ProfileDetailsScreen,
  AdminDashboard: AdminDashboardScreen,
  AdminUsers: AdminUsersScreen,
  AdminUserDetail: AdminUserDetailScreen,
  AdminQueries: AdminQueriesScreen,
  TermsOfService: TermsOfServiceScreen,
  PrivacyPolicy: PrivacyPolicyScreen,
  ResetPassword: ResetPasswordScreen,
  NotificationDetail: NotificationDetailScreen,
  ThemePicker: ThemePickerScreen,
  LanguagePicker: LanguagePickerScreen,
}).map(([name, Screen]) => [name, withScreenErrorBoundary(Screen, name)]));

const AUTH_ROUTES = new Set(['Welcome', 'Login', 'SignUp', 'VerifyOTP', 'ResetPassword']);

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
      <Stack.Screen name="Welcome" component={guardedScreens.Welcome} />
      <Stack.Screen name="Login" component={guardedScreens.Login} />
      <Stack.Screen name="SignUp" component={guardedScreens.SignUp} />
      <Stack.Screen name="Dashboard" component={guardedScreens.Dashboard} />
      <Stack.Screen name="CreateTest" component={guardedScreens.CreateTest} />
      <Stack.Screen name="QuestionType" component={guardedScreens.QuestionType} />
      <Stack.Screen name="ReviewTest" component={guardedScreens.ReviewTest} />
      <Stack.Screen name="Scan" component={guardedScreens.Scan} />
      <Stack.Screen name="ScanConfirmation" component={guardedScreens.ScanConfirmation} />
      <Stack.Screen name="Results" component={guardedScreens.Results} />
      <Stack.Screen name="ReviewCorrection" component={guardedScreens.ReviewCorrection} />
      <Stack.Screen name="History" component={guardedScreens.History} />
      <Stack.Screen name="TestDetails" component={guardedScreens.TestDetails} />
      <Stack.Screen name="Profile" component={guardedScreens.Profile} />
      <Stack.Screen name="Notifications" component={guardedScreens.Notifications} />
      <Stack.Screen name="MCQAnswerInput" component={guardedScreens.MCQAnswerInput} />
      <Stack.Screen name="EssayScoring" component={guardedScreens.EssayScoring} />
      <Stack.Screen name="MixedScoring" component={guardedScreens.MixedScoring} />
      <Stack.Screen name="Payment" component={guardedScreens.Payment} />
      <Stack.Screen name="VerifyOTP" component={guardedScreens.VerifyOTP} />
      <Stack.Screen name="AppVersion" component={guardedScreens.AppVersion} />
      <Stack.Screen name="PrivacySettings" component={guardedScreens.PrivacySettings} />
      <Stack.Screen name="HelpCenter" component={guardedScreens.HelpCenter} />
      <Stack.Screen name="ContactSupport" component={guardedScreens.ContactSupport} />
      <Stack.Screen name="EditProfile" component={guardedScreens.EditProfile} />
      <Stack.Screen name="ProfileDetails" component={guardedScreens.ProfileDetails} />
      <Stack.Screen name="AdminDashboard" component={guardedScreens.AdminDashboard} />
      <Stack.Screen name="AdminUsers" component={guardedScreens.AdminUsers} />
      <Stack.Screen name="AdminUserDetail" component={guardedScreens.AdminUserDetail} />
      <Stack.Screen name="AdminQueries" component={guardedScreens.AdminQueries} />
      <Stack.Screen name="TermsOfService" component={guardedScreens.TermsOfService} />
      <Stack.Screen name="PrivacyPolicy" component={guardedScreens.PrivacyPolicy} />
      <Stack.Screen name="ResetPassword" component={guardedScreens.ResetPassword} />
      <Stack.Screen name="NotificationDetail" component={guardedScreens.NotificationDetail} />
      <Stack.Screen name="ThemePicker" component={guardedScreens.ThemePicker} />
      <Stack.Screen name="LanguagePicker" component={guardedScreens.LanguagePicker} />
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
  const { user, sessionExpired } = useAuth();
  const navigationRef = useRef(null);
  const lastAuthedRouteRef = useRef(null);
  const resumeRouteRef = useRef(null);

  // Remember where a signed-in user was, so an expired session can return
  // them there after logging in again.
  const handleStateChange = useCallback(() => {
    const route = navigationRef.current?.getCurrentRoute?.();
    if (user && route && !AUTH_ROUTES.has(route.name)) {
      lastAuthedRouteRef.current = { name: route.name, params: route.params };
    }
  }, [user]);

  useEffect(() => {
    if (sessionExpired && lastAuthedRouteRef.current) {
      resumeRouteRef.current = lastAuthedRouteRef.current;
    }
  }, [sessionExpired]);

  useEffect(() => {
    if (!user) return;
    const target = resumeRouteRef.current;
    resumeRouteRef.current = null;
    const nav = navigationRef.current;
    if (!target || target.name === 'Dashboard' || !nav?.isReady?.()) return;
    if (!nav.getRootState?.()?.routeNames?.includes(target.name)) return;
    nav.reset({ index: 1, routes: [{ name: 'Dashboard' }, target] });
  }, [user?.id]);

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
      <OfflineBanner />
      <NavigationContainer ref={navigationRef} linking={linking} onStateChange={handleStateChange}>
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
                    <ErrorBoundary name="App">
                      <AppInner />
                    </ErrorBoundary>
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

