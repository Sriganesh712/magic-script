import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
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
import {
  CharacterPanel,
  LocationPanel,
  NotesPanel,
  RevisionPanel,
} from '@/components/production'
import { useAutosave, useOnlineStatus, RecoveryBanner } from '@/hooks'
import {
  db,
  initDB,
  generateId,
  type Project,
  type ProjectStatus,
  type Draft,
  type ScreenplayDocument,
  type EntityId,
  type Timestamp,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_PAGE_FORMAT,
} from '@/lib'
import {
  exportToPDF,
  exportToFountain,
  exportToFDX,
  htmlToElements,
} from '@/lib/export'
import {
  getDriveAuthState,
  uploadToGoogleDrive,
} from '@/lib/drive'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Clapperboard,
  Users,
  MapPin,
  StickyNote,
  History,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import '@/editor/ScreenplayEditor.css'

const DEFAULT_STARTER_CONTENT = `<p data-type="scene-heading" data-interior="INT" data-location="WRITER'S ROOM" data-time-of-day="DAY">INT. WRITER'S ROOM - DAY</p>
<p data-type="action">A fresh sheet of paper sits in the typewriter. Sunlight streams through Venetian blinds.</p>
<p data-type="character" data-name="WRITER">WRITER</p>
<p data-type="dialogue" data-character-id="writer">Every great story begins with a single word.</p>`

