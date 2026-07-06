#!/usr/bin/env node
/**
 * K.1.2 Design-Parität + WCAG — lokale Sichtprüfung (kein Deploy).
 * Screenshots: Desktop, Tablet, Mobile pro Hauptscreen.
 */
import { chromium, devices } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAuditEnv, pick } from './scripts/audit/lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)));
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'http://localhost:8081').replace(/\/$/, '');
const screenshotDir = join(root, 'docs/audit/k12-design-wcag-screenshots');
const reportJson = join(root, 'docs/audit/k12-design-wcag-bericht.json');
const reportMd = join(root, 'docs/audit/k12-design-wcag-bericht.md');
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

async function waitStable(page, ms = 3000) {
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

/** Sample visible text nodes — flag white/light text on light backgrounds (WCAG risk). */
async function auditContrast(page) {
  return page.evaluate(() => {
    function parseRgb(color) {
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return null;
      return { r: +m[1], g: +m[2], b: +m[3] };
    }
    function luminance({ r, g, b }) {
      const s = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    }
    function contrast(a, b) {
      const l1 = luminance(a);
      const l2 = luminance(b);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const issues = [];
    const nodes = Array.from(document.querySelectorAll('body *')).slice(0, 400);
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      const text = (el.innerText ?? '').trim();
      if (!text || text.length > 80) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const fg = parseRgb(style.color);
      const bg = parseRgb(style.backgroundColor);
      if (!fg) continue;
      const bgEl = bg && style.backgroundColor !== 'rgba(0, 0, 0, 0)' ? bg : { r: 248, g: 250, b: 252 };
      const ratio = contrast(fg, bgEl);
      const lightOnLight = fg.r > 200 && fg.g > 200 && fg.b > 200 && bgEl.r > 200 && bgEl.g > 200;
      if (lightOnLight || ratio < 4.5) {
        issues.push({
          text: text.slice(0, 40),
          color: style.color,
          background: style.backgroundColor,
          ratio: Math.round(ratio * 10) / 10,
        });
      }
      if (issues.length >= 8) break;
    }
    return issues;
  });
}

const SCREENS = [
  { id: 'overview', path: '/portal/client', label: 'Übersicht' },
  { id: 'appointments', path: '/portal/client/appointments', label: 'Einsätze' },
  { id: 'documents', path: '/portal/client/documents', label: 'Dokumente' },
  { id: 'messages', path: '/portal/client/messages', label: 'Nachrichten' },
  { id: 'profile', path: '/portal/client/profile', label: 'Profil' },
  { id: 'proofs', path: '/portal/client/proofs', label: 'Nachweise' },
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
    ...extra,
  };
  writeFileSync(reportJson, JSON.stringify(payload, null, 2));

  const lines = [
    '# K.1.2 Design-Parität + WCAG — Sichtprüfungsbericht',
    '',
    `**Stand:** ${payload.generatedAt}`,
    `**URL:** ${baseUrl}`,
    '',
    `## Ergebnis: ${failed === 0 ? '✅ bestanden' : '⚠️ offene Punkte'} (${passed}/${checks.length})`,
    '',
    '### Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] **${c.id}** — ${c.detail}`),
    '',
    '### Screenshots',
    ...screenshots.map((s) => `- \`${s.name}\`: ${s.path}`),
    '',
    '_Kein Deploy. Kein Commit._',
  ];
  writeFileSync(reportMd, lines.join('\n'));
  console.log(`Report: ${reportMd}`);
  console.log(`Screenshots: ${screenshotDir}`);
}

async function auditScreen(page, screen, viewportKey) {
  await gotoRoute(page, screen.path);
  const name = `${screen.id}__${viewportKey}`;
  await screenshot(page, name);

  const body = await page.locator('body').innerText().catch(() => '');
  record(`${screen.id}_${viewportKey}_loads`, body.length > 80, `${screen.label} sichtbar`);

  const hasGlassHero = await page.locator('[data-testid="portal-tab-glass-hero"], [class*="GlassCard"]').first().isVisible().catch(() => false);
  if (['appointments', 'documents'].includes(screen.id)) {
    record(`${screen.id}_${viewportKey}_glass_hero`, hasGlassHero, hasGlassHero ? 'glass_hero_or_card' : 'legacy_hero_risk');
  }

  const contrastIssues = await auditContrast(page);
  record(
    `${screen.id}_${viewportKey}_wcag_sample`,
    contrastIssues.length === 0,
    contrastIssues.length === 0 ? 'no_low_contrast_samples' : JSON.stringify(contrastIssues.slice(0, 3)),
  );
}

async function main() {
  mkdirSync(screenshotDir, { recursive: true });
  const env = loadEnvFiles();
  const login = await clientPortalApiLogin(env);
  record('api_login', login.ok, login.ok ? 'ok' : login.reason);
  if (!login.ok) {
    writeReport({ loginFailed: true });
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      ...vp.device,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
    });
    const page = await context.newPage();
    await injectClientSession(page, login);

    for (const screen of SCREENS) {
      await auditScreen(page, screen, vp.key);
    }

    if (vp.key === 'iphone') {
      await gotoRoute(page, '/portal/client');
      const menuBtn = page.getByLabel(/Menü|menu/i).first();
      if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menuBtn.click();
        await waitStable(page, 1200);
        await screenshot(page, 'drawer__iphone');
        const drawerText = await page.locator('[data-testid="portal-navigation-drawer"]').innerText().catch(() => '');
        record(
          'drawer_items',
          /Nachweise|Unterschriften|Anfragen|Aktivitäten|Einstellungen|Abmelden/i.test(drawerText),
          drawerText.replace(/\s+/g, ' ').slice(0, 140),
        );
      }
      const bottomNav = page.locator('[data-testid="portal-mobile-nav"]');
      record('bottom_nav_testid', await bottomNav.isVisible().catch(() => false), 'portal-mobile-nav');
    }

    await context.close();
  }

  await browser.close();
  writeReport({ login: { displayName: login.displayName } });
  const failed = checks.filter((c) => !c.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  writeReport({ fatal: String(err) });
  process.exit(1);
});
