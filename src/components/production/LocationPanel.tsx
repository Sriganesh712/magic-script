/**
 * Location Database Panel (REV-003)
 * Manages locations, INT/EXT tags, descriptions, and scene cross-references.
 */

import { useState, useEffect } from 'react'
import type { Location, EntityId, ScreenplayElement } from '@/types'
import { db, generateId } from '@/lib/db'
import { extractLocationsFromElements } from '@/lib/production/extractors'
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
import { Search, Plus, RefreshCw, Edit2, Trash2, MapPin } from 'lucide-react'

interface LocationPanelProps {
  projectId: EntityId
  elements: ScreenplayElement[]
  onLocationSelect?: (locationName: string) => void
}

export function LocationPanel({
  projectId,
  elements,
  onLocationSelect,
}: LocationPanelProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INT' | 'EXT' | 'INT/EXT'>('ALL')
  const [isLoading, setIsLoading] = useState(false)

  // Edit/Add modal state
  const [editingLoc, setEditingLoc] = useState<Location | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'INT' | 'EXT' | 'INT/EXT'>('INT')
  const [description, setDescription] = useState('')

  const loadLocations = async () => {
    try {
      setIsLoading(true)
      const list = await db.locations.where('projectId').equals(projectId).toArray()
      setLocations(list.sort((a, b) => b.sceneIds.length - a.sceneIds.length || a.name.localeCompare(b.name)))
    } catch (err) {
      console.error('[LocationPanel] Failed to load locations:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
  }, [projectId])

  const handleSyncWithScript = async () => {
    try {
      setIsLoading(true)
      const existing = await db.locations.where('projectId').equals(projectId).toArray()
      const extracted = extractLocationsFromElements(elements, projectId, existing)
      await db.locations.bulkPut(extracted)
      setLocations(extracted)
    } catch (err) {
      console.error('[LocationPanel] Sync failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setEditingLoc(null)
    setName('')
    setType('INT')
    setDescription('')
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (loc: Location) => {
    setEditingLoc(loc)
    setName(loc.name)
    setType(loc.type)
    setDescription(loc.description || '')
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    const trimmedName = name.trim().toUpperCase()
    if (!trimmedName) return

    const now = Date.now() as any

    if (editingLoc) {
      const updated: Location = {
        ...editingLoc,
        name: trimmedName,
        type,
        description,
        updatedAt: now,
      }
      await db.locations.put(updated)
    } else {
      const newLoc: Location = {
        id: generateId(),
        projectId,
        name: trimmedName,
        type,
        description,
        sceneIds: [],
        createdAt: now,
        updatedAt: now,
      }
      await db.locations.add(newLoc)
    }

    setIsDialogOpen(false)
    await loadLocations()
  }

  const handleDelete = async (id: EntityId) => {
    if (confirm('Delete this location? This will not remove scene headings from the script.')) {
      await db.locations.delete(id)
      await loadLocations()
    }
  }

  const filtered = locations.filter((loc) => {
    const matchesSearch =
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      (loc.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchesType = typeFilter === 'ALL' || loc.type === typeFilter
    return matchesSearch && matchesType
  })

  return (
    <div className="flex flex-col h-full bg-card text-foreground">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide">
            <MapPin className="w-4 h-4 text-primary" />
            <span>Locations ({locations.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={handleSyncWithScript}
              disabled={isLoading}
              title="Auto-extract locations from script"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="xs" onClick={handleOpenAdd} title="Add Location">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-7 text-xs bg-muted/50"
            />
          </div>
          <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
            <SelectTrigger className="w-20 h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="INT">INT</SelectItem>
              <SelectItem value="EXT">EXT</SelectItem>
              <SelectItem value="INT/EXT">INT/EXT</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Locations List */}
      <ScrollArea className="flex-1 p-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            {locations.length === 0
              ? 'No locations detected yet. Click refresh to scan scene headings!'
              : 'No locations match your filter.'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((loc) => (
              <div
                key={loc.id}
                onClick={() => onLocationSelect?.(loc.name)}
                className="group p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-4 font-mono ${
                        loc.type === 'EXT'
                          ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : loc.type === 'INT/EXT'
                            ? 'border-purple-500/30 text-purple-600 dark:text-purple-400'
                            : 'border-blue-500/30 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {loc.type}
                    </Badge>
                    <span className="font-bold text-xs truncate">{loc.name}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEdit(loc)
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
                        handleDelete(loc.id)
                      }}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                  <span>{loc.sceneIds?.length || 0} scenes</span>
                </div>

                {loc.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                    {loc.description}
                  </p>
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
              {editingLoc ? 'Edit Location' : 'Add Location'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="font-semibold text-muted-foreground block mb-1">Location Name</label>
                <Input
                  placeholder="COFFEE SHOP"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="uppercase text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Type</label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INT">INT</SelectItem>
                    <SelectItem value="EXT">EXT</SelectItem>
                    <SelectItem value="INT/EXT">INT/EXT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Description</label>
              <Textarea
                placeholder="Atmosphere, set details, visual mood..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="xs" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="xs" onClick={handleSave} disabled={!name.trim()}>
              Save Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
