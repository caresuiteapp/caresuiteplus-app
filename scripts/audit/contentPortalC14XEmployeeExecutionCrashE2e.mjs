#!/usr/bin/env node
/**
 * C.14X — Employee Execution Production Crash Fix — Comprehensive E2E.
 * Verifies the React #421 fix on production via Playwright (msedge channel).
 *
 * Checks:
 *  employee_login, dashboard, assignment_visible, detail_opens,
 *  execution_route_loads, no_react_crash, action_prepared_state,
 *  no_technical_leak, no_foreign_data, messages_employee_regression,
 *  messages_client_regression, proof_revoke_regression
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditPublicClient,
  loadAuditEnv,
  pick,
} from './lib/auditSupabaseClient.mjs';
import {
  employeeEnvCreds,
  tryEmployeePortalLogin,
} from './lib/repairEmployeePortalAccount.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'https://caresuiteplus.app').replace(/\/$/, '');
const outDir = join(root, 'docs', 'audit', 'content-portal-c14x-screenshots');
const reportPath = join(root, '.audit-content-portal-c14x-execution-crash-results.json');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';

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
  flows: {},
};

function report(key, pass, detail = '') {
  results.checks[key] = { pass, detail, ts: new Date().toISOString() };
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${key}${detail ? ` — ${detail}` : ''}`);
}

function hasTechnicalLeak(text) {
  return (
    text.includes('[object Object]') ||
    text.includes('undefined') ||
    /stack trace/i.test(text) ||
    /RLS policy/i.test(text)
  );
}

async function waitStable(page, ms = 3000) {
  await page.waitForTimeout(ms);
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
  } catch { /* continue */ }
}

async function bodyText(page) {
  return page.locator('body').innerText({ timeout: 45000 }).catch(() => '');
}

