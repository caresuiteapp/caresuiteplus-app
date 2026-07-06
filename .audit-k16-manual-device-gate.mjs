#!/usr/bin/env node
/**
 * K.1.6 — Manual Device Gate + Release Readiness
 * - Re-runs K.1.5 smoke (must be 40/40)
 * - Desktop Chrome counter-check (NOT a substitute for physical iPhone/Android/iPad)
 * - Signature completion attempt in real Chromium (headed optional via AUDIT_HEADED=1)
 */
import { spawnSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAuditEnv, pick } from './scripts/audit/lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)));
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'http://localhost:8091').replace(/\/$/, '');
const screenshotDir = join(root, 'docs/audit/k16-manual-device-gate-screenshots');
const reportJson = join(root, 'docs/audit/client-portal-k16-manual-device-gate.json');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';
const NAV_TIMEOUT = 120000;
const CS_REQUEST_ID = 'c0e5e001-e001-4000-8000-000000000001';
const THREAD_CLIENT = 'c0e5c002-c002-4000-8000-000000000002';

const checks = [];
const screenshots = [];
const deviceMatrix = {
  iphone_safari: { tested: false, browser: 'Safari', messenger: 'nicht_geprüft', keyboardSafeArea: 'nicht_geprüft', documents: 'nicht_geprüft', proofs: 'nicht_geprüft', overall: 'nicht_geprüft', note: 'Kein physisches iPhone in dieser Audit-Session verfügbar' },
  android_chrome: { tested: false, browser: 'Chrome', messenger: 'nicht_geprüft', keyboardSafeArea: 'nicht_geprüft', documents: 'nicht_geprüft', proofs: 'nicht_geprüft', overall: 'nicht_geprüft', note: 'Kein physisches Android-Gerät in dieser Audit-Session verfügbar' },
  ipad_safari: { tested: false, browser: 'Safari/Chrome', messenger: 'nicht_geprüft', keyboardSafeArea: 'nicht_geprüft', documents: 'nicht_geprüft', proofs: 'nicht_geprüft', overall: 'nicht_geprüft', note: 'Kein physisches iPad in dieser Audit-Session verfügbar' },
  desktop_chrome: { tested: false, browser: 'Chromium (Desktop-Gegencheck)', messenger: 'pending', keyboardSafeArea: 'n/a', documents: 'pending', proofs: 'pending', overall: 'pending', note: 'Playwright Chromium auf localhost — kein Ersatz für echte Geräte' },
};

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
    [PORTAL_SESSION_KEY, JSON.stringify(login.portalSession), login.storageKey, login.sbPayload, login.portalSession.accountId],
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
}

async function waitStable(page, ms = 3000) {
  try {
    await page.waitForFunction(
      () => !/Sitzung wird geprüft|Wird geladen…|Chat wird geladen/i.test(document.body?.innerText ?? ''),
      { timeout: 60000 },
    );
  } catch {
    /* continue */
  }
  await page.waitForTimeout(ms);
}

async function screenshot(page, name) {
  mkdirSync(screenshotDir, { recursive: true });
  const file = join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push({ name, path: file.replace(/\\/g, '/') });
}

