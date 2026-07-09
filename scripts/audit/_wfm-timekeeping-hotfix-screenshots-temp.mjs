#!/usr/bin/env node
/**
 * WFM Offene Prüfungen table hotfix PASS 2 — screenshot gate.
 * Uses staging credentials (office.staging@example.test) — password from env only.
 */
import { chromium } from 'playwright';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outPhase = process.argv.includes('--after') ? 'hotfix-after' : 'hotfix-before';
const outDir = join(root, 'docs', 'audit', 'wfm-timekeeping-ui-redesign', outPhase);
const reportPath = join(outDir, 'screenshot-gate-results.json');

const baseUrl = (process.env.AUDIT_WEB_URL ?? 'https://caresuiteplus.app').replace(/\/$/, '');
const email = process.env.AUDIT_BUSINESS_EMAIL ?? 'office.staging@example.test';
const password = process.env.AUDIT_BUSINESS_PASSWORD ?? process.env.STAGING_SEED_PASSWORD ?? '';

const ROUTES = {
  pruefqueue: '/business/office/time-tracking/pruefqueue',
  zeitkonten: '/business/office/time-tracking/zeitkonten',
  export: '/business/office/time-tracking/export',
};

const SHOTS = [
  { name: '01-offene-pruefungen.png', path: ROUTES.pruefqueue, width: 1075, height: 900 },
  {
    name: '02-offene-pruefungen-horizontal-scroll.png',
    path: ROUTES.pruefqueue,
    width: 1075,
    height: 900,
    scrollTable: true,
  },
  { name: '03-pruefen-panel.png', path: ROUTES.pruefqueue, width: 1440, height: 900, openPanel: true },
  { name: '04-zeitkonten.png', path: ROUTES.zeitkonten, width: 1440, height: 900 },
  { name: '05-export-p23.png', path: ROUTES.export, width: 1440, height: 900 },
  { name: '06-mobile-card-layout.png', path: ROUTES.pruefqueue, width: 390, height: 844 },
];

function loadStagingGuard() {
  const envPath = join(root, 'supabase', '.temp', 'staging-env.json');
  if (!existsSync(envPath)) return;
  const parsed = JSON.parse(readFileSync(envPath, 'utf8'));
  if (parsed.projectRef === 'euagyyztvmemuaiumvxm') {
    throw new Error('ABBRUCH: staging-env.json zeigt auf Production');
  }
}

async function dismissOverlays(page) {
  for (const label of ['Schließen', 'Close', 'Überspringen', 'Später']) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

function loadStagingEnv() {
  const envPath = join(root, 'supabase', '.temp', 'staging-env.json');
  if (!existsSync(envPath)) return null;
  return JSON.parse(readFileSync(envPath, 'utf8'));
}

async function signInStagingSession() {
  const staging = loadStagingEnv();
  const anonKey =
    staging?.anonKey ??
    process.env.STAGING_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    '';
  if (!staging?.url || !anonKey) return null;
  const res = await fetch(`${staging.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Staging login failed: ${body.error_description ?? res.status}`);
  }
  const ref = staging.projectRef ?? new URL(staging.url).hostname.split('.')[0];
  return {
    storageKey: `sb-${ref}-auth-token`,
    session: {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_in: body.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in ?? 3600),
      token_type: body.token_type ?? 'bearer',
      user: body.user,
    },
  };
}

