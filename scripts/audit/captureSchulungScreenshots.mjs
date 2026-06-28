#!/usr/bin/env node
/**
 * Capture CareSuite+ training screenshots for PowerPoint (SS-001 … SS-055).
 * Output: docs/schulung/screenshots/<dateiname from CSV>
 *
 * Wait strategy (every screenshot):
 *   networkidle → loading markers gone → route content → settle → no overlay
 * Welcome modal: SS-040 / SS-051 WITH modal; all other portal shots dismiss first.
 */
import { spawnSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditAdminClient,
  createAuditPublicClient,
  loadAuditEnv,
  pick,
} from './lib/auditSupabaseClient.mjs';
import {
  E2E_EMPLOYEE_ID,
  employeeEnvCreds,
  repairEmployeePortalAccount,
} from './lib/repairEmployeePortalAccount.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'https://caresuiteplus.app').replace(/\/$/, '');
const outDir = join(root, 'docs', 'schulung', 'screenshots');
const csvPath = join(root, 'docs', 'schulung', 'screenshot-checkliste.csv');
const reportPath = join(root, '.audit-schulung-screenshots-results.json');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';

const TENANT = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const CLIENT_A = 'ec4f159f-e794-4326-8b0e-15c0166df1ea';
const EMPLOYEE = E2E_EMPLOYEE_ID;
const ASSIGN_TODAY = 'c0e5a001-a001-4000-8000-000000000001';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const NETWORK_IDLE_MS = 30_000;
const SETTLE_MS = 800;
const MIN_PNG_BYTES = 10_000;
const MAX_CAPTURE_ATTEMPTS = 3;


const validationJsonPath = join(outDir, 'capture-validation.json');
const GROUP_ONLY_MODES = new Set(['public', 'business', 'employee', 'client']);

function loadPreviousValidation() {
  if (!existsSync(validationJsonPath)) return null;
  try {
    return JSON.parse(readFileSync(validationJsonPath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeOnlyFilenameToken(token) {
  let t = token.trim();
  if (!t) return null;
  if (!t.endsWith('.png')) t = `${t}.png`;
  return t;
}

function parseCaptureCli(argv) {
  const onlyFailed = argv.includes('--only-failed');
  const onlyArg = argv.find((a) => a.startsWith('--only='))?.slice(7) ?? null;
  let onlyFilter = null;
  let targetFilenames = null;

  if (onlyFailed) {
    const prev = loadPreviousValidation();
    targetFilenames = new Set(
      (prev?.files ?? []).filter((f) => f.status === 'FAIL').map((f) => f.filename),
    );
  }

  if (onlyArg) {
    if (!onlyArg.includes(',') && GROUP_ONLY_MODES.has(onlyArg)) {
      onlyFilter = onlyArg;
    } else {
      if (!targetFilenames) targetFilenames = new Set();
      for (const part of onlyArg.split(',')) {
        const fn = normalizeOnlyFilenameToken(part);
        if (fn) targetFilenames.add(fn);
      }
    }
  }

  const incremental = Boolean(targetFilenames?.size);
  return { onlyFailed, onlyFilter, targetFilenames, incremental };
}

function filterSpecsByTarget(allSpecs, targetFilenames) {
  if (!targetFilenames?.size) return allSpecs;
  return allSpecs.filter((s) => targetFilenames.has(s.dateiname));
}

function mergeValidationTable(allSpecs, results, previous, incremental) {
  const fresh = buildValidationTable(allSpecs, results);
  if (!incremental) return fresh;

  const prevByFile = new Map((previous?.files ?? []).map((f) => [f.filename, f]));
  const capturedFiles = new Set(results.captured.map((c) => c.filename));

  return allSpecs.map((spec) => {
    if (capturedFiles.has(spec.dateiname)) {
      return fresh.find((r) => r.filename === spec.dateiname);
    }
    const prev = prevByFile.get(spec.dateiname);
    const filePath = join(outDir, spec.dateiname);
    if (prev?.status === 'PASS' && existsSync(filePath)) {
      try {
        return { ...prev, bytes: String(statSync(filePath).size), note: prev.note || 'kept' };
      } catch {
        return { ...prev, note: 'kept' };
      }
    }
    return (
      fresh.find((r) => r.filename === spec.dateiname) ??
      prev ?? {
        id: spec.id,
        filename: spec.dateiname,
        status: 'FAIL',
        welcomePopup: 'n/a',
        bytes: '-',
        note: 'not_captured',
      }
    );
  });
}
const WELCOME_SHOTS = new Set(['40-employee-welcome-modal.png', '51-client-welcome-modal.png']);

/** Portal PNGs that must never show the welcome overlay (post-capture check). */
const PORTAL_NO_WELCOME = new Set([
  '41-employee-dashboard.png',
  '42-employee-assignments.png',
  '43-employee-assignment-detail.png',
  '44-employee-execution-consent.png',
  '45-employee-execution-unterwegs.png',
  '46-employee-execution-gestartet.png',
  '47-employee-schedule.png',
  '48-employee-messages.png',
  '49-employee-profile.png',
  '50-employee-bottom-nav.png',
  '52-client-dashboard.png',
  '53-client-appointments.png',
  '54-client-documents.png',
  '55-client-messages-profile.png',
]);

const LOADING_MARKERS = [
  'Wird geladen…',
  'Wird geladen...',
  'wird geladen…',
  'wird geladen...',
  'Mitarbeiterportal wird geladen',
  'Dienstplan wird geladen',
  'Klient:innenportal werden geladen',
  'Klient:innenportal wird geladen',
  'Einsatzdetails werden geladen',
  'Einsätze werden geladen',
  'Budget wird geladen',
];

/** Per-file content readiness — body text must match at least one pattern. */
const ROUTE_CONTENT = {
  '01-landing-startseite.png': ['CareSuite', 'Anmeldung'],
  '01b-landing-startseite-mobile.png': ['CareSuite', 'Anmeldung'],
  '02-auth-business-login.png': ['Anmelden', 'Passwort'],
  '03-auth-employee-login.png': ['Einloggen', 'Passwort'],
  '04-auth-employee-first-login.png': ['Passwort', 'Erstlogin'],
  '05-auth-portal-code-login.png': ['Einloggen', 'Portal'],
  '06-auth-forgot-password.png': ['Passwort', 'vergessen'],
  '10-office-dashboard.png': ['Office', 'Dashboard'],
  '11-office-clients-list.png': ['Klient', 'Klientin'],
  '12-office-client-record-tabs.png': ['Klient', 'Akte'],
  '13-office-client-portal-tab.png': ['Portal', 'Freigabe'],
  '14-office-client-new-intake.png': ['Neuaufnahme', 'Klient'],
  '15-office-employees-list.png': ['Mitarbeit', 'Personal'],
  '16-office-personnel-file-portal.png': ['Portal', 'Mitarbeiter'],
  '17-office-access-dashboard.png': ['Zugang', 'Benutzer'],
  '18-office-messages.png': ['Nachricht'],
  '19-office-calendar.png': ['Kalender'],
  '20-office-invoices.png': ['Rechnung', 'Abrechnung'],
  '30-assist-dashboard.png': ['Assist', 'Einsatz'],
  '31-assist-assignments-list.png': ['Einsatz'],
  '32-assist-assignment-create.png': ['Einsatz', 'Anlegen'],
  '33-assist-assignment-detail.png': ['Einsatz', 'Status'],
  '34-assist-calendar.png': ['Kalender'],
  '35-assist-durchfuehrung.png': ['Durchführung', 'Durchfuehrung', 'Einsatz'],
  '36-assist-nachweise.png': ['Nachweis', 'Leistung'],
  '37-assist-fahrten.png': ['Fahrt'],
  '38-assist-live-status.png': ['Live', 'Status'],
  '39-assist-zugeordnete-klienten.png': ['Klient', 'zugeordnet'],
  '40-employee-welcome-modal.png': ['Willkommen', 'Weiter zur Übersicht'],
  '41-employee-dashboard.png': ['Guten', 'Übersicht', 'Einsätze', 'Mitarbeiter'],
  '42-employee-assignments.png': ['Einsätze', 'Einsatz', 'Keine Einsätze'],
  '43-employee-assignment-detail.png': ['Einsatz', 'Status', 'Klient'],
  '44-employee-execution-consent.png': ['GPS', 'Einwilligung', 'Standort', 'Einsatz'],
  '45-employee-execution-unterwegs.png': ['Unterwegs', 'Anfahrt', 'Einsatz'],
  '46-employee-execution-gestartet.png': ['Gestartet', 'Einsatz', 'laufend'],
  '47-employee-schedule.png': ['Dienstplan', 'Wochenplan', 'Keine Einsätze geplant'],
  '48-employee-messages.png': ['Nachricht', 'Messenger', 'Keine Nachrichten'],
  '49-employee-profile.png': ['Profil', 'Avatar', 'Mitarbeiter'],
  '50-employee-bottom-nav.png': ['Übersicht', 'Einsätze', 'Dienstplan'],
  '51-client-welcome-modal.png': ['Willkommen', 'Weiter zur Übersicht'],
  '52-client-dashboard.png': ['Start', 'Termin', 'Klient', 'Guten'],
  '53-client-appointments.png': ['Termin', 'Einsatz', 'Keine'],
  '54-client-documents.png': ['Dokument'],
  '55-client-messages-profile.png': ['Nachricht', 'Profil', 'Messenger'],
};

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

function parseCsv() {
  const lines = readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 6) continue;
    rows.push({
      id: parts[0],
      modul: parts[1],
      dateiname: parts[2],
      url: parts[3],
      viewport: parts[4],
      beschreibung: parts[5],
    });
  }
  return rows;
}

function isMobile(viewport) {
  return /390|iphone|mobile/i.test(viewport);
}

function resolveRoute(row) {
  const { url, dateiname } = row;
  if (!url.startsWith('http')) {
    if (dateiname === '16-office-personnel-file-portal.png') {
      return `/business/office/employees/${EMPLOYEE}/personnel`;
    }
    return null;
  }
  let route = url.replace(baseUrl, '').replace(/^https:\/\/caresuiteplus\.app/, '');
  if (route.includes('[id]')) {
    if (route.includes('/portal/employee/')) route = route.replace('[id]', ASSIGN_TODAY);
    else if (route.includes('/assist/assignments/')) route = route.replace('[id]', ASSIGN_TODAY);
    else route = route.replace('[id]', CLIENT_A);
  }
  return route.startsWith('/') ? route : `/${route}`;
}

function isWelcomeOpenText(text) {
  return text.includes('Weiter zur Übersicht') && text.includes('Willkommen');
}

/** DOM probe: welcome modal overlay visible (Willkommen + CTA in aria-modal context). */
async function isWelcomeOverlayVisible(page) {
  return page.evaluate(() => {
    const bodyText = document.body?.innerText ?? '';
    const hasWelcomeCTA =
      bodyText.includes('Weiter zur Übersicht') && bodyText.includes('Willkommen');

    const modalRoots = document.querySelectorAll(
      '[aria-modal="true"], [accessibilityviewismodal="true"]',
    );
    for (const root of modalRoots) {
      const style = window.getComputedStyle(root);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const t = root.textContent ?? '';
      if (t.includes('Willkommen') && t.includes('Weiter zur Übersicht')) return true;
    }

    if (!hasWelcomeCTA) return false;

    const candidates = [...document.querySelectorAll('div, section, [role="dialog"]')];
    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 200 || rect.height < 120) continue;
      const t = el.textContent ?? '';
      if (t.includes('Willkommen') && t.includes('Weiter zur Übersicht')) {
        const z = Number.parseInt(style.zIndex, 10);
        if (style.position === 'fixed' || style.position === 'absolute' || z > 10) return true;
      }
    }
    return hasWelcomeCTA;
  });
}

