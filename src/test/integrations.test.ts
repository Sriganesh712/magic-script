import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  enqueueSyncOp,
  resolveConflict,
  type SyncConflict,
} from '@/lib/sync'
import {
  getDriveAuthState,
  saveDriveAuthState,
  disconnectGoogleDrive,
  getResolvedGoogleClientId,
  saveCustomGoogleClientId,
  getOrCreateAppFolder,
  uploadToGoogleDrive,
  listDriveFiles,
} from '@/lib/drive'
import { exchangeCodeForSession } from '@/lib/supabase'
import {
  buildCompactStoryBible,
  computeTaskHash,
  getCachedResult,
  setCachedResult,
  clearAiCache,
  deduplicateInFlight,
  isGroqConfigured,
} from '@/lib/ai'
import type { EntityId, Project, Character, Location, Timestamp } from '@/types'
import { db, initDB } from '@/lib/db'

describe('Cloud Sync, Drive & AI Integrations (SYNC, DRV, AI)', () => {
  beforeEach(async () => {
    await initDB()
    clearAiCache()
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('Sync Operation Queue & Conflict Resolution (SYNC-004, SYNC-005)', () => {
    const dummyProjectId = 'proj_sync_1' as EntityId
    const dummyEntityId = 'ent_sync_1' as EntityId

    it('enqueues a local sync operation into IndexedDB', async () => {
      const op = await enqueueSyncOp(
        dummyProjectId,
        'screenplay',
        dummyEntityId,
        'update',
        { test: 'data' }
      )

      expect(op.id).toBeDefined()
      expect(op.projectId).toBe(dummyProjectId)
      expect(op.entityType).toBe('screenplay')
      expect(op.operation).toBe('update')

      const stored = await db.syncOperations.get(op.id)
      expect(stored).toBeDefined()
      expect(stored?.entityId).toBe(dummyEntityId)
    })

    it('resolves conflict using keep_both by creating duplicate local copy', async () => {
      const now = Date.now() as Timestamp
      const conflict: SyncConflict<any> = {
        id: 'conf_1',
        projectId: dummyProjectId,
        entityType: 'project',
        entityId: dummyEntityId,
        localData: {
          id: dummyEntityId,
          name: 'Cyberpunk Noir',
          status: 'drafting',
          settings: {},
          createdAt: now,
          updatedAt: now,
        },
        remoteData: {
          id: dummyEntityId,
          name: 'Cyberpunk Noir (Remote Revision)',
          status: 'polishing',
          settings: {},
          createdAt: now,
          updatedAt: now,
        },
        localUpdatedAt: now,
        remoteUpdatedAt: now,
        detectedAt: now,
      }

      await resolveConflict(conflict, 'keep_both')

      // Remote data should now be at dummyEntityId
      const original = await db.projects.get(dummyEntityId)
      expect(original?.name).toBe('Cyberpunk Noir (Remote Revision)')
      expect(original?.status).toBe('polishing')

      // Local data should be duplicated with (Local Copy) in name
      const allProjects = await db.projects.toArray()
      const duplicated = allProjects.find((p) => p.name.includes('(Local Copy)'))
      expect(duplicated).toBeDefined()
      expect(duplicated?.name).toBe('Cyberpunk Noir (Local Copy)')
    })
  })

  describe('Google Drive State & Storage (DRV-001, DRV-005)', () => {
    it('initializes with disconnected state', () => {
      const auth = getDriveAuthState()
      expect(auth.isConnected).toBe(false)
      expect(auth.accessToken).toBeNull()
    })

    it('persists and clears Google Drive auth token state', () => {
      saveDriveAuthState({
        isConnected: true,
        accessToken: 'mock_token_xyz',
        tokenExpiresAt: Date.now() + 3600000,
        userEmail: 'writer@screenplay.test',
      })

      const loaded = getDriveAuthState()
      expect(loaded.isConnected).toBe(true)
      expect(loaded.accessToken).toBe('mock_token_xyz')
      expect(loaded.userEmail).toBe('writer@screenplay.test')

      disconnectGoogleDrive()
      const afterDisconnect = getDriveAuthState()
      expect(afterDisconnect.isConnected).toBe(false)
      expect(afterDisconnect.accessToken).toBeNull()
    })

    it('resolves and saves custom Google Client ID correctly', () => {
      saveCustomGoogleClientId('test-client-id-1234.apps.googleusercontent.com')
      expect(getResolvedGoogleClientId()).toBe('test-client-id-1234.apps.googleusercontent.com')

      // Clear custom ID
      saveCustomGoogleClientId('')
      expect(localStorage.getItem('screenplay_studio_google_client_id')).toBeNull()
    })
  })

  describe('Google Drive Folder Management & Multipart Upload (DRV-002, DRV-003, DRV-004)', () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
      vi.restoreAllMocks()
    })

    it('rejects upload when not connected', async () => {
      disconnectGoogleDrive()
      const dummyBlob = new Blob(['%PDF-1.4 dummy'], { type: 'application/pdf' })
      await expect(
        uploadToGoogleDrive({
          filename: 'test.pdf',
          blob: dummyBlob,
          format: 'PDF',
        })
      ).rejects.toThrow(/Not connected to Google Drive/i)
    })

    it('rejects upload and clears session when token is expired', async () => {
      saveDriveAuthState({
        isConnected: true,
        accessToken: 'expired_token',
        tokenExpiresAt: Date.now() - 5000,
      })
      const dummyBlob = new Blob(['%PDF-1.4 dummy'], { type: 'application/pdf' })
      await expect(
        uploadToGoogleDrive({
          filename: 'test.pdf',
          blob: dummyBlob,
          format: 'PDF',
        })
      ).rejects.toThrow(/session expired/i)

      expect(getDriveAuthState().isConnected).toBe(false)
    })

    it('creates Screenplay Studio folder if not found and saves folderId', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts?: any) => {
        if (url.includes('/drive/v3/files?q=')) {
          // Query for folder: returns empty
          return new Response(JSON.stringify({ files: [] }), { status: 200 })
        }
        if (url.includes('/drive/v3/files?fields=id,name') && opts?.method === 'POST') {
          // Create folder
          const body = JSON.parse(opts.body)
          expect(body.name).toBe('Screenplay Studio')
          expect(body.mimeType).toBe('application/vnd.google-apps.folder')
          return new Response(JSON.stringify({ id: 'new_folder_777', name: 'Screenplay Studio' }), {
            status: 200,
          })
        }
        return new Response('Not found', { status: 404 })
      })

      globalThis.fetch = mockFetch

      const folderId = await getOrCreateAppFolder('valid_token')
      expect(folderId).toBe('new_folder_777')
      expect(getDriveAuthState().folderId).toBe('new_folder_777')
    })

    it('validates and reuses cached folderId to avoid duplicate folder creation', async () => {
      saveDriveAuthState({
        isConnected: true,
        accessToken: 'valid_token',
        folderId: 'cached_folder_888',
      })

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/drive/v3/files/cached_folder_888')) {
          // Folder exists and not trashed
          return new Response(
            JSON.stringify({ id: 'cached_folder_888', name: 'Screenplay Studio', trashed: false }),
            { status: 200 }
          )
        }
        // Should NOT call search or create!
        throw new Error(`Unexpected fetch call to ${url}`)
      })

      globalThis.fetch = mockFetch

      const folderId = await getOrCreateAppFolder('valid_token')
      expect(folderId).toBe('cached_folder_888')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('uploads PDF blob with multipart/related payload and verifies API result', async () => {
      saveDriveAuthState({
        isConnected: true,
        accessToken: 'mock_drive_token_456',
        tokenExpiresAt: Date.now() + 3600000,
        folderId: 'folder_999',
      })

      let uploadCalled = false
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts?: any) => {
        if (url.includes('/drive/v3/files/folder_999')) {
          return new Response(
            JSON.stringify({ id: 'folder_999', name: 'Screenplay Studio', trashed: false }),
            { status: 200 }
          )
        }
        if (url.includes('uploadType=multipart')) {
          uploadCalled = true
          expect(opts.method).toBe('POST')
          expect(opts.headers.Authorization).toBe('Bearer mock_drive_token_456')
          expect(opts.headers['Content-Type']).toMatch(/^multipart\/related; boundary=/)

          // Verify body contains multipart structure
          const bodyBlob: Blob = opts.body
          const bodyText = await bodyBlob.text()
          expect(bodyText).toContain('Screenplay Studio backup (PDF)')
          expect(bodyText).toContain('"parents":["folder_999"]')
          expect(bodyText).toContain('Content-Type: application/pdf')

          return new Response(
            JSON.stringify({
              id: 'uploaded_file_doc_101',
              name: 'my_screenplay.pdf',
              mimeType: 'application/pdf',
              size: '4096',
              createdTime: new Date().toISOString(),
              webViewLink: 'https://drive.google.com/file/d/uploaded_file_doc_101/view',
            }),
            { status: 200 }
          )
        }
        return new Response('Not found', { status: 404 })
      })

      globalThis.fetch = mockFetch

      const pdfBlob = new Blob(['%PDF-1.4 sample screenplay content'], { type: 'application/pdf' })
      const metadata = await uploadToGoogleDrive({
        filename: 'my_screenplay.pdf',
        blob: pdfBlob,
        format: 'PDF',
        projectId: 'proj_123' as EntityId,
      })

      expect(uploadCalled).toBe(true)
      expect(metadata.id).toBe('uploaded_file_doc_101')
      expect(metadata.name).toBe('my_screenplay.pdf')
      expect(metadata.webViewLink).toContain('uploaded_file_doc_101')
      expect(metadata.exportFormat).toBe('PDF')
      expect(getDriveAuthState().lastSyncAt).toBeDefined()
    })

    it('handles failed upload and throws error without corrupting connection', async () => {
      saveDriveAuthState({
        isConnected: true,
        accessToken: 'mock_token',
        tokenExpiresAt: Date.now() + 3600000,
        folderId: 'folder_err',
      })

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/drive/v3/files/folder_err')) {
          return new Response(
            JSON.stringify({ id: 'folder_err', name: 'Screenplay Studio', trashed: false }),
            { status: 200 }
          )
        }
        if (url.includes('uploadType=multipart')) {
          return new Response(
            JSON.stringify({ error: { message: 'User storage quota exceeded' } }),
            { status: 403, statusText: 'Forbidden' }
          )
        }
        return new Response('Not found', { status: 404 })
      })

      globalThis.fetch = mockFetch

      const pdfBlob = new Blob(['%PDF-1.4 sample'], { type: 'application/pdf' })
      await expect(
        uploadToGoogleDrive({
          filename: 'quota_fail.pdf',
          blob: pdfBlob,
          format: 'PDF',
        })
      ).rejects.toThrow(/User storage quota exceeded/i)

      // Connection is preserved (not an auth failure)
      expect(getDriveAuthState().isConnected).toBe(true)
    })

    it('handles 401 error during upload by disconnecting and throwing session expired', async () => {
      saveDriveAuthState({
        isConnected: true,
        accessToken: 'revoked_token',
        tokenExpiresAt: Date.now() + 3600000,
        folderId: 'folder_401',
      })

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/drive/v3/files/folder_401')) {
          return new Response(
            JSON.stringify({ id: 'folder_401', name: 'Screenplay Studio', trashed: false }),
            { status: 200 }
          )
        }
        if (url.includes('uploadType=multipart')) {
          return new Response(
            JSON.stringify({ error: { message: 'Invalid Credentials' } }),
            { status: 401, statusText: 'Unauthorized' }
          )
        }
        return new Response('Not found', { status: 404 })
      })

      globalThis.fetch = mockFetch

      const pdfBlob = new Blob(['%PDF-1.4 sample'], { type: 'application/pdf' })
      await expect(
        uploadToGoogleDrive({
          filename: 'revoked.pdf',
          blob: pdfBlob,
          format: 'PDF',
        })
      ).rejects.toThrow(/expired or was revoked/i)

      expect(getDriveAuthState().isConnected).toBe(false)
      expect(getDriveAuthState().accessToken).toBeNull()
    })

    it('rejects upload if API response does not contain an id', async () => {
      saveDriveAuthState({
        isConnected: true,
        accessToken: 'mock_token',
        tokenExpiresAt: Date.now() + 3600000,
        folderId: 'folder_noid',
      })

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/drive/v3/files/folder_noid')) {
          return new Response(
            JSON.stringify({ id: 'folder_noid', name: 'Screenplay Studio', trashed: false }),
            { status: 200 }
          )
        }
        if (url.includes('uploadType=multipart')) {
          return new Response(JSON.stringify({}), { status: 200 })
        }
        return new Response('Not found', { status: 404 })
      })

      globalThis.fetch = mockFetch

      const pdfBlob = new Blob(['%PDF-1.4 sample'], { type: 'application/pdf' })
      await expect(
        uploadToGoogleDrive({
          filename: 'no_id.pdf',
          blob: pdfBlob,
          format: 'PDF',
        })
      ).rejects.toThrow(/did not return a valid file ID confirmation/i)
    })
  })

  describe('Supabase Auth & Session Exchange (SYNC-001)', () => {
    it('handles code exchange gracefully without throw', async () => {
      const res = await exchangeCodeForSession('dummy_pkce_code')
      expect(res).toBeDefined()
      expect(res.error).toBeDefined() // Returns expected configuration error or invalid code error
    })
  })

  describe('Groq AI Gateway & Story Bible (AI-002, AI-003, AI-004, AI-007)', () => {
    const dummyProject: Project = {
      id: 'proj_ai_1' as EntityId,
      name: 'Sunset Boulevard Redux',
      genre: 'Neo-Noir',
      logline: 'An aging screenwriter becomes entangled with a mysterious producer.',
      status: 'drafting',
      settings: {} as any,
      createdAt: Date.now() as Timestamp,
      updatedAt: Date.now() as Timestamp,
    }

    const dummyCharacters: Character[] = [
      {
        id: 'char_1' as EntityId,
        projectId: dummyProject.id,
        name: 'JOE GILLIS',
        description: 'Cynical down-on-his-luck screenwriter',
        dialogueCount: 42,
        sceneCount: 12,
        createdAt: Date.now() as Timestamp,
        updatedAt: Date.now() as Timestamp,
      },
    ]

    const dummyLocations: Location[] = [
      {
        id: 'loc_1' as EntityId,
        projectId: dummyProject.id,
        name: 'MANSION POOL',
        type: 'EXT',
        sceneIds: ['sc_1' as EntityId],
        createdAt: Date.now() as Timestamp,
        updatedAt: Date.now() as Timestamp,
      },
    ]

    it('builds a compact, token-efficient story bible representation', () => {
      const bible = buildCompactStoryBible({
        project: dummyProject,
        characters: dummyCharacters,
        locations: dummyLocations,
        currentSceneHeading: 'EXT. MANSION POOL - NIGHT',
      })

      expect(bible).toContain('TITLE: Sunset Boulevard Redux')
      expect(bible).toContain('GENRE: Neo-Noir')
      expect(bible).toContain('LOGLINE:')
      expect(bible).toContain('JOE GILLIS: Cynical down-on-his-luck screenwriter')
      expect(bible).toContain('EXT. MANSION POOL')
      expect(bible).toContain('CURRENT SCENE: EXT. MANSION POOL - NIGHT')
    })

    it('computes deterministic task hashes for caching', () => {
      const hash1 = computeTaskHash('dialogue_polish', 'Hello world', 'Context', 'llama-3.3-70b')
      const hash2 = computeTaskHash('dialogue_polish', 'Hello world', 'Context', 'llama-3.3-70b')
      const hashDiff = computeTaskHash('dialogue_polish', 'Hello other', 'Context', 'llama-3.3-70b')

      expect(hash1).toBe(hash2)
      expect(hash1).not.toBe(hashDiff)
    })

    it('stores and retrieves cached AI task results', () => {
      const key = computeTaskHash('scene_feedback', 'Scene text')
      expect(getCachedResult(key)).toBeNull()

      setCachedResult(key, {
        text: 'Strong opening tension.',
        model: 'llama-3.3-70b-versatile',
        tokensUsed: { prompt: 10, completion: 5, total: 15 },
        isCached: false,
        timestamp: Date.now(),
      })

      const cached = getCachedResult(key)
      expect(cached).toBeDefined()
      expect(cached?.text).toBe('Strong opening tension.')
      expect(cached?.isCached).toBe(true)
    })

    it('deduplicates in-flight simultaneous requests', async () => {
      let callCount = 0
      const fetcher = async () => {
        callCount++
        await new Promise((resolve) => setTimeout(resolve, 20))
        return {
          text: 'Shared response',
          model: 'llama-3.3-70b-versatile',
          tokensUsed: { prompt: 5, completion: 5, total: 10 },
          isCached: false,
          timestamp: Date.now(),
        }
      }

      const key = 'test_dedup_key'
      const [res1, res2] = await Promise.all([
        deduplicateInFlight(key, fetcher),
        deduplicateInFlight(key, fetcher),
      ])

      expect(callCount).toBe(1)
      expect(res1.text).toBe('Shared response')
      expect(res2.text).toBe('Shared response')
    })

    it('reports isGroqConfigured false when no API key is present', () => {
      expect(isGroqConfigured()).toBe(false)
    })
  })
})
