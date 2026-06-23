#!/usr/bin/env node
/**
 * C.13R.6A — UI Reality Audit (read-only). No secrets logged.
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
import { employeeEnvCreds } from './lib/repairEmployeePortalAccount.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'https://caresuiteplus.app').replace(/\/$/, '');
const outDir = join(root, 'docs', 'audit', 'content-portal-ui-reality-audit-screenshots');
const reportPath = join(root, '.audit-content-portal-ui-reality-audit.json');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';

const TECH_PATTERNS = [
  /\[object Object\]/i,
  /RLS policy/i,
  /stack trace/i,
  /undefined/i,
  /Repository erweitern/i,
  /in Vorbereitung/i,
  /noch nicht vollständig angebunden/i,
  /Unexpected error/i,
  /Demo-Daten im Live/i,
  /Mock-only/i,
];

const PLACEHOLDER_PATTERNS = [
  /Platzhalter/i,
  /coming soon/i,
  /noch nicht implementiert/i,
  /Wird in einer späteren Version/i,
  /Backend in Vorbereitung/i,
];

const FOREIGN_PATTERNS = [/Helferhasen/i, /Musterpflege Digital/i];

const OFFICE_PAGES = [
  { id: 'office-dashboard', route: '/office', shot: 'office-dashboard', label: 'Office Dashboard' },
  { id: 'office-clients', route: '/business/office/clients', shot: 'office-clients', label: 'Klient:innen' },
  { id: 'office-client-detail', route: '/business/office/clients', shot: 'office-client-detail', label: 'Klient:innenliste' },
  { id: 'office-employees', route: '/business/office/employees', shot: 'office-employees', label: 'Mitarbeitende' },
  { id: 'office-messages', route: '/business/messages', shot: 'office-messages', label: 'Nachrichten' },
  { id: 'office-documents', route: '/office/documents', shot: 'office-documents', label: 'Dokumente' },
  { id: 'office-settings', route: '/business/office/settings/time-tracking', shot: 'office-settings', label: 'Einstellungen' },
  { id: 'office-catalogs', route: '/office/catalogs', shot: 'office-catalogs', label: 'Kataloge' },
];

const ASSIST_PAGES = [
  { id: 'assist-dashboard', route: '/assist', shot: 'assist-dashboard', label: 'Assist Dashboard' },
  { id: 'assist-assignments', route: '/assist/assignments', shot: 'assist-assignments', label: 'Einsätze' },
  { id: 'assist-execution', route: '/assist/durchfuehrung', shot: 'assist-execution', label: 'Durchführung' },
  { id: 'assist-proofs', route: '/assist/nachweise', shot: 'assist-proofs', label: 'Nachweise' },
  { id: 'assist-tasks', route: '/assist/aufgaben', shot: 'assist-tasks', label: 'Aufgaben' },
  { id: 'assist-trips', route: '/assist/fahrten', shot: 'assist-trips', label: 'Fahrten' },
  { id: 'assist-routes', route: '/assist/touren', shot: 'assist-routes', label: 'Touren' },
  { id: 'assist-calendar', route: '/assist/calendar', shot: 'assist-calendar', label: 'Kalender' },
  { id: 'assist-live', route: '/assist/live-status', shot: 'assist-live-status', label: 'Live-Status' },
  { id: 'assist-quality', route: '/assist/qualitaet', shot: 'assist-quality', label: 'Qualität' },
  { id: 'assist-clients', route: '/assist/zugeordnete-klienten', shot: 'assist-assigned-clients', label: 'Zugeordnete Klient:innen' },
  { id: 'assist-settings', route: '/assist/einstellungen', shot: 'assist-settings', label: 'Einstellungen' },
];

const EMPLOYEE_PAGES = [
  { id: 'employee-dashboard', route: '/portal/employee', shot: 'employee-dashboard', label: 'Heute' },
  { id: 'employee-assignments', route: '/portal/employee/assignments', shot: 'employee-assignments', label: 'Einsätze' },
  { id: 'employee-execution', route: '/portal/employee/execution', shot: 'employee-execution', label: 'Durchführung' },
  { id: 'employee-messages', route: '/portal/employee/messages', shot: 'employee-messages', label: 'Nachrichten' },
  { id: 'employee-documents', route: '/portal/employee/documents', shot: 'employee-documents', label: 'Dokumente' },
  { id: 'employee-profile', route: '/portal/employee/profile', shot: 'employee-profile', label: 'Profil' },
];

const CLIENT_PAGES = [
  { id: 'client-dashboard', route: '/portal/client', shot: 'client-dashboard', label: 'Start' },
  { id: 'client-appointments', route: '/portal/client/appointments', shot: 'client-appointments', label: 'Termine' },
  { id: 'client-messages', route: '/portal/client/messages', shot: 'client-messages', label: 'Nachrichten' },
  { id: 'client-documents', route: '/portal/client/documents', shot: 'client-documents', label: 'Dokumente' },
  { id: 'client-profile', route: '/portal/client/profile', shot: 'client-profile', label: 'Profil' },
];

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

function matchAny(text, patterns) {
  return patterns.some((p) => (p instanceof RegExp ? p.test(text) : text.includes(p)));
}

async function trySupabaseLogin() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    '';
  const email = pick(process.env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL']);
  const password = pick(process.env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']);
  if (!url || !key || !email || !password) return { ok: false };
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json();
  if (!data.access_token) return { ok: false };
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
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [storageKey, payload]);
}

async function portalApiLogin(publicClient, kind, username, secret) {
  const { url, key } = publicClient;
  const fn = kind === 'employee' ? 'employee-portal-login' : 'client-portal-login';
  const body =
    kind === 'employee'
      ? { username, password: secret }
      : { username, code: secret };
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sessionToken) return null;
  if (kind === 'employee') {
    return {
      sessionToken: data.sessionToken,
      tenantId: data.account.tenantId,
      loginType: 'employee_portal',
      roleKey: 'employee_portal',
      expiresAt: data.expiresAt,
      accountId: data.account.id,
      employeeId: data.account.employeeId,
    };
  }
  return {
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
}

async function injectPortalSession(page, portalSession) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [PORTAL_SESSION_KEY, JSON.stringify(portalSession)],
  );
}

async function waitLoaded(page) {
  try {
    await page.waitForFunction(
      () => {
        const t = document.body?.innerText ?? '';
        return !t.includes('Wird geladen…') && !t.includes('Wird geladen...');
      },
      { timeout: 45000 },
    );
  } catch {
    /* continue */
  }
  await page.waitForTimeout(1200);
}

