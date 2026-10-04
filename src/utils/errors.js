/**
 * Turns any thrown/returned error (Supabase, fetch, OpenAI service strings,
 * render errors) into one predictable shape for the UI, plus safe dev logging.
 *
 *   normalizeError(error, { action: 'load your tests' })
 *   -> { category, title, message, icon, tone, retryable, status, code, requestId }
 */

export const ErrorCategory = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  VALIDATION: 'validation',
  AUTH: 'auth',
  SESSION: 'session',
  PERMISSION: 'permission',
  NOT_FOUND: 'notFound',
  RATE_LIMIT: 'rateLimit',
  SERVER: 'server',
  CONFIG: 'config',
  UNEXPECTED: 'unexpected',
};

const PRESETS = {
  network: {
    title: 'No internet connection',
    message: 'Check your internet connection and try again.',
    icon: 'cloud-offline-outline',
    tone: 'warning',
    retryable: true,
  },
  timeout: {
    title: 'This is taking too long',
    message: 'The request took too long. Please try again.',
    icon: 'time-outline',
    tone: 'warning',
    retryable: true,
  },
  validation: {
    title: 'Check your information',
    message: 'Something is wrong with the information you submitted.',
    icon: 'alert-circle-outline',
    tone: 'error',
    retryable: false,
  },
  auth: {
    title: "Couldn't sign you in",
    message: 'Incorrect email or password. Please try again.',
    icon: 'alert-circle-outline',
    tone: 'error',
    retryable: false,
  },
  session: {
    title: 'Your session has expired',
    message: 'Your session has expired. Please log in again.',
    icon: 'log-in-outline',
    tone: 'warning',
    retryable: false,
    actionLabel: 'Log In Again',
  },
  permission: {
    title: 'Access denied',
    message: "You don't have permission to perform this action.",
    icon: 'lock-closed-outline',
    tone: 'error',
    retryable: false,
  },
  notFound: {
    title: 'Not found',
    message: "We couldn't find what you're looking for.",
    icon: 'search-outline',
    tone: 'error',
    retryable: false,
  },
  rateLimit: {
    title: 'Too many requests',
    message: 'Too many requests. Please wait a moment and try again.',
    icon: 'hourglass-outline',
    tone: 'warning',
    retryable: true,
  },
  server: {
    title: 'Server problem',
    message: 'Something went wrong on our side. Please try again later.',
    icon: 'server-outline',
    tone: 'error',
    retryable: true,
  },
  config: {
    title: 'Not available',
    message: "This feature isn't set up on this device yet.",
    icon: 'settings-outline',
    tone: 'warning',
    retryable: false,
  },
  unexpected: {
    title: 'Something went wrong',
    message: 'Something unexpected happened. Please try again.',
    icon: 'alert-circle-outline',
    tone: 'error',
    retryable: true,
  },
};

const NETWORK_PATTERN = /network request failed|failed to fetch|network ?error|fetcherror|internet connection|offline|could not connect|connection (refused|reset)|ENOTFOUND|ECONNREFUSED/i;
const TIMEOUT_PATTERN = /timed? ?out|timeout|aborterror|aborted/i;
const SESSION_PATTERN = /jwt expired|invalid jwt|session (missing|not found|expired)|refresh token|not authenticated/i;
const PERMISSION_PATTERN = /permission denied|row-level security|not authori[sz]ed|forbidden/i;
const SESSION_CODES = new Set(['PGRST301', 'PGRST302', 'session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt', 'no_authorization']);
const PERMISSION_CODES = new Set(['42501', 'insufficient_privilege']);
const NOT_FOUND_CODES = new Set(['PGRST116', 'PGRST202', 'PGRST205', 'user_not_found']);
const VALIDATION_CODES = new Set(['22P02', '23502', '23505', '23514', 'PGRST102', 'validation_failed']);

// Strings the AI service builds itself are already user-facing; anything that
// carries an HTTP body, exception text or raw model output is not.
const TECHNICAL_PATTERN = /error \d{3}|^api |^ai error|^http \d|failed to (parse|process)|raw:|typeerror|referenceerror|syntaxerror|exception|json|undefined|stack|\{|\}/i;

function readStatus(error, text) {
  const raw = error?.status ?? error?.statusCode ?? error?.response?.status;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  const m = /(?:api error|http|server error|api returned|status)\s*:?\s*(\d{3})\b/i.exec(text);
  return m ? Number(m[1]) : undefined;
}

