import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image, ScrollView, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import Stepper from '../components/Stepper';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

const { width, height } = Dimensions.get('window');

// Section type display labels & colors
const SECTION_COLORS = {
  mcq: '#f59e0b',
  fill_in_blank: '#8b5cf6',
  matching: '#06b6d4',
  short_notes: '#10b981',
  comprehension: '#3b82f6',
  essay: '#6366f1',
  diagram: '#ec4899',
  calculation: '#f97316',
};

const SECTION_LABELS = {
  mcq: 'MCQ',
  fill_in_blank: 'Fill in Blanks',
  matching: 'Matching',
  short_notes: 'Short Notes',
  comprehension: 'Comprehension',
  essay: 'Essay',
  diagram: 'Diagram',
  calculation: 'Calculation',
};

export default function ScanScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const testData = route?.params?.testData || {};
  const sections = testData?.sectionData || [];
  const hasSections = sections.length > 0;
  const isMixed = testData?.questionType === 'mixed';

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [flash, setFlash] = useState('on');

  // ── Section-by-section state ──
  const [currentSectionIdx, setCurrentSectionIdx] = useState(hasSections ? 0 : -1);
  // sectionImages: { [sectionIdx]: string[] }
  const [sectionImages, setSectionImages] = useState({});
  // Per-section page counts (set during setup)
  const [sectionPageCounts, setSectionPageCounts] = useState({});
  // Whether we're in the section setup phase (choosing pages per section)
  const [sectionSetupDone, setSectionSetupDone] = useState(!hasSections);
  // Current section page input
  const [sectionPageInput, setSectionPageInput] = useState('1');

  // ── Legacy flat state (no sections) ──
  const [expectedPages, setExpectedPages] = useState(
    route?.params?.expectedPages ? Number(route.params.expectedPages) : null
  );
  const [setupPages, setSetupPages] = useState('1');
  const [images, setImages] = useState([]);
  const [reviewing, setReviewing] = useState(false);

  // Helpers
  const currentSection = hasSections && currentSectionIdx >= 0 ? sections[currentSectionIdx] : null;
  const currentSectionPageCount = sectionPageCounts[currentSectionIdx] || 1;
  const currentSectionImages = sectionImages[currentSectionIdx] || [];
  const sectionColor = currentSection ? (SECTION_COLORS[currentSection.type] || colors.secondary) : colors.secondary;
  const sectionLabel = currentSection
    ? `Section ${currentSection.label}: ${SECTION_LABELS[currentSection.type] || currentSection.type}`
    : '';
  const sectionQCount = currentSection?.questions?.length || 0;

  // ── Finish: flatten section images and navigate ──
  const finishCapture = (flatImages, secImgs) => {
    navigation.navigate('ScanConfirmation', {
      images: flatImages,
      sectionImages: secImgs || null,
      testData,
    });
  };

  // ── Section-based capture handlers ──
  const handleSectionSetupContinue = () => {
    const count = parseInt(sectionPageInput, 10);
    if (isNaN(count) || count < 1) {
      Alert.alert('Invalid', 'Enter at least 1 page.');
      return;
    }
    setSectionPageCounts(prev => ({ ...prev, [currentSectionIdx]: count }));
    setSectionSetupDone(true);
  };

  const handleSectionCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      const nextImgs = [...currentSectionImages, photo.uri];
      setSectionImages(prev => ({ ...prev, [currentSectionIdx]: nextImgs }));

      // Auto-advance to next section when pages filled
      if (nextImgs.length >= currentSectionPageCount) {
        advanceToNextSection({ ...sectionImages, [currentSectionIdx]: nextImgs });
      }
    } catch {
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  const advanceToNextSection = (allSecImages) => {
    const nextIdx = currentSectionIdx + 1;
    if (nextIdx < sections.length) {
      setCurrentSectionIdx(nextIdx);
      setSectionSetupDone(false);
      setSectionPageInput('1');
    } else {
      // All sections done — flatten and navigate
      const flatImages = [];
      const secImgs = [];
      for (let i = 0; i < sections.length; i++) {
        const imgs = allSecImages[i] || [];
        secImgs.push({
          sectionIndex: i,
          label: sections[i].label,
          type: sections[i].type,
          images: imgs,
        });
        flatImages.push(...imgs);
      }
      finishCapture(flatImages, secImgs);
    }
  };

  const handleSectionGalleryPick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const picked = result.assets.map(a => a.uri);
        const nextImgs = [...currentSectionImages, ...picked];
        const updated = { ...sectionImages, [currentSectionIdx]: nextImgs };
        setSectionImages(updated);
        advanceToNextSection(updated);
      }
    } catch {
      Alert.alert('Error', 'Failed to open gallery.');
    }
  };

  const handleSectionRemoveImage = (idx) => {
    setSectionImages(prev => {
      const arr = [...(prev[currentSectionIdx] || [])];
      arr.splice(idx, 1);
      return { ...prev, [currentSectionIdx]: arr };
    });
  };

  // ── Legacy flat handlers ──
  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      const nextImages = [...images, photo.uri];
      setImages(nextImages);
      if (expectedPages && nextImages.length >= expectedPages) {
        finishCapture(nextImages);
      }
    } catch {
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  const startCapture = () => {
    const count = parseInt(setupPages, 10);
    if (isNaN(count) || count < 1) {
      Alert.alert('Invalid number', 'Please enter a valid number of pages (1 or more).');
      return;
    }
    setExpectedPages(count);
  };

  const handleGalleryPick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const picked = result.assets.map((a) => a.uri);
        finishCapture(picked);
      }
    } catch {
      Alert.alert('Error', 'Failed to open gallery. Please try again.');
    }
  };

  const handleRemoveImage = (idx) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setReviewing(true);
  };

  // ── Permission check ──
  if (!permission) {
    return (
      <View style={styles.container}>
        <Header title="Scan Paper" onBack={() => navigation.goBack()} />
        <View style={styles.centerContent}>
          <Text style={styles.message}>Requesting camera permission...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Header title="Scan Paper" onBack={() => navigation.goBack()} />
        <View style={styles.centerContent}>
          <Ionicons name="camera-outline" size={56} color={colors.textLight} />
          <Text style={styles.message}>Camera permission is required</Text>
          <Text style={styles.subMessage}>Enable camera access to scan answer sheets</Text>
          <Button title="Grant Permission" onPress={requestPermission} variant="primary" style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION-BASED FLOW
  // ═══════════════════════════════════════════════════════════════
  if (hasSections && currentSectionIdx >= 0) {
    // ── Section page count setup ──
    if (!sectionSetupDone) {
      const completedSections = currentSectionIdx;
      return (
        <View style={styles.container}>
          <Header title="Scan Paper" onBack={() => {
            if (currentSectionIdx > 0) {
              setCurrentSectionIdx(currentSectionIdx - 1);
              setSectionSetupDone(true);
            } else {
              navigation.goBack();
            }
          }} />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <AnimatedScreen style={styles.centerContent}>
              {/* Section progress */}
              <View style={styles.sectionProgressBar}>
                {sections.map((s, i) => (
                  <View key={i} style={[
                    styles.sectionDot,
                    { backgroundColor: i < completedSections ? '#22c55e' : i === currentSectionIdx ? sectionColor : colors.surfaceLight },
                  ]}>
                    {i < completedSections ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <Text style={{ fontSize: 10, fontWeight: '700', color: i === currentSectionIdx ? '#fff' : colors.textLight }}>{i + 1}</Text>
                    )}
                  </View>
                ))}
              </View>

              <View style={[styles.sectionBadgeLarge, { backgroundColor: sectionColor }]}>
                <Text style={styles.sectionBadgeLargeText}>{sectionLabel}</Text>
              </View>

              <Text style={styles.message}>
                How many pages for this section?
              </Text>
              <Text style={styles.subMessage}>
                {sectionQCount > 0
                  ? `This section has ${sectionQCount} question${sectionQCount > 1 ? 's' : ''}.`
                  : `Capture the answer pages for ${sectionLabel}.`}
              </Text>

              <Input
                label="Pages for this section"
                value={sectionPageInput}
                onChangeText={setSectionPageInput}
                keyboardType="number-pad"
                placeholder="e.g. 1 or 2"
                style={{ alignSelf: 'stretch', marginTop: 12 }}
              />
              <Button title="Start Capturing" onPress={handleSectionSetupContinue} variant="primary" />
              <Button title="Pick from Gallery" onPress={handleSectionGalleryPick} variant="outline" style={{ marginTop: 12 }} />
            </AnimatedScreen>
          </KeyboardAvoidingView>
        </View>
      );
    }

    // ── Section review ──
    if (reviewing && currentSectionImages.length > 0) {
      const remaining = currentSectionPageCount - currentSectionImages.length;
      return (
        <View style={styles.container}>
          <Header title={sectionLabel} onBack={() => setReviewing(false)} />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            <AnimatedScreen>
              <View style={[styles.sectionBadgeLarge, { backgroundColor: sectionColor, alignSelf: 'flex-start', marginBottom: 16 }]}>
                <Text style={styles.sectionBadgeLargeText}>{sectionLabel}</Text>
              </View>
              <View style={styles.reviewGrid}>
                {currentSectionImages.map((uri, idx) => (
                  <View key={idx} style={styles.reviewThumbWrap}>
                    <Image source={{ uri }} style={styles.reviewThumb} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleSectionRemoveImage(idx)} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                    <View style={[styles.pageBadge, { backgroundColor: sectionColor }]}>
                      <Text style={styles.pageBadgeText}>Page {idx + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
              {remaining > 0 && (
                <Button title={`Back to Camera (${remaining} left)`} onPress={() => setReviewing(false)} variant="primary" style={{ marginTop: 16 }} />
              )}
              {currentSectionImages.length >= currentSectionPageCount && (
                <Button title="Next Section" onPress={() => advanceToNextSection(sectionImages)} variant="primary" style={{ marginTop: 16 }} />
              )}
              {currentSectionImages.length > 0 && currentSectionImages.length < currentSectionPageCount && (
                <Button title={`Continue with ${currentSectionImages.length} page${currentSectionImages.length > 1 ? 's' : ''}`} onPress={() => advanceToNextSection(sectionImages)} variant="outline" style={{ marginTop: 12 }} />
              )}
            </AnimatedScreen>
          </ScrollView>
        </View>
      );
    }

    // ── Section camera ──
    const secRemaining = currentSectionPageCount - currentSectionImages.length;
    const secCurrentPage = currentSectionImages.length + 1;
    const isLastSection = currentSectionIdx === sections.length - 1;

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          flash={flash}
        />

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => {
            if (currentSectionImages.length > 0) {
              Alert.alert('Go back?', 'You have captured pages for this section. Going back will discard them.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Go Back', style: 'destructive', onPress: () => { setSectionSetupDone(false); setSectionImages(prev => ({ ...prev, [currentSectionIdx]: [] })); } },
              ]);
            } else {
              setSectionSetupDone(false);
            }
          }} style={styles.topBtn}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>

          <View style={styles.topCenter}>
            <View style={[styles.pageBadgeTop, { backgroundColor: sectionColor }]}>
              <Text style={styles.pageBadgeTopText}>{sectionLabel} — Page {secCurrentPage}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => setFlash(f => f === 'on' ? 'off' : 'on')} style={styles.topBtn}>
            <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={24} color={flash === 'on' ? '#fbbf24' : '#fff'} />
          </TouchableOpacity>
        </View>

        {/* Section progress + thumbnails */}
        <View style={styles.progressOverlay}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.progressText}>
              Section {currentSectionIdx + 1}/{sections.length}
            </Text>
            <Text style={[styles.progressText, { marginLeft: 12, opacity: 0.7 }]}>
              Page {currentSectionImages.length}/{currentSectionPageCount}
            </Text>
          </View>
          {currentSectionImages.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              {currentSectionImages.map((uri, idx) => (
                <View key={idx} style={styles.miniThumbWrap}>
                  <Image source={{ uri }} style={styles.miniThumb} resizeMode="cover" />
                  <View style={[styles.miniLabel, { backgroundColor: sectionColor }]}>
                    <Text style={styles.miniLabelText}>{idx + 1}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Guide frame */}
        <View style={styles.guideContainer}>
          <View style={styles.guideFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.sideBtn} onPress={handleSectionGalleryPick}>
            <Ionicons name="images" size={26} color="#fff" />
          </TouchableOpacity>

          {secRemaining > 0 ? (
            <TouchableOpacity style={styles.captureButton} onPress={handleSectionCapture} activeOpacity={0.7}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.captureButton, { borderColor: '#22c55e' }]} onPress={() => advanceToNextSection(sectionImages)} activeOpacity={0.7}>
              <Ionicons name={isLastSection ? 'checkmark' : 'arrow-forward'} size={36} color="#22c55e" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.sideBtn} onPress={() => currentSectionImages.length > 0 && setReviewing(true)} disabled={currentSectionImages.length === 0}>
            <Ionicons name="albums" size={26} color={currentSectionImages.length > 0 ? '#fff' : 'rgba(255,255,255,0.3)'} />
            {currentSectionImages.length > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{currentSectionImages.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // LEGACY FLAT FLOW (no sections)
  // ═══════════════════════════════════════════════════════════════
  if (expectedPages === null) {
    return (
      <View style={styles.container}>
        <Header title="Scan Paper" onBack={() => navigation.goBack()} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <AnimatedScreen style={styles.centerContent}>
            <Ionicons name="document-text-outline" size={56} color={colors.secondary} />
            <Text style={styles.message}>How many pages for this student?</Text>
            <Text style={styles.subMessage}>
              Set the number of pages in this student's answer sheet.
            </Text>
            <Input
              label="Number of pages"
              value={setupPages}
              onChangeText={setSetupPages}
              keyboardType="number-pad"
              placeholder="e.g. 1 or 2"
              style={{ alignSelf: 'stretch', marginTop: 12 }}
            />
            <Button title="Start Capturing" onPress={startCapture} variant="primary" />
            <Button title="Pick from Gallery" onPress={handleGalleryPick} variant="outline" style={{ marginTop: 12 }} />
          </AnimatedScreen>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Legacy review ──
  if (reviewing && images.length > 0) {
    const remaining = expectedPages - images.length;
    return (
      <View style={styles.container}>
        <Header title="Captured Pages" onBack={() => setReviewing(false)} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <AnimatedScreen>
            <Stepper
              steps={Array.from({ length: expectedPages }, () => 'Page')}
              current={Math.min(images.length, Math.max(expectedPages - 1, 0))}
              style={{ marginBottom: 16 }}
            />
            <View style={styles.reviewGrid}>
              {images.map((uri, idx) => (
                <View key={idx} style={styles.reviewThumbWrap}>
                  <Image source={{ uri }} style={styles.reviewThumb} resizeMode="cover" />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveImage(idx)} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                  <View style={styles.pageBadge}>
                    <Text style={styles.pageBadgeText}>Page {idx + 1}</Text>
                  </View>
                </View>
              ))}
            </View>
            {remaining > 0 && (
              <Button title={`Back to Camera (${remaining} left)`} onPress={() => setReviewing(false)} variant="primary" style={{ marginTop: 16 }} />
            )}
            {images.length >= expectedPages && (
              <Button title="Continue" onPress={() => finishCapture(images)} variant="primary" style={{ marginTop: 16 }} />
            )}
            {images.length > 0 && images.length < expectedPages && (
              <Button title={`Continue with ${images.length} page${images.length > 1 ? 's' : ''}`} onPress={() => finishCapture(images)} variant="outline" style={{ marginTop: 12 }} />
            )}
          </AnimatedScreen>
        </ScrollView>
      </View>
    );
  }

  // ── Legacy camera ──
  const currentPage = images.length + 1;
  const remaining = expectedPages - images.length;

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash}
      />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <View style={styles.pageBadgeTop}>
            <Text style={styles.pageBadgeTopText}>Page {currentPage}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setFlash(f => f === 'on' ? 'off' : 'on')} style={styles.topBtn}>
          <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={24} color={flash === 'on' ? '#fbbf24' : '#fff'} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressOverlay}>
        <Text style={styles.progressText}>
          {remaining > 0 ? `${images.length}/${expectedPages}` : 'Done!'}
        </Text>
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            {images.map((uri, idx) => (
              <View key={idx} style={styles.miniThumbWrap}>
                <Image source={{ uri }} style={styles.miniThumb} resizeMode="cover" />
                <View style={styles.miniLabel}>
                  <Text style={styles.miniLabelText}>{idx + 1}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.guideContainer}>
        <View style={styles.guideFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.sideBtn} onPress={handleGalleryPick}>
          <Ionicons name="images" size={26} color="#fff" />
        </TouchableOpacity>

        {remaining > 0 ? (
          <TouchableOpacity style={styles.captureButton} onPress={handleCapture} activeOpacity={0.7}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.captureButton, { borderColor: '#22c55e' }]} onPress={() => finishCapture(images)} activeOpacity={0.7}>
            <Ionicons name="checkmark" size={36} color="#22c55e" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.sideBtn} onPress={() => images.length > 0 && setReviewing(true)} disabled={images.length === 0}>
          <Ionicons name="albums" size={26} color={images.length > 0 ? '#fff' : 'rgba(255,255,255,0.3)'} />
          {images.length > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{images.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    ...typography.h3,
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  subMessage: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.info + '15',
    borderRadius: 10,
  },
  // ── Section ──
  sectionProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  sectionDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionBadgeLarge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionBadgeLargeText: {
    ...typography.bodySmall,
    color: '#fff',
    fontWeight: '700',
  },
  // ── Camera ──
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
  },
  pageBadgeTop: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mcqBadgeTop: {
    backgroundColor: '#f59e0b',
  },
  pageBadgeTopText: {
    ...typography.bodySmall,
    color: '#fff',
    fontWeight: '700',
  },
  progressOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    left: 16,
    right: 16,
    zIndex: 10,
    alignItems: 'center',
  },
  progressText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  miniThumbWrap: {
    marginRight: 8,
    position: 'relative',
  },
  miniThumb: {
    width: 40,
    height: 52,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  miniLabel: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniLabelText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  guideContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  guideFrame: {
    width: width * 0.88,
    height: height * 0.52,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#fff',
    borderWidth: 3,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sideBtn: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  badgeCount: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  // ── Review ──
  reviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  reviewThumbWrap: {
    width: (width - 48 - 28) / 3,
    position: 'relative',
  },
  reviewThumb: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  pageBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  mcqBadge: {
    backgroundColor: '#f59e0b',
  },
  pageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  mcqBadgeText: {
    color: '#fff',
  },
});