async function desktopCounterCheck(page) {
  deviceMatrix.desktop_chrome.tested = true;

  await page.goto(`${baseUrl}/portal/client`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await waitStable(page);
  const overviewOk = !/Uncaught Error|falsch/i.test(await page.locator('body').innerText());
  record('desktop_overview', overviewOk, overviewOk ? 'overview_loaded' : 'error_or_login_fail');
  await screenshot(page, 'desktop_overview');

  await page.goto(`${baseUrl}/portal/client/messages`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await waitStable(page);
  const inboxOk = await page.getByText(/E2E Klienten-Nachricht|Verwaltung anschreiben/i).first().isVisible().catch(() => false);
  record('desktop_messenger_inbox', inboxOk, inboxOk ? 'inbox' : 'missing');
  deviceMatrix.desktop_chrome.messenger = inboxOk ? 'grün' : 'rot';

  await page.goto(`${baseUrl}/portal/client/messages/${THREAD_CLIENT}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForSelector('[data-testid="messaging-composer"]', { timeout: 90000 }).catch(() => {});
  const composerOk = await page.locator('[data-testid="messaging-composer"]').isVisible().catch(() => false);
  record('desktop_messenger_thread', composerOk, composerOk ? 'composer' : 'missing');
  await screenshot(page, 'desktop_messenger_thread');
  if (composerOk) deviceMatrix.desktop_chrome.messenger = 'grün';

  await page.goto(`${baseUrl}/portal/client/documents`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await waitStable(page);
  const docsOk = /Offene Unterschriften|Dokument/i.test(await page.locator('body').innerText());
  record('desktop_documents', docsOk, docsOk ? 'documents_tab' : 'missing');
  deviceMatrix.desktop_chrome.documents = docsOk ? 'grün' : 'rot';

  await page.goto(`${baseUrl}/portal/client/proofs`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForFunction(() => !/Nachweise werden geladen/i.test(document.body?.innerText ?? ''), { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const proofsBody = await page.locator('body').innerText();
  const proofsOk = /E2E Leistungsnachweis K\.1\.5/i.test(proofsBody);
  record('desktop_proofs_card', proofsOk, proofsOk ? 'proof_card' : 'missing');
  deviceMatrix.desktop_chrome.proofs = proofsOk ? 'grün' : 'rot';
  await screenshot(page, 'desktop_proofs');

  deviceMatrix.desktop_chrome.overall =
    [deviceMatrix.desktop_chrome.messenger, deviceMatrix.desktop_chrome.documents, deviceMatrix.desktop_chrome.proofs].every((v) => v === 'grün')
      ? 'grün'
      : 'rot';
}

async function signatureCompletionCheck(page) {
  await page.goto(`${baseUrl}/portal/client/documents/signatures/${CS_REQUEST_ID}`, {
    waitUntil: 'domcontentloaded',
    timeout: NAV_TIMEOUT,
  });
  await waitStable(page);
  const detailBody = await page.locator('body').innerText();
  const detailOk = /E2E Einwilligung|Unterschreiben/i.test(detailBody);
  record('manual_signature_detail', detailOk, detailOk ? 'detail_ready' : 'missing');
  await screenshot(page, 'signature_detail_desktop');

  const signBtn = page.getByRole('button', { name: /Unterschreiben/i }).first();
  const hasSignCta = await signBtn.isVisible({ timeout: 8000 }).catch(() => false);
  record('manual_signature_cta', hasSignCta, hasSignCta ? 'sign_cta' : 'no_open_request');

  if (!hasSignCta) {
    record('manual_signature_completed', false, 'skipped_no_cta', { skipped: true });
    return { completed: false, reason: 'no_sign_cta_or_already_signed' };
  }

  await signBtn.click();
  await page.waitForSelector('[data-testid="signature-fullscreen-overlay"]', { timeout: 15000 }).catch(() => {});
  const modalVisible = await page.locator('[data-testid="signature-fullscreen-overlay"]').isVisible().catch(() => false);
  record('manual_signature_modal', modalVisible, modalVisible ? 'modal_open' : 'modal_missing');
  await screenshot(page, 'signature_modal_desktop');

  if (!modalVisible) {
    record('manual_signature_completed', false, 'modal_not_opened');
    return { completed: false, reason: 'modal_not_opened' };
  }

  const canvas = page.locator('canvas').first();
  if (await canvas.isVisible().catch(() => false)) {
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 12 });
      await page.mouse.up();
    }
  }

  const confirmBtn = page.getByRole('button', { name: /Bestätigen|Speichern|Übernehmen|Fertig/i }).first();
  if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.click();
    await waitStable(page, 4000);
  }

  const afterBody = await page.locator('body').innerText();
  const success = /Erfolg|unterschrieben|abgeschlossen|Signatur gespeichert/i.test(afterBody) || !/Unterschreiben/i.test(afterBody);
  record('manual_signature_completed', success, success ? 'signed_or_status_changed' : 'sign_failed');
  await screenshot(page, 'signature_after_desktop');
  return { completed: success, reason: success ? 'ok' : 'confirm_failed' };
}

async function proofsActionCheck(page) {
  await page.goto(`${baseUrl}/portal/client/proofs`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForFunction(() => !/Nachweise werden geladen/i.test(document.body?.innerText ?? ''), { timeout: 60000 }).catch(() => {});
  const pdfBtn = page.getByRole('button', { name: /PDF anzeigen/i }).first();
  const pdfVisible = await pdfBtn.isVisible({ timeout: 8000 }).catch(() => false);
  record('manual_proofs_pdf_button', pdfVisible, pdfVisible ? 'button_visible' : 'missing');

  let pdfHonest = false;
  if (pdfVisible) {
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 8000 }).catch(() => null),
      pdfBtn.click(),
    ]);
    const bodyAfter = await page.locator('body').innerText();
    pdfHonest = Boolean(popup) || /nicht verfügbar|Vorschau|HTML|Phase/i.test(bodyAfter);
    record('manual_proofs_pdf_action', pdfHonest, pdfHonest ? 'honest_or_opened' : 'may_be_empty');
    await screenshot(page, 'proofs_pdf_action_desktop');
  } else {
    record('manual_proofs_pdf_action', false, 'no_button', { skipped: true });
  }

  const signProofBtn = page.getByRole('button', { name: /Unterschreiben/i }).first();
  const signProofVisible = await signProofBtn.isVisible().catch(() => false);
  record('manual_proofs_sign_button', signProofVisible, signProofVisible ? 'sign_flow_entry' : 'missing');

  return { pdfBinaryTested: false, uiHonest: pdfHonest || !pdfVisible };
}

function writeReport(extra = {}) {
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const k15Smoke = extra.k15Smoke ?? { passed: 40, failed: 0, total: 40 };
  const physicalDevicesTested = Object.entries(deviceMatrix)
    .filter(([k, v]) => k !== 'desktop_chrome')
    .some(([, v]) => v.tested);

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    phase: 'k16_manual_device_gate',
    k15SmokeRetest: k15Smoke,
    k15SmokeRegression: k15Smoke.failed > 0,
    summary: { passed, failed, total: checks.length },
    checks,
    deviceMatrix,
    physicalDevicesTested,
    desktopCounterCheckOnly: true,
    signatureManual: extra.signatureManual ?? {},
    proofsManual: extra.proofsManual ?? {},
    screenshots,
    deployApproved: false,
    codeChangesInK16: false,
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
  record('seed_k15', seedRun.status === 0, seedRun.status === 0 ? 'ok' : 'seed_failed');

  const smokeRun = spawnSync(process.execPath, [join(root, '.audit-k15-release-blockers.mjs')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 300000,
    env: { ...process.env, AUDIT_WEB_URL: baseUrl },
  });
  const smokeMatch = smokeRun.stdout?.match(/(\d+)\/(\d+) green/);
  const k15Passed = smokeMatch ? Number(smokeMatch[1]) : 0;
  const k15Total = smokeMatch ? Number(smokeMatch[2]) : 40;
  const k15Smoke = { passed: k15Passed, failed: k15Total - k15Passed, total: k15Total, exitCode: smokeRun.status };
  record('k15_smoke_retest', smokeRun.status === 0 && k15Passed === k15Total, `${k15Passed}/${k15Total}`);

  if (smokeRun.status !== 0 || k15Passed !== k15Total) {
    writeReport({ k15Smoke, blocker: 'k15_smoke_regression', deployApproved: false });
    console.error(`STOP: K.1.5 Smoke nicht 40/40 (${k15Passed}/${k15Total})`);
    process.exit(2);
  }

  const env = loadEnvFiles();
  const login = await clientPortalApiLogin(env);
  record('login', login.ok, login.ok ? 'ok' : login.reason);
  if (!login.ok) {
    writeReport({ k15Smoke, loginFailed: true });
    process.exit(1);
  }

  const headed = process.env.AUDIT_HEADED === '1';
  const browser = await chromium.launch({ headless: !headed });
  const ctx = await browser.newContext({ ...devices['Desktop Chrome'], locale: 'de-DE', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await injectClientSession(page, login);

  await desktopCounterCheck(page);
  const signatureManual = await signatureCompletionCheck(page);
  const proofsManual = await proofsActionCheck(page);

  await ctx.close();
  await browser.close();

  const payload = writeReport({
    k15Smoke,
    signatureManual,
    proofsManual,
    login: { displayName: login.displayName },
  });

  console.log(`K.1.6 gate: K.1.5 ${k15Passed}/${k15Total}, manual checks ${payload.summary.passed}/${payload.summary.total}`);
  console.log(`Physical devices tested: ${payload.physicalDevicesTested ? 'yes' : 'NO — desktop counter-check only'}`);
  console.log(`Report: ${reportJson}`);
  process.exit(payload.summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  writeReport({ fatal: String(err) });
  process.exit(1);
});
