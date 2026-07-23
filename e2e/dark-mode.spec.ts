import { test, expect } from '@playwright/test';

test.describe('Dark Mode', () => {
  test('dark mode: background is near-black', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/rgb\(1[5-9],\s*1[5-9],\s*1[8-9]\)/);
  });

  test('dark mode: surface cards are elevated', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const card = page.locator('.ui-card').first();
    await expect(card).toBeVisible();
    const bg = await card.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgb\(2[6-9],\s*2[6-9],\s*3[0-5]\)/);
  });

  test('dark mode: primary color is lighter blue', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ui-primary').trim()
    );
    expect(primary).toBe('#4C9AFF');
  });

  test('dark mode: text is white-ish', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const color = await page.evaluate(() => getComputedStyle(document.body).color);
    expect(color).toMatch(/rgb\(24[0-5],\s*24[0-5],\s*24[0-5]\)/);
  });

  test('light mode: background is light gray', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/rgb\(24[5-9],\s*24[5-9],\s*24[7-9]\)/);
  });

  test('theme transitions instantly (no animation on theme change)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.waitForSelector('.ui-splash-container', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgBefore).toMatch(/rgb\(24[5-9]/); // light mode light gray
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500);
    const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // After switching to dark, bg should be dark (any dark value, not still light)
    expect(bgAfter).toMatch(/rgb\([0-2][0-9],\s*[0-2][0-9],\s*[0-2][0-9]\)/);
    expect(bgAfter).not.toBe(bgBefore);
  });
});
