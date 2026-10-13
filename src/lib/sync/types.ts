/**
 * Sync Engine Types (SYNC-004, SYNC-005)
 */

import type { EntityId, Timestamp, SyncOperation } from '@/types'

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncConflict<T = unknown> {
  id: string
  projectId: EntityId
  entityType: SyncOperation['entityType']
  entityId: EntityId
  localData: T
  remoteData: T
  localUpdatedAt: Timestamp
  remoteUpdatedAt: Timestamp
  detectedAt: Timestamp
}

export type ConflictResolutionChoice = 'keep_local' | 'keep_remote' | 'keep_both'

export interface SyncResult {
  success: boolean
  processedCount: number
  failedCount: number
  conflicts: SyncConflict[]
  error?: string
}
