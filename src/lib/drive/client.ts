/**
 * Google Drive API Client (DRV-002, DRV-005)
 * Communicates with Google Drive v3 REST API using drive.file scope.
 */

import type { EntityId } from '@/types'
import type { DriveFileMetadata, DriveAuthState, DriveExportFormat } from './types'

const DRIVE_AUTH_STORAGE_KEY = 'screenplay_studio_drive_auth'
const APP_FOLDER_NAME = 'Screenplay Studio'
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

// ============================================================================
// Auth State Management
// ============================================================================

export function getDriveAuthState(): DriveAuthState {
  try {
    const raw = localStorage.getItem(DRIVE_AUTH_STORAGE_KEY)
    if (!raw) return { isConnected: false, accessToken: null, tokenExpiresAt: null }
    const parsed = JSON.parse(raw)
    const isExpired = parsed.tokenExpiresAt ? Date.now() > parsed.tokenExpiresAt : false
    return {
      ...parsed,
      isConnected: Boolean(parsed.accessToken && !isExpired),
    }
  } catch {
    return { isConnected: false, accessToken: null, tokenExpiresAt: null }
  }
}

export function saveDriveAuthState(state: Partial<DriveAuthState>): void {
  const current = getDriveAuthState()
  const updated = { ...current, ...state }
  localStorage.setItem(DRIVE_AUTH_STORAGE_KEY, JSON.stringify(updated))
}

export function disconnectGoogleDrive(): void {
  localStorage.removeItem(DRIVE_AUTH_STORAGE_KEY)
}

// ============================================================================
// Google OAuth Flow (drive.file scope)
// ============================================================================

export async function requestGoogleDriveAccess(clientId?: string): Promise<{ success: boolean; error?: string }> {
  const resolvedClientId = clientId || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string)
  if (!resolvedClientId) {
    return {
      success: false,
      error: 'Google Client ID not configured. Please add VITE_GOOGLE_CLIENT_ID to .env or settings.',
    }
  }

  return new Promise((resolve) => {
    // Check if Google Identity Services script is loaded
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: resolvedClientId,
        scope: DRIVE_FILE_SCOPE,
        callback: (response: any) => {
          if (response.error) {
            resolve({ success: false, error: response.error })
            return
          }

          const expiresAt = Date.now() + (parseInt(response.expires_in, 10) || 3600) * 1000
          saveDriveAuthState({
            isConnected: true,
            accessToken: response.access_token,
            tokenExpiresAt: expiresAt,
          })
          resolve({ success: true })
        },
      })
      client.requestAccessToken({ prompt: 'consent' })
    } else {
      // Fallback: simulated connection or token prompt
      resolve({
        success: false,
        error: 'Google Identity Services library not yet loaded. Please check your network connection.',
      })
    }
  })
}

// ============================================================================
// Drive REST Operations
// ============================================================================

/**
 * Gets or creates the dedicated "Screenplay Studio" folder in user's Google Drive.
 */
export async function getOrCreateAppFolder(accessToken: string): Promise<string> {
  // 1. Search for existing folder
  const query = `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!searchRes.ok) {
    throw new Error(`Failed to query Google Drive folder: ${searchRes.statusText}`)
  }

  const searchData = await searchRes.json()
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id
  }

  // 2. Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })

  if (!createRes.ok) {
    throw new Error(`Failed to create Google Drive folder: ${createRes.statusText}`)
  }

  const newFolder = await createRes.json()
  return newFolder.id
}

/**
 * Uploads a file (PDF, Fountain, FDX, JSON) to the Screenplay Studio Google Drive folder.
 */
export async function uploadToGoogleDrive(params: {
  filename: string
  blob: Blob
  format: DriveExportFormat
  projectId?: EntityId
}): Promise<DriveFileMetadata> {
  const auth = getDriveAuthState()
  if (!auth.accessToken || !auth.isConnected) {
    throw new Error('Not connected to Google Drive')
  }

  const folderId = await getOrCreateAppFolder(auth.accessToken)

  // Multipart upload metadata
  const metadata = {
    name: params.filename,
    parents: [folderId],
    description: `Exported from Screenplay Studio (${params.format})`,
    properties: {
      source: 'ScreenplayStudio',
      format: params.format,
      projectId: params.projectId || '',
    },
  }

  const formData = new FormData()
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' })
  )
  formData.append('file', params.blob)

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: formData,
    }
  )

  if (!uploadRes.ok) {
    const errorJson = await uploadRes.json().catch(() => ({}))
    const msg = errorJson.error?.message || uploadRes.statusText
    throw new Error(`Google Drive upload failed: ${msg}`)
  }

  const result = await uploadRes.json()

  // Track last sync time
  saveDriveAuthState({ lastSyncAt: Date.now() as any })

  return {
    id: result.id,
    name: result.name,
    mimeType: result.mimeType,
    exportFormat: params.format,
    size: parseInt(result.size, 10) || params.blob.size,
    createdTime: result.createdTime,
    webViewLink: result.webViewLink,
    projectId: params.projectId,
  }
}

/**
 * Lists files created in user's Screenplay Studio Google Drive folder.
 */
export async function listDriveFiles(): Promise<DriveFileMetadata[]> {
  const auth = getDriveAuthState()
  if (!auth.accessToken || !auth.isConnected) return []

  try {
    const folderId = await getOrCreateAppFolder(auth.accessToken)
    const query = `'${folderId}' in parents and trashed=false`
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,properties)&orderBy=modifiedTime desc`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })

    if (!res.ok) return []

    const data = await res.json()
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      exportFormat: (f.properties?.format as DriveExportFormat) || 'PDF',
      size: parseInt(f.size, 10) || 0,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
      projectId: f.properties?.projectId,
    }))
  } catch (err) {
    console.error('[GoogleDrive] List error:', err)
    return []
  }
}
