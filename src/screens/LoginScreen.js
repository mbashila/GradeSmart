import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Input from '../components/Input';
import Logo from '../components/Logo';
import AnimatedScreen from '../components/AnimatedScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, isConfigured } = useAuth();
  const { showToast } = useToast();
  
  const handleLogin = () => {
    if (!isConfigured) {
      showToast('Supabase not configured. Add your credentials to app.json extra.', 'error');
      return;
    }
    (async () => {
      const { data, error } = await signIn({ email, password });
      if (error) {
        showToast(error.message || 'Sign-in failed', 'error');
        return;
      }
      showToast('Signed in', 'success');
      navigation.navigate('Dashboard');
    })();
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AnimatedScreen>
            {/* Logo and Branding */}
            <View style={styles.brandingContainer}>
              <Logo size="welcome" />
            </View>
            
            {/* Welcome Message */}
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>Welcome to GradeSmart</Text>
              <Text style={styles.welcomeSubtitle}>Sign in or create a new account.</Text>
            </View>
            
            {/* Login Form Card */}
            <View style={styles.formCard}>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                iconName="mail-outline"
                style={styles.input}
              />
              
              <View style={styles.passwordContainer}>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry
                  iconName="lock-closed-outline"
                  style={styles.input}
                />
                <TouchableOpacity 
                  style={styles.forgotPassword}
                  onPress={() => {}}
                >
                  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={styles.signInButton}
                onPress={handleLogin}
                activeOpacity={0.8}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
            
            {/* New User Section */}
            <View style={styles.newUserContainer}>
              <Text style={styles.newUserText}>New to GradeSmart?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
            
            {/* Guest Option */}
            <View style={styles.guestContainer}>
              <TouchableOpacity onPress={() => navigation.navigate('Dashboard')}>
                <Text style={styles.guestLink}>Continue as Guest</Text>
              </TouchableOpacity>
            </View>
          </AnimatedScreen>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  brandingContainer: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 24,
  },
  welcomeContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  welcomeTitle: {
    ...typography.h1,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    ...typography.body,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    marginBottom: 16,
  },
  passwordContainer: {
    marginBottom: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  forgotPasswordText: {
    ...typography.bodySmall,
    color: colors.secondaryLight, // Light blue
    fontSize: 14,
  },
  signInButton: {
    backgroundColor: colors.secondaryLight, // Light blue
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signInButtonText: {
    ...typography.button,
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  newUserContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  newUserText: {
    ...typography.body,
    color: colors.textSecondary,
    marginRight: 4,
  },
  signUpLink: {
    ...typography.body,
    color: colors.secondaryLight, // Light blue
    fontWeight: '600',
  },
  guestContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  guestLink: {
    ...typography.body,
    color: colors.secondaryLight, // Light blue
    fontWeight: '600',
  },
});
