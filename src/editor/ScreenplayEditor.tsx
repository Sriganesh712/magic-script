/**
 * Screenplay Editor - Main Tiptap Editor Component
 * Implements screenplay-aware keyboard behavior (Enter/Tab cycling)
 */

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { 
  screenplayNodes, 
  type ScreenplayNodeNames,
  NEXT_ELEMENT,
  TAB_ELEMENT,
  SHIFT_TAB_ELEMENT
} from './ScreenplayNodes'
import { generateId } from '@/lib/db'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorView } from 'prosemirror-view'

// ============================================================================
// Type Extensions
// ============================================================================

declare global {
  interface Window {
    editorInstance?: ReturnType<typeof useEditor>
  }
}

// ============================================================================
// Screenplay Editor Component
// ============================================================================

interface ScreenplayEditorProps {
  content?: string
  onChange?: (content: string) => void
  onUpdate?: (editor: ReturnType<typeof useEditor>) => void
  editable?: boolean
  placeholder?: string
  autoFocus?: boolean
}

export function ScreenplayEditor({
  content = '',
  onChange,
  onUpdate,
  editable = true,
  placeholder = 'Start writing your screenplay...',
  autoFocus = false,
}: ScreenplayEditorProps) {
  const [, setCharacters] = useState<string[]>([])
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null)
  const isComposing = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        gapcursor: false,
        link: false,
        bold: { HTMLAttributes: { class: 'font-bold' } },
        italic: { HTMLAttributes: { class: 'italic' } },
        underline: { HTMLAttributes: { class: 'underline' } },
        strike: { HTMLAttributes: { class: 'line-through' } },
        code: { HTMLAttributes: { class: 'font-mono text-sm bg-gray-100 dark:bg-gray-800 px-1 rounded' } },
      }),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: 'screenplay-placeholder',
      }),
      ...screenplayNodes,
    ],
    content,
    editable,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      if (onUpdate) onUpdate(editor)
      if (onChange) onChange(editor.getHTML())
    },
    onCreate: ({ editor }) => {
      editorRef.current = editor
      window.editorInstance = editor
    },
    editorProps: {
      attributes: {
        class: 'screenplay-editor prose max-w-none',
        spellcheck: 'true',
      },
      handleKeyDown: handleKeyDown,
      handlePaste: handlePaste,
      handleDrop: handleDrop,
    },
  })

  // ============================================================================
  // Keyboard Handling - Screenplay-Aware Enter/Tab Behavior
  // ============================================================================

  function handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
    if (isComposing.current) return false

    const { state } = view
    const { selection } = state
    const { $from, empty } = selection
    const commands = editor?.commands
    if (!commands) return false

    // Only handle keyboard shortcuts when not in an inline mark
    if (!empty) return false

    const currentNode = $from.parent
    const currentType = currentNode.type.name as ScreenplayNodeNames

    // Handle Enter key - cycle to next element type
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Special handling for empty nodes
      if (currentNode.content.size === 0) {
        // Empty scene heading -> action
        if (currentType === 'sceneHeading') {
          event.preventDefault()
          return commands.setNode('action', { id: generateId() })
        }
        // Empty action -> action (stay)
        if (currentType === 'action') {
          event.preventDefault()
          return commands.setNode('action', { id: generateId() })
        }
        // Empty character -> dialogue
        if (currentType === 'character') {
          event.preventDefault()
          return commands.setNode('dialogue', { id: generateId(), characterId: currentNode.attrs.characterId })
        }
        // Empty dialogue -> character (next speaker)
        if (currentType === 'dialogue') {
          event.preventDefault()
          return commands.setNode('character', { id: generateId() })
        }
        // Empty parenthetical -> dialogue
        if (currentType === 'parenthetical') {
          event.preventDefault()
          return commands.setNode('dialogue', { id: generateId(), characterId: currentNode.attrs.characterId })
        }
        // Empty transition -> scene heading
        if (currentType === 'transition') {
          event.preventDefault()
          return commands.setNode('sceneHeading', { id: generateId(), interior: 'INT', location: '', timeOfDay: '' })
        }
      }

      // Non-empty nodes: split and create next element
      const nextType = NEXT_ELEMENT[currentType]
      if (nextType) {
        event.preventDefault()
        // Split the current block and create next element
        return commands.splitBlock() && commands.setNode(nextType, getNextElementAttrs(nextType, currentNode))
      }
      return false
    }

    // Handle Tab key - indent (character -> parenthetical, dialogue -> parenthetical)
    if (event.key === 'Tab' && !event.shiftKey) {
      const tabType = TAB_ELEMENT[currentType]
      if (tabType) {
        event.preventDefault()
        const attrs = getNextElementAttrs(tabType, currentNode)
        return commands.setNode(tabType, attrs)
      }
      return false
    }

    // Handle Shift+Tab - outdent (dialogue -> character, parenthetical -> dialogue)
    if (event.key === 'Tab' && event.shiftKey) {
      const shiftTabType = SHIFT_TAB_ELEMENT[currentType]
      if (shiftTabType) {
        event.preventDefault()
        const attrs = getNextElementAttrs(shiftTabType, currentNode)
        return commands.setNode(shiftTabType, attrs)
      }
      return false
    }

    // Handle Escape - exit current element to action
    if (event.key === 'Escape') {
      if (currentType !== 'action' && currentType !== 'sceneHeading') {
        event.preventDefault()
        return commands.setNode('action', { id: generateId() })
      }
      return false
    }

    return false
  }

  // ============================================================================
  // Paste Handling - Strip unwanted formatting
  // ============================================================================

  function handlePaste(view: EditorView, event: ClipboardEvent): boolean {
    event.preventDefault()
    const text = event.clipboardData?.getData('text/plain') || ''
    // Insert as plain text at current position
    view.dispatch(view.state.tr.insertText(text))
    return true
  }

  // ============================================================================
  // Drop Handling
  // ============================================================================

  function handleDrop(view: EditorView, event: DragEvent): boolean {
    event.preventDefault()
    const text = event.dataTransfer?.getData('text/plain') || ''
    if (text) {
      view.dispatch(view.state.tr.insertText(text))
    }
    return true
  }

  // ============================================================================
  // Helper: Get attributes for next element based on current context
  // ============================================================================

  function getNextElementAttrs(nextType: ScreenplayNodeNames, currentNode: any): Record<string, any> {
    const baseAttrs = { id: generateId() }

    switch (nextType) {
      case 'dialogue':
        return {
          ...baseAttrs,
          characterId: currentNode.attrs.characterId || generateId(),
        }
      case 'parenthetical':
        return {
          ...baseAttrs,
          characterId: currentNode.attrs.characterId || generateId(),
        }
      case 'character':
        return baseAttrs
      case 'sceneHeading':
        return {
          ...baseAttrs,
          interior: 'INT',
          location: '',
          timeOfDay: '',
        }
      case 'action':
      case 'transition':
      case 'shot':
      case 'section':
        return baseAttrs
      default:
        return baseAttrs
    }
  }

  // ============================================================================
  // Character Autocomplete (triggered by @ or character name)
  // ============================================================================

  useEffect(() => {
    if (!editor) return

    const updateCharacters = () => {
      const chars = new Set<string>()
      editor.state.doc.descendants((node: any) => {
        if (node.type.name === 'character' && node.attrs.name) {
          chars.add(node.attrs.name)
        }
      })
      setCharacters(Array.from(chars))
    }

    updateCharacters()
    editor.on('transaction', updateCharacters)

    return () => {
      editor.off('transaction', updateCharacters)
    }
  }, [editor])

  // ============================================================================
  // Render
  // ============================================================================

  if (!editor) {
    return null
  }

  return (
    <div className="screenplay-editor-container">
      <EditorContent editor={editor} />
    </div>
  )
}

