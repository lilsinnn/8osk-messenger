const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`PAGE ERROR: ${msg.text()}`);
        }
    });

    page.on('pageerror', error => {
        console.log(`PAGE EXCEPTION: ${error.message}`);
    });

    await page.goto('http://localhost:5174');

    // Check if error happens immediately
    await page.waitForTimeout(2000);

    await browser.close();
})();
