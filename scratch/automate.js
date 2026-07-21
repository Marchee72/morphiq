import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

async function run() {
  const targetDir = 'C:\\Users\\march\\.gemini\\antigravity\\brain\\a9449cd1-f466-4993-b078-b6c7f94d3c93';
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log('Launching Chrome browser...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--force-device-scale-factor=3',
      '--window-size=390,844'
    ]
  });

  const page = await browser.newPage();
  
  console.log('Setting viewport to 390x844...');
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });

  // Clear existing database and local storage to ensure a clean onboarding screen
  console.log('Clearing database and local storage via Chrome DevTools Protocol...');
  const client = await page.target().createCDPSession();
  await client.send('Storage.clearDataForOrigin', {
    origin: 'http://localhost:5173',
    storageTypes: 'indexeddb,local_storage,websql'
  });

  console.log('Navigating to http://localhost:5173/?db=local...');
  await page.goto('http://localhost:5173/?db=local', { waitUntil: 'networkidle0' });

  // Wait for the splash screen to disappear (minimum 2.2 seconds)
  console.log('Waiting for splash screen to disappear...');
  await new Promise(r => setTimeout(r, 4000));

  // Define helpers in browser context to reliably change React state
  await page.evaluate(() => {
    window.fillReactInput = (selector, value) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Element not found: ${selector}`);
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    window.fillReactSelect = (selector, value) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Element not found: ${selector}`);
      const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      nativeSelectValueSetter.call(el, value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
  });

  // Take onboarding screenshot
  console.log('Taking onboarding screenshot...');
  const onboardingPath = path.join(targetDir, 'onboarding.png');
  await page.screenshot({ path: onboardingPath });
  console.log(`Saved onboarding.png to ${onboardingPath}`);

  // Fill in the profile creation form
  console.log('Filling in profile creation form...');
  
  // 1. Name
  await page.waitForSelector('input[type="text"]');
  await page.evaluate(() => window.fillReactInput('input[type="text"]', 'QA User'));

  // 2. Biological Gender
  await page.evaluate(() => window.fillReactSelect('select', 'male'));

  // 3. Date of Birth
  await page.evaluate(() => window.fillReactInput('input[type="date"]', '1995-05-15'));

  // 4. Height (cm)
  const heightSelector = 'input[placeholder*="178"]';
  await page.waitForSelector(heightSelector);
  await page.evaluate((sel) => window.fillReactInput(sel, '175'), heightSelector);

  // 5. Target Weight (optional, kg)
  const weightSelector = 'input[placeholder*="75"]';
  await page.waitForSelector(weightSelector);
  await page.evaluate((sel) => window.fillReactInput(sel, '70'), weightSelector);

  // 6. Target Body Fat (optional, %)
  const fatSelector = 'input[placeholder*="15"]';
  await page.waitForSelector(fatSelector);
  await page.evaluate((sel) => window.fillReactInput(sel, '15'), fatSelector);

  // Submit the form
  console.log('Submitting profile form...');
  await page.click('button[type="submit"]');

  // Wait for dashboard to load (it will display the navigation bar)
  console.log('Waiting for navigation bar to appear...');
  await page.waitForSelector('.m3-navigation-bar');
  
  // Sleep a bit for any render updates
  await new Promise(r => setTimeout(r, 1500));

  // Take dashboard screenshot
  console.log('Taking dashboard screenshot...');
  const dashboardPath = path.join(targetDir, 'dashboard.png');
  await page.screenshot({ path: dashboardPath });
  console.log(`Saved dashboard.png to ${dashboardPath}`);

  // Click tabs and take screenshots
  const tabs = [
    { title: 'Daily Logs', filename: 'logs.png' },
    { title: 'Workouts', filename: 'workouts.png' },
    { title: 'AI Coach', filename: 'coach.png' },
    { title: 'Settings', filename: 'settings.png' }
  ];

  for (const tab of tabs) {
    console.log(`Navigating to tab: ${tab.title}...`);
    const buttonSelector = `button[title="${tab.title}"]`;
    await page.waitForSelector(buttonSelector);
    await page.click(buttonSelector);

    // Wait for the fade-in animation or content to render
    await new Promise(r => setTimeout(r, 1200));

    console.log(`Taking screenshot for ${tab.title}...`);
    const screenshotPath = path.join(targetDir, tab.filename);
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved ${tab.filename} to ${screenshotPath}`);
  }

  console.log('Automation complete! Closing browser...');
  await browser.close();
}

run().catch(err => {
  console.error('Automation failed:', err);
  process.exit(1);
});
