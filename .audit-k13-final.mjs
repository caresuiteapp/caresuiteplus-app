#!/usr/bin/env node
/**
 * K.1.3 Final UX — Browser-Smoke + Screenshots (kein Deploy, kein Commit).
 */
import { chromium, devices } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAuditEnv, pick } from './scripts/audit/lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)));
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'http://localhost:8091').replace(/\/$/, '');
const screenshotDir = join(root, 'docs/audit/k13-final-screenshots');
const reportMd = join(root, 'docs/audit/client-portal-k13-final-abnahme.md');
const reportJson = join(root, 'docs/audit/client-portal-k13-final-abnahme.json');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';
const NAV_TIMEOUT = 120000;

const checks = [];
const screenshots = [];

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
  { key: 'iphone', device: devices['iPhone 13'] },
  { key: 'ipad', device: devices['iPad Pro 11'] },
  { key: 'desktop', device: { viewport: { width: 1280, height: 900 }, userAgent: devices['Desktop Chrome'].userAgent } },
];

function writeReport(extra = {}) {
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    summary: { passed, failed, total: checks.length },
    checks,
    screenshots,
    deployApproved: false,
    ...extra,
  };
  writeFileSync(reportJson, JSON.stringify(payload, null, 2));

  const lines = [
    '# K.1.3 Final UX — Abnahmebericht',
    '',
    `**Stand:** ${payload.generatedAt}`,
    `**URL:** ${baseUrl}`,
    `**Ergebnis:** ${passed}/${checks.length} Checks grün`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] **${c.id}** — ${c.detail}`),
    '',
    '## Screenshots',
    ...screenshots.map((s) => `- \`${s.name}\`: ${s.path}`),
    '',
    '_Kein Deploy. Kein Commit._',
  ];
  writeFileSync(reportMd, lines.join('\n'));
  console.log(`Report: ${reportMd}`);
}

async function auditMessenger(page, vpKey) {
  await gotoRoute(page, '/portal/client/messages');
  const composeVisible = await page.getByText(/Verwaltung anschreiben/i).first().isVisible().catch(() => false);
  record(`${vpKey}_messages_compose`, composeVisible, composeVisible ? 'compose_cta' : 'missing');

  const composer = page.locator('[data-testid="messaging-composer"]');
  record(`${vpKey}_composer_in_list`, !(await composer.isVisible().catch(() => false)), 'composer_hidden_on_inbox');

  const threadRow = page.locator('[data-testid^="portal-thread-row-"]').first();
  if (await threadRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    await threadRow.click();
    await waitStable(page, 2000);
    await screenshot(page, `messages_thread__${vpKey}`);
    const composerInThread = await composer.isVisible().catch(() => false);
    record(`${vpKey}_composer_in_thread`, composerInThread, composerInThread ? 'messaging-composer' : 'missing');
    const input = page.locator('[data-testid="chat-composer-input"]');
    record(`${vpKey}_composer_input`, await input.isVisible().catch(() => false), 'chat-composer-input');
    const back = page.locator('[data-testid="messenger-back-to-list"]');
    record(`${vpKey}_messenger_back`, await back.isVisible().catch(() => false), 'back_to_list');
    const bottomNavHidden = !(await page.locator('[data-testid="portal-mobile-nav"]').isVisible().catch(() => true));
    record(`${vpKey}_thread_hides_bottom_nav`, bottomNavHidden || vpKey !== 'iphone', bottomNavHidden ? 'hidden' : 'still_visible');
  } else {
    record(`${vpKey}_composer_in_thread`, false, 'no_thread_to_open');
  }
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
    }

    await auditMessenger(page, vp.key);
    await context.close();
  }

  await browser.close();
  writeReport({ login: { displayName: login.displayName }, wcagReference: 'k12-design-wcag-bericht.md' });
  const failed = checks.filter((c) => !c.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  writeReport({ fatal: String(err) });
  process.exit(1);
});
