import { test, expect } from '@playwright/test';

test.describe('Home Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
  });

  test('displays AppBar with "Today" title', async ({ page }) => {
    await expect(page.locator('.ui-appbar-title')).toContainText('Today');
  });

  test('displays overline with greeting and date', async ({ page }) => {
    const overline = page.locator('.ui-appbar-overline');
    await expect(overline).toBeVisible();
    const text = await overline.textContent();
    expect(text).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  test('displays settings gear icon', async ({ page }) => {
    await expect(page.getByLabel('Settings')).toBeVisible();
  });

  test('displays QuickAdd plus button in AppBar', async ({ page }) => {
    await expect(page.getByLabel('Quick add')).toBeVisible();
  });

  test('QuickAdd opens bottom sheet with 3 actions', async ({ page }) => {
    await page.getByLabel('Quick add').click();
    await expect(page.locator('.ui-sheet')).toBeVisible();
    await expect(page.getByText('Log weight')).toBeVisible();
    await expect(page.getByText('Add food')).toBeVisible();
    await expect(page.getByText('Start workout')).toBeVisible();
  });

  test('QuickAdd sheet closes on Escape key', async ({ page }) => {
    await page.getByLabel('Quick add').click();
    await expect(page.locator('.ui-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ui-sheet')).not.toBeVisible();
  });

  test('Energy Score card is visible', async ({ page }) => {
    await expect(page.locator('.ui-card').first()).toBeVisible();
  });

  test('AppBar collapses on scroll', async ({ page }) => {
    const appbar = page.locator('.ui-appbar');
    await expect(appbar).not.toHaveClass(/collapsed/);
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(500);
    await expect(appbar).toHaveClass(/collapsed/);
  });

  test('FAB is NOT rendered (removed in F2)', async ({ page }) => {
    await expect(page.locator('.ui-quickadd-btn')).not.toBeVisible();
  });
});
