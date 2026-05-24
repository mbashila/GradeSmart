import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Input from '../components/Input';
import Button from '../components/Button';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function ResetPasswordScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { changePassword } = useAuth();
  const { showToast } = useToast();

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      showToast('Please enter a new password.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    const { error } = await changePassword(newPassword);
    setLoading(false);

    if (error) {
      showToast(error.message || 'Failed to reset password.', 'error');
    } else {
      showToast('Password reset successfully!', 'success');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header title="Reset Password" onBack={() => navigation.navigate('Login')} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AnimatedScreen>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="lock-open-outline" size={48} color={colors.secondary} />
              </View>
            </View>

            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>
              Your identity has been verified. Please enter your new password below.
            </Text>

            <Input
              label="New Password"
              placeholder="Enter new password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoFocus
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <Button
              title={loading ? 'Resetting...' : 'Reset Password'}
              onPress={handleResetPassword}
              variant="primary"
              disabled={loading}
              style={styles.button}
            />
          </AnimatedScreen>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
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
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.secondary + '30',
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  button: {
    marginTop: 16,
  },
});
