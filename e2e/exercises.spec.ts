import { test, expect } from '@playwright/test';

test.describe('Exercise Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.locator('.ui-bottomnav-item').nth(2).click();
    await page.waitForTimeout(500);
  });

  test('displays Exercises AppBar', async ({ page }) => {
    await expect(page.locator('.ui-appbar-title')).toContainText('Exercises');
  });

  test('displays search bar', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i);
    await expect(search).toBeVisible();
  });

  test('displays filter button', async ({ page }) => {
    await expect(page.getByLabel('Open filters')).toBeVisible();
  });

  test('search filters exercises', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i);
    await search.fill('bench');
    await page.waitForTimeout(300);
    const resultText = page.getByText(/\d+ results?/);
    await expect(resultText).toBeVisible();
  });

  test('filter button opens bottom sheet', async ({ page }) => {
    await page.getByLabel('Open filters').click();
    await expect(page.locator('.ui-sheet')).toBeVisible();
  });

  test('exercise count is displayed', async ({ page }) => {
    const countText = page.getByText(/\d+ results?/);
    await expect(countText).toBeVisible();
  });
});
