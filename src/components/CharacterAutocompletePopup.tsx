/**
 * Character Autocomplete Popup Component (EDT-004)
 * Displays a floating character suggestion dropdown at cursor position
 * with keyboard navigation, click selection, and uppercase names.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { User } from 'lucide-react'
import type { CharacterAutocompleteStorage } from '@/editor/extensions/CharacterAutocomplete'

export interface CharacterAutocompletePopupProps {
  /** Optional Tiptap Editor instance to bind to */
  editor?: Editor | null
  /** Override or standalone active state */
  active?: boolean
  /** List of character suggestions to display */
  items?: string[]
  /** Index of the currently highlighted suggestion */
  selectedIndex?: number
  /** Screen coordinates where popup should be positioned */
  coords?: { top: number; left: number; bottom?: number; right?: number } | null
  /** Callback fired when a character name is selected */
  onSelect?: (characterName: string) => void
  /** Callback fired when the popup is dismissed */
  onClose?: () => void
  /** Additional styling class */
  className?: string
}

export function CharacterAutocompletePopup({
  editor,
  active: propActive,
  items: propItems,
  selectedIndex: propSelectedIndex,
  coords: propCoords,
  onSelect,
  onClose,
  className = '',
}: CharacterAutocompletePopupProps) {
  const [internalActive, setInternalActive] = useState(false)
  const [internalItems, setInternalItems] = useState<string[]>([])
  const [internalIndex, setInternalIndex] = useState(0)
  const [internalCoords, setInternalCoords] = useState<{
    top: number
    left: number
    bottom?: number
    right?: number
  } | null>(null)

  const listRef = useRef<HTMLDivElement>(null)

  // Sync state from editor storage when editor is provided
  const syncFromEditor = useCallback(() => {
    if (!editor) return

    const storage = (editor.storage as unknown as Record<string, unknown>)
      ?.characterAutocomplete as CharacterAutocompleteStorage | undefined

    if (storage) {
      setInternalActive(storage.active || false)
      setInternalItems(storage.suggestions || [])
      setInternalIndex(storage.selectedIndex || 0)
      setInternalCoords(storage.coords || null)
    }
  }, [editor])

  useEffect(() => {
    syncFromEditor()

    if (!editor) return
    const handleTransaction = () => syncFromEditor()
    editor.on('transaction', handleTransaction)

    return () => {
      editor.off('transaction', handleTransaction)
    }
  }, [editor, syncFromEditor])

  // Resolve controlled props vs internal state
  const isActive = propActive !== undefined ? propActive : internalActive
  const items = propItems !== undefined ? propItems : internalItems
  const selectedIndex = propSelectedIndex !== undefined ? propSelectedIndex : internalIndex
  const coords = propCoords !== undefined ? propCoords : internalCoords

  // Keyboard navigation when used as a standalone popup
  useEffect(() => {
    if (!isActive || items.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // If editor exists, editor ProseMirror plugin handles editor keystrokes.
      // But if user focused popup or in standalone mode:
      if (!editor) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setInternalIndex((prev) => (prev + 1) % items.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setInternalIndex((prev) => (prev - 1 + items.length) % items.length)
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          const chosen = items[selectedIndex]
          if (chosen) {
            handleSelect(chosen)
          }
        } else if (e.key === 'Escape') {
          e.preventDefault()
          handleDismiss()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, items, selectedIndex, editor])

  const handleSelect = (name: string) => {
    const clean = name.trim().toUpperCase()
    if (onSelect) {
      onSelect(clean)
    } else if (editor?.commands.insertCharacter) {
      editor.commands.insertCharacter(clean)
    }
  }

  const handleDismiss = () => {
    if (onClose) {
      onClose()
    } else if (editor?.commands.closeAutocomplete) {
      editor.commands.closeAutocomplete()
    }
    setInternalActive(false)
  }

  if (!isActive || items.length === 0) {
    return null
  }

  // Calculate position: default below cursor; flip above if near bottom of screen
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200

  const popupHeight = Math.min(items.length * 32 + 50, 240)
  const popupWidth = 220

  let top = coords ? (coords.bottom || coords.top + 20) + 6 : 100
  let left = coords ? coords.left : 100

  // Flip above cursor if overflowing bottom
  if (coords && coords.bottom && coords.bottom + popupHeight > viewportHeight) {
    top = Math.max(10, coords.top - popupHeight - 6)
  }

  // Constrain within viewport horizontally
  left = Math.max(12, Math.min(left, viewportWidth - popupWidth - 12))

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Character suggestions"
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${popupWidth}px`,
        zIndex: 60,
      }}
      className={`rounded-lg border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/50 border-b border-border/60">
        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
          Characters
        </span>
        <span className="text-[9px] font-mono text-muted-foreground">
          {items.length} {items.length === 1 ? 'match' : 'matches'}
        </span>
      </div>

      {/* Suggestion Items */}
      <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
        {items.map((item, index) => {
          const isSelected = index === selectedIndex
          const upperName = item.toUpperCase()

          return (
            <button
              key={upperName}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(upperName)}
              className={`w-full text-left px-2 py-1.5 text-xs font-mono font-semibold rounded-md flex items-center gap-2 transition-colors cursor-pointer select-none ${
                isSelected
                  ? 'bg-accent text-accent-foreground shadow-xs'
                  : 'text-foreground hover:bg-muted/70'
              }`}
            >
              <User className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="truncate uppercase tracking-wide">{upperName}</span>
            </button>
          )
        })}
      </div>

      {/* Footer navigation tips */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-muted/30 border-t border-border/50 text-[9px] text-muted-foreground select-none">
        <span>
          <kbd className="px-1 py-0.2 bg-muted rounded border border-border">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="px-1 py-0.2 bg-muted rounded border border-border">↵</kbd> select
        </span>
        <span>
          <kbd className="px-1 py-0.2 bg-muted rounded border border-border">Esc</kbd>
        </span>
      </div>
    </div>
  )
}

export default CharacterAutocompletePopup