async function waitForWelcomeOverlayGone(page, timeout = 15_000) {
  try {
    await page.waitForFunction(
      () => {
        const bodyText = document.body?.innerText ?? '';
        if (bodyText.includes('Weiter zur Übersicht') && bodyText.includes('Willkommen')) {
          return false;
        }
        const modals = document.querySelectorAll(
          '[aria-modal="true"], [accessibilityviewismodal="true"]',
        );
        for (const root of modals) {
          const style = window.getComputedStyle(root);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const t = root.textContent ?? '';
          if (t.includes('Willkommen')) return false;
        }
        return true;
      },
      { timeout },
    );
  } catch {
    /* continue */
  }
}

async function clearWelcomePendingStorage(page) {
  await page.evaluate(() => {
    localStorage.removeItem('portal-welcome-pending');
  });
}

/**
 * Dismiss portal welcome / blocking modals.
 * 1. Click "Weiter zur Übersicht" if visible
 * 2. Click X (Schließen) on Willkommen modal if still visible
 * 3. Wait until no Willkommen overlay / aria-modal hidden
 * 4. Clear portal-welcome-pending from localStorage
 */
async function dismissAllPortalModals(page) {
  await clearWelcomePendingStorage(page);

  for (let attempt = 0; attempt < 4; attempt++) {
    if (!(await isWelcomeOverlayVisible(page))) {
      await waitForWelcomeOverlayGone(page, 5_000);
      await clearWelcomePendingStorage(page);
      return true;
    }

    const weiterBtn = page.getByRole('button', { name: /Weiter zur Übersicht/i });
    if (await weiterBtn.count()) {
      await weiterBtn.first().click({ force: true });
      await page.waitForTimeout(400);
      continue;
    }

    const weiterText = page.getByText('Weiter zur Übersicht', { exact: false });
    if (await weiterText.count()) {
      await weiterText.first().click({ force: true });
      await page.waitForTimeout(400);
      continue;
    }

    const modalClose = page
      .locator('[aria-modal="true"], [accessibilityviewismodal="true"]')
      .getByRole('button', { name: /schließen/i });
    if (await modalClose.count()) {
      await modalClose.first().click({ force: true });
      await page.waitForTimeout(400);
      continue;
    }

    const closeBtn = page.getByRole('button', { name: /schließen/i });
    if (await closeBtn.count()) {
      await closeBtn.first().click({ force: true });
      await page.waitForTimeout(400);
      continue;
    }

    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(300);
  }

  await waitForWelcomeOverlayGone(page);
  await clearWelcomePendingStorage(page);
  return !(await isWelcomeOverlayVisible(page));
}

