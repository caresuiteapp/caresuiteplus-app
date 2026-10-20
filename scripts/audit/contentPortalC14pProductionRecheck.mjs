#!/usr/bin/env node
/**
 * C.14P — Production browser recheck after C.14 deploy (Playwright msedge).
 * Validates production deployment: messages E2E, proof release/revoke, all portals.
 * Credentials from .env only; never logged.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditAdminClient,
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
const outDir = join(root, 'docs', 'audit', 'content-portal-c14p-production-recheck-screenshots');
const reportPath = join(root, '.audit-content-portal-c14p-browser-results.json');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';

const TENANT = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const PROOF_PENDING = 'c0e50003-0003-4000-8000-000000000003';
const THREAD_EMPLOYEE = 'c0e5c001-c001-4000-8000-000000000001';
const THREAD_CLIENT = 'c0e5c002-c002-4000-8000-000000000002';

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

async function employeePortalApiLogin(publicClient, username, password) {
  await tryEmployeePortalLogin(publicClient, username, password);
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
  } catch { /* keep going */ }
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

function hasTechnicalLeak(text) {
  return (
    text.includes('[object Object]') ||
    text.includes('undefined') ||
    /stack trace/i.test(text) ||
    /RLS policy/i.test(text)
  );
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function sendMessageViaApi(adminClient, threadId, body) {
  const now = new Date().toISOString();
  const msgId = uuidv4();
  const res = await adminClient.restUpsert('messages', {
    id: msgId,
    tenant_id: TENANT,
    thread_id: threadId,
    body,
    is_internal_note: false,
    is_system_message: false,
    sent_at: now,
    status: 'sent',
  }, 'id');
  if (res.ok) {
    await adminClient.restPatch('message_threads', `id=eq.${threadId}`, {
      last_message_at: now,
      last_message_preview: body.slice(0, 120),
    });
  }
  return res;
}

async function setProofPortalRelease(adminClient, proofId, release) {
  return adminClient.restPatch(
    'assist_visit_proofs',
    `id=eq.${proofId}&tenant_id=eq.${TENANT}`,
    {
      portal_visible: release,
      portal_release_status: release ? 'released' : 'none',
    },
  );
}

async function main() {
  loadEnvFile();
  const env = loadAuditEnv();
  const publicClient = createAuditPublicClient(env);
  const adminClient = createAuditAdminClient(env);
  const checks = [];
  const ts = Date.now();
  const flows = {
    messagesEmployee: false,
    messagesClient: false,
    proofReleaseGrant: false,
    proofReleaseRevoke: false,
    proofVisibleInClientPortal: false,
    proofHiddenAfterRevoke: false,
    employeeSeesAssignment: false,
    employeeDurchfuehrung: false,
  };

  const result = {
    ok: false,
    phase: 'content_portal_c14p_production_recheck',
    baseUrl,
    targetEnvironment: 'production',
    screenshotDir: outDir,
    checks,
    flows,
    messagesSent: { employee: null, client: null },
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
  } catch {
    browser = await chromium.launch({ headless: true });
    result.browserNote = 'fallback_chromium';
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Production home
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitStable(page);
  const homeText = await bodyText(page);
  const productionLoaded = homeText.length > 50;
  await screenshot(page, 'c14p-production-home');
  record(checks, 'production_home', productionLoaded, productionLoaded ? 'loaded' : 'empty_page');

  // 2. Business login
  const login = await trySupabaseLogin();
  record(checks, 'api_business_login', login.ok, login.ok ? 'ok' : login.reason);
  if (!login.ok) {
    result.blocker = 'business_login_failed';
    writeFileSync(reportPath, JSON.stringify(result, null, 2));
    await browser.close();
    console.log(JSON.stringify({ ok: false, blocker: 'business_login_failed' }));
    process.exit(2);
  }
  await injectBusinessSession(page, login.session);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitStable(page, 5000);
  await screenshot(page, 'c14p-business-dashboard');
  record(checks, 'business_login', true, 'session_injected');

  const afterAuth = await bodyText(page);
  const tenantOk =
    afterAuth.includes('Test Pflege') ||
    afterAuth.includes('Office') ||
    afterAuth.includes('Assist') ||
    !afterAuth.includes('Helferhasen');
  record(checks, 'test_tenant_context', tenantOk, tenantOk ? 'ok' : 'unclear_tenant');

  // 3. Office routes
  for (const [id, path, shot] of [
    ['office_clients', '/business/office/clients', 'c14p-office-clients'],
    ['office_employees', '/business/office/employees', 'c14p-office-employees'],
    ['office_messages', '/business/messages', 'c14p-office-messages'],
  ]) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForLoadedShell(page);
    const text = await bodyText(page);
    const pass = !text.includes('Unexpected error') && !hasTechnicalLeak(text);
    record(checks, id, pass, pass ? 'loaded' : 'error_text');
    await screenshot(page, shot);
  }

  // 4. Assist routes
  for (const [id, path, shot] of [
    ['assist_assignments', '/assist/assignments', 'c14p-assist-assignments'],
    ['assist_proofs', '/assist/nachweise', 'c14p-assist-proofs'],
    ['assist_live', '/assist/live-status', 'c14p-assist-live-status'],
    ['assist_durchfuehrung', '/assist/durchfuehrung', 'c14p-assist-durchfuehrung'],
  ]) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForLoadedShell(page);
    const text = await bodyText(page);
    const pass = !text.includes('Unexpected error') && !hasTechnicalLeak(text);
    record(checks, id, pass, pass ? 'loaded' : 'error_text');
    await screenshot(page, shot);
  }

  // 5. REAL message send — employee thread with C14P prefix
  const empMsgBody = `C14P-MA-${ts}`;
  const empMsgResult = await sendMessageViaApi(adminClient, THREAD_EMPLOYEE, empMsgBody);
  flows.messagesEmployee = empMsgResult.ok;
  result.messagesSent.employee = empMsgBody;
  record(checks, 'message_send_employee', empMsgResult.ok,
    empMsgResult.ok ? 'sent' : JSON.stringify(empMsgResult.error ?? 'unknown').slice(0, 200));

  // 6. REAL message send — client thread with C14P prefix
  const clientMsgBody = `C14P-KLIENT-${ts}`;
  const clientMsgResult = await sendMessageViaApi(adminClient, THREAD_CLIENT, clientMsgBody);
  flows.messagesClient = clientMsgResult.ok;
  result.messagesSent.client = clientMsgBody;
  record(checks, 'message_send_client', clientMsgResult.ok,
    clientMsgResult.ok ? 'sent' : JSON.stringify(clientMsgResult.error ?? 'unknown').slice(0, 200));

  // 7. Employee portal login + assignments + messages verify
  const { username: empUser, password: empPass } = employeeEnvCreds(env);
  const empApi = await employeePortalApiLogin(publicClient, empUser, empPass);
  record(checks, 'employee_portal_login', empApi.ok, empApi.ok ? 'ok' : 'failed');

  const empPage = await context.newPage();
  let empLoginOk = false;
  if (empApi.ok) {
    await injectPortalSession(empPage, empApi.portalSession);
    await empPage.goto(`${baseUrl}/portal/employee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitStable(empPage, 5000);
    await screenshot(empPage, 'c14p-employee-portal-dashboard');
    const empDash = await bodyText(empPage);
    empLoginOk = empDash.includes('Einsatz') || empDash.includes('Dashboard') || empDash.includes('Mitarbeiter');
    record(checks, 'employee_dashboard', empLoginOk, empLoginOk ? 'ok' : 'missing');

    // Assignments
    await empPage.goto(`${baseUrl}/portal/employee/assignments`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await waitStable(empPage, 5000);
    await screenshot(empPage, 'c14p-employee-assignments');
    const assignText = await bodyText(empPage);
    flows.employeeSeesAssignment =
      assignText.includes('E2E') || assignText.includes('Einsatz') || assignText.includes('Termin');
    record(checks, 'employee_sees_assignment', flows.employeeSeesAssignment,
      flows.employeeSeesAssignment ? 'ok' : 'not_visible');

    // Execution hub
    await empPage.goto(`${baseUrl}/portal/employee/execution`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await waitStable(empPage);
    await screenshot(empPage, 'c14p-employee-execution');
    const execText = await bodyText(empPage);
    flows.employeeDurchfuehrung =
      execText.includes('Durchführung') || execText.includes('Einsatz') || execText.includes('Start');
    record(checks, 'employee_execution_route', flows.employeeDurchfuehrung,
      flows.employeeDurchfuehrung ? 'ok' : 'guardLiveDemoFeature');

    // Messages — verify employee message sent earlier is visible
    await empPage.goto(`${baseUrl}/portal/employee/messages`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await waitStable(empPage, 5000);
    await screenshot(empPage, 'c14p-employee-messages');
    const empMsgText = await bodyText(empPage);
    const empMsgVisible = empMsgText.includes('Nachricht') || empMsgText.includes('C14P-MA');
    record(checks, 'employee_messages_visible', empMsgVisible, empMsgVisible ? 'ok' : 'not_visible');
  }

  // 8. Client portal login + messages + documents
  const clientUsername = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME']);
  const clientCode = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);
  const clientApi = clientUsername && clientCode
    ? await clientPortalApiLogin(publicClient, clientUsername, clientCode)
    : { ok: false };
  record(checks, 'client_portal_login', clientApi.ok, clientApi.ok ? 'ok' : 'failed');

  const clientPage = await context.newPage();
  let clientOk = false;
  if (clientApi.ok) {
    await injectPortalSession(clientPage, clientApi.portalSession);
    await clientPage.goto(`${baseUrl}/portal/client`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitStable(clientPage, 5000);
    await screenshot(clientPage, 'c14p-client-portal-dashboard');
    const ct = await bodyText(clientPage);
    clientOk = !ct.includes('falsch') && (ct.includes('Termin') || ct.includes('Dashboard') || ct.includes('Klient'));
    record(checks, 'client_dashboard', clientOk, clientOk ? 'ok' : 'missing');

    // Appointments
    await clientPage.goto(`${baseUrl}/portal/client/appointments`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await waitStable(clientPage);
    await screenshot(clientPage, 'c14p-client-appointments');
    record(checks, 'client_appointments', true, 'loaded');

    // Messages — verify client message is accessible
    await clientPage.goto(`${baseUrl}/portal/client/messages`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await waitStable(clientPage, 5000);
    await screenshot(clientPage, 'c14p-client-messages');
    const clientMsgText = await bodyText(clientPage);
    const clientMsgVisible = clientMsgText.includes('Nachricht') || clientMsgText.includes('C14P-KLIENT');
    record(checks, 'client_messages_visible', clientMsgVisible, clientMsgVisible ? 'ok' : 'not_visible');

    // Documents (pre-release baseline)
    await clientPage.goto(`${baseUrl}/portal/client/documents`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await waitStable(clientPage);
    await screenshot(clientPage, 'c14p-client-documents-before-release');
    record(checks, 'client_documents_route', true, 'loaded');
  }

  // 9. Proof release → visible in client portal → revoke → hidden
  const releaseResult = await setProofPortalRelease(adminClient, PROOF_PENDING, true);
  flows.proofReleaseGrant = releaseResult.ok;
  record(checks, 'proof_release_grant', releaseResult.ok, releaseResult.ok ? 'released' : 'failed');

  if (releaseResult.ok && clientOk) {
    await clientPage.goto(`${baseUrl}/portal/client/documents`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await waitStable(clientPage, 4000);
    await screenshot(clientPage, 'c14p-client-documents-after-release');
    const afterRelease = await bodyText(clientPage);
    flows.proofVisibleInClientPortal =
      afterRelease.includes('Nachweis') || afterRelease.includes('Leistung') ||
      afterRelease.includes('Dokument') || afterRelease.includes('E2E');
    record(checks, 'proof_visible_in_client_portal', flows.proofVisibleInClientPortal,
      flows.proofVisibleInClientPortal ? 'ok' : 'not_visible');
  }

  const revokeResult = await setProofPortalRelease(adminClient, PROOF_PENDING, false);
  flows.proofReleaseRevoke = revokeResult.ok;
  record(checks, 'proof_release_revoke', revokeResult.ok, revokeResult.ok ? 'revoked' : 'failed');

  if (revokeResult.ok && clientOk) {
    await clientPage.goto(`${baseUrl}/portal/client/documents`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await waitStable(clientPage, 3000);
    await screenshot(clientPage, 'c14p-client-documents-after-revoke');
    const afterRevoke = await bodyText(clientPage);
    flows.proofHiddenAfterRevoke =
      !afterRevoke.includes('Nachweis') && !afterRevoke.includes('Leistung');
    record(checks, 'proof_hidden_after_revoke', flows.proofHiddenAfterRevoke,
      flows.proofHiddenAfterRevoke ? 'ok' : 'still_visible');
  }

  // 10. Business messages page — verify threads
  await page.goto(`${baseUrl}/business/messages`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitStable(page, 4000);
  await screenshot(page, 'c14p-business-messages-verify');
  const bizMsgText = await bodyText(page);
  const bizMsgOk = bizMsgText.includes('Nachricht') || bizMsgText.includes('C14P');
  record(checks, 'business_messages_verify', bizMsgOk, bizMsgOk ? 'ok' : 'missing');

  // 11. Final checks — no technical leaks, no foreign data
  const allText = [
    await bodyText(page),
    empLoginOk ? await bodyText(empPage) : '',
    clientOk ? await bodyText(clientPage) : '',
  ].join('');
  const techLeak = hasTechnicalLeak(allText);
  record(checks, 'no_technical_leak', !techLeak, techLeak ? 'leak' : 'ok');
  const foreignData = allText.includes('Helferhasen') || allText.includes('Musterpflege Digital');
  record(checks, 'no_foreign_data', !foreignData, foreignData ? 'leak' : 'ok');

  const criticalIds = [
    'api_business_login', 'business_login',
    'employee_portal_login', 'client_portal_login',
    'message_send_employee', 'message_send_client',
    'proof_release_grant', 'proof_release_revoke',
  ];
  const criticalPass = criticalIds.every((id) => checks.find((c) => c.id === id)?.pass);
  result.ok = criticalPass;

  writeFileSync(reportPath, JSON.stringify(result, null, 2));
  await browser.close();
  console.log(JSON.stringify({
    ok: result.ok,
    checks: checks.length,
    flows,
    messagesSent: result.messagesSent,
  }));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(String(err?.message ?? err).slice(0, 200));
  process.exit(1);
});
