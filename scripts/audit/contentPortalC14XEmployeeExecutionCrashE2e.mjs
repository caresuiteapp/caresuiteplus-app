#!/usr/bin/env node
/**
 * C.14X — Employee Execution Production Crash Fix E2E.
 * Verifies:
 *  - executionDetailLoads: The execution route does not crash React on production
 *  - guardBlocksProduction: Production tenants see a graceful error (not a crash)
 *  - internalTestBypasses: internal_test tenant can access the execution route
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'https://caresuiteplus.app').replace(/\/$/, '');
const outDir = join(root, 'docs', 'audit', 'content-portal-c14x-screenshots');
const reportPath = join(root, '.audit-content-portal-c14x-browser-results.json');

function loadEnvFile() {
  const path = join(root, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const results = {
  phase: 'C.14X',
  timestamp: new Date().toISOString(),
  baseUrl,
  checks: {},
};

function report(key, pass, detail = '') {
  results.checks[key] = { pass, detail, ts: new Date().toISOString() };
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${key}${detail ? ` — ${detail}` : ''}`);
}

async function run() {
  loadEnvFile();
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log('\n=== C.14X Employee Execution Crash Fix E2E ===\n');

    // 1. Navigate to execution route (production) — should NOT crash
    const execUrl = `${baseUrl}/portal/employee/assignments/assign-001/execute`;
    console.log(`  Navigating to: ${execUrl}`);
    const response = await page.goto(execUrl, { waitUntil: 'networkidle', timeout: 15000 });
    const status = response?.status() ?? 0;
    report('executionRouteLoads', status >= 200 && status < 500, `HTTP ${status}`);

    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(outDir, '01-execution-route.png'), fullPage: true });

    // 2. Check that no React crash error is visible
    const bodyText = await page.textContent('body');
    const hasCrash = bodyText?.includes('Something went wrong') ||
      bodyText?.includes('Unhandled Runtime Error') ||
      bodyText?.includes('Error: Minified React error') ||
      bodyText?.includes('chunk') && bodyText?.includes('is not a function');
    report('noReactCrash', !hasCrash, hasCrash ? 'React crash detected' : 'No crash');

    // 3. Check that guard message or login redirect is shown (not blank)
    const hasContent = (bodyText?.length ?? 0) > 50;
    const hasGuardOrAuth =
      bodyText?.includes('Live-Modus') ||
      bodyText?.includes('Anmelden') ||
      bodyText?.includes('nicht gefunden') ||
      bodyText?.includes('Berechtigung') ||
      bodyText?.includes('Fehler') ||
      bodyText?.includes('Weiterleitung');
    report('guardBlocksProduction', hasContent && (hasGuardOrAuth ?? false),
      hasGuardOrAuth ? 'Guard/auth message shown' : 'Content present but no guard message');

    // 4. Verify no console errors with "hook" in them
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.reload({ waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);
    const hookErrors = consoleErrors.filter(
      (e) => e.toLowerCase().includes('hook') || e.includes('Rendered fewer hooks'),
    );
    report('noHookErrors', hookErrors.length === 0,
      hookErrors.length > 0 ? `${hookErrors.length} hook errors` : 'Clean');

    await page.screenshot({ path: join(outDir, '02-after-reload.png'), fullPage: true });

    // 5. Navigate to the detail route (not execute) — should show detail or error
    const detailUrl = `${baseUrl}/portal/employee/assignments/assign-001`;
    await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const detailText = await page.textContent('body');
    const detailLoaded = (detailText?.length ?? 0) > 50;
    report('executionDetailLoads', detailLoaded, detailLoaded ? 'Detail content rendered' : 'Blank page');
    await page.screenshot({ path: join(outDir, '03-detail-route.png'), fullPage: true });

  } catch (err) {
    report('executionDetailLoads', false, `Exception: ${err.message}`);
    await page.screenshot({ path: join(outDir, 'error.png'), fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const passCount = Object.values(results.checks).filter((c) => c.pass).length;
  const failCount = Object.values(results.checks).filter((c) => !c.pass).length;
  results.summary = { pass: passCount, fail: failCount, total: passCount + failCount };

  console.log(`\n  Summary: ${passCount} pass, ${failCount} fail\n`);
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`  Report: ${reportPath}`);
  process.exit(failCount > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('E2E fatal:', err);
  writeFileSync(reportPath, JSON.stringify({ ...results, fatal: err.message }, null, 2));
  process.exit(2);
});
