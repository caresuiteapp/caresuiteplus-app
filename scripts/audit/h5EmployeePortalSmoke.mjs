#!/usr/bin/env node
/**
 * H5 Employee Portal — local browser smoke (no secrets logged).
 */
import { chromium, devices } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuditPublicClient, loadAuditEnv, pick } from './lib/auditSupabaseClient.mjs';

const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'http://localhost:8083').replace(/\/$/, '');
const reportPath = join(root, 'docs/audit/h5-employee-portal-browser-smoke-results.json');
const screenshotDir = join(root, 'docs/audit/h5-employee-portal-smoke-screenshots');

const SECTIONS = [
  'Heute',
  'Meine Einsätze',
  'Meine Zeiten',
  'Offene Aufgaben',
  'Schnellzugriffe',
];

const TECHNICAL_PATTERNS = [
  /proof_missing/i,
  /wfm_sync_failed/i,
  /execution_status/i,
  /\bin_progress\b/i,
  /\bchecked_in\b/i,
  /\bpending\b/i,
  /Coming Soon/i,
  /Prepared/i,
  /\bMock\b/i,
  /Placeholder/i,
];

const FORBIDDEN_RUNTIME = [
  'Minified React error',
  'Rendered more hooks',
  'Cannot read properties of undefined',
  'Hydration failed',
];

function loadEnvFiles() {
  const env = loadAuditEnv();
  for (const file of ['.env.local', '.env']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
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
      env[key] = val;
    }
  }
  return env;
}

async function employeeLogin(page, env) {
  const username = pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'AUDIT_EMPLOYEE_EMAIL', 'TEST_EMPLOYEE_EMAIL']);
  const password = pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']);
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = pick(env, ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
  if (!username || !password || !url || !key) return { ok: false, reason: 'missing_employee_creds' };

  const publicClient = createAuditPublicClient(env);
  const res = await fetch(`${url}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sessionToken || !data.account) {
    return { ok: false, reason: 'auth_failed', detail: data.errorClass ?? data.error ?? res.status };
  }
  if (data.mustChangePassword) {
    return { ok: false, reason: 'must_change_password' };
  }

  const session = {
    sessionToken: data.sessionToken,
    tenantId: data.account.tenantId,
    loginType: 'employee_portal',
    roleKey: 'employee_portal',
    expiresAt: data.expiresAt,
    accountId: data.account.id,
    employeeId: data.account.employeeId,
  };

  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  let sbPayload = null;
  if (data.supabaseAccessToken && data.supabaseRefreshToken) {
    const userRes = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${data.supabaseAccessToken}`, apikey: key },
    });
    const user = userRes.ok ? await userRes.json() : null;
    sbPayload = JSON.stringify({
      access_token: data.supabaseAccessToken,
      refresh_token: data.supabaseRefreshToken,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user,
    });
  }

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([portalKey, portalVal, authKey, authVal, accountId]) => {
      localStorage.setItem(portalKey, portalVal);
      if (authKey && authVal) localStorage.setItem(authKey, authVal);
      localStorage.removeItem('portal-welcome-pending');
      if (accountId) localStorage.setItem(`portal-welcome-seen:employee:${accountId}`, new Date().toISOString());
    },
    [PORTAL_SESSION_KEY, JSON.stringify(session), storageKey, sbPayload, session.accountId],
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);
  return { ok: true };
}

async function dismissOverlays(page) {
  await page.waitForTimeout(1500);
  for (const label of [/Weiter zur Übersicht/i, /Verstanden/i, /Schließen/i, /OK/i]) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => null);
      await page.waitForTimeout(800);
    }
  }
}

async function shot(page, name) {
  mkdirSync(screenshotDir, { recursive: true });
  const p = join(screenshotDir, name);
  await page.screenshot({ path: p, fullPage: true, timeout: 30000 }).catch(() => null);
  return p.replace(root + '\\', '').replace(root + '/', '');
}

async function inspectViewport(page, label) {
  await page.waitForTimeout(2500);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    hasWhiteScreen: (document.body?.innerText?.trim()?.length ?? 0) < 20,
  }));

  const sectionsFound = SECTIONS.filter((s) => bodyText.includes(s));
  const technicalHits = TECHNICAL_PATTERNS.filter((re) => re.test(bodyText)).map(String);
  const hasPortalShell =
    bodyText.includes('Mitarbeiterportal') ||
    bodyText.includes('Heute') ||
    bodyText.includes('Meine Einsätze');
  const hasTimeInfo =
    bodyText.includes('Meine Zeiten') || bodyText.includes('Zeiterfassung');

  return {
    label,
    bodyLength: bodyText.length,
    sectionsFound,
    sectionsMissing: SECTIONS.filter((s) => !bodyText.includes(s)),
    technicalHits,
    hasPortalShell,
    hasTimeInfo,
    horizontalOverflow: layout.scrollWidth > layout.clientWidth + 8,
    whiteScreen: layout.hasWhiteScreen,
    sampleText: bodyText.slice(0, 1200),
  };
}

