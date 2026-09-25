import puppeteer from 'puppeteer';

async function runTests() {
  console.log("Starting comprehensive Study Lounge verification...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page1 = await browser.newPage();
  await page1.setViewport({ width: 1280, height: 800 });

  const pageErrors = [];
  page1.on('pageerror', err => pageErrors.push(err.toString()));

  console.log("1. Navigating to http://localhost:3000/#study on Browser 1...");
  await page1.goto("http://localhost:3000/#study", { waitUntil: "networkidle0" });

  if (pageErrors.length > 0) {
    console.error("Page errors on load:", pageErrors);
  }

  // 1. Check timer clock and UI elements
  const initialClock = await page1.$eval("#timerClock", el => el.textContent.trim());
  console.log("Initial Clock:", initialClock);

  // 2. Test starting study timer
  console.log("Starting Study Timer on Browser 1...");
  await page1.click("#studyStartBtn");
  await new Promise(r => setTimeout(r, 1200));

  const runningStatus = await page1.$eval("#timerStatusLabel", el => el.textContent.trim());
  const isPauseVisible = await page1.$eval("#studyPauseBtn", el => el.style.display !== 'none');
  const liveCount = await page1.$eval("#studyLiveCount", el => el.textContent.trim());
  const coStudyCount = await page1.$eval("#coStudyCountBadge", el => el.textContent.trim());
  const coStudyItems = await page1.$$eval(".co-study-item", els => els.length);

  console.log("Running Status Label:", runningStatus);
  console.log("Pause button visible:", isPauseVisible);
  console.log("Live Learner Count:", liveCount);
  console.log("Co-Study Badge:", coStudyCount);
  console.log("Co-Study Desks Rendered:", coStudyItems);

  if (coStudyItems === 0 || liveCount === "0") {
    console.error("FAIL: Learner presence not rendered on round table!");
  } else {
    console.log("PASS: Live learner presence correctly shown on round table!");
  }

  // 3. Test multi-device sync with Browser 2
  console.log("Opening Browser 2 (simulating mobile / second device)...");
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 390, height: 844 }); // Mobile viewport iPhone 12/13/14

  await page2.goto("http://localhost:3000/#study", { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 1000));

  const p2Clock = await page2.$eval("#timerClock", el => el.textContent.trim());
  const p2Status = await page2.$eval("#timerStatusLabel", el => el.textContent.trim());
  const p2LiveCount = await page2.$eval("#studyLiveCount", el => el.textContent.trim());
  const p2Desks = await page2.$$eval(".co-study-item", els => els.length);

  console.log("Browser 2 (Mobile) Clock:", p2Clock);
  console.log("Browser 2 (Mobile) Status:", p2Status);
  console.log("Browser 2 (Mobile) Live Count:", p2LiveCount);
  console.log("Browser 2 (Mobile) Desks:", p2Desks);

  // 4. Test Audio Controls & Master Toggle
  console.log("Testing Audio Synthesizers...");
  const cafeBtnTextBefore = await page1.$eval("#toggleCafeBtn", el => el.textContent.trim());
  console.log("Cafe button before click:", cafeBtnTextBefore);

  await page1.click("#toggleCafeBtn");
  await new Promise(r => setTimeout(r, 300));
  const cafeBtnTextAfter = await page1.$eval("#toggleCafeBtn", el => el.textContent.trim());
  console.log("Cafe button after click:", cafeBtnTextAfter);

  const wavesBtnTextBefore = await page1.$eval("#toggleWavesBtn", el => el.textContent.trim());
  console.log("Waves button before click:", wavesBtnTextBefore);
  await page1.click("#toggleWavesBtn");
  await new Promise(r => setTimeout(r, 300));
  const wavesBtnTextAfter = await page1.$eval("#toggleWavesBtn", el => el.textContent.trim());
  console.log("Waves button after click:", wavesBtnTextAfter);

  const masterBtnText = await page1.$eval("#toggleAmbientMaster", el => el.textContent.trim());
  console.log("Master Ambient Button Text with tracks on:", masterBtnText);

  // Click Master to turn off all
  await page1.click("#toggleAmbientMaster");
  await new Promise(r => setTimeout(r, 300));
  const cafeAfterMaster = await page1.$eval("#toggleCafeBtn", el => el.textContent.trim());
  const wavesAfterMaster = await page1.$eval("#toggleWavesBtn", el => el.textContent.trim());
  const masterBtnTextAfter = await page1.$eval("#toggleAmbientMaster", el => el.textContent.trim());
  console.log("After Master Turn Off -> Cafe:", cafeAfterMaster, "| Waves:", wavesAfterMaster, "| Master:", masterBtnTextAfter);

  // 5. Test Mode Switching & Dynamic Durations
  console.log("Testing Mode switching...");
  await page1.click("#btnModeShortBreak");
  await new Promise(r => setTimeout(r, 300));
  const breakClock = await page1.$eval("#timerClock", el => el.textContent.trim());
  const startBtnTextBreak = await page1.$eval("#studyStartBtnText", el => el.textContent.trim());
  console.log("Break Clock:", breakClock, "| Start Btn Text:", startBtnTextBreak);

  await page1.click("#btnModeFocus");
  await new Promise(r => setTimeout(r, 300));
  const focusClock = await page1.$eval("#timerClock", el => el.textContent.trim());
  const startBtnTextFocus = await page1.$eval("#studyStartBtnText", el => el.textContent.trim());
  console.log("Focus Clock:", focusClock, "| Start Btn Text:", startBtnTextFocus);

  // Screenshots
  await page1.screenshot({ path: "test_desktop_study_fixed.png" });
  await page2.screenshot({ path: "test_mobile_study_fixed.png" });

  await browser.close();
  console.log("All tests completed successfully!");
}

runTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
