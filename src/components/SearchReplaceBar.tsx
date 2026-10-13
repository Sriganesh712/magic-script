/**
 * Search and Replace Floating Bar Component (EDT-005)
 * Renders floating search/replace controls with keyboard shortcuts and match counts.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search,
  Replace as ReplaceIcon,
  ChevronDown,
  ChevronUp,
  X,
  CaseSensitive,
  Regex,
} from 'lucide-react'
import type { SearchReplaceStorage } from '@/editor/extensions/SearchReplace'

export interface SearchReplaceBarProps {
  /** Tiptap Editor instance */
  editor: Editor | null
  /** Optional custom class name */
  className?: string
  /** Callback fired when the bar is closed */
  onClose?: () => void
  /** Force visibility override (useful for testing) */
  forceOpen?: boolean
}

export function SearchReplaceBar({
  editor,
  className = '',
  onClose,
  forceOpen = false,
}: SearchReplaceBarProps) {
  const [isOpen, setIsOpen] = useState(forceOpen)
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [totalMatches, setTotalMatches] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const prevIsOpenRef = useRef(isOpen)

  // Synchronize state from editor storage
  const syncFromEditor = useCallback(() => {
    if (!editor) return

    const storage = (editor.storage as unknown as Record<string, unknown>)
      ?.searchReplace as SearchReplaceStorage | undefined

    if (storage) {
      setIsOpen(storage.isOpen || forceOpen)
      setSearchTerm(storage.searchTerm || '')
      setReplaceTerm(storage.replaceTerm || '')
      setCaseSensitive(storage.caseSensitive || false)
      setUseRegex(storage.useRegex || false)
      setCurrentIndex(storage.currentIndex ?? -1)
      setTotalMatches(storage.results?.length || 0)
    }
  }, [editor, forceOpen])

  useEffect(() => {
    syncFromEditor()

    if (!editor) return
    const handleTransaction = () => syncFromEditor()
    editor.on('transaction', handleTransaction)

    return () => {
      editor.off('transaction', handleTransaction)
    }
  }, [editor, syncFromEditor])

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }, 50)
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen])

  // If forceOpen changed
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true)
    }
  }, [forceOpen])

  // Handlers
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (editor?.commands.setSearchTerm) {
      editor.commands.setSearchTerm(value)
    }
  }

  const handleReplaceChange = (value: string) => {
    setReplaceTerm(value)
    if (editor?.commands.setReplaceTerm) {
      editor.commands.setReplaceTerm(value)
    }
  }

  const handleToggleCaseSensitive = () => {
    const next = !caseSensitive
    setCaseSensitive(next)
    if (editor?.commands.setCaseSensitive) {
      editor.commands.setCaseSensitive(next)
    }
  }

  const handleToggleRegex = () => {
    const next = !useRegex
    setUseRegex(next)
    if (editor?.commands.setUseRegex) {
      editor.commands.setUseRegex(next)
    }
  }

  const handleFindNext = () => {
    if (editor?.commands.findNext) {
      editor.commands.findNext(searchTerm)
    }
  }

  const handleFindPrev = () => {
    if (editor?.commands.findPrev) {
      editor.commands.findPrev(searchTerm)
    }
  }

  const handleReplaceOne = () => {
    if (editor?.commands.replaceOne) {
      editor.commands.replaceOne(searchTerm, replaceTerm)
    }
  }

  const handleReplaceAll = () => {
    if (editor?.commands.replaceAll) {
      editor.commands.replaceAll(searchTerm, replaceTerm)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    if (editor?.commands.closeSearch) {
      editor.commands.closeSearch()
    }
    onClose?.()
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        handleFindPrev()
      } else {
        handleFindNext()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    }
  }

  const handleReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.altKey || e.ctrlKey) {
        handleReplaceAll()
      } else {
        handleReplaceOne()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    }
  }

  if (!isOpen) {
    return null
  }

  // Match count text
  let matchCountText = ''
  if (searchTerm) {
    if (totalMatches === 0) {
      matchCountText = '0 of 0'
    } else {
      matchCountText = `${currentIndex >= 0 ? currentIndex + 1 : 0} of ${totalMatches}`
    }
  }

  return (
    <div
      role="search"
      aria-label="Find and replace"
      className={`fixed top-14 right-6 z-50 w-84 sm:w-96 rounded-xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur-md transition-all animate-in fade-in-0 slide-in-from-top-2 duration-150 ${className}`}
    >
      <div className="flex flex-col gap-2">
        {/* Search Row */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Find in screenplay..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search text"
              className="pl-8 pr-16 h-8 text-xs font-mono"
            />
            {matchCountText && (
              <span
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono select-none ${
                  totalMatches === 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'
                }`}
              >
                {matchCountText}
              </span>
            )}
          </div>

          {/* Toggle Buttons */}
          <Button
            type="button"
            variant={caseSensitive ? 'secondary' : 'ghost'}
            size="icon-xs"
            onClick={handleToggleCaseSensitive}
            title="Match Case (Alt+C)"
            aria-label="Toggle case sensitive search"
            aria-pressed={caseSensitive}
            className={`size-7 ${caseSensitive ? 'border border-primary/40 text-primary font-bold' : 'text-muted-foreground'}`}
          >
            <CaseSensitive className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant={useRegex ? 'secondary' : 'ghost'}
            size="icon-xs"
            onClick={handleToggleRegex}
            title="Use Regular Expression (Alt+R)"
            aria-label="Toggle regular expression search"
            aria-pressed={useRegex}
            className={`size-7 ${useRegex ? 'border border-primary/40 text-primary font-bold' : 'text-muted-foreground'}`}
          >
            <Regex className="w-3.5 h-3.5" />
          </Button>

          {/* Previous / Next */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={totalMatches === 0}
            onClick={handleFindPrev}
            title="Previous match (Shift+Enter)"
            aria-label="Previous match"
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={totalMatches === 0}
            onClick={handleFindNext}
            title="Next match (Enter)"
            aria-label="Next match"
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>

          {/* Close */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleClose}
            title="Close (Escape)"
            aria-label="Close search"
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Replace Row */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <ReplaceIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Replace with..."
              value={replaceTerm}
              onChange={(e) => handleReplaceChange(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
              aria-label="Replacement text"
              className="pl-8 h-8 text-xs font-mono"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={totalMatches === 0}
            onClick={handleReplaceOne}
            title="Replace current match"
            className="h-8 px-2 text-xs"
          >
            Replace
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={totalMatches === 0}
            onClick={handleReplaceAll}
            title="Replace all matches"
            className="h-8 px-2 text-xs"
          >
            All
          </Button>
        </div>

        {/* Keyboard hints footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
          <span>
            <kbd className="px-1 py-0.2 bg-muted rounded border border-border">↵</kbd> Next •{' '}
            <kbd className="px-1 py-0.2 bg-muted rounded border border-border">⇧↵</kbd> Prev
          </span>
          <span>
            <kbd className="px-1 py-0.2 bg-muted rounded border border-border">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  )
}

export default SearchReplaceBar
