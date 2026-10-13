/**
 * Unit Tests for Search/Replace and Character Autocomplete Logic
 * (EDT-004 & EDT-005)
 */

import { describe, it, expect } from 'vitest'
import {
  findMatchesInText,
  replaceInText,
  findMatchesInDoc,
} from '@/editor/extensions/SearchReplace'
import {
  cleanCharacterName,
  filterCharacterSuggestions,
  extractCharacterNames,
} from '@/editor/extensions/CharacterAutocomplete'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

describe('Search and Replace Logic (EDT-005)', () => {
  const sampleScript = `INT. COFFEE SHOP - DAY
SARAH sits near the window. Sarah checks her watch.
MIKE enters and waves at Sarah.
SARAH: Three hours and nothing.`

  // 1. Single match
  it('finds single match in text with correct start and end offsets', () => {
    const matches = findMatchesInText(sampleScript, 'COFFEE')
    expect(matches).toHaveLength(1)
    expect(matches[0].from).toBe(5)
    expect(matches[0].to).toBe(11)
    expect(matches[0].text).toBe('COFFEE')
  })

  // 2. Multiple matches (case-insensitive by default)
  it('finds multiple occurrences with default case-insensitive search', () => {
    const matches = findMatchesInText(sampleScript, 'Sarah')
    // SARAH, Sarah, Sarah, SARAH
    expect(matches.length).toBe(4)
    expect(matches.map((m) => m.text)).toEqual(['SARAH', 'Sarah', 'Sarah', 'SARAH'])
  })

  // 3. Case-sensitive matching
  it('supports case-sensitive search matching exact case only', () => {
    const upperMatches = findMatchesInText(sampleScript, 'SARAH', { caseSensitive: true })
    expect(upperMatches.length).toBe(2)
    expect(upperMatches.every((m) => m.text === 'SARAH')).toBe(true)

    const mixedMatches = findMatchesInText(sampleScript, 'Sarah', { caseSensitive: true })
    expect(mixedMatches.length).toBe(2)
    expect(mixedMatches.every((m) => m.text === 'Sarah')).toBe(true)
  })

  // 4. Regex matching
  it('supports regex matching with character classes and word boundaries', () => {
    // Match uppercase character cue words followed by colon or space
    const matches = findMatchesInText(sampleScript, '\\b(MIKE|SARAH):?', { useRegex: true, caseSensitive: true })
    expect(matches.length).toBe(3)
    expect(matches.map((m) => m.text)).toEqual(['SARAH', 'MIKE', 'SARAH:'])
  })

  // 5. Handles invalid regex safely without throwing
  it('handles invalid regex syntax safely by returning an empty list', () => {
    expect(() => {
      const matches = findMatchesInText(sampleScript, '[unclosed-bracket', { useRegex: true })
      expect(matches).toEqual([])
    }).not.toThrow()
  })

  // 6. Handles empty query or empty text gracefully
  it('handles empty query and empty text gracefully', () => {
    expect(findMatchesInText('', 'hello')).toEqual([])
    expect(findMatchesInText('hello', '')).toEqual([])
    expect(findMatchesInText('', '')).toEqual([])
  })

  // 7. Avoids infinite loop on zero-length regex matches
  it('avoids infinite loop on zero-length regex patterns', () => {
    const matches = findMatchesInText('abc', '^', { useRegex: true })
    expect(matches).toBeDefined()
  })

  // 8. Replace first occurrence
  it('replaces the first occurrence when replaceAll is false', () => {
    const text = 'The cat chased the other cat down the alley.'
    const result = replaceInText(text, 'cat', 'dog', { replaceAll: false })
    expect(result).toBe('The dog chased the other cat down the alley.')
  })

  // 9. Replace target index occurrence
  it('replaces a specific match occurrence by targetIndex', () => {
    const text = 'one apple, two apples, three apples'
    const result = replaceInText(text, 'apple', 'orange', { targetIndex: 1 })
    expect(result).toBe('one apple, two oranges, three apples')
  })

  // 10. Replace all occurrences
  it('replaces all occurrences when replaceAll is true', () => {
    const text = 'Sarah called Mike. Sarah left a voicemail. Sarah went home.'
    const result = replaceInText(text, 'Sarah', 'Emma', { replaceAll: true })
    expect(result).toBe('Emma called Mike. Emma left a voicemail. Emma went home.')
  })

  // 11. Replace with case sensitivity
  it('respects case-sensitivity during replace operations', () => {
    const text = 'SARAH is Sarah'
    const result = replaceInText(text, 'SARAH', 'EMILY', { caseSensitive: true, replaceAll: true })
    expect(result).toBe('EMILY is Sarah')
  })

  // 12. Replace with regex pattern
  it('supports regex replacement with patterns', () => {
    const text = 'Scene 1: Day, Scene 2: Night, Scene 3: Dawn'
    const result = replaceInText(text, 'Scene \\d+', 'Act', { useRegex: true, replaceAll: true })
    expect(result).toBe('Act: Day, Act: Night, Act: Dawn')
  })

  // 13. Document search (findMatchesInDoc)
  it('finds matches in a ProseMirror document text tree', () => {
    const mockDoc = {
      descendants(fn: (node: any, pos: number) => boolean) {
        fn({ isText: true, text: 'EXT. CEMETERY - NIGHT' }, 0)
        fn({ isText: true, text: 'SARAH walks through the mist.' }, 30)
        fn({ isText: true, text: 'SARAH' }, 70)
        return true
      },
    } as unknown as ProseMirrorNode

    const matches = findMatchesInDoc(mockDoc, 'SARAH')
    expect(matches.length).toBe(2)
    expect(matches[0]).toEqual({ from: 30, to: 35, text: 'SARAH' })
    expect(matches[1]).toEqual({ from: 70, to: 75, text: 'SARAH' })
  })
})