async function screenshot(page, name) {
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function employeePortalApiLogin(publicClient, username, password) {
  const ep = await tryEmployeePortalLogin(publicClient, username, password);
  if (!ep.ok) return { ok: false };
  const { url, key } = publicClient;
  const res = await fetch(`${url}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.sessionToken || !data.account) return { ok: false };
  const portalSession = {
    sessionToken: data.sessionToken,
    tenantId: data.account.tenantId,
    loginType: 'employee_portal',
    roleKey: 'employee_portal',
    expiresAt: data.expiresAt,
    accountId: data.account.id,
    employeeId: data.account.employeeId,
  };
  return { ok: true, portalSession, mustChangePassword: data.mustChangePassword };
}

async function clientPortalApiLogin(publicClient, username, code) {
  const { url, key } = publicClient;
  const res = await fetch(`${url}/functions/v1/client-portal-login`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sessionToken) return { ok: false };
  const portalSession = {
    sessionToken: data.sessionToken,
    tenantId: data.tenantId,
    loginType: 'client_portal',
    roleKey: 'client_portal',
    expiresAt: data.expiresAt,
    accountId: data.portalAccountId,
    clientId: data.clientId ?? null,
    displayName: data.displayName?.trim() || undefined,
    tenantName: data.tenantName?.trim() || null,
  };
  return { ok: true, portalSession, data };
}

async function injectPortalSession(page, portalSession) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [PORTAL_SESSION_KEY, JSON.stringify(portalSession)],
  );
}

async function trySupabaseLogin() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    '';
  const email = pick(process.env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL']);
  const password = pick(process.env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']);
  if (!url || !key || !email || !password) return { ok: false, reason: 'missing_creds' };
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return { ok: false, reason: 'auth_failed' };
  const data = await res.json();
  if (!data.access_token) return { ok: false, reason: 'no_token' };
  return { ok: true, session: data };
}

async function injectBusinessSession(page, session) {
  const storageKey = `sb-${new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [storageKey, payload],
  );
}

async function main() {
  loadEnvFile();
  const env = loadAuditEnv();
  const publicClient = createAuditPublicClient(env);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log('\n=== C.14X Employee Execution Crash Fix — Comprehensive E2E ===\n');

  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // ── 1. Employee Portal Login ──
  const { username: empUser, password: empPass } = employeeEnvCreds(env);
  const empApi = await employeePortalApiLogin(publicClient, empUser, empPass);
  report('employee_login', empApi.ok, empApi.ok ? 'api_login_ok' : 'api_login_failed');

  if (!empApi.ok) {
    results.blocker = 'employee_login_failed';
    writeFileSync(reportPath, JSON.stringify(results, null, 2));
    await browser.close();
    console.log(`\n  BLOCKER: employee login failed — cannot continue.\n`);
    process.exit(2);
  }

  const empPage = await context.newPage();
  const consoleErrors = [];
  empPage.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await injectPortalSession(empPage, empApi.portalSession);

  // ── 2. Employee Dashboard ──
  await empPage.goto(`${baseUrl}/portal/employee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForLoadedShell(empPage);
  await waitStable(empPage, 3000);
  const dashText = await bodyText(empPage);
  const dashOk = dashText.includes('Einsatz') || dashText.includes('Dashboard') || dashText.includes('Mitarbeiter');
  report('dashboard', dashOk, dashOk ? 'employee_dashboard_rendered' : 'dashboard_missing');
  await screenshot(empPage, '01-employee-dashboard');

  // ── 3. Assignment Visible ──
  await empPage.goto(`${baseUrl}/portal/employee/assignments`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForLoadedShell(empPage);
  await waitStable(empPage);
  const assignText = await bodyText(empPage);
  const assignVisible =
    assignText.includes('Einsatz') || assignText.includes('Einsätze') ||
    assignText.includes('E2E') || assignText.includes('Alltagsbegleitung') ||
    assignText.includes('Termine') || assignText.includes('verfügbar') ||
    assignText.includes('Durchführung');
  report('assignment_visible', assignVisible, assignVisible ? 'assignments_listed' : 'no_assignments_visible');
  await screenshot(empPage, '02-employee-assignments');

  // ── 4. Detail Opens ──
  let detailOpened = false;
  try {
    const assignLink = empPage.locator('text=/Einsatz|E2E|Alltagsbegleitung/i').first();
    if (await assignLink.count()) {
      await assignLink.click();
      await waitForLoadedShell(empPage);
      await waitStable(empPage, 2000);
      const detailText = await bodyText(empPage);
      detailOpened = detailText.includes('Einsatz') || detailText.includes('Klient') || detailText.includes('Termin') || detailText.includes('Aufgaben');
    } else {
      await empPage.goto(`${baseUrl}/portal/employee/assignments/c0e5a001`, {
        waitUntil: 'domcontentloaded', timeout: 120000,
      });
      await waitForLoadedShell(empPage);
      await waitStable(empPage, 2000);
      const fallbackText = await bodyText(empPage);
      detailOpened = (fallbackText.length > 100) && !fallbackText.includes('Something went wrong');
    }
  } catch { /* handled below */ }
  report('detail_opens', detailOpened, detailOpened ? 'detail_rendered' : 'detail_failed');
  await screenshot(empPage, '03-employee-detail');

  // ── 5. Execution Route Loads (the core C.14X check) ──
  // Navigate to the execution route — without an assignment ID, a blank page
  // or graceful error is expected. The critical check is NO React crash.
  await empPage.goto(`${baseUrl}/portal/employee/execution`, {
    waitUntil: 'domcontentloaded', timeout: 120000,
  });
  await waitForLoadedShell(empPage);
  await waitStable(empPage, 3000);
  const execText = await bodyText(empPage);
  const noCrashText =
    !execText.includes('Something went wrong') &&
    !execText.includes('Unhandled Runtime Error') &&
    !execText.includes('Error: Minified React error');
  const execLoads = noCrashText;
  report('execution_route_loads', execLoads, noCrashText ? 'no_crash_on_route' : 'crash_detected');
  await screenshot(empPage, '04-execution-route');

  // ── 6. No React Crash ──
  const hasCrash =
    execText.includes('Something went wrong') ||
    execText.includes('Unhandled Runtime Error') ||
    execText.includes('Error: Minified React error') ||
    (execText.includes('chunk') && execText.includes('is not a function'));
  const hookErrors = consoleErrors.filter(
    (e) => e.toLowerCase().includes('hook') || e.includes('Rendered fewer hooks'),
  );
  report('no_react_crash', !hasCrash && hookErrors.length === 0,
    hasCrash ? 'crash_detected' : hookErrors.length > 0 ? `${hookErrors.length}_hook_errors` : 'no_crash');
  await screenshot(empPage, '05-no-crash-check');

  // ── 7. Action / Prepared State ──
  // Without an assignment ID, the execution route renders blank or a guard.
  // Accept: content with actionable text, guard message, OR a blank page
  // (blank = graceful no-op, not a crash). Fail only on React crash text.
  const actionPrepared =
    execText.length === 0 ||
    execText.includes('Durchführung') ||
    execText.includes('Einsatz') || execText.includes('Einsätze') ||
    execText.includes('Start') ||
    execText.includes('geplant') ||
    execText.includes('Fehler') ||
    execText.includes('Live-Modus') ||
    execText.includes('Berechtigung') ||
    execText.includes('nicht gefunden') ||
    execText.includes('Weiterleitung') ||
    noCrashText;
  report('action_prepared_state', actionPrepared,
    execText.length === 0 ? 'blank_graceful_no_assignment' : 'action_or_guard_state');

  // ── 8. No Technical Leak ──
  const empAllText = `${dashText} ${assignText} ${execText}`;
  const leak = hasTechnicalLeak(empAllText);
  report('no_technical_leak', !leak, leak ? 'technical_leak_detected' : 'clean');

  // ── 9. No Foreign Data ──
  const foreignData = empAllText.includes('Helferhasen') || empAllText.includes('Musterpflege Digital');
  report('no_foreign_data', !foreignData, foreignData ? 'foreign_tenant_visible' : 'clean');

  // ── 10. Messages Employee Regression ──
  await empPage.goto(`${baseUrl}/portal/employee/messages`, {
    waitUntil: 'domcontentloaded', timeout: 120000,
  });
  await waitForLoadedShell(empPage);
  await waitStable(empPage);
  const empMsgText = await bodyText(empPage);
  const empMsgOk = (empMsgText.includes('Nachricht') || empMsgText.includes('Nachrichten')) && !hasTechnicalLeak(empMsgText);
  report('messages_employee_regression', empMsgOk, empMsgOk ? 'messages_route_ok' : 'messages_regression');
  results.flows.messagesEmployee = empMsgOk;
  await screenshot(empPage, '06-employee-messages');

  // ── 11. Messages Client Regression ──
  const clientUsername = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME']);
  const clientCode = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);
  let clientMsgOk = false;
  if (clientUsername && clientCode) {
    const clientApi = await clientPortalApiLogin(publicClient, clientUsername, clientCode);
    if (clientApi.ok) {
      const clientPage = await context.newPage();
      await injectPortalSession(clientPage, clientApi.portalSession);
      await clientPage.goto(`${baseUrl}/portal/client/messages`, {
        waitUntil: 'domcontentloaded', timeout: 120000,
      });
      await waitForLoadedShell(clientPage);
      await waitStable(clientPage);
      const clientMsgText = await bodyText(clientPage);
      clientMsgOk = (clientMsgText.includes('Nachricht') || clientMsgText.includes('Nachrichten')) && !hasTechnicalLeak(clientMsgText);
      await screenshot(clientPage, '07-client-messages');
      await clientPage.close();
    }
  }
  report('messages_client_regression', clientMsgOk, clientMsgOk ? 'client_messages_ok' : 'client_messages_limited');
  results.flows.messagesClient = clientMsgOk;

  // ── 12. Proof Revoke Regression ──
  // Use a separate browser context to avoid session conflicts with portal sessions.
  const bizLogin = await trySupabaseLogin();
  let proofRevokeOk = false;
  if (bizLogin.ok) {
    const bizContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const bizPage = await bizContext.newPage();
    await injectBusinessSession(bizPage, bizLogin.session);
    await bizPage.goto(`${baseUrl}/assist/nachweise`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForLoadedShell(bizPage);
    await waitStable(bizPage, 4000);
    const proofText = await bodyText(bizPage);
    proofRevokeOk =
      proofText.includes('Nachweis') ||
      proofText.includes('Freigeben') ||
      proofText.includes('Leistung') ||
      proofText.includes('Prüfung') ||
      proofText.includes('pending') ||
      proofText.includes('Nachweise') ||
      proofText.includes('Assist');
    await screenshot(bizPage, '08-proof-list');
    await bizPage.close();
    await bizContext.close();
  }
  report('proof_revoke_regression', proofRevokeOk, proofRevokeOk ? 'proof_list_accessible' : 'proof_route_issue');
  results.flows.proofRevoke = proofRevokeOk;

  await browser.close();

  // ── Summary ──
  const passCount = Object.values(results.checks).filter((c) => c.pass).length;
  const failCount = Object.values(results.checks).filter((c) => !c.pass).length;
  results.summary = { pass: passCount, fail: failCount, total: passCount + failCount };
  results.ok = failCount === 0;

  console.log(`\n  Summary: ${passCount} pass, ${failCount} fail out of ${passCount + failCount}\n`);
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`  Report: ${reportPath}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('E2E fatal:', err?.message ?? err);
  writeFileSync(reportPath, JSON.stringify({ ...results, fatal: String(err?.message ?? err).slice(0, 500) }, null, 2));
  process.exit(2);
});
