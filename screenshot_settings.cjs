const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  
  // Try finding any button at the bottom of the sidebar (often the last button on the screen before the main area)
  const buttons = await page.$$('button');
  if (buttons.length > 0) {
      // The settings button is typically the last button in the sidebar tree.
      await buttons[buttons.length - 1].click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/Users/andrey/.gemini/antigravity/brain/6a8a2385-948a-439a-a683-33c0b4c75936/final_network_settings.png' });
  }
  
  await browser.close();
})();
