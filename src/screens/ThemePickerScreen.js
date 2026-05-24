import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { useColors, useTheme } from '../context/ThemeContext';
import { colorThemes } from '../theme/colors';
import { typography } from '../theme/typography';

const themeKeys = Object.keys(colorThemes);

export default function ThemePickerScreen({ navigation }) {
  const colors = useColors();
  const { isDark, toggleTheme, colorTheme, setColorTheme } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Header title="Appearance" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AnimatedScreen>
          {/* Dark / Light Mode */}
          <Text style={styles.sectionTitle}>Mode</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeOption, !isDark && styles.modeActive]}
              onPress={() => { if (isDark) toggleTheme(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="sunny" size={24} color={!isDark ? colors.primary : colors.textLight} />
              <Text style={[styles.modeLabel, !isDark && styles.modeLabelActive]}>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeOption, isDark && styles.modeActive]}
              onPress={() => { if (!isDark) toggleTheme(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="moon" size={24} color={isDark ? colors.primary : colors.textLight} />
              <Text style={[styles.modeLabel, isDark && styles.modeLabelActive]}>Dark</Text>
            </TouchableOpacity>
          </View>

          {/* Color Theme */}
          <Text style={styles.sectionTitle}>Color Theme</Text>
          <Text style={styles.sectionSubtitle}>Choose your accent color</Text>
          <View style={styles.themeGrid}>
            {themeKeys.map((key) => {
              const theme = colorThemes[key];
              const isSelected = colorTheme === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.themeCard, isSelected && styles.themeCardActive]}
                  onPress={() => setColorTheme(key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.colorPreview, { backgroundColor: theme.preview }]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={[styles.themeLabel, isSelected && styles.themeLabelActive]}>{theme.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preview Section */}
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <View style={[styles.previewDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.previewText}>Primary</Text>
            </View>
            <View style={styles.previewRow}>
              <View style={[styles.previewDot, { backgroundColor: colors.secondary }]} />
              <Text style={styles.previewText}>Secondary</Text>
            </View>
            <View style={styles.previewRow}>
              <View style={[styles.previewDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.previewText}>Accent</Text>
            </View>
            <View style={styles.previewRow}>
              <View style={[styles.previewDot, { backgroundColor: colors.success }]} />
              <Text style={styles.previewText}>Success</Text>
            </View>
            <View style={styles.previewRow}>
              <View style={[styles.previewDot, { backgroundColor: colors.error }]} />
              <Text style={styles.previewText}>Error</Text>
            </View>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 4,
    marginTop: 20,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  // Mode selector
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  modeActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  modeLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modeLabelActive: {
    color: colors.primary,
  },
  // Theme grid
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  themeCard: {
    width: '29%',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  themeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  themeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  themeLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  // Preview
  previewCard: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  previewText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
