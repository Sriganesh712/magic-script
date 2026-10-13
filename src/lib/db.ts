/**
 * IndexedDB Database Configuration using Dexie
 * Schema version: 1
 * Provides local-first persistence for Screenplay Studio
 */

import Dexie, { type Table } from 'dexie'
import type {
  EntityId,
  Timestamp,
  Project,
  Draft,
  ScreenplayDocument,
  Character,
  Location,
  Prop,
  Note,
  RevisionSnapshot,
  SceneCard,
  WritingSession,
  DailyStats,
  WritingGoal,
  ActivityEvent,
  SyncOperation,
} from '@/types'

// ============================================================================
// Database Class
// ============================================================================

export class ScreenplayStudioDB extends Dexie {
  // Core entities
  projects!: Table<Project>
  drafts!: Table<Draft>
  screenplays!: Table<ScreenplayDocument>
  characters!: Table<Character>
  locations!: Table<Location>
  props!: Table<Prop>
  notes!: Table<Note>
  revisions!: Table<RevisionSnapshot>
  sceneCards!: Table<SceneCard>

  // Analytics
  writingSessions!: Table<WritingSession>
  dailyStats!: Table<DailyStats>
  writingGoals!: Table<WritingGoal>
  activityEvents!: Table<ActivityEvent>

  // Sync
  syncOperations!: Table<SyncOperation>

  constructor() {
    super('ScreenplayStudioDB')

    // Define schema version 1
    this.version(1).stores({
      // Core: primary key, then indexes for common queries
      projects: 'id, status, updatedAt, name',
      drafts: 'id, projectId, isCurrent, updatedAt',
      screenplays: 'id, projectId, draftId, updatedAt',
      characters: 'id, projectId, name, dialogueCount',
      locations: 'id, projectId, name, type',
      props: 'id, projectId, name',
      notes: 'id, projectId, sceneId, type, updatedAt',
      revisions: 'id, projectId, draftId, screenplayId, createdAt',
      sceneCards: 'id, projectId, screenplayId, order, elementId',

      // Analytics
      writingSessions: 'id, projectId, draftId, startTime, countsForStreak',
      dailyStats: 'id, projectId, date',
      writingGoals: 'id, projectId, type, isActive, startDate, endDate',
      activityEvents: 'id, projectId, draftId, type, timestamp',

      // Sync
      syncOperations: 'id, projectId, entityType, entityId, createdAt, retries',
    })

    // Hooks for automatic timestamps
    this.projects.hook('creating', (_primKey, obj) => {
      const now = Date.now() as Timestamp
      obj.createdAt = now
      obj.updatedAt = now
    })
    this.projects.hook('updating', (modifications) => {
      (modifications as Record<string, unknown>).updatedAt = Date.now() as Timestamp
    })

    this.drafts.hook('creating', (_primKey, obj) => {
      const now = Date.now() as Timestamp
      obj.createdAt = now
      obj.updatedAt = now
    })
    this.drafts.hook('updating', (modifications) => {
      (modifications as Record<string, unknown>).updatedAt = Date.now() as Timestamp
    })

    this.screenplays.hook('creating', (_primKey, obj) => {
      const now = Date.now() as Timestamp
      obj.createdAt = now
      obj.updatedAt = now
    })
    this.screenplays.hook('updating', (modifications) => {
      (modifications as Record<string, unknown>).updatedAt = Date.now() as Timestamp
    })

    this.characters.hook('creating', (_primKey, obj) => {
      const now = Date.now() as Timestamp
      obj.createdAt = now
      obj.updatedAt = now
    })
    this.characters.hook('updating', (modifications) => {
      (modifications as Record<string, unknown>).updatedAt = Date.now() as Timestamp
    })

    this.locations.hook('creating', (_primKey, obj) => {
      const now = Date.now() as Timestamp
      obj.createdAt = now
      obj.updatedAt = now
    })
    this.locations.hook('updating', (modifications) => {
      (modifications as Record<string, unknown>).updatedAt = Date.now() as Timestamp
    })

    this.notes.hook('creating', (_primKey, obj) => {
      const now = Date.now() as Timestamp
      obj.createdAt = now
      obj.updatedAt = now
    })
    this.notes.hook('updating', (modifications) => {
      (modifications as Record<string, unknown>).updatedAt = Date.now() as Timestamp
    })

    this.sceneCards.hook('creating', (_primKey, obj) => {
      const now = Date.now() as Timestamp
      obj.createdAt = now
      obj.updatedAt = now
    })
    this.sceneCards.hook('updating', (modifications) => {
      (modifications as Record<string, unknown>).updatedAt = Date.now() as Timestamp
    })

    // Sync operations hook
    this.syncOperations.hook('creating', (_primKey, obj) => {
      obj.createdAt = Date.now() as Timestamp
      obj.retries = 0
    })
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const db = new ScreenplayStudioDB()

// ============================================================================
// Database Initialization
// ============================================================================

let dbInitialized = false

export async function initDB(): Promise<void> {
  if (dbInitialized) return

  try {
    await db.open()
    dbInitialized = true
    console.log('[DB] ScreenplayStudioDB opened successfully')
  } catch (error) {
    console.error('[DB] Failed to open database:', error)
    throw error
  }
}

export async function closeDB(): Promise<void> {
  if (dbInitialized) {
    await db.close()
    dbInitialized = false
    console.log('[DB] ScreenplayStudioDB closed')
  }
}

export function isDBOpen(): boolean {
  return dbInitialized && db.isOpen()
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Generate a new EntityId */
export function generateId(): EntityId {
  return `id_${Date.now()}_${Math.random().toString(36).substring(2, 15)}` as EntityId
}

/** Clear all data (for testing/reset) */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [...db.tables], async () => {
    await Promise.all(db.tables.map(table => table.clear()))
  })
  console.log('[DB] All data cleared')
}

/** Export all data as JSON (for backup) */
export async function exportAllData(): Promise<string> {
  const data = await db.transaction('r', [...db.tables], async () => {
    const result: Record<string, unknown[]> = {}
    for (const table of db.tables) {
      result[table.name] = await table.toArray()
    }
    return result
  })
  return JSON.stringify(data, null, 2)
}

/** Import data from JSON backup */
export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json)
  await db.transaction('rw', [...db.tables], async () => {
    for (const [tableName, records] of Object.entries(data)) {
      const table = db.table(tableName)
      if (table) {
        await table.clear()
        await table.bulkPut(records as Record<string, unknown>[])
      }
    }
  })
  console.log('[DB] Data imported successfully')
}

