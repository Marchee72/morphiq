import { test, expect } from '@playwright/test';

test.describe('Bottom Navigation (F2 Glass Island)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
  });

  test('renders 4 nav tabs with labels', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    const items = nav.locator('.ui-bottomnav-item');
    await expect(items).toHaveCount(4);

    // Labels always visible
    await expect(items.nth(0)).toContainText('Home');
    await expect(items.nth(1)).toContainText('Gym');
    await expect(items.nth(2)).toContainText('Exercises');
    await expect(items.nth(3)).toContainText('Coach');
  });

  test('Home tab is active by default', async ({ page }) => {
    const homeItem = page.locator('.ui-bottomnav-item').nth(0);
    await expect(homeItem).toHaveClass(/active/);
    await expect(homeItem).toHaveAttribute('aria-current', 'page');
  });

  test('tapping Gym tab switches screen', async ({ page }) => {
    await page.locator('.ui-bottomnav-item').nth(1).click();
    await expect(page.locator('.ui-bottomnav-item').nth(1)).toHaveClass(/active/);
    await expect(page.locator('.ui-bottomnav-item').nth(0)).not.toHaveClass(/active/);
    await expect(page.locator('.ui-appbar-title')).toContainText('Gym');
  });

  test('tapping Exercises tab switches screen', async ({ page }) => {
    await page.locator('.ui-bottomnav-item').nth(2).click();
    await expect(page.locator('.ui-bottomnav-item').nth(2)).toHaveClass(/active/);
    await expect(page.locator('.ui-appbar-title')).toContainText('Exercises');
  });

  test('tapping Coach tab switches screen', async ({ page }) => {
    await page.locator('.ui-bottomnav-item').nth(3).click();
    await expect(page.locator('.ui-bottomnav-item').nth(3)).toHaveClass(/active/);
    await expect(page.locator('.ui-appbar-title')).toContainText('Coach');
  });

  test('nav bar is centered and floating', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      if (viewport) {
        const centerX = box.x + box.width / 2;
        expect(Math.abs(centerX - viewport.width / 2)).toBeLessThan(20);
      }
      expect(box.y).toBeGreaterThan(600);
    }
  });

  test('active tab has tonal pill background', async ({ page }) => {
    const activeIcon = page.locator('.ui-bottomnav-item.active .ui-bottomnav-icon-wrap');
    await expect(activeIcon).toBeVisible();
    const bg = await activeIcon.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('nav has no backdrop-filter (no glassmorphism)', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const backdropFilter = await nav.evaluate(el => getComputedStyle(el).backdropFilter);
    expect(backdropFilter).toBe('none');
  });
});
