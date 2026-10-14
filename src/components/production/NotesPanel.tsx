/**
 * Scene & Global Notes Panel (REV-004)
 * Provides production notes management, to-do tracking, and ideation tags.
 */

import { useState, useEffect } from 'react'
import type { Note, EntityId } from '@/types'
import { db, generateId } from '@/lib/db'
import { filterNotes } from '@/lib/production/notes'
import { enqueueSyncOp } from '@/lib/sync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Plus, Trash2, StickyNote, CheckCircle, Lightbulb, BookOpen } from 'lucide-react'

interface NotesPanelProps {
  projectId: EntityId
  activeSceneId?: EntityId
}

const TYPE_CONFIG = {
  general: { label: 'General', color: 'border-slate-500/30 text-slate-600 dark:text-slate-400', icon: StickyNote },
  todo: { label: 'To-Do', color: 'border-amber-500/30 text-amber-600 dark:text-amber-400', icon: CheckCircle },
  research: { label: 'Research', color: 'border-blue-500/30 text-blue-600 dark:text-blue-400', icon: BookOpen },
  idea: { label: 'Idea', color: 'border-purple-500/30 text-purple-600 dark:text-purple-400', icon: Lightbulb },
}

export function NotesPanel({ projectId, activeSceneId }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Add / Edit modal state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [content, setContent] = useState('')
  const [type, setType] = useState<'general' | 'todo' | 'research' | 'idea'>('general')
  const [attachToActiveScene, setAttachToActiveScene] = useState(false)

  const loadNotes = async () => {
    try {
      const list = await db.notes.where('projectId').equals(projectId).toArray()
      setNotes(list.sort((a, b) => (b.updatedAt as number) - (a.updatedAt as number)))
    } catch (err) {
      console.error('[NotesPanel] Failed to load notes:', err)
    }
  }

  useEffect(() => {
    loadNotes()
  }, [projectId])

  const handleOpenAdd = () => {
    setContent('')
    setType('general')
    setAttachToActiveScene(Boolean(activeSceneId))
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    const trimmed = content.trim()
    if (!trimmed) return

    const now = Date.now() as any
    const newNote: Note = {
      id: generateId(),
      projectId,
      sceneId: attachToActiveScene ? activeSceneId : undefined,
      content: trimmed,
      type,
      createdAt: now,
      updatedAt: now,
    }

    await db.notes.add(newNote)
    await enqueueSyncOp(projectId, 'note', newNote.id, 'create', newNote)
    setIsDialogOpen(false)
    await loadNotes()
  }

  const handleDelete = async (id: EntityId) => {
    await db.notes.delete(id)
    await enqueueSyncOp(projectId, 'note', id, 'delete')
    await loadNotes()
  }

  const filtered = filterNotes(notes, search, typeFilter)

  return (
    <div className="flex flex-col h-full bg-card text-foreground">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide">
            <StickyNote className="w-4 h-4 text-primary" />
            <span>Notes & Tasks ({notes.length})</span>
          </div>
          <Button variant="ghost" size="xs" onClick={handleOpenAdd} title="Add Note">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-7 text-xs bg-muted/50"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-24 h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="todo">To-Do</SelectItem>
              <SelectItem value="idea">Idea</SelectItem>
              <SelectItem value="research">Research</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes List */}
      <ScrollArea className="flex-1 p-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            {notes.length === 0
              ? 'No notes yet. Add your thoughts, to-dos, or scene notes!'
              : 'No notes match your filter.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((note) => {
              const cfg = TYPE_CONFIG[note.type] || TYPE_CONFIG.general
              const Icon = cfg.icon

              return (
                <div
                  key={note.id}
                  className="group p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${cfg.color}`}>
                        <Icon className="w-2.5 h-2.5 mr-1" />
                        {cfg.label}
                      </Badge>
                      {note.sceneId && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          Scene
                        </span>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(note.id)}
                      className="h-5 w-5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  <p className="text-xs text-foreground mt-1.5 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>

                  <div className="text-[10px] text-muted-foreground mt-2">
                    {new Date(note.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Add Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Type</label>
              <Select value={type} onValueChange={(val: any) => setType(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="todo">To-Do Task</SelectItem>
                  <SelectItem value="idea">Idea / Inspiration</SelectItem>
                  <SelectItem value="research">Research Reference</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Note Content</label>
              <Textarea
                placeholder="Write your note or to-do here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="text-xs"
                autoFocus
              />
            </div>

            {activeSceneId && (
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={attachToActiveScene}
                  onChange={(e) => setAttachToActiveScene(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-muted-foreground text-xs">
                  Attach specifically to currently selected scene
                </span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="xs" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="xs" onClick={handleSave} disabled={!content.trim()}>
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
