import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { LANGUAGES, changeLanguage } from '../i18n';

export default function LanguagePickerScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { i18n } = useTranslation();
  const [selected, setSelected] = useState(i18n.language);

  const handleSelect = async (code) => {
    setSelected(code);
    await changeLanguage(code);
  };

  return (
    <View style={styles.container}>
      <Header title="Language" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedScreen>
          <Text style={styles.subtitle}>Select your preferred language</Text>
          <View style={styles.card}>
            {LANGUAGES.map((lang, index) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langRow,
                  index < LANGUAGES.length - 1 && styles.langRowBorder,
                  selected === lang.code && styles.langRowActive,
                ]}
                onPress={() => handleSelect(lang.code)}
                activeOpacity={0.7}
              >
                <View style={styles.langInfo}>
                  <Text style={[styles.langLabel, selected === lang.code && styles.langLabelActive]}>
                    {lang.label}
                  </Text>
                  <Text style={styles.langNative}>{lang.nativeLabel}</Text>
                </View>
                {selected === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
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
    padding: 20,
    paddingBottom: 40,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  langRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  langRowActive: {
    backgroundColor: colors.secondary + '10',
  },
  langInfo: {
    flex: 1,
  },
  langLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  langLabelActive: {
    color: colors.secondary,
  },
  langNative: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
