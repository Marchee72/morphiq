import { test, expect } from '@playwright/test';

test.describe('Bottom Sheets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
  });

  test('QuickAdd sheet opens with animation', async ({ page }) => {
    await page.getByLabel('Quick add').click();
    const sheet = page.locator('.ui-sheet');
    await expect(sheet).toBeVisible();
  });

  test('sheet has drag handle', async ({ page }) => {
    await page.getByLabel('Quick add').click();
    await expect(page.locator('.ui-sheet-handle')).toBeVisible();
  });

  test('sheet closes on Escape key', async ({ page }) => {
    await page.getByLabel('Quick add').click();
    await expect(page.locator('.ui-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ui-sheet')).not.toBeVisible();
  });

  test('sheet blocks body overflow', async ({ page }) => {
    await page.getByLabel('Quick add').click();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('hidden');
  });

  test('Log Weight sheet opens from QuickAdd', async ({ page }) => {
    await page.getByLabel('Quick add').click();
    await page.getByText('Log weight').click();
    await expect(page.locator('.ui-sheet')).toBeVisible();
  });

  test('sheet closes on overlay click', async ({ page }) => {
    await page.getByLabel('Quick add').click();
    await expect(page.locator('.ui-sheet')).toBeVisible();
    await page.locator('.ui-sheet-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.ui-sheet')).not.toBeVisible();
  });
});
