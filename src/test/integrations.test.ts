import { describe, it, expect, beforeEach } from 'vitest'
import {
  enqueueSyncOp,
  resolveConflict,
  type SyncConflict,
} from '@/lib/sync'
import {
  getDriveAuthState,
  saveDriveAuthState,
  disconnectGoogleDrive,
} from '@/lib/drive'
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
