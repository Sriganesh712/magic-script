/**
 * Google Drive Integration Types (DRV-001, DRV-004)
 * Uses drive.file scope exclusively for secure user-owned backups.
 */

import type { EntityId, Timestamp } from '@/types'

export type DriveExportFormat = 'PDF' | 'Fountain' | 'FDX' | 'JSON'

export interface DriveFileMetadata {
  id: string
  name: string
  mimeType: string
  exportFormat: DriveExportFormat
  size?: number
  createdTime?: string
  modifiedTime?: string
  webViewLink?: string
  projectId?: EntityId
}

export interface DriveAuthState {
  isConnected: boolean
  accessToken: string | null
  tokenExpiresAt: number | null
  userEmail?: string
  lastSyncAt?: Timestamp
}