/** Get database size estimate */
export async function getDBSize(): Promise<{ used: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    }
  }
  return { used: 0, quota: 0 }
}

// ============================================================================
// Common Queries
// ============================================================================

/** Get all projects sorted by updatedAt desc */
export async function getAllProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray()
}

/** Get project by ID */
export async function getProject(id: EntityId): Promise<Project | undefined> {
  return db.projects.get(id)
}

/** Get current draft for a project */
export async function getCurrentDraft(projectId: EntityId): Promise<Draft | undefined> {
  return db.drafts.where('projectId').equals(projectId).and(d => d.isCurrent).first()
}

/** Get screenplay for a draft */
export async function getScreenplay(draftId: EntityId): Promise<ScreenplayDocument | undefined> {
  return db.screenplays.where('draftId').equals(draftId).first()
}

/** Get all characters for a project */
export async function getProjectCharacters(projectId: EntityId): Promise<Character[]> {
  return db.characters.where('projectId').equals(projectId).toArray()
}

/** Get all locations for a project */
export async function getProjectLocations(projectId: EntityId): Promise<Location[]> {
  return db.locations.where('projectId').equals(projectId).toArray()
}

/** Get scene cards for a screenplay in order */
export async function getSceneCards(screenplayId: EntityId): Promise<SceneCard[]> {
  return db.sceneCards.where('screenplayId').equals(screenplayId).sortBy('order')
}

/** Get notes for a scene */
export async function getSceneNotes(sceneId: EntityId): Promise<Note[]> {
  return db.notes.where('sceneId').equals(sceneId).toArray()
}

/** Get project notes (not tied to a scene) */
export async function getProjectNotes(projectId: EntityId): Promise<Note[]> {
  return db.notes.where('projectId').equals(projectId).and(n => !n.sceneId).toArray()
}

/** Get pending sync operations */
export async function getPendingSyncOps(projectId?: EntityId): Promise<SyncOperation[]> {
  let query = db.syncOperations.orderBy('createdAt')
  if (projectId) {
    query = query.filter(op => op.projectId === projectId)
  }
  return query.toArray()
}

/** Get activity events for a project */
export async function getProjectActivityEvents(projectId: EntityId, limit = 100): Promise<ActivityEvent[]> {
  return db.activityEvents
    .where('projectId')
    .equals(projectId)
    .reverse()
    .limit(limit)
    .toArray()
}