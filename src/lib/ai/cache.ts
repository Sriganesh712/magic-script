/**
 * Task-Based Caching & In-Flight Request Deduplication (AI-002, AI-003)
 */

import type { AiTaskResult } from './types'

const memoryCache = new Map<string, AiTaskResult>()
const inFlightRequests = new Map<string, Promise<AiTaskResult>>()

/**
 * Computes a simple deterministic 32-bit hash string from inputs.
 */
export function computeTaskHash(
  task: string,
  prompt: string,
  context: string = '',
  model: string = ''
): string {
  const combined = `${task}:::${prompt}:::${context}:::${model}`
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32bit integer
  }
  return `ai_cache_${Math.abs(hash).toString(36)}_${combined.length}`
}

export function getCachedResult(hashKey: string): AiTaskResult | null {
  // 1. Check memory
  if (memoryCache.has(hashKey)) {
    const res = memoryCache.get(hashKey)!
    return { ...res, isCached: true }
  }

  // 2. Check sessionStorage
  try {
    const item = sessionStorage.getItem(hashKey)
    if (item) {
      const parsed = JSON.parse(item)
      memoryCache.set(hashKey, parsed)
      return { ...parsed, isCached: true }
    }
  } catch {
    // Ignore storage errors
  }

  return null
}

export function setCachedResult(hashKey: string, result: AiTaskResult): void {
  memoryCache.set(hashKey, result)
  try {
    sessionStorage.setItem(hashKey, JSON.stringify(result))
  } catch {
    // Ignore quota errors
  }
}

/**
 * Executes a function with in-flight deduplication.
 */
export async function deduplicateInFlight(
  hashKey: string,
  fetcher: () => Promise<AiTaskResult>
): Promise<AiTaskResult> {
  if (inFlightRequests.has(hashKey)) {
    return inFlightRequests.get(hashKey)!
  }

  const promise = (async () => {
    try {
      const res = await fetcher()
      setCachedResult(hashKey, res)
      return res
    } finally {
      inFlightRequests.delete(hashKey)
    }
  })()

  inFlightRequests.set(hashKey, promise)
  return promise
}

export function clearAiCache(): void {
  memoryCache.clear()
}
