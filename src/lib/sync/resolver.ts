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
        ...conflict.localData,
        updated_at: nowIso,
      }
      await supabase.from(tableName).upsert(row)
    }
  } else if (choice === 'keep_remote') {
    // Overwrite local with remote copy
    await dexieTable.put({
      ...conflict.remoteData,
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
      ...conflict.remoteData,
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
