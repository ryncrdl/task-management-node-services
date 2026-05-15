'use strict';

const config = require('../config');
const logger = require('../utils/logger');

/**
 * Simple in-memory cache with TTL support.
 * Can be replaced with Redis by swapping the implementation below.
 */

const cache = new Map();

/**
 * Get a cached value by key.
 * Returns null if the key doesn't exist or has expired.
 */
function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Set a value in the cache with a TTL in seconds.
 */
function set(key, value, ttlSeconds = config.analyticsCacheTtl) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Delete a specific key from cache.
 */
function del(key) {
  cache.delete(key);
}

/**
 * Clear all cached entries.
 */
function clear() {
  cache.clear();
}

/**
 * Wrap an async function with caching.
 * If the result is already cached, return it immediately.
 * Otherwise execute the function, cache the result, and return it.
 */
async function remember(key, ttlSeconds, fn) {
  const cached = get(key);
  if (cached !== null) {
    logger.debug('Cache hit', { key });
    return cached;
  }

  logger.debug('Cache miss', { key });
  const result = await fn();
  set(key, result, ttlSeconds);
  return result;
}

module.exports = { get, set, del, clear, remember };
