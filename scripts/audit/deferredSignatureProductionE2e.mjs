#!/usr/bin/env node
/**
 * Production browser E2E — deferred signature finalize (Ohne Unterschrift abschließen).
 * Uses E2E tenant audit employee against https://caresuiteplus.app
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'https://caresuiteplus.app').replace(/\/$/, '');
const supabaseUrl = 'https://euagyyztvmemuaiumvxm.supabase.co';
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1YWd5eXp0dm1lbXVhaXVtdnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjU5MDMsImV4cCI6MjA5NjUwMTkwM30.WlzLh30maRgWePjQFEj32mfW7DGqN8sFaroREbYsss0';
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';
const ASSIGNMENT_ID = process.env.DEFERRED_E2E_ASSIGNMENT_ID ?? '9bf29d9f-964c-456d-a6c9-315c5b0159ef';
const EMPLOYEE_USERNAME = process.env.AUDIT_EMPLOYEE_USERNAME ?? 'audit-employee@caresuiteplus.test';
const EMPLOYEE_PASSWORD = process.env.AUDIT_EMPLOYEE_PASSWORD ?? 'CareSuiteEmployee2026!';

const outDir = join(root, 'docs', 'audit', 'deferred-signature-e2e-screenshots');
const reportPath = join(root, '.audit-deferred-signature-e2e-results.json');

const results = {
  timestamp: new Date().toISOString(),
  baseUrl,
  assignmentId: ASSIGNMENT_ID,
  checks: {},
};

function report(key, pass, detail = '') {
  results.checks[key] = { pass, detail };
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${key}${detail ? ` — ${detail}` : ''}`);
}

async function employeePortalLogin() {
  const res = await fetch(`${supabaseUrl}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: EMPLOYEE_USERNAME, password: EMPLOYEE_PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sessionToken) return { ok: false, status: res.status, error: data.error };

  const portalSession = {
    sessionToken: data.sessionToken,
    tenantId: data.account.tenantId,
    loginType: 'employee_portal',
    roleKey: 'employee_portal',
    expiresAt: data.expiresAt,
    accountId: data.account.id,
    employeeId: data.account.employeeId,
  };

  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  let sbPayload = null;
  if (data.supabaseAccessToken && data.supabaseRefreshToken) {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${data.supabaseAccessToken}`, apikey: supabaseKey },
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

  return { ok: true, portalSession, storageKey, sbPayload, accountId: data.account.id };
}

async function injectPortalSession(page, login) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
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
      JSON.stringify(login.portalSession),
      login.storageKey,
      login.sbPayload,
      login.accountId,
    ],
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);
}

async function dismissOverlays(page) {
  for (const label of [/Später/i, /Weiter zur Übersicht/i, /Verstanden/i, /Fertig — Portal nutzen/i]) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => null);
      await page.waitForTimeout(800);
    }
  }
}

async function waitForLoadedShell(page, timeout = 45000) {
  try {
    await page.waitForFunction(
      () => {
        const t = document.body?.innerText ?? '';
        return !t.includes('Wird geladen…') && !t.includes('Wird geladen...');
      },
      { timeout },
    );
    await page.waitForTimeout(1500);
  } catch {
    /* continue */
  }
}

