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
// Google Identity Services Loader & Client ID Resolution
// ============================================================================

export function getResolvedGoogleClientId(customId?: string): string {
  if (customId && customId.trim()) return customId.trim()
  try {
    const saved = localStorage.getItem('screenplay_studio_google_client_id')
    if (saved && saved.trim()) return saved.trim()
  } catch {
    // Ignore storage errors
  }
  return (
    (import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID as string) ||
    (import.meta.env.GOOGLE_DRIVE_CLIENT_ID as string) ||
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
    ''
  ).trim()
}

export function saveCustomGoogleClientId(clientId: string): void {
  try {
    if (clientId.trim()) {
      localStorage.setItem('screenplay_studio_google_client_id', clientId.trim())
    } else {
      localStorage.removeItem('screenplay_studio_google_client_id')
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadGsiScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve(true)

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
    if (existing) {
      let attempts = 0
      const interval = setInterval(() => {
        attempts++
        if ((window as any).google?.accounts?.oauth2) {
          clearInterval(interval)
          resolve(true)
        } else if (attempts >= 40) {
          clearInterval(interval)
          resolve(false)
        }
      }, 100)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      let attempts = 0
      const interval = setInterval(() => {
        attempts++
        if ((window as any).google?.accounts?.oauth2) {
          clearInterval(interval)
          resolve(true)
        } else if (attempts >= 40) {
          clearInterval(interval)
          resolve(false)
        }
      }, 100)
    }
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

// ============================================================================
// Google OAuth Flow (drive.file scope)
// ============================================================================

export async function requestGoogleDriveAccess(clientId?: string): Promise<{ success: boolean; error?: string }> {
  const resolvedClientId = getResolvedGoogleClientId(clientId)
  if (!resolvedClientId) {
    return {
      success: false,
      error: 'Google Client ID not configured. Please add VITE_GOOGLE_CLIENT_ID or GOOGLE_DRIVE_CLIENT_ID to .env or Settings.',
    }
  }

  // Ensure Google Identity Services script is loaded
  const isLoaded = await loadGsiScript()
  if (!isLoaded || !(window as any).google?.accounts?.oauth2) {
    return {
      success: false,
      error: 'Google Identity Services library failed to load. Please check your internet connection and ensure third-party scripts/popups are not blocked.',
    }
  }

  return new Promise((resolve) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: resolvedClientId,
        scope: DRIVE_FILE_SCOPE,
        callback: (response: any) => {
          if (response.error) {
            console.error('[Google Drive] OAuth response error:', response)
            let errMsg = response.error
            if (response.error_description) errMsg += `: ${response.error_description}`
            if (response.error === 'popup_closed_by_user') {
              errMsg = 'Sign-in popup was closed before completing authorization.'
            } else if (response.error === 'access_denied') {
              errMsg = 'Access blocked (Error 403: access_denied). In Google Cloud Console > OAuth consent screen > "Test users", add your email address as a developer-approved tester, or publish the app.'
            }
            resolve({ success: false, error: errMsg })
            return
          }

          if (!response.access_token) {
            resolve({ success: false, error: 'No access token received from Google.' })
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
        error_callback: (err: any) => {
          console.error('[Google Drive] Token client error:', err)
          let msg = err.message || err.type || 'Google authorization failed.'
          if (err.type === 'popup_blocked') {
            msg = 'Popup was blocked by your browser. Please allow popups for this site and retry.'
          }
          resolve({ success: false, error: msg })
        },
      })

      client.requestAccessToken({ prompt: 'consent' })
    } catch (err) {
      console.error('[Google Drive] Exception initiating OAuth:', err)
      resolve({ success: false, error: (err as Error).message })
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
