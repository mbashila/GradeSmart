import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { reportNetworkFailure, reportNetworkSuccess } from '../utils/networkStatus';

// Chunked SecureStore adapter — splits values that exceed the 2048-byte limit
// into multiple keys so the full Supabase session can be persisted safely.
const CHUNK_SIZE = 1800; // stay well under the 2048 limit

const ExpoSecureStoreAdapter = {
  getItem: async (key) => {
    // Try reading a single-chunk value first
    const value = await SecureStore.getItemAsync(key);
    if (value === null) return null;
    // If it's not a chunk header, return as-is (legacy / small values)
    if (!value.startsWith('__chunks:')) return value;
    // Reassemble chunks
    const count = parseInt(value.replace('__chunks:', ''), 10);
    const parts = [];
    for (let i = 0; i < count; i++) {
      parts.push(await SecureStore.getItemAsync(`${key}__chunk_${i}`));
    }
    return parts.join('');
  },
  setItem: async (key, value) => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      // Clean up any old chunks
      for (let i = 0; i < 20; i++) {
        try { await SecureStore.deleteItemAsync(`${key}__chunk_${i}`); } catch {}
      }
      return;
    }
    // Split into chunks
    const chunks = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    // Store header with chunk count
    await SecureStore.setItemAsync(key, `__chunks:${chunks.length}`);
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunks[i]);
    }
  },
  removeItem: async (key) => {
    const value = await SecureStore.getItemAsync(key);
    if (value && value.startsWith('__chunks:')) {
      const count = parseInt(value.replace('__chunks:', ''), 10);
      for (let i = 0; i < count; i++) {
        try { await SecureStore.deleteItemAsync(`${key}__chunk_${i}`); } catch {}
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const extras = (Constants?.expoConfig?.extra) || (Constants?.manifest?.extra) || {};
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || extras.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extras.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const REQUEST_TIMEOUT_MS = 15000;

function timeoutError(ms) {
  const err = new Error(`Request timed out after ${ms}ms`);
  err.name = 'TimeoutError';
  err.code = 'timeout';
  return err;
}

// Runs a Supabase request with an abort signal so a stalled network call
// settles as an error instead of leaving callers loading forever.
export async function withRequestTimeout(run, ms = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const result = await run(controller.signal);
    // postgrest-js resolves aborted requests as `{ error }` instead of throwing.
    if (controller.signal.aborted) throw timeoutError(ms);
    return result;
  } catch (e) {
    if (controller.signal.aborted) throw timeoutError(ms);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Dev-only fault injection for exercising error UI against database requests:
// EXPO_PUBLIC_SIMULATE_API_ERROR = 400 | 401 | 403 | 404 | 429 | 500 | offline | timeout
const SIMULATED_API_ERROR = __DEV__ ? (process.env.EXPO_PUBLIC_SIMULATE_API_ERROR || '') : '';

function simulatedResponse(url, init) {
  if (!SIMULATED_API_ERROR || !/\/rest\/v1\//.test(String(url))) return null;
  if (SIMULATED_API_ERROR === 'offline') return Promise.reject(new TypeError('Network request failed'));
  if (SIMULATED_API_ERROR === 'timeout') {
    return new Promise((_, reject) => {
      init?.signal?.addEventListener?.('abort', () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  }
  const status = Number(SIMULATED_API_ERROR) || 500;
  return Promise.resolve(new Response(
    JSON.stringify({ message: `Simulated ${status}`, code: status === 401 ? 'PGRST301' : 'SIMULATED' }),
    { status, headers: { 'Content-Type': 'application/json' } }
  ));
}

// Reports reachability to the offline indicator for every Supabase request.
async function trackedFetch(url, init) {
  try {
    const res = await (simulatedResponse(url, init) || fetch(url, init));
    reportNetworkSuccess();
    return res;
  } catch (e) {
    if (e?.name !== 'AbortError') reportNetworkFailure();
    throw e;
  }
}

// Lightweight reachability probe used by the offline indicator; a response of
// any status means the device is back online.
export async function checkConnectivity(ms = 5000) {
  if (!isSupabaseConfigured) return true;
  try {
    await withRequestTimeout((signal) => trackedFetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal,
    }), ms);
    return true;
  } catch {
    return false;
  }
}

export const supabase = createClient(
  SUPABASE_URL || 'https://invalid-project.supabase.co',
  SUPABASE_ANON_KEY || 'invalid-key',
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: { fetch: trackedFetch },
  }
);
