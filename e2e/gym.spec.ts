import { test, expect } from '@playwright/test';

test.describe('Gym Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.locator('.ui-bottomnav-item').nth(1).click();
    await page.waitForTimeout(300);
  });

  test('displays Gym AppBar with "Gym" title', async ({ page }) => {
    await expect(page.locator('.ui-appbar-title')).toContainText('Gym');
    await expect(page.getByText('Workout Hub & Tracking')).toBeVisible();
  });

  test('displays hero card with start session or active session', async ({ page }) => {
    const cards = page.locator('.ui-card');
    await expect(cards.first()).toBeVisible();
  });

  test('workout history section exists', async ({ page }) => {
    await expect(page.getByText(/Workout History/)).toBeVisible();
  });

  test('nav tab Gym is active', async ({ page }) => {
    await expect(page.locator('.ui-bottomnav-item').nth(1)).toHaveClass(/active/);
    await expect(page.locator('.ui-bottomnav-item').nth(1)).toHaveAttribute('aria-current', 'page');
  });

  test('has equipment settings button', async ({ page }) => {
    await expect(page.getByLabel('Configurar equipamiento')).toBeVisible();
  });
});