/** Throw (triggers retry) if welcome overlay visible on a non-welcome screenshot. */
async function assertNoWelcomeOverlay(page, filename) {
  if (WELCOME_SHOTS.has(filename)) return;
  const visible = await isWelcomeOverlayVisible(page);
  if (visible) {
    throw new Error(`welcome_overlay_before_capture:${filename}`);
  }
}

async function bodyText(page) {
  return page.locator('body').innerText({ timeout: 45_000 }).catch(() => '');
}

async function waitForNetworkSettled(page, timeout = NETWORK_IDLE_MS) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    try {
      await page.waitForLoadState('load', { timeout: 10_000 });
    } catch {
      /* continue with content waits */
    }
  }
}

async function waitForLoadingGone(page, timeout = NETWORK_IDLE_MS) {
  try {
    await page.waitForFunction(
      (markers) => {
        const t = document.body?.innerText ?? '';
        if (markers.some((m) => t.includes(m))) return false;
        const ariaBusy = document.querySelector('[aria-busy="true"]');
        if (ariaBusy) return false;
        return true;
      },
      LOADING_MARKERS,
      { timeout },
    );
  } catch {
    /* best effort */
  }
}

async function waitForRouteContent(page, filename, timeout = NETWORK_IDLE_MS) {
  const patterns = ROUTE_CONTENT[filename];
  if (!patterns?.length) return;
  try {
    await page.waitForFunction(
      (needles) => {
        const t = document.body?.innerText ?? '';
        return needles.some((n) => t.includes(n));
      },
      patterns,
      { timeout },
    );
  } catch {
    /* capture anyway — validation may flag */
  }
}

async function waitForWelcomeModalVisible(page, timeout = 20_000) {
  await page.waitForFunction(
    () => {
      const t = document.body?.innerText ?? '';
      return t.includes('Weiter zur Übersicht') && t.includes('Willkommen');
    },
    { timeout },
  );
}

async function settle(page, ms = SETTLE_MS) {
  await page.waitForTimeout(ms);
}

async function preparePageForScreenshot(page, filename, { allowWelcome = false } = {}) {
  await waitForNetworkSettled(page);
  await waitForLoadingGone(page);

  if (allowWelcome) {
    await waitForWelcomeModalVisible(page).catch(() => undefined);
  } else {
    await dismissAllPortalModals(page);
    await waitForWelcomeOverlayGone(page);
  }

  await waitForRouteContent(page, filename);
  await settle(page);

  if (!allowWelcome) {
    await dismissAllPortalModals(page);
    await assertNoWelcomeOverlay(page, filename);
  }
}

async function gotoWithRetry(page, url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      return;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(1500 * (i + 1));
    }
  }
  throw lastErr;
}

async function navigateAndPrepare(page, route, filename, opts = {}) {
  await gotoWithRetry(page, `${baseUrl}${route}`);
  await preparePageForScreenshot(page, filename, opts);
}

async function gotoAssignmentDetail(page, filename) {
  const detailUrl = `${baseUrl}/portal/employee/assignments/${ASSIGN_TODAY}`;
  await navigateAndPrepare(page, '/portal/employee/assignments', '42-employee-assignments.png');
  const retryBtn = page.getByText('Erneut versuchen', { exact: false });
  if (await retryBtn.count()) {
    await retryBtn.first().click();
    await waitForNetworkSettled(page);
    await waitForLoadingGone(page);
    await settle(page, 1500);
  }
  const card = page.getByText(/E2E Einsatz heute/i).first();
  if (await card.count()) {
    await card.click();
    await waitForNetworkSettled(page);
    await waitForLoadingGone(page);
  } else {
    await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 120_000 });
  }
  await preparePageForScreenshot(page, filename);
  const text = await bodyText(page);
  if ((text?.length ?? 0) < 80) {
    await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 120_000 });
    await preparePageForScreenshot(page, filename);
    const retryText = await bodyText(page);
    if ((retryText?.length ?? 0) < 80) {
      throw new Error(`assignment_detail_empty:${filename}`);
    }
  }
}

async function openAssignmentDetailFromList(page, filename) {
  await gotoAssignmentDetail(page, filename);
}

async function openExecutionFromDetail(page, filename) {
  const execUrl = `${baseUrl}/portal/employee/assignments/${ASSIGN_TODAY}/execute`;
  const execBtn = page.getByRole('button', { name: /Zur Einsatzdurchf|hrung|Einsatzdurchfuehrung/i });
  if (await execBtn.count()) {
    await execBtn.first().click();
    await waitForNetworkSettled(page);
    await waitForLoadingGone(page);
  } else {
    await page.goto(execUrl, { waitUntil: 'networkidle', timeout: 120_000 });
  }
  await preparePageForScreenshot(page, filename);
  const text = await bodyText(page);
  if ((text?.length ?? 0) < 80) {
    await page.goto(execUrl, { waitUntil: 'networkidle', timeout: 120_000 });
    await preparePageForScreenshot(page, filename);
  }
}


async function validatePngFile(page, filePath, filename) {
  const result = { ok: false, bytes: 0, reason: null, welcomePopup: null };
  if (!existsSync(filePath)) {
    result.reason = 'missing';
    return result;
  }

  const stat = statSync(filePath);
  result.bytes = stat.size;
  if (stat.size < MIN_PNG_BYTES) {
    result.reason = 'file_too_small';
    return result;
  }

  try {
    const b64 = readFileSync(filePath).toString('base64');
    const analysis = await page.evaluate(
      (dataUrl) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const w = Math.min(img.width, 120);
            const h = Math.min(img.height, 120);
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const data = ctx.getImageData(0, 0, w, h).data;
            let whiteish = 0;
            const pixels = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              if (r > 248 && g > 248 && b > 248) whiteish += 1;
            }
            resolve({
              whiteRatio: whiteish / pixels,
              width: img.width,
              height: img.height,
            });
          };
          img.onerror = () => resolve({ error: true });
          img.src = dataUrl;
        }),
      `data:image/png;base64,${b64}`,
    );

    if (analysis.error) {
      result.reason = 'decode_failed';
      return result;
    }
    if (analysis.whiteRatio > 0.92) {
      result.reason = 'mostly_white';
      result.whiteRatio = analysis.whiteRatio;
      return result;
    }

    const welcomeVisible = await isWelcomeOverlayVisible(page);
    result.welcomePopup = welcomeVisible ? 'present' : 'absent';

    if (WELCOME_SHOTS.has(filename)) {
      if (!welcomeVisible) {
        result.reason = 'welcome_expected_missing';
        return result;
      }
    } else if (PORTAL_NO_WELCOME.has(filename) && welcomeVisible) {
      result.reason = 'welcome_overlay';
      return result;
    }

    result.ok = true;
    result.whiteRatio = analysis.whiteRatio;
    return result;
  } catch (err) {
    result.reason = `validate_error:${String(err?.message ?? err).slice(0, 60)}`;
    return result;
  }
}

