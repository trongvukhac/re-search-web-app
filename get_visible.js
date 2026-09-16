const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: "new"});
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('file://' + process.cwd() + '/index.html', {waitUntil: 'networkidle0'});
  const html = await page.evaluate(() => {
    // Find elements that are fixed or absolute or large at the bottom
    const els = document.querySelectorAll('*');
    for (let el of els) {
      if (el.tagName === 'DIALOG' && window.getComputedStyle(el).display !== 'none') {
        console.log('VISIBLE DIALOG:', el.id, el.className);
        return el.outerHTML;
      }
    }
    // if no dialog, check for .ql-toolbar or .ql-container outside a dialog
    return "Not found";
  });
  console.log(html);
  await browser.close();
})();
