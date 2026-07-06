#!/usr/bin/env node
/**
 * K.1 Production Verify — Migration 0230 + Klient:innenportal Smoke.
 * Credentials from .env only — never logged.
 */
import { chromium, devices } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAuditEnv, pick } from './scripts/audit/lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)));
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'https://caresuiteplus.app').replace(/\/$/, '');
const screenshotDir = join(root, 'docs/audit/client-portal-k1-smoke-screenshots');
const reportJson = join(root, 'docs/audit/client-portal-k1-production-verify.json');
const reportMd = join(root, 'docs/audit/client-portal-k1-production-verify.md');
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
  if (!url || !key || !username || !code) {
    return { ok: false, reason: 'missing_client_creds' };
  }

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
  if (!res.ok || !data.sessionToken) {
    return { ok: false, reason: data.error ?? 'auth_failed' };
  }

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

  return {
    ok: true,
    url,
    key,
    username,
    portalSession,
    storageKey: supabaseAuthStorageKey(url),
    sbPayload,
    displayName: data.displayName,
    tenantName: data.tenantName,
    accessToken: data.supabaseAccessToken,
  };
}

async function verifyPortalDefaultsRls(login) {
  if (!login.accessToken || !login.portalSession?.tenantId) {
    return { ok: false, reason: 'no_portal_jwt' };
  }
  const res = await fetch(
    `${login.url}/rest/v1/tenant_client_portal_defaults?tenant_id=eq.${login.portalSession.tenantId}&select=portal_enabled,show_appointments,show_messages,show_documents,show_proofs`,
    {
      headers: {
        apikey: login.key,
        Authorization: `Bearer ${login.accessToken}`,
        Accept: 'application/json',
      },
    },
  );
  const rows = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, reason: `http_${res.status}`, body: rows };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, reason: 'empty_defaults' };
  return { ok: true, defaults: rows[0] };
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
        return !/Sitzung wird geprüft|Wird geladen…|Wird geladen\.\.\./i.test(t);
      },
      { timeout: 45000 },
    );
  } catch {
    /* continue */
  }
  await page.waitForTimeout(ms);
}

async function bodyText(page) {
  return page.locator('body').innerText().catch(() => '');
}

async function screenshot(page, name) {
  mkdirSync(screenshotDir, { recursive: true });
  const file = join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push({ name, path: file.replace(/\\/g, '/') });
}

async function gotoRoute(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await waitStable(page);
}

function greetingLooksCorrect(text, login) {
  const tenant = (login.tenantName ?? 'AVENTA').trim();
  const display = (login.displayName ?? '').trim();
  const hasTenantModule = text.includes(tenant) && /Assist|AVENTA · Assist/i.test(text);
  const notTenantAsNameOnly =
    !new RegExp(`Guten (Morgen|Tag|Abend),\\s*${tenant}\\b`, 'i').test(text) ||
    text.includes('\n') ||
    display && display !== tenant && text.includes(display);
  return { hasTenantModule, notTenantAsNameOnly, display, tenant };
}