async function capture(page, filename, note = '') {
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, filename);

  if (filename === '47-employee-schedule.png' && existsSync(path)) {
    const beforePath = join(outDir, '47-employee-schedule-before-fix.png');
    try {
      copyFileSync(path, beforePath);
    } catch {
      /* ignore */
    }
  }

  await settle(page, 500);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  const validation = await validatePngFile(page, path, filename);
  const welcomeCheck =
    WELCOME_SHOTS.has(filename) || PORTAL_NO_WELCOME.has(filename)
      ? validation.welcomePopup === (WELCOME_SHOTS.has(filename) ? 'present' : 'absent')
        ? 'PASS'
        : 'FAIL'
      : null;
  return { filename, path, note, ok: validation.ok, validation, welcomeCheck };
}

async function captureWithRetry(page, filename, note = '', opts = {}) {
  let lastShot = null;
  for (let attempt = 1; attempt <= MAX_CAPTURE_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        await dismissAllPortalModals(page);
        await preparePageForScreenshot(page, filename, opts);
      }
      if (!opts.allowWelcome) {
        await assertNoWelcomeOverlay(page, filename);
      }
      lastShot = await capture(page, filename, attempt > 1 ? `${note} retry${attempt}` : note);
      if (lastShot.ok) {
        console.log(`  [${lastShot.welcomeCheck ?? 'OK'}] ${filename} (${lastShot.validation.bytes} bytes)`);
        return lastShot;
      }
      console.log(
        `  [RETRY ${attempt}/${MAX_CAPTURE_ATTEMPTS}] ${filename}: ${lastShot.validation.reason}`,
      );
    } catch (err) {
      const msg = String(err?.message ?? err).slice(0, 120);
      console.log(`  [RETRY ${attempt}/${MAX_CAPTURE_ATTEMPTS}] ${filename}: ${msg}`);
      if (attempt === MAX_CAPTURE_ATTEMPTS) {
        throw err;
      }
      await dismissAllPortalModals(page);
      await preparePageForScreenshot(page, filename, opts);
    }
  }
  return lastShot;
}

async function trySupabaseLogin(env) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    '';
  const email = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL']);
  const password = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']);
  if (!url || !key || !email || !password) return { ok: false, reason: 'missing_creds' };
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return { ok: false, reason: 'auth_failed' };
  const data = await res.json();
  if (!data.access_token) return { ok: false, reason: 'no_token' };
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
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [storageKey, payload]);
}

async function portalApiLogin(publicClient, kind, username, secret) {
  const { url, key } = publicClient;
  const fn = kind === 'employee' ? 'employee-portal-login' : 'client-portal-login';
  const body =
    kind === 'employee' ? { username, password: secret } : { username, code: secret };
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sessionToken) return null;

  const supabaseTokens =
    data.supabaseAccessToken && data.supabaseRefreshToken
      ? { accessToken: data.supabaseAccessToken, refreshToken: data.supabaseRefreshToken }
      : null;

  if (kind === 'employee') {
    return {
      sessionToken: data.sessionToken,
      tenantId: data.account.tenantId,
      loginType: 'employee_portal',
      roleKey: 'employee_portal',
      expiresAt: data.expiresAt,
      accountId: data.account.id,
      employeeId: data.account.employeeId,
      supabaseTokens,
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
    supabaseTokens,
  };
}

function supabaseAuthStorageKey() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!url) return null;
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

async function buildSupabaseLocalStoragePayload(publicClient, accessToken, refreshToken) {
  const { url, key } = publicClient;
  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: key },
  });
  const user = userRes.ok ? await userRes.json() : null;
  let expiresAt = Math.floor(Date.now() / 1000) + 3600;
  try {
    const b64 = accessToken.split('.')[1];
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (payload.exp) expiresAt = payload.exp;
  } catch {
    /* use default */
  }
  return JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    expires_in: Math.max(60, expiresAt - Math.floor(Date.now() / 1000)),
    token_type: 'bearer',
    user,
  });
}

async function injectPortalSession(page, portalSession, supabaseTokens = null, welcomePending = null) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const sbKey = supabaseAuthStorageKey();
  let sbPayload = null;
  if (supabaseTokens && sbKey) {
    const publicClient = createAuditPublicClient(loadAuditEnv());
    sbPayload = await buildSupabaseLocalStoragePayload(
      publicClient,
      supabaseTokens.accessToken,
      supabaseTokens.refreshToken,
    );
  }
  await page.evaluate(
    ([portalKey, portalVal, authKey, authVal, welcome]) => {
      localStorage.setItem(portalKey, portalVal);
      if (authKey && authVal) localStorage.setItem(authKey, authVal);
      if (welcome?.kind) {
        localStorage.setItem('portal-welcome-pending', welcome.kind);
        if (welcome.accountId) {
          localStorage.removeItem('portal-welcome-seen:' + welcome.kind + ':' + welcome.accountId);
        }
      }
    },
    [
      PORTAL_SESSION_KEY,
      JSON.stringify(portalSession),
      sbKey,
      sbPayload,
      welcomePending?.kind ? { kind: welcomePending.kind, accountId: welcomePending.accountId ?? '' } : null,
    ],
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitForNetworkSettled(page);
  await waitForLoadingGone(page);
}

async function setWelcomePending(page, kind, accountId) {
  await page.evaluate(
    ([k, id]) => {
      localStorage.setItem('portal-welcome-pending', k);
      if (id) localStorage.removeItem(`portal-welcome-seen:${k}:${id}`);
    },
    [kind, accountId ?? ''],
  );
}

async function markWelcomeSeen(page, kind, accountId) {
  await page.evaluate(
    ([k, id]) => {
      localStorage.removeItem('portal-welcome-pending');
      if (id) localStorage.setItem(`portal-welcome-seen:${k}:${id}`, new Date().toISOString());
    },
    [kind, accountId ?? ''],
  );
}

