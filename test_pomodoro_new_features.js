const puppeteer = require('puppeteer');

async function testPomodoroNewFeatures() {
  console.log("=== TESTING EXTENDED POMODORO FEATURES & PERKS ===");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto('http://localhost:3000/#study', { waitUntil: 'networkidle0' });
    console.log("1. Loaded #study page.");

    // Test 1: Cycle progression with Next button
    const initialCycle = await page.$eval('#studyCycleLabel', el => el.textContent.trim());
    console.log(`Initial Cycle Label: "${initialCycle}"`);
    if (!initialCycle.includes("Hiệp 1/4")) throw new Error("Expected Hiệp 1/4");

    // Click Next button (#studyNextBtn) to advance to Short Break
    await page.click('#studyNextBtn');
    const breakCycle = await page.$eval('#studyCycleLabel', el => el.textContent.trim());
    console.log(`After Skip 1 -> Cycle Label: "${breakCycle}"`);
    if (!breakCycle.includes("Nghỉ ngắn")) throw new Error("Expected Short Break after focus");

    // Click Next button again -> Hiệp 2/4
    await page.click('#studyNextBtn');
    const cycle2 = await page.$eval('#studyCycleLabel', el => el.textContent.trim());
    console.log(`After Skip 2 -> Cycle Label: "${cycle2}"`);
    if (!cycle2.includes("Hiệp 2/4")) throw new Error("Expected Hiệp 2/4");

    // Test 2: Settings Modal
    console.log("2. Testing Settings Modal...");
    await page.click('#studySettingsBtn');
    await new Promise(r => setTimeout(r, 400));
    const modalOpen = await page.$eval('#studySettingsModal', el => el.open);
    console.log(`Settings Modal Open: ${modalOpen}`);
    if (!modalOpen) throw new Error("Settings modal should be open");

    // Step focus duration +5
    await page.evaluate(() => stepDuration('focus', 5));
    const focusVal = await page.$eval('#settingFocusMins', el => el.value);
    console.log(`Focus mins after +5: ${focusVal}`);
    if (focusVal !== "30") throw new Error("Expected focus mins to be 30");

    // Save settings
    await page.evaluate(() => saveStudySettings(true));
    await new Promise(r => setTimeout(r, 300));
    const clockAfterSetting = await page.$eval('#timerClock', el => el.textContent.trim());
    console.log(`Clock after saving 30m focus setting: "${clockAfterSetting}"`);
    if (clockAfterSetting !== "30:00") throw new Error(`Expected 30:00, got ${clockAfterSetting}`);

    // Test 3: Streak Gating (Guest user: streak 0)
    console.log("3. Testing Streak Gating for Guest (Streak 0)...");
    const mixDisabled = await page.$eval('#mixModeCheckbox', el => el.disabled);
    const lofiLocked = await page.$eval('#bannerLofiLocked', el => el.style.display !== 'none');
    console.log(`Mix mode disabled: ${mixDisabled}, Lo-Fi banner shown: ${lofiLocked}`);
    if (!mixDisabled || !lofiLocked) throw new Error("Expected Mix mode disabled and Lo-Fi locked for guest");

    // Test 4: Admin Unlock (Streak perks 100% unlocked)
    console.log("4. Testing Admin Perks Unlock...");
    const adminEmail = `admin.${Date.now()}@vanlanguni.vn`;
    await page.evaluate(async (email) => {
      await requestAPI('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'AdminPassword123!', displayName: 'Admin Nghiên Cứu' })
      });
      // Force admin role in memory/session for test
      session.role = 'admin';
      session.streak = 50;
      updateStudyStreakPerks();
    }, adminEmail);

    await new Promise(r => setTimeout(r, 500));
    const adminMixDisabled = await page.$eval('#mixModeCheckbox', el => el.disabled);
    const adminLofiLocked = await page.$eval('#bannerLofiLocked', el => el.style.display !== 'none');
    const badgeMixText = await page.$eval('#badgeMixLock', el => el.textContent.trim());
    console.log(`Admin Mix disabled: ${adminMixDisabled}, Admin Lo-Fi banner locked: ${adminLofiLocked}, Mix Badge: "${badgeMixText}"`);
    if (adminMixDisabled || adminLofiLocked) throw new Error("Admin should have all perks unlocked");

    // Test 5: Fullscreen Zen Mode Toggle
    console.log("5. Testing Fullscreen Zen Mode...");
    await page.click('#studyFullscreenBtn');
    const isZenMode = await page.evaluate(() => document.body.classList.contains('study-zen-fullscreen'));
    console.log(`Zen mode active: ${isZenMode}`);
    if (!isZenMode) throw new Error("Zen mode should be active after button click");
    await page.click('#studyFullscreenBtn');
    const isZenModeAfter = await page.evaluate(() => document.body.classList.contains('study-zen-fullscreen'));
    console.log(`Zen mode active after toggle: ${isZenModeAfter}`);
    if (isZenModeAfter) throw new Error("Zen mode should be deactivated");

    // Test 6: To-Do Checklist
    console.log("6. Testing To-Do Checklist...");
    await page.type('#newTodoInput', 'Đọc tài liệu Scopus');
    await page.click('#addTodoBtn');
    await new Promise(r => setTimeout(r, 300));
    const todoCount = await page.$$eval('.todo-item', items => items.length);
    console.log(`Todo items count: ${todoCount}`);
    if (todoCount !== 1) throw new Error("Expected 1 todo item");

    // Check item and test progress bar
    await page.evaluate(() => toggleStudyTodo(0));
    await new Promise(r => setTimeout(r, 200));
    const barWidth = await page.$eval('#todoProgressBar', el => el.style.width);
    console.log(`Progress bar width: ${barWidth}`);
    if (barWidth !== '100%') throw new Error(`Expected progress bar to be 100%, got ${barWidth}`);

    // Take screenshot of the complete upgraded UI
    const screenshotPath = '/Users/ktrong263/.gemini/antigravity-ide/brain/89577b82-9c52-4eb0-a874-15a39a81c247/pomodoro_upgraded_lounge.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot captured at: ${screenshotPath}`);

    console.log("=== ALL EXTENDED POMODORO TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    await browser.close();
  }
}

testPomodoroNewFeatures().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
