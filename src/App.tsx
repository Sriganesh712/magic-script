import { useState, useRef } from 'react'
import { ScreenplayEditor, insertSceneHeading, insertAction, insertCharacter, insertDialogue, insertParenthetical, insertTransition, insertPageBreak } from './editor'
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

function App() {
  const [content, setContent] = useState(SAMPLE_CONTENT)
  const [wordCount, setWordCount] = useState(0)
  const editorRef = useRef<any>(null)

  const handleChange = (html: string) => {
    setContent(html)
    // Simple word count
    const text = html.replace(/<[^>]*>/g, ' ')
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length
    setWordCount(words)
  }

  const handleUpdate = (editor: any) => {
    editorRef.current = editor
  }

  const toolbarActions = {
    scene: () => insertSceneHeading(editorRef.current),
    action: () => insertAction(editorRef.current),
    character: () => insertCharacter(editorRef.current),
    dialogue: () => insertDialogue(editorRef.current),
    parenthetical: () => insertParenthetical(editorRef.current),
    transition: () => insertTransition(editorRef.current),
    pageBreak: () => insertPageBreak(editorRef.current),
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Toolbar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-2 shadow-sm">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Screenplay Studio</h1>
          <div className="flex-1"></div>
          <div className="flex items-center gap-1 border-l border-gray-200 dark:border-slate-700 pl-4 ml-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">{wordCount} words</span>
          </div>
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

      {/* Editor */}
      <main className="flex-1">
        <ScreenplayEditor
          content={content}
          onChange={handleChange}
          onUpdate={handleUpdate}
          placeholder="Start writing your screenplay... (Press Enter to cycle elements, Tab for parenthetical)"
          autoFocus
        />
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
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
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App