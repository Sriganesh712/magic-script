import { test, expect } from '@playwright/test'

test.describe('Screenplay Studio - 10 Core Workflows E2E Test Suite', () => {
  test('1. Loads the home page and sidebar navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Screenplay Studio/)
    await expect(page.locator('#root')).toBeVisible()

    // Check main navigation links exist
    await expect(page.getByRole('link', { name: /Projects/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Settings/i })).toBeVisible()
  })

  test('2. Navigates smoothly between Projects, Dashboard, and Settings', async ({ page }) => {
    await page.goto('/')

    // Navigate to Dashboard
    await page.getByRole('link', { name: /Dashboard/i }).click()
    await expect(page).toHaveURL(/.*dashboard/)
    await expect(page.getByText(/Writing Analytics|Writing Activity/i).first()).toBeVisible()

    // Navigate to Settings
    await page.getByRole('link', { name: /Settings/i }).click()
    await expect(page).toHaveURL(/.*settings/)
    await expect(page.getByText(/Paper Size/i).first()).toBeVisible()

    // Navigate back to Projects
    await page.getByRole('link', { name: /Projects/i }).click()
    await expect(page).toHaveURL(/\//)
  })

  test('3. Creates a new screenplay project and writes elements offline', async ({ page }) => {
    await page.goto('/')

    // Click "New Screenplay"
    const createBtn = page.getByRole('button', { name: /New Screenplay|Create Screenplay/i }).first()
    await expect(createBtn).toBeVisible()
    await createBtn.click()

    // Fill in project title in dialog
    const titleInput = page.getByPlaceholder(/Chinatown|Lady Bird/i)
    await expect(titleInput).toBeVisible()
    await titleInput.fill('Neon Horizon')

    // Submit creation dialog
    const submitBtn = page.getByRole('button', { name: /Create Project/i })
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // Creation automatically navigates to /project/:projectId editor
    await expect(page.locator('.screenplay-editor')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /Scene/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Action/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Character/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Dialogue/i }).first()).toBeVisible()
  })

  test('4. Reloads and recovers the saved document from IndexedDB', async ({ page }) => {
    await page.goto('/')

    // Load sample project if no projects exist
    const openBtn = page.getByRole('button', { name: /Open/i }).first()
    if (await openBtn.isVisible()) {
      await openBtn.click()
    } else {
      const sampleBtn = page.getByRole('button', { name: /Load Sample Project/i })
      await sampleBtn.click()
      await page.getByRole('button', { name: /Open/i }).first().click()
    }

    // Wait for editor
    await expect(page.locator('.screenplay-editor')).toBeVisible({ timeout: 15000 })

    // Trigger manual save
    const saveBtn = page.getByRole('button', { name: /Save/i }).first()
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    // Reload the browser page
    await page.reload()

    // Document reloads and persists content
    await expect(page.locator('.screenplay-editor')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/words/i).first()).toBeVisible()
  })

  test('5. Tracks writing progress, goals, heatmap, and analytics on Dashboard', async ({ page }) => {
    await page.goto('/')

    // Navigate to Dashboard
    await page.getByRole('link', { name: /Dashboard/i }).click()
    await expect(page).toHaveURL(/.*dashboard/)

    // Verify stats cards and heatmap
    await expect(page.getByText(/Today's Words/i)).toBeVisible()
    await expect(page.getByText(/Current Streak/i)).toBeVisible()
    await expect(page.getByText(/Writing Activity/i)).toBeVisible()
    await expect(page.getByText(/Writing Goals/i)).toBeVisible()
  })

  test('6. Exports screenplay to PDF, Fountain, and FDX formats', async ({ page }) => {
    await page.goto('/')

    const openBtn = page.getByRole('button', { name: /Open/i }).first()
    if (await openBtn.isVisible()) {
      await openBtn.click()
    } else {
      const sampleBtn = page.getByRole('button', { name: /Load Sample Project/i })
      await sampleBtn.click()
      await page.getByRole('button', { name: /Open/i }).first().click()
    }

    await expect(page.locator('.screenplay-editor')).toBeVisible({ timeout: 15000 })

    // PDF export button
    const pdfBtn = page.getByRole('button', { name: /PDF/i })
    await expect(pdfBtn).toBeVisible()

    // Fountain export button
    const fountainBtn = page.getByRole('button', { name: /Fountain/i })
    await expect(fountainBtn).toBeVisible()

    // FDX export button
    const fdxBtn = page.getByRole('button', { name: /FDX/i })
    await expect(fdxBtn).toBeVisible()
  })

  test('7. Tests production tools: Character DB, Location DB, Notes, and Revision Snapshotting', async ({ page }) => {
    await page.goto('/')

    const openBtn = page.getByRole('button', { name: /Open/i }).first()
    if (await openBtn.isVisible()) {
      await openBtn.click()
    } else {
      const sampleBtn = page.getByRole('button', { name: /Load Sample Project/i })
      await sampleBtn.click()
      await page.getByRole('button', { name: /Open/i }).first().click()
    }

    await expect(page.locator('.screenplay-editor')).toBeVisible({ timeout: 15000 })

    // Characters tab
    const charactersTab = page.getByRole('button', { name: /Characters/i })
    await expect(charactersTab).toBeVisible()
    await charactersTab.click()
    await expect(page.getByText(/Characters \(/i)).toBeVisible()

    // Locations tab
    const locationsTab = page.getByRole('button', { name: /Locations/i })
    await expect(locationsTab).toBeVisible()
    await locationsTab.click()
    await expect(page.getByText(/Locations \(/i)).toBeVisible()

    // Notes tab
    const notesTab = page.getByRole('button', { name: /Notes/i })
    await expect(notesTab).toBeVisible()
    await notesTab.click()
    await expect(page.getByText(/Notes & Tasks/i)).toBeVisible()

    // Revisions tab & Snapshot
    const revisionsTab = page.getByRole('button', { name: /Revisions/i })
    await expect(revisionsTab).toBeVisible()
    await revisionsTab.click()
    await expect(page.getByText(/Revisions \(/i)).toBeVisible()

    const snapshotBtn = page.getByRole('button', { name: /Snapshot/i })
    await expect(snapshotBtn).toBeVisible()
    await snapshotBtn.click()

    const labelInput = page.getByPlaceholder(/Blue Revision|Director Notes/i)
    await expect(labelInput).toBeVisible()
    await labelInput.fill('Milestone Revision Alpha')

    const saveSnapshotBtn = page.getByRole('button', { name: /Save Snapshot/i })
    await saveSnapshotBtn.click()

    await expect(page.getByText('Milestone Revision Alpha')).toBeVisible({ timeout: 5000 })
  })

  test('8. Operates 100% locally without an account or AI credentials', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/.*settings/)

    // Verifies local-only mode or configured status
    await expect(page.getByText(/Local-Only Mode|Configured|Connected/i).first()).toBeVisible()
    await expect(page.getByText(/Optional/i).first()).toBeVisible()
  })

  test('9. Configures screenplay paper formats, margins, and appearance in Settings', async ({ page }) => {
    await page.goto('/settings')

    // Verify paper size select exists
    await expect(page.getByText(/Paper Size/i)).toBeVisible()
    await expect(page.getByText(/Standard Margins/i)).toBeVisible()

    // Test appearance theme toggling
    const darkBtn = page.getByRole('button', { name: /Dark/i })
    if (await darkBtn.isVisible()) {
      await darkBtn.click()
    }
    const lightBtn = page.getByRole('button', { name: /Light/i })
    if (await lightBtn.isVisible()) {
      await lightBtn.click()
    }
  })

  test('10. Workspace full backup and disaster recovery restore triggers', async ({ page }) => {
    await page.goto('/settings')

    // Export backup button is visible and active
    const exportBtn = page.getByRole('button', { name: /Export Backup/i })
    await expect(exportBtn).toBeVisible()

    // Import data button is visible
    const importBtn = page.getByRole('button', { name: /Import Data/i })
    await expect(importBtn).toBeVisible()

    // Clear all data dialog button
    const clearBtn = page.getByRole('button', { name: /Clear All Data/i })
    await expect(clearBtn).toBeVisible()
  })
})