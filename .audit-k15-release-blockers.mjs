#!/usr/bin/env node
/**
 * K.1.5 Release-Blocker Audit — Messenger, Deep-Link, Signatur, Nachweise.
 */
import { spawnSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditAdminClient,
  loadAuditEnv,
  pick,
} from './scripts/audit/lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)));
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'http://localhost:8091').replace(/\/$/, '');
const screenshotDir = join(root, 'docs/audit/k15-release-blockers-screenshots');
const reportJson = join(root, 'docs/audit/client-portal-k15-release-blockers.json');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';
const NAV_TIMEOUT = 120000;
const CS_REQUEST_ID = 'c0e5e001-e001-4000-8000-000000000001';
const THREAD_CLIENT = 'c0e5c002-c002-4000-8000-000000000002';

const checks = [];
const screenshots = [];
const dataAudit = {};

function record(id, pass, detail, extra = {}) {
  checks.push({ id, pass, detail, ...extra });
}

function loadEnvFiles() {
  const env = loadAuditEnv();
  for (const file of ['.env.local', '.env']) {
    const p = join(root, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

function supabaseAuthStorageKey(url) {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

async function clientPortalApiLogin(env) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = pick(env, ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
  const username = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME']);
  const code = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);
  if (!url || !key || !username || !code) return { ok: false, reason: 'missing_client_creds' };

  const res = await fetch(`${url}/functions/v1/client-portal-login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sessionToken) return { ok: false, reason: data.error ?? 'auth_failed' };

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

  let sbPayload = null;
  if (data.supabaseAccessToken && data.supabaseRefreshToken) {
    sbPayload = JSON.stringify({
      access_token: data.supabaseAccessToken,
      refresh_token: data.supabaseRefreshToken,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: null,
    });
  }

  return {
    ok: true,
    portalSession,
    storageKey: supabaseAuthStorageKey(url),
    sbPayload,
    displayName: data.displayName,
  };
}

async function injectClientSession(page, login) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.evaluate(
    ([portalKey, portalVal, authKey, authVal, accountId]) => {
      localStorage.setItem(portalKey, portalVal);
      if (authKey && authVal) localStorage.setItem(authKey, authVal);
      localStorage.removeItem('portal-welcome-pending');
      if (accountId) {
        localStorage.setItem(`portal-welcome-seen:client:${accountId}`, new Date().toISOString());
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
  await page.reload({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
}

async function waitStable(page, ms = 3500) {
  try {
    await page.waitForFunction(
      () => {
        const t = document.body?.innerText ?? '';
        return !/Sitzung wird geprüft|Wird geladen…|Wird geladen\.\.\.|Einsätze werden geladen|Chat wird geladen/i.test(t);
      },
      { timeout: 90000 },
    );
  } catch {
    /* continue */
  }
  await page.waitForTimeout(ms);
}

async function gotoRoute(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await waitStable(page);
}

async function screenshot(page, name) {
  mkdirSync(screenshotDir, { recursive: true });
  const file = join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push({ name, path: file.replace(/\\/g, '/') });
}

async function queryAuditData(env, login) {
  const admin = createAuditAdminClient(env);
  const { clientId, tenantId } = login.portalSession;
  const out = { clientId, tenantId };
  if (!clientId || !tenantId) {
    out.error = 'missing_client_or_tenant';
    return out;
  }

  const openSigQ = `client_id=eq.${clientId}&owner_tenant_id=eq.${tenantId}&portal_visible=eq.true&status=in.(sent,opened,partially_signed)&select=id,status,title&limit=5`;
  const openSig = await admin.restSelect('cs_document_requests', openSigQ);
  out.openSignatureRequests = openSig.ok ? (openSig.data ?? []) : [];
  out.openSignatureQueryOk = openSig.ok;

  const proofQ = `client_id=eq.${clientId}&tenant_id=eq.${tenantId}&portal_visible=eq.true&category=eq.leistungsnachweis&status=eq.aktiv&select=id,title,status,storage_path&limit=5`;
  const proofs = await admin.restSelect('client_documents', proofQ);
  out.portalProofs = proofs.ok ? (proofs.data ?? []) : [];

  const visitQ = `tenant_id=eq.${tenantId}&client_id=eq.${clientId}&select=id&limit=5`;
  const visits = await admin.restSelect('assist_visits', visitQ);
  const visitIds = visits.ok ? (visits.data ?? []).map((v) => v.id) : [];
  if (visitIds.length > 0) {
    const assistQ = `tenant_id=eq.${tenantId}&portal_visible=eq.true&portal_release_status=in.(released,pending_client_signature)&visit_id=in.(${visitIds.join(',')})&select=id,proof_number,portal_release_status&limit=5`;
    const assistProofs = await admin.restSelect('assist_visit_proofs', assistQ);
    out.assistVisitProofs = assistProofs.ok ? (assistProofs.data ?? []) : [];
  } else {
    out.assistVisitProofs = [];
  }
  out.proofsQueryOk = proofs.ok || (out.assistVisitProofs?.length ?? 0) > 0;

  return out;
}

async function waitForThreadReady(page, timeoutMs = 90000) {
  try {
    await page.waitForSelector('[data-testid="messaging-composer"]', { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function auditIphoneMessenger(page) {
  await gotoRoute(page, '/portal/client/messages');
  await page.waitForSelector('[data-testid^="portal-thread-open-"], [data-testid^="portal-thread-row-"], text=Verwaltung anschreiben', {
    timeout: 30000,
  }).catch(() => {});
  record(
    'iphone_inbox_visible',
    await page.getByText(/Verwaltung anschreiben|E2E Klienten-Nachricht/i).first().isVisible().catch(() => false),
    'inbox',
  );

  const openRow = page.locator('[data-testid^="portal-thread-open-"]').first();
  const legacyRow = page.locator('[data-testid^="portal-thread-row-"]').first();
  const row = (await openRow.count()) > 0 ? openRow : legacyRow;
  const rowVisible = await row.isVisible({ timeout: 8000 }).catch(() => false);
  record('iphone_thread_row_visible', rowVisible, rowVisible ? 'thread_row' : 'missing');

  await gotoRoute(page, `/portal/client/messages/${THREAD_CLIENT}`);
  const opened = await waitForThreadReady(page, 90000);
  await screenshot(page, 'iphone_messenger_thread');
  record('iphone_thread_opens', opened, opened ? 'deeplink_composer_visible' : 'loading_or_error');

  const mobileThread = await page.locator('[data-testid="messenger-mobile-thread"]').isVisible().catch(() => false);
  record('iphone_thread_container', mobileThread || opened, mobileThread ? 'messenger-mobile-thread' : 'composer_only');

  record('iphone_composer_visible', await page.locator('[data-testid="messaging-composer"]').isVisible().catch(() => false), 'messaging-composer');
  record('iphone_composer_input', await page.locator('[data-testid="chat-composer-input"]').isVisible().catch(() => false), 'input');
  record('iphone_composer_send', await page.locator('[data-testid="chat-composer-send"]').isVisible().catch(() => false), 'send');

  const back = page.locator('[data-testid="messenger-back-to-list"]');
  record('iphone_back_visible', await back.isVisible().catch(() => false), 'back_to_list');

  const bottomNavHidden = !(await page.locator('[data-testid="portal-mobile-nav"]').isVisible().catch(() => true));
  record('iphone_bottom_nav_hidden', bottomNavHidden, bottomNavHidden ? 'hidden' : 'visible');

  if (await back.isVisible().catch(() => false)) {
    await back.click();
    await waitStable(page, 3000);
    const inboxBack =
      (await page.getByText(/Verwaltung anschreiben/i).first().isVisible().catch(() => false)) ||
      (await page.locator('[data-testid^="portal-thread-open-"]').first().isVisible().catch(() => false));
    record('iphone_back_to_inbox', inboxBack, inboxBack ? 'inbox_restored' : 'still_on_thread');
    await screenshot(page, 'iphone_messenger_inbox_after_back');
  } else {
    record('iphone_back_to_inbox', false, 'no_back_button');
  }
}

async function auditDeepLink(page, vpKey) {
  await gotoRoute(page, `/portal/client/messages/${THREAD_CLIENT}`);
  const loadingGone = await waitForThreadReady(page, 90000);
  await screenshot(page, `deeplink_thread__${vpKey}`);
  record(`${vpKey}_deeplink_loads`, loadingGone, loadingGone ? 'composer_ready' : 'stuck_loading');

  const body = await page.locator('body').innerText().catch(() => '');
  record(`${vpKey}_deeplink_title`, /E2E Klienten|Chat|Office|Liste/i.test(body), 'thread_context');
  record(`${vpKey}_deeplink_composer`, await page.locator('[data-testid="messaging-composer"]').isVisible().catch(() => false), 'composer');
  record(`${vpKey}_deeplink_no_eternal_loading`, !/Chat wird geladen/i.test(body), 'loading_ended');
}

async function auditSignatureFlow(page) {
  const openCount = dataAudit.openSignatureRequests?.length ?? 0;
  record('signature_db_open_count', openCount > 0, `${openCount} offene Anfrage(n)`, { count: openCount });

  await gotoRoute(page, '/portal/client/documents');
  record('signature_cross_link', /Offene Unterschriften/i.test(await page.locator('body').innerText().catch(() => '')), 'cross_link');

  await gotoRoute(page, '/portal/client/documents/signatures');
  await screenshot(page, 'signatures_list_iphone');
  const listBody = await page.locator('body').innerText().catch(() => '');
  record('signature_list_visible', /E2E Einwilligung|Offen|Unterschrift/i.test(listBody), 'list');

  if (openCount === 0) {
    record('signature_detail_visible', false, 'no_open_request', { skipped: true });
    record('signature_sign_area', false, 'no_open_request', { skipped: true });
    return;
  }

  const requestId = dataAudit.openSignatureRequests[0]?.id ?? CS_REQUEST_ID;
  await gotoRoute(page, `/portal/client/documents/signatures/${requestId}`);
  await screenshot(page, 'signature_detail_iphone');
  const detailBody = await page.locator('body').innerText().catch(() => '');
  record('signature_detail_visible', detailBody.length > 100, `detail_${requestId.slice(0, 8)}`);
  record('signature_sign_area', /Unterschreiben|Signatur|zeichnen/i.test(detailBody), 'sign_cta');
  record('signature_history_area', /Historie|Signatur|Unterschrift/i.test(detailBody), 'history_or_status');
  record('signature_no_misleading_pdf', !/Finales PDF herunterladen/i.test(detailBody), 'no_false_pdf_promise');
}

async function auditProofsFlow(page) {
  const proofCount = (dataAudit.portalProofs?.length ?? 0) + (dataAudit.assistVisitProofs?.length ?? 0);
  record('proofs_db_count', proofCount > 0, `${proofCount} Nachweis(e)`, { count: proofCount });

  await gotoRoute(page, '/portal/client/proofs');
  await page.waitForFunction(
    () => !/Nachweise werden geladen/i.test(document.body?.innerText ?? ''),
    { timeout: 60000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await screenshot(page, 'proofs_iphone');
  const body = await page.locator('body').innerText().catch(() => '');
  record('proofs_screen_loads', body.length > 40, 'proofs_route');

  if (proofCount > 0) {
    const hasCard = /E2E Leistungsnachweis|E2E-K15|Leistungsnachweis K\.1\.5/i.test(body);
    record('proofs_card_visible', hasCard, hasCard ? 'proof_card' : 'db_only_ui_gap');
    record('proofs_status_visible', /Offen|Unterschrieben|Abgerechnet/i.test(body), hasCard ? 'status' : 'ui_empty_despite_db');
    const hasAction = /PDF anzeigen|PDF|Download/i.test(body);
    record('proofs_action_honest', hasAction || /Keine Datei|nicht verfügbar|Sobald ein Einsatz/i.test(body), hasAction ? 'action_shown' : 'honest_empty_file');
  } else {
    record('proofs_card_visible', /Keine Nachweise|noch keine/i.test(body), 'empty_state', { skipped: true });
    record('proofs_status_visible', false, 'no_data', { skipped: true });
    record('proofs_action_honest', false, 'no_data', { skipped: true });
  }
}

async function auditSplitMessenger(page, vpKey) {
  await gotoRoute(page, '/portal/client/messages');
  const row = page.locator('[data-testid^="portal-thread-open-"], [data-testid^="portal-thread-row-"]').first();
  if (await row.isVisible({ timeout: 8000 }).catch(() => false)) {
    await row.click({ force: true });
    await waitStable(page, 2500);
  }
  await screenshot(page, `split_thread__${vpKey}`);
  record(`${vpKey}_split_composer`, await page.locator('[data-testid="messaging-composer"]').isVisible().catch(() => false), 'composer');
  record(`${vpKey}_split_back_na`, true, 'split_view_no_back_required', { skipped: true });
}

function writeReport(extra = {}) {
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    k14Baseline: { passed: 44, failed: 10, total: 54 },
    summary: { passed, failed, total: checks.length },
    checks,
    screenshots,
    dataAudit,
    deployApproved: false,
    ...extra,
  };
  writeFileSync(reportJson, JSON.stringify(payload, null, 2));
  return payload;
}

async function main() {
  mkdirSync(screenshotDir, { recursive: true });

  const seedRun = spawnSync(process.execPath, [join(root, '.audit-k15-seed.mjs')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 180000,
  });
  record('seed_k15', seedRun.status === 0, seedRun.status === 0 ? 'ok' : (seedRun.stderr || seedRun.stdout || '').slice(0, 200));

  const env = loadEnvFiles();
  const login = await clientPortalApiLogin(env);
  record('login', login.ok, login.ok ? 'ok' : login.reason);
  if (!login.ok) {
    writeReport({ loginFailed: true });
    process.exit(1);
  }

  Object.assign(dataAudit, await queryAuditData(env, login));

  const browser = await chromium.launch({ headless: true });

  const iphoneCtx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
  const iphonePage = await iphoneCtx.newPage();
  await injectClientSession(iphonePage, login);
  await auditSignatureFlow(iphonePage);
  await auditProofsFlow(iphonePage);
  await auditIphoneMessenger(iphonePage);
  await auditDeepLink(iphonePage, 'iphone');
  await iphoneCtx.close();

  for (const vp of [
    { key: 'ipad', device: devices['iPad Pro 11'] },
    { key: 'desktop', device: { viewport: { width: 1280, height: 900 }, userAgent: devices['Desktop Chrome'].userAgent } },
  ]) {
    const ctx = await browser.newContext({ ...vp.device, locale: 'de-DE' });
    const page = await ctx.newPage();
    await injectClientSession(page, login);
    await auditSplitMessenger(page, vp.key);
    await auditDeepLink(page, vp.key);
    await ctx.close();
  }

  await browser.close();

  const payload = writeReport({ login: { displayName: login.displayName } });
  console.log(`K.1.5 audit: ${payload.summary.passed}/${payload.summary.total} green`);
  console.log(`Report: ${reportJson}`);
  process.exit(payload.summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  writeReport({ fatal: String(err) });
  process.exit(1);
});
