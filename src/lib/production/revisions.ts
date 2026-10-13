/**
 * Revision Management and Diff Engine (REV-005)
 * Handles historical snapshots, visual side-by-side element diffing, and 1-click restore.
 */

import type {
  EntityId,
  Timestamp,
  ScreenplayDocument,
  ScreenplayElement,
  RevisionSnapshot,
} from '@/types'
import { db, generateId } from '@/lib/db'
import { countWords, diffWords } from '@/lib/analytics/word-diff'
import { elementsToHtml } from '@/lib/export/html-converter'

// ============================================================================
// Types
// ============================================================================

export type DiffChangeType = 'added' | 'deleted' | 'modified' | 'unchanged'

export interface ElementDiffItem {
  type: DiffChangeType
  elementType?: string
  oldText?: string
  newText?: string
  wordDelta: number
}

export interface DocumentDiffResult {
  stats: {
    wordsAdded: number
    wordsDeleted: number
    netWords: number
    elementsChanged: number
  }
  items: ElementDiffItem[]
}

// ============================================================================
// Snapshot Creation & Retrieval
// ============================================================================

/**
 * Creates a revision snapshot for the given screenplay.
 */
export async function createRevisionSnapshot(params: {
  projectId: EntityId
  draftId: EntityId
  screenplayId: EntityId
  label: string
  description?: string
  document: ScreenplayDocument
  createdBy?: 'user' | 'auto' | 'import'
}): Promise<RevisionSnapshot> {
  const { projectId, draftId, screenplayId, label, description, document, createdBy = 'user' } = params

  // Calculate word and character count across elements
  let totalWords = 0
  let totalChars = 0

  for (const el of document.elements) {
    const text = 'text' in el ? (el as { text: string }).text : 'location' in el ? (el as { location: string }).location : ''
    totalWords += countWords(text)
    totalChars += text.length
  }

  const now = Date.now() as Timestamp
  const snapshot: RevisionSnapshot = {
    id: generateId(),
    projectId,
    draftId,
    screenplayId,
    label: label.trim() || `Revision ${new Date().toLocaleDateString()}`,
    description: description?.trim() || undefined,
    document: JSON.parse(JSON.stringify(document)), // deep clone
    wordCount: totalWords,
    charCount: totalChars,
    createdAt: now,
    createdBy,
  }

  await db.revisions.add(snapshot)
  return snapshot
}

/**
 * Lists all snapshots for a project or screenplay, newest first.
 */
export async function getRevisionSnapshots(
  projectId: EntityId,
  screenplayId?: EntityId
): Promise<RevisionSnapshot[]> {
  let query = db.revisions.where('projectId').equals(projectId)
  const snapshots = await query.toArray()

  const filtered = screenplayId
    ? snapshots.filter((s) => s.screenplayId === screenplayId)
    : snapshots

  return filtered.sort((a, b) => (b.createdAt as number) - (a.createdAt as number))
}

/**
 * Deletes a snapshot by ID.
 */
export async function deleteRevisionSnapshot(snapshotId: EntityId): Promise<void> {
  await db.revisions.delete(snapshotId)
}

/**
 * Restores a snapshot by copying its elements to the screenplay document in IndexedDB.
 * Returns the restored ScreenplayDocument.
 */
export async function restoreRevisionSnapshot(
  snapshotId: EntityId
): Promise<{ restoredDoc: ScreenplayDocument; htmlContent: string }> {
  const snapshot = await db.revisions.get(snapshotId)
  if (!snapshot) {
    throw new Error(`Snapshot ${snapshotId} not found`)
  }

  const targetScreenplay = await db.screenplays.get(snapshot.screenplayId)
  if (!targetScreenplay) {
    throw new Error(`Target screenplay ${snapshot.screenplayId} not found`)
  }

  const now = Date.now() as Timestamp
  const restoredDoc: ScreenplayDocument = {
    ...targetScreenplay,
    elements: JSON.parse(JSON.stringify(snapshot.document.elements)),
    updatedAt: now,
  }

  // Update screenplay in DB
  await db.screenplays.put(restoredDoc)

  // Convert elements to HTML for editor consumption
  const htmlContent = elementsToHtml(restoredDoc.elements)

  return { restoredDoc, htmlContent }
}

// ============================================================================
// Document Diff Engine
// ============================================================================

function getElementDisplayText(el: ScreenplayElement): string {
  if ('text' in el) return (el as { text: string }).text || ''
  if ('location' in el) {
    const heading = el as { interior?: string; location?: string; timeOfDay?: string }
    return `${heading.interior || 'INT'}. ${heading.location || ''} - ${heading.timeOfDay || 'DAY'}`
  }
  if ('name' in el) return (el as { name: string }).name || ''
  return ''
}

/**
 * Compares two ScreenplayDocument versions and produces an element-by-element diff
 * along with word-level additions/deletions stats.
 */
export function diffRevisionDocuments(
  oldDoc: ScreenplayDocument,
  newDoc: ScreenplayDocument
): DocumentDiffResult {
  const oldElements = oldDoc.elements || []
  const newElements = newDoc.elements || []

  const oldText = oldElements.map(getElementDisplayText).join('\n')
  const newText = newElements.map(getElementDisplayText).join('\n')
  const wordStats = diffWords(oldText, newText)

  const items: ElementDiffItem[] = []
  const maxLen = Math.max(oldElements.length, newElements.length)

  // Use ID or position matching for element diff
  const oldMap = new Map<EntityId, { el: ScreenplayElement; index: number }>()
  oldElements.forEach((el, index) => oldMap.set(el.id, { el, index }))

  const newMap = new Map<EntityId, { el: ScreenplayElement; index: number }>()
  newElements.forEach((el, index) => newMap.set(el.id, { el, index }))

  let elementsChanged = 0

  // Walk through elements
  for (let i = 0; i < maxLen; i++) {
    const oldEl = oldElements[i]
    const newEl = newElements[i]

    if (oldEl && !newEl) {
      const text = getElementDisplayText(oldEl)
      items.push({
        type: 'deleted',
        elementType: oldEl.type,
        oldText: text,
        wordDelta: -countWords(text),
      })
      elementsChanged++
    } else if (!oldEl && newEl) {
      const text = getElementDisplayText(newEl)
      items.push({
        type: 'added',
        elementType: newEl.type,
        newText: text,
        wordDelta: countWords(text),
      })
      elementsChanged++
    } else if (oldEl && newEl) {
      const textOld = getElementDisplayText(oldEl)
      const textNew = getElementDisplayText(newEl)

      if (oldEl.type === newEl.type && textOld === textNew) {
        items.push({
          type: 'unchanged',
          elementType: oldEl.type,
          oldText: textOld,
          newText: textNew,
          wordDelta: 0,
        })
      } else {
        const delta = countWords(textNew) - countWords(textOld)
        items.push({
          type: 'modified',
          elementType: newEl.type,
          oldText: textOld,
          newText: textNew,
          wordDelta: delta,
        })
        elementsChanged++
      }
    }
  }

  return {
    stats: {
      wordsAdded: wordStats.added,
      wordsDeleted: wordStats.deleted,
      netWords: wordStats.net,
      elementsChanged,
    },
    items,
  }
}
