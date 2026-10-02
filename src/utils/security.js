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
 * Password policy. Supabase Auth for this project only enforces a minimum
 * length of 6 characters, so that is the only hard requirement here.
 * Character variety is recommended (and feeds the strength meter) but is
 * not required, so the client never rejects a password the backend accepts.
 */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULES = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, required: true, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'lower', label: 'Lowercase letter', required: false, test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'Uppercase letter', required: false, test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'Number', required: false, test: (p) => /\d/.test(p) },
  { id: 'special', label: 'Special character', required: false, test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function getPasswordChecks(password) {
  const value = password || '';
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, required: rule.required, met: rule.test(value) }));
}

/**
 * Local-only strength estimate for UI feedback. Never a substitute for validatePassword.
 * Returns { level: 0-4, label }.
 */
export function getPasswordStrength(password) {
  const value = password || '';
  if (!value) return { level: 0, label: '' };
  if (value.length < PASSWORD_MIN_LENGTH) return { level: 1, label: 'Weak' };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(value)).length;
  const points = variety + (value.length >= 8 ? 1 : 0) + (value.length >= 12 ? 1 : 0);
  if (points <= 2) return { level: 1, label: 'Weak' };
  if (points === 3) return { level: 2, label: 'Fair' };
  if (points === 4) return { level: 3, label: 'Good' };
  return { level: 4, label: 'Strong' };
}

/**
 * Validate a new password against the policy above.
 * Returns { valid, message }
 */
export function validatePassword(password) {
  if (!password) {
    return { valid: false, message: 'Enter a password.' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, message: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.` };
  }
  return { valid: true, message: '' };
}

export function validatePasswordConfirmation(password, confirmation) {
  if (!confirmation) return { valid: false, message: 'Confirm your password.' };
  if (password !== confirmation) return { valid: false, message: 'Passwords do not match.' };
  return { valid: true, message: '' };
}

const PHONE_PATTERN = /^\+?\d[\d\s\-()]{6,}$/;

export function isPhoneNumber(value) {
  return PHONE_PATTERN.test((value || '').trim());
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