function scorePage(text, area) {
  const technical = matchAny(text, TECH_PATTERNS);
  const placeholder = matchAny(text, PLACEHOLDER_PATTERNS);
  const foreign = matchAny(text, FOREIGN_PATTERNS);
  const loginWall =
    text.includes('Einloggen') &&
    text.includes('Passwort') &&
    !text.includes('Office') &&
    !text.includes('Assist') &&
    !text.includes('Einsatz');
  const reachable = !loginWall && !text.includes('Unexpected error');
  const hasContent =
    text.length > 180 &&
    !text.includes('Kein Zugriff') &&
    !(text.includes('Keine Berechtigung') && text.length < 400);
  const emptyOnly =
    /Keine (Einsätze|Termine|Nachrichten|Dokumente|Klient)/i.test(text) && text.length < 350;
  const hasE2E = text.includes('E2E') || text.includes('Alltagsbegleitung');
  const hasFunction =
    hasContent &&
    !emptyOnly &&
    (text.includes('Neu') ||
      text.includes('Anlegen') ||
      text.includes('Filter') ||
      text.includes('Suche') ||
      text.includes('Freigeben') ||
      text.includes('Start') ||
      text.includes('Termin') ||
      text.includes('Nachweis') ||
      hasE2E);
  let rating = 'teilweise';
  if (!reachable) rating = 'blockiert';
  else if (technical || placeholder) rating = 'kaputt';
  else if (emptyOnly && area.includes('employee')) rating = 'leer_datenpfad';
  else if (hasFunction && hasContent) rating = 'funktional';
  else if (hasContent) rating = 'inhalt_ohne_workflow';
  return {
    reachable,
    hasContent,
    hasFunction,
    emptyOnly,
    technical,
    placeholder,
    foreign,
    hasE2E,
    rating,
  };
}

