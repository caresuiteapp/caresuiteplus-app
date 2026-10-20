#!/usr/bin/env node
/**
 * Production smoke — HealthOS H3-H5 + Assist execution fix.
 * Uses .env.local for AUDIT_BUSINESS_* / AUDIT_EMPLOYEE_* — never logs passwords.
 */
import { chromium, devices } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditPublicClient,
  loadAuditEnv,
  pick,
} from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'https://caresuiteplus.app').replace(/\/$/, '');
const reportPath = join(root, 'docs/audit/production-smoke-healthos-h3-h5-results.json');
const screenshotDir = join(root, 'docs/audit/production-smoke-healthos-h3-h5-screenshots');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';

const OFFICE_SECTIONS = [
  'Betriebsstatus heute',
  'Qualitäts- und Blockerzentrum',
  'Budget Health Summary',
  'Workforce / Zeitkonto',
  'Nachweise & Dokumente',
  'Schnellzugriffe',
];

const ASSIST_SECTIONS = [
  'Einsatzbetrieb heute',
  'Live Operations',
  'Nachweise & Qualität',
  'Budget Assist Summary',
  'Blocker / Qualitätszentrale',
  'Schnellzugriffe',
];

const MP_SECTIONS = [
  'Heute',
  'Meine Einsätze',
  'Meine Zeiten',
  'Offene Aufgaben',
  'Schnellzugriffe',
];

const TECHNICAL_PATTERNS = [
  { re: /preparedOnly/i, label: 'preparedOnly' },
  { re: /\bMock\b/i, label: 'Mock' },
  { re: /Placeholder/i, label: 'Placeholder' },
  { re: /Coming Soon/i, label: 'Coming Soon' },
  { re: /proof_missing/i, label: 'proof_missing' },
  { re: /wfm_sync_failed/i, label: 'wfm_sync_failed' },
];

const FORBIDDEN_RUNTIME = [
  'Minified React error',
  'Rendered more hooks',
  'Cannot read properties of undefined',
  'Hydration failed',
];

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

async function fetchEntryHash() {
  const res = await fetch(baseUrl, { redirect: 'follow' });
  const html = await res.text();
  const m = html.match(/entry-[a-f0-9]+\.js/);
  return { ok: res.ok, status: res.status, entryJs: m?.[0] ?? null, htmlLength: html.length };
}

function scanTechnical(text) {
  return TECHNICAL_PATTERNS.filter(({ re }) => re.test(text)).map(({ label }) => label);
}

function gradeSections(found, total, whiteScreen, technicalHits) {
  if (whiteScreen) return 'rot';
  if (technicalHits.length) return 'gelb';
  const ratio = found.length / total;
  if (ratio >= 0.85) return 'gruen';
  if (ratio >= 0.5) return 'gelb';
  return 'rot';
}

async function businessLogin(page, env) {
  const email = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL', 'UAT_BUSINESS_EMAIL']);
  const password = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']);
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = pick(env, ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
  if (!email || !password || !url || !key) return { ok: false, reason: 'missing_business_creds' };

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) return { ok: false, reason: 'auth_failed' };

  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, v),
    [
      storageKey,
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        expires_in: data.expires_in,
        token_type: data.token_type,
        user: data.user,
      }),
    ],
  );
  return { ok: true, accessToken: data.access_token };
}

