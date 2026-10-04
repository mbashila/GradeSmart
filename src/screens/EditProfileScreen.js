import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Header from '../components/Header';
import Input from '../components/Input';
import FormScrollView from '../components/FormScrollView';
import Button from '../components/Button';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import FormMessage from '../components/FormMessage';
import { useToast } from '../components/Toast';
import { getAuthErrorMessage } from '../utils/authErrors';

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
  const [saveError, setSaveError] = useState('');
  const { showToast } = useToast();
  const savingRef = useRef(false);
  const [nameTouched, setNameTouched] = useState(false);
  const phoneRef = useRef(null);
  const locationRef = useRef(null);
  const schoolRef = useRef(null);
  const bioRef = useRef(null);


  const handleSave = async () => {
    if (savingRef.current) return;
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }
    savingRef.current = true;
    setSaveError('');
    setSaving(true);
    const { error } = await updateProfile({
      fullName: fullName.trim(),
      school: school.trim(),
      phone: phone.trim(),
      location: location.trim(),
      bio: bio.trim(),
    });
    savingRef.current = false;
    setSaving(false);
    if (error) {
      setSaveError(`Couldn't save your changes. ${getAuthErrorMessage(error, 'Please try again.')}`);
    } else {
      showToast('Profile updated successfully.', 'success');
      navigation.goBack();
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
      <FormScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <AnimatedScreen>
            <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <Input
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g., John Doe"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => phoneRef.current?.focus()}
                onBlur={() => setNameTouched(true)}
                error={nameTouched && !fullName.trim() ? 'Full name is required.' : ''}
                editable={!saving}
              />
              <Input
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                ref={phoneRef}
                placeholder="e.g., +27 81 234 5678"
                keyboardType="phone-pad"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => locationRef.current?.focus()}
                editable={!saving}
              />
              <Input
                label="Location"
                value={location}
                onChangeText={setLocation}
                ref={locationRef}
                placeholder="e.g., Johannesburg, South Africa"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => schoolRef.current?.focus()}
                editable={!saving}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Professional Details</Text>
              <Input
                label="School / Institution"
                value={school}
                onChangeText={setSchool}
                ref={schoolRef}
                placeholder="e.g., Springfield High School"
                autoCapitalize="words"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => bioRef.current?.focus()}
                editable={!saving}
              />
              <Input
                label="Bio"
                value={bio}
                onChangeText={setBio}
                ref={bioRef}
                placeholder="Tell us a bit about yourself..."
                editable={!saving}
                multiline
                numberOfLines={3}
              />
            </View>
            </>
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
              <FormMessage message={saveError} />
              <Button
                title={saving ? 'Saving...' : 'Save Changes'}
                onPress={handleSave}
                variant="primary"
                disabled={saving || !fullName.trim()}
              />
            </View>
          </AnimatedScreen>
      </FormScrollView>
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
