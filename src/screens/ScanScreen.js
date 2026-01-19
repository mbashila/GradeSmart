import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AnimatedScreen from '../components/AnimatedScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const { width, height } = Dimensions.get('window');

export default function ScanScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const cameraRef = useRef(null);
  const testData = route?.params?.testData || {};
  
  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        
        // Navigate to confirmation screen with captured image
        navigation.navigate('ScanConfirmation', {
          imageUri: photo.uri,
          testData,
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to capture image. Please try again.');
      }
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
  
  return (
    <View style={styles.container}>
      <AnimatedScreen>
        <Header 
          title="Scan Paper" 
          onBack={() => navigation.goBack()}
          rightIcon="image-outline"
          onRightPress={() => {
            // Open gallery to select image
            Alert.alert('Gallery', 'Gallery feature coming soon');
          }}
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
            <View style={styles.feedbackCard}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.feedbackText}>Paper detected</Text>
            </View>
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
          
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            activeOpacity={0.8}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          
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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
