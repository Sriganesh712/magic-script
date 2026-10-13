import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import {
  ScreenplayEditor,
  SceneOutlinePanel,
  insertSceneHeading,
  insertAction,
  insertCharacter,
  insertDialogue,
  insertParenthetical,
  insertTransition,
  insertPageBreak,
} from '@/editor'
import { useAutosave, useOnlineStatus, RecoveryBanner } from '@/hooks'
import {
  db,
  initDB,
  generateId,
  type Project,
  type Draft,
  type ScreenplayDocument,
  type EntityId,
  type Timestamp,
  CURRENT_SCHEMA_VERSION,
} from '@/lib'
import {
  exportToPDF,
  exportToFountain,
  exportToFDX,
  htmlToElements,
} from '@/lib/export'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ChevronLeft,
  Save,
  Database,
  FileDown,
  LayoutList,
  WifiOff,
  Sparkles,
  Download,
  Upload,
} from 'lucide-react'
import '@/editor/ScreenplayEditor.css'

const DEFAULT_STARTER_CONTENT = `<p data-type="scene-heading" data-interior="INT" data-location="WRITER'S ROOM" data-time-of-day="DAY">INT. WRITER'S ROOM - DAY</p>
<p data-type="action">A fresh sheet of paper sits in the typewriter. Sunlight streams through Venetian blinds.</p>
<p data-type="character" data-name="WRITER">WRITER</p>
<p data-type="dialogue" data-character-id="writer">Every great story begins with a single word.</p>`

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [screenplay, setScreenplay] = useState<ScreenplayDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [content, setContent] = useState<string>(DEFAULT_STARTER_CONTENT)
  const [wordCount, setWordCount] = useState(0)
  const [showOutline, setShowOutline] = useState(true)
  const [showRecovery, setShowRecovery] = useState(false)
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  // Editor references
  const editorRef = useRef<any>(null)
  const [editorInstance, setEditorInstance] = useState<any>(null)
  const lastSavedContentRef = useRef<string>('')

  const { isOnline, wasOffline } = useOnlineStatus()

  // Load project, draft, and screenplay from DB
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (!projectId) return

      try {
        setIsLoading(true)
        await initDB()

        const pid = projectId as EntityId
        const loadedProj = await db.projects.get(pid)

        if (!loadedProj) {
          if (isMounted) setIsLoading(false)
          return
        }

        if (isMounted) setProject(loadedProj)

        // Find or create current draft
        let currentDraft = await db.drafts
          .where('projectId')
          .equals(pid)
          .and((d) => d.isCurrent)
          .first()

        const now = Date.now() as Timestamp

        if (!currentDraft) {
          const draftId = generateId()
          const screenplayId = generateId()
          currentDraft = {
            id: draftId,
            projectId: pid,
            name: 'First Draft',
            isCurrent: true,
            screenplayId,
            createdAt: now,
            updatedAt: now,
          }
          await db.drafts.add(currentDraft)
        }

        if (isMounted) setDraft(currentDraft)

        // Find or create screenplay document
        let currentScreenplay = await db.screenplays
          .where('draftId')
          .equals(currentDraft.id)
          .first()

        if (!currentScreenplay) {
          currentScreenplay = {
            id: currentDraft.screenplayId || generateId(),
            projectId: pid,
            draftId: currentDraft.id,
            metadata: {
              title: loadedProj.name,
              author: 'Screenplay Studio',
            },
            elements: [],
            schemaVersion: CURRENT_SCHEMA_VERSION,
            createdAt: now,
            updatedAt: now,
          }
          await db.screenplays.add(currentScreenplay)
        }

        if (isMounted) {
          setScreenplay(currentScreenplay)

          // If there's saved content in localStorage or custom metadata, load it
          const storageKey = `screenplay_content_${currentScreenplay.id}`
          const cached = localStorage.getItem(storageKey)
          const initialText = cached || DEFAULT_STARTER_CONTENT
          setContent(initialText)
          lastSavedContentRef.current = initialText

          // Calculate initial words
          const text = initialText.replace(/<[^>]*>/g, ' ')
          const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
          setWordCount(words)
        }
      } catch (err) {
        console.error('[EditorPage] Error loading screenplay data:', err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [projectId])

  // Autosave integration
  const {
    isSaving,
    lastSaved,
    save: manualSave,
    exportBackup,
    importBackup,
  } = useAutosave(editorInstance, {
    screenplayId: (screenplay?.id || generateId()) as EntityId,
    draftId: (draft?.id || generateId()) as EntityId,
    projectId: (project?.id || generateId()) as EntityId,
    debounceMs: 2000,
    onSave: (saved) => {
      if (saved && screenplay?.id) {
        lastSavedContentRef.current = content
        localStorage.setItem(`screenplay_content_${screenplay.id}`, content)
      }
    },
    onError: (err) => {
      console.error('[Autosave Error]', err)
    },
  })

  // Handle editor text change
  const handleChange = useCallback(
    (html: string) => {
      setContent(html)
      if (screenplay?.id) {
        localStorage.setItem(`screenplay_content_${screenplay.id}`, html)
      }
      const text = html.replace(/<[^>]*>/g, ' ')
      const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
      setWordCount(words)
    },
    [screenplay?.id]
  )

  const handleUpdate = useCallback((editor: any) => {
    editorRef.current = editor
    setEditorInstance(editor)
  }, [])

  // Toolbar Element Insertion Actions
  const toolbarActions = {
    scene: () => insertSceneHeading(editorRef.current),
    action: () => insertAction(editorRef.current),
    character: () => insertCharacter(editorRef.current),
    dialogue: () => insertDialogue(editorRef.current),
    parenthetical: () => insertParenthetical(editorRef.current),
    transition: () => insertTransition(editorRef.current),
    pageBreak: () => insertPageBreak(editorRef.current),
  }

  // Real Export Handlers (PDF, Fountain, FDX)
  const handleExport = async (format: 'PDF' | 'Fountain' | 'FDX') => {
    try {
      setExportNotice(`Generating ${format} export...`)
      const elements = htmlToElements(content)
      const doc: ScreenplayDocument = {
        id: screenplay?.id || (generateId() as EntityId),
        projectId: project?.id || (generateId() as EntityId),
        draftId: draft?.id || (generateId() as EntityId),
        metadata: {
          title: project?.name || 'Untitled Screenplay',
          author: screenplay?.metadata?.author || '',
          draftDate: new Date().toISOString().split('T')[0],
          revisions: screenplay?.metadata?.revisions || [],
        },
        elements,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        createdAt: screenplay?.createdAt || (Date.now() as Timestamp),
        updatedAt: Date.now() as Timestamp,
      }

      let blob: Blob
      let filename = `${project?.name || 'screenplay'}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_')

      if (format === 'PDF') {
        blob = await exportToPDF(doc, {
          format: 'pdf',
          includeTitlePage: true,
          includePageNumbers: true,
          includeSceneNumbers: false,
        })
        filename += '.pdf'
      } else if (format === 'Fountain') {
        const text = exportToFountain(doc)
        blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        filename += '.fountain'
      } else {
        const xml = exportToFDX(doc)
        blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
        filename += '.fdx'
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setExportNotice(`Exported ${filename} successfully!`)
      setTimeout(() => setExportNotice(null), 3000)
    } catch (err) {
      console.error(`[Export Error] Failed to export ${format}:`, err)
      setExportNotice(`Export failed: ${(err as Error).message}`)
      setTimeout(() => setExportNotice(null), 5000)
    }
  }

  const handleExportBackup = async () => {
    try {
      const backup = await exportBackup()
      const blob = new Blob([backup], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name || 'screenplay'}-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const json = event.target?.result as string
      importBackup(json)
        .then(() => {
          alert('Backup imported! Reloading editor...')
          window.location.reload()
        })
        .catch((err) => {
          console.error('Import failed:', err)
          alert('Import failed: ' + err.message)
        })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Loading screenplay...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <h2 className="text-xl font-bold text-foreground">Project Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          The requested screenplay project could not be found in local storage.
        </p>
        <Button asChild>
          <Link to="/">Back to Projects</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Offline/Recovery Alert */}
      {(wasOffline || !isOnline) && (
        <Alert className="m-3 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <AlertDescription className="text-amber-700 dark:text-amber-300 flex items-center gap-2 text-xs">
              {!isOnline
                ? 'You are currently offline. Changes are saved locally to IndexedDB.'
                : 'Connection restored. Changes synced locally.'}
              {wasOffline && isOnline && (
                <Button variant="ghost" size="xs" onClick={() => setShowRecovery(true)}>
                  Check unsaved changes
                </Button>
              )}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {showRecovery && (
        <RecoveryBanner
          hasRecovery={true}
          onRecover={() => {
            setShowRecovery(false)
            manualSave()
          }}
          onDismiss={() => setShowRecovery(false)}
        />
      )}

      {/* Export notification banner */}
      {exportNotice && (
        <div className="bg-primary/10 border-b border-primary/20 text-primary text-xs px-4 py-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            {exportNotice}
          </span>
          <button
            onClick={() => setExportNotice(null)}
            className="text-primary hover:underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Editor Header & Toolbar */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-2.5 shadow-xs">
        <div className="max-w-full mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Back Link & Project Title */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="xs" asChild className="gap-1 text-muted-foreground hover:text-foreground">
              <Link to="/">
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Projects</span>
              </Link>
            </Button>

            <Separator orientation="vertical" className="h-4" />

            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-foreground truncate max-w-[200px] sm:max-w-xs">
                {project.name}
              </h1>
              {draft && (
                <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted font-medium hidden sm:inline">
                  {draft.name}
                </span>
              )}
            </div>

            <Separator orientation="vertical" className="h-4 hidden sm:block" />

            {/* Word Count & Save Indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{wordCount.toLocaleString()}</span>
              <span>words</span>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex items-center gap-1">
                {isSaving && <Save className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                {!isSaving && lastSaved && <Database className="w-3.5 h-3.5 text-emerald-500" />}
                <span className="text-[11px]">
                  {isSaving ? 'Saving...' : lastSaved ? `Saved` : 'Draft'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Export, Backup, Save & Outline Toggle */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Outline Toggle */}
            <Button
              variant={showOutline ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setShowOutline(!showOutline)}
              className="gap-1 text-xs"
              title="Toggle Scene Outline (Left Sidebar)"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Outline</span>
            </Button>

            <Separator orientation="vertical" className="h-4 mx-1" />

            {/* Export buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleExport('PDF')}
                className="text-[11px] h-7 px-2"
                title="Export script to Industry Standard PDF"
              >
                <FileDown className="w-3 h-3 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleExport('Fountain')}
                className="text-[11px] h-7 px-2 hidden sm:inline-flex"
                title="Export plain-text Fountain format"
              >
                Fountain
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleExport('FDX')}
                className="text-[11px] h-7 px-2 hidden sm:inline-flex"
                title="Export to Final Draft (FDX)"
              >
                FDX
              </Button>
            </div>

            <Separator orientation="vertical" className="h-4 mx-1" />

            {/* Manual Save Button */}
            <Button
              variant="default"
              size="xs"
              onClick={manualSave}
              disabled={isSaving}
              className="gap-1 text-xs font-semibold shadow-xs"
              title="Save changes (⌘S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </Button>

            {/* Backup options */}
            <Button
              variant="ghost"
              size="xs"
              onClick={handleExportBackup}
              className="text-muted-foreground hover:text-foreground hidden lg:flex"
              title="Export JSON Backup"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
              id="editor-import-backup"
            />
            <Button
              variant="ghost"
              size="xs"
              onClick={() => document.getElementById('editor-import-backup')?.click()}
              className="text-muted-foreground hover:text-foreground hidden lg:flex"
              title="Import JSON Backup"
            >
              <Upload className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Screenplay Element Formatting Quickbar */}
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">
            Insert:
          </span>
          <button
            onClick={toolbarActions.scene}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0"
            title="Scene Heading (⌘⌥1)"
          >
            Scene
          </button>
          <button
            onClick={toolbarActions.action}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0"
            title="Action (⌘⌥2)"
          >
            Action
          </button>
          <button
            onClick={toolbarActions.character}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0"
            title="Character (⌘⌥3)"
          >
            Character
          </button>
          <button
            onClick={toolbarActions.dialogue}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0"
            title="Dialogue (⌘⌥4)"
          >
            Dialogue
          </button>
          <button
            onClick={toolbarActions.parenthetical}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0"
            title="Parenthetical (Tab)"
          >
            Parenthetical
          </button>
          <button
            onClick={toolbarActions.transition}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0"
            title="Transition (⌘⌥5)"
          >
            Transition
          </button>
          <button
            onClick={toolbarActions.pageBreak}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0"
            title="Forced Page Break"
          >
            Page Break
          </button>
        </div>
      </header>

      {/* Main Writing Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Scene Outline Panel */}
        {showOutline && (
          <aside className="w-72 lg:w-80 border-r border-border bg-card/60 flex-shrink-0 hidden lg:block overflow-y-auto">
            <SceneOutlinePanel
              editor={editorRef.current}
              onSceneClick={() => {}}
              onSceneAdd={() =>
                insertSceneHeading(editorRef.current, {
                  interior: 'INT',
                  location: 'NEW LOCATION',
                  timeOfDay: 'DAY',
                })
              }
            />
          </aside>
        )}

        {/* Screenplay Editor Canvas */}
        <main className="flex-1 min-w-0 bg-background overflow-y-auto">
          <ScreenplayEditor
            content={content}
            onChange={handleChange}
            onUpdate={handleUpdate}
            placeholder="Start writing your screenplay... (Press Enter to cycle elements, Tab for parenthetical)"
            autoFocus
          />
        </main>
      </div>

      {/* Screenplay Keyboard Guide Footer */}
      <footer className="bg-card/70 border-t border-border px-4 py-2 text-xs text-muted-foreground hidden md:block">
        <div className="max-w-full mx-auto flex flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">Enter</kbd> Next
              Element
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">Tab</kbd>{' '}
              Parenthetical
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">Shift+Tab</kbd>{' '}
              Outdent
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">⌘⌥1</kbd> Scene
              Heading
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">⌘⌥2</kbd> Action
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">⌘S</kbd> Save
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
