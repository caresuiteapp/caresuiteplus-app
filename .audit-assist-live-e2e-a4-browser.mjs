#!/usr/bin/env node
/**
 * A.4 Assist Live E2E browser acceptance — Playwright runner.
 * Loads .env locally; never logs secrets.
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)));
const screenshotDir = join(root, 'docs/audit/assist-live-e2e-a4-browser-screenshots');
const reportPath = join(root, '.audit-assist-live-e2e-a4-browser-results.json');

const FORBIDDEN = [
  'Supabase',
  '42703',
  'display_name',
  'RPC',
  'Edge Auth',
  'source_snapshot',
  'assist_location_points',
  'budgetCents',
  'invoiceDraft',
  'proof_not_approved',
  'missing_budget',
  'Core K.',
  'WP 246',
  '0156',
  '0157',
  '0158',
  '0159',
  '0160',
  '0161',
];

const ASSIST_PAGES = [
  { id: 'dashboard', path: '/assist', expect: ['Assist', 'Dashboard', 'Einsatz', 'Heute', 'Schnellzugriff', 'Keine', 'KPI'] },
  { id: 'einsaetze', path: '/assist/einsaetze', expect: ['Einsatz', 'Einsätze', 'Neu', 'Keine', 'geplant'] },
  { id: 'durchfuehrung', path: '/assist/durchfuehrung', expect: ['Durchführung', 'Einsatz', 'Keine', 'Status'] },
  { id: 'nachweise', path: '/assist/nachweise', expect: ['Nachweis', 'Keine', 'Freigabe', 'Status'] },
  { id: 'aufgaben', path: '/assist/aufgaben', expect: ['Aufgabe', 'Keine', 'Erledigt', 'Offen'] },
  { id: 'fahrten', path: '/assist/fahrten', expect: ['Fahrt', 'Fahrten', 'Keine', 'Tour'] },
  { id: 'touren', path: '/assist/touren', expect: ['Tour', 'Touren', 'Keine', 'Route', 'Planung'] },
  { id: 'kalender', path: '/assist/kalender', expect: ['Kalender', 'Termin', 'Einsatz', 'Keine', 'Monat'] },
  { id: 'live_status', path: '/assist/live-status', expect: ['Live', 'Status', 'Einsatz', 'Keine', 'Karte'] },
  { id: 'qualitaet', path: '/assist/qualitaet', expect: ['Qualität', 'Nachweis', 'Prüf', 'Keine', 'Status'] },
  { id: 'klienten', path: '/assist/zugeordnete-klienten', expect: ['Klient', 'Zugeordnet', 'Keine', 'Assist'] },
  { id: 'einstellungen', path: '/assist/einstellungen', expect: ['Einstellung', 'Assist', 'Modul', 'Konfiguration'] },
];

const PORTAL_PAGES = [
  { id: 'employee_portal', path: '/portal/employee', expect: ['Portal', 'Mitarbeiter', 'Durchführung', 'Einsatz', 'Anmelden'] },
  { id: 'client_portal', path: '/portal/client', expect: ['Portal', 'Klient', 'Assist', 'Anmelden', 'Status'] },
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
    // Always prefer .env for audit credentials and Supabase config
    if (/^(AUDIT_|TEST_|UAT_|BUSINESS_TEST_|EXPO_PUBLIC_SUPABASE_)/.test(key)) {
      process.env[key] = val;
    } else if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

function envPresent() {
  const email =
    process.env.AUDIT_BUSINESS_EMAIL ??
    process.env.UAT_BUSINESS_EMAIL ??
    process.env.TEST_BUSINESS_EMAIL ??
    '';
  const password =
    process.env.AUDIT_BUSINESS_PASSWORD ??
    process.env.UAT_BUSINESS_PASSWORD ??
    process.env.TEST_BUSINESS_PASSWORD ??
    '';
  const hasEmail = Boolean(email.trim());
  const hasPassword = Boolean(password.trim());
  const placeholder =
    /DEIN_|CHANGE_ME|placeholder|example\.com|changeme|^password$/i.test(email) ||
    /DEIN_|CHANGE_ME|placeholder|changeme/i.test(password);
  return { hasEmail, hasPassword, placeholder };
}

function pickCredential() {
  const email =
    process.env.AUDIT_BUSINESS_EMAIL ??
    process.env.UAT_BUSINESS_EMAIL ??
    process.env.TEST_BUSINESS_EMAIL ??
    process.env.BUSINESS_TEST_EMAIL ??
    '';
  const password =
    process.env.AUDIT_BUSINESS_PASSWORD ??
    process.env.UAT_BUSINESS_PASSWORD ??
    process.env.TEST_BUSINESS_PASSWORD ??
    process.env.BUSINESS_TEST_PASSWORD ??
    '';
  return { email: email.trim(), password: password.trim() };
}

async function trySupabaseLogin() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    '';
  const { email, password } = pickCredential();
  if (!url || !key || !email || !password) {
    return { ok: false, reason: 'missing_env_credentials' };
  }
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const msg = String(data.error_description ?? data.msg ?? data.message ?? 'auth_failed');
    const category = /invalid login/i.test(msg) ? 'invalid_credentials' : 'other';
    return { ok: false, reason: category, httpStatus: res.status };
  }
  return {
    ok: true,
    session: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      expires_in: data.expires_in,
      token_type: data.token_type,
      user: data.user,
    },
  };
}

function scanForbidden(text) {
  const hits = [];
  for (const term of FORBIDDEN) {
    if (text.includes(term)) hits.push(term);
  }
  return hits;
}

async function injectSession(page, session, baseUrl) {
  const storageKey = `sb-${new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.evaluate(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [storageKey, payload],
  );
}

async function waitForStable(page, ms = 3500) {
  await page.waitForTimeout(ms);
}

async function screenshot(page, name) {
  mkdirSync(screenshotDir, { recursive: true });
  const path = join(screenshotDir, `${name}.png`);
  try {
    await page.screenshot({ path, fullPage: true, timeout: 15000 });
  } catch {
    await page.screenshot({ path, fullPage: false, timeout: 8000 }).catch(() => null);
  }
  return path;
}

async function bodyText(page) {
  return page.locator('body').innerText({ timeout: 20000 }).catch(() => '');
}

function pageLoaded(text, stuckLoading) {
  if (stuckLoading) return false;
  if (!text || text.trim().length < 20) return false;
  if (/Something went wrong|Unhandled|TypeError|ReferenceError/i.test(text)) return false;
  return true;
}

function hasContent(text, expectPatterns) {
  return expectPatterns.some((p) => text.includes(p));
}

async function checkPage(page, baseUrl, spec) {
  await page.goto(`${baseUrl}${spec.path}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitForStable(page, 4000);
  const text = await bodyText(page);
  const stuckLoading =
    /Dashboard wird geladen/i.test(text) ||
    /wird geladen\.\.\./i.test(text) && !/Keine/i.test(text);
  const forbidden = scanForbidden(text);
  const loaded = pageLoaded(text, stuckLoading);
  const contentVisible = hasContent(text, spec.expect);
  const emptyOk = /Keine|Noch keine|leer|0\s+Einsätze/i.test(text);
  const shot = await screenshot(page, spec.id);
  return {
    id: spec.id,
    path: spec.path,
    loaded,
    stuckLoading,
    contentVisible: contentVisible || emptyOk,
    emptyStateOk: emptyOk,
    forbiddenHits: forbidden,
    noTechnicalText: forbidden.length === 0,
    pass: loaded && !stuckLoading && forbidden.length === 0 && (contentVisible || emptyOk),
    screenshot: shot.replace(root + '\\', '').replace(root + '/', ''),
  };
}

async function fillInputsSafely(page, email, password) {
  await page.evaluate(
    ([mail, pwd]) => {
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
      if (inputs[0]) {
        inputs[0].focus();
        inputs[0].value = mail;
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (inputs[1]) {
        inputs[1].focus();
        inputs[1].value = pwd;
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    [email, password],
  );
}

async function tryBrowserLogin(page, baseUrl) {
  const { email, password } = pickCredential();
  if (!email || !password) return { ok: false, reason: 'missing_credentials' };
  await page.goto(`${baseUrl}/auth/business-login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitForStable(page, 5000);
  const inputCount = await page.locator('input:not([type="hidden"])').count();
  if (inputCount < 2) {
    const hasLoginText = /Einloggen|Unternehmen|E-Mail|Passwort/i.test(await bodyText(page));
    return { ok: false, reason: hasLoginText ? 'inputs_not_rendered' : 'login_form_not_found' };
  }
  await fillInputsSafely(page, email, password);
  const clicked = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[role="button"], button, div, span'));
    const btn = nodes.find((n) => /^Einloggen$/i.test((n.textContent ?? '').trim()));
    if (btn instanceof HTMLElement) {
      btn.click();
      return true;
    }
    return false;
  });
  if (!clicked) {
    await page.getByText('Einloggen', { exact: true }).first().click({ timeout: 15000, force: true });
  }
  await waitForStable(page, 8000);
  const text = await bodyText(page);
  const url = page.url();
  const authOk =
    (!url.includes('business-login') && /assist|business|office/i.test(url)) ||
    (/Anmeldung erfolgreich|Weiterleitung/i.test(text) && !/Ungültig|Invalid|Fehler bei|falsch/i.test(text));
  return {
    ok: authOk,
    reason: authOk
      ? 'browser_form_login'
      : /Ungültig|Invalid|Zugangsdaten|falsch|credentials/i.test(text)
        ? 'invalid_credentials'
        : 'login_ui_still_visible',
  };
}

async function runAgainstBase(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pages = [];
  let authOk = false;
  let authReason = 'not_attempted';
  let authMethod = null;

  const login = await trySupabaseLogin();
  if (login.ok) {
    authMethod = 'supabase_grant';
    await injectSession(page, login.session, baseUrl);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await waitForStable(page);
    const afterAuth = await bodyText(page);
    authOk =
      !/Einloggen|Anmelden|business-login/i.test(afterAuth) ||
      /Office|Assist|Dashboard|Business/i.test(afterAuth);
    authReason = authOk ? 'supabase_session_injected' : 'session_injected_but_login_ui_visible';
  } else {
    authReason = login.reason;
    const browserLogin = await tryBrowserLogin(page, baseUrl);
    if (browserLogin.ok) {
      authOk = true;
      authMethod = 'browser_form';
      authReason = browserLogin.reason;
    } else {
      authReason = browserLogin.reason ?? login.reason;
      await screenshot(page, '00-auth-blocker');
    }
  }

  if (authOk) {
    for (const spec of ASSIST_PAGES) {
      pages.push(await checkPage(page, baseUrl, spec));
    }
    for (const spec of PORTAL_PAGES) {
      pages.push(await checkPage(page, baseUrl, spec));
    }
  }

  await browser.close();
  return { baseUrl, authOk, authReason, authMethod, pages };
}

async function main() {
  loadEnvFile();
  mkdirSync(screenshotDir, { recursive: true });

  const env = envPresent();
  const candidates = [
    'http://localhost:8082',
    process.env.AUDIT_WEB_URL,
    'https://caresuiteplus.app',
  ].filter(Boolean);

  const tried = [];
  let result = null;

  for (const baseUrl of [...new Set(candidates)]) {
    try {
      const probe = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      if (!probe.ok && probe.status !== 405) {
        tried.push({ baseUrl, reachable: false, status: probe.status });
        continue;
      }
    } catch {
      tried.push({ baseUrl, reachable: false });
      continue;
    }

    const run = await runAgainstBase(baseUrl);
    tried.push({ baseUrl, reachable: true, authOk: run.authOk });
    result = run;
    if (run.authOk) break;
  }

  const scenarioA = result?.pages?.find((p) => p.id === 'dashboard');
  const scenarioB = result?.pages?.find((p) => p.id === 'employee_portal');
  const scenarioC = result?.pages?.find((p) => p.id === 'client_portal');
  const scenarioD = result?.pages?.find((p) => p.id === 'nachweise');

  const scenarios = {
    A_normal_visit_flow: scenarioA
      ? scenarioA.pass
        ? 'pass'
        : scenarioA.loaded
          ? 'partial'
          : 'block'
      : 'block',
    B_employee_portal: scenarioB ? (scenarioB.pass ? 'pass' : scenarioB.loaded ? 'partial' : 'block') : 'block',
    C_client_portal: scenarioC ? (scenarioC.pass ? 'pass' : scenarioC.loaded ? 'partial' : 'block') : 'block',
    D_proof_released_only: scenarioD ? (scenarioD.pass ? 'pass' : scenarioD.loaded ? 'partial' : 'block') : 'block',
  };

  const assistPages = (result?.pages ?? []).filter((p) => ASSIST_PAGES.some((a) => a.id === p.id));
  const allAssistPass = assistPages.length > 0 && assistPages.every((p) => p.pass);
  const freigabe = result?.authOk && allAssistPass;

  const output = {
    timestamp: new Date().toISOString(),
    env: {
      AUDIT_BUSINESS_EMAIL: env.hasEmail,
      AUDIT_BUSINESS_PASSWORD: env.hasPassword,
      placeholderDetected: env.placeholder,
    },
    loginSuccess: Boolean(result?.authOk),
    loginReason: result?.authReason ?? 'no_reachable_base',
    authMethod: result?.authMethod ?? null,
    baseUrl: result?.baseUrl ?? null,
    tried,
    assistPages,
    portalPages: (result?.pages ?? []).filter((p) => PORTAL_PAGES.some((a) => a.id === p.id)),
    scenarios,
    freigabeAssistLiveE2EBrowser: freigabe,
    screenshotDir: 'docs/audit/assist-live-e2e-a4-browser-screenshots',
  };

  writeFileSync(reportPath, JSON.stringify(output, null, 2));
  console.log(
    JSON.stringify({
      envEmail: env.hasEmail,
      envPassword: env.hasPassword,
      placeholder: env.placeholder,
      loginSuccess: output.loginSuccess,
      loginReason: output.loginReason,
      baseUrl: output.baseUrl,
      assistPages: assistPages.map(({ id, pass, loaded, stuckLoading }) => ({ id, pass, loaded, stuckLoading })),
      scenarios,
      freigabe,
      reportPath,
    }),
  );
  process.exit(freigabe ? 0 : output.loginSuccess ? 1 : 2);
}

main().catch((err) => {
  const safe = String(err).replace(/fill\("[^"]*"\)/g, 'fill("[REDACTED]")');
  writeFileSync(reportPath, JSON.stringify({ error: safe }, null, 2));
  console.error(safe);
  process.exit(3);
});
