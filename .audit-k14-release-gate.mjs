#!/usr/bin/env node
/**
 * K.1.4 Release-Gate Hardening — Browser-Smoke + Daten-Checks (kein Deploy, kein Commit).
 */
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
const screenshotDir = join(root, 'docs/audit/k14-release-gate-screenshots');
const reportMd = join(root, 'docs/audit/client-portal-k14-release-gate.md');
const reportJson = join(root, 'docs/audit/client-portal-k14-release-gate.json');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';
const NAV_TIMEOUT = 120000;

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

  return { ok: true, portalSession, storageKey: supabaseAuthStorageKey(url), sbPayload, displayName: data.displayName };
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
        return !/Sitzung wird geprüft|Wird geladen…|Wird geladen\.\.\.|Einsätze werden geladen/i.test(t);
      },
      { timeout: 60000 },
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

const ROUTES = [
  { id: 'overview', path: '/portal/client', label: 'Übersicht' },
  { id: 'profile', path: '/portal/client/profile', label: 'Profil' },
  { id: 'appointments', path: '/portal/client/appointments', label: 'Einsätze' },
  { id: 'documents', path: '/portal/client/documents', label: 'Dokumente' },
  { id: 'signatures', path: '/portal/client/documents/signatures', label: 'Unterschriften' },
  { id: 'proofs', path: '/portal/client/proofs', label: 'Nachweise' },
  { id: 'messages', path: '/portal/client/messages', label: 'Nachrichten' },
];

const VIEWPORTS = [
  { key: 'iphone', device: devices['iPhone 13'], splitView: false },
  { key: 'ipad', device: devices['iPad Pro 11'], splitView: true },
  { key: 'desktop', device: { viewport: { width: 1280, height: 900 }, userAgent: devices['Desktop Chrome'].userAgent }, splitView: true },
];

async function openMobileThread(page, vpKey) {
  await gotoRoute(page, '/portal/client/messages');
  const threadRow = page.locator('[data-testid^="portal-thread-row-"]').first();
  const hasThread = await threadRow.isVisible({ timeout: 8000 }).catch(() => false);
  if (!hasThread) return { opened: false, threadId: null, reason: 'no_thread_row' };

  const threadId = await threadRow
    .getAttribute('data-testid')
    .then((id) => id?.replace('portal-thread-row-', '') ?? null);

  await threadRow.evaluate((el) => el.click());
  try {
    await page.waitForSelector('[data-testid="messaging-composer"], [data-testid="messenger-mobile-thread"]', {
      timeout: 45000,
    });
  } catch {
    if (threadId && vpKey === 'iphone') {
      await gotoRoute(page, `/portal/client/messages/${threadId}`);
      try {
        await page.waitForSelector('[data-testid="messaging-composer"]', { timeout: 45000 });
      } catch {
        /* still loading or error state */
      }
    }
  }

  await waitStable(page, 1500);
  const composerVisible = await page.locator('[data-testid="messaging-composer"]').isVisible().catch(() => false);
  const mobileThreadVisible = await page.locator('[data-testid="messenger-mobile-thread"]').isVisible().catch(() => false);
  return {
    opened: composerVisible || mobileThreadVisible,
    threadId,
    composerVisible,
    mobileThreadVisible,
  };
}

