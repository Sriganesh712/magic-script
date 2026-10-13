/**
 * Word count diffing engine for Screenplay Studio (ANA-001)
 * Framework-independent pure functions for word diffing and analysis.
 */

/** Result of diffing words between two text versions */
export interface WordDiffResult {
  /** Number of words added */
  added: number
  /** Number of words deleted */
  deleted: number
  /** Net word count change (added - deleted) */
  net: number
}

/**
 * Extracts individual words from text, stripping HTML tags and normalizing whitespace.
 * Handles Unicode, contractions, accents, and CJK characters.
 *
 * @param text - Raw text or HTML markup
 * @returns Array of word strings
 */
export function extractWords(text: string): string[] {
  if (!text) return []

  // 1. Strip HTML tags, replacing each tag with a space so adjacent tags don't concatenate words
  const noHtml = text.replace(/<[^>]+>/g, ' ')

  // 2. Decode common HTML entities
  const decoded = noHtml
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")

  // 3. Segment into words using Intl.Segmenter if available
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
      const segments = segmenter.segment(decoded)
      const words: string[] = []
      for (const seg of segments) {
        if (seg.isWordLike) {
          const trimmed = seg.segment.trim()
          if (trimmed.length > 0) {
            words.push(trimmed)
          }
        }
      }
      return words
    } catch {
      // Fall through to regex if Intl.Segmenter fails
    }
  }

  // Fallback: Unicode word regex matching letters/numbers and hyphens/apostrophes within words
  const matches = decoded.match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)
  return matches ? matches.map(w => w.trim()).filter(w => w.length > 0) : []
}

/**
 * Counts total words in a text string or HTML content.
 *
 * @param text - Raw text or HTML markup
 * @returns Total word count
 */
export function countWords(text: string): number {
  return extractWords(text).length
}

/**
 * Computes Longest Common Subsequence (LCS) length between two arrays of words.
 * Optimizes by trimming common prefix and suffix first, then running a 2-row DP.
 *
 * @param a - First word array
 * @param b - Second word array
 * @returns LCS length
 */
export function computeLCSLength(a: string[], b: string[]): number {
  const m = a.length
  const n = b.length
  if (m === 0 || n === 0) return 0

  // 1. Trim common prefix
  let start = 0
  while (start < m && start < n && a[start] === b[start]) {
    start++
  }

  // 2. Trim common suffix
  let endA = m - 1
  let endB = n - 1
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--
    endB--
  }

  const prefixLen = start
  const suffixLen = m - 1 - endA
  const trimmedLenA = endA - start + 1
  const trimmedLenB = endB - start + 1

  if (trimmedLenA <= 0 || trimmedLenB <= 0) {
    return prefixLen + suffixLen
  }

  // 2-row DP on the trimmed segments to conserve memory
  let prev = new Int32Array(trimmedLenB + 1)
  let curr = new Int32Array(trimmedLenB + 1)

  for (let i = 1; i <= trimmedLenA; i++) {
    const wordA = a[start + i - 1]
    for (let j = 1; j <= trimmedLenB; j++) {
      const wordB = b[start + j - 1]
      if (wordA === wordB) {
        curr[j] = prev[j - 1] + 1
      } else {
        curr[j] = prev[j] > curr[j - 1] ? prev[j] : curr[j - 1]
      }
    }
    const temp = prev
    prev = curr
    curr = temp
  }

  return prefixLen + suffixLen + prev[trimmedLenB]
}

/**
 * Computes actual words added and deleted between two text versions.
 * Ignores formatting-only changes (HTML tags, extra whitespace).
 *
 * @param oldText - Previous text version
 * @param newText - New text version
 * @returns WordDiffResult with added, deleted, and net counts
 */
export function diffWords(oldText: string, newText: string): WordDiffResult {
  const oldWords = extractWords(oldText ?? '')
  const newWords = extractWords(newText ?? '')

  if (oldWords.length === 0 && newWords.length === 0) {
    return { added: 0, deleted: 0, net: 0 }
  }

  if (oldWords.length === 0) {
    return { added: newWords.length, deleted: 0, net: newWords.length }
  }

  if (newWords.length === 0) {
    return { added: 0, deleted: oldWords.length, net: -oldWords.length }
  }

  const lcs = computeLCSLength(oldWords, newWords)
  const added = newWords.length - lcs
  const deleted = oldWords.length - lcs
  const net = added - deleted

  return { added, deleted, net }
}