async function ensureSchulungSeed() {
  const res = spawnSync(process.execPath, [join(root, 'scripts', 'audit', 'contentPortalE2eSeed.mjs')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (res.status !== 0) {
    console.warn(`  [seed] failed: ${(res.stderr || res.stdout || '').slice(0, 200)}`);
    return false;
  }
  console.log('  [seed] E2E data ready');
  return true;
}

/** Map UI/domain status labels to remote DB enum values. */
const REMOTE_STATUS = {
  bestaetigt: 'confirmed',
  geplant: 'planned',
  unterwegs: 'on_the_way',
  gestartet: 'started',
};


async function finalizeEmployeePortalForSchulung(adminClient) {
  const res = await adminClient.restPatch(
    'employee_portal_accounts',
    `tenant_id=eq.${TENANT}&employee_id=eq.${EMPLOYEE}`,
    {
      status: 'active',
      must_change_password: false,
      first_login_completed: true,
      blocked_at: null,
      blocked_by: null,
      blocked_reason: null,
    },
  );
  if (!res.ok) {
    console.warn('  [employee] finalize portal account failed');
  }
  return res;
}

async function patchAssignmentStatus(adminClient, status) {
  const remote = REMOTE_STATUS[status] ?? status;
  const res = await adminClient.restPatch('assignments', `id=eq.${ASSIGN_TODAY}&tenant_id=eq.${TENANT}`, {
    status: remote,
    updated_at: new Date().toISOString(),
  });
  if (!res.ok) {
    console.warn(`  [patch] assignment ${remote} failed`);
  }
  await new Promise((r) => setTimeout(r, 2000));
  return res;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true, channel: 'msedge' });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function newContext(browser, mobile) {
  const opts = mobile
    ? { ...devices['iPhone 12 Pro'], viewport: MOBILE, isMobile: true, hasTouch: true }
    : { viewport: DESKTOP };
  const ctx = await browser.newContext(opts);
  if (mobile) {
    await ctx.grantPermissions(['geolocation']);
    await ctx.setGeolocation({ latitude: 52.520008, longitude: 13.404954 });
  }
  return ctx;
}

async function capturePublicPages(browser, specs, results) {
  for (const row of specs) {
    const route = resolveRoute(row);
    if (!route) {
      results.missing.push({ id: row.id, filename: row.dateiname, reason: 'no_url' });
      continue;
    }
    const mobile = isMobile(row.viewport);
    const ctx = await newContext(browser, mobile);
    const page = await ctx.newPage();
    try {
      await navigateAndPrepare(page, route, row.dateiname);
      const shot = await captureWithRetry(page, row.dateiname);
      results.captured.push({ id: row.id, ...shot });
      if (!shot.ok) {
        results.validationFailed.push({ id: row.id, filename: row.dateiname, ...shot.validation });
      }
    } catch (err) {
      results.missing.push({
        id: row.id,
        filename: row.dateiname,
        reason: String(err?.message ?? err).slice(0, 120),
      });
    }
    await ctx.close();
  }
}

async function captureBusinessPages(browser, specs, session, results) {
  const ctx = await newContext(browser, false);
  const page = await ctx.newPage();
  await injectBusinessSession(page, session);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await preparePageForScreenshot(page, '10-office-dashboard.png');

  for (const row of specs) {
    const route = resolveRoute(row);
    if (!route) {
      results.missing.push({ id: row.id, filename: row.dateiname, reason: 'no_url' });
      continue;
    }
    try {
      await navigateAndPrepare(page, route, row.dateiname);
      if (row.dateiname === '16-office-personnel-file-portal.png') {
        const portalTab = page.getByText('Portal', { exact: true });
        if (await portalTab.count()) {
          await portalTab.first().click();
          await preparePageForScreenshot(page, row.dateiname);
        }
      }
      const shot = await captureWithRetry(page, row.dateiname);
      results.captured.push({ id: row.id, ...shot });
      if (!shot.ok) {
        results.validationFailed.push({ id: row.id, filename: row.dateiname, ...shot.validation });
      }
    } catch (err) {
      results.missing.push({
        id: row.id,
        filename: row.dateiname,
        reason: String(err?.message ?? err).slice(0, 120),
      });
    }
  }
  await ctx.close();
}

async function uiEmployeeLogin(page, username, password) {
  await navigateAndPrepare(page, '/auth/employee-login', '03-auth-employee-login.png');
  const userInput = page.locator('input:not([type="password"])').first();
  const passInput = page.locator('input[type="password"]').first();
  if (!(await userInput.count()) || !(await passInput.count())) {
    return { ok: false, reason: 'no_inputs' };
  }
  await userInput.fill(username);
  await passInput.fill(password);
  await page.getByText('Einloggen', { exact: false }).first().click();
  await waitForNetworkSettled(page);
  await waitForLoadingGone(page);
  await settle(page, 2000);

  const url = page.url();
  const text = await bodyText(page);

  if (url.includes('employee-first-login') || text.includes('eigenes Passwort')) {
    const newPass = 'AuditSchulung2026!X';
    const pwdFields = page.locator('input[type="password"]');
    const pwdCount = await pwdFields.count();
    if (pwdCount >= 3) {
      await pwdFields.nth(0).fill(password);
      await pwdFields.nth(1).fill(newPass);
      await pwdFields.nth(2).fill(newPass);
    } else if (pwdCount >= 2) {
      await pwdFields.nth(0).fill(newPass);
      await pwdFields.nth(1).fill(newPass);
    }
    const termsBtn = page.getByText(/Datenschutz.*bestätigen/i);
    if (await termsBtn.count()) await termsBtn.first().click();
    const saveBtn = page.getByText('Passwort speichern', { exact: false }).first();
    if (await saveBtn.count()) {
      await saveBtn.click();
      await waitForNetworkSettled(page);
      await waitForLoadingGone(page);
      await settle(page, 3000);
    }
  }

  const afterUrl = page.url();
  const afterText = await bodyText(page);
  const ok =
    afterUrl.includes('/portal/employee') ||
    isWelcomeOpenText(afterText) ||
    afterText.includes('Übersicht');
  return { ok, text: afterText };
}

async function uiClientLogin(page, username, code) {
  await navigateAndPrepare(page, '/auth/portal-code-login', '05-auth-portal-code-login.png');
  const inputs = page.locator('input');
  if ((await inputs.count()) < 2) return { ok: false, reason: 'no_inputs' };
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(code);
  await page.getByText('Einloggen', { exact: false }).first().click();
  await waitForNetworkSettled(page);
  await waitForLoadingGone(page);
  await settle(page, 2000);
  const text = await bodyText(page);
  const url = page.url();
  const ok = url.includes('/portal/client') || isWelcomeOpenText(text) || text.includes('Termin');
  return { ok, text };
}

async function employeePortalApiLogin(publicClient, username, passwords) {
  const list = Array.isArray(passwords) ? passwords : [passwords];
  for (const password of list) {
    const session = await portalApiLogin(publicClient, 'employee', username, password);
    if (session) return { ok: true, session, password };
  }
  return { ok: false };
}

async function captureWelcomeShot(page, spec, kind, accountId, results, note = '') {
  await preparePageForScreenshot(page, spec.dateiname, { allowWelcome: true });
  const shot = await captureWithRetry(page, spec.dateiname, note, { allowWelcome: true });
  results.captured.push({ id: spec.id, ...shot });
  if (!shot.ok) {
    results.validationFailed.push({ id: spec.id, filename: spec.dateiname, ...shot.validation });
  }
  await markWelcomeSeen(page, kind, accountId);
  await clearWelcomePendingStorage(page);
}

async function captureEmployeePortal(browser, specs, publicClient, env, adminClient, results) {
  await ensureSchulungSeed();
  const { username, password } = employeeEnvCreds(env);
  const passwordCandidates = [...new Set([password, 'AuditSchulung2026!X', 'AuditProd2026!X'])];

  await repairEmployeePortalAccount(adminClient, env);
  await finalizeEmployeePortalForSchulung(adminClient);

  const welcomeSpec = specs.find((s) => s.dateiname === '40-employee-welcome-modal.png');
  const otherSpecs = specs.filter((s) => s.dateiname !== '40-employee-welcome-modal.png');

  // --- Welcome modal (SS-040): capture WITH modal ---
  if (welcomeSpec) {
    const ctx = await newContext(browser, true);
    const page = await ctx.newPage();
    try {
      const api = await employeePortalApiLogin(publicClient, username, passwordCandidates);
      if (api.ok) {
        await armWelcomePending(ctx, 'employee', api.session.accountId);
        await injectPortalSession(page, api.session, api.session.supabaseTokens, {
          kind: 'employee',
          accountId: api.session.accountId,
        });
        await setWelcomePending(page, 'employee', api.session.accountId);
        await navigateAndPrepare(page, '/portal/employee', welcomeSpec.dateiname, {
          allowWelcome: true,
        });
        await captureWelcomeShot(page, welcomeSpec, 'employee', api.session.accountId, results, 'api_pending');
      } else {
        const login = await uiEmployeeLogin(page, username, password);
        if (login.ok && isWelcomeOpenText(login.text ?? '')) {
          await captureWelcomeShot(page, welcomeSpec, 'employee', null, results, 'ui_login');
        } else {
          results.missing.push({ id: welcomeSpec.id, filename: welcomeSpec.dateiname, reason: 'welcome_not_shown' });
        }
      }
    } catch (err) {
      results.missing.push({
        id: welcomeSpec.id,
        filename: welcomeSpec.dateiname,
        reason: String(err?.message ?? err).slice(0, 120),
      });
    }
    await ctx.close();
  }

  // --- All other employee portal shots: welcome MUST be dismissed ---
  await repairEmployeePortalAccount(adminClient, env);
  await finalizeEmployeePortalForSchulung(adminClient);
  const api = await employeePortalApiLogin(publicClient, username, passwordCandidates);
  if (!api.ok) {
    for (const row of otherSpecs) {
      results.missing.push({ id: row.id, filename: row.dateiname, reason: 'employee_login_failed' });
    }
    return;
  }

  const ctx = await newContext(browser, true);
  const page = await ctx.newPage();
  await injectPortalSession(page, api.session, api.session.supabaseTokens);
  await markWelcomeSeen(page, 'employee', api.session.accountId);

  for (const row of otherSpecs) {
    try {
      await markWelcomeSeen(page, 'employee', api.session.accountId);
      await clearWelcomePendingStorage(page);

      if (row.dateiname === '43-employee-assignment-detail.png') {
        await patchAssignmentStatus(adminClient, 'bestaetigt');
        await openAssignmentDetailFromList(page, row.dateiname);
      } else if (row.dateiname === '44-employee-execution-consent.png') {
        await patchAssignmentStatus(adminClient, 'bestaetigt');
        await openAssignmentDetailFromList(page, row.dateiname);
        await openExecutionFromDetail(page, row.dateiname);
      } else if (row.dateiname === '45-employee-execution-unterwegs.png') {
        await patchAssignmentStatus(adminClient, 'unterwegs');
        await openAssignmentDetailFromList(page, row.dateiname);
        await openExecutionFromDetail(page, row.dateiname);
      } else if (row.dateiname === '46-employee-execution-gestartet.png') {
        await patchAssignmentStatus(adminClient, 'gestartet');
        await openAssignmentDetailFromList(page, row.dateiname);
        await openExecutionFromDetail(page, row.dateiname);
      } else {
        const route = resolveRoute(row);
        if (!route) {
          results.missing.push({ id: row.id, filename: row.dateiname, reason: 'no_url' });
          continue;
        }
        await navigateAndPrepare(page, route, row.dateiname);
      }

      const shot = await captureWithRetry(page, row.dateiname);
      results.captured.push({ id: row.id, ...shot });
      if (!shot.ok) {
        results.validationFailed.push({ id: row.id, filename: row.dateiname, ...shot.validation });
      }
    } catch (err) {
      results.missing.push({
        id: row.id,
        filename: row.dateiname,
        reason: String(err?.message ?? err).slice(0, 120),
      });
    }
  }
  await ctx.close();
}

async function captureClientPortal(browser, specs, publicClient, env, results) {
  const username = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME']);
  const code = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);

  const welcomeSpec = specs.find((s) => s.dateiname === '51-client-welcome-modal.png');
  const otherSpecs = specs.filter((s) => s.dateiname !== '51-client-welcome-modal.png');

  if (welcomeSpec) {
    const ctx = await newContext(browser, true);
    const page = await ctx.newPage();
    try {
      const login = await uiClientLogin(page, username, code);
      if (login.ok && isWelcomeOpenText(login.text ?? '')) {
        await captureWelcomeShot(page, welcomeSpec, 'client', null, results, 'ui_login');
      } else {
        const session = await portalApiLogin(publicClient, 'client', username, code);
        if (session) {
          await armWelcomePending(ctx, 'client', session.accountId);
          await injectPortalSession(page, session, session.supabaseTokens, {
            kind: 'client',
            accountId: session.accountId,
          });
          await setWelcomePending(page, 'client', session.accountId);
          await navigateAndPrepare(page, '/portal/client', welcomeSpec.dateiname, { allowWelcome: true });
          await captureWelcomeShot(page, welcomeSpec, 'client', session.accountId, results, 'api_pending');
        } else {
          results.missing.push({ id: welcomeSpec.id, filename: welcomeSpec.dateiname, reason: 'welcome_not_shown' });
        }
      }
    } catch (err) {
      results.missing.push({
        id: welcomeSpec.id,
        filename: welcomeSpec.dateiname,
        reason: String(err?.message ?? err).slice(0, 120),
      });
    }
    await ctx.close();
  }

  const session = await portalApiLogin(publicClient, 'client', username, code);
  if (!session) {
    for (const row of otherSpecs) {
      results.missing.push({ id: row.id, filename: row.dateiname, reason: 'client_login_failed' });
    }
    return;
  }

  const ctx = await newContext(browser, true);
  const page = await ctx.newPage();
  await injectPortalSession(page, session, session.supabaseTokens);
  await markWelcomeSeen(page, 'client', session.accountId);

  for (const row of otherSpecs) {
    try {
      await markWelcomeSeen(page, 'client', session.accountId);
      await clearWelcomePendingStorage(page);

      const route = resolveRoute(row);
      if (!route) {
        results.missing.push({ id: row.id, filename: row.dateiname, reason: 'no_url' });
        continue;
      }
      await navigateAndPrepare(page, route, row.dateiname);

      const shot = await captureWithRetry(page, row.dateiname);
      results.captured.push({ id: row.id, ...shot });
      if (!shot.ok) {
        results.validationFailed.push({ id: row.id, filename: row.dateiname, ...shot.validation });
      }
    } catch (err) {
      results.missing.push({
        id: row.id,
        filename: row.dateiname,
        reason: String(err?.message ?? err).slice(0, 120),
      });
    }
  }
  await ctx.close();
}


