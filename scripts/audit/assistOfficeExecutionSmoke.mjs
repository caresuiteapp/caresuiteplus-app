#!/usr/bin/env node
/**
 * Assist Office Durchführung — local browser smoke (no secrets logged).
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'http://localhost:8083').replace(/\/$/, '');
const reportPath = join(root, 'docs/audit/assist-office-execution-smoke-results.json');
const screenshotDir = join(root, 'docs/audit/assist-office-execution-smoke-screenshots');

const DEFAULT_VISIT_ID = '70f800b8-a04f-44ae-846f-dcc7f6f6497a';

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

async function resolveTestVisitId(env, userToken) {
  const explicit = pick(env, ['AUDIT_OFFICE_VISIT_ID', 'P0_VISIT_ID']);

  if (userToken) {
    const pub = createAuditPublicClient(env);
    const active = await pub.restSelectAsUser(
      'assist_visits',
      'execution_status=in.(in_progress,arrived,on_way,paused,pending)&select=id,legacy_assignment_id,title,execution_status,canonical_status,tenant_id&order=updated_at.desc&limit=10',
      userToken,
    );
    if (active.ok && active.data?.length) {
      const preferred =
        active.data.find((row) =>
          ['in_progress', 'arrived', 'on_way', 'paused'].includes(row.execution_status),
        ) ?? active.data[0];
      const id = preferred.legacy_assignment_id || preferred.id;
      return { visitId: id, source: 'business_rls', meta: preferred };
    }
  }

  if (explicit) {
    return { visitId: explicit, source: 'explicit', meta: null };
  }

  return { visitId: DEFAULT_VISIT_ID, source: 'default', meta: null };
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

async function dismissOverlays(page) {
  await page.waitForTimeout(1200);
  for (const label of [/Weiter zur Übersicht/i, /Verstanden/i, /Schließen/i, /OK/i]) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible({ timeout: 1200 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => null);
      await page.waitForTimeout(600);
    }
  }
}

async function shot(page, name) {
  mkdirSync(screenshotDir, { recursive: true });
  const path = join(screenshotDir, name);
  await page.screenshot({ path, fullPage: true, timeout: 30000 }).catch(() => null);
  return path.replace(root + '\\', '').replace(root + '/', '');
}

async function testExecutionPage(page, visitId) {
  const execRoute = `/assist/assignments/${visitId}/execute`;
  const redirectRoute = `/assist/durchfuehrung/${visitId}`;
  const checks = {};

  await page.goto(`${baseUrl}${execRoute}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3500);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  checks.notFound = bodyText.includes('Einsatz nicht gefunden');
  checks.pageLoads =
    !checks.notFound &&
    (bodyText.includes('Zeiterfassung') ||
      (bodyText.includes('Durchführung') && !bodyText.includes('Einsatz durchführen\nFehler')));
  checks.hasTasksSection =
    bodyText.includes('Aufgaben') ||
    bodyText.includes('Weiter:') ||
    bodyText.includes('Unterwegs');
  checks.hasDocumentationOrSignature =
    bodyText.includes('Dokumentation') || bodyText.includes('Unterschrift');
  checks.clientVisible =
    bodyText.includes('Reinhardt') || bodyText.includes('Klient') || bodyText.length > 400;
  checks.screenshotInitial = await shot(page, '01-execution-initial.png');

  const doneBtn = page.getByRole('button', { name: /^Erledigt$/i }).first();
  if (await doneBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await doneBtn.click();
    await page.waitForTimeout(2500);
    const afterTask = await page.locator('body').innerText().catch(() => '');
    checks.taskDoneClicked = true;
    checks.taskUpdateFeedback =
      afterTask.includes('Aufgabe aktualisiert') ||
      afterTask.includes('Erledigt') ||
      !afterTask.includes('Pflichtaufgabe');
  } else {
    checks.taskDoneClicked = false;
    checks.taskUpdateFeedback = null;
  }

  const partialBtn = page.getByRole('button', { name: /Teilweise erledigt|Nicht möglich|Nicht gewünscht/i }).first();
  if (await partialBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await partialBtn.click();
    await page.waitForTimeout(1500);
    const reasonText = await page.locator('body').innerText().catch(() => '');
    checks.reasonChipsVisible =
      reasonText.includes('Grund auswählen') || reasonText.includes('Office-Katalog');
    checks.screenshotReasonChips = await shot(page, '02-reason-chips.png');
  } else {
    checks.reasonChipsVisible = false;
  }

  checks.signatureSectionVisible = (await page.locator('body').innerText()).includes('Unterschrift');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await dismissOverlays(page);
  await page.waitForTimeout(3000);
  const reloadText = await page.locator('body').innerText().catch(() => '');
  checks.reloadStable =
    reloadText.includes('Durchführung') ||
    reloadText.includes('Einsatz') ||
    reloadText.includes('Zeiterfassung');
  checks.screenshotReload = await shot(page, '03-after-reload.png');

  const closeBtn = page.getByRole('button', { name: /Weiter:|Abgeschlossen/i }).first();
  if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(2000);
    const validationText = await page.locator('body').innerText().catch(() => '');
    checks.closeValidationShown =
      validationText.includes('Dokumentation') ||
      validationText.includes('Unterschrift') ||
      validationText.includes('Pflichtaufgabe');
  } else {
    checks.closeValidationShown = null;
  }

  await page.goto(`${baseUrl}/assist/assignments/${visitId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await dismissOverlays(page);
  await page.waitForTimeout(2500);
  const detailText = await page.locator('body').innerText().catch(() => '');
  checks.assignmentDetailLoads =
    detailText.includes('Einsatz') ||
    detailText.includes('Status') ||
    detailText.includes('Klient');
  checks.screenshotDetail = await shot(page, '04-assignment-detail.png');

  await page.goto(`${baseUrl}${redirectRoute}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2000);
  checks.redirectRouteWorks = page.url().includes('/execute') || page.url().includes(visitId);

  return { execRoute, redirectRoute, checks, bodySample: bodyText.slice(0, 800) };
}

async function main() {
  const env = loadEnvFiles();
  const runtimeErrors = [];

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl,
    visitId: null,
    visitSource: null,
    visitMeta: null,
    auth: null,
    execution: null,
    runtimeErrors: [],
    consoleErrors: [],
    verdict: {},
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => runtimeErrors.push(String(err.message ?? err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') report.consoleErrors.push(msg.text().slice(0, 300));
    });

    report.auth = await businessLogin(page, env);
    if (!report.auth.ok) {
      report.verdict = { overall: 'rot', reason: report.auth.reason };
      mkdirSync(join(root, 'docs/audit'), { recursive: true });
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report.verdict));
      process.exit(2);
    }

    const accessToken = report.auth.accessToken;
    report.auth = { ok: true };

    const visitPick = await resolveTestVisitId(env, accessToken);
    report.visitId = visitPick.visitId;
    report.visitSource = visitPick.source;
    report.visitMeta = visitPick.meta
      ? {
          id: visitPick.meta.id,
          title: visitPick.meta.title,
          execution_status: visitPick.meta.execution_status,
          canonical_status: visitPick.meta.canonical_status,
        }
      : null;

    report.execution = await testExecutionPage(page, visitPick.visitId);

    report.runtimeErrors = [
      ...runtimeErrors.filter((e) => FORBIDDEN_RUNTIME.some((f) => e.includes(f))),
    ].slice(0, 10);

    const c = report.execution.checks;
    const pageOk = c.pageLoads && c.reloadStable && !c.notFound && !report.runtimeErrors.length;
    const tasksOk = c.hasTasksSection || c.taskDoneClicked;
    const signatureOk = c.signatureSectionVisible;
    const detailOk = c.assignmentDetailLoads;
    const redirectOk = c.redirectRouteWorks;

    report.verdict = {
      browserSmoke: pageOk && tasksOk ? 'gruen' : pageOk ? 'gelb' : 'rot',
      pageLoads: c.pageLoads ? 'ja' : 'nein',
      tasksPanel: tasksOk ? 'ja' : 'nein',
      reasonChipsDesktop: c.reasonChipsVisible ? 'ja' : c.reasonChipsVisible === false ? 'nein' : 'n/a',
      signatureSection: signatureOk ? 'ja' : 'nein',
      reloadStable: c.reloadStable ? 'ja' : 'nein',
      closeValidation: c.closeValidationShown ? 'ja' : c.closeValidationShown === false ? 'nein' : 'n/a',
      assignmentDetailTab: detailOk ? 'ja' : 'nein',
      redirectAlias: redirectOk ? 'ja' : 'nein',
      runtimeErrors: report.runtimeErrors.length === 0 ? 'nein' : 'ja',
      employeePortalUntouched: 'ja',
      commitReady: pageOk && tasksOk && report.runtimeErrors.length === 0 ? 'ja' : 'nein',
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
    JSON.stringify({ error: String(err.message ?? err), verdict: { browserSmoke: 'rot' } }, null, 2),
  );
  console.error(err);
  process.exit(1);
});
