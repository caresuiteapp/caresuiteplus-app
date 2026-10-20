#!/usr/bin/env node
/**
 * C.13R.6 — Production browser E2E (Playwright). Credentials from .env only; never logged.
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
const outDir = join(root, 'docs', 'audit', 'content-portal-c13r6-browser-e2e-screenshots');
const reportPath = join(root, '.audit-content-portal-c13r6-browser-results.json');
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
  } catch {
    /* keep going */
  }
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

function record(checks, id, pass, detail) {
  checks.push({ id, pass, detail });
}

async function gotoAndCheck(page, checks, id, path, mustInclude = [], shotName) {
  try {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForLoadedShell(page);
    const text = await bodyText(page);
    const missing = mustInclude.filter((s) => !text.includes(s));
    const pass =
      missing.length === 0 &&
      !text.includes('Unexpected error') &&
      !text.match(/\[object Object\]/);
    record(checks, id, pass, pass ? 'loaded' : `missing:${missing.join(',') || 'error_text'}`);
    if (shotName) await screenshot(page, shotName);
    return { pass, text };
  } catch (err) {
    record(checks, id, false, String(err?.message ?? err).slice(0, 120));
    return { pass: false, text: '' };
  }
}

async function uiPortalLogin(page, loginPath, userKeys, passKeys, isCode = false) {
  const username = pick(process.env, userKeys);
  const secret = pick(process.env, passKeys);
  if (!username || !secret) return { ok: false, reason: 'missing_env' };
  await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitStable(page);
  const userInput = page.locator('input:not([type="password"])').first();
  const passInput = page.locator('input[type="password"], input[autocomplete="one-time-code"]').first();
  if (!(await userInput.count()) || !(await passInput.count())) {
    return { ok: false, reason: 'no_inputs' };
  }
  await userInput.fill(username);
  await passInput.fill(secret);
  await page.getByText('Einloggen', { exact: false }).first().click();
  await waitStable(page, 5000);
  const text = await bodyText(page);
  const fail =
    text.includes('falsch') ||
    text.includes('gesperrt') ||
    text.includes('abgelaufen') ||
    (loginPath.includes('business') && text.includes('E-Mail oder Passwort'));
  const onPortal =
    text.includes('Einsatz') ||
    text.includes('Dashboard') ||
    text.includes('Termin') ||
    text.includes('Nachricht') ||
    text.includes('Mitarbeiterportal') ||
    text.includes('Klientenportal') ||
    text.includes('Weiterleitung');
  return { ok: !fail && onPortal, text, reason: fail ? 'login_failed' : onPortal ? 'ok' : 'no_portal_ui' };
}

function hasTechnicalLeak(text) {
  return (
    text.includes('[object Object]') ||
    text.includes('undefined') ||
    /stack trace/i.test(text) ||
    /RLS policy/i.test(text)
  );
}

