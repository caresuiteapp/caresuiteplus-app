import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'docs', 'audit', 'responsive-screenshots');
const BASE = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8082';

const VIEWPORTS = [
  { tag: 'mobile-390', width: 390, height: 844 },
  { tag: 'tablet-834', width: 834, height: 1194 },
  { tag: 'web-desktop-1440', width: 1440, height: 900 },
];

const ROUTES = [
  { slug: 'auth-business-login', path: '/auth/business-login' },
  { slug: 'business-shell-preview', path: '/shell-preview' },
  { slug: 'assist-shell-preview', path: '/assist-shell-preview' },
  { slug: 'portal-shell-preview', path: '/portal-shell-preview' },
  { slug: 'employee-portal-shell-preview', path: '/employee-portal-shell-preview' },
];

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const url = `${BASE}${route.path}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(2000);
      const filename = `${route.slug}-${vp.tag}.png`;
      await page.screenshot({
        path: path.join(OUT_DIR, filename),
        fullPage: false,
        timeout: 120000,
        animations: 'disabled',
      });
      console.log(`saved ${filename}`);
    } catch (err) {
      console.error(`failed ${route.slug} @ ${vp.tag}:`, err.message);
    }
    await page.close();
  }
}

await browser.close();
console.log(`Screenshots written to ${OUT_DIR}`);
