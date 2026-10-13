/**
 * Scene Navigation / Outline Panel (REV-001)
 * Displays scene cards with drag-to-reorder, click-to-navigate,
 * beat summaries, notes, and act color categorization.
 */

import { useState, useEffect, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  GripVertical, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Plus, 
  Trash2,
  Clapperboard,
  Save
} from 'lucide-react'
import type { SceneCard, EntityId } from '@/types'
import { db } from '@/lib/db'

interface SceneOutlinePanelProps {
  editor: Editor | null
  screenplayId?: EntityId
  projectId?: EntityId
  onSceneClick?: (sceneId: string) => void
  onSceneDelete?: (sceneId: string) => void
  onSceneAdd?: (afterSceneId?: string) => void
  className?: string
}

const ACT_COLORS = [
  { label: 'Act I', color: '#3b82f6' },
  { label: 'Act II-A', color: '#10b981' },
  { label: 'Act II-B', color: '#f59e0b' },
  { label: 'Act III', color: '#8b5cf6' },
  { label: 'Climax', color: '#ef4444' },
]

export function SceneOutlinePanel({ 
  editor, 
  screenplayId,
  projectId,
  onSceneClick, 
  onSceneDelete, 
  onSceneAdd,
  className = '' 
}: SceneOutlinePanelProps) {
  const [scenes, setScenes] = useState<SceneCard[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set())
  const [draggedScene, setDraggedScene] = useState<string | null>(null)
  const savedCardsRef = useRef<Map<string, SceneCard>>(new Map())

  // Load existing scene cards from DB if screenplayId is provided
  useEffect(() => {
    if (!screenplayId) return
    let isMounted = true

    db.sceneCards.where('screenplayId').equals(screenplayId).toArray().then((cards) => {
      if (!isMounted) return
      const map = new Map<string, SceneCard>()
      cards.forEach((c) => {
        map.set(c.elementId, c)
        map.set(c.id, c)
      })
      savedCardsRef.current = map
    }).catch(console.error)

    return () => {
      isMounted = false
    }
  }, [screenplayId])

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
          
          const existing = savedCardsRef.current.get(sceneId)

          newScenes.push({
            id: existing?.id || (sceneId as any),
            projectId: projectId || ('current' as any),
            screenplayId: screenplayId || ('current' as any),
            elementId: sceneId as any,
            order,
            summary: existing?.summary || '',
            location: `${interior}. ${location}`,
            timeOfDay,
            characters: existing?.characters || [],
            notes: existing?.notes || '',
            color: existing?.color || undefined,
            createdAt: existing?.createdAt || (Date.now() as any),
            updatedAt: Date.now() as any,
          })
          order++
        }
      })
      
      setScenes(newScenes)
    }
    
    extractScenes()
    
    const handleTransaction = () => extractScenes()
    editor.on('transaction', handleTransaction)
    
    return () => {
      editor.off('transaction', handleTransaction)
    }
  }, [editor, screenplayId, projectId])

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

  const handleCardUpdate = async (sceneId: string, updates: Partial<SceneCard>) => {
    setScenes(prev =>
      prev.map(s => {
        if (s.id === sceneId || s.elementId === sceneId) {
          const updated = { ...s, ...updates, updatedAt: Date.now() as any }
          savedCardsRef.current.set(updated.elementId, updated)
          savedCardsRef.current.set(updated.id, updated)
          
          if (screenplayId) {
            db.sceneCards.put(updated).catch(console.error)
          }
          return updated
        }
        return s
      })
    )
  }

  const navigateToScene = (sceneId: string) => {
    if (!editor) return
    
    let targetPos = -1
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'sceneHeading' && (node.attrs.id === sceneId || node.attrs.elementId === sceneId)) {
        targetPos = pos
        return false
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
    <div className={`flex flex-col h-full bg-card border-r border-border text-foreground ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide">
            <Clapperboard className="w-4 h-4 text-primary" />
            <span>Scene Cards ({scenes.length})</span>
          </div>
          <Button 
            variant="ghost" 
            size="xs" 
            onClick={() => addSceneAfter()}
            title="Add Scene"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter scenes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-7 text-xs bg-muted/50"
          />
        </div>
      </div>

      {/* Scene Cards List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1.5">
          {filteredScenes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
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
                onUpdate={(updates) => handleCardUpdate(scene.id, updates)}
              />
            ))
          )}
        </div>
      </ScrollArea>
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
  onUpdate: (updates: Partial<SceneCard>) => void
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
  onUpdate,
}: SceneCardItemProps) {
  const [summary, setSummary] = useState(scene.summary || '')
  const [notes, setNotes] = useState(scene.notes || '')
  const [isEditing, setIsEditing] = useState(false)

  const handleSaveCard = (e: React.MouseEvent) => {
    e.stopPropagation()
    onUpdate({ summary, notes })
    setIsEditing(false)
  }

  return (
    <div
      className={`group relative bg-card border rounded-lg p-2.5 transition-all text-xs ${
        scene.color ? 'border-l-4' : 'border-border/60'
      } ${isDragging ? 'opacity-50 ring-2 ring-primary' : 'hover:border-border'}`}
      style={scene.color ? { borderLeftColor: scene.color } : {}}
      draggable
      onDragStart={(e) => onDragStart(e, scene.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, scene.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground shrink-0">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-muted-foreground font-semibold text-[11px] shrink-0">
            {index + 1}.
          </span>
          <h4 className="font-bold text-xs truncate flex-1 text-foreground">
            {scene.location ?? 'Unknown Location'}
          </h4>
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono shrink-0">
            {scene.timeOfDay ?? 'DAY'}
          </Badge>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onAddAfter()
            }}
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            title="Add scene after"
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-5 w-5 text-muted-foreground hover:text-destructive"
            title="Delete scene"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Summary preview */}
      {scene.summary && !isExpanded && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 ml-5">
          {scene.summary}
        </p>
      )}

      {/* Expanded Breakdown Editor */}
      {isExpanded && (
        <div 
          className="mt-2.5 pt-2 border-t border-border/60 ml-5 space-y-2 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Act / Color Tag Picker */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
              Act / Beat Color
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ACT_COLORS.map((act) => (
                <button
                  key={act.label}
                  type="button"
                  onClick={() => onUpdate({ color: act.color })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                    scene.color === act.color
                      ? 'border-primary text-primary font-bold'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                  style={{ borderLeftColor: act.color, borderLeftWidth: '3px' }}
                >
                  {act.label}
                </button>
              ))}
              {scene.color && (
                <button
                  type="button"
                  onClick={() => onUpdate({ color: undefined })}
                  className="text-[10px] text-muted-foreground hover:text-destructive underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Plot Beat / Summary */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
              Plot Beat / Summary
            </label>
            <Textarea
              placeholder="What happens in this scene? Dramatic goal, conflict, turning point..."
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value)
                setIsEditing(true)
              }}
              rows={2}
              className="text-xs"
            />
          </div>

          {/* Scene Production Notes */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
              Scene Production Notes
            </label>
            <Input
              placeholder="Props, camera notes, lighting mood..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setIsEditing(true)
              }}
              className="h-7 text-xs"
            />
          </div>

          {isEditing && (
            <div className="flex justify-end pt-1">
              <Button size="xs" onClick={handleSaveCard} className="gap-1 text-[11px] h-6 px-2">
                <Save className="w-3 h-3" />
                <span>Save Card</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SceneOutlinePanel