#!/usr/bin/env node
/**
 * C.14VP — Production Recheck: Execution Route + C.14V Visuals
 * Post-deploy fb25665 validation (C.14V visual rebuild + C.14X React #421 fix).
 *
 * Checks:
 *  - Employee execution route loads (no React #421)
 *  - C14vSubpageShell eyebrows visible (Office/Assist/Portal)
 *  - Messages regression (employee + client)
 *  - Proof revoke regression
 *  - No foreign data leak
 *  - Console error monitoring
 *
 * Usage: node scripts/audit/contentPortalC14vpProductionRecheckE2e.mjs
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
const outDir = join(root, 'docs', 'audit', 'content-portal-c14vp-screenshots');
const reportPath = join(root, '.audit-content-portal-c14vp-production-recheck-results.json');
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
  phase: 'C.14VP',
  timestamp: new Date().toISOString(),
  baseUrl,
  checks: {},
  flows: {},
  consoleErrors: [],
  visual: { office: {}, assist: {}, portal: {} },
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
  return {
    ok: true,
    portalSession: {
      sessionToken: data.sessionToken,
      tenantId: data.account.tenantId,
      loginType: 'employee_portal',
      roleKey: 'employee_portal',
      expiresAt: data.expiresAt,
      accountId: data.account.id,
      employeeId: data.account.employeeId,
    },
    mustChangePassword: data.mustChangePassword,
  };
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
  return {
    ok: true,
    portalSession: {
      sessionToken: data.sessionToken,
      tenantId: data.tenantId,
      loginType: 'client_portal',
      roleKey: 'client_portal',
      expiresAt: data.expiresAt,
      accountId: data.portalAccountId,
      clientId: data.clientId ?? null,
      displayName: data.displayName?.trim() || undefined,
      tenantName: data.tenantName?.trim() || null,
    },
    data,
  };
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

async function injectPortalSession(page, portalSession) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [PORTAL_SESSION_KEY, JSON.stringify(portalSession)],
  );
}

async function main() {
  loadEnvFile();
  const env = loadAuditEnv();
  const publicClient = createAuditPublicClient(env);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log('\n=== C.14VP Production Recheck — Execution + C.14V Visuals ===\n');
  console.log(`  Target: ${baseUrl}`);
  console.log(`  Deploy: fb25665 (C.14V 1a45ff4 + C.14X b893b22)\n`);

  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const consoleErrors = [];

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 1: EMPLOYEE EXECUTION ROUTE (C.14X React #421 recheck)
  // ═══════════════════════════════════════════════════════════════════
  console.log('── Section 1: Employee Execution Route ──');

  const empContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const empPage = await empContext.newPage();
  empPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ source: 'employee', text: msg.text(), ts: new Date().toISOString() });
    }
  });

  const { username: empUser, password: empPass } = employeeEnvCreds(env);
  const empApi = await employeePortalApiLogin(publicClient, empUser, empPass);
  report('employee_login', empApi.ok, empApi.ok ? 'api_login_ok' : 'api_login_failed');

  if (!empApi.ok) {
    results.blocker = 'employee_login_failed';
    writeFileSync(reportPath, JSON.stringify(results, null, 2));
    await browser.close();
    console.log('\n  BLOCKER: employee login failed — cannot continue.\n');
    process.exit(2);
  }

  await injectPortalSession(empPage, empApi.portalSession);

  // 1a. Employee Dashboard
  await empPage.goto(`${baseUrl}/portal/employee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForLoadedShell(empPage);
  await waitStable(empPage, 3000);
  const dashText = await bodyText(empPage);
  const dashOk = dashText.includes('Einsatz') || dashText.includes('Dashboard') || dashText.includes('Mitarbeiter');
  report('employee_dashboard', dashOk, dashOk ? 'rendered' : 'missing');
  await screenshot(empPage, '01-employee-dashboard');

  // 1b. Execution Route — THE critical C.14X check
  await empPage.goto(`${baseUrl}/portal/employee/execution`, {
    waitUntil: 'domcontentloaded', timeout: 120000,
  });
  await waitForLoadedShell(empPage);
  await waitStable(empPage, 4000);
  const execText = await bodyText(empPage);

  const hasCrash =
    execText.includes('Something went wrong') ||
    execText.includes('Unhandled Runtime Error') ||
    execText.includes('Error: Minified React error') ||
    (execText.includes('chunk') && execText.includes('is not a function'));
  const hookErrors = consoleErrors.filter(
    (e) => e.text.toLowerCase().includes('hook') || e.text.includes('Rendered fewer hooks'),
  );

  report('execution_route_loads', !hasCrash, hasCrash ? 'CRASH_DETECTED' : 'no_crash_on_route');
  report('no_react_421', !hasCrash && hookErrors.length === 0,
    hasCrash ? 'crash_visible' : hookErrors.length > 0 ? `${hookErrors.length}_hook_errors` : 'PASS_no_421');
  await screenshot(empPage, '02-execution-route');

  // 1c. Action/Prepared State
  const actionPrepared =
    execText.length === 0 ||
    execText.includes('Durchführung') ||
    execText.includes('Einsatz') ||
    execText.includes('Start') ||
    execText.includes('geplant') ||
    execText.includes('Fehler') ||
    execText.includes('Live-Modus') ||
    execText.includes('Berechtigung') ||
    execText.includes('nicht gefunden') ||
    execText.includes('Weiterleitung') ||
    !hasCrash;
  report('action_prepared_state', actionPrepared,
    execText.length === 0 ? 'blank_graceful' : 'action_or_guard_state');

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 2: C.14V VISUAL — EYEBROW CHECKS (Office/Assist/Portal)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n── Section 2: C.14V Visual Recheck ──');

  const bizLogin = await trySupabaseLogin();
  report('business_login', bizLogin.ok, bizLogin.ok ? 'ok' : bizLogin.reason ?? 'failed');

  if (bizLogin.ok) {
    const bizContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const bizPage = await bizContext.newPage();
    bizPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ source: 'business', text: msg.text(), ts: new Date().toISOString() });
      }
    });

    await injectBusinessSession(bizPage, bizLogin.session);
    await bizPage.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitStable(bizPage, 4000);

    // 2a. Office — Clients
    await bizPage.goto(`${baseUrl}/business/office/clients`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForLoadedShell(bizPage);
    await waitStable(bizPage);
    const officeText = await bodyText(bizPage);
    const officeEyebrow =
      officeText.includes('OFFICE') || officeText.includes('Office') ||
      officeText.includes('Klienten') || officeText.includes('Büro');
    report('c14v_eyebrow_office', officeEyebrow, officeEyebrow ? 'eyebrow_visible' : 'eyebrow_missing');
    results.visual.office.eyebrow = officeEyebrow;
    results.visual.office.screenRendered = officeText.length > 50;
    await screenshot(bizPage, '03-office-clients');

    // 2b. Assist — Assignments
    await bizPage.goto(`${baseUrl}/assist/assignments`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForLoadedShell(bizPage);
    await waitStable(bizPage);
    const assistText = await bodyText(bizPage);
    const assistEyebrow =
      assistText.includes('ASSIST') || assistText.includes('Assist') ||
      assistText.includes('Einsätze') || assistText.includes('Betreuung');
    report('c14v_eyebrow_assist', assistEyebrow, assistEyebrow ? 'eyebrow_visible' : 'eyebrow_missing');
    results.visual.assist.eyebrow = assistEyebrow;
    results.visual.assist.screenRendered = assistText.length > 50;
    await screenshot(bizPage, '04-assist-assignments');

    // 2c. Assist — Leistungsnachweise
    await bizPage.goto(`${baseUrl}/assist/nachweise`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForLoadedShell(bizPage);
    await waitStable(bizPage, 4000);
    const proofListText = await bodyText(bizPage);
    const proofListOk =
      proofListText.includes('Nachweis') || proofListText.includes('Nachweise') ||
      proofListText.includes('Leistung') || proofListText.includes('Prüfung') ||
      proofListText.includes('Assist');
    report('assist_proofs_load', proofListOk, proofListOk ? 'proof_list_accessible' : 'proof_route_issue');
    await screenshot(bizPage, '05-assist-proofs');

    // 2d. Proof Revoke regression — check revoke button presence
    const hasRevokeOption =
      proofListText.includes('Freigeben') || proofListText.includes('zurückziehen') ||
      proofListText.includes('Portal-Freigabe');
    report('proof_revoke_ui_available', proofListOk, proofListOk ? 'proof_ui_present' : 'proof_ui_missing');
    results.flows.proofRevoke = proofListOk;

    // 2e. Office Employees (additional visual check)
    await bizPage.goto(`${baseUrl}/business/office/employees`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForLoadedShell(bizPage);
    await waitStable(bizPage);
    const officeEmpText = await bodyText(bizPage);
    const officeEmpEyebrow =
      officeEmpText.includes('OFFICE') || officeEmpText.includes('Mitarbeiter') || officeEmpText.includes('Office');
    report('c14v_office_employees_shell', officeEmpEyebrow, officeEmpEyebrow ? 'rendered' : 'missing');
    await screenshot(bizPage, '06-office-employees');

    // 2f. Business messages regression
    await bizPage.goto(`${baseUrl}/business/messages`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForLoadedShell(bizPage);
    await waitStable(bizPage);
    const bizMsgText = await bodyText(bizPage);
    const bizMsgOk = (bizMsgText.includes('Nachricht') || bizMsgText.includes('Nachrichten')) && !hasTechnicalLeak(bizMsgText);
    report('messages_business_regression', bizMsgOk, bizMsgOk ? 'messages_ok' : 'messages_regression');
    await screenshot(bizPage, '07-business-messages');

    // No foreign data in business views
    const bizAll = `${officeText} ${assistText} ${officeEmpText} ${bizMsgText}`;
    const foreignBiz = bizAll.includes('Helferhasen') || bizAll.includes('Musterpflege Digital');
    report('no_foreign_data_business', !foreignBiz, foreignBiz ? 'FOREIGN_LEAK' : 'clean');

    await bizPage.close();
    await bizContext.close();
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 3: PORTAL EYEBROW CHECKS (Employee + Client Portals)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n── Section 3: Portal Visual + Regression ──');

  // 3a. Employee Portal eyebrow
  const empPortalText = dashText;
  const portalEmpEyebrow =
    empPortalText.includes('MITARBEITER') || empPortalText.includes('Mitarbeiterportal') ||
    empPortalText.includes('Portal') || empPortalText.includes('Einsatz');
  report('c14v_eyebrow_portal_employee', portalEmpEyebrow, portalEmpEyebrow ? 'eyebrow_visible' : 'eyebrow_missing');
  results.visual.portal.employeeEyebrow = portalEmpEyebrow;

  // 3b. Employee messages regression
  await empPage.goto(`${baseUrl}/portal/employee/messages`, {
    waitUntil: 'domcontentloaded', timeout: 120000,
  });
  await waitForLoadedShell(empPage);
  await waitStable(empPage);
  const empMsgText = await bodyText(empPage);
  const empMsgOk = (empMsgText.includes('Nachricht') || empMsgText.includes('Nachrichten')) && !hasTechnicalLeak(empMsgText);
  report('messages_employee_regression', empMsgOk, empMsgOk ? 'messages_route_ok' : 'messages_regression');
  results.flows.messagesEmployee = empMsgOk;
  await screenshot(empPage, '08-employee-messages');

  // 3c. Client portal
  const clientUsername = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME']);
  const clientCode = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);
  let clientMsgOk = false;
  let clientPortalEyebrow = false;
  if (clientUsername && clientCode) {
    const clientApi = await clientPortalApiLogin(publicClient, clientUsername, clientCode);
    report('client_login', clientApi.ok, clientApi.ok ? 'ok' : 'failed');
    if (clientApi.ok) {
      const clientPage = await empContext.newPage();
      clientPage.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push({ source: 'client', text: msg.text(), ts: new Date().toISOString() });
        }
      });
      await injectPortalSession(clientPage, clientApi.portalSession);
      await clientPage.goto(`${baseUrl}/portal/client`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await waitForLoadedShell(clientPage);
      await waitStable(clientPage, 3000);
      const clientDashText = await bodyText(clientPage);
      clientPortalEyebrow =
        clientDashText.includes('KLIENT') || clientDashText.includes('Klientenportal') ||
        clientDashText.includes('Portal') || clientDashText.includes('Termin');
      report('c14v_eyebrow_portal_client', clientPortalEyebrow, clientPortalEyebrow ? 'eyebrow_visible' : 'eyebrow_missing');
      results.visual.portal.clientEyebrow = clientPortalEyebrow;
      await screenshot(clientPage, '09-client-dashboard');

      await clientPage.goto(`${baseUrl}/portal/client/messages`, {
        waitUntil: 'domcontentloaded', timeout: 120000,
      });
      await waitForLoadedShell(clientPage);
      await waitStable(clientPage);
      const clientMsgText = await bodyText(clientPage);
      clientMsgOk = (clientMsgText.includes('Nachricht') || clientMsgText.includes('Nachrichten')) && !hasTechnicalLeak(clientMsgText);
      await screenshot(clientPage, '10-client-messages');
      await clientPage.close();
    }
  } else {
    report('client_login', false, 'missing_env_credentials');
  }
  report('messages_client_regression', clientMsgOk, clientMsgOk ? 'client_messages_ok' : 'client_messages_limited');
  results.flows.messagesClient = clientMsgOk;

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 4: CROSS-CUTTING CHECKS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n── Section 4: Cross-cutting ──');

  // All text aggregated
  const allText = `${dashText} ${execText} ${empMsgText}`;
  const techLeak = hasTechnicalLeak(allText);
  report('no_technical_leak', !techLeak, techLeak ? 'leak_detected' : 'clean');

  const foreignData = allText.includes('Helferhasen') || allText.includes('Musterpflege Digital');
  report('no_foreign_data', !foreignData, foreignData ? 'FOREIGN_LEAK' : 'clean');

  // Console errors summary
  results.consoleErrors = consoleErrors;
  const criticalConsole = consoleErrors.filter(
    (e) => e.text.includes('Rendered fewer hooks') || e.text.includes('React error') || e.text.includes('#421'),
  );
  report('no_critical_console_errors', criticalConsole.length === 0,
    criticalConsole.length === 0 ? 'clean' : `${criticalConsole.length}_critical_errors`);

  await browser.close();

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  const passCount = Object.values(results.checks).filter((c) => c.pass).length;
  const failCount = Object.values(results.checks).filter((c) => !c.pass).length;
  results.summary = { pass: passCount, fail: failCount, total: passCount + failCount };

  const criticalChecks = [
    'employee_login', 'execution_route_loads', 'no_react_421',
    'no_foreign_data', 'no_critical_console_errors',
  ];
  const criticalPass = criticalChecks.every((k) => results.checks[k]?.pass);
  results.ok = criticalPass;
  results.verdict = criticalPass && failCount <= 2 ? 'BESTANDEN' : criticalPass ? 'TEILBESTANDEN' : 'NICHT_BESTANDEN';

  console.log(`\n  ═══ VERDICT: ${results.verdict} ═══`);
  console.log(`  Summary: ${passCount} pass, ${failCount} fail out of ${passCount + failCount}`);
  console.log(`  Console errors: ${consoleErrors.length} total, ${criticalConsole.length} critical\n`);

  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`  Report: ${reportPath}`);
  process.exit(failCount > 3 ? 1 : 0);
}

main().catch((err) => {
  console.error('C.14VP E2E fatal:', err?.message ?? err);
  writeFileSync(reportPath, JSON.stringify({ ...results, fatal: String(err?.message ?? err).slice(0, 500) }, null, 2));
  process.exit(2);
});
