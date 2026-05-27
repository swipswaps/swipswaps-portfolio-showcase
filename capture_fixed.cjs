const puppeteer = require('puppeteer');

(async () => {
  console.log('[CAPTURE] Starting browser capture');
  const browser = await puppeteer.launch({ headless: false, dumpio: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));
  page.on('requestfailed', req => console.log(`[FAILED] ${req.url()} - ${req.failure().errorText}`));
  
  console.log('[CAPTURE] Navigating to http://localhost:8000');
  await page.goto('http://localhost:8000');
  await new Promise(r => setTimeout(r, 8000));
  
  const results = await page.evaluate(() => ({
    hasCanvas: !!document.querySelector('canvas'),
    labelCount: document.querySelectorAll('.css2d-object').length,
    debugText: document.getElementById('debug-panel')?.innerText?.substring(0, 800)
  }));
  console.log('[RESULTS]', JSON.stringify(results, null, 2));
  
  await browser.close();
  console.log('[CAPTURE] Done');
})();