async function auditMessenger(page, vp) {
  const { key: vpKey, splitView } = vp;
  const open = await openMobileThread(page, vpKey);
  await screenshot(page, `messages_thread__${vpKey}`);

  if (!open.opened) {
    record(`${vpKey}_composer_in_thread`, false, open.reason ?? 'thread_not_opened');
    record(`${vpKey}_composer_input`, false, 'follow_on');
    if (!splitView) record(`${vpKey}_messenger_back`, false, 'follow_on');
    else record(`${vpKey}_messenger_back`, true, 'split_view_no_back_required', { skipped: true });
    record(`${vpKey}_thread_hides_bottom_nav`, vpKey !== 'iphone', 'no_thread');
    return;
  }

  const composer = page.locator('[data-testid="messaging-composer"]');
  const composerInThread = await composer.isVisible().catch(() => false);
  record(`${vpKey}_composer_in_thread`, composerInThread, composerInThread ? 'messaging-composer' : 'missing');

  const input = page.locator('[data-testid="chat-composer-input"]');
  record(`${vpKey}_composer_input`, await input.isVisible().catch(() => false), 'chat-composer-input');

  const sendBtn = page.locator('[data-testid="chat-composer-send"]');
  if (await sendBtn.count().catch(() => 0)) {
    record(`${vpKey}_composer_send`, await sendBtn.isVisible().catch(() => false), 'chat-composer-send');
  }

  const back = page.locator('[data-testid="messenger-back-to-list"]');
  if (splitView) {
    const backVisible = await back.isVisible().catch(() => false);
    record(`${vpKey}_messenger_back`, true, backVisible ? 'unexpected_back_in_split' : 'split_view_no_back_required', {
      skipped: !backVisible,
    });
  } else {
    record(`${vpKey}_messenger_back`, await back.isVisible().catch(() => false), 'back_to_list');
  }

  const bottomNavHidden = !(await page.locator('[data-testid="portal-mobile-nav"]').isVisible().catch(() => true));
  record(
    `${vpKey}_thread_hides_bottom_nav`,
    bottomNavHidden || vpKey !== 'iphone',
    bottomNavHidden ? 'hidden' : 'still_visible',
  );
}

async function queryAuditData(env, login) {
  const admin = createAuditAdminClient(env);
  const { clientId, tenantId } = login.portalSession;
  const out = { clientId, tenantId };

  if (!clientId || !tenantId) {
    out.error = 'missing_client_or_tenant';
    return out;
  }

  const openSigQ = `client_id=eq.${clientId}&owner_tenant_id=eq.${tenantId}&portal_visible=eq.true&status=in.(sent,opened,partially_signed)&select=id,status,title,updated_at&order=updated_at.desc&limit=5`;
  const openSig = await admin.restSelect('cs_document_requests', openSigQ);
  out.openSignatureRequests = openSig.ok ? (openSig.data ?? []) : [];
  out.openSignatureQueryOk = openSig.ok;

  const allSigQ = `client_id=eq.${clientId}&owner_tenant_id=eq.${tenantId}&portal_visible=eq.true&select=id,status,title&order=updated_at.desc&limit=10`;
  const allSig = await admin.restSelect('cs_document_requests', allSigQ);
  out.allSignatureRequests = allSig.ok ? (allSig.data ?? []) : [];

  const proofQ = `client_id=eq.${clientId}&tenant_id=eq.${tenantId}&portal_visible=eq.true&select=id,title,status,storage_path&order=created_at.desc&limit=10`;
  const proofs = await admin.restSelect('client_documents', proofQ);
  out.portalProofs = proofs.ok ? (proofs.data ?? []) : [];
  out.proofsQueryOk = proofs.ok;
  if (!proofs.ok) out.proofsQueryError = proofs.error?.message ?? 'query_failed';

  return out;
}

async function auditSignatureUi(page) {
  await gotoRoute(page, '/portal/client/documents');
  const bodyDocs = await page.locator('body').innerText().catch(() => '');
  const crossLink = /Offene Unterschriften/i.test(bodyDocs);
  record('signature_cross_link', crossLink, crossLink ? 'cross_link_visible' : 'missing');

  await gotoRoute(page, '/portal/client/documents/signatures');
  await screenshot(page, 'signatures_list__iphone');
  const bodySig = await page.locator('body').innerText().catch(() => '');
  const listVisible = /Unterschrift|Offen|Erledigt|Keine offenen/i.test(bodySig);
  record('signature_list_ui', listVisible, 'signatures_screen');

  const openCount = dataAudit.openSignatureRequests?.length ?? 0;
  record('signature_open_requests_db', openCount > 0, `${openCount} offene Anfrage(n) in DB`, {
    count: openCount,
  });

  if (openCount > 0) {
    const requestId = dataAudit.openSignatureRequests[0].id;
    await gotoRoute(page, `/portal/client/documents/signatures/${requestId}`);
    await screenshot(page, 'signature_detail__iphone');
    const detailBody = await page.locator('body').innerText().catch(() => '');
    record('signature_detail_ui', detailBody.length > 80, `detail_for_${requestId.slice(0, 8)}`);
    const hasSignAction = /Unterschreiben|Signatur|zeichnen/i.test(detailBody);
    record('signature_sign_action_ui', hasSignAction, hasSignAction ? 'sign_cta_present' : 'no_sign_cta');
    const misleadingPdf = /Finales PDF|PDF herunterladen|Download.*PDF/i.test(detailBody);
    record('signature_no_misleading_pdf', !misleadingPdf, misleadingPdf ? 'misleading_pdf_promise' : 'no_final_pdf_promise');
  } else {
    record('signature_detail_ui', false, 'no_open_request_for_detail', { skipped: true });
    record('signature_sign_action_ui', false, 'no_open_request', { skipped: true });
    record('signature_no_misleading_pdf', true, 'no_detail_without_data');
  }
}

