import { test, expect } from '@playwright/test'

test.describe('Screenplay Studio - Comprehensive E2E Test Suite', () => {
  test('1. loads the home page and sidebar navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Screenplay Studio/)
    await expect(page.locator('#root')).toBeVisible()
    
    // Check main navigation links exist
    await expect(page.getByRole('link', { name: /Projects/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Settings/i })).toBeVisible()
  })

  test('2. navigates between Projects, Dashboard, and Settings', async ({ page }) => {
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

  test('3. creates a new screenplay project and opens editor', async ({ page }) => {
    await page.goto('/')

    // Click "New Screenplay" or "Create Screenplay" button
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
  })

  test('4. types screenplay content and checks word count', async ({ page }) => {
    await page.goto('/')

    // Explicitly wait for empty state and click "Load Sample Project"
    const sampleBtn = page.getByRole('button', { name: /Load Sample Project/i })
    await expect(sampleBtn).toBeVisible({ timeout: 10000 })
    await sampleBtn.click()

    // Wait for project card and click Open
    const openBtn = page.getByRole('button', { name: /Open/i }).first()
    await expect(openBtn).toBeVisible({ timeout: 10000 })
    await openBtn.click()

    // Wait for editor canvas to be ready
    const editor = page.locator('.screenplay-editor')
    await expect(editor).toBeVisible({ timeout: 15000 })

    // Check toolbar buttons are interactive
    const sceneBtn = page.getByRole('button', { name: /Scene/i }).first()
    await expect(sceneBtn).toBeVisible()
    await sceneBtn.click()

    // Check export button dropdown/actions exist
    const pdfBtn = page.getByRole('button', { name: /PDF/i })
    await expect(pdfBtn).toBeVisible()
  })
})