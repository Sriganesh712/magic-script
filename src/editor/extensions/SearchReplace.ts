/**
 * Search and Replace Extension for Screenplay Studio (EDT-005)
 * Provides in-editor text searching, regex search, match navigation,
 * single/all replacement, and highlight decorations.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export const searchReplacePluginKey = new PluginKey<DecorationSet>('searchReplace')

// ============================================================================
// Types
// ============================================================================

export interface SearchMatch {
  from: number
  to: number
  text?: string
}

export interface SearchOptions {
  caseSensitive?: boolean
  useRegex?: boolean
}

export interface SearchReplaceOptions {
  searchTerm?: string
  replaceTerm?: string
  caseSensitive?: boolean
  useRegex?: boolean
  searchResultClass?: string
  searchResultCurrentClass?: string
  disableDecorations?: boolean
}

export interface SearchReplaceStorage {
  /** The current search query string */
  searchTerm: string
  /** The current replacement string */
  replaceTerm: string
  /** Whether search is case-sensitive */
  caseSensitive: boolean
  /** Whether search interprets search term as a regular expression */
  useRegex: boolean
  /** Whether the search bar/overlay is open */
  isOpen: boolean
  /** 0-based index of current match (-1 if none) */
  currentIndex: number
  /** All current match ranges in the document */
  results: SearchMatch[]
}

// ============================================================================
// Pure Search/Replace Logic (Unit-testable)
// ============================================================================

/**
 * Searches for matches in plain text string.
 * Supports case-sensitive and regex matching safely.
 */
export function findMatchesInText(
  text: string,
  query: string,
  options: SearchOptions = {}
): SearchMatch[] {
  if (!query || !text) return []

  const { caseSensitive = false, useRegex = false } = options
  let regex: RegExp

  try {
    if (useRegex) {
      regex = new RegExp(query, caseSensitive ? 'g' : 'gi')
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi')
    }
  } catch {
    return []
  }

  const matches: SearchMatch[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex++
      continue
    }
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      text: match[0],
    })
  }

  return matches
}

/**
 * Performs replacement on plain text string.
 * Supports single replace, target index replace, or replace all.
 */
export function replaceInText(
  text: string,
  query: string,
  replacement: string,
  options: SearchOptions & { replaceAll?: boolean; targetIndex?: number } = {}
): string {
  if (!query || !text) return text

  const { replaceAll = false, targetIndex, caseSensitive = false, useRegex = false } = options

  if (replaceAll) {
    try {
      const regex = useRegex
        ? new RegExp(query, caseSensitive ? 'g' : 'gi')
        : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi')
      return text.replace(regex, replacement)
    } catch {
      return text
    }
  }

  const matches = findMatchesInText(text, query, options)
  if (matches.length === 0) return text

  const idx =
    targetIndex !== undefined && targetIndex >= 0 && targetIndex < matches.length
      ? targetIndex
      : 0

  const match = matches[idx]
  return text.slice(0, match.from) + replacement + text.slice(match.to)
}

/**
 * Searches for matches across text nodes in a ProseMirror document.
 */
export function findMatchesInDoc(
  doc: ProseMirrorNode,
  query: string,
  options: SearchOptions = {}
): SearchMatch[] {
  if (!query || !doc) return []

  const { caseSensitive = false, useRegex = false } = options
  let regex: RegExp

  try {
    if (useRegex) {
      regex = new RegExp(query, caseSensitive ? 'g' : 'gi')
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi')
    }
  } catch {
    return []
  }

  const matches: SearchMatch[] = []

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = regex.exec(node.text)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++
          continue
        }
        matches.push({
          from: pos + match.index,
          to: pos + match.index + match[0].length,
          text: match[0],
        })
      }
    }
    return true
  })

  return matches
}

// ============================================================================
// Tiptap Commands Augmentation
// ============================================================================

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      /** Opens or closes the search panel */
      toggleSearch: () => ReturnType
      /** Opens the search panel */
      openSearch: () => ReturnType
      /** Closes the search panel and clears highlights */
      closeSearch: () => ReturnType
      /** Updates the search query string */
      setSearchTerm: (searchTerm: string) => ReturnType
      /** Updates the replacement string */
      setReplaceTerm: (replaceTerm: string) => ReturnType
      /** Toggles or sets case-sensitive searching */
      setCaseSensitive: (caseSensitive: boolean) => ReturnType
      /** Toggles or sets regular expression searching */
      setUseRegex: (useRegex: boolean) => ReturnType
      /** Navigates to the next match */
      findNext: (query?: string) => ReturnType
      /** Navigates to the previous match */
      findPrev: (query?: string) => ReturnType
      /** Replaces the current match */
      replaceOne: (query?: string, replacement?: string) => ReturnType
      /** Replaces all matches in the document */
      replaceAll: (query?: string, replacement?: string) => ReturnType
    }
  }
}

