import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import Stepper from '../components/Stepper';
import { useToast } from '../components/Toast';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import Input from '../components/Input';
import { extractQuestionsFromPaperImage, getOpenAIKey } from '../utils/openaiService';

const SECTION_TYPES = [
  { key: 'mcq', label: 'MCQs', icon: 'radio-button-on' },
  { key: 'fill_in_blank', label: 'Fill in Blanks', icon: 'remove-outline' },
  { key: 'short_notes', label: 'Short Notes', icon: 'create-outline' },
  { key: 'comprehension', label: 'Comprehension', icon: 'book-outline' },
  { key: 'essay', label: 'Essay', icon: 'document-text-outline' },
  { key: 'diagram', label: 'Diagrams', icon: 'image-outline' },
  { key: 'calculation', label: 'Calculations', icon: 'calculator-outline' },
];

export default function QuestionTypeScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { showToast } = useToast();
  const [questionType, setQuestionType] = useState(route?.params?.questionType || '');
  const [markingKey, setMarkingKey] = useState(route?.params?.markingKey || '');
  const [mcqCount, setMcqCount] = useState(route?.params?.mcqCount || '');
  const [mcqOptions, setMcqOptions] = useState(route?.params?.mcqOptions || 4); // number of options per question (4=A-D, 5=A-E, etc.)
  const [questionTexts, setQuestionTexts] = useState(
    route?.params?.questionTexts?.length > 0 ? route.params.questionTexts : ['']
  );
  
  const testData = route.params || {};
  const expectedCount = Number.isFinite(parseInt(testData.numberOfQuestions)) ? parseInt(testData.numberOfQuestions) : null;

  // Question paper upload state
  const [paperImages, setPaperImages] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [sectionMapping, setSectionMapping] = useState([]); // [{label:'A', type:'mcq'}, {label:'B', type:'essay'}]
  const [extracting, setExtracting] = useState(false);
  const [extractionMsg, setExtractionMsg] = useState('');
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [extractedSections, setExtractedSections] = useState([]);
  const [extractionDone, setExtractionDone] = useState(false);

  // Section mapping helpers
  const addSectionMapping = () => {
    const nextLabel = String.fromCharCode(65 + sectionMapping.length); // A, B, C...
    setSectionMapping(prev => [...prev, { label: nextLabel, type: '' }]);
  };
  const updateSectionType = (index, type) => {
    setSectionMapping(prev => {
      const updated = prev.map((s, i) => i === index ? { ...s, type } : s);
      // Sync selectedSections from the updated mapping
      const types = updated.map(s => s.type).filter(Boolean);
      setSelectedSections([...new Set(types)]);
      return updated;
    });
  };
  const removeSectionMapping = (index) => {
    setSectionMapping(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuestionTextChange = (index, text) => {
    setQuestionTexts((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const numericMcqCount = (() => {
    const n = parseInt(mcqCount, 10);
    if (Number.isFinite(n)) return n; 
    return null;
  })();

  const mcqMaxLetter = String.fromCharCode(64 + mcqOptions); // e.g., 4 -> 'D', 5 -> 'E'
  const mcqLetterRange = Array.from({ length: mcqOptions }, (_, i) => String.fromCharCode(65 + i)).join(''); // 'ABCD' or 'ABCDE' etc.

  const handleKeyChange = (txt) => {
    const allowedRegex = new RegExp(`[^A-${mcqMaxLetter}]`, 'g');
    let v = (txt || '').toUpperCase().replace(allowedRegex, '');
    const limit = questionType === 'mixed' ? (numericMcqCount || 0) : (expectedCount || 0);
    if (limit && v.length > limit) v = v.slice(0, limit);
    setMarkingKey(v);
  };

  const handleMcqCountChange = (txt) => {
    let cleaned = (txt || '').replace(/[^0-9]/g, '');
    if (cleaned.length > 0) {
      let n = parseInt(cleaned, 10);
      if (expectedCount && n > expectedCount) n = expectedCount;
      if (n < 0) n = 0;
      cleaned = String(n);
    }
    setMcqCount(cleaned);
    setMarkingKey((prev) => {
      const limit = parseInt(cleaned || '0', 10) || 0;
      return limit && prev ? prev.slice(0, limit) : '';
    });
  };

  // ── Question paper photo capture ──
  const handleTakePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPaperImages((prev) => [...prev, result.assets[0].uri]);
      }
    } catch {
      showToast('Failed to take photo', 'error');
    }
  }, []);

  const handlePickFromGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setPaperImages((prev) => [...prev, ...result.assets.map(a => a.uri)]);
      }
    } catch {
      showToast('Failed to pick images', 'error');
    }
  }, []);

  const removePaperImage = (index) => {
    setPaperImages((prev) => prev.filter((_, i) => i !== index));
    setExtractionDone(false);
    setExtractedQuestions([]);
    setExtractedSections([]);
  };

  // ── AI extraction ──
  const handleExtractQuestions = useCallback(async () => {
    if (paperImages.length === 0) {
      showToast('Please upload at least one question paper image', 'error');
      return;
    }
    const key = await getOpenAIKey();
    if (!key) {
      showToast('API key not set. Go to Settings to add it.', 'error');
      return;
    }

    setExtracting(true);
    setExtractionMsg(`Reading question paper (${paperImages.length} page${paperImages.length > 1 ? 's' : ''})...`);
    try {
      const result = await extractQuestionsFromPaperImage(paperImages, {
        subject: testData?.subject || '',
        sectionTypes: selectedSections,
        sectionMapping: sectionMapping.length > 0 ? sectionMapping : undefined,
      });

      if (result.error) {
        setExtractionMsg(`Failed: ${result.error}`);
        showToast('Could not extract questions', 'error');
      } else {
        setExtractedQuestions(result.questions);
        setExtractedSections(result.sections);
        // Auto-populate questionTexts from extracted questions (non-MCQ)
        const nonMcq = result.questions.filter(q => q.type !== 'mcq');
        setQuestionTexts(nonMcq.map(q => q.text));
        // Auto-detect MCQ count from extraction
        const mcqs = result.questions.filter(q => q.type === 'mcq');
        if (mcqs.length > 0 && (questionType === 'mixed' || questionType === 'multiple-choice')) {
          setMcqCount(String(mcqs.length));
        }
        setExtractionMsg(`Found ${result.questions.length} questions in ${result.sections.length} sections.`);
        showToast(`Extracted ${result.questions.length} questions`, 'success');
      }
    } catch (e) {
      setExtractionMsg('Extraction failed. Try again.');
      showToast('Something went wrong', 'error');
    }
    setExtracting(false);
    setExtractionDone(true);
  }, [paperImages, selectedSections, sectionMapping, questionType, testData]);

  const handleContinue = () => {
    if (!questionType) {
      showToast('Please select a question type', 'error');
      return;
    }

    // Force questions to be provided (either extracted or manual)
    const hasExtractedQuestions = extractionDone && extractedQuestions.length > 0;
    const hasManualQuestions = questionTexts.some(t => t && t.trim());
    const hasMcqKey = markingKey && markingKey.length > 0;

    if (questionType === 'multiple-choice') {
      if (!hasMcqKey) {
        showToast('Please enter the MCQ marking key', 'error');
        return;
      }
      if (expectedCount && markingKey.length !== expectedCount) {
        showToast(`Marking key must have ${expectedCount} answers`, 'error');
        return;
      }
    } else if (questionType === 'essay') {
      if (!hasExtractedQuestions && !hasManualQuestions) {
        showToast('Please upload & extract questions or type them manually', 'error');
        return;
      }
    } else if (questionType === 'mixed') {
      const hasMcqSection = sectionMapping.length === 0 || sectionMapping.some(s => s.type === 'mcq');
      if (hasMcqSection) {
        const n = numericMcqCount || 0;
        if (!n || n <= 0) {
          showToast('Enter how many MCQs are in this mixed test', 'error');
          return;
        }
        if (expectedCount && n > expectedCount) {
          showToast(`MCQ count cannot exceed total questions (${expectedCount})`, 'error');
          return;
        }
        if (!markingKey || markingKey.length !== n) {
          showToast(`Enter a ${n}-answer MCQ key (A-${mcqMaxLetter})`, 'error');
          return;
        }
      }
      if (!hasExtractedQuestions && !hasManualQuestions) {
        showToast('Please upload & extract questions or type essay questions manually', 'error');
        return;
      }
    }

    // Validate sections are mapped if user defined them
    if (sectionMapping.length > 0) {
      const unmapped = sectionMapping.filter(s => !s.type);
      if (unmapped.length > 0) {
        showToast(`Please assign a type for all sections (Section ${unmapped[0].label} is missing)`, 'error');
        return;
      }
    }

    showToast('Question type saved', 'success');
    navigation.navigate('ReviewTest', {
      ...testData,
      questionType,
      mcqCount: questionType === 'mixed' ? (numericMcqCount || null) : undefined,
      mcqOptions: questionType === 'multiple-choice' || questionType === 'mixed' ? mcqOptions : undefined,
      markingKey: questionType === 'multiple-choice' || questionType === 'mixed' ? markingKey : undefined,
      questionTexts: (questionType === 'essay' || questionType === 'mixed') ? questionTexts : undefined,
      paperImages: paperImages.length > 0 ? paperImages : undefined,
      extractedQuestions: extractedQuestions.length > 0 ? extractedQuestions : undefined,
      extractedSections: extractedSections.length > 0 ? extractedSections : undefined,
      sectionMapping: sectionMapping.length > 0 ? sectionMapping : undefined,
      selectedSectionTypes: selectedSections.length > 0 ? selectedSections : undefined,
    });
  };

  const showPaperUpload = questionType === 'essay' || questionType === 'mixed';
  
  return (
    <View style={styles.container}>
      <Header
        title="Question Type"
        onBack={() => navigation.goBack()}
      />
      
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Stepper steps={['Details', 'Questions', 'Review']} current={1} />
        <AnimatedScreen>
          <View style={styles.content}>
            <Text style={styles.title}>Choose Question Type</Text>
            <Text style={styles.subtitle}>
              Select the type of questions in your test
            </Text>
            
            <View style={styles.options}>
              <TouchableOpacity
                style={[
                  styles.option,
                  questionType === 'multiple-choice' && styles.optionSelected,
                ]}
                onPress={() => setQuestionType('multiple-choice')}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="radio-button-on" 
                    size={32} 
                    color={questionType === 'multiple-choice' ? colors.secondary : colors.textLight} 
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionTitle,
                    questionType === 'multiple-choice' && styles.optionTitleSelected,
                  ]}>
                    Multiple Choice
                  </Text>
                  <Text style={styles.optionDescription}>
                    OMR sheets with A, B, C, D options
                  </Text>
                </View>
                {questionType === 'multiple-choice' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.option,
                  questionType === 'essay' && styles.optionSelected,
                ]}
                onPress={() => setQuestionType('essay')}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="document-text" 
                    size={32} 
                    color={questionType === 'essay' ? colors.secondary : colors.textLight} 
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionTitle,
                    questionType === 'essay' && styles.optionTitleSelected,
                  ]}>
                    Essay-Based
                  </Text>
                  <Text style={styles.optionDescription}>
                    Written answers requiring manual review
                  </Text>
                </View>
                {questionType === 'essay' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.option,
                  questionType === 'mixed' && styles.optionSelected,
                ]}
                onPress={() => setQuestionType('mixed')}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Ionicons 
                    name="layers" 
                    size={32} 
                    color={questionType === 'mixed' ? colors.secondary : colors.textLight} 
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionTitle,
                    questionType === 'mixed' && styles.optionTitleSelected,
                  ]}>
                    Mixed
                  </Text>
                  <Text style={styles.optionDescription}>
                    Combination of multiple choice and essay questions
                  </Text>
                </View>
                {questionType === 'mixed' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
                )}
              </TouchableOpacity>
            </View>

            {/* ── Question Paper Upload ── */}
            {showPaperUpload && (
              <View style={{ marginTop: 20 }}>
                <Text style={[typography.h4, { color: colors.text, marginBottom: 4 }]}>
                  Question Paper
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Upload photos of the question paper so we can extract the questions.
                </Text>

                {/* Section mapping */}
                <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>
                  Define your paper sections
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 10 }]}>
                  Specify which section has which type of questions (e.g., Section A = MCQs, Section B = Essay)
                </Text>

                {sectionMapping.map((section, index) => (
                  <View key={index} style={styles.sectionMapRow}>
                    <View style={styles.sectionMapLabel}>
                      <Text style={styles.sectionMapLabelText}>Section {section.label}</Text>
                    </View>
                    <View style={styles.sectionMapPicker}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {SECTION_TYPES.map((st) => {
                          const active = section.type === st.key;
                          return (
                            <TouchableOpacity
                              key={st.key}
                              style={[styles.sectionTypeChip, active && styles.sectionTypeChipActive]}
                              onPress={() => updateSectionType(index, st.key)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name={st.icon} size={14} color={active ? '#fff' : colors.textSecondary} />
                              <Text style={[styles.sectionTypeChipText, active && styles.sectionTypeChipTextActive]}>
                                {st.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                    <TouchableOpacity onPress={() => removeSectionMapping(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addSectionBtn} onPress={addSectionMapping} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.secondary} />
                  <Text style={[typography.bodySmall, { color: colors.secondary, fontWeight: '600', marginLeft: 6 }]}>
                    Add Section
                  </Text>
                </TouchableOpacity>

                {/* Paper image thumbnails */}
                {paperImages.length > 0 && (
                  <View style={styles.thumbRow}>
                    {paperImages.map((uri, i) => (
                      <View key={i} style={styles.thumbWrap}>
                        <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                        <TouchableOpacity
                          style={styles.thumbRemove}
                          onPress={() => removePaperImage(i)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.error} />
                        </TouchableOpacity>
                        <Text style={styles.thumbLabel}>Page {i + 1}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Upload buttons */}
                <View style={styles.uploadRow}>
                  <TouchableOpacity style={styles.uploadBtn} onPress={handleTakePhoto} activeOpacity={0.7}>
                    <Ionicons name="camera-outline" size={22} color={colors.secondary} />
                    <Text style={styles.uploadBtnText}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.uploadBtn} onPress={handlePickFromGallery} activeOpacity={0.7}>
                    <Ionicons name="images-outline" size={22} color={colors.secondary} />
                    <Text style={styles.uploadBtnText}>Gallery</Text>
                  </TouchableOpacity>
                </View>

                {/* Extract button */}
                {paperImages.length > 0 && !extractionDone && (
                  <TouchableOpacity
                    style={[styles.extractBtn, extracting && { opacity: 0.6 }]}
                    onPress={handleExtractQuestions}
                    disabled={extracting}
                    activeOpacity={0.7}
                  >
                    {extracting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="sparkles" size={20} color="#fff" />
                    )}
                    <Text style={styles.extractBtnText}>
                      {extracting ? 'Reading Paper...' : 'Extract Questions'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Extraction status */}
                {extractionMsg ? (
                  <View style={[styles.extractStatus, {
                    backgroundColor: extractionDone && extractedQuestions.length > 0
                      ? colors.success + '15'
                      : extracting
                      ? colors.info + '15'
                      : colors.warning + '15',
                  }]}>
                    <Ionicons
                      name={extractionDone && extractedQuestions.length > 0 ? 'checkmark-circle' : extracting ? 'hourglass-outline' : 'alert-circle'}
                      size={18}
                      color={extractionDone && extractedQuestions.length > 0 ? colors.success : extracting ? colors.info : colors.warning}
                    />
                    <Text style={[styles.extractStatusText, {
                      color: extractionDone && extractedQuestions.length > 0 ? colors.success : extracting ? colors.info : colors.warning,
                    }]}>{extractionMsg}</Text>
                  </View>
                ) : null}

                {/* Extracted sections summary */}
                {extractedSections.length > 0 && (
                  <Card style={styles.extractedCard}>
                    <Text style={[typography.h4, { color: colors.text, marginBottom: 8 }]}>Detected Sections</Text>
                    {extractedSections.map((s, i) => (
                      <View key={i} style={styles.extractedRow}>
                        <Ionicons name="document-outline" size={16} color={colors.secondary} />
                        <Text style={styles.extractedRowText}>
                          {s.label} — {s.type} (Q{s.questionRange})
                        </Text>
                      </View>
                    ))}
                  </Card>
                )}

                {/* Extracted questions preview */}
                {extractedQuestions.length > 0 && (
                  <Card style={styles.extractedCard}>
                    <Text style={[typography.h4, { color: colors.text, marginBottom: 8 }]}>
                      Extracted Questions ({extractedQuestions.length})
                    </Text>
                    {extractedQuestions.slice(0, 15).map((q, i) => (
                      <View key={i} style={styles.extractedQRow}>
                        <View style={[styles.qTypeBadge, { backgroundColor: colors.secondary + '20' }]}>
                          <Text style={[styles.qTypeBadgeText, { color: colors.secondary }]}>
                            {q.type === 'mcq' ? 'MCQ' : q.type === 'fill_in_blank' ? 'Fill' : q.type === 'diagram' ? 'Diagram' : q.type === 'calculation' ? 'Calc' : q.type === 'comprehension' ? 'Comp' : q.type === 'essay' ? 'Essay' : 'Short'}
                          </Text>
                        </View>
                        {q.section && (
                          <View style={[styles.qSectionBadge, { backgroundColor: colors.primary + '15' }]}>
                            <Text style={[styles.qTypeBadgeText, { color: colors.primary }]}>
                              {q.section}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.extractedQText} numberOfLines={2}>
                          Q{q.number}. {q.text}
                        </Text>
                        {q.maxPoints > 0 && (
                          <Text style={styles.extractedQPts}>{q.maxPoints}pts</Text>
                        )}
                      </View>
                    ))}
                    {extractedQuestions.length > 15 && (
                      <Text style={[typography.caption, { color: colors.textLight, marginTop: 4 }]}>
                        + {extractedQuestions.length - 15} more questions
                      </Text>
                    )}
                  </Card>
                )}

                {/* Retry extraction */}
                {extractionDone && (
                  <TouchableOpacity
                    style={styles.retryLink}
                    onPress={() => { setExtractionDone(false); setExtractedQuestions([]); setExtractedSections([]); setExtractionMsg(''); }}
                  >
                    <Ionicons name="refresh" size={16} color={colors.secondary} />
                    <Text style={[typography.bodySmall, { color: colors.secondary, marginLeft: 4 }]}>Re-extract</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Manual question entry — for non-MCQ types, or when no extraction done */}
            {(questionType === 'essay' || questionType === 'mixed') && !extractionDone && paperImages.length === 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[typography.h4, { color: colors.text, marginBottom: 4 }]}>
                  {questionType === 'mixed' ? 'Type Questions (except MCQs)' : 'Type Your Questions'}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Or upload a photo of the question paper above instead.
                </Text>
                {questionTexts.map((txt, i) => {
                  const qNum = questionType === 'mixed' ? (parseInt(mcqCount, 10) || 0) + i + 1 : i + 1;
                  return (
                    <View key={`manual-q-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Input
                          label={`Question ${qNum}`}
                          value={txt || ''}
                          onChangeText={(v) => handleQuestionTextChange(i, v)}
                          placeholder="e.g., Explain the causes of..."
                          multiline
                        />
                      </View>
                      {questionTexts.length > 1 && (
                        <TouchableOpacity
                          style={{ marginLeft: 4, marginTop: 28, padding: 4 }}
                          onPress={() => {
                            setQuestionTexts(prev => prev.filter((_, idx) => idx !== i));
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                <TouchableOpacity
                  style={styles.addSectionBtn}
                  onPress={() => setQuestionTexts(prev => [...prev, ''])}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.secondary} />
                  <Text style={[typography.bodySmall, { color: colors.secondary, fontWeight: '600', marginLeft: 6 }]}>
                    Add Question
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {(questionType === 'multiple-choice' || (questionType === 'mixed' && (sectionMapping.length === 0 || sectionMapping.some(s => s.type === 'mcq')))) && (
              <View style={{ marginTop: 8 }}>
                {questionType === 'mixed' && (
                  <View style={{ marginBottom: 12 }}>
                    <Input
                      label={`Number of MCQs${expectedCount ? ` (max ${expectedCount})` : ''}`}
                      value={String(mcqCount)}
                      onChangeText={handleMcqCountChange}
                      placeholder={expectedCount ? `e.g., ${Math.min(10, expectedCount)}` : 'e.g., 10'}
                      keyboardType="number-pad"
                    />
                  </View>
                )}

                {/* MCQ Options selector */}
                <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '600', marginBottom: 8 }]}>
                  How many options per question?
                </Text>
                <View style={styles.mcqOptionsRow}>
                  {[3, 4, 5, 6, 7, 8].map((n) => {
                    const letter = String.fromCharCode(64 + n);
                    const active = mcqOptions === n;
                    return (
                      <TouchableOpacity
                        key={n}
                        style={[styles.mcqOptionChip, active && styles.mcqOptionChipActive]}
                        onPress={() => {
                          setMcqOptions(n);
                          // Re-filter marking key with new allowed range
                          const newRegex = new RegExp(`[^A-${letter}]`, 'g');
                          setMarkingKey((prev) => prev.replace(newRegex, ''));
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.mcqOptionChipText, active && styles.mcqOptionChipTextActive]}>
                          A-{letter}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Input
                  label={`MCQ Marking Key${questionType === 'multiple-choice' ? (expectedCount ? ` (${expectedCount} answers)` : '') : (numericMcqCount ? ` (${numericMcqCount} answers)` : '')}`}
                  value={markingKey}
                  onChangeText={handleKeyChange}
                  placeholder={(questionType === 'multiple-choice')
                    ? (expectedCount ? 'e.g., ' + mcqLetterRange.repeat(Math.ceil(expectedCount/mcqOptions)).slice(0, expectedCount) : 'e.g., ' + mcqLetterRange.repeat(2))
                    : (numericMcqCount ? ('e.g., ' + mcqLetterRange.repeat(Math.ceil(numericMcqCount/mcqOptions)).slice(0, numericMcqCount)) : 'Enter number of MCQs first')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={questionType === 'multiple-choice' ? true : !!numericMcqCount}
                  error={(questionType === 'multiple-choice')
                    ? (expectedCount && markingKey && markingKey.length !== expectedCount ? `Must be ${expectedCount} answers` : '')
                    : (numericMcqCount && markingKey && markingKey.length !== numericMcqCount ? `Must be ${numericMcqCount} answers` : '')}
                />
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: -12 }}>
                  Use letters A-{mcqMaxLetter} only, one per question
                </Text>
              </View>
            )}
          </View>
        </AnimatedScreen>
        
        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button
              title="Continue"
              onPress={handleContinue}
              variant="primary"
              disabled={!questionType}
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
    paddingTop: 24,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  options: {
    marginTop: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryLight + '10',
  },
  optionIcon: {
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: colors.secondary,
  },
  optionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: 20,
  },
  // ── Paper image thumbnails ──
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  thumbWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  thumb: {
    width: 80,
    height: 110,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  thumbLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 2,
    fontSize: 10,
  },
  // ── Upload buttons ──
  uploadRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.secondaryLight + '15',
    borderWidth: 1,
    borderColor: colors.secondary + '30',
  },
  uploadBtnText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
  },
  // ── Extract button ──
  extractBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginBottom: 12,
  },
  extractBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
  // ── Extraction status ──
  extractStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  extractStatusText: {
    ...typography.bodySmall,
    flex: 1,
    fontWeight: '600',
  },
  // ── Extracted results ──
  extractedCard: {
    marginBottom: 12,
    padding: 16,
  },
  extractedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  extractedRowText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  extractedQRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  qTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qTypeBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 9,
  },
  extractedQText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  extractedQPts: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: '600',
  },
  retryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  // ── Section mapping ──
  sectionMapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionMapLabel: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
  },
  sectionMapLabelText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionMapPicker: {
    flex: 1,
  },
  sectionTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  sectionTypeChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  sectionTypeChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 11,
  },
  sectionTypeChipTextActive: {
    color: '#fff',
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 16,
  },
  qSectionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // ── MCQ Options selector ──
  mcqOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  mcqOptionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  mcqOptionChipActive: {
    backgroundColor: colors.secondary + '15',
    borderColor: colors.secondary,
  },
  mcqOptionChipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  mcqOptionChipTextActive: {
    color: colors.secondary,
    fontWeight: '700',
  },
});
