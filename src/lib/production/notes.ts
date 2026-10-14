/**
 * Scene & Global Notes Engine (REV-004)
 * Provides CRUD, categorization (general, todo, research, idea), and search for notes.
 */

import type { EntityId, Timestamp, Note } from '@/types'
import { db, generateId } from '@/lib/db'
import { enqueueSyncOp } from '@/lib/sync'

export async function createNote(params: {
  projectId: EntityId
  sceneId?: EntityId
  content: string
  type?: 'general' | 'todo' | 'research' | 'idea'
}): Promise<Note> {
  const now = Date.now() as Timestamp
  const note: Note = {
    id: generateId(),
    projectId: params.projectId,
    sceneId: params.sceneId,
    content: params.content.trim(),
    type: params.type || 'general',
    createdAt: now,
    updatedAt: now,
  }

  await db.notes.add(note)
  await enqueueSyncOp(note.projectId, 'note', note.id, 'create', note)
  return note
}

export async function getNotesForProject(projectId: EntityId): Promise<Note[]> {
  const notes = await db.notes.where('projectId').equals(projectId).toArray()
  return notes.sort((a, b) => (b.updatedAt as number) - (a.updatedAt as number))
}

export async function getNotesForScene(sceneId: EntityId): Promise<Note[]> {
  const notes = await db.notes.where('sceneId').equals(sceneId).toArray()
  return notes.sort((a, b) => (b.updatedAt as number) - (a.updatedAt as number))
}

export async function updateNote(
  noteId: EntityId,
  updates: Partial<Pick<Note, 'content' | 'type' | 'sceneId'>>
): Promise<Note> {
  const existing = await db.notes.get(noteId)
  if (!existing) {
    throw new Error(`Note ${noteId} not found`)
  }

  const updated: Note = {
    ...existing,
    ...updates,
    updatedAt: Date.now() as Timestamp,
  }

  await db.notes.put(updated)
  await enqueueSyncOp(updated.projectId, 'note', updated.id, 'update', updated)
  return updated
}

export async function deleteNote(noteId: EntityId): Promise<void> {
  const existing = await db.notes.get(noteId)
  await db.notes.delete(noteId)
  if (existing) {
    await enqueueSyncOp(existing.projectId, 'note', noteId, 'delete')
  }
}

export function filterNotes(notes: Note[], query: string, typeFilter?: string): Note[] {
  const q = query.trim().toLowerCase()
  return notes.filter((n) => {
    const matchesQuery = !q || n.content.toLowerCase().includes(q)
    const matchesType = !typeFilter || typeFilter === 'all' || n.type === typeFilter
    return matchesQuery && matchesType
  })
}
