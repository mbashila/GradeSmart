import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, TextInput, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import AnimatedScreen from '../components/AnimatedScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function ProfileScreen({ navigation }) {
  const { unreadCount } = useNotifications();
  const { user, signOut, updateProfile, changePassword } = useAuth();
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState(user?.user_metadata?.avatar_url || null);

  // Editable fields
  const [editingName, setEditingName] = React.useState(false);
  const [editingSchool, setEditingSchool] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const [schoolDraft, setSchoolDraft] = React.useState('');
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
    setAvatarUrl(user?.user_metadata?.avatar_url || null);
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const handleSaveName = async () => {
    if (!nameDraft.trim()) { setEditingName(false); return; }
    setSaving(true);
    const { error } = await updateProfile({ fullName: nameDraft.trim() });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message || 'Could not update name.');
    } else {
      setEditingName(false);
    }
  };

  const handleSaveSchool = async () => {
    setSaving(true);
    const { error } = await updateProfile({ school: schoolDraft.trim() });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message || 'Could not update school.');
    } else {
      setEditingSchool(false);
    }
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
      const path = `${user.id}/${Date.now()}.${ext}`;
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: asset.mimeType || `image/${ext}`,
      });
      if (upErr) {
        Alert.alert('Upload failed', upErr.message || 'Could not upload avatar.');
        return;
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (publicUrl) {
        const { error: updErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
        if (updErr) {
          Alert.alert('Update failed', updErr.message || 'Could not update profile.');
          return;
        }
        setAvatarUrl(publicUrl);
        await supabase.from('activities').insert({ user_id: user.id, type: 'avatar_uploaded', meta: { path } });
        Alert.alert('Success', 'Profile picture updated');
      }
    } catch (e) {
      Alert.alert('Error', 'Please install expo-image-picker to use this feature.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Profile" 
        onBack={() => navigation.goBack()} 
        rightIcon="notifications-outline"
        onRightPress={() => navigation.navigate('Notifications')}
        rightBadge={unreadCount}
      />

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
          <TouchableOpacity style={styles.headerSection} onPress={handleUploadAvatar} activeOpacity={0.7}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl + '?t=' + Date.now() }}
                style={styles.avatar}
                onError={() => setAvatarUrl(null)}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person-circle" size={96} color={colors.secondary} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.role}>Teacher</Text>
            {uploading && <ActivityIndicator size="small" color={colors.secondary} style={{ marginTop: 4 }} />}
          </TouchableOpacity>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email || '-'}</Text>
            </View>

            {/* Editable Name */}
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              {editingName ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.editInput}
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    placeholder="Your name"
                    placeholderTextColor={colors.textLight}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveName}
                  />
                  <TouchableOpacity onPress={handleSaveName} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.secondary} />
                    ) : (
                      <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingName(false)} style={{ marginLeft: 6 }}>
                    <Ionicons name="close-circle" size={24} color={colors.textLight} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.editableValue}
                  onPress={() => { setNameDraft(user?.user_metadata?.full_name || ''); setEditingName(true); }}
                >
                  <Text style={styles.value}>{displayName}</Text>
                  <Ionicons name="pencil" size={14} color={colors.textLight} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              )}
            </View>

            {/* Editable School */}
            <View style={styles.row}>
              <Text style={styles.label}>School</Text>
              {editingSchool ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.editInput}
                    value={schoolDraft}
                    onChangeText={setSchoolDraft}
                    placeholder="Your school"
                    placeholderTextColor={colors.textLight}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveSchool}
                  />
                  <TouchableOpacity onPress={handleSaveSchool} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.secondary} />
                    ) : (
                      <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingSchool(false)} style={{ marginLeft: 6 }}>
                    <Ionicons name="close-circle" size={24} color={colors.textLight} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.editableValue}
                  onPress={() => { setSchoolDraft(schoolName); setEditingSchool(true); }}
                >
                  <Text style={styles.value}>{schoolName || 'Tap to set'}</Text>
                  <Ionicons name="pencil" size={14} color={colors.textLight} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              )}
            </View>

            {/* Change Password */}
            <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => setShowPasswordModal(true)}>
              <Text style={styles.label}>Change Password</Text>
              <View style={styles.editableValue}>
                <Text style={styles.value}>••••••••</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} style={{ marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.row}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user?.email || 'Not set'}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Account Type</Text>
                <Text style={styles.infoValue}>Educator</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Ionicons name="document-text" size={24} color={colors.primary} />
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Tests Created</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="people" size={24} color={colors.secondary} />
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Students Graded</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="scan" size={24} color={colors.accent} />
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Papers Scanned</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="time" size={24} color={colors.info} />
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Hours Saved</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Storage Usage</Text>
            <View style={styles.storageBar}>
              <View style={styles.storageFill} />
            </View>
            <View style={styles.storageInfo}>
              <Text style={styles.storageLabel}>Used: 0 MB</Text>
              <Text style={styles.storageLabel}>Free: 100 MB</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Storage Plan</Text>
              <Text style={styles.value}>Free Plan</Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Notifications</Text>
              <View style={styles.switchContainer}>
                <Text style={styles.value}>Enabled</Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Theme</Text>
              <View style={styles.switchContainer}>
                <Text style={styles.value}>Light</Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Language</Text>
              <View style={styles.switchContainer}>
                <Text style={styles.value}>English</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Notifications')}>
                <Ionicons name="notifications" size={20} color={colors.primary} />
                <Text style={styles.actionText}>View Notifications</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
                <Ionicons name="download" size={20} color={colors.secondary} />
                <Text style={styles.actionText}>Export Data</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
                <Ionicons name="shield-checkmark" size={20} color={colors.success} />
                <Text style={styles.actionText}>Privacy Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
                <Ionicons name="help-circle" size={20} color={colors.info} />
                <Text style={styles.actionText}>Help Center</Text>
              </TouchableOpacity>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Support</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Help Center</Text>
              <Text style={styles.value}>Browse FAQs</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Contact Support</Text>
              <Text style={styles.value}>support@gradesmart.app</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>App Version</Text>
              <Text style={styles.value}>v1.0.0</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Build</Text>
              <Text style={styles.value}>2025.03.02</Text>
            </View>
          </Card>
        </AnimatedScreen>

        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button title="Sign Out" variant="primary" onPress={handleSignOut} />
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
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  name: {
    ...typography.h2,
    color: colors.text,
    marginTop: 8,
  },
  role: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    marginTop: 16,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 12,
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
    ...typography.body,
    color: colors.textSecondary,
  },
  value: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  urlInput: {
    ...typography.body,
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.border,
  },
  avatarPlaceholder: {
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    top: 70,
    right: '35%',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  editableValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  editInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    minWidth: 120,
    textAlign: 'right',
  },
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
    ...typography.h3,
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    ...typography.body,
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
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.secondary,
  },
  modalSaveText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  actions: {
    marginTop: 24,
  },
  actionButton: {
    marginBottom: 12,
  },
  // Professional feature styles
  infoItem: {
    flex: 1,
    paddingVertical: 4,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    ...typography.body,
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
  statNumber: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 2,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  storageBar: {
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  storageFill: {
    width: '0%',
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  storageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  storageLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  switchContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  actionText: {
    ...typography.caption,
    color: colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
});
