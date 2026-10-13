/**
 * Character Autocomplete Extension for Screenplay Studio (EDT-004)
 * Provides character cue autocomplete and auto-uppercasing in character nodes.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export const characterAutocompletePluginKey = new PluginKey<CharacterAutocompleteStorage>('characterAutocomplete')

// ============================================================================
// Types
// ============================================================================

export interface CharacterAutocompleteOptions {
  /** Initial or external list of character names */
  characters?: string[]
  /** Maximum suggestions to show in popup */
  maxSuggestions?: number
  /** Whether to automatically uppercase typed characters in character nodes */
  autoUppercase?: boolean
}

export interface CharacterAutocompleteStorage {
  /** Whether the autocomplete popup is currently active */
  active: boolean
  /** The current search query typed so far */
  query: string
  /** Matching character suggestions */
  suggestions: string[]
  /** Index of currently selected item in popup */
  selectedIndex: number
  /** Screen coordinates of the cursor for positioning popup */
  coords: { top: number; bottom: number; left: number; right: number } | null
  /** Complete list of characters collected from doc and options */
  allCharacters: string[]
  /** Start position of the current character node */
  nodePos: number
}

// ============================================================================
// Helper Functions (Pure Logic)
// ============================================================================

/**
 * Extracts all unique character names from a document or node structure.
 * Automatically strips character extensions such as (V.O.), (O.S.), (CONT'D).
 */
export function extractCharacterNames(doc: ProseMirrorNode): string[] {
  if (!doc) return []

  const names = new Set<string>()

  doc.descendants((node) => {
    if (node.type.name === 'character') {
      const text = node.textContent?.trim()
      if (text) {
        const cleanName = cleanCharacterName(text)
        if (cleanName) {
          names.add(cleanName)
        }
      } else if (node.attrs && node.attrs.name) {
        const cleanName = cleanCharacterName(String(node.attrs.name))
        if (cleanName) {
          names.add(cleanName)
        }
      }
    }
    return true
  })

  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

/**
 * Cleans a raw character cue string:
 * Strips parenthetical extensions like (V.O.), (O.S.), (CONT'D) and returns uppercase.
 */
export function cleanCharacterName(rawName: string): string {
  if (!rawName) return ''
  return rawName
    .replace(/\s*\([^)]*\)/g, '')
    .trim()
    .toUpperCase()
}

/**
 * Filters a list of character names by a query prefix/substring.
 * Prefix matches appear first, followed by substring matches.
 */
export function filterCharacterSuggestions(
  characters: string[],
  query: string,
  maxSuggestions = 8
): string[] {
  if (!characters || characters.length === 0) return []

  const q = query.trim().toUpperCase()
  if (!q) {
    return characters.slice(0, maxSuggestions)
  }

  const prefixMatches: string[] = []
  const substringMatches: string[] = []

  for (const name of characters) {
    const upper = name.toUpperCase()
    if (upper === q) {
      // Still include exact match so user can confirm or keep typing
      prefixMatches.push(name)
    } else if (upper.startsWith(q)) {
      prefixMatches.push(name)
    } else if (upper.includes(q)) {
      substringMatches.push(name)
    }
  }

  return [...prefixMatches, ...substringMatches].slice(0, maxSuggestions)
}

// ============================================================================
// Tiptap Command Augmentation
// ============================================================================

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    characterAutocomplete: {
      /** Inserts the specified character name into the active character node */
      insertCharacter: (name: string) => ReturnType
      /** Selects the next suggestion in the list */
      selectNextSuggestion: () => ReturnType
      /** Selects the previous suggestion in the list */
      selectPrevSuggestion: () => ReturnType
      /** Closes the autocomplete popup */
      closeAutocomplete: () => ReturnType
      /** Opens the autocomplete popup for current character node */
      openAutocomplete: () => ReturnType
    }
  }
}

// ============================================================================
// Character Autocomplete Extension
// ============================================================================

export const CharacterAutocomplete = Extension.create<
  CharacterAutocompleteOptions,
  CharacterAutocompleteStorage