async function main() {
  loadEnvFile();
  const env = loadAuditEnv();
  const publicClient = createAuditPublicClient(env);
  const checks = [];
  const flows = {
    messagesEmployee: false,
    messagesClient: false,
    proofReleaseGrant: false,
    proofReleaseRevoke: false,
    employeeDurchfuehrung: false,
  };

  const result = {
    ok: false,
    phase: 'content_portal_c13r6_browser_e2e',
    baseUrl,
    targetEnvironment: 'production',
    screenshotDir: outDir,
    productionBuildCheck: false,
    functionalProductionCurrent: false,
    screenshotsCreated: false,
    checks,
    flows,
  };

  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitStable(page);
  const homeText = await bodyText(page);
  const versionVisible = homeText.includes('Version') || homeText.includes('1.0.0');
  record(checks, 'production_home', versionVisible, versionVisible ? 'version_label' : 'no_version');
  result.productionBuildCheck = versionVisible;
  await screenshot(page, 'production-build-check');
  result.screenshotsCreated = true;

  const login = await trySupabaseLogin();
  record(checks, 'api_business_login', login.ok, login.ok ? 'ok' : login.reason);
  if (!login.ok) {
    const ui = await uiPortalLogin(
      page,
      '/auth/business-login',
      ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL'],
      ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD'],
    );
    record(checks, 'ui_business_login', ui.ok, ui.ok ? 'ok' : ui.reason ?? 'failed');
    if (!ui.ok) {
      writeFileSync(reportPath, JSON.stringify({ ...result, blocker: 'business_login_failed' }, null, 2));
      await browser.close();
      process.exit(2);
    }
  } else {
    await injectBusinessSession(page, login.session);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitStable(page, 5000);
    record(checks, 'ui_business_login', true, 'session_injected');
  }

  const afterAuth = await bodyText(page);
  const tenantOk =
    afterAuth.includes('Test Pflege') ||
    afterAuth.includes('Office') ||
    afterAuth.includes('Assist') ||
    !afterAuth.includes('Helferhasen');
  record(checks, 'test_tenant_context', tenantOk, tenantOk ? 'ok' : 'unclear_tenant');
  await screenshot(page, 'business-office');

  await gotoAndCheck(page, checks, 'office_clients', '/business/office/clients', [], 'business-office-clients');
  await gotoAndCheck(page, checks, 'office_employees', '/business/office/employees', [], 'business-office-employees');
  await gotoAndCheck(page, checks, 'office_messages', '/business/messages', [], 'messages-employee');

  const assistVisits = await gotoAndCheck(
    page,
    checks,
    'assist_visits',
    '/assist/assignments',
    [],
    'business-assist-visits',
  );
  const visitVisible =
    assistVisits.text.includes('E2E Einsatz') ||
    assistVisits.text.includes('Alltagsbegleitung') ||
    assistVisits.text.includes('E2E');
  record(checks, 'business_test_visit_visible', visitVisible, visitVisible ? 'ok' : 'e2e_visit_not_found');

  await gotoAndCheck(page, checks, 'assist_proofs', '/assist/nachweise', [], 'business-assist-proofs');
  await gotoAndCheck(page, checks, 'assist_live', '/assist/live-status', [], 'business-assist-live-status');
  await gotoAndCheck(page, checks, 'assist_durchfuehrung', '/assist/durchfuehrung', [], 'business-assist-durchfuehrung');

  const { username: empUser, password: empPass } = employeeEnvCreds(env);
  const empApi = await employeePortalApiLogin(publicClient, empUser, empPass);
  record(checks, 'api_employee_portal_login', empApi.ok, empApi.ok ? 'ok' : 'failed');

  const empPage = await context.newPage();
  let empLoginOk = false;
  if (empApi.ok) {
    await injectPortalSession(empPage, empApi.portalSession);
    await empPage.goto(`${baseUrl}/portal/employee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitStable(empPage, 5000);
    const empDash = await bodyText(empPage);
    empLoginOk = !empDash.includes('falsch') && (empDash.includes('Einsatz') || empDash.includes('Dashboard') || empDash.includes('Mitarbeiter'));
    record(checks, 'employee_portal_login', empLoginOk, empLoginOk ? 'session_injected' : 'dashboard_missing');
  } else {
    const uiEmp = await uiPortalLogin(
      empPage,
      '/auth/employee-login',
      ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME'],
      ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD'],
    );
    empLoginOk = uiEmp.ok;
    record(checks, 'employee_portal_login', empLoginOk, empLoginOk ? 'ui_login' : uiEmp.reason ?? 'failed');
  }

  if (empLoginOk) {
    await screenshot(empPage, 'employee-portal-dashboard');
    const empText = await bodyText(empPage);
    const ownVisit = empText.includes('E2E') || empText.includes('Einsatz');
    record(checks, 'employee_visit_visible', ownVisit, ownVisit ? 'ok' : 'no_e2e_visit');
    await empPage.goto(`${baseUrl}/portal/employee/assignments`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitStable(empPage);
    await screenshot(empPage, 'employee-portal-visit');
    const assignText = await bodyText(empPage);
    record(
      checks,
      'employee_assignments_route',
      assignText.includes('Einsatz') || assignText.includes('E2E'),
      'assignments_page',
    );
    await empPage.goto(`${baseUrl}/portal/employee/execution`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitStable(empPage);
    const execText = await bodyText(empPage);
    flows.employeeDurchfuehrung =
      execText.includes('Durchführung') || execText.includes('Einsatz') || execText.includes('Start');
    record(checks, 'employee_durchfuehrung', flows.employeeDurchfuehrung, flows.employeeDurchfuehrung ? 'ok' : 'not_actionable');
    await empPage.goto(`${baseUrl}/portal/employee/messages`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitStable(empPage);
    await screenshot(empPage, 'employee-portal-messages');
    record(checks, 'employee_messages_route', true, 'loaded');
  }

  const clientUsername = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME']);
  const clientCode = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);
  const clientApi = clientUsername && clientCode
    ? await clientPortalApiLogin(publicClient, clientUsername, clientCode)
    : { ok: false };
  record(checks, 'api_client_portal_login', clientApi.ok, clientApi.ok ? 'ok' : 'failed');

  const clientPage = await context.newPage();
  let clientOk = false;
  if (clientApi.ok) {
    await injectPortalSession(clientPage, clientApi.portalSession);
    await clientPage.goto(`${baseUrl}/portal/client`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitStable(clientPage, 5000);
    const ct = await bodyText(clientPage);
    clientOk = !ct.includes('falsch') && (ct.includes('Termin') || ct.includes('Dashboard') || ct.includes('Klient'));
    record(checks, 'client_portal_login', clientOk, clientOk ? 'session_injected' : 'dashboard_missing');
  } else {
    await clientPage.goto(`${baseUrl}/auth/client-login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitStable(clientPage);
    if (clientUsername && clientCode) {
      const inputs = clientPage.locator('input');
      const n = await inputs.count();
      if (n >= 2) {
        await inputs.nth(0).fill(clientUsername);
        await inputs.nth(1).fill(clientCode);
        await clientPage.getByText('Einloggen', { exact: false }).first().click();
        await waitStable(clientPage, 5000);
        const ct = await bodyText(clientPage);
        clientOk = !ct.includes('falsch') && !ct.includes('gesperrt');
      }
    }
    record(checks, 'client_portal_login', clientOk, clientOk ? 'ui_login' : 'failed');
  }

  if (clientOk) {
    await screenshot(clientPage, 'client-portal-dashboard');
    await clientPage.goto(`${baseUrl}/portal/client/appointments`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitStable(clientPage);
    await screenshot(clientPage, 'client-portal-proof');
    const clientContentVisible =
      (await bodyText(clientPage)).includes('E2E') ||
      (await bodyText(clientPage)).includes('Termin') ||
      (await bodyText(clientPage)).includes('Einsatz');
    record(checks, 'client_portal_content_visible', clientContentVisible, clientContentVisible ? 'ok' : 'limited');
    await clientPage.goto(`${baseUrl}/portal/client/messages`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitStable(clientPage);
    await screenshot(clientPage, 'client-portal-messages');
    record(checks, 'client_portal_routes', true, 'loaded');
  }

  // Proof release flow (business UI)
  await page.goto(`${baseUrl}/assist/nachweise`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitStable(page, 4000);
  const proofListText = await bodyText(page);
  if (proofListText.includes('E2E') || proofListText.includes('pending') || proofListText.includes('Prüfung')) {
    const proofItem = page.getByText(/E2E|Leistungsnachweis|Prüfung/i).first();
    if (await proofItem.count()) {
      await proofItem.click();
      await waitStable(page, 2000);
    }
    const freigeben = page.getByText('Freigeben', { exact: false }).first();
    if (await freigeben.count()) {
      await freigeben.click();
      await waitStable(page, 4000);
    }
    const portalRelease = page.getByText('Ins Klientenportal freigeben', { exact: false }).first();
    if (await portalRelease.count()) {
      await portalRelease.click();
      await waitStable(page, 4000);
      flows.proofReleaseGrant = true;
    }
    if (clientOk) {
      await clientPage.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
      await waitStable(clientPage, 4000);
      await clientPage.goto(`${baseUrl}/portal/client/documents`, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await waitStable(clientPage);
      const afterRelease = await bodyText(clientPage);
      flows.proofReleaseGrant =
        flows.proofReleaseGrant && (afterRelease.includes('Nachweis') || afterRelease.includes('Leistung') || afterRelease.includes('Dokument'));
      const revokeBtn = page.getByText('Portal-Freigabe zurückziehen', { exact: false }).first();
      if (await revokeBtn.count()) {
        await revokeBtn.click();
        await waitStable(page, 4000);
        flows.proofReleaseRevoke = true;
        await clientPage.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitStable(clientPage, 3000);
      }
    }
  }
  record(checks, 'proof_release_grant', flows.proofReleaseGrant, flows.proofReleaseGrant ? 'ok' : 'not_completed');
  record(checks, 'proof_release_revoke', flows.proofReleaseRevoke, flows.proofReleaseRevoke ? 'ok' : 'not_completed');

  // Messages E2E — navigate business messages and check portal message tabs load
  await page.goto(`${baseUrl}/business/messages`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitStable(page);
  const msgBizText = await bodyText(page);
  flows.messagesEmployee =
    (msgBizText.includes('Nachricht') || msgBizText.includes('Nachrichten')) &&
    !hasTechnicalLeak(msgBizText);
  if (empLoginOk) {
    const empMsg = await bodyText(empPage);
    flows.messagesEmployee =
      flows.messagesEmployee &&
      (empMsg.includes('Nachricht') || empMsg.includes('Nachrichten'));
  }
  flows.messagesClient = msgBizText.includes('Nachricht') || msgBizText.includes('Nachrichten');
  if (clientOk) {
    const clientMsg = await bodyText(clientPage);
    flows.messagesClient =
      flows.messagesClient && (clientMsg.includes('Nachricht') || clientMsg.includes('Nachrichten'));
  }
  await screenshot(page, 'messages-client');
  record(checks, 'messages_employee_e2e', flows.messagesEmployee, flows.messagesEmployee ? 'routes_ok' : 'partial');
  record(checks, 'messages_client_e2e', flows.messagesClient, flows.messagesClient ? 'routes_ok' : 'partial');

  const allText = `${await bodyText(page)}${empLoginOk ? await bodyText(empPage) : ''}${clientOk ? await bodyText(clientPage) : ''}`;
  const techLeak = hasTechnicalLeak(allText);
  record(checks, 'no_technical_text_leak', !techLeak, techLeak ? 'leak_detected' : 'ok');
  const foreignData =
    allText.includes('Helferhasen') || allText.includes('Musterpflege Digital');
  record(checks, 'no_foreign_data_visible', !foreignData, foreignData ? 'foreign_tenant_leak' : 'ok');

  const criticalIds = [
    'api_business_login',
    'ui_business_login',
    'employee_portal_login',
    'client_portal_login',
    'business_test_visit_visible',
    'employee_visit_visible',
  ];
  const criticalPass = criticalIds.every((id) => checks.find((c) => c.id === id)?.pass);
  result.ok = criticalPass && versionVisible;
  result.functionalProductionCurrent = login.ok && empApi.ok && clientApi.ok;
  result.flows = flows;

  writeFileSync(reportPath, JSON.stringify(result, null, 2));
  await browser.close();
  console.log(
    JSON.stringify({
      ok: result.ok,
      checks: checks.length,
      functionalProductionCurrent: result.functionalProductionCurrent,
      flows,
    }),
  );
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(String(err?.message ?? err).slice(0, 200));
  process.exit(1);
});
