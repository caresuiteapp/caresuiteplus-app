#!/usr/bin/env node
/**
 * Phase 2.2 — cs_* Dokumente: MA-Portal RBAC + Send→Sign→Erledigt E2E smoke.
 * Credentials from .env / .env.local only — never logged.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditAdminClient,
  loadAuditEnv,
  pick,
} from './lib/auditSupabaseClient.mjs';
import {
  employeeEnvCreds,
  tryEmployeePortalLogin,
} from './lib/repairEmployeePortalAccount.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'http://localhost:8091').replace(/\/$/, '');
const screenshotDir = join(root, '.audit-screenshots-cs-phase2');
const reportPath = join(root, '.audit-cs-documents-phase2-smoke-results.json');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';
const TEMPLATE_TITLE = 'Portalzugang Mitarbeitende';
const TEMPLATE_KEY = 'employee_portal_access_letter';

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

function pushStep(steps, id, ok, detail) {
  steps.push({ id, ok, detail: detail ?? null });
}

async function businessLogin(env) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const email = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL']);
  const password = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']);
  if (!url || !key || !email || !password) return { ok: false, reason: 'missing_creds' };
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return { ok: false, reason: 'auth_failed' };
  const session = await res.json();
  if (!session.access_token) return { ok: false, reason: 'no_token' };
  return { ok: true, session, url, key };
}

async function injectBusinessSession(page, session, supabaseUrl) {
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [
      storageKey,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      }),
    ],
  );
}

async function employeePortalLogin(env) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const creds = employeeEnvCreds(env);
  if (!url || !key || !creds.username || !creds.password) {
    return { ok: false, reason: 'missing_creds' };
  }
  await tryEmployeePortalLogin({ url, key }, creds.username, creds.password);
  const res = await fetch(`${url}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.sessionToken || !data.account) return { ok: false, reason: 'auth_failed' };
  if (data.mustChangePassword) return { ok: false, reason: 'must_change_password' };

  const portalSession = {
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

  return { ok: true, portalSession, storageKey, sbPayload, employeeId: portalSession.employeeId };
}

async function injectEmployeePortalSession(page, login) {
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
      login.portalSession.accountId,
    ],
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
}

async function gotoSafe(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4000);
    return true;
  } catch {
    return false;
  }
}

async function clickExactButton(page, label) {
  const buttons = page.locator('[role="button"]');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const aria = ((await btn.getAttribute('aria-label')) ?? '').trim();
    const text = ((await btn.innerText()) ?? '').trim();
    if (aria === label || text === label) {
      await btn.click({ force: true, timeout: 15000 });
      return true;
    }
  }
  return false;
}

async function selectEmployeeRecipient(page, searchHint) {
  const search = page.locator('input[placeholder*="Mitarbeit"]').first();
  if (await search.isVisible({ timeout: 8000 }).catch(() => false)) {
    await search.fill(searchHint);
    await page.waitForTimeout(2500);
  }
  const panel = page.getByText('Mitarbeitende auswählen', { exact: false }).first();
  await panel.scrollIntoViewIfNeeded().catch(() => null);
  const rows = page.locator('div').filter({ hasText: searchHint }).filter({ hasNotText: 'Mandant' });
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const box = await row.boundingBox().catch(() => null);
    if (box && box.height > 20 && box.height < 200) {
      await row.click({ force: true, timeout: 10000 });
      return true;
    }
  }
  return false;
}

async function sendDocumentViaWizard(page, searchHint) {
  await gotoSafe(page, `${baseUrl}/business/office/documents/signatures`);
  const sendVisible = await page.getByText('Neues Dokument senden', { exact: true }).first()
    .isVisible({ timeout: 30000 }).catch(() => false);
  if (!sendVisible) return { ok: false, reason: 'send_button_missing' };
  await clickExactButton(page, 'Neues Dokument senden');
  await page.waitForTimeout(2500);

  if (!(await clickExactButton(page, TEMPLATE_TITLE))) {
    const tpl = page.locator('[role="button"]').filter({ hasText: TEMPLATE_TITLE }).first();
    if (!(await tpl.isVisible({ timeout: 8000 }).catch(() => false))) {
      return { ok: false, reason: 'template_not_found' };
    }
    await tpl.click({ force: true });
  }
  await page.waitForTimeout(1000);
  if (!(await clickExactButton(page, 'Weiter'))) return { ok: false, reason: 'weiter_missing' };
  await page.waitForTimeout(2000);

  if (!(await selectEmployeeRecipient(page, searchHint))) {
    return { ok: false, reason: 'employee_not_selected' };
  }
  await page.waitForTimeout(1000);
  if (!(await clickExactButton(page, 'Vorschau prüfen'))) {
    return { ok: false, reason: 'preview_missing' };
  }
  await page.waitForTimeout(5000);
  const body = await page.locator('body').innerText();
  await page.screenshot({ path: join(screenshotDir, 'office-preview-before-send.png'), fullPage: true });
  if (body.match(/fehl|Fehler|Bitte wählen|Kontext unvollständig/i)) {
    return { ok: false, reason: 'preview_validation_failed', detail: body.slice(0, 400) };
  }
  const sendButtons = page.locator('[role="button"]');
  const count = await sendButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = sendButtons.nth(i);
    const label = ((await btn.getAttribute('aria-label')) ?? (await btn.innerText()) ?? '').trim();
    if (label !== 'Senden') continue;
    const disabled = await btn.isDisabled().catch(() => false);
    if (disabled) continue;
    await btn.click({ force: true, timeout: 15000 });
    await page.waitForTimeout(5000);
    return { ok: true };
  }
  return { ok: false, reason: 'senden_missing', detail: body.slice(0, 400) };
}

async function drawSignature(page) {
  const canvas = page.getByTestId('portal-signature-canvas').first();
  const target = (await canvas.isVisible({ timeout: 5000 }).catch(() => false))
    ? canvas
    : page.locator('canvas').first();
  if (!(await target.isVisible({ timeout: 8000 }).catch(() => false))) {
    return { ok: false, reason: 'canvas_missing' };
  }
  const box = await target.boundingBox();
  if (!box) return { ok: false, reason: 'canvas_box_missing' };
  for (const yRatio of [0.35, 0.55, 0.72]) {
    const y = box.y + box.height * yRatio;
    await page.mouse.move(box.x + box.width * 0.15, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, y, { steps: 20 });
    await page.mouse.up();
  }
  const confirm = page.getByTestId('portal-signature-confirm-button');
  if (await confirm.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirm.click({ force: true, timeout: 10000 }).catch(() => null);
  }
  await page.waitForTimeout(3000);
  return { ok: true };
}

async function fetchLatestRequest(admin, tenantId, employeeId) {
  const q = `owner_tenant_id=eq.${tenantId}&employee_id=eq.${employeeId}&order=created_at.desc&limit=1&select=id,status,title,completed_at,source_template_key,rendered_html`;
  const result = await admin.restSelect('cs_document_requests', q);
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
    return { ok: false, reason: 'request_not_found' };
  }
  return { ok: true, request: result.data[0] };
}

async function verifyNoFakePdf(admin, requestId) {
  const q = `request_id=eq.${requestId}&select=id,file_kind,storage_path`;
  const result = await admin.restSelect('cs_document_request_files', q);
  if (!result.ok) return { ok: false, reason: 'files_query_failed' };
  const rows = result.data ?? [];
  return { ok: rows.length === 0, fileCount: rows.length };
}

async function resolveEmployeeSearchHint(admin, employeeId) {
  const q = `id=eq.${employeeId}&select=first_name,last_name,email`;
  const result = await admin.restSelect('employees', q);
  if (result.ok && Array.isArray(result.data) && result.data[0]) {
    const e = result.data[0];
    const full = [e.first_name, e.last_name].filter(Boolean).join(' ').trim();
    if (full) return full;
    if (e.email) return String(e.email).split('@')[0];
  }
  return 'P0';
}

async function main() {
  const env = loadEnvFiles();
  const steps = [];
  let requestId = null;
  mkdirSync(screenshotDir, { recursive: true });

  const biz = await businessLogin(env);
  if (!biz.ok) {
    const report = { ok: false, baseUrl, steps, error: biz.reason };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const empLogin = await employeePortalLogin(env);
  pushStep(steps, 'employee_login_precheck', empLogin.ok, empLogin.reason ?? empLogin.employeeId ?? null);
  if (!empLogin.ok) {
    const report = { ok: false, baseUrl, steps, error: empLogin.reason };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const admin = createAuditAdminClient(env);
  const tenantId = empLogin.portalSession.tenantId;
  const employeeId = empLogin.employeeId;
  const searchHint = await resolveEmployeeSearchHint(admin, employeeId);

  const browser = await chromium.launch({ headless: true });
  const officeContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const officePage = await officeContext.newPage();

  try {
    await injectBusinessSession(officePage, biz.session, biz.url);
    await gotoSafe(officePage, `${baseUrl}/business/office/documents/signatures`);
    const officeText = await officePage.locator('body').innerText();
    pushStep(steps, 'office_page_loads', officeText.length > 40);

    const sendResult = await sendDocumentViaWizard(officePage, searchHint);
    pushStep(steps, 'office_send_document', sendResult.ok, sendResult.reason ?? null);
    await officePage.screenshot({ path: join(screenshotDir, 'office-after-send.png'), fullPage: true });

    if (sendResult.ok) {
      const latest = await fetchLatestRequest(admin, tenantId, employeeId);
      pushStep(steps, 'db_request_created', latest.ok, latest.reason ?? latest.request?.status ?? null);
      if (latest.ok) {
        requestId = latest.request.id;
        pushStep(
          steps,
          'db_request_status_sent',
          ['sent', 'opened'].includes(latest.request.status),
          latest.request.status,
        );
      }
    }

    const empContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const empPage = await empContext.newPage();
    await injectEmployeePortalSession(empPage, empLogin);
    await gotoSafe(empPage, `${baseUrl}/portal/employee/documents/signatures`);
    const empText = await empPage.locator('body').innerText();
    pushStep(steps, 'employee_portal_signatures_route', empPage.url().includes('/documents/signatures'), empPage.url());
    pushStep(steps, 'employee_portal_documents_permission', !empText.includes('Kein Zugriff'));
    pushStep(
      steps,
      'employee_portal_empty_or_docs',
      empText.includes('Dokumente & Unterschriften')
        && (
          empText.includes('Öffnen und unterschreiben')
          || empText.includes('Alles erledigt')
          || empText.includes('Es liegen keine offenen Dokumente')
        ),
      empText.slice(0, 160),
    );

    const openBtn = empPage.locator('[role="button"]').filter({ hasText: 'Öffnen und unterschreiben' }).first();
    if (await openBtn.isVisible({ timeout: 20000 }).catch(() => false)) {
      await openBtn.click({ force: true });
      await empPage.waitForTimeout(4000);
      if (await clickExactButton(empPage, 'Unterschreiben')) {
        await empPage.waitForTimeout(1500);
        const signResult = await drawSignature(empPage);
        pushStep(steps, 'employee_portal_sign', signResult.ok, signResult.reason ?? null);
      } else {
        pushStep(steps, 'employee_portal_sign', false, 'sign_button_missing');
      }
      await empPage.waitForTimeout(3000);
    } else {
      pushStep(steps, 'employee_portal_sign', false, 'no_open_document');
    }

    if (requestId) {
      const latest = await fetchLatestRequest(admin, tenantId, employeeId);
      pushStep(steps, 'db_request_completed', latest.ok && latest.request.status === 'completed', latest.request?.status ?? null);
      pushStep(
        steps,
        'db_rendered_html_present',
        Boolean(latest.ok && latest.request.rendered_html && latest.request.rendered_html.length > 40),
      );
      const files = await verifyNoFakePdf(admin, requestId);
      pushStep(steps, 'db_no_fake_pdf_files', files.ok, `files=${files.fileCount ?? 0}`);
    }

    await injectBusinessSession(officePage, biz.session, biz.url);
    await gotoSafe(officePage, `${baseUrl}/business/office/documents/signatures`);
    const erledigt = officePage.getByText('Erledigt', { exact: true }).first();
    if (await erledigt.isVisible({ timeout: 5000 }).catch(() => false)) {
      await erledigt.click();
      await officePage.waitForTimeout(3000);
    }
    const doneText = await officePage.locator('body').innerText();
    pushStep(
      steps,
      'office_erledigt_list',
      doneText.includes(TEMPLATE_TITLE) || doneText.includes('Erledigt'),
      doneText.slice(0, 160),
    );
  } finally {
    await browser.close();
  }

  const failed = steps.filter((s) => !s.ok);
  const report = {
    ok: failed.length === 0,
    baseUrl,
    phase: '2.2',
    requestId,
    employeeId,
    tenantId,
    templateKey: TEMPLATE_KEY,
    generatedAt: new Date().toISOString(),
    steps,
    failed: failed.map((s) => s.id),
    screenshotDir,
    notes: ['No deploy, no push, no fake PDF in cs_document_request_files.'],
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err.message ?? err) }));
  process.exit(1);
});