>({
  name: 'characterAutocomplete',

  addOptions() {
    return {
      characters: [],
      maxSuggestions: 8,
      autoUppercase: true,
    }
  },

  addStorage() {
    return {
      active: false,
      query: '',
      suggestions: [],
      selectedIndex: 0,
      coords: null,
      allCharacters: [],
      nodePos: 0,
    }
  },

  addCommands() {
    return {
      insertCharacter:
        (name: string) =>
        ({ editor, tr, dispatch }) => {
          const { state } = editor
          const { $from } = state.selection
          const parent = $from.parent

          if (parent.type.name !== 'character') return false

          const start = $from.start()
          const end = $from.end()
          const upperName = cleanCharacterName(name)
          if (!upperName) return false

          if (dispatch) {
            tr.insertText(upperName, start, end)
            tr.setSelection(TextSelection.create(tr.doc, start + upperName.length))

            const storage = this.storage as CharacterAutocompleteStorage
            storage.active = false
            storage.query = ''
            storage.suggestions = []

            dispatch(tr.setMeta(characterAutocompletePluginKey, { closed: true }))
          }
          return true
        },

      selectNextSuggestion:
        () =>
        ({ dispatch }) => {
          const storage = this.storage as CharacterAutocompleteStorage
          if (!storage.active || storage.suggestions.length === 0) return false
          storage.selectedIndex = (storage.selectedIndex + 1) % storage.suggestions.length
          if (dispatch) {
            this.editor.view.dispatch(
              this.editor.state.tr.setMeta(characterAutocompletePluginKey, { update: true })
            )
          }
          return true
        },

      selectPrevSuggestion:
        () =>
        ({ dispatch }) => {
          const storage = this.storage as CharacterAutocompleteStorage
          if (!storage.active || storage.suggestions.length === 0) return false
          storage.selectedIndex =
            (storage.selectedIndex - 1 + storage.suggestions.length) % storage.suggestions.length
          if (dispatch) {
            this.editor.view.dispatch(
              this.editor.state.tr.setMeta(characterAutocompletePluginKey, { update: true })
            )
          }
          return true
        },

      closeAutocomplete:
        () =>
        ({ dispatch }) => {
          const storage = this.storage as CharacterAutocompleteStorage
          storage.active = false
          storage.suggestions = []
          if (dispatch) {
            this.editor.view.dispatch(
              this.editor.state.tr.setMeta(characterAutocompletePluginKey, { closed: true })
            )
          }
          return true
        },

      openAutocomplete:
        () =>
        ({ editor, dispatch }) => {
          const storage = this.storage as CharacterAutocompleteStorage
          const { $from } = editor.state.selection
          if ($from.parent.type.name !== 'character') return false

          const docChars = extractCharacterNames(editor.state.doc)
          const combined = Array.from(
            new Set([...(this.options.characters || []), ...docChars])
          )
          storage.allCharacters = combined
          storage.query = $from.parent.textContent.trim()
          storage.suggestions = filterCharacterSuggestions(
            combined,
            storage.query,
            this.options.maxSuggestions || 8
          )
          storage.active = storage.suggestions.length > 0
          storage.selectedIndex = 0
          try {
            storage.coords = editor.view.coordsAtPos($from.pos)
          } catch {
            storage.coords = null
          }

          if (dispatch) {
            this.editor.view.dispatch(
              this.editor.state.tr.setMeta(characterAutocompletePluginKey, { opened: true })
            )
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: characterAutocompletePluginKey,

        props: {
          handleKeyDown(_view, event) {
            const storage = extension.storage as CharacterAutocompleteStorage
            if (!storage.active || storage.suggestions.length === 0) {
              return false
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault()
              extension.editor.commands.selectNextSuggestion()
              return true
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault()
              extension.editor.commands.selectPrevSuggestion()
              return true
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
              const selected = storage.suggestions[storage.selectedIndex]
              if (selected) {
                event.preventDefault()
                extension.editor.commands.insertCharacter(selected)
                return true
              }
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              extension.editor.commands.closeAutocomplete()
              return true
            }

            return false
          },

          handleTextInput(view, from, to, text) {
            if (!extension.options.autoUppercase) return false
            const { state } = view
            const $from = state.doc.resolve(from)

            if ($from.parent.type.name === 'character') {
              const upper = text.toUpperCase()
              if (upper !== text) {
                view.dispatch(state.tr.insertText(upper, from, to))
                return true
              }
            }
            return false
          },
        },

        view() {
          return {
            update(view) {
              const { state } = view
              const { selection } = state
              const { $from, empty } = selection
              const storage = extension.storage as CharacterAutocompleteStorage

              if (!empty) {
                if (storage.active) {
                  storage.active = false
                }
                return
              }

              const parent = $from.parent
              if (parent.type.name === 'character') {
                const docChars = extractCharacterNames(state.doc)
                const combined = Array.from(
                  new Set([...(extension.options.characters || []), ...docChars])
                )
                storage.allCharacters = combined

                const textBefore = parent.textBetween(0, $from.parentOffset)
                const query = textBefore.trim()
                storage.query = query

                const suggestions = filterCharacterSuggestions(
                  combined,
                  query,
                  extension.options.maxSuggestions || 8
                )

                // If user has already typed the exact character name and it's the only one, hide popup
                if (
                  suggestions.length === 0 ||
                  (suggestions.length === 1 && suggestions[0].toUpperCase() === query.toUpperCase())
                ) {
                  storage.active = false
                  storage.suggestions = []
                } else {
                  storage.active = true
                  storage.suggestions = suggestions
                  if (storage.selectedIndex >= suggestions.length) {
                    storage.selectedIndex = 0
                  }
                  storage.nodePos = $from.start()
                  try {
                    storage.coords = view.coordsAtPos($from.pos)
                  } catch {
                    storage.coords = null
                  }
                }
              } else {
                if (storage.active) {
                  storage.active = false
                  storage.suggestions = []
                }
              }
            },
          }
        },

        appendTransaction(transactions, _oldState, newState) {
          if (!extension.options.autoUppercase) return null
          const docChanged = transactions.some((tr) => tr.docChanged)
          if (!docChanged) return null

          let tr: any = null
          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'character') {
              node.forEach((child, offset) => {
                if (child.isText && child.text) {
                  const upper = child.text.toUpperCase()
                  if (child.text !== upper) {
                    if (!tr) tr = newState.tr
                    tr.insertText(upper, pos + 1 + offset, pos + 1 + offset + child.text.length)
                  }
                }
              })
            }
          })
          return tr
        },
      }),
    ]
  },
})

export default CharacterAutocomplete
