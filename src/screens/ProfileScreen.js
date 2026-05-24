import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, TextInput, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedScreen from '../components/AnimatedScreen';
import { Skeleton } from '../components/Skeleton';
import { useColors, useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function ProfileScreen({ navigation }) {
  const colors = useColors();
  const { isDark, toggleTheme, colorTheme } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { user, signOut, changePassword, deleteAccount, isGuest, isAdmin } = useAuth();
  const { isPro, planLabel } = useSubscription();
  const { i18n } = useTranslation();
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState(user?.user_metadata?.avatar_url || null);
  const [avatarKey, setAvatarKey] = React.useState(Date.now());

  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const displayName = React.useMemo(() => {
    const name = user?.user_metadata?.full_name || '';
    if (name && String(name).trim().length > 0) return name;
    const email = user?.email || '';
    if (email) return email.split('@')[0];
    return 'User';
  }, [user]);

  const schoolName = React.useMemo(() => {
    return user?.user_metadata?.school || '';
  }, [user]);

  React.useEffect(() => {
    const newUrl = user?.user_metadata?.avatar_url || null;
    if (newUrl !== avatarUrl) {
      setAvatarUrl(newUrl);
      setAvatarKey(Date.now());
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const profileLoading = !isGuest && !user;

  const renderSkeletonProfile = () => (
    <>
      <View style={styles.sectionCard}>
        <Skeleton width={'30%'} height={16} style={{ marginBottom: 16 }} />
        <View style={[styles.settingRow, styles.settingRowBorder]}>
          <Skeleton width={50} height={14} />
          <Skeleton width={'55%'} height={14} />
        </View>
        <View style={[styles.settingRow, styles.settingRowBorder]}>
          <Skeleton width={40} height={14} />
          <Skeleton width={'45%'} height={14} />
        </View>
        <View style={styles.settingRow}>
          <Skeleton width={50} height={14} />
          <Skeleton width={'40%'} height={14} />
        </View>
      </View>
    </>
  );

  const renderGuestProfile = () => (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={[styles.settingRow, styles.settingRowBorder]}>
          <View style={styles.settingLeft}>
            <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.settingLabel}>Help Center</Text>
          </View>
          <Text style={styles.settingValue}>Browse FAQs</Text>
        </View>
        <View style={[styles.settingRow, styles.settingRowBorder]}>
          <View style={styles.settingLeft}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.settingLabel}>Contact Support</Text>
          </View>
          <Text style={styles.settingValue}>support@gradesmart.app</Text>
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.settingLabel}>App Version</Text>
          </View>
          <Text style={styles.settingValue}>v1.0.0</Text>
        </View>
      </View>
    </>
  );

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data (tests, scans, grades). This action cannot be undone.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Type "DELETE" in your mind and tap confirm. All data will be erased permanently.',
              [
                { text: 'Go Back', style: 'cancel' },
                {
                  text: 'Confirm Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setSaving(true);
                    const { error } = await deleteAccount();
                    setSaving(false);
                    if (error) {
                      Alert.alert('Error', error.message || 'Could not delete account.');
                    } else {
                      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };


  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setSaving(true);
    const { error } = await changePassword(newPassword);
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message || 'Could not change password.');
    } else {
      Alert.alert('Success', 'Password updated successfully.');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleUploadAvatar = async () => {
    try {
      if (!isSupabaseConfigured || !user?.id) {
        Alert.alert('Not available', 'Sign in to upload a profile picture.');
        return;
      }
      setUploading(true);
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to upload an avatar.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const ext = (asset.fileName?.split('.').pop() || asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const mimeType = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const path = `${user.id}/${Date.now()}.${ext}`;

      // Read the file as arraybuffer for reliable RN upload
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: upErr } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: mimeType,
      });
      if (upErr) {
        console.log('Avatar upload error:', upErr);
        Alert.alert('Upload failed', upErr.message || 'Could not upload avatar.');
        return;
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      console.log('Avatar public URL:', publicUrl);
      if (publicUrl) {
        const { error: updErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
        if (updErr) {
          console.log('Avatar metadata update error:', updErr);
          Alert.alert('Update failed', updErr.message || 'Could not update profile.');
          return;
        }
        setAvatarUrl(publicUrl);
        setAvatarKey(Date.now());
        // Log activity (non-blocking)
        supabase.from('activities').insert({ user_id: user.id, type: 'avatar_uploaded', meta: { path } }).then(() => {});
        Alert.alert('Success', 'Profile picture updated!');
      }
    } catch (e) {
      console.log('Avatar upload exception:', e);
      Alert.alert('Error', e.message || 'Could not upload profile picture. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const renderSettingRow = (icon, label, rightText, onPress, isLast) => (
    <TouchableOpacity
      key={label}
      style={[styles.settingRow, !isLast && styles.settingRowBorder]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={20} color={colors.textSecondary} />
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      {rightText ? (
        <Text style={styles.settingValue}>{rightText}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="New password"
              placeholderTextColor={colors.textLight}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textLight}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowPasswordModal(false); setNewPassword(''); setConfirmPassword(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <AnimatedScreen>
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* Profile Header — centered avatar, name, email, edit button */}
          <View style={styles.headerSection}>
            {isGuest ? (
              <>
                <View style={styles.avatarWrapper}>
                  <Ionicons name="person-circle" size={100} color={colors.textLight} />
                </View>
                <Text style={styles.name}>Guest User</Text>
                <Text style={styles.email}>Limited access • 3 scans</Text>
              </>
            ) : (
              <>
                <View style={styles.avatarWrapper}>
                  <TouchableOpacity onPress={() => navigation.navigate('ProfileDetails')} activeOpacity={0.7}>
                    {avatarUrl ? (
                      <Image
                        key={avatarKey}
                        source={{ uri: `${avatarUrl}?t=${avatarKey}` }}
                        style={styles.avatar}
                        onError={(e) => {
                          console.log('Avatar image load error:', e.nativeEvent?.error);
                          setAvatarUrl(null);
                        }}
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitial}>
                          {(displayName || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cameraBadge} onPress={handleUploadAvatar} activeOpacity={0.7}>
                    <Ionicons name="camera" size={12} color="#fff" />
                  </TouchableOpacity>
                  {uploading && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.name}>{displayName}</Text>
                <Text style={styles.email}>{user?.email || ''}</Text>
                <TouchableOpacity
                  style={styles.editProfileBtn}
                  onPress={() => navigation.navigate('EditProfile')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editProfileText}>Edit profile</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Guest upgrade prompt */}
          {isGuest && (
            <View style={styles.sectionCard}>
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Ionicons name="lock-open-outline" size={32} color={colors.secondary} />
                <Text style={[styles.sectionTitle, { textAlign: 'center', marginTop: 10 }]}>
                  Create an Account
                </Text>
                <Text style={[styles.sectionSubtitle, { textAlign: 'center', marginBottom: 16 }]}>
                  Sign up to unlock unlimited scans, AI grading, cloud sync, and more.
                </Text>
                <TouchableOpacity
                  style={styles.signUpPromptBtn}
                  onPress={() => { signOut(); navigation.reset({ index: 0, routes: [{ name: 'SignUp' }] }); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text style={styles.signUpPromptText}>Sign Up Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ marginTop: 12 }}
                  onPress={() => { signOut(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }}
                >
                  <Text style={[styles.sectionSubtitle, { color: colors.secondary, fontWeight: '600' }]}>
                    Already have an account? Sign In
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Subscription */}
          {!isGuest && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Subscription</Text>
              {renderSettingRow(
                isPro ? 'diamond' : 'diamond-outline',
                `${planLabel} Plan`,
                isPro ? 'Manage' : 'Upgrade',
                () => isAdmin ? navigation.navigate('Payment') : Alert.alert('Coming Soon', 'This feature is coming soon. Stay tuned!'),
                true
              )}
            </View>
          )}

          {profileLoading ? renderSkeletonProfile() : isGuest ? renderGuestProfile() : (
            <>
              {/* Account Section */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Account</Text>
                {renderSettingRow('person-outline', 'Name', displayName, () => navigation.navigate('EditProfile'), false)}
                {renderSettingRow('school-outline', 'School', schoolName || 'Not set', () => navigation.navigate('EditProfile'), false)}
                {renderSettingRow('lock-closed-outline', 'Change Password', null, () => setShowPasswordModal(true), true)}
              </View>

              {/* Settings Section */}
              {isAdmin && (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Administration</Text>
                  {renderSettingRow('shield-checkmark-outline', 'Admin Panel', null, () => navigation.navigate('AdminDashboard'), true)}
                </View>
              )}

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Settings</Text>
                {renderSettingRow('language-outline', 'Language', (LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]).label, () => navigation.navigate('LanguagePicker'), false)}
                {renderSettingRow('color-palette-outline', 'Theme', `${colorTheme.charAt(0).toUpperCase() + colorTheme.slice(1)} • ${isDark ? 'Dark' : 'Light'}`, () => navigation.navigate('ThemePicker'), false)}
                {renderSettingRow('notifications-outline', 'Notifications', 'Enabled', () => navigation.navigate('Notifications'), false)}
                {renderSettingRow('headset-outline', 'Contact support', null, () => navigation.navigate('ContactSupport'), true)}
              </View>

              {/* Info Section */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>About</Text>
                {renderSettingRow('information-circle-outline', 'App Version', 'v1.0.0', () => navigation.navigate('AppVersion'), false)}
                {renderSettingRow('shield-checkmark-outline', 'Privacy Settings', null, () => navigation.navigate('PrivacySettings'), false)}
                {renderSettingRow('help-circle-outline', 'Help Center', null, () => navigation.navigate('HelpCenter'), true)}
              </View>
            </>
          )}
        </AnimatedScreen>

        <AnimatedScreen delay={120}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.signOutText}>{isGuest ? 'Exit Guest Mode' : 'Sign Out'}</Text>
          </TouchableOpacity>
          {!isGuest && (
            <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </TouchableOpacity>
          )}
        </AnimatedScreen>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  // ── Profile header ──
  headerSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.secondaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.secondaryLight + '40',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.secondary,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 10,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editProfileBtn: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
  },
  // ── Section cards ──
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // ── Setting rows ──
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    color: colors.text,
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.secondary,
  },
  modalSaveText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  // ── Sign out / delete ──
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  signOutText: {
    fontSize: 15,
    color: colors.error,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  deleteAccountText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
    marginLeft: 8,
  },
  // ── Guest prompt ──
  signUpPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  signUpPromptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // ── Legacy (skeleton) ──
  card: {
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
});
