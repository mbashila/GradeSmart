import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { isOnline, subscribeNetworkStatus } from '../utils/networkStatus';
import { checkConnectivity } from '../lib/supabase';

const PROBE_MIN_MS = 5000;
const PROBE_MAX_MS = 60000;

/**
 * Subtle "No internet connection" strip. Goes offline when a request fails at
 * the network layer; while offline, probes with backoff (and on app resume) so
 * the strip clears once the connection is back. Loaded content is untouched.
 */
export default function OfflineBanner() {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [online, setOnline] = useState(isOnline());
  const timerRef = useRef(null);
  const delayRef = useRef(PROBE_MIN_MS);

  useEffect(() => subscribeNetworkStatus(setOnline), []);

  useEffect(() => {
    if (online) {
      delayRef.current = PROBE_MIN_MS;
      return undefined;
    }
    let cancelled = false;
    const schedule = () => {
      timerRef.current = setTimeout(async () => {
        const ok = await checkConnectivity();
        if (cancelled || ok) return;
        delayRef.current = Math.min(delayRef.current * 2, PROBE_MAX_MS);
        schedule();
      }, delayRef.current);
    };
    schedule();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkConnectivity();
    });
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      sub.remove();
    };
  }, [online]);

  if (online) return null;
  return (
    <View
      style={styles.banner}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel="No internet connection. Showing saved content."
    >
      <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} importantForAccessibility="no" />
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: colors.warning + '1F',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.warning + '66',
  },
  text: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
});
