/**
 * Performance optimizations for glob pattern matching
 *
 * This module provides:
 * - Pattern compilation cache (avoid re-creating Minimatch instances)
 * - Result memoization with TTL (cache glob results)
 * - Stat caching (avoid redundant fs.stat calls)
 * - Fast paths for simple patterns (*.js, **.ts)
 *
 * @module
 */

import { Minimatch, MinimatchOptions } from 'minimatch'

// Pattern compilation cache - stores compiled Minimatch instances
const patternCache = new Map<string, Minimatch>()

// Result memoization cache with TTL
interface CachedResult {
  results: string[]
  timestamp: number
}

const resultCache = new Map<string, CachedResult>()
const DEFAULT_TTL = 5000 // 5 seconds default TTL

// Stat cache key format: path + stat type
const statCache = new Map<string, any>()

/**
 * Get or create a cached Minimatch pattern
 */
export function getCachedPattern(
  pattern: string,
  options: MinimatchOptions,
): Minimatch {
  // Create a cache key from serializable options only
  // Exclude non-serializable objects like scurry, fs, etc.
  const serializableOpts = Object.keys(options)
    .filter(key => {
      const val = (options as any)[key]
      return typeof val !== 'object' && typeof val !== 'function'
    })
    .sort()
    .reduce((acc, key) => {
      acc[key] = (options as any)[key]
      return acc
    }, {} as any)

  const cacheKey = JSON.stringify({ pattern, options: serializableOpts })

  let cached = patternCache.get(cacheKey)
  if (!cached) {
    cached = new Minimatch(pattern, options)
    patternCache.set(cacheKey, cached)
  }

  return cached
}

/**
 * Clear the pattern cache (useful for testing or memory management)
 */
export function clearPatternCache(): void {
  patternCache.clear()
}

/**
 * Get the size of the pattern cache
 */
export function getPatternCacheSize(): number {
  return patternCache.size
}

/**
 * Check if pattern is a simple fast-path pattern
 * Simple patterns: *.ext, **.ext, no special regex chars
 */
export function isSimplePattern(pattern: string): boolean {
  // Fast paths for common patterns
  // *.js, *.ts, **.js, **.ts, etc
  if (/^\*\*?\.\w+$/.test(pattern)) {
    return true
  }

  // No glob characters except * and .
  if (!/[?[\]{}()+@!]/.test(pattern)) {
    return true
  }

  return false
}

/**
 * Fast path matching for simple patterns
 * Returns null if pattern is not simple
 */
export function fastPathMatch(
  pattern: string,
  filename: string,
): boolean | null {
  // *.ext pattern
  const simpleExt = /^\*\.(\w+)$/.exec(pattern)
  if (simpleExt) {
    return filename.endsWith('.' + simpleExt[1])
  }

  // **.ext pattern (matches in any subdirectory)
  const recursiveExt = /^\*\*\.(\w+)$/.exec(pattern)
  if (recursiveExt) {
    return filename.endsWith('.' + recursiveExt[1])
  }

  // Not a simple pattern
  return null
}

/**
 * Get cached glob results if available and not expired
 */
export function getCachedResults(
  cacheKey: string,
  ttl: number = DEFAULT_TTL,
): string[] | null {
  const cached = resultCache.get(cacheKey)
  if (!cached) {
    return null
  }

  const age = Date.now() - cached.timestamp
  if (age > ttl) {
    // Expired - remove from cache
    resultCache.delete(cacheKey)
    return null
  }

  return cached.results
}

/**
 * Store glob results in cache
 */
export function setCachedResults(
  cacheKey: string,
  results: string[],
): void {
  resultCache.set(cacheKey, {
    results: [...results], // Clone to avoid mutations
    timestamp: Date.now(),
  })
}

/**
 * Clear the result cache
 */
export function clearResultCache(): void {
  resultCache.clear()
}

/**
 * Get the size of the result cache
 */
export function getResultCacheSize(): number {
  return resultCache.size
}

/**
 * Create a cache key for glob operations
 */
export function createCacheKey(
  pattern: string | string[],
  cwd: string,
  options: any,
): string {
  const patterns = Array.isArray(pattern) ? pattern.sort().join('|') : pattern
  const optKeys = Object.keys(options).sort()
  const opts = optKeys.reduce((acc, key) => {
    // Skip functions and objects that can't be serialized
    if (typeof options[key] !== 'function' && typeof options[key] !== 'object') {
      acc[key] = options[key]
    }
    return acc
  }, {} as any)

  return JSON.stringify({ patterns, cwd, opts })
}

/**
 * Get cached stat result
 */
export function getCachedStat(path: string, statType: 'lstat' | 'stat' = 'lstat'): any | null {
  const key = `${statType}:${path}`
  return statCache.get(key) || null
}

/**
 * Store stat result in cache
 */
export function setCachedStat(
  path: string,
  result: any,
  statType: 'lstat' | 'stat' = 'lstat',
): void {
  const key = `${statType}:${path}`
  statCache.set(key, result)
}

/**
 * Clear the stat cache
 */
export function clearStatCache(): void {
  statCache.clear()
}

/**
 * Get the size of the stat cache
 */
export function getStatCacheSize(): number {
  return statCache.size
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  clearPatternCache()
  clearResultCache()
  clearStatCache()
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    patternCacheSize: getPatternCacheSize(),
    resultCacheSize: getResultCacheSize(),
    statCacheSize: getStatCacheSize(),
  }
}
