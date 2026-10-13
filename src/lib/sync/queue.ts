/**
 * Local-First Sync Operation Queue (SYNC-004)
 * Buffers local writes in IndexedDB and syncs to Supabase with retry backoff.
 */

import type { EntityId, Timestamp, SyncOperation } from '@/types'
import { db, generateId } from '@/lib/db'
import { getSupabaseClient, getCurrentUser } from '@/lib/supabase'
import type { SyncResult, SyncConflict } from './types'

const MAX_RETRIES = 5

/**
 * Enqueues a sync operation in IndexedDB.
 */
export async function enqueueSyncOp(
  projectId: EntityId,
  entityType: SyncOperation['entityType'],
  entityId: EntityId,
  operation: SyncOperation['operation'],
  payload?: any,
  version: number = 1
): Promise<SyncOperation> {
  const op: SyncOperation = {
    id: generateId(),
    projectId,
    entityType,
    entityId,
    operation,
    payload: payload || {},
    version,
    retries: 0,
    createdAt: Date.now() as Timestamp,
  }

  await db.syncOperations.add(op)
  return op
}

/**
 * Processes all pending sync operations in the queue.
 */
export async function processSyncQueue(): Promise<SyncResult> {
  // If browser is offline, exit cleanly
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: true, processedCount: 0, failedCount: 0, conflicts: [] }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    // Supabase not configured: local-only mode
    return { success: true, processedCount: 0, failedCount: 0, conflicts: [] }
  }

  const user = await getCurrentUser()
  if (!user) {
    // User not authenticated
    return { success: true, processedCount: 0, failedCount: 0, conflicts: [] }
  }

  const pendingOps = await db.syncOperations.orderBy('createdAt').toArray()
  if (pendingOps.length === 0) {
    return { success: true, processedCount: 0, failedCount: 0, conflicts: [] }
  }

  let processedCount = 0
  let failedCount = 0
  const conflicts: SyncConflict[] = []

  for (const op of pendingOps) {
    try {
      const result = await executeSyncOp(op, user.id, supabase)

      if (result.conflict) {
        conflicts.push(result.conflict)
      } else {
        // Successfully synced - remove from local queue
        await db.syncOperations.delete(op.id)
        processedCount++
      }
    } catch (err) {
      console.error(`[SyncQueue] Operation ${op.id} failed:`, err)
      failedCount++

      const newRetries = (op.retries || 0) + 1
      if (newRetries >= MAX_RETRIES) {
        await db.syncOperations.update(op.id, {
          retries: newRetries,
          lastError: (err as Error).message,
        })
      } else {
        await db.syncOperations.update(op.id, {
          retries: newRetries,
          lastError: (err as Error).message,
        })
      }
    }
  }

  return {
    success: failedCount === 0,
    processedCount,
    failedCount,
    conflicts,
  }
}

/**
 * Executes a single sync operation against Supabase.
 */
async function executeSyncOp(
  op: SyncOperation,
  userId: string,
  supabase: any
): Promise<{ conflict?: SyncConflict }> {
  const tableName = getTableName(op.entityType)
  if (!tableName) return {}

  if (op.operation === 'delete') {
    const { error } = await supabase.from(tableName).delete().eq('id', op.entityId)
    if (error) throw error
    return {}
  }

  // Create or Update: Fetch remote version for conflict detection
  const { data: remoteData, error: fetchError } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', op.entityId)
    .maybeSingle()

  if (fetchError) throw fetchError

  // Fetch current local entity
  const localTable = db.table(getDexieTableName(op.entityType))
  const localData = await localTable.get(op.entityId)

  if (!localData) {
    // Entity was deleted locally in the meantime
    return {}
  }

  // Conflict detection: If remote exists and was updated after local operation was queued
  if (remoteData && remoteData.updated_at) {
    const remoteTime = new Date(remoteData.updated_at).getTime()
    const localTime = localData.updatedAt || localData.createdAt || 0

    // If remote has newer changes and payload differs
    if (remoteTime > localTime && JSON.stringify(remoteData) !== JSON.stringify(localData)) {
      const conflict: SyncConflict = {
        id: generateId(),
        projectId: op.projectId,
        entityType: op.entityType,
        entityId: op.entityId,
        localData,
        remoteData,
        localUpdatedAt: localTime as Timestamp,
        remoteUpdatedAt: remoteTime as Timestamp,
        detectedAt: Date.now() as Timestamp,
      }
      return { conflict }
    }
  }

  // Map to Supabase table row format
  const row = mapToRemoteRow(op.entityType, localData, userId)

  const { error: upsertError } = await supabase.from(tableName).upsert(row)
  if (upsertError) throw upsertError

  return {}
}

function getTableName(entityType: SyncOperation['entityType']): string | null {
  switch (entityType) {
    case 'project':
      return 'projects'
    case 'draft':
      return 'drafts'
    case 'screenplay':
      return 'screenplays'
    case 'revision':
      return 'revisions'
    default:
      return null
  }
}

function getDexieTableName(entityType: SyncOperation['entityType']): string {
  switch (entityType) {
    case 'project':
      return 'projects'
    case 'draft':
      return 'drafts'
    case 'screenplay':
      return 'screenplays'
    case 'revision':
      return 'revisions'
    case 'character':
      return 'characters'
    case 'location':
      return 'locations'
    case 'note':
      return 'notes'
    default:
      return 'projects'
  }
}

function mapToRemoteRow(
  entityType: SyncOperation['entityType'],
  data: any,
  userId: string
): Record<string, unknown> {
  const base = {
    id: data.id,
    user_id: userId,
    updated_at: new Date(data.updatedAt || Date.now()).toISOString(),
  }

  switch (entityType) {
    case 'project':
      return {
        ...base,
        name: data.name,
        status: data.status,
        logline: data.logline,
        genre: data.genre,
        target_length: data.targetLength,
        settings: data.settings || {},
      }
    case 'draft':
      return {
        ...base,
        project_id: data.projectId,
        name: data.name,
        description: data.description,
        is_current: data.isCurrent,
        screenplay_id: data.screenplayId,
      }
    case 'screenplay':
      return {
        ...base,
        project_id: data.projectId,
        draft_id: data.draftId,
        metadata: data.metadata || {},
        elements: data.elements || [],
        schema_version: data.schemaVersion || 1,
      }
    case 'revision':
      return {
        ...base,
        project_id: data.projectId,
        draft_id: data.draftId,
        screenplay_id: data.screenplayId,
        label: data.label,
        description: data.description,
        document: data.document,
        word_count: data.wordCount,
        char_count: data.charCount,
        created_by: data.createdBy,
        created_at: new Date(data.createdAt || Date.now()).toISOString(),
      }
    default:
      return base
  }
}
