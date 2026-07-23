import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
  });

  test('all nav items have aria-label', async ({ page }) => {
    const items = page.locator('.ui-bottomnav-item');
    for (let i = 0; i < 4; i++) {
      await expect(items.nth(i)).toHaveAttribute('aria-label');
    }
  });

  test('active nav item has aria-current="page"', async ({ page }) => {
    const active = page.locator('.ui-bottomnav-item.active');
    await expect(active).toHaveAttribute('aria-current', 'page');
  });

  test('only one nav item has aria-current="page"', async ({ page }) => {
    const itemsWithCurrent = page.locator('.ui-bottomnav-item[aria-current="page"]');
    await expect(itemsWithCurrent).toHaveCount(1);
  });

  test('nav has aria-label="Main navigation"', async ({ page }) => {
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
  });

  test('icon buttons have aria-label', async ({ page }) => {
    const iconBtns = page.locator('.ui-icon-btn');
    const count = await iconBtns.count();
    for (let i = 0; i < count; i++) {
      await expect(iconBtns.nth(i)).toHaveAttribute('aria-label');
    }
  });

  test('touch targets are at least 44px', async ({ page }) => {
    const items = page.locator('.ui-bottomnav-item');
    for (let i = 0; i < 4; i++) {
      const box = await items.nth(i).boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
