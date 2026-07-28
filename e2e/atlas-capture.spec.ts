import { expect, test, type Page } from '@playwright/test';

/**
 * Visual capture of every screen, on local IndexedDB only.
 *
 * `?db=local` matters: these fixtures create profiles and sessions, and a test
 * run has no business writing to the live database.
 */
const SCREENS = ['today', 'train', 'library', 'body', 'coach'] as const;

const NAV: Record<(typeof SCREENS)[number], RegExp> = {
  today: /^(Today|Hoy)$/,
  train: /^(Train|Entrenar)$/,
  library: /^(Find|Buscar)$/,
  body: /^(Body|Cuerpo)$/,
  coach: /^Coach$/,
};

async function settle(page: Page) {
  await page.waitForSelector('.at-splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function boot(page: Page) {
  await page.goto('/?db=local');
  // Wait for the splash to clear, or the capture catches it mid-fade over the form.
  await settle(page);
  const name = page.getByLabel('Name');
  if (await name.isVisible().catch(() => false)) {
    await page.screenshot({ path: 'e2e/screenshots/atlas/onboarding.png' });
    await name.fill('Marche');
    await page.getByRole('radio', { name: 'Male', exact: true }).click();
    await page.getByLabel('Birth date').fill('1990-01-01');
    await page.getByLabel('Height').fill('178');
    await page.getByRole('button', { name: /create profile/i }).click();
  }
  await expect(page.getByRole('button', { name: NAV.today })).toBeVisible({ timeout: 20000 });
  await settle(page);
}

test('every screen', async ({ page }) => {
  await boot(page);

  for (const screen of SCREENS) {
    await page.getByRole('button', { name: NAV[screen] }).click();
    await page.waitForTimeout(screen === 'library' ? 3000 : 800);
    await page.screenshot({ path: `e2e/screenshots/atlas/${screen}.png` });
  }
});

test('settings and sheets', async ({ page }) => {
  await boot(page);

  await page.locator('.at-avatar').first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'e2e/screenshots/atlas/settings.png' });
  await page.locator('.at-settings .at-round').click();
  await page.waitForTimeout(400);

  // Log-weight sheet, reached from Body's empty state.
  await page.getByRole('button', { name: NAV.body }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /take a new reading/i }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'e2e/screenshots/atlas/sheet-weight.png' });
});

test('live session and picker', async ({ page }) => {
  await boot(page);

  await page.getByRole('button', { name: NAV.train }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /start an empty session/i }).first().click();
  await page.waitForTimeout(800);

  await page.getByRole('button', { name: /add exercise/i }).first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'e2e/screenshots/atlas/picker.png' });

  await page.locator('.at-ex-tap').first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'e2e/screenshots/atlas/session.png' });
});
