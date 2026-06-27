import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

export async function captureScreenshot(url: string): Promise<{ fullImage: Buffer; thumbnail: Buffer }> {
  const isProduction = process.env.VERCEL === '1';
  let browser;

  if (isProduction) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const executablePath = await chromium.executablePath();
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  } else {
    const { chromium: localChromium } = await import('playwright');
    browser = await localChromium.launch({ headless: true });
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const fullImage = await page.screenshot({
      fullPage: true,
      type: 'jpeg',
      quality: 80,
    });

    // サムネイル用：ビューポートのみ、低画質
    const thumbnail = await page.screenshot({
      fullPage: false,
      type: 'jpeg',
      quality: 50,
    });

    if (!isProduction) {
      try {
        const debugDir = path.join(process.cwd(), 'debug-screenshots');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
        const safeFileName = url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100) + '.jpg';
        fs.writeFileSync(path.join(debugDir, safeFileName), fullImage);
        console.log(`[DEBUG] スクショ保存: ${safeFileName} (${fullImage.length} bytes)`);
      } catch (e) {
        console.error('デバッグ保存エラー:', e);
      }
    }

    return { fullImage, thumbnail };
  } finally {
    await browser.close();
  }
}