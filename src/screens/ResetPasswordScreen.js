import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Input from '../components/Input';
import Button from '../components/Button';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import FormScrollView from '../components/FormScrollView';
import FormMessage from '../components/FormMessage';
import PasswordRequirements from '../components/PasswordRequirements';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { validatePassword, validatePasswordConfirmation } from '../utils/security';
import { getAuthErrorMessage } from '../utils/authErrors';

export default function ResetPasswordScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const { changePassword } = useAuth();
  const { showToast } = useToast();

  const passwordCheck = validatePassword(newPassword);
  const confirmCheck = validatePasswordConfirmation(newPassword, confirmPassword);
  const confirmTyped = confirmPassword.length > 0;
  const showPasswordError = (touched.password || submitted) && !passwordCheck.valid ? passwordCheck.message : '';
  const showConfirmError = (
    submitted || touched.confirm || (confirmTyped && confirmPassword.length >= newPassword.length)
  ) && !confirmCheck.valid ? confirmCheck.message : '';
  const confirmSuccess = confirmTyped && newPassword === confirmPassword ? 'Passwords match' : '';

  const markTouched = (field) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  const clearFormError = () => { if (formError) setFormError(''); };

  const handleResetPassword = async () => {
    if (submittingRef.current) return;
    setSubmitted(true);
    setFormError('');
    if (!passwordCheck.valid) {
      passwordRef.current?.focus();
      return;
    }
    if (!confirmCheck.valid) {
      confirmRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    Keyboard.dismiss();
    try {
      const { error } = await changePassword(newPassword);
      if (error) {
        setFormError(getAuthErrorMessage(error, 'Could not reset your password. Please try again.'));
        return;
      }
      showToast('Password reset successfully!', 'success');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      setFormError(getAuthErrorMessage(e, 'Could not reset your password. Please try again.'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header title="Reset Password" onBack={() => navigation.navigate('Login')} />
      <FormScrollView contentContainerStyle={styles.scrollContent}>
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

          <FormMessage message={formError} />

          <Input
            ref={passwordRef}
            label="New password"
            placeholder="Enter new password"
            value={newPassword}
            onChangeText={(text) => { setNewPassword(text); clearFormError(); }}
            onBlur={() => markTouched('password')}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
            iconName="lock-closed-outline"
            error={showPasswordError}
            editable={!loading}
            focusAccessory={<PasswordRequirements password={newPassword} />}
            autoFocus
          />

          <Input
            ref={confirmRef}
            label="Confirm new password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChangeText={(text) => { setConfirmPassword(text); clearFormError(); }}
            onBlur={() => markTouched('confirm')}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleResetPassword}
            iconName="lock-closed-outline"
            error={showConfirmError}
            success={confirmSuccess}
            editable={!loading}
          />

          <Button
            title={loading ? 'Resetting...' : 'Reset Password'}
            onPress={handleResetPassword}
            variant="primary"
            disabled={loading}
            style={styles.button}
          />
        </AnimatedScreen>
      </FormScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