// ============================================================================
// Helper Hook for Editor Instance
// ============================================================================

export function useScreenplayEditor() {
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null)

  const setEditor = useCallback((editor: ReturnType<typeof useEditor>) => {
    editorRef.current = editor
  }, [])

  const getEditor = useCallback(() => editorRef.current, [])

  return { setEditor, getEditor }
}

// ============================================================================
// Command Helpers
// ============================================================================

export function insertSceneHeading(editor: ReturnType<typeof useEditor> | undefined, attrs?: { interior?: string; location?: string; timeOfDay?: string }) {
  if (!editor) return false
  return editor.chain().focus().setNode('sceneHeading', {
    id: generateId(),
    interior: attrs?.interior || 'INT',
    location: attrs?.location || '',
    timeOfDay: attrs?.timeOfDay || '',
  }).run()
}

export function insertAction(editor: ReturnType<typeof useEditor> | undefined) {
  if (!editor) return false
  return editor.chain().focus().setNode('action', { id: generateId() }).run()
}

export function insertCharacter(editor: ReturnType<typeof useEditor> | undefined, name?: string) {
  if (!editor) return false
  return editor.chain().focus().setNode('character', {
    id: generateId(),
    name: name || '',
  }).run()
}

export function insertDialogue(editor: ReturnType<typeof useEditor> | undefined, characterId?: string) {
  if (!editor) return false
  return editor.chain().focus().setNode('dialogue', {
    id: generateId(),
    characterId: characterId || generateId(),
  }).run()
}

export function insertParenthetical(editor: ReturnType<typeof useEditor> | undefined, characterId?: string) {
  if (!editor) return false
  return editor.chain().focus().setNode('parenthetical', {
    id: generateId(),
    characterId: characterId || generateId(),
  }).run()
}

export function insertTransition(editor: ReturnType<typeof useEditor> | undefined, type?: string) {
  if (!editor) return false
  return editor.chain().focus().setNode('transition', {
    id: generateId(),
    transitionType: type || 'CUT_TO',
  }).run()
}

export function insertPageBreak(editor: ReturnType<typeof useEditor> | undefined) {
  if (!editor) return false
  return editor.chain().focus().setNode('pageBreak', { id: generateId(), forced: true }).run()
}