async function employeeLogin(page, env) {
  const username = pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'AUDIT_EMPLOYEE_EMAIL', 'TEST_EMPLOYEE_EMAIL']);
  const password = pick(env, ['AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']);
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = pick(env, ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
  if (!username || !password || !url || !key) return { ok: false, reason: 'missing_employee_creds' };

  const res = await fetch(`${url}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sessionToken || !data.account) {
    return { ok: false, reason: 'auth_failed', detail: data.errorClass ?? data.error ?? res.status };
  }
  if (data.mustChangePassword) return { ok: false, reason: 'must_change_password' };

  const session = {
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

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([portalKey, portalVal, authKey, authVal, accountId]) => {
      localStorage.setItem(portalKey, portalVal);
      if (authKey && authVal) localStorage.setItem(authKey, authVal);
      localStorage.removeItem('portal-welcome-pending');
      if (accountId) localStorage.setItem(`portal-welcome-seen:employee:${accountId}`, new Date().toISOString());
    },
    [PORTAL_SESSION_KEY, JSON.stringify(session), storageKey, sbPayload, session.accountId],
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);
  return { ok: true, employeeId: session.employeeId };
}

async function dismissOverlays(page) {
  await page.waitForTimeout(800);
  const regexLabels = [/Weiter zur \u00dcbersicht/i, /Verstanden/i, /Schlie\u00dfen/i];
  for (const label of regexLabels) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible({ timeout: 1200 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => null);
      await page.waitForTimeout(600);
    }
  }
  const okBtn = page.getByRole('button', { name: 'OK', exact: true }).first();
  if (await okBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
    await okBtn.click({ force: true }).catch(() => null);
    await page.waitForTimeout(600);
  }
}

async function gotoOfficeDashboard(page) {
  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage)) {
      if (/route|path|office|last/i.test(key)) sessionStorage.removeItem(key);
    }
  });
  await page.goto(`${baseUrl}/office`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);
  let bodyText = await page.locator('body').innerText().catch(() => '');
  if (!bodyText.includes('Betriebsstatus heute') && !bodyText.includes('Command Center')) {
    const dashLink = page.getByText('Dashboard', { exact: true }).first();
    if (await dashLink.isVisible({ timeout: 4000 }).catch(() => false)) {
      await dashLink.click();
      await page.waitForTimeout(3000);
      bodyText = await page.locator('body').innerText().catch(() => '');
    }
  }
  if (!bodyText.includes('Betriebsstatus heute')) {
    await page.goto(`${baseUrl}/business/office/dashboard`, {
      waitUntil: 'networkidle',
      timeout: 120000,
    });
    await page.waitForTimeout(2500);
  }
  await dismissOverlays(page);
}

async function gotoEmployeeOverview(page) {
  await page.goto(`${baseUrl}/portal/employee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (!bodyText.includes('Heute') && bodyText.includes('Übersicht')) {
    const tab = page.getByText('Übersicht', { exact: true }).first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(2000);
    }
  }
}

async function shot(page, name) {
  mkdirSync(screenshotDir, { recursive: true });
  const path = join(screenshotDir, name);
  await page.screenshot({ path, fullPage: true, timeout: 30000 }).catch(() => null);
  return path.replace(root + '\\', '').replace(root + '/', '');
}

async function inspectPage(page, sections, label) {
  await page.waitForTimeout(3000);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    hasWhiteScreen: (document.body?.innerText?.trim()?.length ?? 0) < 20,
  }));
  const sectionsFound = sections.filter((s) => bodyText.includes(s));
  const technicalHits = scanTechnical(bodyText);
  return {
    label,
    url: page.url(),
    bodyLength: bodyText.length,
    sectionsFound,
    sectionsMissing: sections.filter((s) => !bodyText.includes(s)),
    technicalHits,
    whiteScreen: layout.hasWhiteScreen,
    horizontalOverflow: layout.scrollWidth > layout.clientWidth + 8,
    grade: gradeSections(sectionsFound, sections.length, layout.hasWhiteScreen, technicalHits),
    sampleText: bodyText.slice(0, 800),
  };
}

async function resolveTestVisitId(env, userToken) {
  const explicit = pick(env, ['AUDIT_OFFICE_VISIT_ID', 'P0_VISIT_ID']);
  if (userToken) {
    const pub = createAuditPublicClient(env);
    const active = await pub.restSelectAsUser(
      'assist_visits',
      'execution_status=in.(in_progress,arrived,on_way,paused,pending)&select=id,legacy_assignment_id,title,execution_status&order=updated_at.desc&limit=10',
      userToken,
    );
    if (active.ok && active.data?.length) {
      const preferred =
        active.data.find((row) =>
          ['in_progress', 'arrived', 'on_way', 'paused'].includes(row.execution_status),
        ) ?? active.data[0];
      return { visitId: preferred.legacy_assignment_id || preferred.id, source: 'business_rls', meta: preferred };
    }
  }
  if (explicit) return { visitId: explicit, source: 'explicit', meta: null };
  return { visitId: 'ade25ab2-0000-4000-8000-000000000001', source: 'fallback_prefix', meta: null };
}

