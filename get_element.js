const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: "new"});
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('file://' + process.cwd() + '/index.html', {waitUntil: 'networkidle0'});
  await page.evaluate(() => {
    const banner = document.getElementById('assignmentBanner');
    if (banner) banner.close();
  });
  const html = await page.evaluate(() => {
    const el = document.elementFromPoint(640, 750);
    return el ? el.outerHTML : "Not found";
  });
  console.log(html);
  await browser.close();
})();
