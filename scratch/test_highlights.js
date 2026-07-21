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
  console.log('Clearing database and local storage...');
  const client = await page.target().createCDPSession();
  await client.send('Storage.clearDataForOrigin', {
    origin: 'http://localhost:5173',
    storageTypes: 'indexeddb,local_storage,websql'
  });

  console.log('Navigating to onboarding page...');
  await page.goto('http://localhost:5173/?db=local', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 4000));

  // Fill profile form
  console.log('Filling profile form...');
  await page.evaluate(() => {
    const fillInput = (selector, val) => {
      const el = document.querySelector(selector);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const fillSelect = (selector, val) => {
      const el = document.querySelector(selector);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    fillInput('input[type="text"]', 'QA User');
    fillSelect('select', 'male');
    fillInput('input[type="date"]', '1995-05-15');
    fillInput('input[placeholder*="178"]', '175');
    fillInput('input[placeholder*="75"]', '70');
    fillInput('input[placeholder*="15"]', '15');
  });

  console.log('Submitting profile form...');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.m3-navigation-bar');
  await new Promise(r => setTimeout(r, 1500));

  // Inject workout history database entries directly into IndexedDB
  console.log('Injecting workout history into IndexedDB...');
  await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MorphIQDatabase');
      request.onerror = () => reject(new Error('Failed to open database'));
      request.onsuccess = (event) => {
        const db = event.target.result;
        const tx = db.transaction(['userProfiles', 'userExercises', 'workoutLogs', 'workoutSets'], 'readwrite');
        
        tx.onerror = () => reject(new Error('Transaction failed'));
        tx.oncomplete = () => resolve();

        const profileStore = tx.objectStore('userProfiles');
        const req = profileStore.getAll();
        req.onsuccess = () => {
          const profiles = req.result;
          if (profiles.length === 0) {
            reject(new Error('No profiles found'));
            return;
          }
          const profileId = String(profiles[0].id);

          const exStore = tx.objectStore('userExercises');
          exStore.put({ profileId, name: 'Elevación de talones', machineDetails: 'Sled Machine', lastUsed: new Date() });
          exStore.put({ profileId, name: 'Running', machineDetails: 'Treadmill', lastUsed: new Date() });

          const logStore = tx.objectStore('workoutLogs');
          // Day 1 (May 27)
          logStore.put({ id: 1, profileId, timestamp: new Date('2026-05-27T10:00:00Z'), type: 'Strength Training', duration: 45, source: 'manual' });
          logStore.put({ id: 2, profileId, timestamp: new Date('2026-05-27T11:00:00Z'), type: 'Cardio', duration: 20, source: 'manual' });
          // Day 2 (May 28)
          logStore.put({ id: 3, profileId, timestamp: new Date('2026-05-28T10:00:00Z'), type: 'Strength Training', duration: 50, source: 'manual' });
          logStore.put({ id: 4, profileId, timestamp: new Date('2026-05-28T11:00:00Z'), type: 'Cardio', duration: 25, source: 'manual' });

          const setStore = tx.objectStore('workoutSets');
          // Strength Day 1 (May 27)
          setStore.put({ id: 1, workoutLogId: '1', profileId, exerciseName: 'Elevación de talones', setNumber: 1, weight: 70, reps: 10, timestamp: new Date('2026-05-27T10:05:00Z') });
          setStore.put({ id: 2, workoutLogId: '1', profileId, exerciseName: 'Elevación de talones', setNumber: 2, weight: 75, reps: 10, timestamp: new Date('2026-05-27T10:10:00Z') });
          // Strength Day 2 (May 28)
          setStore.put({ id: 3, workoutLogId: '3', profileId, exerciseName: 'Elevación de talones', setNumber: 1, weight: 80, reps: 10, timestamp: new Date('2026-05-28T10:05:00Z') });
          setStore.put({ id: 4, workoutLogId: '3', profileId, exerciseName: 'Elevación de talones', setNumber: 2, weight: 80, reps: 11, timestamp: new Date('2026-05-28T10:10:00Z') });

          // Cardio Day 1 (May 27)
          setStore.put({ id: 5, workoutLogId: '2', profileId, exerciseName: 'Running', setNumber: 1, distanceKm: 3.5, duration: 20, speed: 10.5, timestamp: new Date('2026-05-27T11:05:00Z') });
          // Cardio Day 2 (May 28)
          setStore.put({ id: 6, workoutLogId: '4', profileId, exerciseName: 'Running', setNumber: 1, distanceKm: 4.2, duration: 22, speed: 11.4, timestamp: new Date('2026-05-28T11:05:00Z') });
        };
      };
    });
  });

  console.log('Reloading application to load database entries...');
  await page.goto('http://localhost:5173/?db=local', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));

  console.log('Navigating to Workouts tab...');
  await page.click('button[title="Workouts"]');
  await new Promise(r => setTimeout(r, 1500));

  console.log('Clicking Exercise PRs sub-tab...');
  const subTabs = await page.$$('button');
  let prsButton = null;
  for (const button of subTabs) {
    const text = await page.evaluate(el => el.textContent.trim(), button);
    if (text === 'Exercise PRs') {
      prsButton = button;
      break;
    }
  }
  if (!prsButton) throw new Error('Could not find Exercise PRs sub-tab button');
  await prsButton.click();
  await new Promise(r => setTimeout(r, 1500));

  console.log('Taking highlights overview screenshot...');
  const overviewPath = path.join(targetDir, 'highlights_overview.png');
  await page.screenshot({ path: overviewPath });
  console.log(`Saved highlights_overview.png to ${overviewPath}`);

  // Expand "Elevación de talones" (strength)
  console.log('Expanding Elevación de talones...');
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h3'));
    const talones = headings.find(h => h.textContent.includes('Elevación de talones'));
    if (talones) talones.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  console.log('Taking expanded strength screenshot...');
  const strengthPath = path.join(targetDir, 'highlights_expanded_strength.png');
  await page.screenshot({ path: strengthPath });
  console.log(`Saved highlights_expanded_strength.png to ${strengthPath}`);

  // Collapse "Elevación de talones" and expand "Running" (cardio)
  console.log('Collapsing Elevación de talones and expanding Running...');
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h3'));
    const talones = headings.find(h => h.textContent.includes('Elevación de talones'));
    if (talones) talones.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h3'));
    const running = headings.find(h => h.textContent.includes('Running'));
    if (running) running.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  console.log('Taking expanded cardio screenshot...');
  const cardioPath = path.join(targetDir, 'highlights_expanded_cardio.png');
  await page.screenshot({ path: cardioPath });
  console.log(`Saved highlights_expanded_cardio.png to ${cardioPath}`);

  console.log('Closing browser...');
  await browser.close();
  console.log('Visual test completed successfully!');
}

run().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
});
