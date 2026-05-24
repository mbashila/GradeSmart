import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { useSubscription, PLANS } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_SPACING = 14;

const PLAN_CARDS = [
  {
    id: 'yearly',
    badge: 'Best Value',
    title: 'Pro Yearly',
    features: [
      'Unlimited scans & tests',
      'AI-powered grading',
      'Subject-aware scoring',
      'Export reports (PDF)',
      '5 GB cloud storage',
      'Priority support',
    ],
    price: `$${PLANS.yearly.price}`,
    period: `/year ($${(PLANS.yearly.price / 12).toFixed(2)}/mo)`,
  },
  {
    id: 'monthly',
    badge: 'Popular Plan',
    title: 'Pro Monthly',
    features: [
      'Unlimited scans & tests',
      'AI-powered grading',
      'Subject-aware scoring',
      'Export reports (PDF)',
      '5 GB cloud storage',
    ],
    price: `$${PLANS.monthly.price}`,
    period: '/month',
  },
  {
    id: 'free',
    badge: 'Current',
    title: 'Free Plan',
    features: [
      '20 scans per month',
      '1 test limit',
      'Basic OCR',
      'Manual grading only',
      '100 MB storage',
    ],
    price: '$0',
    period: '/forever',
  },
];

export default function PaymentScreen({ navigation }) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { subscription, subscribe, cancelSubscription, isPro, planLabel } = useSubscription();
  const { user } = useAuth();
  const userEmail = user?.email || '';
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [processing, setProcessing] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const cardScrollRef = useRef(null);

  const handleSubscribe = async () => {
    if (processing) return;
    const plan = PLANS[selectedPlan];

    if (selectedPlan === 'free') {
      // Simulate downgrade to free
      setProcessing(true);
      try {
        await subscribe('free');
        Alert.alert(
          'Free Plan Active',
          `You are now on the Free plan.${userEmail ? ` Details sent to ${userEmail}.` : ''}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } catch {
        Alert.alert('Error', 'Something went wrong.');
      } finally {
        setProcessing(false);
      }
      return;
    }

    const priceLabel = selectedPlan === 'monthly' ? `$${plan.price}/month` : `$${plan.price}/year`;
    Alert.alert(
      'Confirm Subscription',
      `Subscribe to ${plan.label} for ${priceLabel}?${userEmail ? `\n\nConfirmation will be sent to ${userEmail}` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subscribe',
          onPress: async () => {
            setProcessing(true);
            try {
              const { error } = await subscribe(selectedPlan);
              if (error) {
                Alert.alert('Error', error);
              } else {
                const periodEnd = new Date();
                if (selectedPlan === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1);
                else periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                Alert.alert(
                  'Welcome to Pro! 🎉',
                  `Your ${plan.label} subscription is now active until ${periodEnd.toLocaleDateString()}.${userEmail ? `\n\nA confirmation email has been sent to ${userEmail}.` : ''}`,
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              }
            } catch {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure? You will lose access to Pro features at the end of your billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            const { error } = await cancelSubscription();
            setProcessing(false);
            if (error) {
              Alert.alert('Error', error);
            } else {
              Alert.alert('Cancelled', 'Pro features remain active until the end of your current period.');
            }
          },
        },
      ]
    );
  };

  const onCardScroll = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
    const plan = PLAN_CARDS[Math.min(index, PLAN_CARDS.length - 1)];
    if (plan) setSelectedPlan(plan.id);
  };

  return (
    <LinearGradient
      colors={['#1A1A2E', '#16213E', '#0F3460']}
      style={styles.container}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Restore', 'Checking for existing subscriptions...', [{ text: 'OK' }])}
          style={styles.restoreBtn}
        >
          <Ionicons name="refresh-outline" size={16} color="rgba(255,255,255,0.7)" />
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title section */}
        <View style={styles.titleSection}>
          <Text style={styles.heroTitle}>Go Premium</Text>
          <Text style={styles.heroSubtitle}>No commitment. Cancel anytime.</Text>
        </View>

        {/* Horizontal plan cards */}
        <Animated.ScrollView
          ref={cardScrollRef}
          horizontal
          pagingEnabled={false}
          snapToInterval={CARD_WIDTH + CARD_SPACING}
          snapToAlignment="center"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsContainer}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          onMomentumScrollEnd={onCardScroll}
          scrollEventThrottle={16}
        >
          {PLAN_CARDS.map((card, index) => {
            const inputRange = [
              (index - 1) * (CARD_WIDTH + CARD_SPACING),
              index * (CARD_WIDTH + CARD_SPACING),
              (index + 1) * (CARD_WIDTH + CARD_SPACING),
            ];
            const cardScale = scrollX.interpolate({
              inputRange,
              outputRange: [0.92, 1, 0.92],
              extrapolate: 'clamp',
            });
            const cardOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.6, 1, 0.6],
              extrapolate: 'clamp',
            });

            const isSelected = selectedPlan === card.id;

            return (
              <Animated.View
                key={card.id}
                style={[
                  styles.planCard,
                  {
                    transform: [{ scale: cardScale }],
                    opacity: cardOpacity,
                  },
                  isSelected && styles.planCardSelected,
                ]}
              >
                <LinearGradient
                  colors={
                    card.id === 'free'
                      ? ['#374151', '#4B5563']
                      : card.id === 'yearly'
                      ? ['#1E40AF', '#3B82F6']
                      : ['#6D28D9', '#8B5CF6']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.planCardInner}
                >
                  {card.badge && (
                    <View style={styles.cardBadge}>
                      <Text style={styles.cardBadgeText}>{card.badge}</Text>
                    </View>
                  )}

                  <Text style={styles.cardTitle}>{card.title}</Text>

                  <View style={styles.cardFeatures}>
                    {card.features.map((feat) => (
                      <View key={feat} style={styles.cardFeatureRow}>
                        <View style={styles.featureDot} />
                        <Text style={styles.cardFeatureText}>{feat}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.cardPriceRow}>
                    <Text style={styles.cardPrice}>{card.price}</Text>
                    <Text style={styles.cardPeriod}>{card.period}</Text>
                  </View>
                </LinearGradient>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>

        {/* Dots indicator */}
        <View style={styles.dotsRow}>
          {PLAN_CARDS.map((card, index) => (
            <View
              key={card.id}
              style={[
                styles.dot,
                selectedPlan === card.id && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Active subscription info */}
        {isPro && (
          <View style={styles.activeBar}>
            <Ionicons name="checkmark-circle" size={20} color="#34D399" />
            <Text style={styles.activeBarText}>
              Your Pro subscription is active
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA section */}
      <View style={styles.bottomSection}>
        {isPro ? (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={processing}>
            {processing ? (
              <ActivityIndicator size="small" color="#F87171" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel Subscription</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleSubscribe}
            disabled={processing}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#F59E0B', '#FBBF24', '#FCD34D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaBtnGradient}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#1A1A2E" />
              ) : (
                <Text style={styles.ctaBtnText}>
                  {selectedPlan === 'free' ? 'Continue with Free' : 'Start Plan'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        <Text style={styles.disclaimer}>
          You can cancel your subscription or trial anytime by cancelling through your account settings. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period.
        </Text>
      </View>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  restoreText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  titleSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 28,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 6,
    fontWeight: '500',
  },
  cardsContainer: {
    paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2,
  },
  planCard: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
    borderRadius: 20,
    overflow: 'hidden',
  },
  planCardSelected: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  planCardInner: {
    padding: 26,
    minHeight: 340,
    justifyContent: 'space-between',
  },
  cardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 14,
  },
  cardBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 20,
  },
  cardFeatures: {
    flex: 1,
    marginBottom: 20,
  },
  cardFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
    marginRight: 12,
  },
  cardFeatureText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  cardPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  cardPeriod: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: '#FBBF24',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,211,153,0.15)',
    marginHorizontal: 24,
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  activeBarText: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 34,
    paddingTop: 12,
  },
  ctaBtn: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  ctaBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  ctaBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(248,113,113,0.4)',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F87171',
  },
  disclaimer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
