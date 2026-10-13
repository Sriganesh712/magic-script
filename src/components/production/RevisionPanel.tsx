/**
 * Revision History & Diff Panel (REV-005)
 * Snapshot creation, visual element-level diff comparison, and 1-click restore.
 */

import { useState, useEffect } from 'react'
import type {
  EntityId,
  ScreenplayDocument,
  ScreenplayElement,
  RevisionSnapshot,
} from '@/types'
import {
  createRevisionSnapshot,
  getRevisionSnapshots,
  deleteRevisionSnapshot,
  restoreRevisionSnapshot,
  diffRevisionDocuments,
  type DocumentDiffResult,
} from '@/lib/production/revisions'
import { htmlToElements } from '@/lib/export/html-converter'
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  History,
  Camera,
  RotateCcw,
  GitCompare,
  Trash2,
  Calendar,
  FileCheck,
  PlusCircle,
  MinusCircle,
} from 'lucide-react'

interface RevisionPanelProps {
  projectId: EntityId
  draftId: EntityId
  screenplayId: EntityId
  currentContent: string
  onRestoreContent: (html: string) => void
}

export function RevisionPanel({
  projectId,
  draftId,
  screenplayId,
  currentContent,
  onRestoreContent,
}: RevisionPanelProps) {
  const [snapshots, setSnapshots] = useState<RevisionSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Take Snapshot Dialog State
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')

  // Diff Compare Dialog State
  const [comparingSnapshot, setComparingSnapshot] = useState<RevisionSnapshot | null>(null)
  const [diffResult, setDiffResult] = useState<DocumentDiffResult | null>(null)

  // Load snapshots
  const loadSnapshots = async () => {
    try {
      setIsLoading(true)
      const list = await getRevisionSnapshots(projectId, screenplayId)
      setSnapshots(list)
    } catch (err) {
      console.error('[RevisionPanel] Failed to load snapshots:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSnapshots()
  }, [projectId, screenplayId])

  // Create Snapshot
  const handleCreateSnapshot = async () => {
    const trimmedLabel = label.trim() || `Snapshot ${new Date().toLocaleDateString()}`
    try {
      setIsLoading(true)
      const elements: ScreenplayElement[] = htmlToElements(currentContent)
      const doc: ScreenplayDocument = {
        id: screenplayId,
        projectId,
        draftId,
        metadata: { title: 'Screenplay' },
        elements,
        schemaVersion: 1,
        createdAt: Date.now() as any,
        updatedAt: Date.now() as any,
      }

      await createRevisionSnapshot({
        projectId,
        draftId,
        screenplayId,
        label: trimmedLabel,
        description,
        document: doc,
        createdBy: 'user',
      })

      setIsSnapshotOpen(false)
      setLabel('')
      setDescription('')
      await loadSnapshots()
    } catch (err) {
      console.error('[RevisionPanel] Error taking snapshot:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Compare Snapshot against current content
  const handleCompare = (snapshot: RevisionSnapshot) => {
    const currentElements = htmlToElements(currentContent)
    const currentDoc: ScreenplayDocument = {
      id: screenplayId,
      projectId,
      draftId,
      metadata: { title: 'Current' },
      elements: currentElements,
      schemaVersion: 1,
      createdAt: Date.now() as any,
      updatedAt: Date.now() as any,
    }

    const diff = diffRevisionDocuments(snapshot.document, currentDoc)
    setDiffResult(diff)
    setComparingSnapshot(snapshot)
  }

  // Restore snapshot
  const handleRestore = async (snapshot: RevisionSnapshot) => {
    const confirmRestore = confirm(
      `Restore to "${snapshot.label}"?\n\nA backup snapshot of your current document will be saved automatically before restoring.`
    )
    if (!confirmRestore) return

    try {
      // 1. Safety backup of current state
      const currentElements = htmlToElements(currentContent)
      const currentDoc: ScreenplayDocument = {
        id: screenplayId,
        projectId,
        draftId,
        metadata: { title: 'Pre-restore backup' },
        elements: currentElements,
        schemaVersion: 1,
        createdAt: Date.now() as any,
        updatedAt: Date.now() as any,
      }

      await createRevisionSnapshot({
        projectId,
        draftId,
        screenplayId,
        label: `Auto-Backup before restoring "${snapshot.label}"`,
        document: currentDoc,
        createdBy: 'auto',
      })

      // 2. Perform restore
      const { htmlContent } = await restoreRevisionSnapshot(snapshot.id)
      onRestoreContent(htmlContent)

      // 3. Refresh list and close compare dialog if open
      setComparingSnapshot(null)
      await loadSnapshots()
    } catch (err) {
      console.error('[RevisionPanel] Restore failed:', err)
      alert('Failed to restore snapshot: ' + (err as Error).message)
    }
  }

  // Delete snapshot
  const handleDelete = async (id: EntityId) => {
    if (confirm('Delete this revision snapshot?')) {
      await deleteRevisionSnapshot(id)
      await loadSnapshots()
    }
  }

  return (
    <div className="flex flex-col h-full bg-card text-foreground">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide">
          <History className="w-4 h-4 text-primary" />
          <span>Revisions ({snapshots.length})</span>
        </div>
        <Button
          variant="default"
          size="xs"
          onClick={() => setIsSnapshotOpen(true)}
          className="gap-1 text-xs"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Snapshot</span>
        </Button>
      </div>

      {/* Revision List */}
      <ScrollArea className="flex-1 p-2">
        {snapshots.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No revision snapshots yet. Click &quot;Snapshot&quot; to freeze a draft milestone!
          </div>
        ) : (
          <div className="space-y-2">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="group p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div>
                    <h4 className="font-bold text-xs text-foreground truncate max-w-[160px]">
                      {snap.label}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(snap.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <Badge
                    variant={snap.createdBy === 'auto' ? 'secondary' : 'outline'}
                    className="text-[9px] px-1 py-0 h-4"
                  >
                    {snap.createdBy}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                  <span>{snap.wordCount.toLocaleString()} words</span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleCompare(snap)}
                      className="h-6 px-1.5 text-[11px] gap-1"
                      title="Compare with current script"
                    >
                      <GitCompare className="w-3 h-3 text-blue-500" />
                      <span>Diff</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRestore(snap)}
                      className="h-6 px-1.5 text-[11px] gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                      title="Restore script to this revision"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(snap.id)}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {snap.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                    {snap.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Take Snapshot Dialog */}
      <Dialog open={isSnapshotOpen} onOpenChange={setIsSnapshotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              Capture Revision Snapshot
            </DialogTitle>
            <DialogDescription className="text-xs">
              Save a permanent checkpoint of your current screenplay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">
                Revision Name / Color
              </label>
              <Input
                placeholder="e.g. Blue Revision, Director Notes Polish, Draft 1"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="text-xs"
                autoFocus
              />
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">
                Notes & Summary (Optional)
              </label>
              <Textarea
                placeholder="Describe key changes or feedback implemented in this draft..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="xs" onClick={() => setIsSnapshotOpen(false)}>
              Cancel
            </Button>
            <Button size="xs" onClick={handleCreateSnapshot} disabled={isLoading}>
              Save Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diff / Comparison Dialog */}
      <Dialog
        open={Boolean(comparingSnapshot)}
        onOpenChange={(open) => !open && setComparingSnapshot(null)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-primary" />
              Diff: &quot;{comparingSnapshot?.label}&quot; vs Current Script
            </DialogTitle>
            {diffResult && (
              <div className="flex items-center gap-3 text-xs pt-1">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <PlusCircle className="w-3.5 h-3.5" /> +{diffResult.stats.wordsAdded} words
                </span>
                <span className="flex items-center gap-1 text-red-500 font-semibold">
                  <MinusCircle className="w-3.5 h-3.5" /> -{diffResult.stats.wordsDeleted} words
                </span>
                <span className="text-muted-foreground">
                  Net: {diffResult.stats.netWords >= 0 ? '+' : ''}
                  {diffResult.stats.netWords} words
                </span>
                <span className="text-muted-foreground">
                  ({diffResult.stats.elementsChanged} elements changed)
                </span>
              </div>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1 border rounded-md p-3 my-2 font-mono text-xs bg-muted/20">
            {diffResult?.items.map((item, idx) => {
              if (item.type === 'unchanged') {
                return (
                  <div key={idx} className="text-muted-foreground/60 py-0.5 truncate text-[11px]">
                    <span className="inline-block w-6 text-muted-foreground/40">{idx + 1}</span>
                    <span className="text-[10px] uppercase text-muted-foreground/40 mr-2">
                      [{item.elementType}]
                    </span>
                    {item.newText}
                  </div>
                )
              }

              if (item.type === 'added') {
                return (
                  <div
                    key={idx}
                    className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-1 my-1 rounded border-l-2 border-emerald-500"
                  >
                    <span className="inline-block w-6 font-bold">+</span>
                    <span className="text-[10px] uppercase font-bold mr-2">
                      [{item.elementType}]
                    </span>
                    {item.newText}
                  </div>
                )
              }

              if (item.type === 'deleted') {
                return (
                  <div
                    key={idx}
                    className="bg-red-500/10 text-red-700 dark:text-red-300 px-2 py-1 my-1 rounded border-l-2 border-red-500 line-through opacity-80"
                  >
                    <span className="inline-block w-6 font-bold">-</span>
                    <span className="text-[10px] uppercase font-bold mr-2">
                      [{item.elementType}]
                    </span>
                    {item.oldText}
                  </div>
                )
              }

              return (
                <div
                  key={idx}
                  className="bg-amber-500/10 px-2 py-1 my-1 rounded border-l-2 border-amber-500 space-y-1"
                >
                  <div className="line-through text-red-600 dark:text-red-400 opacity-80 text-[11px]">
                    <span className="inline-block w-6 font-bold">-</span>
                    <span className="text-[10px] uppercase font-bold mr-2">
                      [{item.elementType}]
                    </span>
                    {item.oldText}
                  </div>
                  <div className="text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                    <span className="inline-block w-6 font-bold">+</span>
                    <span className="text-[10px] uppercase font-bold mr-2">
                      [{item.elementType}]
                    </span>
                    {item.newText}
                  </div>
                </div>
              )
            })}
          </ScrollArea>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              variant="outline"
              size="xs"
              onClick={() => comparingSnapshot && handleRestore(comparingSnapshot)}
              className="gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Restore to This Revision</span>
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setComparingSnapshot(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