function loadPreviousValidationJson() {
  const validationJsonPath = join(outDir, 'capture-validation.json');
  if (!existsSync(validationJsonPath)) return null;
  try {
    return JSON.parse(readFileSync(validationJsonPath, 'utf8'));
  } catch {
    return null;
  }
}

function failedFilenamesFromValidation(prev) {
  if (!prev?.files?.length) return null;
  const names = prev.files.filter((f) => f.status === 'FAIL').map((f) => f.filename);
  return names.length ? new Set(names) : null;
}

function mergeValidationWithPrevious(allSpecs, freshTable, previousFiles) {
  if (!previousFiles?.length) return freshTable;
  const freshByFilename = new Map(freshTable.map((r) => [r.filename, r]));
  const prevByFilename = new Map(previousFiles.map((r) => [r.filename, r]));
  return allSpecs.map((spec) => {
    const fresh = freshByFilename.get(spec.dateiname);
    if (fresh) return fresh;
    const prev = prevByFilename.get(spec.dateiname);
    if (prev) return prev;
    return {
      id: spec.id,
      filename: spec.dateiname,
      status: 'FAIL',
      welcomePopup: 'n/a',
      bytes: '\u2014',
      note: 'not_captured',
    };
  });
}

async function armWelcomePending(context, kind, accountId) {
  await context.addInitScript(
    ([k, id]) => {
      localStorage.setItem('portal-welcome-pending', k);
      if (id) localStorage.removeItem('portal-welcome-seen:' + k + ':' + id);
    },
    [kind, accountId ?? ''],
  );
}