function isWhiteScreen(text) {
  const trimmed = text.trim();
  if (trimmed.length < 20) return true;
  return (
    text.includes('Something went wrong') ||
    text.includes('Unhandled Runtime Error') ||
    text.includes('Minified React error') ||
    text.includes('Application error')
  );
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  console.log('\n=== Deferred Signature Production E2E ===\n');

  const login = await employeePortalLogin();
  report('employee_login', login.ok, login.ok ? 'session_ok' : login.error ?? 'login_failed');
  if (!login.ok) {
    writeFileSync(reportPath, JSON.stringify(results, null, 2));
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const rpcCalls = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err.message ?? err)));
  page.on('request', (req) => {
    if (req.url().includes('/rpc/employee_portal_upsert_deferred_signature_client_document')) {
      rpcCalls.push({ method: req.method(), url: req.url() });
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/rpc/employee_portal_upsert_deferred_signature_client_document')) {
      rpcCalls.push({ status: res.status(), body: await res.text().catch(() => '') });
    }
  });

  await injectPortalSession(page, login);
  await dismissOverlays(page);

  const execUrl = `${baseUrl}/portal/employee/assignments/${ASSIGNMENT_ID}/execute`;
  await page.goto(execUrl, { waitUntil: 'networkidle', timeout: 120000 }).catch(async () => {
    await page.goto(execUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  });
  await dismissOverlays(page);
  await page.getByText(/P0-E2E Testeinsatz|Ohne Unterschrift abschließen/i).first().waitFor({
    state: 'visible',
    timeout: 90000,
  }).catch(() => null);
  await waitForLoadedShell(page);
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  report(
    'execution_route_reached',
    currentUrl.includes('/execute'),
    currentUrl.replace(baseUrl, ''),
  );

  let bodyAfterLoad = await page.locator('body').innerText({ timeout: 30000 }).catch(() => '');
  await page.screenshot({ path: join(outDir, '01-execution-loaded.png'), fullPage: true });
  report(
    'execution_screen_loads',
    !isWhiteScreen(bodyAfterLoad) && bodyAfterLoad.length > 50,
    bodyAfterLoad.slice(0, 120).replace(/\s+/g, ' '),
  );

  const deferredButton = page.getByTestId('portal-finalize-deferred-button');
  const buttonVisible = (await deferredButton.count()) > 0;
  report('deferred_button_visible', buttonVisible, buttonVisible ? 'button_found' : 'button_missing');

  if (!buttonVisible) {
    results.blocker = 'deferred_button_not_visible';
    writeFileSync(reportPath, JSON.stringify(results, null, 2));
    await browser.close();
    process.exit(3);
  }

  await deferredButton.click();
  await page.waitForTimeout(45000);
  await waitForLoadedShell(page, 60000);

  bodyAfterLoad = await page.locator('body').innerText({ timeout: 30000 }).catch(() => '');
  await page.screenshot({ path: join(outDir, '02-after-deferred-finalize.png'), fullPage: true });

  const whiteScreen = isWhiteScreen(bodyAfterLoad);
  report('no_white_screen', !whiteScreen, whiteScreen ? 'blank_or_crash' : 'content_visible');

  const successLocator = page.getByText(/Einsatz abgeschlossen|Klient:innenportal gesendet|Ans Klient:innenportal gesendet/i);
  const hasSuccess = (await successLocator.count()) > 0;
  report('success_message', hasSuccess, hasSuccess ? 'success_text_found' : bodyAfterLoad.slice(0, 160));

  const errorLocator = page.getByText(/fehlgeschlagen|RLS|policy|Zeitüberschreitung/i);
  const hasErrorBanner = (await errorLocator.count()) > 0;
  report('no_rls_error', !hasErrorBanner, hasErrorBanner ? 'error_in_ui' : 'no_error_text');

  report('rpc_called', rpcCalls.length > 0, rpcCalls.length ? JSON.stringify(rpcCalls).slice(0, 200) : 'no_rpc');
  results.rpcCalls = rpcCalls;

  const hasSummary =
    bodyAfterLoad.includes('Einsatz abgeschlossen') &&
    (bodyAfterLoad.includes('Unterschrift') || bodyAfterLoad.includes('Dokumentation'));
  report('completion_summary', hasSummary || hasSuccess, hasSummary ? 'summary_visible' : 'summary_missing');

  const unhandledRejections = consoleErrors.filter(
    (e) =>
      e.includes('Unhandled') ||
      e.includes('Uncaught') ||
      e.toLowerCase().includes('rls') ||
      e.includes('WORKFLOW_UNEXPECTED'),
  );
  report(
    'no_console_crash',
    unhandledRejections.length === 0,
    unhandledRejections.length ? unhandledRejections[0].slice(0, 120) : 'clean',
  );

  results.consoleErrors = consoleErrors.slice(0, 10);
  results.pass =
    Object.values(results.checks).every((c) => c.pass) && !results.blocker;

  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  await browser.close();

  console.log(`\nReport: ${reportPath}`);
  console.log(`Pass: ${results.pass ? 'YES' : 'NO'}\n`);
  process.exit(results.pass ? 0 : 4);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
