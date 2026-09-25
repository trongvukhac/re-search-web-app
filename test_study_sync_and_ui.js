const puppeteer = require('puppeteer');

async function runTest() {
  console.log("=== STARTING STUDY LOUNGE & SYNC TESTS ===");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1. Desktop Browser Context (Student A)
    const contextDesktop = await browser.createBrowserContext();
    const pageDesktop = await contextDesktop.newPage();
    await pageDesktop.setViewport({ width: 1280, height: 800 });

    // Navigate to local server
    await pageDesktop.goto('http://localhost:3000/#study', { waitUntil: 'networkidle0' });
    console.log("Desktop loaded #study page.");

    // Check clock initial display
    const clockText = await pageDesktop.$eval('#timerClock', el => el.textContent.trim());
    console.log(`Initial Timer Clock: "${clockText}"`);
    if (clockText !== '25:00') throw new Error(`Expected 25:00, got ${clockText}`);

    // Check mode buttons alignment & text
    const modes = await pageDesktop.$$eval('.study-mode-btn', btns => btns.map(b => ({
      mode: b.dataset.studyMode,
      strong: b.querySelector('strong')?.textContent.trim(),
      span: b.querySelector('span')?.textContent.trim(),
      isActive: b.classList.contains('active')
    })));
    console.log("Mode buttons:", modes);
    if (modes.length !== 3) throw new Error("Expected 3 mode buttons");

    // Register or login a test user
    const testEmail = `test.scholar.${Date.now()}@vanlanguni.vn`;
    const testPass = 'SecurePassword123!';
    const testName = 'Học Giả Nghiên Cứu';

    await pageDesktop.evaluate(async (email, password, displayName) => {
      await requestAPI('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName })
      });
      await hydrateServer();
    }, testEmail, testPass, testName);
    console.log(`Registered and logged in as ${testEmail} on Desktop.`);

    // Click "Bắt đầu học" on desktop
    await pageDesktop.click('#studyStartBtn');
    await new Promise(r => setTimeout(r, 1200));

    // Verify clock is ticking on desktop
    const tickingClock = await pageDesktop.$eval('#timerClock', el => el.textContent.trim());
    console.log(`Ticking Clock after 1s: "${tickingClock}"`);
    const pauseBtnVisible = await pageDesktop.$eval('#studyPauseBtn', el => el.style.display !== 'none');
    console.log("Desktop Pause button visible:", pauseBtnVisible);
    if (!pauseBtnVisible) throw new Error("Pause button should be visible when timer is running");

    // Check Co-study desk on desktop
    await pageDesktop.evaluate(() => fetchStudyLounge());
    await new Promise(r => setTimeout(r, 800));
    const liveCountDesktop = await pageDesktop.$eval('#studyLiveCount', el => el.textContent.trim());
    const learnerItems = await pageDesktop.$$eval('.co-study-item', items => items.map(i => i.textContent.replace(/\s+/g, ' ').trim()));
    console.log(`Desktop Live Count: ${liveCountDesktop}`);
    console.log("Learners in lounge on Desktop:", learnerItems);
    if (learnerItems.length === 0) throw new Error("Expected student to appear in Co-study desk!");

    // 2. Mobile Browser Context (Same user opening on mobile)
    const contextMobile = await browser.createBrowserContext();
    const pageMobile = await contextMobile.newPage();
    await pageMobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // Login on mobile with same credentials
    await pageMobile.goto('http://localhost:3000/#study', { waitUntil: 'networkidle0' });
    await pageMobile.evaluate(async (email, password) => {
      await requestAPI('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      await hydrateServer();
      await fetchStudyLounge();
    }, testEmail, testPass);
    await new Promise(r => setTimeout(r, 1200));

    // Check Mobile Clock & State (Cross-Device Sync Test)
    const mobileClock = await pageMobile.$eval('#timerClock', el => el.textContent.trim());
    const mobilePauseVisible = await pageMobile.$eval('#studyPauseBtn', el => el.style.display !== 'none');
    const mobileLearners = await pageMobile.$$eval('.co-study-item', items => items.length);
    console.log(`Mobile Synced Clock: "${mobileClock}"`);
    console.log(`Mobile Pause Button Visible: ${mobilePauseVisible}`);
    console.log(`Mobile Learners count: ${mobileLearners}`);

    if (!mobilePauseVisible) {
      throw new Error("Cross-device sync failed: mobile did not resume running state from desktop!");
    }

    // 3. Audio Synthesizer & Master Toggle Tests
    console.log("--- Testing Audio Controls ---");
    // Test Rain button
    await pageDesktop.click('#toggleRainBtn');
    const rainState1 = await pageDesktop.$eval('#toggleRainBtn', el => el.textContent.trim());
    const masterState1 = await pageDesktop.$eval('#toggleAmbientMaster', el => el.textContent.trim());
    console.log(`Rain btn after click: "${rainState1}", Master btn: "${masterState1}"`);

    // Test Cafe button
    await pageDesktop.click('#toggleCafeBtn');
    const cafeState1 = await pageDesktop.$eval('#toggleCafeBtn', el => el.textContent.trim());
    console.log(`Cafe btn after click: "${cafeState1}"`);

    // Test Waves button
    await pageDesktop.click('#toggleWavesBtn');
    const wavesState1 = await pageDesktop.$eval('#toggleWavesBtn', el => el.textContent.trim());
    console.log(`Waves btn after click: "${wavesState1}"`);

    // Test Master Toggle "Tắt tất cả"
    await pageDesktop.click('#toggleAmbientMaster');
    const masterState2 = await pageDesktop.$eval('#toggleAmbientMaster', el => el.textContent.trim());
    const rainState2 = await pageDesktop.$eval('#toggleRainBtn', el => el.textContent.trim());
    const cafeState2 = await pageDesktop.$eval('#toggleCafeBtn', el => el.textContent.trim());
    const wavesState2 = await pageDesktop.$eval('#toggleWavesBtn', el => el.textContent.trim());
    console.log(`After Master Off -> Master: "${masterState2}", Rain: "${rainState2}", Cafe: "${cafeState2}", Waves: "${wavesState2}"`);

    if (masterState2 !== 'Bật tất cả' || rainState2 !== 'Bật' || cafeState2 !== 'Bật' || wavesState2 !== 'Bật') {
      throw new Error("Master toggle turn-off failed!");
    }

    // Test Master Toggle "Bật tất cả"
    await pageDesktop.click('#toggleAmbientMaster');
    const masterState3 = await pageDesktop.$eval('#toggleAmbientMaster', el => el.textContent.trim());
    console.log(`After Master On -> Master: "${masterState3}"`);
    if (masterState3 !== 'Tắt tất cả') {
      throw new Error("Master toggle turn-on failed!");
    }

    // Capture screenshots
    await pageDesktop.screenshot({ path: '/Users/ktrong263/.gemini/antigravity-ide/brain/978139ae-c9cd-4c92-91b6-8c3432b8125b/study_desktop_verified.png' });
    await pageMobile.screenshot({ path: '/Users/ktrong263/.gemini/antigravity-ide/brain/978139ae-c9cd-4c92-91b6-8c3432b8125b/study_mobile_verified.png' });
    console.log("Screenshots saved successfully.");

    console.log("=== ALL STUDY LOUNGE & MULTI-DEVICE SYNC TESTS PASSED! ===");
  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
