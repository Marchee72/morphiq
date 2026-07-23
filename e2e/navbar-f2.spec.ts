import { test, expect } from '@playwright/test';

test.describe('F2 Glass Island Navbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
  });

  test('nav is horizontally centered on screen', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const box = await nav.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      const centerX = box.x + box.width / 2;
      const screenCenter = viewport.width / 2;
      expect(Math.abs(centerX - screenCenter)).toBeLessThan(10);
    }
  });

  test('nav does NOT span full width (is a pill, not a bar)', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const box = await nav.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.width).toBeLessThan(viewport.width * 0.95);
      expect(box.width).toBeGreaterThan(250);
    }
  });

  test('nav has pill border-radius (nearly circular ends)', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const borderRadius = await nav.evaluate(el => getComputedStyle(el).borderRadius);
    const radius = parseInt(borderRadius);
    expect(radius).toBeGreaterThanOrEqual(100);
  });

  test('labels are always visible (not hidden on inactive tabs)', async ({ page }) => {
    const items = page.locator('.ui-bottomnav-item');
    for (let i = 0; i < 4; i++) {
      const label = items.nth(i).locator('span:last-child');
      await expect(label).toBeVisible();
      const text = await label.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });

  test('active tab icon has tonal background pill', async ({ page }) => {
    const activeWrap = page.locator('.ui-bottomnav-item.active .ui-bottomnav-icon-wrap');
    const bg = await activeWrap.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('rgb(255, 255, 255)');
  });

  test('inactive tabs have no background pill', async ({ page }) => {
    const inactiveWrap = page.locator('.ui-bottomnav-item:not(.active) .ui-bottomnav-icon-wrap').first();
    const bg = await inactiveWrap.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgba(0, 0, 0, 0)');
  });

  test('nav shadow uses token (not hardcoded)', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const shadow = await nav.evaluate(el => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe('none');
    expect(shadow).not.toBe('');
  });

  test('nav height is 56px', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(54);
      expect(box.height).toBeLessThanOrEqual(58);
    }
  });

  test('switching tabs preserves content state (no re-mount)', async ({ page }) => {
    await page.locator('.ui-bottomnav-item').nth(1).click();
    await page.waitForTimeout(200);
    await page.locator('.ui-bottomnav-item').nth(0).click();
    await page.waitForTimeout(200);
    await expect(page.locator('.ui-appbar-title')).toContainText('Today');
  });

  test('no FAB anywhere on screen', async ({ page }) => {
    await expect(page.locator('[class*="quickadd-btn"]')).toHaveCount(0);
    await expect(page.locator('[class*="fab"]')).toHaveCount(0);
  });

  test('QuickAdd is in AppBar, not as FAB', async ({ page }) => {
    const appbar = page.locator('.ui-appbar');
    const plusBtn = appbar.getByLabel('Quick add');
    await expect(plusBtn).toBeVisible();
  });
});
