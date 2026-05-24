import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import Button from '../components/Button';
import Input from '../components/Input';
import Stepper from '../components/Stepper';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { checkImageQuality } from '../utils/imageQuality';

const { width, height } = Dimensions.get('window');

export default function ScanScreen({ navigation, route }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const cameraRef = useRef(null);
  const testData = route?.params?.testData || {};
  const [expectedPages, setExpectedPages] = useState(
    route?.params?.expectedPages ? Number(route.params.expectedPages) : null
  );
  const [setupPages, setSetupPages] = useState('1');
  const [images, setImages] = useState([]);
  const [checking, setChecking] = useState(false);
  const [paperDetected, setPaperDetected] = useState(null); // null = not yet checked, true = detected, false = not detected

  const acceptImage = (uri) => {
    const nextImages = [...images, uri];
    setImages(nextImages);
    if (expectedPages && nextImages.length >= expectedPages) {
      navigation.navigate('ScanConfirmation', {
        images: nextImages,
        testData,
      });
    }
  };

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        setChecking(true);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        const quality = await checkImageQuality(photo.uri);
        setChecking(false);
        setPaperDetected(quality.ok && quality.contrast > 30);

        if (!quality.ok) {
          Alert.alert(
            'Poor Image Quality',
            quality.issues.join('\n'),
            [
              { text: 'Retake', style: 'cancel' },
              { text: 'Use Anyway', onPress: () => acceptImage(photo.uri) },
            ]
          );
          return;
        }
        acceptImage(photo.uri);
      } catch (error) {
        setChecking(false);
        Alert.alert('Error', 'Failed to capture image. Please try again.');
      }
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
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const picked = result.assets.map((a) => a.uri);
        // Check quality of the first image
        setChecking(true);
        const quality = await checkImageQuality(picked[0]);
        setChecking(false);

        if (!quality.ok) {
          Alert.alert(
            'Poor Image Quality',
            quality.issues.join('\n'),
            [
              { text: 'Pick Again', style: 'cancel' },
              {
                text: 'Use Anyway',
                onPress: () => navigation.navigate('ScanConfirmation', { images: picked, testData }),
              },
            ]
          );
          return;
        }
        navigation.navigate('ScanConfirmation', {
          images: picked,
          testData,
        });
      }
    } catch (error) {
      setChecking(false);
      Alert.alert('Error', 'Failed to open gallery. Please try again.');
    }
  };

  const toggleFlash = () => {
    setFlash(flash === 'off' ? 'on' : 'off');
  };
  
  if (!permission) {
    return (
      <View style={styles.container}>
        <Header title="Scan Paper" onBack={() => navigation.goBack()} />
        <AnimatedScreen style={styles.centerContent}>
          <Text style={styles.message}>Requesting camera permission...</Text>
        </AnimatedScreen>
      </View>
    );
  }
  
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Header title="Scan Paper" onBack={() => navigation.goBack()} />
        <AnimatedScreen style={styles.centerContent}>
          <Ionicons name="camera-outline" size={64} color={colors.textLight} />
          <Text style={styles.message}>Camera permission is required</Text>
          <Text style={styles.subMessage}>
            Please enable camera access in your device settings
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </AnimatedScreen>
      </View>
    );
  }
  
  if (expectedPages === null) {
    return (
      <View style={styles.container}>
        <Header title="Scan Paper" onBack={() => navigation.goBack()} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <AnimatedScreen style={styles.centerContent}>
            <Text style={styles.message}>How many pages are you capturing for this student?</Text>
            <Text style={styles.subMessage}>You can change this next time. Default is 1.</Text>
            <Input
              label="Number of pages"
              value={setupPages}
              onChangeText={setSetupPages}
              keyboardType="number-pad"
              placeholder="e.g. 1 or 2"
              style={{ alignSelf: 'stretch' }}
            />
            <Button title="Start Capturing" onPress={startCapture} variant="primary" />
            <Button title="Pick from Gallery" onPress={handleGalleryPick} variant="outline" style={{ marginTop: 12 }} />
          </AnimatedScreen>
        </KeyboardAvoidingView>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <AnimatedScreen>
        <Header 
          title="Scan Paper" 
          onBack={() => navigation.goBack()}
          rightIcon="image-outline"
          onRightPress={handleGalleryPick}
        />
      </AnimatedScreen>
      
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      >
        {/* Overlay Guide */}
        <AnimatedScreen style={styles.overlay} delay={60}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              Page {Math.min(images.length + 1, expectedPages)} of {expectedPages}
            </Text>
            <Stepper
              steps={Array.from({ length: expectedPages }, () => 'Page')}
              current={Math.min(images.length, Math.max(expectedPages - 1, 0))}
              style={styles.stepper}
            />
          </View>
          <View style={styles.guideContainer}>
            <View style={styles.guideFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            
            <Text style={styles.guideText}>
              Align the paper within the frame
            </Text>
          </View>
          
          {/* Live Feedback Area */}
          <View style={styles.feedbackContainer}>
            {checking ? (
              <View style={[styles.feedbackCard, styles.feedbackChecking]}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.feedbackText}>Checking image...</Text>
              </View>
            ) : paperDetected === null ? (
              <View style={[styles.feedbackCard, styles.feedbackChecking]}>
                <Ionicons name="scan-outline" size={20} color="#fff" />
                <Text style={styles.feedbackText}>Capture to detect paper</Text>
              </View>
            ) : paperDetected ? (
              <View style={[styles.feedbackCard, styles.feedbackDetected]}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.feedbackText}>Paper detected</Text>
              </View>
            ) : (
              <View style={[styles.feedbackCard, styles.feedbackNotDetected]}>
                <Ionicons name="close-circle" size={20} color="#fff" />
                <Text style={styles.feedbackText}>No paper detected</Text>
              </View>
            )}
          </View>
        </AnimatedScreen>
        
        {/* Camera Controls */}
        <AnimatedScreen style={styles.controls} delay={120}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleFlash}
          >
            <Ionicons
              name={flash === 'on' ? 'flash' : 'flash-off'}
              size={28}
              color={colors.background}
            />
          </TouchableOpacity>
          
          {checking ? (
            <View style={styles.captureButton}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              activeOpacity={0.8}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {
              setFacing(facing === 'back' ? 'front' : 'back');
            }}
          >
            <Ionicons name="camera-reverse" size={28} color={colors.background} />
          </TouchableOpacity>
        </AnimatedScreen>
      </CameraView>
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
  permissionButton: {
    marginTop: 20,
    backgroundColor: colors.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    ...typography.button,
    color: colors.background,
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
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  progressHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  progressText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepper: {
    marginTop: 8,
  },
  guideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  guideFrame: {
    width: width * 0.85,
    height: height * 0.5,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.accent,
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  guideText: {
    ...typography.body,
    color: colors.background,
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  feedbackContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  feedbackDetected: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  feedbackNotDetected: {
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
  },
  feedbackChecking: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  feedbackText: {
    ...typography.bodySmall,
    color: colors.background,
    marginLeft: 8,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controlButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.accent,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
  },
});
