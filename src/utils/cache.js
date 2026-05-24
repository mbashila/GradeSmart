import storage from './storage';

const CACHE_PREFIX = '@gradesmart:cache:';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * In-memory + AsyncStorage cache with TTL support.
 * - Hot reads from memory, cold reads from AsyncStorage
 * - Automatic expiration based on TTL
 * - Invalidation by key or prefix
 */

// In-memory hot cache
const memoryCache = {};

/**
 * Get a cached value. Returns null if expired or not found.
 */
export async function getCached(key) {
  const fullKey = CACHE_PREFIX + key;

  // Check memory first
  if (memoryCache[fullKey]) {
    const { value, expiresAt } = memoryCache[fullKey];
    if (Date.now() < expiresAt) return value;
    delete memoryCache[fullKey];
  }

  // Check persistent storage
  try {
    const raw = await storage.getItem(fullKey);
    if (!raw) return null;
    const { value, expiresAt } = JSON.parse(raw);
    if (Date.now() >= expiresAt) {
      await storage.removeItem(fullKey);
      return null;
    }
    // Promote to memory cache
    memoryCache[fullKey] = { value, expiresAt };
    return value;
  } catch {
    return null;
  }
}

/**
 * Set a cached value with optional TTL (in milliseconds).
 */
export async function setCached(key, value, ttl = DEFAULT_TTL) {
  const fullKey = CACHE_PREFIX + key;
  const entry = { value, expiresAt: Date.now() + ttl };

  // Write to memory
  memoryCache[fullKey] = entry;

  // Persist to AsyncStorage
  try {
    await storage.setItem(fullKey, JSON.stringify(entry));
  } catch {}
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key) {
  const fullKey = CACHE_PREFIX + key;
  delete memoryCache[fullKey];
  try {
    await storage.removeItem(fullKey);
  } catch {}
}

/**
 * Invalidate all cache entries that start with the given prefix.
 * Only clears from memory (AsyncStorage doesn't support prefix listing efficiently).
 */
export function invalidateCachePrefix(prefix) {
  const fullPrefix = CACHE_PREFIX + prefix;
  for (const key of Object.keys(memoryCache)) {
    if (key.startsWith(fullPrefix)) {
      delete memoryCache[key];
    }
  }
}

/**
 * Clear the entire cache.
 */
export function clearMemoryCache() {
  for (const key of Object.keys(memoryCache)) {
    delete memoryCache[key];
  }
}

/**
 * Cache-through helper: returns cached value if available,
 * otherwise calls fetchFn, caches the result, and returns it.
 */
export async function cacheThrough(key, fetchFn, ttl = DEFAULT_TTL) {
  const cached = await getCached(key);
  if (cached !== null) return cached;

  const value = await fetchFn();
  if (value !== null && value !== undefined) {
    await setCached(key, value, ttl);
  }
  return value;
}

// TTL presets
export const TTL = {
  SHORT: 1 * 60 * 1000,       // 1 minute
  MEDIUM: 5 * 60 * 1000,      // 5 minutes
  LONG: 30 * 60 * 1000,       // 30 minutes
  HOUR: 60 * 60 * 1000,       // 1 hour
  DAY: 24 * 60 * 60 * 1000,   // 24 hours
};

export default {
  get: getCached,
  set: setCached,
  invalidate: invalidateCache,
  invalidatePrefix: invalidateCachePrefix,
  clearMemory: clearMemoryCache,
  through: cacheThrough,
  TTL,
};