describe('Character Autocomplete Logic (EDT-004)', () => {
  // 14. Character name cleaning and uppercasing
  it('cleans character names by stripping extensions and uppercasing', () => {
    expect(cleanCharacterName('sarah (V.O.)')).toBe('SARAH')
    expect(cleanCharacterName('mike (O.S.)')).toBe('MIKE')
    expect(cleanCharacterName('detective miller (CONT\'D)')).toBe('DETECTIVE MILLER')
    expect(cleanCharacterName('  john  ')).toBe('JOHN')
    expect(cleanCharacterName('')).toBe('')
  })

  // 15. Extract unique character names from document
  it('extracts unique character names from character cue nodes in document', () => {
    const mockDoc = {
      descendants(fn: (node: any) => boolean) {
        fn({ type: { name: 'sceneHeading' }, textContent: 'INT. OFFICE - DAY' })
        fn({ type: { name: 'character' }, textContent: 'SARAH' })
        fn({ type: { name: 'dialogue' }, textContent: 'Hello?' })
        fn({ type: { name: 'character' }, textContent: 'MIKE (V.O.)' })
        fn({ type: { name: 'character' }, textContent: 'SARAH (CONT\'D)' })
        fn({ type: { name: 'character' }, textContent: 'ALEX', attrs: { name: 'ALEX' } })
        return true
      },
    } as unknown as ProseMirrorNode

    const names = extractCharacterNames(mockDoc)
    expect(names).toEqual(['ALEX', 'MIKE', 'SARAH'])
  })

  // 16. Autocomplete suggestion filtering with prefix priority
  it('ranks prefix matches ahead of substring matches in suggestions', () => {
    const characters = ['SARAH', 'ALEX', 'SAMANTHA', 'BOB', 'LISA', 'JOSHUA']
    const suggestions = filterCharacterSuggestions(characters, 'sa')

    // Both SARAH and SAMANTHA start with 'SA', LISA contains 'SA'
    expect(suggestions[0]).toBe('SARAH')
    expect(suggestions[1]).toBe('SAMANTHA')
    expect(suggestions[2]).toBe('LISA')
    expect(suggestions).not.toContain('BOB')
  })

  // 17. Suggestion filtering respects maxSuggestions limit
  it('respects maxSuggestions limit when returning suggestions', () => {
    const characters = ['SARAH', 'SAM', 'SAMANTHA', 'SAL', 'SAUL', 'SANDY', 'SASHA']
    const suggestions = filterCharacterSuggestions(characters, 'sa', 3)
    expect(suggestions.length).toBe(3)
  })

  // 18. Suggestion filtering returns all characters up to limit when query is empty
  it('returns initial characters when query is empty', () => {
    const characters = ['ALEX', 'BOB', 'CHARLIE', 'DAVE']
    const suggestions = filterCharacterSuggestions(characters, '', 2)
    expect(suggestions).toEqual(['ALEX', 'BOB'])
  })
})