async function login(page) {
  if (!password) throw new Error('Missing AUDIT_BUSINESS_PASSWORD or STAGING_SEED_PASSWORD');

  const injected = await signInStagingSession().catch(() => null);
  if (injected) {
    await page.goto(`${baseUrl}/auth/business-login`, { waitUntil: 'commit', timeout: 120000 });
    await page.evaluate(
      ({ storageKey, session }) => {
        globalThis.localStorage.setItem(storageKey, JSON.stringify(session));
      },
      injected,
    );
    await page.goto(`${baseUrl}/business/office/time-tracking/pruefqueue`, {
      waitUntil: 'commit',
      timeout: 120000,
    });
    await dismissOverlays(page);
    await page.waitForTimeout(3000);
    return;
  }

  await page.goto(`${baseUrl}/auth/business-login`, { waitUntil: 'commit', timeout: 120000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2000);

  const screensaver = page.getByText('Bildschirmschoner beenden');
  if (await screensaver.isVisible().catch(() => false)) {
    await screensaver.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  const emailInput = page.locator('input').nth(0);
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.waitFor({ state: 'visible', timeout: 45000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.getByRole('button', { name: /Einloggen|Anmelden|Login/i }).click();
  await page.waitForURL(/\/(business|office)/, { timeout: 90000 });
}

async function applyReviewDateFilter(page) {
  const last7 = page.getByRole('button', { name: 'Letzte 7 Tage' });
  await last7.scrollIntoViewIfNeeded().catch(() => {});
  await last7.click({ force: true });
  await page
    .waitForFunction(() => {
      const body = document.body.innerText;
      return body.includes('MITARBEITER') || body.includes('Fehlende Buchung') || body.includes('1 Einträge');
    }, { timeout: 25000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

async function waitForReviewTable(page) {
  await applyReviewDateFilter(page);

  await page
    .waitForSelector('[data-testid="wfm-office-time-entry-table"], [data-testid="table-container"], [data-testid="wfm-review-queue-mobile"]', {
      timeout: 90000,
    })
    .catch(async () => {
      await page.getByText(/Offene Prüfungen|Zeitbuchungen prüfen|Keine Arbeitszeiteinträge/i).first().waitFor({
        state: 'visible',
        timeout: 30000,
      });
    });
  await page.waitForTimeout(1000);
}

async function scrollTableRight(page) {
  await page.evaluate(() => {
    const scrollEl =
      document.querySelector('[data-testid="table-scroll-container"]') ??
      document.querySelector('[data-testid="wfm-office-time-entry-table"] [style*="overflow"]') ??
      document.querySelector('[data-testid="table-container"]')?.parentElement;
    if (scrollEl instanceof HTMLElement) {
      scrollEl.scrollLeft = scrollEl.scrollWidth;
    }
  });
  await page.waitForTimeout(600);
}

async function evaluateGate(page) {
  return page.evaluate(() => {
    const table = document.querySelector('[data-testid="table-container"]');
    if (!table) return { ok: false, reason: 'table-missing' };

    const headerTexts = Array.from(table.querySelectorAll('div')).map((el) => (el.textContent ?? '').trim());
    const headerLabels = ['DATUM', 'MITARBEITER', 'KLIENT', 'PLAN', 'EINSATZ-IST', 'BUCHUNG', 'STATUS', 'AKTION'];
    const truncatedHeader = headerTexts.some(
      (text) => text.includes('DAUER EINSAT') || text.includes('EINSAT…') || text === 'ST',
    );
    const missingHeaders = headerLabels.filter(
      (label) => !headerTexts.some((text) => text.toUpperCase().startsWith(label)),
    );

        const badges = Array.from(table.querySelectorAll('div, span')).filter((el) => {
          const text = (el.textContent ?? '').trim();
          if (!/^(Fehlende Buchung|Fehlt|Ungeplant|Office-Nachtrag|Ungeplante Arbeitszeit)$/.test(text)) {
            return false;
          }
          return el.children.length === 0 || text.length <= 24;
        });
        const buttons = Array.from(table.querySelectorAll('button, [role="button"]')).filter((el) =>
          /^(Prüfen|Schließen)$/.test((el.textContent ?? '').trim()),
        );

    let overlap = false;
    let truncatedStatus = false;
    let truncatedDauer = false;
    let actionReachable = false;

    for (const badge of badges) {
      const br = badge.getBoundingClientRect();
      if ((badge.textContent ?? '').includes('Fehlende B')) truncatedStatus = true;
      if ((badge.textContent ?? '').includes('Dauer Einsat')) truncatedDauer = true;
      for (const btn of buttons) {
        const tr = btn.getBoundingClientRect();
        const intersects =
          br.left < tr.right && br.right > tr.left && br.top < tr.bottom && br.bottom > tr.top;
        if (intersects) overlap = true;
      }
    }

    for (const btn of buttons) {
      const tr = btn.getBoundingClientRect();
      if (tr.width > 0 && tr.right > 0 && tr.left < window.innerWidth) actionReachable = true;
    }

    const scrollContainer =
      document.querySelector('[data-testid="table-scroll-container"]') ??
      document.querySelector('[data-testid="wfm-office-time-entry-table"]');
    const scrollEl = scrollContainer instanceof HTMLElement ? scrollContainer : null;
    const tableScrollOk = scrollEl ? scrollEl.scrollWidth > scrollEl.clientWidth : false;
    const pageScrollX = document.documentElement.scrollWidth > document.documentElement.clientWidth;

        const mobileCards = document.querySelectorAll('[data-testid^="wfm-review-card-"]').length;

    return {
      ok:
        !overlap &&
        !truncatedStatus &&
        !truncatedDauer &&
        !truncatedHeader &&
        missingHeaders.length === 0 &&
        actionReachable &&
        !pageScrollX,
      overlap,
      truncatedStatus,
      truncatedDauer,
      truncatedHeader,
      missingHeaders,
      actionReachable,
      tableScrollOk,
      pageScrollX,
      mobileCards,
      badgeCount: badges.length,
      buttonCount: buttons.length,
    };
  });
}

async function capture() {
  loadStagingGuard();
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium
    .launch({
      headless: true,
      channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
    })
    .catch(async () =>
      chromium.launch({
        headless: true,
        channel: 'msedge',
      }),
    )
    .catch(async () => chromium.launch({ headless: true }));
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = { phase: outPhase, baseUrl, login: email, shots: [], gate: {}, errors: [] };

  try {
    await login(page);

    for (const shot of SHOTS) {
      await page.setViewportSize({ width: shot.width, height: shot.height });
      await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'commit', timeout: 120000 });
      await dismissOverlays(page);

      if (shot.path === ROUTES.pruefqueue) {
        await waitForReviewTable(page);
      } else {
        await page.waitForTimeout(1500);
      }

      if (shot.scrollTable) {
        await scrollTableRight(page);
      }

      if (shot.openPanel) {
        const pruefen = page.getByRole('button', { name: 'Prüfen' }).first();
        if (await pruefen.isVisible().catch(() => false)) {
          await pruefen.click();
          await page.waitForTimeout(1000);
        }
      }

      const filePath = join(outDir, shot.name);
      await page.screenshot({ path: filePath, fullPage: true, animations: 'disabled' });
      results.shots.push({ name: shot.name, ok: true });
      console.log(`saved ${shot.name}`);
    }

    if (outPhase === 'hotfix-after') {
      await page.setViewportSize({ width: 1075, height: 900 });
      await page.goto(`${baseUrl}${ROUTES.pruefqueue}`, { waitUntil: 'networkidle', timeout: 90000 });
      await waitForReviewTable(page);
      await scrollTableRight(page);

      const gate = await evaluateGate(page);
      results.gate = gate;
      console.log('gate', JSON.stringify(gate));
    }
  } catch (err) {
    results.errors.push(err instanceof Error ? err.message : String(err));
    console.error(err);
  } finally {
    writeFileSync(reportPath, JSON.stringify(results, null, 2));
    await browser.close();
  }

  if (results.errors.length) process.exitCode = 1;
}

if (process.argv.includes('--seed-before-from-production')) {
  const src = join(root, 'docs', 'audit', 'wfm-timekeeping-ui-redesign', 'production', '01-offene-pruefungen.png');
  const destDir = join(root, 'docs', 'audit', 'wfm-timekeeping-ui-redesign', 'hotfix-before');
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, join(destDir, '01-offene-pruefungen.png'));
  console.log('seeded hotfix-before from production evidence');
} else {
  await capture();
}