// ============================================================================
// SearchReplace Extension
// ============================================================================

export const SearchReplace = Extension.create<SearchReplaceOptions, SearchReplaceStorage>({
  name: 'searchReplace',

  addOptions() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      useRegex: false,
      searchResultClass: 'search-match',
      searchResultCurrentClass: 'search-match search-match-current',
      disableDecorations: false,
    }
  },

  addStorage() {
    return {
      searchTerm: this.options.searchTerm || '',
      replaceTerm: this.options.replaceTerm || '',
      caseSensitive: this.options.caseSensitive || false,
      useRegex: this.options.useRegex || false,
      isOpen: false,
      currentIndex: -1,
      results: [],
    }
  },

  addCommands() {
    return {
      toggleSearch:
        () =>
        ({ editor, tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          storage.isOpen = !storage.isOpen

          if (!storage.isOpen) {
            storage.results = []
            storage.currentIndex = -1
          } else {
            if (storage.searchTerm) {
              storage.results = findMatchesInDoc(editor.state.doc, storage.searchTerm, {
                caseSensitive: storage.caseSensitive,
                useRegex: storage.useRegex,
              })
              storage.currentIndex = storage.results.length > 0 ? 0 : -1
            }
          }

          if (dispatch) {
            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },

      openSearch:
        () =>
        ({ editor, tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          storage.isOpen = true

          if (storage.searchTerm) {
            storage.results = findMatchesInDoc(editor.state.doc, storage.searchTerm, {
              caseSensitive: storage.caseSensitive,
              useRegex: storage.useRegex,
            })
            storage.currentIndex = storage.results.length > 0 ? 0 : -1
          }

          if (dispatch) {
            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },

      closeSearch:
        () =>
        ({ tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          storage.isOpen = false
          storage.results = []
          storage.currentIndex = -1

          if (dispatch) {
            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },

      setSearchTerm:
        (searchTerm: string) =>
        ({ editor, tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          storage.searchTerm = searchTerm
          storage.results = findMatchesInDoc(editor.state.doc, searchTerm, {
            caseSensitive: storage.caseSensitive,
            useRegex: storage.useRegex,
          })
          storage.currentIndex = storage.results.length > 0 ? 0 : -1

          if (dispatch) {
            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },

      setReplaceTerm:
        (replaceTerm: string) =>
        ({ tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          storage.replaceTerm = replaceTerm

          if (dispatch) {
            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },

      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor, tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          storage.caseSensitive = caseSensitive
          storage.results = findMatchesInDoc(editor.state.doc, storage.searchTerm, {
            caseSensitive,
            useRegex: storage.useRegex,
          })
          storage.currentIndex = storage.results.length > 0 ? 0 : -1

          if (dispatch) {
            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },

      setUseRegex:
        (useRegex: boolean) =>
        ({ editor, tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          storage.useRegex = useRegex
          storage.results = findMatchesInDoc(editor.state.doc, storage.searchTerm, {
            caseSensitive: storage.caseSensitive,
            useRegex,
          })
          storage.currentIndex = storage.results.length > 0 ? 0 : -1

          if (dispatch) {
            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },

      findNext:
        (query?: string) =>
        ({ editor, tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          if (query !== undefined && query !== storage.searchTerm) {
            storage.searchTerm = query
            storage.results = findMatchesInDoc(editor.state.doc, query, {
              caseSensitive: storage.caseSensitive,
              useRegex: storage.useRegex,
            })
            storage.currentIndex = -1
          }

          if (storage.results.length === 0) return false

          storage.currentIndex = (storage.currentIndex + 1) % storage.results.length
          const match = storage.results[storage.currentIndex]

          if (dispatch && match) {
            tr.setSelection(TextSelection.create(editor.state.doc, match.from, match.to))
            tr.scrollIntoView()
            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },

      findPrev:
        (query?: string) =>
        ({ editor, tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          if (query !== undefined && query !== storage.searchTerm) {
            storage.searchTerm = query
            storage.results = findMatchesInDoc(editor.state.doc, query, {
              caseSensitive: storage.caseSensitive,
              useRegex: storage.useRegex,
            })
            storage.currentIndex = storage.results.length
          }

          if (storage.results.length === 0) return false

          storage.currentIndex =
            (storage.currentIndex - 1 + storage.results.length) % storage.results.length
          const match = storage.results[storage.currentIndex]

          if (dispatch && match) {
            tr.setSelection(TextSelection.create(editor.state.doc, match.from, match.to))
            tr.scrollIntoView()
            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },

      replaceOne:
        (query?: string, replacement?: string) =>
        ({ editor, tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          const q = query !== undefined ? query : storage.searchTerm
          const r = replacement !== undefined ? replacement : storage.replaceTerm
          if (!q) return false

          if (storage.results.length === 0 || storage.currentIndex < 0) {
            storage.results = findMatchesInDoc(editor.state.doc, q, {
              caseSensitive: storage.caseSensitive,
              useRegex: storage.useRegex,
            })
            if (storage.results.length === 0) return false
            storage.currentIndex = 0
          }

          const match = storage.results[storage.currentIndex]
          if (!match) return false

          if (dispatch) {
            tr.insertText(r, match.from, match.to)

            // Recompute next matches immediately on updated doc
            const newDoc = tr.doc
            const newMatches = findMatchesInDoc(newDoc, q, {
              caseSensitive: storage.caseSensitive,
              useRegex: storage.useRegex,
            })

            storage.results = newMatches
            if (newMatches.length === 0) {
              storage.currentIndex = -1
            } else {
              if (storage.currentIndex >= newMatches.length) {
                storage.currentIndex = 0
              }
              const nextMatch = newMatches[storage.currentIndex]
              if (nextMatch) {
                tr.setSelection(TextSelection.create(newDoc, nextMatch.from, nextMatch.to))
                tr.scrollIntoView()
              }
            }

            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },

      replaceAll:
        (query?: string, replacement?: string) =>
        ({ editor, tr, dispatch }) => {
          const storage = this.storage as SearchReplaceStorage
          const q = query !== undefined ? query : storage.searchTerm
          const r = replacement !== undefined ? replacement : storage.replaceTerm
          if (!q) return false

          const matches = findMatchesInDoc(editor.state.doc, q, {
            caseSensitive: storage.caseSensitive,
            useRegex: storage.useRegex,
          })
          if (matches.length === 0) return false

          if (dispatch) {
            // Replace in reverse order so character offsets before each match remain unchanged
            for (let i = matches.length - 1; i >= 0; i--) {
              tr.insertText(r, matches[i].from, matches[i].to)
            }
            storage.results = []
            storage.currentIndex = -1
            dispatch(tr.setMeta(searchReplacePluginKey, { update: true }))
          }
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-f': () => this.editor.commands.toggleSearch(),
      Escape: () => {
        const storage = this.storage as SearchReplaceStorage
        if (storage.isOpen) {
          return this.editor.commands.closeSearch()
        }
        return false
      },
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: searchReplacePluginKey,

        state: {
          init() {
            return DecorationSet.empty
          },

          apply(tr, _oldSet, _oldState, newState) {
            const storage = extension.storage as SearchReplaceStorage

            if (extension.options.disableDecorations || !storage.isOpen || !storage.searchTerm) {
              return DecorationSet.empty
            }

            if (tr.docChanged) {
              storage.results = findMatchesInDoc(newState.doc, storage.searchTerm, {
                caseSensitive: storage.caseSensitive,
                useRegex: storage.useRegex,
              })
              if (storage.currentIndex >= storage.results.length) {
                storage.currentIndex = storage.results.length > 0 ? 0 : -1
              }
            }

            if (storage.results.length === 0) {
              return DecorationSet.empty
            }

            const decos = storage.results.map((res, index) => {
              const isCurrent = index === storage.currentIndex
              const className = isCurrent
                ? extension.options.searchResultCurrentClass || 'search-match search-match-current'
                : extension.options.searchResultClass || 'search-match'

              return Decoration.inline(res.from, res.to, { class: className })
            })

            return DecorationSet.create(newState.doc, decos)
          },
        },

        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

export default SearchReplace