function buildValidationTable(allSpecs, results) {
  const byFilename = new Map(results.captured.map((c) => [c.filename, c]));
  const failedByFilename = new Map(results.validationFailed.map((f) => [f.filename, f]));
  const missingByFilename = new Map(results.missing.map((m) => [m.filename, m]));

  return allSpecs.map((spec) => {
    const item = byFilename.get(spec.dateiname);
    const failed = failedByFilename.get(spec.dateiname);
    const missing = missingByFilename.get(spec.dateiname);

    let status = 'FAIL';
    let welcomePopup = 'n/a';
    let bytes = '—';
    let note = '';

    if (item?.ok) {
      status = 'PASS';
      bytes = String(item.validation?.bytes ?? '—');
      if (WELCOME_SHOTS.has(spec.dateiname)) {
        welcomePopup = item.welcomeCheck === 'PASS' ? 'expected' : 'missing';
      } else if (PORTAL_NO_WELCOME.has(spec.dateiname)) {
        welcomePopup = item.welcomeCheck === 'PASS' ? 'none' : 'BLOCKED';
      }
    } else if (missing) {
      note = missing.reason ?? 'not_captured';
    } else if (failed) {
      note = failed.reason ?? item?.validation?.reason ?? 'validation_failed';
      if (note === 'welcome_overlay') welcomePopup = 'BLOCKED';
    }

    return { id: spec.id, filename: spec.dateiname, status, welcomePopup, bytes, note };
  });
}