function categorize(error, status, code, text) {
  if (error?.name === 'TimeoutError' || code === 'timeout') return ErrorCategory.TIMEOUT;
  if (SESSION_CODES.has(code) || SESSION_PATTERN.test(text)) return ErrorCategory.SESSION;
  if (PERMISSION_CODES.has(code)) return ErrorCategory.PERMISSION;
  if (NOT_FOUND_CODES.has(code)) return ErrorCategory.NOT_FOUND;
  if (VALIDATION_CODES.has(code)) return ErrorCategory.VALIDATION;
  if (code === 'invalid_credentials') return ErrorCategory.AUTH;
  if (code === 'not_configured' || /not configured|no api key/i.test(text)) return ErrorCategory.CONFIG;
  if (status) {
    if (status === 401) return ErrorCategory.SESSION;
    if (status === 403) return ErrorCategory.PERMISSION;
    if (status === 404) return ErrorCategory.NOT_FOUND;
    if (status === 408 || status === 504) return ErrorCategory.TIMEOUT;
    if (status === 429) return ErrorCategory.RATE_LIMIT;
    if (status >= 500) return ErrorCategory.SERVER;
    if (status >= 400) return ErrorCategory.VALIDATION;
  }
  if (/too many requests|rate limit/i.test(text)) return ErrorCategory.RATE_LIMIT;
  if (error?.name === 'AuthRetryableFetchError' || NETWORK_PATTERN.test(text)) return ErrorCategory.NETWORK;
  if (TIMEOUT_PATTERN.test(text)) return ErrorCategory.TIMEOUT;
  if (PERMISSION_PATTERN.test(text)) return ErrorCategory.PERMISSION;
  return ErrorCategory.UNEXPECTED;
}

/**
 * @param {unknown} error Error object, Supabase error, `{ error }` result or string.
 * @param {object} [options]
 * @param {string} [options.action] What failed, e.g. 'load your tests' -> "Unable to load your tests".
 * @param {string} [options.title] Explicit title override.
 * @param {string} [options.message] Explicit message override.
 * @param {boolean} [options.trustMessage] Use a string error as-is when it reads as user-facing text.
 */
export function normalizeError(error, options = {}) {
  if (error && error.__normalized) return error;
  const source = error && typeof error === 'object' && 'error' in error && error.error ? error.error : error;
  const text = typeof source === 'string'
    ? source
    : [source?.name, source?.message, source?.details, source?.hint].filter(Boolean).join(' ');
  const code = typeof source === 'object' && source ? String(source.code || source.error_code || '') : '';
  const status = readStatus(source, text);
  const category = categorize(source, status, code, text);
  const preset = PRESETS[category];

  let message = options.message || preset.message;
  if (!options.message && options.trustMessage && typeof source === 'string'
      && (category === ErrorCategory.UNEXPECTED || category === ErrorCategory.CONFIG)
      && source.trim() && !TECHNICAL_PATTERN.test(source)) {
    message = source.trim();
  }

  return {
    __normalized: true,
    category,
    title: options.title || (options.action ? `Unable to ${options.action}` : preset.title),
    message,
    icon: preset.icon,
    tone: preset.tone,
    retryable: preset.retryable,
    actionLabel: preset.actionLabel,
    status,
    code: code || undefined,
    requestId: source?.requestId || source?.request_id,
    cause: source,
  };
}

/** User-facing sentence for inline/action errors. */
export function getErrorMessage(error, options) {
  return normalizeError(error, options).message;
}

const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|api[-_]?key|apikey|cookie|otp|code_verifier/i;

function redact(value, depth = 0) {
  if (value == null || depth > 3) return value;
  if (Array.isArray(value)) return value.slice(0, 10).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((k) => {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(value[k], depth + 1);
    });
    return out;
  }
  if (typeof value === 'string') return value.replace(/(Bearer\s+)[\w.-]+/gi, '$1[redacted]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]');
  return value;
}

/**
 * Developer diagnostics: `[TESTS_ERROR] { category, status, code, operation, ... }`.
 * Raw error text is only included in development builds.
 */
export function logError(scope, error, meta = {}) {
  const n = normalizeError(error);
  const tag = `[${String(scope).toUpperCase()}_ERROR]`;
  const entry = {
    category: n.category,
    ...(n.status ? { status: n.status } : null),
    ...(n.code ? { code: n.code } : null),
    ...(n.requestId ? { requestId: n.requestId } : null),
    ...redact(meta),
  };
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  if (isDev) {
    const raw = n.cause;
    const detail = typeof raw === 'string' ? raw : raw?.message;
    console.log(tag, entry, detail ? redact(String(detail)).slice(0, 300) : '');
  } else {
    console.log(tag, n.category, n.status || '');
  }
  return n;
}

/**
 * Message for a failed action, placed next to the action:
 *   getActionErrorMessage(err, "Couldn't save your changes.")
 *   -> "Couldn't save your changes. Check your internet connection and try again."
 */
export function getActionErrorMessage(error, what) {
  const n = normalizeError(error);
  const detail = n.category === ErrorCategory.UNEXPECTED ? 'Please try again.' : n.message;
  return what ? `${what} ${detail}` : detail;
}

/**
 * OpenAI service errors are strings like "API error 401: {...}". A 401/403
 * there means the API key was rejected, not that the user's session expired.
 */
export function getAiErrorMessage(error) {
  const n = normalizeError(error, { trustMessage: true });
  if (n.status === 401 || n.status === 403) return 'The OpenAI API key was rejected. Check it in Settings.';
  if (n.category === ErrorCategory.SESSION) return 'The OpenAI API key was rejected. Check it in Settings.';
  if (n.category === ErrorCategory.UNEXPECTED && n.message === PRESETS.unexpected.message) {
    return "The AI couldn't process this. Please try again.";
  }
  return n.message;
}
