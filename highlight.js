const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: "new"});
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('file://' + process.cwd() + '/index.html', {waitUntil: 'networkidle0'});
  await page.evaluate(() => {
    const banner = document.getElementById('assignmentBanner');
    if (banner) banner.close();
    
    // Add tooltip/border to all elements that have a box shadow or background white
    const all = document.querySelectorAll('*');
    for (let el of all) {
      const style = window.getComputedStyle(el);
      if (style.boxShadow !== 'none' || style.backgroundColor === 'rgb(255, 255, 255)') {
        el.style.border = '2px solid red';
        // append class name as text
        if (el.tagName !== 'svg' && el.tagName !== 'path') {
           const label = document.createElement('div');
           label.innerText = el.tagName + '#' + el.id + '.' + el.className;
           label.style.position = 'absolute';
           label.style.background = 'red';
           label.style.color = 'white';
           label.style.zIndex = 10000;
           el.appendChild(label);
        }
      }
    }
  });
  await page.screenshot({path: 'screenshot_highlight.png', fullPage: true});
  await browser.close();
  console.log('Done');
})();
