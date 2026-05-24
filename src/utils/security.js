/**
 * Security utilities for GradeSmart
 * - Input sanitization
 * - Rate limiting for API calls
 * - Session validation helpers
 */

/**
 * Sanitize user input to prevent injection attacks.
 * Strips HTML tags and trims whitespace.
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * Sanitize an object's string values recursively.
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      result[key] = sanitizeInput(val);
    } else if (typeof val === 'object' && val !== null) {
      result[key] = sanitizeObject(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Simple in-memory rate limiter.
 * Returns true if the action is allowed, false if rate limited.
 */
const rateLimitMap = {};

export function rateLimit(actionKey, maxPerMinute = 10) {
  const now = Date.now();
  if (!rateLimitMap[actionKey]) {
    rateLimitMap[actionKey] = [];
  }
  // Clean old entries
  rateLimitMap[actionKey] = rateLimitMap[actionKey].filter(
    (ts) => now - ts < 60000
  );
  if (rateLimitMap[actionKey].length >= maxPerMinute) {
    return false;
  }
  rateLimitMap[actionKey].push(now);
  return true;
}

/**
 * Validate email format.
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate password strength.
 * Returns { valid, message }
 */
export function validatePassword(password) {
  if (!password || password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters.' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password is too long.' };
  }
  return { valid: true, message: '' };
}

/**
 * Mask sensitive data for logging (e.g., API keys).
 * Shows first 4 and last 4 characters.
 */
export function maskSensitive(value) {
  if (!value || typeof value !== 'string') return '***';
  if (value.length <= 8) return '***';
  return value.slice(0, 4) + '...' + value.slice(-4);
}
