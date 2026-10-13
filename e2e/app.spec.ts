import { test, expect } from '@playwright/test'

test.describe('Screenplay Studio - Basic App', () => {
  test('loads the home page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Screenplay Studio/)
  })

  test('has a root element', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#root')).toBeVisible()
  })
})