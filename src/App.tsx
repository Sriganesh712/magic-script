import { useState, useRef, useCallback } from 'react'
import { ScreenplayEditor, SceneOutlinePanel, insertSceneHeading, insertAction, insertCharacter, insertDialogue, insertParenthetical, insertTransition, insertPageBreak } from './editor'
import { useAutosave, useOnlineStatus, RecoveryBanner } from './hooks'
import { generateId } from '@/lib/db'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { WifiOff, Save, Database, Download, Upload } from 'lucide-react'
import './editor/ScreenplayEditor.css'
import './App.css'

// Sample screenplay content for demo
const SAMPLE_CONTENT = `<p data-type="scene-heading" data-interior="INT" data-location="COFFEE SHOP" data-time-of-day="DAY">INT. COFFEE SHOP - DAY</p>
<p data-type="action">The morning rush. Baristas move with practiced efficiency. Steam rises from espresso machines.</p>
<p data-type="character" data-name="SARAH">SARAH</p>
<p data-type="dialogue" data-character-id="sarah">(checking her phone) Still no message.</p>
<p data-type="character" data-name="MIKE">MIKE</p>
<p data-type="dialogue" data-character-id="mike">She'll text. She always does.</p>
<p data-type="parenthetical" data-character-id="sarah">(sighs)</p>
<p data-type="dialogue" data-character-id="sarah">Three hours. Three hours and nothing.</p>
<p data-type="transition" data-transition-type="CUT_TO">CUT TO:</p>
<p data-type="scene-heading" data-interior="EXT" data-location="PARK BENCH" data-time-of-day="LATER">EXT. PARK BENCH - LATER</p>
<p data-type="action">Sarah sits alone, coffee growing cold beside her. A pigeon pecks at a crumb near her foot.</p>
<p data-type="action">Her phone buzzes. She grabs it like a lifeline.</p>
<p data-type="character" data-name="SARAH">SARAH</p>
<p data-type="dialogue" data-character-id="sarah">(into phone) Hello?</p>`

const PROJECT_ID = generateId()
const DRAFT_ID = generateId()
const SCREENPLAY_ID = generateId()

