import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import Header from '../components/Header';
import Input from '../components/Input';
import Button from '../components/Button';
import AnimatedScreen from '../components/AnimatedScreen';
import { Skeleton } from '../components/Skeleton';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';

export default function EditProfileScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { user, updateProfile } = useAuth();
  const meta = user?.user_metadata || {};

  const [fullName, setFullName] = useState(meta.full_name || '');
  const [school, setSchool] = useState(meta.school || '');
  const [phone, setPhone] = useState(meta.phone || '');
  const [location, setLocation] = useState(meta.location || '');
  const [bio, setBio] = useState(meta.bio || '');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }
    setSaving(true);
    const { error } = await updateProfile({
      fullName: fullName.trim(),
      school: school.trim(),
      phone: phone.trim(),
      location: location.trim(),
      bio: bio.trim(),
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message || 'Could not update profile.');
    } else {
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Edit Profile"
        onBack={() => navigation.goBack()}
        rightAction={saving ? undefined : 'Save'}
        onRightPress={handleSave}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AnimatedScreen>
            {loading ? (
              <>
                <View style={styles.section}>
                  <Skeleton width={180} height={18} style={{ marginBottom: 16 }} />
                  {[1,2,3].map(i => (
                    <View key={i} style={{ marginBottom: 20 }}>
                      <Skeleton width={90} height={12} style={{ marginBottom: 8 }} />
                      <Skeleton width={'100%'} height={56} radius={12} />
                    </View>
                  ))}
                </View>
                <View style={styles.section}>
                  <Skeleton width={160} height={18} style={{ marginBottom: 16 }} />
                  {[1,2].map(i => (
                    <View key={i} style={{ marginBottom: 20 }}>
                      <Skeleton width={120} height={12} style={{ marginBottom: 8 }} />
                      <Skeleton width={'100%'} height={i === 2 ? 100 : 56} radius={12} />
                    </View>
                  ))}
                </View>
              </>
            ) : (
            <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <Input
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g., John Doe"
                autoCapitalize="words"
              />
              <Input
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g., +27 81 234 5678"
                keyboardType="phone-pad"
              />
              <Input
                label="Location"
                value={location}
                onChangeText={setLocation}
                placeholder="e.g., Johannesburg, South Africa"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Professional Details</Text>
              <Input
                label="School / Institution"
                value={school}
                onChangeText={setSchool}
                placeholder="e.g., Springfield High School"
              />
              <Input
                label="Bio"
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us a bit about yourself..."
                multiline
                numberOfLines={3}
              />
            </View>
            </>
            )}
          </AnimatedScreen>

          <AnimatedScreen delay={100}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || 'Not set'}</Text>
              <Text style={styles.infoHint}>Email cannot be changed here. Contact support if you need to update it.</Text>
            </View>
          </AnimatedScreen>

          <AnimatedScreen delay={150}>
            <View style={styles.actions}>
              <Button
                title={saving ? 'Saving...' : 'Save Changes'}
                onPress={handleSave}
                variant="primary"
                disabled={saving || !fullName.trim()}
              />
            </View>
          </AnimatedScreen>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  infoHint: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 6,
  },
  actions: {
    marginTop: 4,
  },
});