type SidebarTab = 'outline' | 'characters' | 'locations' | 'notes' | 'revisions'

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [screenplay, setScreenplay] = useState<ScreenplayDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [content, setContent] = useState<string>(DEFAULT_STARTER_CONTENT)
  const [wordCount, setWordCount] = useState(0)
  const [showSidebar, setShowSidebar] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('outline')
  const [showRecovery, setShowRecovery] = useState(false)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [cloudNotice, setCloudNotice] = useState<{
    type: 'loading' | 'success' | 'error'
    message: string
    link?: string
  } | null>(null)
  const [exportingFormat, setExportingFormat] = useState<'PDF' | 'Fountain' | 'FDX' | null>(null)

  const editorRef = useRef<any>(null)
  const [editorInstance, setEditorInstance] = useState<any>(null)
  const lastSavedContentRef = useRef<string>('')
  const lastSavedWordCountRef = useRef<number>(0)

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

          const storageKey = `screenplay_content_${currentScreenplay.id}`
          const cached = localStorage.getItem(storageKey)
          const initialText = cached || DEFAULT_STARTER_CONTENT
          setContent(initialText)
          lastSavedContentRef.current = initialText

          const text = initialText.replace(/<[^>]*>/g, ' ')
          const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
          setWordCount(words)
          lastSavedWordCountRef.current = words
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
    onSave: async (saved) => {
      if (saved && screenplay?.id) {
        lastSavedContentRef.current = content
        localStorage.setItem(`screenplay_content_${screenplay.id}`, content)

        if (project?.id) {
          const prevWords = lastSavedWordCountRef.current
          const diff = wordCount - prevWords

          if (diff !== 0) {
            const wordsAdded = Math.max(0, diff)
            const wordsDeleted = Math.max(0, -diff)
            const today = new Date().toISOString().split('T')[0]
            const nowTs = Date.now() as Timestamp

            try {
              // 1. Record writing session in IndexedDB
              await db.writingSessions.add({
                id: generateId(),
                projectId: project.id,
                draftId: (draft?.id || generateId()) as EntityId,
                startTime: nowTs,
                endTime: nowTs,
                wordsAdded,
                wordsDeleted,
                netWords: diff,
                countsForStreak: wordsAdded > 0,
                state: 'completed',
              })

              // 2. Record or update daily stats
              const existingStat = await db.dailyStats
                .where('projectId')
                .equals(project.id)
                .filter((s) => s.date === today)
                .first()

              if (existingStat && existingStat.id) {
                await db.dailyStats.update(existingStat.id, {
                  wordsAdded: (existingStat.wordsAdded || 0) + wordsAdded,
                  wordsDeleted: (existingStat.wordsDeleted || 0) + wordsDeleted,
                  netWords: (existingStat.netWords || 0) + diff,
                  sessionCount: (existingStat.sessionCount || 0) + 1,
                })
              } else {
                await db.dailyStats.add({
                  id: generateId(),
                  projectId: project.id,
                  date: today,
                  wordsAdded,
                  wordsDeleted,
                  netWords: diff,
                  sessionCount: 1,
                  totalSessionTime: 60000,
                  goalsMet: [],
                  isWritingDay: wordsAdded > 0,
                })
              }

              lastSavedWordCountRef.current = wordCount

              // 3. Dispatch real-time cross-component and cross-tab update
              window.dispatchEvent(
                new CustomEvent('screenplay:data-changed', {
                  detail: { projectId: project.id, words: wordCount, diff },
                })
              )
            } catch (err) {
              console.warn('[Analytics] Failed to record writing session:', err)
            }
          }
        }
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

  // Restore snapshot handler
  const handleRestoreContent = useCallback(
    (html: string) => {
      setContent(html)
      if (screenplay?.id) {
        localStorage.setItem(`screenplay_content_${screenplay.id}`, html)
      }
      if (editorRef.current) {
        editorRef.current.commands.setContent(html)
      }
      const text = html.replace(/<[^>]*>/g, ' ')
      const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
      setWordCount(words)
    },
    [screenplay?.id]
  )

  // Screenplay elements memo for production panels
  const screenplayElements = useMemo(() => htmlToElements(content), [content])

  // Project status change handler (REV-006)
  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!project) return
    const updated: Project = {
      ...project,
      status: newStatus,
      updatedAt: Date.now() as Timestamp,
    }
    await db.projects.put(updated)
    setProject(updated)
  }

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
    if (exportingFormat) return // Prevent duplicate concurrent exports
    setExportingFormat(format)
    setExportNotice(`Generating ${format} export...`)

    try {
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
      const baseTitle = project?.name?.trim() || 'screenplay'
      const safeTitle = baseTitle.replace(/[/\\?%*:|"<>]/g, '_').toLowerCase().replace(/\s+/g, '_')
      let filename = safeTitle

      if (format === 'PDF') {
        blob = await exportToPDF(doc, {
          format: 'pdf',
          pageFormat: {
            ...DEFAULT_PAGE_FORMAT,
            paperSize: project?.settings?.pageFormat?.paperSize || 'US_LETTER',
          },
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

      // 1. Preserve local PDF export: always download locally first
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setExportNotice(`Exported ${filename} locally!`)
      setTimeout(() => setExportNotice(null), 4000)

      // 2. Google Drive Cloud Backup (if connected)
      const driveAuth = getDriveAuthState()
      if (driveAuth.isConnected && driveAuth.accessToken) {
        setCloudNotice({
          type: 'loading',
          message: `Backing up ${filename} to Google Drive ('Screenplay Studio' folder)...`,
        })

        try {
          // Upload exact same blob to Screenplay Studio folder in Drive
          const uploadRes = await uploadToGoogleDrive({
            filename,
            blob,
            format,
            projectId: project?.id,
          })

          // Verify upload confirmation from Google Drive API
          if (uploadRes && uploadRes.id) {
            setCloudNotice({
              type: 'success',
              message: `Backed up to Google Drive ('Screenplay Studio' folder)!`,
              link: uploadRes.webViewLink,
            })
            setTimeout(() => setCloudNotice(null), 7000)
          } else {
            throw new Error('Google Drive upload could not be verified (missing file ID).')
          }
        } catch (cloudErr: any) {
          // Keep local export working, display separate cloud upload error
          const msg = cloudErr?.message || 'Google Drive backup failed'
          console.error('[Google Drive Backup Error]', msg)
          setCloudNotice({
            type: 'error',
            message: `Google Drive backup failed: ${msg}`,
          })
          setTimeout(() => setCloudNotice(null), 8000)
        }
      }
    } catch (err) {
      console.error(`[Export Error] Failed to export ${format}:`, err)
      setExportNotice(`Export failed: ${(err as Error).message}`)
      setTimeout(() => setExportNotice(null), 5000)
    } finally {
      setExportingFormat(null)
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

      {/* Local Export notification banner */}
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

      {/* Cloud Backup notification banner (Google Drive) */}
      {cloudNotice && (
        <div
          className={`border-b text-xs px-4 py-2 flex items-center justify-between transition-colors ${
            cloudNotice.type === 'loading'
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
              : cloudNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
          }`}
        >
          <span className="flex items-center gap-2">
            {cloudNotice.type === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {cloudNotice.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {cloudNotice.type === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
            <span>{cloudNotice.message}</span>
            {cloudNotice.link && (
              <a
                href={cloudNotice.link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline ml-1 inline-flex items-center gap-0.5 hover:opacity-80 font-medium"
              >
                Open in Drive <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </span>
          <button
            onClick={() => setCloudNotice(null)}
            className="hover:underline font-semibold opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Editor Header & Toolbar */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-2.5 shadow-xs">
        <div className="max-w-full mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Back Link, Title, Status Selector (REV-006) */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="xs" asChild className="gap-1 text-muted-foreground hover:text-foreground">
              <Link to="/">
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Projects</span>
              </Link>
            </Button>

            <Separator orientation="vertical" className="h-4" />

            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-foreground truncate max-w-[180px] sm:max-w-xs">
                {project.name}
              </h1>

              {/* Status Selector */}
              <Select value={project.status} onValueChange={(val: any) => handleStatusChange(val)}>
                <SelectTrigger className="h-6 text-[11px] px-2 font-medium bg-muted/60 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concept">Concept</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                  <SelectItem value="drafting">Drafting</SelectItem>
                  <SelectItem value="polishing">Polishing</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              {draft && (
                <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted font-medium hidden md:inline">
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

          {/* Right: Sidebar Toggle, Exports, Save, Backups */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Production Tools Sidebar Toggle */}
            <Button
              variant={showSidebar ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setShowSidebar(!showSidebar)}
              className="gap-1 text-xs"
              title="Toggle Production Tools Sidebar"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tools</span>
            </Button>

            <Separator orientation="vertical" className="h-4 mx-1" />

            {/* Export buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleExport('PDF')}
                disabled={exportingFormat !== null}
                className="text-[11px] h-7 px-2"
                title="Export script to Industry Standard PDF"
              >
                {exportingFormat === 'PDF' ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin text-blue-500" />
                ) : (
                  <FileDown className="w-3 h-3 mr-1" />
                )}
                {exportingFormat === 'PDF' ? 'Exporting...' : 'PDF'}
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleExport('Fountain')}
                disabled={exportingFormat !== null}
                className="text-[11px] h-7 px-2 hidden sm:inline-flex"
                title="Export plain-text Fountain format"
              >
                {exportingFormat === 'Fountain' && (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin text-blue-500" />
                )}
                Fountain
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleExport('FDX')}
                disabled={exportingFormat !== null}
                className="text-[11px] h-7 px-2 hidden sm:inline-flex"
                title="Export to Final Draft (FDX)"
              >
                {exportingFormat === 'FDX' && (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin text-blue-500" />
                )}
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
        {/* Production Tools Multi-Tab Sidebar */}
        {showSidebar && (
          <aside className="w-80 lg:w-96 border-r border-border bg-card/60 flex flex-col flex-shrink-0 hidden lg:flex overflow-hidden">
            {/* Sidebar Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1.5 shrink-0 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1">
                <Button
                  variant={sidebarTab === 'outline' ? 'secondary' : 'ghost'}
                  size="xs"
                  onClick={() => setSidebarTab('outline')}
                  className="text-xs h-7 px-2 gap-1"
                >
                  <Clapperboard className="w-3.5 h-3.5" />
                  <span>Scenes</span>
                </Button>
                <Button
                  variant={sidebarTab === 'characters' ? 'secondary' : 'ghost'}
                  size="xs"
                  onClick={() => setSidebarTab('characters')}
                  className="text-xs h-7 px-2 gap-1"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Characters</span>
                </Button>
                <Button
                  variant={sidebarTab === 'locations' ? 'secondary' : 'ghost'}
                  size="xs"
                  onClick={() => setSidebarTab('locations')}
                  className="text-xs h-7 px-2 gap-1"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Locations</span>
                </Button>
                <Button
                  variant={sidebarTab === 'notes' ? 'secondary' : 'ghost'}
                  size="xs"
                  onClick={() => setSidebarTab('notes')}
                  className="text-xs h-7 px-2 gap-1"
                >
                  <StickyNote className="w-3.5 h-3.5" />
                  <span>Notes</span>
                </Button>
                <Button
                  variant={sidebarTab === 'revisions' ? 'secondary' : 'ghost'}
                  size="xs"
                  onClick={() => setSidebarTab('revisions')}
                  className="text-xs h-7 px-2 gap-1"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Revisions</span>
                </Button>
              </div>
            </div>

            {/* Active Sidebar Tab Content */}
            <div className="flex-1 overflow-hidden">
              {sidebarTab === 'outline' && (
                <SceneOutlinePanel
                  editor={editorInstance}
                  screenplayId={screenplay?.id}
                  projectId={project.id}
                  onSceneClick={() => {}}
                  onSceneAdd={() =>
                    insertSceneHeading(editorRef.current, {
                      interior: 'INT',
                      location: 'NEW LOCATION',
                      timeOfDay: 'DAY',
                    })
                  }
                />
              )}
              {sidebarTab === 'characters' && (
                <CharacterPanel
                  projectId={project.id}
                  elements={screenplayElements}
                />
              )}
              {sidebarTab === 'locations' && (
                <LocationPanel
                  projectId={project.id}
                  elements={screenplayElements}
                />
              )}
              {sidebarTab === 'notes' && (
                <NotesPanel projectId={project.id} />
              )}
              {sidebarTab === 'revisions' && (
                <RevisionPanel
                  projectId={project.id}
                  draftId={draft?.id || (project.id as any)}
                  screenplayId={screenplay?.id || (project.id as any)}
                  currentContent={content}
                  onRestoreContent={handleRestoreContent}
                />
              )}
            </div>
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
