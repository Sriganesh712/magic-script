/**
 * Scene Navigation / Outline Panel
 * Displays scene cards with drag-to-reorder, click-to-navigate
 */

import { useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  GripVertical, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Plus, 
  Trash2,
  Type
} from 'lucide-react'
import type { SceneCard } from '@/types'

interface SceneOutlinePanelProps {
  editor: Editor | null
  onSceneClick?: (sceneId: string) => void
  onSceneDelete?: (sceneId: string) => void
  onSceneAdd?: (afterSceneId?: string) => void
  className?: string
}

export function SceneOutlinePanel({ 
  editor, 
  onSceneClick, 
  onSceneDelete, 
  onSceneAdd,
  className = '' 
}: SceneOutlinePanelProps) {
  const [scenes, setScenes] = useState<SceneCard[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set())
  const [draggedScene, setDraggedScene] = useState<string | null>(null)

  // Extract scenes from editor content
  useEffect(() => {
    if (!editor) return
    
    const extractScenes = () => {
      const newScenes: SceneCard[] = []
      let order = 0
      
      editor.state.doc.descendants((node: any) => {
        if (node.type.name === 'sceneHeading') {
          const sceneId = node.attrs.id || `scene_${order}`
          const interior = node.attrs.interior || 'INT'
          const location = node.attrs.location || 'UNKNOWN LOCATION'
          const timeOfDay = node.attrs.timeOfDay || 'DAY'
          
          newScenes.push({
            id: sceneId as any,
            projectId: 'current' as any,
            screenplayId: 'current' as any,
            elementId: sceneId as any,
            order,
            summary: '',
            location: `${interior}. ${location}`,
            timeOfDay,
            characters: [],
            color: undefined,
            createdAt: Date.now() as any,
            updatedAt: Date.now() as any,
          })
          order++
        }
      })
      
      setScenes(newScenes)
    }
    
    extractScenes()
    
    // Update on transaction
    const handleTransaction = () => extractScenes()
    editor.on('transaction', handleTransaction)
    
    return () => {
      editor.off('transaction', handleTransaction)
    }
  }, [editor])

  const filteredScenes = scenes.filter(scene => 
    (scene.location?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (scene.timeOfDay?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (scene.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  )

  const handleDragStart = (e: React.DragEvent, sceneId: string) => {
    setDraggedScene(sceneId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetSceneId: string) => {
    e.preventDefault()
    if (!draggedScene || draggedScene === targetSceneId) return
    
    setScenes(prev => {
      const draggedIndex = prev.findIndex(s => s.id === draggedScene)
      const targetIndex = prev.findIndex(s => s.id === targetSceneId)
      if (draggedIndex === -1 || targetIndex === -1) return prev
      
      const newScenes = [...prev]
      const [dragged] = newScenes.splice(draggedIndex, 1)
      newScenes.splice(targetIndex, 0, dragged)
      
      // Update order
      return newScenes.map((s, i) => ({ ...s, order: i }))
    })
    
    setDraggedScene(null)
  }

  const handleDragEnd = () => {
    setDraggedScene(null)
  }

  const toggleExpanded = (sceneId: string) => {
    setExpandedScenes(prev => {
      const next = new Set(prev)
      if (next.has(sceneId)) {
        next.delete(sceneId)
      } else {
        next.add(sceneId)
      }
      return next
    })
  }

  const navigateToScene = (sceneId: string) => {
    if (!editor) return
    
    // Find the scene heading position in the document
    let targetPos = -1
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'sceneHeading' && node.attrs.id === sceneId) {
        targetPos = pos
        return false // Stop traversal
      }
      return true
    })
    
    if (targetPos !== -1) {
      editor.commands.setTextSelection(targetPos)
      editor.view.focus()
    }
    
    onSceneClick?.(sceneId)
  }

  const deleteScene = (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation()
    if (confirm('Delete this scene? This cannot be undone.')) {
      onSceneDelete?.(sceneId)
    }
  }

  const addSceneAfter = (sceneId?: string) => {
    onSceneAdd?.(sceneId)
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Type className="w-5 h-5" />
            Scenes ({scenes.length})
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => addSceneAfter()}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            title="Add Scene"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Filter scenes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Scene List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredScenes.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              {searchQuery ? 'No scenes match your search' : 'No scenes yet. Start writing!'}
            </div>
          ) : (
            filteredScenes.map((scene, index) => (
              <SceneCardItem
                key={scene.id}
                scene={scene}
                index={index}
                isExpanded={expandedScenes.has(scene.id)}
                isDragging={draggedScene === scene.id}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onClick={() => navigateToScene(scene.id)}
                onToggleExpand={() => toggleExpanded(scene.id)}
                onDelete={(e) => deleteScene(e, scene.id)}
                onAddAfter={() => addSceneAfter(scene.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer Stats */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex justify-between">
          <span>Total: {scenes.length} scenes</span>
          <span>Filtered: {filteredScenes.length}</span>
        </div>
      </div>
    </div>
  )
}

interface SceneCardItemProps {
  scene: SceneCard
  index: number
  isExpanded: boolean
  isDragging: boolean
  onDragStart: (e: React.DragEvent, sceneId: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, targetSceneId: string) => void
  onDragEnd: () => void
  onClick: () => void
  onToggleExpand: () => void
  onDelete: (e: React.MouseEvent) => void
  onAddAfter: () => void
}

function SceneCardItem({
  scene,
  index,
  isExpanded,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onClick,
  onToggleExpand,
  onDelete,
  onAddAfter,
}: SceneCardItemProps) {
  return (
    <div
      className={`group relative bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 transition-all ${
        isDragging ? 'opacity-50 ring-2 ring-blue-500' : ''
      }`}
      draggable
      onDragStart={(e) => onDragStart(e, scene.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, scene.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      {/* Drag Handle */}
      <div className="absolute left-2 top-2 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      {/* Main Content */}
      <div className="ml-8">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-6 text-right">
                {index + 1}.
              </span>
              <h3 className="font-medium text-gray-900 dark:text-white truncate flex-1">
                {scene.location ?? 'Unknown Location'}
              </h3>
              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                {scene.timeOfDay ?? 'DAY'}
              </Badge>
            </div>
            
            {scene.summary && (
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 ml-8">
                {scene.summary}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleExpand(); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAddAfter(); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Add scene after"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              title="Delete scene"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700 ml-8 space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex gap-2">
              <span>ID:</span>
              <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{scene.id.slice(0, 20)}...</code>
            </div>
            <div className="flex gap-2">
              <span>Element ID:</span>
              <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{scene.elementId.slice(0, 20)}...</code>
            </div>
            {scene.characters.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <span>Characters:</span>
                {scene.characters.map((charId: string) => (
                  <Badge key={charId} variant="secondary" className="text-xs">
                    {charId.slice(0, 12)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SceneOutlinePanel