function writeReadmeValidationLog(allSpecs, results) {
  const readmePath = join(outDir, 'README.md');
  const table = results.validationTable ?? buildValidationTable(allSpecs, results);
  const ts = results.timestamp.slice(0, 19).replace('T', ' ');
  const popupBlocked = table.filter((r) => r.welcomePopup === 'BLOCKED').length;
  const passCount = table.filter((r) => r.status === 'PASS').length;

  const tableLines = [
    '| ID | Datei | Status | Willkommen-Popup | Bytes | Hinweis |',
    '|----|-------|--------|------------------|-------|---------|',
    ...table.map(
      (r) =>
        `| ${r.id} | \`${r.filename}\` | **${r.status}** | ${r.welcomePopup} | ${r.bytes} | ${r.note || '—'} |`,
    ),
  ];

  const validationSection = `## Validierungslog (letzter Lauf)

**Zeitpunkt:** ${ts}  
**Ergebnis:** ${passCount}/${table.length} PASS · Willkommen-Popup fälschlich sichtbar: **${popupBlocked}** (erlaubt nur SS-040 / SS-051)

${tableLines.join('\n')}
`;

  let readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';
  const marker = '## Validierungslog (letzter Lauf)';
  if (readme.includes(marker)) {
    readme = readme.replace(/## Validierungslog \(letzter Lauf\)[\s\S]*?(?=\n## |\n$|$)/, validationSection.trim());
  } else {
    readme = `${readme.trim()}\n\n${validationSection}`;
  }

  readme = readme.replace(/- \*\*650 ms\*\* Ruhepause/, '- **800 ms** Ruhepause');
  readme = readme.replace(/\*\*Stand:\*\*[^\n]*/, `**Stand:** ${ts.split(' ')[0]}`);

  writeFileSync(readmePath, readme);
  results.validationTable = table;
  results.welcomePopupBlockedCount = popupBlocked;
}

async function main() {
  loadEnvFile();
  const env = loadAuditEnv();
  const cli = parseCaptureCli(process.argv);
  const { onlyFilter, targetFilenames, incremental } = cli;
  const allSpecs = parseCsv();
  const previousValidation = loadPreviousValidation();
  const captureSpecs = filterSpecsByTarget(allSpecs, targetFilenames);
  const results = {
    ok: false,
    phase: 'schulung_screenshots',
    baseUrl,
    captured: [],
    missing: [],
    validationFailed: [],
    validationPassed: [],
    kept: [],
    total: allSpecs.length,
    incremental,
    captureTargetCount: captureSpecs.length,
    timestamp: new Date().toISOString(),
  };

  if (incremental) {
    console.log(
      `Incremental capture: ${captureSpecs.length} target(s) - ${captureSpecs.map((s) => s.dateiname).join(', ')}`,
    );
  }

  const adminClient = createAuditAdminClient(env);
  const publicClient = createAuditPublicClient(env);

  // Ensure E2E assignments / messages exist for portal detail routes.
  try {
    const { spawnSync } = await import('node:child_process');
    const seed = spawnSync(process.execPath, ['scripts/audit/contentPortalE2eSeed.mjs'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
    });
    results.e2eSeed = { ok: seed.status === 0, status: seed.status };
  } catch (err) {
    results.e2eSeed = { ok: false, error: String(err?.message ?? err).slice(0, 80) };
  }

  const repair = await repairEmployeePortalAccount(adminClient, env);
  await finalizeEmployeePortalForSchulung(adminClient);
  results.employeeRepair = { ok: repair.ok, diag: repair.diag };

  const publicIds = new Set(['SS-001', 'SS-002', 'SS-003', 'SS-004', 'SS-005', 'SS-006', 'SS-007']);
  const officeIds = new Set([
    'SS-010', 'SS-011', 'SS-012', 'SS-013', 'SS-014', 'SS-015', 'SS-016', 'SS-017', 'SS-018', 'SS-019', 'SS-020',
  ]);
  const assistIds = new Set([
    'SS-030', 'SS-031', 'SS-032', 'SS-033', 'SS-034', 'SS-035', 'SS-036', 'SS-037', 'SS-038', 'SS-039',
  ]);
  const employeeIds = new Set([
    'SS-040', 'SS-041', 'SS-042', 'SS-043', 'SS-044', 'SS-045', 'SS-046', 'SS-047', 'SS-048', 'SS-049', 'SS-050',
  ]);
  const clientIds = new Set(['SS-051', 'SS-052', 'SS-053', 'SS-054', 'SS-055']);

  const browser = await launchBrowser();

  if ((!onlyFilter || onlyFilter === 'public') && (!incremental || captureSpecs.some((s) => publicIds.has(s.id)))) {
    const publicSpecs = (incremental ? captureSpecs : allSpecs).filter((s) => publicIds.has(s.id));
    if (publicSpecs.length) await capturePublicPages(browser, publicSpecs, results);
  }

  const bizLogin = await trySupabaseLogin(env);
  results.businessLogin = { ok: bizLogin.ok, reason: bizLogin.reason ?? null };

  if ((!onlyFilter || onlyFilter === 'business') && (!incremental || captureSpecs.some((s) => officeIds.has(s.id) || assistIds.has(s.id)))) {
    if (bizLogin.ok) {
      const bizSpecs = (incremental ? captureSpecs : allSpecs).filter((s) => officeIds.has(s.id) || assistIds.has(s.id));
      if (bizSpecs.length) await captureBusinessPages(browser, bizSpecs, bizLogin.session, results);
    } else if (!onlyFilter) {
      for (const row of allSpecs.filter((s) => officeIds.has(s.id) || assistIds.has(s.id))) {
        results.missing.push({ id: row.id, filename: row.dateiname, reason: 'business_login_failed' });
      }
    }
  }

  if ((!onlyFilter || onlyFilter === 'employee') && (!incremental || captureSpecs.some((s) => employeeIds.has(s.id)))) {
    const empSpecs = (incremental ? captureSpecs : allSpecs).filter((s) => employeeIds.has(s.id));
    if (empSpecs.length) {
      await captureEmployeePortal(browser, empSpecs, publicClient, env, adminClient, results);
    }
  }

  if ((!onlyFilter || onlyFilter === 'client') && (!incremental || captureSpecs.some((s) => clientIds.has(s.id)))) {
    const clientSpecs = (incremental ? captureSpecs : allSpecs).filter((s) => clientIds.has(s.id));
    if (clientSpecs.length) await captureClientPortal(browser, clientSpecs, publicClient, env, results);
  }

  await browser.close();

  const byFile = new Map();
  for (const item of results.captured) {
    byFile.set(item.filename, item);
  }
  results.captured = [...byFile.values()];

  for (const item of results.captured) {
    if (item.ok) {
      results.validationPassed.push({
        id: item.id,
        filename: item.filename,
        bytes: item.validation?.bytes,
        welcomeCheck: item.welcomeCheck ?? null,
      });
    }
  }

  const capturedIds = new Set(results.captured.map((c) => c.id));
  if (incremental) {
    results.missing = captureSpecs
      .filter((s) => !capturedIds.has(s.id))
      .map((s) => {
        const prev = results.missing.find((m) => m.id === s.id);
        return prev ?? { id: s.id, filename: s.dateiname, reason: 'not_captured' };
      });
    for (const spec of allSpecs) {
      if (targetFilenames?.has(spec.dateiname)) continue;
      if (existsSync(join(outDir, spec.dateiname))) {
        results.kept.push({ id: spec.id, filename: spec.dateiname });
      }
    }
  } else {
    results.missing = allSpecs
      .filter((s) => !capturedIds.has(s.id))
      .map((s) => {
        const prev = results.missing.find((m) => m.id === s.id);
        return prev ?? { id: s.id, filename: s.dateiname, reason: 'not_captured' };
      });
  }

  results.capturedCount = results.captured.length;
  results.missingCount = results.missing.length;
  results.validationFailedCount = results.validationFailed.length;
  results.validationPassedCount = results.validationPassed.length;

  results.validationTable = mergeValidationTable(allSpecs, results, previousValidation, incremental);
  results.ok =
    results.validationTable.filter((r) => r.status === 'FAIL').length === 0 &&
    results.missingCount === 0;

  writeReadmeValidationLog(allSpecs, results);

  const validationPass = results.validationTable.filter((r) => r.status === 'PASS').length;
  const validationFail = results.validationTable.filter((r) => r.status === 'FAIL').length;
  writeFileSync(
    validationJsonPath,
    JSON.stringify(
      {
        timestamp: results.timestamp,
        baseUrl,
        total: allSpecs.length,
        pass: validationPass,
        fail: validationFail,
        ok: results.ok,
        welcomePopupBlocked: results.welcomePopupBlockedCount,
        files: results.validationTable,
      },
      null,
      2,
    ),
  );
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify({
      captured: results.capturedCount,
      kept: results.kept?.length ?? 0,
      missing: results.missingCount,
      validationPassed: validationPass,
      validationFailed: validationFail,
      welcomePopupBlocked: results.welcomePopupBlockedCount,
      total: results.total,
      incremental,
      newlyCaptured: results.captured.map((c) => c.filename),
      stillFailing: results.validationTable.filter((r) => r.status === 'FAIL').map((r) => r.filename),
      businessLogin: results.businessLogin?.ok,
      employeeRepair: results.employeeRepair?.ok,
    }),
  );
}

main().catch((err) => {
  console.error(String(err?.message ?? err).slice(0, 300));
  process.exit(1);
});