function App() {
  const [content, setContent] = useState(SAMPLE_CONTENT)
  const [wordCount, setWordCount] = useState(0)
  const [showOutline, setShowOutline] = useState(true)
  const [showRecovery, setShowRecovery] = useState(false)
  const editorRef = useRef<any>(null)
  const lastSavedContentRef = useRef(SAMPLE_CONTENT)

  const { isOnline, wasOffline } = useOnlineStatus()
  
  const { 
    isSaving, 
    lastSaved, 
    save: manualSave,
    exportBackup,
    importBackup
  } = useAutosave(editorRef.current, {
    screenplayId: SCREENPLAY_ID,
    draftId: DRAFT_ID,
    projectId: PROJECT_ID,
    debounceMs: 2000,
    onSave: (saved) => {
      if (saved) {
        lastSavedContentRef.current = content
      }
    },
    onError: (err) => {
      console.error('[Autosave Error]', err)
    }
  })

  const handleChange = useCallback((html: string) => {
    setContent(html)
    const text = html.replace(/<[^>]*>/g, ' ')
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length
    setWordCount(words)
  }, [])

  const handleUpdate = useCallback((editor: any) => {
    editorRef.current = editor
  }, [])

  const toolbarActions = {
    scene: () => insertSceneHeading(editorRef.current),
    action: () => insertAction(editorRef.current),
    character: () => insertCharacter(editorRef.current),
    dialogue: () => insertDialogue(editorRef.current),
    parenthetical: () => insertParenthetical(editorRef.current),
    transition: () => insertTransition(editorRef.current),
    pageBreak: () => insertPageBreak(editorRef.current),
  }

  const handleExportBackup = async () => {
    try {
      const backup = await exportBackup()
      const blob = new Blob([backup], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `screenplay-backup-${new Date().toISOString().split('T')[0]}.json`
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
      importBackup(json).then(() => {
        alert('Backup imported! Please refresh the page.')
      }).catch(err => {
        console.error('Import failed:', err)
        alert('Import failed: ' + err.message)
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex">
      {/* Offline/Recovery Banner */}
      {(wasOffline || !isOnline) && (
        <Alert className="m-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <AlertDescription className="text-amber-700 dark:text-amber-300 flex items-center gap-2">
              {!isOnline ? 'You are offline. Changes will sync when reconnected.' : 'Connection restored. Syncing changes...'}
              {wasOffline && isOnline && (
                <Button variant="ghost" size="sm" onClick={() => setShowRecovery(true)}>
                  Check for unsaved changes
                </Button>
              )}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {showRecovery && (
        <RecoveryBanner
          hasRecovery={true}
          onRecover={() => { setShowRecovery(false); manualSave() }}
          onDismiss={() => setShowRecovery(false)}
        />
      )}

      {/* Toolbar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-2 shadow-sm">
        <div className="max-w-full mx-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Screenplay Studio</h1>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">{wordCount} words</span>
              <Separator orientation="vertical" className="h-4 mx-1" />
              <div className="flex items-center gap-1">
                {isSaving && <Save className="w-4 h-4 text-blue-500 animate-spin" />}
                {!isSaving && lastSaved && <Database className="w-4 h-4 text-green-500" />}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isSaving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Not saved'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex-1"></div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleExportBackup}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              title="Export Backup"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportBackup} 
              className="hidden" 
              id="import-backup"
            />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => document.getElementById('import-backup')?.click()}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              title="Import Backup"
            >
              <Upload className="w-4 h-4 mr-1" />
              Import
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={manualSave}
              disabled={isSaving}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              title="Save Now (⌘S)"
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
          
          <Separator orientation="vertical" className="h-6 mx-2" />
          
          <div className="flex items-center gap-1">
            <button
              onClick={toolbarActions.scene}
              className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Scene Heading (⌘⌥1)"
            >
              Scene
            </button>
            <button
              onClick={toolbarActions.action}
              className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Action (⌘⌥2)"
            >
              Action
            </button>
            <button
              onClick={toolbarActions.character}
              className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Character"
            >
              Character
            </button>
            <button
              onClick={toolbarActions.dialogue}
              className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Dialogue"
            >
              Dialogue
            </button>
            <button
              onClick={toolbarActions.parenthetical}
              className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Parenthetical"
            >
              Paren
            </button>
            <button
              onClick={toolbarActions.transition}
              className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Transition"
            >
              Trans
            </button>
            <button
              onClick={toolbarActions.pageBreak}
              className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Page Break"
            >
              Page Break
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Scene Outline Panel */}
        {showOutline && (
          <aside className="w-72 lg:w-80 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0 hidden lg:block">
            <SceneOutlinePanel
              editor={editorRef.current}
              onSceneClick={() => {}}
              onSceneAdd={() => insertSceneHeading(editorRef.current, { interior: 'INT', location: 'NEW LOCATION', timeOfDay: 'DAY' })}
            />
          </aside>
        )}

        {/* Mobile Outline Toggle */}
        <div className="lg:hidden border-b border-gray-200 dark:border-slate-700 px-4 py-2 bg-white dark:bg-slate-800">
          <Button variant="outline" size="sm" onClick={() => setShowOutline(!showOutline)} className="w-full">
            {showOutline ? 'Hide' : 'Show'} Outline
          </Button>
        </div>
        {showOutline && !window.matchMedia('(min-width: 1024px)').matches && (
          <div className="lg:hidden border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 max-h-64 overflow-auto">
            <SceneOutlinePanel
              editor={editorRef.current}
              onSceneClick={() => { setShowOutline(false) }}
              onSceneAdd={() => { insertSceneHeading(editorRef.current, { interior: 'INT', location: 'NEW LOCATION', timeOfDay: 'DAY' }); setShowOutline(false) }}
            />
          </div>
        )}

        {/* Editor */}
        <main className="flex-1 min-w-0">
          <ScreenplayEditor
            content={content}
            onChange={handleChange}
            onUpdate={handleUpdate}
            placeholder="Start writing your screenplay... (Press Enter to cycle elements, Tab for parenthetical)"
            autoFocus
          />
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-full mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Enter</kbd>
            <span>Next element</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Tab</kbd>
            <span>Parenthetical</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Shift+Tab</kbd>
            <span>Outdent</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Esc</kbd>
            <span>Back to Action</span>
          </div>
          <div className="flex items-center gap-4">
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">⌘⌥1</kbd>
            <span>Scene Heading</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">⌘⌥2</kbd>
            <span>Action</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">⌘S</kbd>
            <span>Save</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App