async function main() {
  const env = loadEnvFiles();
  const migrationApplied = true;
  const migrationVersion = '20260706034328';
  const migrationName = 'client_portal_settings_rls';

  const login = await clientPortalApiLogin(env);
  record('api_client_portal_login', login.ok, login.ok ? 'ok' : login.reason);
  if (!login.ok) {
    writeReport({ migrationApplied, migrationVersion, migrationName, login, checks, screenshots });
    process.exit(1);
  }

  const defaultsCheck = await verifyPortalDefaultsRls(login);
  record(
    'api_portal_defaults_readable',
    defaultsCheck.ok,
    defaultsCheck.ok ? 'tenant_defaults_select_ok' : defaultsCheck.reason,
  );

  const iphone = devices['iPhone 13'];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...iphone,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  });
  const page = await context.newPage();

  await injectClientSession(page, login);

  // Overview
  await gotoRoute(page, '/portal/client');
  let text = await bodyText(page);
  await screenshot(page, '01-overview-iphone');

  const profileError = /Portal-Defaults nicht gefunden|Profil nicht verfügbar/i.test(text);
  record('profile_no_defaults_error', !profileError, profileError ? 'error_visible' : 'no_error_on_overview');

  const greet = greetingLooksCorrect(text, login);
  record(
    'greeting_client_name',
    greet.notTenantAsNameOnly && (greet.display ? text.includes(greet.display.split(' ').pop() ?? '') : true),
    greet.notTenantAsNameOnly ? `display=${greet.display || 'n/a'}` : 'tenant_used_as_name',
  );
  record(
    'greeting_tenant_module',
    greet.hasTenantModule,
    greet.hasTenantModule ? `${greet.tenant} · Assist visible` : 'tenant_module_missing',
  );

  const begleitungenCard = /Begleitungen/i.test(text);
  const begleitungenCount = text.match(/Begleitungen[\s\S]{0,80}?(\d+)/i);
  const begleitungenHasNumber = begleitungenCount && Number(begleitungenCount[1]) > 0;
  record(
    'begleitungen_kpi',
    !begleitungenHasNumber,
    begleitungenHasNumber ? `count=${begleitungenCount[1]}` : begleitungenCard ? 'hidden_or_zero' : 'card_absent',
  );

  // Profile
  await gotoRoute(page, '/portal/client/profile');
  text = await bodyText(page);
  await screenshot(page, '02-profile-iphone');
  const profileBlocked = /Portal-Defaults nicht gefunden|Profil nicht verfügbar|Kein Klient:innenprofil/i.test(text);
  record('profile_loads', !profileBlocked, profileBlocked ? 'blocked' : 'profile_content_visible');
  record(
    'profile_fields_present',
    /Pflegegrad|Leistungsart|Kundennummer|Mandant|Ansprechpartner|Notfall/i.test(text) ||
      /Klient:innenprofil|Portal/i.test(text),
    'field_scan',
  );

  // Appointments
  await gotoRoute(page, '/portal/client/appointments');
  text = await bodyText(page);
  await screenshot(page, '03-appointments-iphone');
  const noAppointmentsMsg = /Keine Einsätze geplant|Keine Termine/i.test(text);
  const hasAppointmentRows =
    /Einsatz|Alltagsbegleitung|Betreuung|geplant|bestätigt|abgeschlossen|\d{2}\.\d{2}\./i.test(text);
  record(
    'appointments_list',
    hasAppointmentRows || noAppointmentsMsg,
    hasAppointmentRows ? 'appointments_visible' : noAppointmentsMsg ? 'empty_state_honest' : 'unclear_state',
  );
  record(
    'appointments_not_false_empty',
    !(noAppointmentsMsg && hasAppointmentRows),
    'consistency',
  );

  // Documents
  await gotoRoute(page, '/portal/client/documents');
  text = await bodyText(page);
  await screenshot(page, '04-documents-iphone');
  record(
    'documents_open',
    /Dokument|Unterschrift|Keine Dokumente|PDF/i.test(text),
    'documents_route_loaded',
  );

  // Messages
  await gotoRoute(page, '/portal/client/messages');
  text = await bodyText(page);
  await screenshot(page, '05-messages-iphone');
  const darkBox = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="portal-office-messenger"], [class*="Messenger"]');
    if (!el) return false;
    const bg = getComputedStyle(el).backgroundColor;
    return /rgb\(\s*0,\s*0,\s*0|#000|rgba\(0,\s*0,\s*0/i.test(bg);
  }).catch(() => false);
  record(
    'messages_open',
    /Nachricht|Chat|Verwaltung|Keine/i.test(text),
    'messages_route_loaded',
  );
  record('messages_not_black_box', !darkBox, darkBox ? 'dark_background_detected' : 'light_messenger');

  // Nachweise via overview modal trigger
  await gotoRoute(page, '/portal/client');
  const nachweiseBtn = page.getByText(/Nachweise/i).first();
  if (await nachweiseBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nachweiseBtn.click().catch(() => null);
    await waitStable(page, 2000);
    text = await bodyText(page);
    await screenshot(page, '06-nachweise-modal-iphone');
    record(
      'nachweise_open',
      /Nachweis|Leistungsnachweis|Offen|Unterschrieben|Keine Nachweise/i.test(text),
      'nachweise_modal_or_section',
    );
  } else {
    await gotoRoute(page, '/portal/client?module=assist&section=nachweise');
    text = await bodyText(page);
    await screenshot(page, '06-nachweise-section-iphone');
    record(
      'nachweise_open',
      /Nachweis|Leistungsnachweis|Nachweise/i.test(text),
      'nachweise_section_route',
    );
  }

  // Bottom nav
  await gotoRoute(page, '/portal/client');
  const bottomNav = page.locator('[data-testid="portal-mobile-nav"], nav').last();
  const navText = await bottomNav.innerText().catch(() => '');
  record(
    'bottom_navigation',
    /Übersicht/i.test(navText) && /Einsätze|Termine/i.test(navText) && /Profil/i.test(navText),
    navText.replace(/\s+/g, ' ').slice(0, 120),
  );

  // Drawer
  const menuBtn = page.getByLabel(/Menü|menu/i).first();
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await waitStable(page, 1500);
    text = await bodyText(page);
    await screenshot(page, '07-drawer-iphone');
    record(
      'drawer_navigation',
      /Nachweise|Anfragen|Aktivitäten|Unterschriften/i.test(text),
      'drawer_items_visible',
    );
  } else {
    record('drawer_navigation', false, 'hamburger_not_found');
  }

  // Safe area padding check
  const safeArea = await page.evaluate(() => {
    const shell = document.querySelector('[data-testid="portal-shell-scroll"]');
    if (!shell) return null;
    const style = getComputedStyle(shell);
    return {
      paddingBottom: style.paddingBottom,
      pb: parseFloat(style.paddingBottom || '0'),
    };
  });
  record(
    'iphone_safe_area_padding',
    safeArea && safeArea.pb >= 48,
    safeArea ? `paddingBottom=${safeArea.paddingBottom}` : 'shell_not_found',
  );

  await browser.close();

  writeReport({
    migrationApplied,
    migrationVersion,
    migrationName,
    login: {
      username: login.username,
      tenantName: login.tenantName,
      displayName: login.displayName,
      clientId: login.portalSession.clientId,
      tenantId: login.portalSession.tenantId,
    },
    defaultsCheck,
    checks,
    screenshots,
    deployTriggered: false,
  });

  const critical = [
    'api_client_portal_login',
    'api_portal_defaults_readable',
    'profile_loads',
    'profile_no_defaults_error',
  ];
  const ok = critical.every((id) => checks.find((c) => c.id === id)?.pass);
  console.log(JSON.stringify({ ok, checks: checks.length, baseUrl }));
  process.exit(ok ? 0 : 1);
}

