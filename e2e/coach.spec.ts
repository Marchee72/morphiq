import { test, expect } from '@playwright/test';

test.describe('Coach Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.locator('.ui-bottomnav-item').nth(3).click();
    await page.waitForTimeout(300);
  });

  test('displays Coach AppBar', async ({ page }) => {
    await expect(page.locator('.ui-appbar-title')).toContainText('Coach');
  });

  test('displays chat input area', async ({ page }) => {
    const input = page.getByPlaceholder(/Escribe una pregunta/i);
    await expect(input).toBeVisible();
  });

  test('nav tab Coach is active', async ({ page }) => {
    await expect(page.locator('.ui-bottomnav-item').nth(3)).toHaveClass(/active/);
    await expect(page.locator('.ui-bottomnav-item').nth(3)).toHaveAttribute('aria-current', 'page');
  });
});
