import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PREFIX = '@gradesmart:secure:';

/**
 * Secure storage wrapper using expo-secure-store for native
 * and falls back to in-memory for web (no persistence on web).
 * Use this for API keys, tokens, and other sensitive data.
 */

// In-memory fallback for web where SecureStore isn't available
const memoryStore = {};

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export async function getSecureItem(key) {
  const fullKey = PREFIX + key;
  try {
    if (isNative) {
      return await SecureStore.getItemAsync(fullKey);
    }
    return memoryStore[fullKey] || null;
  } catch {
    return null;
  }
}

export async function setSecureItem(key, value) {
  const fullKey = PREFIX + key;
  try {
    if (isNative) {
      await SecureStore.setItemAsync(fullKey, value);
    } else {
      memoryStore[fullKey] = value;
    }
  } catch {}
}

export async function removeSecureItem(key) {
  const fullKey = PREFIX + key;
  try {
    if (isNative) {
      await SecureStore.deleteItemAsync(fullKey);
    } else {
      delete memoryStore[fullKey];
    }
  } catch {}
}

export default {
  getItem: getSecureItem,
  setItem: setSecureItem,
  removeItem: removeSecureItem,
};