async function main() {
  const env = loadEnvFiles();
  const runtimeErrors = [];
  const consoleErrors = [];

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl,
    deployTriggerCommit: 'dbd411013e2db944226268de77328f63a12ca778',
    codeCommit: 'edecd96d496b3cd5bf621d471b818edc5922274b',
    previousDeployCommit: '451d6a57d44bf3c3da8b09544b562ca3d51e27fb',
    build: null,
    sections: {},
    runtimeErrors: [],
    consoleErrors: [],
    verdict: {},
  };

  report.build = await fetchEntryHash();
  report.build.previousEntryJs = 'entry-ecac7d11262ce837677f167d7a128906.js';
  report.build.bundleChanged = report.build.entryJs !== report.build.previousEntryJs;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => runtimeErrors.push(String(err.message ?? err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
    });

    // A — Build / Basis
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(3000);
    const basisText = await page.locator('body').innerText().catch(() => '');
    report.sections.A_buildBasis = {
      grade: report.build.ok && basisText.length > 50 ? 'gruen' : 'rot',
      siteReachable: report.build.ok,
      entryJs: report.build.entryJs,
      whiteScreen: basisText.length < 20,
      consoleErrorCount: 0,
      screenshot: await shot(page, 'A-home.png'),
    };

    // B — Office H3
    const bizAuth = await businessLogin(page, env);
    report.sections.B_officeH3 = { auth: bizAuth.ok ? 'ok' : bizAuth.reason };
    if (bizAuth.ok) {
      const bCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const bPage = await bCtx.newPage();
      await businessLogin(bPage, env);
      await gotoOfficeDashboard(bPage);
      const leftDash = bPage.locator('nav, [role="navigation"]').getByText('Dashboard', { exact: true }).first();
      if (await leftDash.isVisible({ timeout: 2000 }).catch(() => false)) {
        await leftDash.click();
        await bPage.waitForTimeout(3000);
      }
      report.sections.B_officeH3.desktop = await inspectPage(bPage, OFFICE_SECTIONS, 'office-desktop');
      report.sections.B_officeH3.desktop.screenshot = await shot(bPage, 'B-office-desktop.png');

      await bPage.goto(`${baseUrl}/business/office/dashboard`, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await dismissOverlays(bPage);
      await bPage.waitForTimeout(3000);
      const aliasText = await bPage.locator('body').innerText().catch(() => '');
      report.sections.B_officeH3.aliasRoute = {
        loads: aliasText.includes('Command Center') || aliasText.includes('Betriebsstatus heute'),
        url: bPage.url(),
        screenshot: await shot(bPage, 'B-office-alias.png'),
      };
      await bCtx.close();

      const mobileCtx = await browser.newContext({ ...devices['iPhone 13'] });
      const mobilePage = await mobileCtx.newPage();
      await businessLogin(mobilePage, env);
      await gotoOfficeDashboard(mobilePage);
      report.sections.B_officeH3.mobile = await inspectPage(mobilePage, OFFICE_SECTIONS, 'office-mobile');
      report.sections.B_officeH3.mobile.screenshot = await shot(mobilePage, 'B-office-mobile.png');
      await mobileCtx.close();

      report.sections.B_officeH3.grade =
        report.sections.B_officeH3.desktop.grade === 'gruen' &&
        report.sections.B_officeH3.mobile.grade !== 'rot'
          ? 'gruen'
          : report.sections.B_officeH3.desktop.grade === 'rot'
            ? 'rot'
            : 'gelb';
    } else {
      report.sections.B_officeH3.grade = 'rot';
    }

    // C — Assist H4
    if (bizAuth.ok) {
      await page.goto(`${baseUrl}/assist`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await dismissOverlays(page);
      report.sections.C_assistH4 = {
        desktop: await inspectPage(page, ASSIST_SECTIONS, 'assist-desktop'),
      };
      report.sections.C_assistH4.desktop.screenshot = await shot(page, 'C-assist-desktop.png');

      const liveLink = page.getByText('Live-Einsätze', { exact: false }).first();
      report.sections.C_assistH4.quickLink = { visible: await liveLink.isVisible({ timeout: 3000 }).catch(() => false) };
      if (report.sections.C_assistH4.quickLink.visible) {
        await liveLink.click();
        await page.waitForTimeout(2500);
        report.sections.C_assistH4.quickLink.url = page.url();
        report.sections.C_assistH4.quickLink.ok = page.url().includes('/assist/live-status');
        await page.goto(`${baseUrl}/assist`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }

      const visitPick = await resolveTestVisitId(env, bizAuth.accessToken);
      await page.goto(`${baseUrl}/assist/assignments/${visitPick.visitId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await dismissOverlays(page);
      const detailText = await page.locator('body').innerText().catch(() => '');
      report.sections.C_assistH4.assignmentDetail = {
        visitId: visitPick.visitId,
        visitSource: visitPick.source,
        loads: detailText.includes('Einsatz') || detailText.includes('Status') || detailText.includes('Klient'),
        notFound: detailText.includes('Einsatz nicht gefunden'),
        screenshot: await shot(page, 'C-assist-detail.png'),
      };

      const mobileCtx2 = await browser.newContext({ ...devices['iPhone 13'] });
      const mp2 = await mobileCtx2.newPage();
      await businessLogin(mp2, env);
      await mp2.goto(`${baseUrl}/assist`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await dismissOverlays(mp2);
      report.sections.C_assistH4.mobile = await inspectPage(mp2, ASSIST_SECTIONS, 'assist-mobile');
      report.sections.C_assistH4.mobile.screenshot = await shot(mp2, 'C-assist-mobile.png');
      await mobileCtx2.close();

      report.sections.C_assistH4.grade =
        report.sections.C_assistH4.desktop.grade === 'gruen' &&
        report.sections.C_assistH4.assignmentDetail.loads &&
        !report.sections.C_assistH4.assignmentDetail.notFound
          ? 'gruen'
          : report.sections.C_assistH4.desktop.grade === 'rot'
            ? 'rot'
            : 'gelb';
    } else {
      report.sections.C_assistH4 = { grade: 'rot', reason: 'no_business_auth' };
    }

    // D — MP H5
    const empAuth = await employeeLogin(page, env);
    report.sections.D_mpH5 = { auth: empAuth.ok ? 'ok' : empAuth.reason };
    if (empAuth.ok) {
      await gotoEmployeeOverview(page);
      report.sections.D_mpH5.desktop = await inspectPage(page, MP_SECTIONS, 'mp-desktop');
      report.sections.D_mpH5.desktop.screenshot = await shot(page, 'D-mp-desktop.png');

      const visitPick2 = await resolveTestVisitId(env, bizAuth.ok ? bizAuth.accessToken : null);
      const execUrl = `${baseUrl}/portal/employee/assignments/${visitPick2.visitId}/execute`;
      await page.goto(execUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await dismissOverlays(page);
      const execText = await page.locator('body').innerText().catch(() => '');
      report.sections.D_mpH5.executeRoute = {
        visitId: visitPick2.visitId,
        url: page.url(),
        opens:
          !execText.includes('Einsatz nicht gefunden') &&
          (execText.includes('Durchführung') || execText.includes('Einsatz') || execText.includes('Zeiterfassung')),
        screenshot: await shot(page, 'D-mp-execute.png'),
      };

      const mobileCtx3 = await browser.newContext({ ...devices['iPhone 13'] });
      const mp3 = await mobileCtx3.newPage();
      await employeeLogin(mp3, env);
      await gotoEmployeeOverview(mp3);
      report.sections.D_mpH5.mobile = await inspectPage(mp3, MP_SECTIONS, 'mp-mobile');
      report.sections.D_mpH5.mobile.screenshot = await shot(mp3, 'D-mp-mobile.png');
      await mobileCtx3.close();

      report.sections.D_mpH5.grade =
        report.sections.D_mpH5.desktop.grade !== 'rot' && report.sections.D_mpH5.executeRoute.opens
          ? report.sections.D_mpH5.desktop.grade
          : report.sections.D_mpH5.executeRoute.opens
            ? 'gelb'
            : 'rot';
    } else {
      report.sections.D_mpH5.grade = 'rot';
    }

    // E — Assist Office Durchführung
    if (bizAuth.ok) {
      const visitPick3 = await resolveTestVisitId(env, bizAuth.accessToken);
      const visitId = visitPick3.visitId;
      await businessLogin(page, env);
      await page.goto(`${baseUrl}/assist/assignments/${visitId}/execute`, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await dismissOverlays(page);
      await page.waitForTimeout(3500);
      const execBody = await page.locator('body').innerText().catch(() => '');
      const doneBtn = page.getByRole('button', { name: /^Erledigt$/i }).first();
      const hasDone = await doneBtn.isVisible({ timeout: 4000 }).catch(() => false);
      let taskClicked = false;
      if (hasDone) {
        await doneBtn.click();
        await page.waitForTimeout(2000);
        taskClicked = true;
      }
      const partialBtn = page
        .getByRole('button', { name: /Teilweise erledigt|Nicht möglich|Nicht gewünscht/i })
        .first();
      const hasPartial = await partialBtn.isVisible({ timeout: 2000 }).catch(() => false);
      let reasonChips = false;
      if (hasPartial) {
        await partialBtn.click();
        await page.waitForTimeout(1500);
        const reasonText = await page.locator('body').innerText().catch(() => '');
        reasonChips =
          reasonText.includes('Grund auswählen') || reasonText.includes('Office-Katalog');
      }
      report.sections.E_officeExecution = {
        visitId,
        visitSource: visitPick3.source,
        pageLoads:
          !execBody.includes('Einsatz nicht gefunden') &&
          (execBody.includes('Durchführung') || execBody.includes('Zeiterfassung') || execBody.includes('Aufgaben')),
        hasTasks: execBody.includes('Aufgaben') || hasDone,
        taskClicked,
        reasonChips,
        signatureVisible: execBody.includes('Unterschrift'),
        documentationVisible: execBody.includes('Dokumentation'),
        limitation: !hasDone && !hasPartial ? 'no_open_tasks_for_chips' : null,
        screenshot: await shot(page, 'E-office-execution.png'),
        grade: 'gelb',
      };
      if (
        report.sections.E_officeExecution.pageLoads &&
        !execBody.includes('Einsatz nicht gefunden')
      ) {
        report.sections.E_officeExecution.grade =
          report.sections.E_officeExecution.hasTasks || report.sections.E_officeExecution.signatureVisible
            ? 'gruen'
            : 'gelb';
      } else {
        report.sections.E_officeExecution.grade = 'rot';
      }
    } else {
      report.sections.E_officeExecution = { grade: 'rot', reason: 'no_business_auth' };
    }

    // F — P0 / Blocker inbox (fresh business context — avoid MP session bleed)
    if (bizAuth.ok) {
      const fCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const fPage = await fCtx.newPage();
      await businessLogin(fPage, env);
      await fPage.goto(`${baseUrl}/assist/live-status`, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await dismissOverlays(fPage);
      await fPage.waitForTimeout(3000);
      const inboxText = await fPage.locator('body').innerText().catch(() => '');
      report.sections.F_p0 = {
        route: '/assist/live-status',
        finalUrl: fPage.url(),
        blockerInboxLoads:
          /Live-Status|Live Operations|Problem-Inbox|Blocker|Qualität|Einsätze in Durchführung/i.test(
            inboxText,
          ),
        hasBlockersOrEmpty:
          /Live-Status|Problem-Inbox|Blocker|Keine offenen Einsatz-Blocker|Dokumentation fehlt|Einsätze/i.test(
            inboxText,
          ),
        mpLoginOk: empAuth.ok,
        executeOpens: report.sections.D_mpH5?.executeRoute?.opens ?? false,
        sampleText: inboxText.slice(0, 600),
        screenshot: await shot(fPage, 'F-blocker-inbox.png'),
        grade: 'gelb',
      };
      report.sections.F_p0.grade =
        report.sections.F_p0.blockerInboxLoads && empAuth.ok ? 'gruen' : 'gelb';
      if (!report.sections.F_p0.blockerInboxLoads) report.sections.F_p0.grade = 'rot';
      await fCtx.close();
    } else {
      report.sections.F_p0 = { grade: 'rot', reason: 'no_business_auth' };
    }

    // G — RLS spot check
    const foreignVisit =
      pick(env, ['P0_FOREIGN_VISIT_ID']) || '70f800b8-a04f-44ae-846f-dcc7f6f6497a';
    const foreignUser = pick(env, ['AUDIT_EMPLOYEE_USERNAME_RLS', 'AUDIT_EMPLOYEE_USERNAME_B']);
    if (empAuth.ok && foreignUser) {
      const rlsCtx = await browser.newContext({ ...devices['iPhone 13'] });
      const rlsPage = await rlsCtx.newPage();
      const foreignLogin = await employeeLogin(rlsPage, {
        ...env,
        AUDIT_EMPLOYEE_USERNAME: foreignUser,
      });
      if (foreignLogin.ok) {
        await rlsPage.goto(`${baseUrl}/portal/employee/assignments/${foreignVisit}/execute`, {
          waitUntil: 'domcontentloaded',
          timeout: 120000,
        });
        await dismissOverlays(rlsPage);
        await rlsPage.waitForTimeout(4000);
        const rlsText = await rlsPage.locator('body').innerText().catch(() => '');
        const blocked =
          rlsText.includes('Einsatz nicht gefunden') ||
          rlsText.includes('Kein Zugriff') ||
          rlsText.includes('nicht verfügbar') ||
          !rlsText.includes('Durchführung');
        report.sections.G_rls = {
          foreignVisit,
          foreignUser: foreignUser.slice(0, 4) + '…',
          blocked,
          screenshot: await shot(rlsPage, 'G-rls-foreign.png'),
          grade: blocked ? 'gruen' : 'rot',
        };
      } else {
        report.sections.G_rls = { grade: 'gelb', reason: 'foreign_login_failed', testable: false };
      }
      await rlsCtx.close();
    } else {
      report.sections.G_rls = {
        grade: 'gelb',
        reason: foreignUser ? 'primary_emp_auth_failed' : 'no_foreign_user_env',
        testable: false,
      };
    }

    report.consoleErrors = consoleErrors.slice(0, 15);
    report.runtimeErrors = [
      ...runtimeErrors.filter((e) => FORBIDDEN_RUNTIME.some((f) => e.includes(f))),
    ].slice(0, 10);
    report.sections.A_buildBasis.consoleErrorCount = consoleErrors.length;

    const grades = Object.entries(report.sections)
      .map(([k, v]) => v?.grade)
      .filter(Boolean);
    const hasRot = grades.includes('rot');
    const hasGelb = grades.includes('gelb');
    report.verdict = {
      buildStatus: report.build.bundleChanged && report.build.entryJs ? 'success' : 'pending_or_failed',
      entryJs: report.build.entryJs,
      overall: hasRot ? 'Production NO-GO' : hasGelb ? 'Restricted GO' : 'Production GO',
      sectionGrades: Object.fromEntries(
        Object.entries(report.sections).map(([k, v]) => [k, v?.grade ?? 'n/a']),
      ),
    };

    mkdirSync(join(root, 'docs/audit'), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.verdict, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  mkdirSync(join(root, 'docs/audit'), { recursive: true });
  writeFileSync(
    reportPath,
    JSON.stringify({ error: String(err.message ?? err), verdict: { overall: 'Production NO-GO' } }, null, 2),
  );
  console.error(err);
  process.exit(1);
});
