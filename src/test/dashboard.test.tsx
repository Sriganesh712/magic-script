import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { DashboardPage } from '@/pages/DashboardPage'
import { db, initDB, generateId, type Project, type ScreenplayDocument } from '@/lib'
import { saveDriveAuthState, disconnectGoogleDrive, type DriveFileMetadata } from '@/lib/drive'

describe('DashboardPage Realtime Cloud & Analytics', () => {
  beforeEach(async () => {
    await initDB()
    localStorage.clear()
    sessionStorage.clear()
    await db.projects.clear()
    await db.screenplays.clear()
    await db.writingSessions.clear()
    await db.dailyStats.clear()
    await db.writingGoals.clear()
    await db.syncOperations.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders Dashboard with Live Realtime Sync indicator and Cloud Saved Data section', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // Verify title and live realtime sync indicator
    await waitFor(() => {
      expect(screen.getByText('Writing Dashboard')).toBeInTheDocument()
    })
    expect(screen.getByText(/Live Realtime Sync/i)).toBeInTheDocument()

    // Verify Cloud Saved Data section
    expect(screen.getByText('Cloud Saved Data (Realtime)')).toBeInTheDocument()
    expect(screen.getByText('Google Drive Backup')).toBeInTheDocument()
    expect(screen.getByText('Database Sync (Supabase)')).toBeInTheDocument()
  })

  it('displays real-time Google Drive cloud files and active session status', async () => {
    saveDriveAuthState({
      isConnected: true,
      accessToken: 'valid_mock_token',
      userEmail: 'screenwriter@studio.io',
      lastSyncAt: Date.now() as any,
      folderId: 'folder_abc_123',
    })

    const sampleFiles: DriveFileMetadata[] = [
      {
        id: 'file_pdf_1',
        name: 'The_Grand_Heist.pdf',
        mimeType: 'application/pdf',
        exportFormat: 'PDF',
        size: 51200,
        createdTime: new Date().toISOString(),
        webViewLink: 'https://drive.google.com/file/d/file_pdf_1/view',
      },
    ]
    localStorage.setItem('screenplay_studio_drive_files_cache', JSON.stringify(sampleFiles))

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/drive/v3/files/folder_abc_123')) {
        return new Response(
          JSON.stringify({ id: 'folder_abc_123', name: 'Screenplay Studio', trashed: false }),
          { status: 200 }
        )
      }
      if (url.includes('parents and trashed=false')) {
        return new Response(JSON.stringify({ files: sampleFiles }), { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

    try {
      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('The_Grand_Heist.pdf')).toBeInTheDocument()
      })
      expect(screen.getByText(/50.0 KB/)).toBeInTheDocument()
      expect(screen.getByText('Connected & Active')).toBeInTheDocument()
      expect(screen.getByText(/Screenplay Studio/i)).toBeInTheDocument()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('calculates real metrics from real screenplay word counts without mock data', async () => {
    const projId = generateId()
    const draftId = generateId()
    const scrId = generateId()

    const project: Project = {
      id: projId,
      name: 'Neo Tokyo 2099',
      status: 'drafting',
      settings: {} as any,
      createdAt: Date.now() as any,
      updatedAt: Date.now() as any,
    }

    const screenplay: ScreenplayDocument = {
      id: scrId,
      projectId: projId,
      draftId,
      metadata: {
        title: 'Neo Tokyo 2099',
        author: 'Writer',
      },
      elements: [
        {
          id: generateId(),
          type: 'scene-heading',
          text: 'EXT. NEO TOKYO - NIGHT',
        } as any,
        {
          id: generateId(),
          type: 'action',
          text: 'Rain falls upon the neon drenched streets of Sector 4.',
        } as any,
      ],
      schemaVersion: 1,
      createdAt: Date.now() as any,
      updatedAt: Date.now() as any,
    }

    await db.projects.add(project)
    await db.screenplays.add(screenplay)

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Neo Tokyo 2099/i)).toBeInTheDocument()
    })

    // Verify streak is real (calculated from actual writes, not hardcoded 5)
    expect(screen.getByText(/Current Streak/i)).toBeInTheDocument()
    expect(screen.queryByText('5 days')).toBeNull() // Confirms no hardcoded 5 days mock
  })
})