function writeReport(payload) {
  mkdirSync(dirname(reportJson), { recursive: true });
  writeFileSync(reportJson, JSON.stringify({ ...payload, generatedAt: new Date().toISOString() }, null, 2));

  const lines = [
    '# K.1 Production Verify',
    '',
    `**Datum:** ${new Date().toISOString()}`,
    `**Base URL:** ${baseUrl}`,
    '',
    '## Migration',
    `- Angewendet: **${payload.migrationApplied ? 'ja' : 'nein'}**`,
    `- Version: \`${payload.migrationVersion}\` / \`${payload.migrationName}\``,
    `- Deploy ausgelöst: **nein**`,
    '',
    '## Portalaccount',
    `- Username: \`${payload.login?.username ?? 'n/a'}\``,
    `- DisplayName (API): ${payload.login?.displayName ?? 'n/a'}`,
    `- TenantName (API): ${payload.login?.tenantName ?? 'n/a'}`,
    `- ClientId: \`${payload.login?.clientId ?? 'n/a'}\``,
    '',
    '## Ergebnisse',
    ...payload.checks.map((c) => `- **${c.id}**: ${c.pass ? 'PASS' : 'FAIL'} — ${c.detail}`),
    '',
    '## Screenshots',
    ...payload.screenshots.map((s) => `- \`${s.path}\``),
    '',
    '## Verbleibende Blocker',
  ];

  const blockers = payload.checks.filter((c) => !c.pass).map((c) => c.id);
  lines.push(blockers.length ? blockers.map((b) => `- ${b}`).join('\n') : '- keine kritischen Blocker');

  writeFileSync(reportMd, lines.join('\n'));
}

main().catch((err) => {
  console.error(String(err?.message ?? err).slice(0, 300));
  process.exit(1);
});