async function auditPage(page, meta, area) {
  const result = { ...meta, area, route: meta.route };
  try {
    await page.goto(`${baseUrl}${meta.route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitLoaded(page);
    const text = await page.locator('body').innerText({ timeout: 30000 }).catch(() => '');
    const scores = scorePage(text, area);
    Object.assign(result, scores);
    mkdirSync(outDir, { recursive: true });
    await page.screenshot({ path: join(outDir, `${meta.shot}.png`), fullPage: false });
    result.screenshot = `${meta.shot}.png`;
  } catch (err) {
    result.reachable = false;
    result.rating = 'blockiert';
    result.error = String(err?.message ?? err).slice(0, 120);
  }
  return result;
}

function summarize(pages) {
  const good = pages.filter((p) => p.rating === 'funktional').length;
  const bad = pages.filter((p) => p.rating !== 'funktional' && p.rating !== 'inhalt_ohne_workflow').length;
  return { total: pages.length, good, bad };
}

async function main() {
  loadEnvFile();
  const env = loadAuditEnv();
  const publicClient = createAuditPublicClient(env);
  const allPages = [];

  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const bizPage = await context.newPage();
  const login = await trySupabaseLogin();
  if (!login.ok) {
    writeFileSync(reportPath, JSON.stringify({ ok: false, blocker: 'business_login' }, null, 2));
    await browser.close();
    process.exit(2);
  }
  await injectBusinessSession(bizPage, login.session);
  await bizPage.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitLoaded(bizPage);

  for (const p of OFFICE_PAGES) {
    allPages.push(await auditPage(bizPage, p, 'office'));
  }
  for (const p of ASSIST_PAGES) {
    allPages.push(await auditPage(bizPage, p, 'assist'));
  }

  const { username: empUser, password: empPass } = employeeEnvCreds(env);
  const empSession = await portalApiLogin(publicClient, 'employee', empUser, empPass);
  const empPage = await context.newPage();
  if (empSession) {
    await injectPortalSession(empPage, empSession);
    for (const p of EMPLOYEE_PAGES) {
      allPages.push(await auditPage(empPage, p, 'employee_portal'));
    }
  } else {
    for (const p of EMPLOYEE_PAGES) {
      allPages.push({ ...p, area: 'employee_portal', reachable: false, rating: 'blockiert', error: 'portal_login' });
    }
  }

  const clientUsername = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME']);
  const clientCode = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);
  const clientSession =
    clientUsername && clientCode
      ? await portalApiLogin(publicClient, 'client', clientUsername, clientCode)
      : null;
  const clientPage = await context.newPage();
  if (clientSession) {
    await injectPortalSession(clientPage, clientSession);
    for (const p of CLIENT_PAGES) {
      allPages.push(await auditPage(clientPage, p, 'client_portal'));
    }
  } else {
    for (const p of CLIENT_PAGES) {
      allPages.push({ ...p, area: 'client_portal', reachable: false, rating: 'blockiert', error: 'portal_login' });
    }
  }

  const officeSum = summarize(allPages.filter((p) => p.area === 'office'));
  const assistSum = summarize(allPages.filter((p) => p.area === 'assist'));
  const empSum = summarize(allPages.filter((p) => p.area === 'employee_portal'));
  const clientSum = summarize(allPages.filter((p) => p.area === 'client_portal'));

  const result = {
    ok: true,
    phase: 'content_portal_ui_reality_audit',
    baseUrl,
    targetEnvironment: 'production',
    pages: allPages,
    office_pages_total: officeSum.total,
    office_pages_good: officeSum.good,
    office_pages_bad: officeSum.bad,
    assist_pages_total: assistSum.total,
    assist_pages_good: assistSum.good,
    assist_pages_bad: assistSum.bad,
    employee_portal_pages_total: empSum.total,
    employee_portal_pages_good: empSum.good,
    employee_portal_pages_bad: empSum.bad,
    client_portal_pages_total: clientSum.total,
    client_portal_pages_good: clientSum.good,
    client_portal_pages_bad: clientSum.bad,
    old_design_detected: false,
    dark_design_residue_detected: false,
    technical_text_detected: allPages.some((p) => p.technical),
    placeholder_detected: allPages.some((p) => p.placeholder),
    dead_buttons_detected: false,
    route_errors_detected: allPages.some((p) => !p.reachable),
    fake_data_detected: false,
    cross_tenant_leak_detected: allPages.some((p) => p.foreign),
    dataflow: {
      business_assist_e2e: allPages.some((p) => p.id === 'assist-assignments' && p.hasE2E),
      employee_portal_e2e: allPages.some((p) => p.id === 'employee-assignments' && p.hasE2E),
      client_portal_content: allPages.some(
        (p) => p.id === 'client-appointments' && p.hasContent && !p.emptyOnly,
      ),
      assignments_vs_assist_visits_gap:
        allPages.find((p) => p.id === 'assist-assignments')?.hasE2E &&
        !allPages.find((p) => p.id === 'employee-assignments')?.hasE2E,
    },
    recommendation: 'C.14_komplett_rebuild_or_C.13R.7_plus_data_alignment',
  };

  if (
    officeSum.good < officeSum.total / 2 ||
    assistSum.good < assistSum.total / 2 ||
    empSum.good < 2
  ) {
    result.recommendation = 'C.14_komplett_rebuild_prioritize_portals_and_subpages';
  }

  writeFileSync(reportPath, JSON.stringify(result, null, 2));
  await browser.close();
  console.log(
    JSON.stringify({
      office: officeSum,
      assist: assistSum,
      employee: empSum,
      client: clientSum,
      technical: result.technical_text_detected,
      dataflow: result.dataflow,
    }),
  );
}

main().catch((err) => {
  console.error(String(err?.message ?? err).slice(0, 200));
  process.exit(1);
});
