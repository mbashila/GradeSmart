/**
 * GradeSmart Grading Server Service
 * 
 * Connects the React Native app to the Python FastAPI + OpenCV backend.
 * Sends captured images for real OMR bubble detection, OCR, and grading.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gradesmart:grading_server_url';
const DEFAULT_URL = 'http://192.168.1.100:8100';
const TIMEOUT_MS = 30000;

// Read from .env at build time
const ENV_URL = process.env.EXPO_PUBLIC_GRADING_SERVER_URL || '';

let _serverUrl = ENV_URL || DEFAULT_URL;

/**
 * Initialize the server URL from storage.
 */
export async function initGradingServer() {
  if (ENV_URL) { _serverUrl = ENV_URL; return; }
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) _serverUrl = saved;
  } catch {}
}

/**
 * Get the current server URL.
 */
export function getGradingServerUrl() {
  return _serverUrl;
}

/**
 * Set and persist the server URL.
 */
export async function setGradingServerUrl(url) {
  _serverUrl = url.replace(/\/+$/, '');
  try {
    await AsyncStorage.setItem(STORAGE_KEY, _serverUrl);
  } catch {}
}

/**
 * Check if the grading server is reachable.
 */
export async function checkGradingServer() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${_serverUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const data = await res.json();
    return {
      ok: true,
      opencvVersion: data.opencv_version,
      tesseract: data.tesseract,
      service: data.service,
    };
  } catch (e) {
    return { ok: false, error: e.message || 'Connection failed' };
  }
}

/**
 * Send an image file to the server.
 * @param {string} endpoint - API endpoint path (e.g., '/grade-mcq')
 * @param {string} imageUri - Local image URI
 * @param {object} formFields - Additional form fields to send
 * @returns {Promise<object>} Server response
 */
async function sendImage(endpoint, imageUri, formFields = {}) {
  const formData = new FormData();

  // Append the image file
  const filename = imageUri.split('/').pop() || 'image.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('file', {
    uri: imageUri,
    name: filename,
    type,
  });

  // Append additional form fields
  for (const [key, value] of Object.entries(formFields)) {
    formData.append(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${_serverUrl}${endpoint}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { error: `Server error ${res.status}: ${errText}` };
    }

    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      return { error: 'Request timed out. Check server connection.' };
    }
    return { error: e.message || 'Failed to connect to grading server' };
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * MCQ OMR only (no grading): preprocess → detect bubbles
 */
export async function detectMCQWithServer(imageUri, numQuestions, options = {}) {
  const { numChoices = 4 } = options;

  const result = await sendImage('/omr', imageUri, {
    num_questions: numQuestions,
    num_choices: numChoices,
  });

  if (result.error) return result;

  return {
    success: result.success !== false,
    answers: result.answers || [],
    confidence: result.confidence || [],
    detectedCount: result.detected_count || 0,
    method: result.method || 'server-omr',
    bubbleCount: result.bubble_count || 0,
    processingTimeMs: result.processing_time_ms || 0,
  };
}

