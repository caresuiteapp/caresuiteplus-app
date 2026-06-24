/**
 * C.14V — Visual Rebuild Browser E2E
 * Validates that the C14v visual rebuild is visible in production.
 * Target: https://caresuiteplus.app (msedge)
 * 
 * Usage: node scripts/audit/contentPortalC14vBrowserE2e.mjs
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.AUDIT_WEB_URL || 'https://caresuiteplus.app';
const TIMEOUT = 15_000;

const results = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  checks: [],
  summary: { total: 0, pass: 0, fail: 0 },
};

function check(name, passed, detail = '') {
  results.checks.push({ name, passed, detail });
  results.summary.total++;
  if (passed) results.summary.pass++;
  else results.summary.fail++;
}

async function run() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    // 1. Load landing page
    await page.goto(BASE_URL, { timeout: TIMEOUT, waitUntil: 'networkidle' });
    check('landing-loads', page.url().includes(BASE_URL), page.url());

    // 2. Check for login / portal routes
    const loginVisible = await page.locator('text=Anmelden').isVisible().catch(() => false);
    const portalVisible = await page.locator('text=Portal').isVisible().catch(() => false);
    check('auth-ui-present', loginVisible || portalVisible, `login=${loginVisible} portal=${portalVisible}`);

    // 3. Navigate to office if accessible
    const officeLink = page.locator('a[href*="office"], [data-testid*="office"]').first();
    if (await officeLink.isVisible().catch(() => false)) {
      await officeLink.click();
      await page.waitForTimeout(2000);
      
      // Check for C14v eyebrow pattern
      const eyebrowVisible = await page.locator('text=/OFFICE/').isVisible().catch(() => false);
      check('office-eyebrow-visible', eyebrowVisible, 'C14v eyebrow pattern');
      
      // Check for action bar
      const actionBarPresent = await page.locator('[data-testid="screen-shell"]').isVisible().catch(() => false);
      check('office-screen-shell', actionBarPresent, 'ScreenShell rendered');
    } else {
      check('office-navigation', false, 'Office link not directly accessible');
    }

    // 4. Navigate to assist if accessible
    const assistLink = page.locator('a[href*="assist"], [data-testid*="assist"]').first();
    if (await assistLink.isVisible().catch(() => false)) {
      await assistLink.click();
      await page.waitForTimeout(2000);
      
      const assistEyebrow = await page.locator('text=/ASSIST/').isVisible().catch(() => false);
      check('assist-eyebrow-visible', assistEyebrow, 'C14v eyebrow pattern');
    } else {
      check('assist-navigation', false, 'Assist link not directly accessible');
    }

    // 5. Check portal routes
    const portalLink = page.locator('a[href*="portal"], [data-testid*="portal"]').first();
    if (await portalLink.isVisible().catch(() => false)) {
      await portalLink.click();
      await page.waitForTimeout(2000);
      
      const portalEyebrow = await page.locator('text=/PORTAL/').isVisible().catch(() => false);
      check('portal-eyebrow-visible', portalEyebrow, 'C14v eyebrow pattern');
    } else {
      check('portal-navigation', false, 'Portal link not directly accessible (requires auth)');
    }

    // 6. Overall page structure
    const hasScreenShell = await page.locator('[data-testid="screen-shell"]').count();
    check('screen-shell-present', hasScreenShell > 0, `count=${hasScreenShell}`);

  } catch (err) {
    check('execution-error', false, err.message);
  } finally {
    await browser.close();
  }

  // Output results
  const output = JSON.stringify(results, null, 2);
  console.log(output);

  // Write results file
  const fs = await import('fs');
  fs.writeFileSync('.audit-content-portal-c14v-browser-results.json', output);

  process.exit(results.summary.fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
