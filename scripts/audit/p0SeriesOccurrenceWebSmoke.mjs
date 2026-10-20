#!/usr/bin/env node
/**
 * P0 deploy-readiness — static web smoke against exported build (port 8092).
 * Reads credentials from .env via loadAuditEnv (never logged).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAuditEnv, pick } from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(root, 'docs/audit/p0-series-occurrence-reset/screenshots');
const BASE_URL = (process.env.SMOKE_BASE_URL ?? 'http://localhost:8093').replace(/\/$/, '');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';

const SCREENSHOTS = [
  'office-list-ellen-03-10-17.png',
  'office-list-ellen-24-31.png',
  'office-list-dagmar-13-20-27.png',
  'office-preview-ellen-2026-07-10.png',
  'office-preview-dagmar-2026-07-13.png',
  'employee-portal-ellen-2026-07-10.png',
];

async function installPlaywright() {
  const { chromium } = await import('playwright');
  return chromium;
}

function supabaseStorageKey(env) {
  const url = pick(env, ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']);
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

async function dismissOverlays(page) {
  await page.waitForTimeout(1200);
  for (const label of [/Weiter zur Übersicht/i, /Verstanden/i, /Schließen/i, /^OK$/i]) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible({ timeout: 1200 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => null);
      await page.waitForTimeout(600);
    }
  }
}

async function loginBusiness(page, env) {
  const email = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL']);
  const password = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']);
  const url = pick(env, ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']);
  const key = pick(env, [
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ]);
  if (!email || !password || !url || !key) throw new Error('AUDIT_BUSINESS credentials missing');

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('Business auth failed');

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([storageKey, payload]) => localStorage.setItem(storageKey, payload),
    [
      supabaseStorageKey(env),
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        expires_in: data.expires_in,
        token_type: data.token_type,
        user: data.user,
      }),
    ],
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await dismissOverlays(page);
}

async function loginEmployee(page, env) {
  const username =
    pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME', 'AUDIT_EMPLOYEE_EMAIL']) ||
    pick(env, ['AUDIT_EMPLOYEE_USERNAME_MHI', 'AUDIT_P0_MHI_USERNAME']);
  const password =
    pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']) ||
    pick(env, ['AUDIT_EMPLOYEE_PASSWORD_MHI']);
  const url = pick(env, ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']);
  const key = pick(env, [
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ]);
  if (!username || !password || !url || !key) throw new Error('AUDIT_EMPLOYEE credentials missing');

  const res = await fetch(`${url}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sessionToken || !data.account) {
    throw new Error(`Employee auth failed: ${data.errorClass ?? data.error ?? res.status}`);
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

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([portalKey, portalVal, authKey, authVal, accountId]) => {
      localStorage.setItem(portalKey, portalVal);
      if (authKey && authVal) localStorage.setItem(authKey, authVal);
      localStorage.removeItem('portal-welcome-pending');
      if (accountId) {
        localStorage.setItem(`portal-welcome-seen:employee:${accountId}`, new Date().toISOString());
      }
    },
    [
      PORTAL_SESSION_KEY,
      JSON.stringify(session),
      supabaseStorageKey(env),
      sbPayload,
      session.accountId,
    ],
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await dismissOverlays(page);
  await waitForContent(page);
}

async function waitForContent(page) {
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function waitForAssignmentsLoaded(page) {
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return (
        /\d+ von \d+ Einsätzen/.test(text) &&
        !text.includes('Einsätze werden geladen') &&
        !text.includes('Noch keine Einsätze')
      );
    },
    undefined,
    { timeout: 90000 },
  );
  await page.waitForTimeout(1500);
}

async function prepareOfficeList(page) {
  await page.goto(`${BASE_URL}/assist/assignments`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForContent(page);
  await dismissOverlays(page);
  await waitForAssignmentsLoaded(page);

  const reset = page.getByText('Filter zurücksetzen').first();
  if (await reset.isVisible({ timeout: 2000 }).catch(() => false)) {
    await reset.click();
    await page.waitForTimeout(1500);
  }

  const tableTab = page.getByText('Tabellenansicht', { exact: true }).first();
  if (await tableTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tableTab.click();
    await page.waitForTimeout(1500);
  }

  const clientSort = page.getByText('Klient A–Z', { exact: true }).first();
  if (await clientSort.isVisible({ timeout: 3000 }).catch(() => false)) {
    await clientSort.click();
    await page.waitForTimeout(1500);
  }

  for (let i = 0; i < 12; i += 1) {
    const loadMore = page.getByRole('button', { name: /Weitere laden/i }).first();
    if (!(await loadMore.isVisible({ timeout: 1500 }).catch(() => false))) break;
    await loadMore.click();
    await page.waitForTimeout(1200);
  }
}

async function applyListSearch(page, query) {
  const searchInput = page.locator('input[placeholder*="Klient"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 30000 });
  await searchInput.click({ clickCount: 3 });
  await searchInput.press('Backspace');
  if (query) {
    await searchInput.pressSequentially(query, { delay: 35 });
    await page.waitForTimeout(3500);
  }
  return page.locator('body').innerText();
}

async function captureList(page, name, clientFilter) {
  await prepareOfficeList(page);
  const body = await applyListSearch(page, clientFilter);
  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: join(OUT_DIR, name), fullPage: true });
  return body;
}

async function openAssignmentPreview(page, name, clientFilter, dateFragment) {
  await prepareOfficeList(page);
  await applyListSearch(page, clientFilter);
  const row = page.getByRole('row').filter({ hasText: new RegExp(dateFragment.replace(/\./g, '\\.')) }).first();
  if (await row.count()) {
    await row.click({ timeout: 30000 });
  } else {
    await page.getByText(new RegExp(dateFragment.replace(/\./g, '\\.'))).first().click({ timeout: 30000 });
  }
  await waitForContent(page);
  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: join(OUT_DIR, name), fullPage: true });
  return page.locator('body').innerText();
}

async function captureEmployeePortalEllen(page, name) {
  await page.goto(`${BASE_URL}/portal/employee/assignments`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForContent(page);
  await dismissOverlays(page);
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return text.includes('10.07.2026') || text.includes('Keine Einsätze geplant');
    },
    undefined,
    { timeout: 90000 },
  );
  const card = page.locator('body').getByText(/10\.07\.2026/).first();
  await card.click({ timeout: 30000 });
  await waitForContent(page);
  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: join(OUT_DIR, name), fullPage: true });
  return page.locator('body').innerText();
}

function rowIsCompletedNearDate(text, dateKey) {
  const idx = text.indexOf(dateKey);
  if (idx === -1) return false;
  const slice = text.slice(idx, idx + 220);
  return /Abgeschlossen/i.test(slice);
}

function rowIsOpenNearDate(text, dateKey) {
  const idx = text.indexOf(dateKey);
  if (idx === -1) return false;
  const slice = text.slice(idx, idx + 220);
  return /Bestätigt|Geplant|Aktiv|Entwurf|Bestätigt/i.test(slice) && !/Abgeschlossen/i.test(slice);
}

function evaluateMandatoryCases(texts) {
  return [
    {
      id: 'ellen-03-abgeschlossen',
      label: 'Ellen 03.07. abgeschlossen',
      pass: rowIsCompletedNearDate(texts.ellenList1, '03.07.2026'),
    },
    {
      id: 'ellen-10-bestaetigt',
      label: 'Ellen 10.07. bestätigt/offen',
      pass: texts.ellenList1.includes('10.07.2026') && rowIsOpenNearDate(texts.ellenList1, '10.07.2026'),
    },
    {
      id: 'ellen-17-bestaetigt',
      label: 'Ellen 17.07. bestätigt/offen',
      pass: texts.ellenList1.includes('17.07.2026') && rowIsOpenNearDate(texts.ellenList1, '17.07.2026'),
    },
    {
      id: 'ellen-24-bestaetigt',
      label: 'Ellen 24.07. bestätigt/offen',
      pass: texts.ellenList2.includes('24.07.2026') && rowIsOpenNearDate(texts.ellenList2, '24.07.2026'),
    },
    {
      id: 'ellen-31-bestaetigt',
      label: 'Ellen 31.07. bestätigt/offen',
      pass: texts.ellenList2.includes('31.07.2026') && rowIsOpenNearDate(texts.ellenList2, '31.07.2026'),
    },
    {
      id: 'dagmar-13-bestaetigt',
      label: 'Dagmar 13.07. bestätigt/offen',
      pass: texts.dagmarList.includes('13.07.2026') && rowIsOpenNearDate(texts.dagmarList, '13.07.2026'),
    },
    {
      id: 'dagmar-20-bestaetigt',
      label: 'Dagmar 20.07. bestätigt/offen',
      pass: texts.dagmarList.includes('20.07.2026') && rowIsOpenNearDate(texts.dagmarList, '20.07.2026'),
    },
    {
      id: 'dagmar-27-bestaetigt',
      label: 'Dagmar 27.07. bestätigt/offen',
      pass: texts.dagmarList.includes('27.07.2026') && rowIsOpenNearDate(texts.dagmarList, '27.07.2026'),
    },
    {
      id: 'preview-ellen-not-completed',
      label: 'Office-Vorschau Ellen 10.07. nicht abgeschlossen',
      pass:
        !/Abgeschlossen/i.test(texts.ellenPreview) &&
        /Ellen|Zacharias|Alltagsbegleitung|10\.07\.2026/i.test(texts.ellenPreview),
    },
    {
      id: 'preview-dagmar-not-completed',
      label: 'Office-Vorschau Dagmar 13.07. nicht abgeschlossen',
      pass:
        !/Abgeschlossen/i.test(texts.dagmarPreview) &&
        /Dagmar|Ritzenhoff|13\.07\.2026/i.test(texts.dagmarPreview),
    },
    {
      id: 'portal-ellen-start',
      label: 'Portal Ellen 10.07. Start möglich',
      pass:
        /Einsatz antreten|Start|Einsatz starten|Bestätigt|Geplant/i.test(texts.portalEllen) &&
        !/Abgeschlossen/i.test(texts.portalEllen) &&
        /Ellen|Zacharias|10\.07\.2026/i.test(texts.portalEllen),
    },
  ];
}

async function main() {
  const env = loadAuditEnv();
  const chromium = await installPlaywright();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const businessContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const businessPage = await businessContext.newPage();

  const results = {
    baseUrl: BASE_URL,
    screenshots: SCREENSHOTS,
    checks: [],
    platformError: null,
    metroOnlyNote:
      'Platform is not defined tritt in Metro (localhost:8091) auf, nicht im exportierten Web-Build.',
  };

  let activePage = businessPage;

  try {
    await loginBusiness(businessPage, env);

    const ellenList1 = await captureList(businessPage, 'office-list-ellen-03-10-17.png', 'Ellen');
    const ellenList2 = await captureList(businessPage, 'office-list-ellen-24-31.png', 'Ellen');
    const dagmarList = await captureList(businessPage, 'office-list-dagmar-13-20-27.png', 'Dagmar');
    const ellenPreview = await openAssignmentPreview(
      businessPage,
      'office-preview-ellen-2026-07-10.png',
      'Ellen',
      '10.07.2026',
    );
    const dagmarPreview = await openAssignmentPreview(
      businessPage,
      'office-preview-dagmar-2026-07-13.png',
      'Ritzenhoff',
      '13.07.2026',
    );

    await businessContext.close();

    const employeeContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const employeePage = await employeeContext.newPage();
    activePage = employeePage;
    await loginEmployee(employeePage, env);
    const portalEllen = await captureEmployeePortalEllen(
      employeePage,
      'employee-portal-ellen-2026-07-10.png',
    );
    await employeeContext.close();

    results.checks = evaluateMandatoryCases({
      ellenList1,
      ellenList2,
      dagmarList,
      ellenPreview,
      dagmarPreview,
      portalEllen,
    });
    results.verdict = results.checks.every((c) => c.pass) ? 'PASS' : 'BLOCKED';
    results.failedChecks = results.checks.filter((c) => !c.pass);
  } catch (err) {
    results.verdict = 'BLOCKED';
    results.error = String(err?.message ?? err);
    try {
      mkdirSync(OUT_DIR, { recursive: true });
      await activePage.screenshot({ path: join(OUT_DIR, 'web-smoke-error.png'), fullPage: true });
      results.failureUrl = activePage.url();
      results.failureBody = (await activePage.locator('body').innerText()).slice(0, 2500);
    } catch {
      // ignore screenshot errors
    }
    if (String(err).includes('Platform is not defined')) {
      results.platformError = 'exported_build';
    }
  } finally {
    await browser.close();
  }

  const outPath = join(root, 'docs/audit/p0-series-occurrence-reset/web-smoke-results-2026-07-07.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(
    JSON.stringify({
      verdict: results.verdict,
      checks: results.checks?.length ?? 0,
      failed: results.failedChecks?.map((c) => c.id) ?? [],
      error: results.error ?? null,
    }),
  );
  if (results.verdict !== 'PASS') process.exit(1);
}

main();
