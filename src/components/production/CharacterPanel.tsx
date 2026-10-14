/**
 * Character Database Panel (REV-002)
 * Manages character profiles, dialogue frequencies, arcs, and scenes.
 */

import { useState, useEffect } from 'react'
import type { Character, EntityId, ScreenplayElement } from '@/types'
import { db, generateId } from '@/lib/db'
import { extractCharactersFromElements } from '@/lib/production/extractors'
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
import { Search, Plus, RefreshCw, Edit2, Trash2, Users } from 'lucide-react'

interface CharacterPanelProps {
  projectId: EntityId
  elements: ScreenplayElement[]
  onCharacterSelect?: (characterName: string) => void
}

export function CharacterPanel({
  projectId,
  elements,
  onCharacterSelect,
}: CharacterPanelProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Edit/Add modal state
  const [editingChar, setEditingChar] = useState<Character | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [arcsText, setArcsText] = useState('')
  const [color, setColor] = useState('#3b82f6')

  // Load characters from DB
  const loadCharacters = async () => {
    try {
      setIsLoading(true)
      const list = await db.characters.where('projectId').equals(projectId).toArray()
      setCharacters(list.sort((a, b) => b.dialogueCount - a.dialogueCount || a.name.localeCompare(b.name)))
    } catch (err) {
      console.error('[CharacterPanel] Failed to load characters:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCharacters()
  }, [projectId, elements])

  useEffect(() => {
    void handleSyncWithScript()
  }, [projectId, elements])

  // Sync / Auto-extract from editor elements
  const handleSyncWithScript = async () => {
    try {
      setIsLoading(true)
      const existing = await db.characters.where('projectId').equals(projectId).toArray()
      const extracted = extractCharactersFromElements(elements, projectId, existing)
      await db.characters.bulkPut(extracted)
      setCharacters(extracted)
    } catch (err) {
      console.error('[CharacterPanel] Sync failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setEditingChar(null)
    setName('')
    setDescription('')
    setArcsText('')
    setColor('#3b82f6')
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (char: Character) => {
    setEditingChar(char)
    setName(char.name)
    setDescription(char.description || '')
    setArcsText(char.arcs ? char.arcs.join('\n') : '')
    setColor(char.color || '#3b82f6')
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    const trimmedName = name.trim().toUpperCase()
    if (!trimmedName) return

    const arcs = arcsText
      .split('\n')
      .map((a) => a.trim())
      .filter((a) => a.length > 0)

    const now = Date.now() as any

    if (editingChar) {
      const updated: Character = {
        ...editingChar,
        name: trimmedName,
        description,
        arcs,
        color,
        updatedAt: now,
      }
      await db.characters.put(updated)
    } else {
      const newChar: Character = {
        id: generateId(),
        projectId,
        name: trimmedName,
        description,
        arcs,
        dialogueCount: 0,
        sceneCount: 0,
        color,
        createdAt: now,
        updatedAt: now,
      }
      await db.characters.add(newChar)
    }

    setIsDialogOpen(false)
    await loadCharacters()
  }

  const handleDelete = async (id: EntityId) => {
    if (confirm('Delete this character? This will not remove their dialogue from the script.')) {
      await db.characters.delete(id)
      await loadCharacters()
    }
  }

  const filtered = characters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  return (
    <div className="flex flex-col h-full bg-card text-foreground">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide">
            <Users className="w-4 h-4 text-primary" />
            <span>Characters ({characters.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={handleSyncWithScript}
              disabled={isLoading}
              title="Auto-extract characters from script"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="xs" onClick={handleOpenAdd} title="Add Character">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search characters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-7 text-xs bg-muted/50"
          />
        </div>
      </div>

      {/* Character List */}
      <ScrollArea className="flex-1 p-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            {characters.length === 0
              ? 'No characters detected yet. Click the refresh icon to scan the script!'
              : 'No characters match your search.'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((char) => (
              <div
                key={char.id}
                onClick={() => onCharacterSelect?.(char.name)}
                className="group p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: char.color || '#3b82f6' }}
                    />
                    <span className="font-bold text-xs truncate">{char.name}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEdit(char)
                      }}
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(char.id)
                      }}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {char.dialogueCount} dialogues
                  </Badge>
                  <span>{char.sceneCount} scenes</span>
                </div>

                {/* Description snippet */}
                {char.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1.5">
                    {char.description}
                  </p>
                )}

                {/* Arcs */}
                {char.arcs && char.arcs.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {char.arcs.map((arc, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                      >
                        {arc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Edit / Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editingChar ? 'Edit Character' : 'Add Character'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Name</label>
              <Input
                placeholder="CHARACTER NAME"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="uppercase text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">
                Description & Role
              </label>
              <Textarea
                placeholder="Background, personality, key traits..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">
                Character Arcs (one per line)
              </label>
              <Textarea
                placeholder="Wants revenge...&#10;Learns to forgive..."
                value={arcsText}
                onChange={(e) => setArcsText(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Color Marker</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                />
                <span className="text-muted-foreground text-xs font-mono">{color}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="xs" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="xs" onClick={handleSave} disabled={!name.trim()}>
              Save Character
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
