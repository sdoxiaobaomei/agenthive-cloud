import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Web app - Workspace Overview
  await page.goto('http://localhost:5173/app/');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '../../workspace-overview.png', fullPage: false });

  // Switch to Studio mode by clicking the visible label text
  await page.locator('.el-radio-button__inner:has-text("工作室")').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '../../workspace-studio.png', fullPage: false });

  // 2. Landing studio page
  await page.goto('http://localhost:3000/studio');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '../../landing-studio.png', fullPage: false });

  await browser.close();
  console.log('Screenshots saved');
})();