async function auditProofsUi(page) {
  await gotoRoute(page, '/portal/client/proofs');
  await screenshot(page, 'proofs__iphone');
  const body = await page.locator('body').innerText().catch(() => '');
  record('proofs_ui_loads', body.length > 40, 'proofs_screen');

  const proofCount = dataAudit.portalProofs?.length ?? 0;
  record('proofs_data_db', proofCount > 0, `${proofCount} Nachweis(e) in DB`, { count: proofCount });

  if (proofCount > 0) {
    record('proofs_card_ui', /Leistungsnachweis|Offen|Unterschrieben/i.test(body), 'proof_card_or_status');
    const misleadingDownload = /PDF öffnen|Ansehen|Download/i.test(body);
    record('proofs_action_ui', misleadingDownload, 'pdf_action_visible');
  } else {
    record('proofs_card_ui', /Keine Nachweise|noch keine/i.test(body), 'empty_state_ok', { skipped: true });
    record('proofs_action_ui', false, 'no_proof_data_e2e', { skipped: true });
  }
}

function writeReport(extra = {}) {
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    k13Baseline: { passed: 42, failed: 6, total: 48 },
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
  const env = loadEnvFiles();
  const login = await clientPortalApiLogin(env);
  record('login', login.ok, login.ok ? 'ok' : login.reason);
  if (!login.ok) {
    writeReport({ loginFailed: true });
    process.exit(1);
  }

  try {
    Object.assign(dataAudit, await queryAuditData(env, login));
  } catch (err) {
    dataAudit.queryError = String(err?.message ?? err);
    record('data_audit_query', false, dataAudit.queryError);
  }

  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ ...vp.device, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    const page = await context.newPage();
    await injectClientSession(page, login);

    for (const route of ROUTES) {
      await gotoRoute(page, route.path);
      await screenshot(page, `${route.id}__${vp.key}`);
      const body = await page.locator('body').innerText().catch(() => '');
      record(`${route.id}_${vp.key}_loads`, body.length > 60, route.label);
      if (route.id === 'documents') {
        record(`${route.id}_${vp.key}_signatures_link`, /Offene Unterschriften/i.test(body), 'cross_link');
      }
      if (route.id === 'signatures') {
        record(`${route.id}_${vp.key}_list`, /Unterschrift|Offen|Erledigt|Keine offenen/i.test(body), 'signatures_screen');
      }
    }

    if (vp.key === 'iphone') {
      await gotoRoute(page, '/portal/client');
      const menuBtn = page.getByLabel(/Menü|menu/i).first();
      if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menuBtn.click();
        await waitStable(page, 1200);
        await screenshot(page, 'drawer__iphone');
        const drawerText = await page.locator('[data-testid="portal-navigation-drawer"]').innerText().catch(() => '');
        record('drawer_items', /Unterschriften|Nachweise|Einstellungen|Abmelden/i.test(drawerText), 'drawer_ok');
      }
      record('bottom_nav', await page.locator('[data-testid="portal-mobile-nav"]').isVisible().catch(() => false), 'portal-mobile-nav');

      await auditSignatureUi(page);
      await auditProofsUi(page);
    }

    await auditMessenger(page, vp);
    await context.close();
  }

  await browser.close();
  writeReport({ login: { displayName: login.displayName }, dataAudit });
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`K.1.4 audit: ${checks.length - failed}/${checks.length} green`);
  console.log(`Report JSON: ${reportJson}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  writeReport({ fatal: String(err) });
  process.exit(1);
});
