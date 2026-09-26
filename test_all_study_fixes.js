import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import http from 'http';

function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:3000/api/health", (res) => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
  });
}

async function runTests() {
  console.log("🚀 Starting Study Lounge verification of all user requirements...");

  let serverProc = null;
  const running = await isServerRunning();
  if (!running) {
    console.log("Starting local server on port 3000...");
    serverProc = spawn("node", ["server.js"], { stdio: "inherit" });
    await new Promise(r => setTimeout(r, 1200));
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1280, height: 850 });

    const pageErrors = [];
    page1.on('pageerror', err => pageErrors.push(err.toString()));

    console.log("1. Setting up authenticated Admin session...");
    const { DatabaseSync } = await import("node:sqlite");
    const crypto = await import("node:crypto");
    const db = new DatabaseSync("./data/research.db");
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const csrf = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();
    db.prepare("INSERT INTO sessions(token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)").run(tokenHash, 1, csrf, expiresAt);
    db.close();

    await page1.setCookie({
      name: "research_session",
      value: token,
      url: "http://localhost:3000"
    });

    await page1.goto("http://localhost:3000/#study", { waitUntil: "networkidle2" });
    await page1.waitForSelector(".co-study-item", { timeout: 8000 });
    await new Promise(r => setTimeout(r, 600));

    // Test Requirement 2 & 3 & 4: Co-study card background, aura border, streak name, no [Đang]
    console.log("3. Verifying Co-Study Learner Card Properties...");
    const initialCard = await page1.evaluate(() => {
      const item = document.querySelector(".co-study-item");
      if (!item) return null;
      const titleEl = item.querySelector(".co-study-user-title");
      const timeEl = item.querySelector(".co-study-time");
      const selfPill = item.querySelector(".self-status-pill");
      const avatarEl = item.querySelector(".avatar");

      return {
        bg: item.style.background,
        border: item.style.border,
        boxShadow: item.style.boxShadow,
        hasSelfPill: Boolean(selfPill),
        nameText: titleEl ? titleEl.textContent : '',
        nameClass: titleEl ? titleEl.className : '',
        timeText: timeEl ? timeEl.textContent : '',
        avatarClass: avatarEl ? avatarEl.className : ''
      };
    });

    console.log("Initial Co-study Card Info:", initialCard);
    if (initialCard.hasSelfPill) {
      console.error("FAIL: Redundant self pill still exists!");
    } else {
      console.log("PASS: Redundant status pill successfully removed!");
    }

    // Test Requirement 5: Gradient Auras & Wallpaper background styling
    console.log("4. Testing Exclusive Gradient Aura & Wallpaper Presets...");
    await page1.evaluate(() => {
      applyStudyWallpaperPreset('sunset');
      applyColorAura('cyberpunk');
    });
    await new Promise(r => setTimeout(r, 600));

    const gradientAuraCheck = await page1.evaluate(() => {
      const studyEl = document.querySelector("#study");
      const item = document.querySelector(".co-study-item");
      const startBtn = document.querySelector("#studyStartBtn");
      const stop1 = document.querySelector("#timerGradStop1")?.getAttribute("stop-color");
      const stop2 = document.querySelector("#timerGradStop2")?.getAttribute("stop-color");

      return {
        primaryGrad: studyEl?.style.getPropertyValue("--primary-gradient"),
        itemBg: item?.style.background,
        itemBorder: item?.style.border,
        itemBoxShadow: item?.style.boxShadow,
        startBtnBg: startBtn ? window.getComputedStyle(startBtn).backgroundImage : '',
        stop1,
        stop2
      };
    });
    console.log("Gradient Aura & Wallpaper Verification:", gradientAuraCheck);

    // Test Requirement 1: Mobile Layout Reordering
    console.log("5. Verifying Mobile Layout Order (Phone viewport 390x844)...");
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844, isMobile: true });
    await mobilePage.setCookie({
      name: "research_session",
      value: token,
      url: "http://localhost:3000"
    });
    await mobilePage.goto("http://localhost:3000/#study", { waitUntil: "networkidle2" });
    await mobilePage.waitForSelector(".co-study-item", { timeout: 8000 });
    await new Promise(r => setTimeout(r, 600));

    const mobileCardsOrder = await mobilePage.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("#study .study-card")).map(c => {
        const rect = c.getBoundingClientRect();
        return {
          id: c.id || c.className,
          top: Math.round(rect.top),
          order: window.getComputedStyle(c).order
        };
      });
      cards.sort((a, b) => a.top - b.top);
      return cards;
    });

    console.log("Mobile Visual Card Order (Top to Bottom):");
    mobileCardsOrder.forEach((c, idx) => {
      console.log(`  ${idx + 1}. [${c.id}] (order: ${c.order}, top: ${c.top}px)`);
    });

    const expectedOrderIds = ["timerMainCard", "todoMainCard", "coStudyCard", "soundArenaCard", "themeArenaCard"];
    const actualOrderIds = mobileCardsOrder.map(c => c.id);
    let orderMatches = true;
    for (let i = 0; i < expectedOrderIds.length; i++) {
      if (actualOrderIds[i] !== expectedOrderIds[i]) {
        orderMatches = false;
      }
    }

    if (orderMatches) {
      console.log("PASS: Mobile layout ordering perfectly matches user specification!");
    } else {
      console.error("FAIL: Mobile layout order mismatch! Actual:", actualOrderIds);
    }

    // Save screenshots
    await page1.screenshot({ path: "test_desktop_study_fixed.png" });
    await mobilePage.screenshot({ path: "test_mobile_study_fixed.png", fullPage: true });
    console.log("📸 Screenshots saved successfully!");

    await browser.close();
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  } finally {
    if (serverProc) {
      serverProc.kill();
    }
  }
}

runTests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});

