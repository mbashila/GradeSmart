import { useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

let Application = null;
try { Application = require('expo-application'); } catch {}

const DEVICE_ID_KEY = 'gradesmart_device_id';
const HEARTBEAT_INTERVAL = 60000; // 1 minute

async function getOrCreateDeviceId() {
  try {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return `${Platform.OS}-${Date.now()}`;
  }
}

function getDeviceName() {
  const os = Platform.OS === 'ios' ? 'iOS' : 'Android';
  const name = Application?.applicationName || 'GradeSmart';
  return `${name} (${os})`;
}

export default function useDeviceSession(userId, onForceLogout) {
  const heartbeatRef = useRef(null);
  const deviceIdRef = useRef(null);

  const registerSession = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) return { conflict: false };

    try {
      const deviceId = await getOrCreateDeviceId();
      deviceIdRef.current = deviceId;
      const deviceName = getDeviceName();

      const { data, error } = await supabase.rpc('register_device_session', {
        p_device_id: deviceId,
        p_device_name: deviceName,
      });

      if (error) {
        console.log('Device session register error:', error);
        return { conflict: false };
      }

      if (data?.conflict) {
        return { conflict: true, devices: data.active_devices || [] };
      }

      return { conflict: false };
    } catch (e) {
      console.log('Device session exception:', e);
      return { conflict: false };
    }
  }, [userId]);

  const forceLogoutOtherDevices = useCallback(async () => {
    if (!isSupabaseConfigured || !deviceIdRef.current) return;
    try {
      await supabase.rpc('force_logout_other_devices', {
        p_device_id: deviceIdRef.current,
      });
    } catch (e) {
      console.log('Force logout error:', e);
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!isSupabaseConfigured || !deviceIdRef.current || !userId) return;
    try {
      await supabase.rpc('device_heartbeat', {
        p_device_id: deviceIdRef.current,
      });
    } catch {}
  }, [userId]);

  const logActivity = useCallback(async (action, meta = {}) => {
    if (!isSupabaseConfigured || !userId) return;
    try {
      await supabase.from('user_activity_log').insert({
        user_id: userId,
        action,
        meta,
      });
    } catch {}
  }, [userId]);

  const showConflictAlert = useCallback((devices) => {
    const deviceList = (devices || [])
      .map(d => d.device_name || 'Unknown device')
      .join(', ');

    Alert.alert(
      'Active Session Detected',
      `Your account is logged in on: ${deviceList || 'another device'}.\n\nWould you like to log out from those devices and continue here?`,
      [
        {
          text: 'Log Out Here',
          style: 'cancel',
          onPress: () => {
            if (onForceLogout) onForceLogout();
          },
        },
        {
          text: 'Continue Here',
          onPress: async () => {
            await forceLogoutOtherDevices();
            await registerSession();
          },
        },
      ],
      { cancelable: false }
    );
  }, [forceLogoutOtherDevices, registerSession, onForceLogout]);

  useEffect(() => {
    if (!userId) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    let mounted = true;

    (async () => {
      const result = await registerSession();
      if (!mounted) return;

      if (result.conflict) {
        showConflictAlert(result.devices);
      } else {
        await logActivity('login');
      }

      // Start heartbeat
      heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    })();

    return () => {
      mounted = false;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [userId]);

  return { logActivity, forceLogoutOtherDevices };
}
