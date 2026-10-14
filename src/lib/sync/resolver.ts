/**
 * Conflict Detection and Resolution Engine (SYNC-005)
 * Prevents silent last-write-wins by providing explicit resolution strategies.
 */

import type { Timestamp } from '@/types'
import { db, generateId } from '@/lib/db'
import { getSupabaseClient } from '@/lib/supabase'
import type { SyncConflict, ConflictResolutionChoice } from './types'

/**
 * Resolves a sync conflict according to the user's explicit choice.
 */
export async function resolveConflict(
  conflict: SyncConflict<any>,
  choice: ConflictResolutionChoice
): Promise<void> {
  const supabase = getSupabaseClient()
  const tableName = getTableName(conflict.entityType)
  const dexieTable = db.table(getDexieTableName(conflict.entityType))

  if (choice === 'keep_local') {
    // Overwrite remote with local copy
    if (supabase && tableName) {
      const nowIso = new Date().toISOString()
      const row = {
        ...mapLocalToRemote(conflict.entityType, conflict.localData),
        updated_at: nowIso,
      }
      await supabase.from(tableName).upsert(row)
    }
  } else if (choice === 'keep_remote') {
    // Overwrite local with remote copy
    await dexieTable.put({
      ...mapRemoteToLocal(conflict.remoteData),
      updatedAt: Date.now() as Timestamp,
    })
  } else if (choice === 'keep_both') {
    // Duplicate: Save local data with a new ID and '(Local Copy)' in name, then apply remote to current
    const duplicatedLocal = {
      ...conflict.localData,
      id: generateId(),
      name: `${conflict.localData.name || 'Screenplay'} (Local Copy)`,
      updatedAt: Date.now() as Timestamp,
    }
    await dexieTable.add(duplicatedLocal)

    // Put remote data into original ID
    await dexieTable.put({
      ...mapRemoteToLocal(conflict.remoteData),
      updatedAt: Date.now() as Timestamp,
    })
  }

  // Remove any remaining failed sync operation for this entity
  await db.syncOperations.where('entityId').equals(conflict.entityId).delete()
}

function getTableName(entityType: string): string | null {
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

function getDexieTableName(entityType: string): string {
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
      return 'projects'
  }
}

function mapRemoteToLocal(data: any): any {
  if (!data || typeof data !== 'object') return data
  return {
    ...data,
    projectId: data.projectId ?? data.project_id,
    draftId: data.draftId ?? data.draft_id,
    screenplayId: data.screenplayId ?? data.screenplay_id,
    isCurrent: data.isCurrent ?? data.is_current,
    targetLength: data.targetLength ?? data.target_length,
    schemaVersion: data.schemaVersion ?? data.schema_version,
    createdAt: data.createdAt ?? data.created_at,
    updatedAt: data.updatedAt ?? data.updated_at,
  }
}

function mapLocalToRemote(entityType: string, data: any): any {
  const base = {
    id: data.id,
    project_id: data.projectId,
    draft_id: data.draftId,
    screenplay_id: data.screenplayId,
    user_id: data.userId,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  }
  switch (entityType) {
    case 'project':
      return { ...base, name: data.name, status: data.status, logline: data.logline, genre: data.genre, target_length: data.targetLength, settings: data.settings }
    case 'draft':
      return { ...base, name: data.name, description: data.description, is_current: data.isCurrent, screenplay_id: data.screenplayId }
    case 'screenplay':
      return { ...base, metadata: data.metadata, elements: data.elements, schema_version: data.schemaVersion }
    case 'revision':
      return { ...base, label: data.label, description: data.description, document: data.document, word_count: data.wordCount, char_count: data.charCount, created_by: data.createdBy }
    case 'note':
      return { ...base, scene_id: data.sceneId, content: data.content, type: data.type }
    default:
      return data
  }
}
