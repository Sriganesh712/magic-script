/**
 * Autosave Hook
 * Debounced saving to IndexedDB via Dexie
 * Handles offline/online recovery
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { Editor } from '@tiptap/react'
import { initDB, getScreenplay, type EntityId, type Timestamp } from '@/lib'

interface AutosaveOptions {
  screenplayId: EntityId
  draftId: EntityId
  projectId: EntityId
  debounceMs?: number
  onSave?: (saved: boolean) => void
  onError?: (error: Error) => void
}

interface AutosaveState {
  isSaving: boolean
  lastSaved: Date | null
  hasUnsavedChanges: boolean
  error: Error | null
}

export function useAutosave(editor: Editor | null, options: AutosaveOptions) {
  const { screenplayId, draftId, projectId, debounceMs = 2000, onSave, onError } = options
  
  const [state, setState] = useState<AutosaveState>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    error: null,
  })
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastContentRef = useRef<string>('')
  const isInitializedRef = useRef(false)
  const saveCountRef = useRef(0)

  // Initialize database
  useEffect(() => {
    let mounted = true
    
    const initialize = async () => {
      try {
        await initDB()
        if (mounted) {
          // Try to recover unsaved content
          await recoverUnsavedContent()
        }
      } catch (error) {
        console.error('[Autosave] Failed to initialize:', error)
        if (mounted && onError) onError(error as Error)
      }
    }
    
    initialize()
    
    return () => {
      mounted = false
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const recoverUnsavedContent = async () => {
    try {
      const existing = await getScreenplay(options.draftId)
      if (existing && editor) {
        const currentHtml = editor.getHTML()
        const existingHtml = JSON.stringify(existing.elements)
        if (currentHtml !== existingHtml) {
          // There's a discrepancy - could show recovery UI
          console.log('[Autosave] Found existing screenplay, checking for differences')
        }
      }
      isInitializedRef.current = true
    } catch (error) {
      console.error('[Autosave] Recovery check failed:', error)
    }
  }

  const save = useCallback(async (force = false) => {
    if (!editor || !isInitializedRef.current) return
    
    const content = editor.getHTML()
    if (!force && content === lastContentRef.current) return
    
    // Check if content actually changed
    const { state: editorState } = editor
    const docSize = editorState.doc.content.size
    if (docSize === 0 && saveCountRef.current === 0) return

    setState(prev => ({ ...prev, isSaving: true, error: null }))
    
    try {
      // Get existing screenplay or create new
      let screenplay = await getScreenplay(draftId)
      
      const now = Date.now() as Timestamp
      
      if (!screenplay) {
        screenplay = {
          id: screenplayId,
          projectId,
          draftId,
          metadata: {
            title: 'Untitled Screenplay',
            author: '',
            draftDate: new Date().toISOString().split('T')[0],
            revisions: [],
          },
          elements: [], // Would be parsed from HTML
          schemaVersion: 1,
          createdAt: now,
          updatedAt: now,
        }
      }
      
      // Update with current content
      screenplay.elements = content as any // In reality, would parse HTML to elements
      screenplay.updatedAt = now
      
      // Save to IndexedDB
      const { db } = await import('@/lib')
      await db.screenplays.put(screenplay)
      
      lastContentRef.current = content
      saveCountRef.current++
      
      setState(prev => ({
        ...prev,
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
      }))
      
      onSave?.(true)
      console.log('[Autosave] Saved successfully at', new Date().toISOString())
    } catch (error) {
      console.error('[Autosave] Save failed:', error)
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: error as Error,
      }))
      onError?.(error as Error)
    }
  }, [editor, screenplayId, draftId, projectId, onSave, onError])

  // Debounced save on editor changes
  useEffect(() => {
    if (!editor) return
    
    const handleUpdate = () => {
      setState(prev => ({ ...prev, hasUnsavedChanges: true }))
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        save()
      }, debounceMs)
    }
    
    editor.on('update', handleUpdate)
    
    return () => {
      editor.off('update', handleUpdate)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [editor, debounceMs, save])

  // Save on window focus/blur for better recovery
  useEffect(() => {
    const handleBeforeUnload = () => {
      save(true) // Force save on unload
    }
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        save(true)
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [save])

  // Manual save function
  const manualSave = useCallback(() => save(true), [save])

  // Export backup
  const exportBackup = useCallback(async () => {
    const { exportAllData } = await import('@/lib')
    return exportAllData()
  }, [])

  // Import backup
  const importBackup = useCallback(async (json: string) => {
    const { importAllData } = await import('@/lib')
    await importAllData(json)
    // Reload editor content if needed
  }, [])

  return {
    ...state,
    save: manualSave,
    exportBackup,
    importBackup,
  }
}

// ============================================================================
// Offline Indicator Hook
// ============================================================================

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setWasOffline(true)
    }
    
    const handleOffline = () => {
      setIsOnline(false)
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, wasOffline }
}

// Re-export RecoveryBanner from separate file
export { RecoveryBanner } from './RecoveryBanner'