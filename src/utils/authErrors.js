import { ErrorCategory, normalizeError } from './errors';

const AUTH_MESSAGES = {
  invalid_credentials: 'Incorrect email or password. Please try again.',
  email_not_confirmed: 'Please verify your email address before signing in.',
  phone_not_confirmed: 'Please verify your phone number before signing in.',
  same_password: 'Your new password must be different from your current password.',
  user_already_exists: 'An account with these details already exists. Try logging in instead.',
  email_exists: 'An account with these details already exists. Try logging in instead.',
  phone_exists: 'An account with these details already exists. Try logging in instead.',
  email_address_invalid: 'Please enter a valid email address.',
  signup_disabled: "New sign-ups aren't available right now.",
  otp_expired: 'This code is invalid or has expired. Request a new one.',
  reauthentication_needed: 'Your session has expired. Please log in again.',
  session_not_found: 'Your session has expired. Please log in again.',
};

const CATEGORY_MESSAGES = {
  [ErrorCategory.NETWORK]: 'Unable to connect. Please check your internet connection and try again.',
  [ErrorCategory.TIMEOUT]: 'The request took too long. Please try again.',
  [ErrorCategory.RATE_LIMIT]: 'Too many attempts. Please wait a moment and try again.',
  [ErrorCategory.SERVER]: 'Something went wrong on our side. Please try again in a moment.',
  [ErrorCategory.SESSION]: 'Your session has expired. Please log in again.',
};

/**
 * Map a Supabase Auth error to a short, user-facing message.
 * Messages never include credentials and avoid confirming whether an account exists.
 */
export function getAuthErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const code = error.code || error.error_code || '';
  const message = String(error.message || '');

  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (/invalid login credentials/i.test(message)) return AUTH_MESSAGES.invalid_credentials;
  if (/email not confirmed/i.test(message)) return AUTH_MESSAGES.email_not_confirmed;
  if (/token has expired|invalid otp|expired or is invalid/i.test(message)) return AUTH_MESSAGES.otp_expired;
  if (/already registered|already exists/i.test(message)) return AUTH_MESSAGES.user_already_exists;
  // Supabase's weak-password message states the actual rule (e.g. minimum length).
  if (code === 'weak_password') return message || 'Please choose a stronger password.';

  const { category } = normalizeError(error);
  if (CATEGORY_MESSAGES[category]) return CATEGORY_MESSAGES[category];
  if (category === ErrorCategory.VALIDATION) return 'Some of the information you entered is invalid. Please check it and try again.';
  return fallback;
}
