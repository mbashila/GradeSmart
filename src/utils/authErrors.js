const NETWORK_PATTERN = /network request failed|failed to fetch|network error|timed out|timeout/i;

/**
 * Map a Supabase Auth error to a short, user-facing message.
 * Messages never include credentials and avoid confirming whether an account exists.
 */
export function getAuthErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const code = error.code || error.error_code || '';
  const status = error.status;
  const message = String(error.message || '');

  if (error.name === 'AuthRetryableFetchError' || NETWORK_PATTERN.test(message)) {
    return "Can't reach GradeSmart right now. Check your connection and try again.";
  }
  if (status === 429 || /rate limit|too many/i.test(code) || /rate limit|too many requests/i.test(message)) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'Incorrect email or password.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Please verify your email address before signing in.';
  }
  if (code === 'same_password') {
    return 'Your new password must be different from your current password.';
  }
  if (code === 'weak_password') {
    return message || 'Please choose a stronger password.';
  }
  if (code === 'otp_expired' || /token has expired|invalid otp|expired or is invalid/i.test(message)) {
    return 'This code is invalid or has expired. Request a new one.';
  }
  if (code === 'reauthentication_needed' || code === 'session_not_found' || /session missing/i.test(message)) {
    return 'Your session has expired. Please sign in again.';
  }
  return message || fallback;
}