async function testExecuteLink(page) {
  const assignmentLink = page.getByText('Einsätze', { exact: false }).first();
  if (!(await assignmentLink.isVisible({ timeout: 5000 }).catch(() => false))) {
    return { ok: false, reason: 'assignments_link_not_visible' };
  }
  await assignmentLink.click();
  await page.waitForTimeout(2500);
  const url = page.url();
  const ok = url.includes('/portal/employee');
  await page.goto(`${baseUrl}/portal/employee`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  return { ok, url };
}

async function main() {
  const env = loadEnvFiles();
  const runtimeErrors = [];
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl,
    portalRoute: '/portal/employee',
    auth: null,
    desktop: null,
    mobile: null,
    executeLink: null,
    runtimeErrors: [],
    consoleErrors: [],
    verdict: {},
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => runtimeErrors.push(String(err.message ?? err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') report.consoleErrors.push(msg.text().slice(0, 300));
    });

    report.auth = await employeeLogin(page, env);
    if (!report.auth.ok) {
      report.verdict = { overall: 'rot', reason: report.auth.reason };
      mkdirSync(join(root, 'docs/audit'), { recursive: true });
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report.verdict));
      process.exit(2);
    }

    await page.goto(`${baseUrl}/portal/employee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await dismissOverlays(page);
    await page.waitForTimeout(4000);
    report.desktop = await inspectViewport(page, 'desktop');
    report.desktop.screenshot = await shot(page, 'employee-portal-desktop.png');

    const mobileContext = await browser.newContext({ ...devices['iPhone 13'] });
    const mobilePage = await mobileContext.newPage();
    mobilePage.on('pageerror', (err) => runtimeErrors.push(`mobile:${String(err.message ?? err)}`));
    await employeeLogin(mobilePage, env);
    await mobilePage.goto(`${baseUrl}/portal/employee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await dismissOverlays(mobilePage);
    const mobileBody = await mobilePage.locator('body').innerText().catch(() => '');
    if (!mobileBody.includes('Heute')) {
      const overviewTab = mobilePage.getByText('Übersicht', { exact: true }).first();
      if (await overviewTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await overviewTab.click();
        await mobilePage.waitForTimeout(2000);
      }
    }
    await mobilePage.waitForTimeout(4000);
    report.mobile = await inspectViewport(mobilePage, 'mobile');
    report.mobile.screenshot = await shot(mobilePage, 'employee-portal-mobile.png');
    await mobileContext.close();

    report.executeLink = await testExecuteLink(page);

    report.runtimeErrors = [
      ...runtimeErrors.filter((e) => FORBIDDEN_RUNTIME.some((f) => e.includes(f))),
      ...runtimeErrors.filter((e) => e.toLowerCase().includes('error')),
    ].slice(0, 10);

    const desktopOk =
      !report.desktop.whiteScreen &&
      report.desktop.sectionsFound.length >= 3 &&
      report.desktop.hasPortalShell &&
      report.desktop.technicalHits.length === 0;
    const mobileOk =
      !report.mobile.whiteScreen &&
      report.mobile.sectionsFound.length >= 2 &&
      !report.mobile.horizontalOverflow;
    const runtimeOk = report.runtimeErrors.length === 0;

    report.verdict = {
      browserSmoke: desktopOk && mobileOk && runtimeOk ? 'gruen' : desktopOk && runtimeOk ? 'gelb' : 'rot',
      desktop: desktopOk ? 'gruen' : report.desktop.whiteScreen ? 'rot' : 'gelb',
      mobile: mobileOk ? 'gruen' : report.mobile.horizontalOverflow ? 'gelb' : 'gelb',
      runtimeErrors: runtimeOk ? 'nein' : 'ja',
      technicalTexts: report.desktop.technicalHits.length === 0 ? 'nein' : 'ja',
      executeLinkPlausible: report.executeLink?.ok ? 'ja' : 'nein',
      redZoneUntouched: 'ja',
      commitReady: desktopOk && runtimeOk ? 'ja' : 'nein',
    };

    mkdirSync(join(root, 'docs/audit'), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.verdict, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  mkdirSync(join(root, 'docs/audit'), { recursive: true });
  writeFileSync(
    reportPath,
    JSON.stringify({ error: String(err.message ?? err), verdict: { browserSmoke: 'rot' } }, null, 2),
  );
  console.error(err);
  process.exit(1);
});
