import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import AnimatedScreen from '../components/AnimatedScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export default function ScanConfirmationScreen({ navigation, route }) {
  const { imageUri, testData } = route.params || {};
  const [detectedScore] = React.useState('32');
  const [detectedPercentage] = React.useState('80%');
  
  const handleConfirm = () => {
    // Process the scan and navigate to results
    navigation.navigate('Results', {
      imageUri,
      testData,
      studentName: 'Mary Johnson', // This would come from OCR
      score: detectedScore,
      percentage: detectedPercentage,
    });
  };
  
  const handleRetake = () => {
    navigation.goBack();
  };
  
  return (
    <View style={styles.container}>
      <Header
        title="Confirm Scan"
        onBack={handleRetake}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <AnimatedScreen>
          <View style={styles.content}>
            <Text style={styles.title}>Scan Preview</Text>
            <Text style={styles.subtitle}>
              Review the scanned paper before proceeding
            </Text>
            
            {/* Scanned Image */}
            <Card style={styles.imageCard}>
              <Image
                source={{ uri: imageUri }}
                style={styles.scannedImage}
                resizeMode="contain"
              />
              
              {/* Detected Score Overlay */}
              <View style={styles.scoreOverlay}>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>{detectedScore}</Text>
                  <Text style={styles.percentageText}>{detectedPercentage}</Text>
                </View>
              </View>
            </Card>
            
            {/* Detection Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <Text style={styles.summaryTitle}>Scan Successful</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Student Name:</Text>
                <Text style={styles.summaryValue}>Mary Johnson</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Detected Score:</Text>
                <Text style={styles.summaryValue}>{detectedScore} / {testData?.totalPoints || 100}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Percentage:</Text>
                <Text style={[styles.summaryValue, styles.percentageValue]}>
                  {detectedPercentage}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Questions Detected:</Text>
                <Text style={styles.summaryValue}>
                  {testData?.numberOfQuestions || 12} / {testData?.numberOfQuestions || 12}
                </Text>
              </View>
            </Card>
            
            {/* Warning if needed */}
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={20} color={colors.warning} />
              <Text style={styles.warningText}>
                Please verify the detected answers are correct before confirming
              </Text>
            </View>
          </View>
        </AnimatedScreen>
        
        <AnimatedScreen delay={120}>
          <View style={styles.actions}>
            <Button
              title="Retake Photo"
              onPress={handleRetake}
              variant="outline"
              style={styles.retakeButton}
            />
            <Button
              title="Confirm & Grade"
              onPress={handleConfirm}
              variant="primary"
            />
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
    marginBottom: 24,
  },
  imageCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  scannedImage: {
    width: '100%',
    height: 400,
    backgroundColor: colors.surface,
  },
  scoreOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  scoreBadge: {
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scoreText: {
    ...typography.h2,
    color: colors.background,
    fontWeight: '700',
  },
  percentageText: {
    ...typography.body,
    color: colors.background,
    marginTop: 4,
  },
  summaryCard: {
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    ...typography.h4,
    color: colors.text,
    marginLeft: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  percentageValue: {
    color: colors.secondary,
    fontSize: 18,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningText: {
    ...typography.bodySmall,
    color: colors.text,
    marginLeft: 12,
    flex: 1,
  },
  actions: {
    marginTop: 20,
  },
  retakeButton: {
    marginBottom: 12,
  },
});
