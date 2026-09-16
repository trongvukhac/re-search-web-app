const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: "new"});
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('file://' + process.cwd() + '/index.html', {waitUntil: 'networkidle0'});
  await page.screenshot({path: 'screenshot.png'});
  await browser.close();
  console.log('Screenshot saved to screenshot.png');
})();
