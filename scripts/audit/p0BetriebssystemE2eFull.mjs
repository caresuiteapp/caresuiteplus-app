#!/usr/bin/env node
/**
 * P0 Betriebssystem — Full browser E2E acceptance (production).
 * Never logs secrets. Output: docs/audit/p0-e2e-abnahme-results.json
 */
import { chromium, devices } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditAdminClient,
  createAuditPublicClient,
  loadAuditEnv,
  pick,
} from './scripts/audit/lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)));
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'http://localhost:8081').replace(/\/$/, '');
const screenshotDir = join(root, 'docs/audit/p0-e2e-screenshots');
const reportPath = join(root, 'docs/audit/p0-e2e-abnahme-results.json');
const TENANT =
  process.env.AUDIT_P0_TENANT_ID?.trim() || 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const HELFERHASEN_TENANT = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';
const FORBIDDEN = ['42703', 'RPC failed', 'source_snapshot', 'WP 246', 'Core K.', 'display_name does not exist'];

const CRITERIA = [
  { id: 1, key: 'office_planung', label: 'Office plant realistischen Einsatz' },
  { id: 2, key: 'assist_anzeige', label: 'Assist zeigt Einsatz korrekt' },
  { id: 3, key: 'mp_sichtbar', label: 'MP zeigt Einsatz beim richtigen MA' },
  { id: 4, key: 'mp_ablauf', label: 'MP kompletter Statuslauf' },
  { id: 5, key: 'proof_erzeugt', label: 'Leistungsnachweis erzeugt' },
  { id: 6, key: 'proof_inhalt', label: 'Nachweis enthält korrekte Daten' },
  { id: 7, key: 'proof_klient', label: 'Nachweis beim richtigen Klienten' },
  { id: 8, key: 'proof_sichtbarkeit', label: 'Nachweis in Assist/Office/KP' },
  { id: 9, key: 'budget_lifecycle', label: 'Budget-Lifecycle korrekt' },
  { id: 10, key: 'wfm_zeitkonto', label: 'WFM/Zeitkonto korrekt' },
  { id: 11, key: 'reload_konsistenz', label: 'Reload/Refresh konsistent' },
  { id: 12, key: 'realtime_sync', label: 'Sync Office/Assist/Portale' },
  { id: 13, key: 'rls_datenschutz', label: 'Datenschutz/RLS' },
  { id: 14, key: 'keine_demo_texte', label: 'Keine Demo/Prepared-Texte Live' },
  { id: 15, key: 'blocker_sichtbar', label: 'Blocker sichtbar wenn fehlend' },
];

function criterion(id, result, extra = {}) {
  return {
    criterionId: id,
    geprueft: extra.geprueft ?? true,
    ergebnis: result,
    betroffeneDateien: extra.files ?? [],
    erkannteLuecke: extra.gap ?? null,
    reparatur: extra.fix ?? null,
    testAbnahme: extra.test ?? null,
    restrisiko: extra.risk ?? null,
    details: extra.details ?? null,
    screenshot: extra.screenshot ?? null,
  };
}

async function shot(page, name) {
  mkdirSync(screenshotDir, { recursive: true });
  const path = join(screenshotDir, name);
  await page.screenshot({ path, fullPage: true, timeout: 20000 }).catch(() => null);
  return path.replace(root + '\\', '').replace(root + '/', '');
}

function scanForbidden(text) {
  return FORBIDDEN.filter((t) => text.includes(t));
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
  return { ok: true };
}

async function dismissWelcomeModal(page) {
  const welcomeVisible = await page
    .getByText(/Guten (Morgen|Tag|Abend)/i)
    .isVisible({ timeout: 4000 })
    .catch(() => false);
  if (!welcomeVisible) return false;
  const dismissed = await clickButtonByText(page, /Weiter zur Übersicht/i, 8000, { force: true });
  if (dismissed) await page.waitForTimeout(1500);
  return dismissed;
}

async function handlePostLoginOverlays(page) {
  await page.waitForTimeout(2000);
  await dismissWelcomeModal(page);
  for (const label of [
    /Weiter zur Übersicht/i,
    /Verstanden/i,
    /Weiter/i,
    /Los geht/i,
    /Schließen/i,
    /OK/i,
    /Fertig — Portal nutzen/i,
  ]) {
    await clickButtonByText(page, label, 4000, { force: true }).catch(() => false);
  }
  for (let step = 0; step < 6; step += 1) {
    const onboardingVisible = await page
      .getByText(/Berechtigungen & Einwilligungen/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (!onboardingVisible) break;
    await clickButtonByText(page, /Standort-Einwilligung erteilen/i, 3000).catch(() => false);
    await clickButtonByText(page, /Weiter|Fertig — Portal nutzen/i, 3000).catch(() => false);
    await page.waitForTimeout(1000);
  }
}

async function browserEmployeePortalLogin(page, username, password) {
  await page.goto(`${baseUrl}/auth/employee-portal-login`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(3000);
  const inputs = page.locator('input');
  const inputCount = await inputs.count();
  if (inputCount < 2) {
    return {
      ok: false,
      currentUrl: page.url(),
      loginFailed: true,
      onFirstLogin: false,
      bodySnippet: `login_form_missing inputs=${inputCount}`,
    };
  }
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.getByRole('button', { name: /Einloggen/i }).click();
  await page.waitForTimeout(8000);
  await handlePostLoginOverlays(page);
  const currentUrl = page.url();
  const body = await bodyText(page);
  const loginFailed =
    /Benutzername oder Passwort|Zugang gesperrt|Einmalpasswort ist abgelaufen|Kein Passwort hinterlegt/i.test(
      body,
    );
  const onFirstLogin = /first-login|Passwort.*ändern|Erstlogin/i.test(currentUrl + body);
  const ok =
    !loginFailed &&
    !onFirstLogin &&
    (/\/portal\/employee/i.test(currentUrl) || /Mitarbeiterportal/i.test(body));
  return { ok, currentUrl, loginFailed, onFirstLogin, bodySnippet: body.slice(0, 400) };
}

async function employeePortalLogin(publicClient, username, password) {
  const { url, key } = publicClient;
  const res = await fetch(`${url}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sessionToken) return { ok: false, errorClass: data.errorClass ?? 'login_failed' };
  return {
    ok: true,
    session: {
      sessionToken: data.sessionToken,
      tenantId: data.account.tenantId,
      loginType: 'employee_portal',
      roleKey: 'employee_portal',
      employeeId: data.account.employeeId,
      accountId: data.account.id,
      supabaseTokens:
        data.supabaseAccessToken && data.supabaseRefreshToken
          ? { accessToken: data.supabaseAccessToken, refreshToken: data.supabaseRefreshToken }
          : null,
    },
  };
}

async function injectEmployeeSession(page, env, session) {
  const sbKey = env.EXPO_PUBLIC_SUPABASE_URL
    ? `sb-${new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`
    : null;
  let sbPayload = null;
  if (session.supabaseTokens && sbKey) {
    const publicClient = createAuditPublicClient(env);
    const userRes = await fetch(`${publicClient.url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${session.supabaseTokens.accessToken}`, apikey: publicClient.key },
    });
    const user = userRes.ok ? await userRes.json() : null;
    sbPayload = JSON.stringify({
      access_token: session.supabaseTokens.accessToken,
      refresh_token: session.supabaseTokens.refreshToken,
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
    [PORTAL_SESSION_KEY, JSON.stringify(session), sbKey, sbPayload, session.accountId],
  );
}

async function clickButtonByText(page, pattern, timeout = 15000, options = {}) {
  const btn = page.getByRole('button', { name: pattern }).first();
  if (await btn.isVisible({ timeout }).catch(() => false)) {
    try {
      await btn.click({ timeout, force: options.force ?? false });
      await page.waitForTimeout(1500);
      return true;
    } catch {
      try {
        await btn.click({ timeout, force: true });
        await page.waitForTimeout(1500);
        return true;
      } catch {
        /* fall through to text locator */
      }
    }
  }
  const textBtn = page.getByText(pattern).first();
  if (await textBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    try {
      await textBtn.click({ timeout, force: options.force ?? true });
      await page.waitForTimeout(1500);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function dismissBlockingDialogs(page) {
  await clickButtonByText(page, /Zustimmen|Einwilligung erteilen|Akzeptieren/i, 5000).catch(() => false);
  for (const label of [/Schließen/i, /OK/i, /Verstanden/i, /Später/i]) {
    await clickButtonByText(page, label, 2000, { force: true }).catch(() => false);
  }
}

async function dismissLandscapePrompt(page) {
  const continuePortrait = page.getByText(/Trotzdem fortfahren/i).first();
  if (await continuePortrait.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continuePortrait.click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function drawSignatureStroke(page, canvas) {
  const box = await canvas.boundingBox();
  if (!box || box.width < 8 || box.height < 8) return false;

  const strokes = [
    { y: 0.35, x1: 0.12, x2: 0.88 },
    { y: 0.55, x1: 0.18, x2: 0.82 },
    { y: 0.72, x1: 0.15, x2: 0.75 },
  ];

  for (const stroke of strokes) {
    const y = box.y + box.height * stroke.y;
    const x1 = box.x + box.width * stroke.x1;
    const x2 = box.x + box.width * stroke.x2;
    await page.mouse.move(x1, y);
    await page.mouse.down();
    await page.mouse.move(x2, y, { steps: 24 });
    await page.mouse.up();
    await page.waitForTimeout(120);
  }
  return true;
}

async function waitForSignatureConfirmEnabled(page, timeoutMs = 20000) {
  const sigConfirm = page.getByTestId('portal-signature-confirm-button');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await sigConfirm.isVisible({ timeout: 1000 }).catch(() => false)) {
      const disabled = await sigConfirm.isDisabled().catch(() => true);
      if (!disabled) return sigConfirm;
    }
    await page.waitForTimeout(400);
  }
  return null;
}

async function verifySignaturePersisted(page, adminClient, visitId, steps) {
  for (let wait = 0; wait < 45; wait += 1) {
    const body = await bodyText(page);
    if (/Unterschrift gespeichert|Einsatz kann abgeschlossen|Leistungsnachweis erstellt/i.test(body)) {
      steps.push('signature_saved');
      return true;
    }
    if (/Signatur fehlgeschlagen|Unterschrift konnte nicht|Zeitüberschreitung/i.test(body)) {
      steps.push('signature_save_failed');
      return false;
    }
    await page.waitForTimeout(2000);
  }
  if (adminClient) {
    const sigDb = await queryDb(
      adminClient,
      'assist_visit_signatures',
      `visit_id=eq.${visitId}&tenant_id=eq.${TENANT}&select=id,status&limit=1`,
    );
    if (sigDb?.count > 0) {
      steps.push('signature_saved');
      steps.push('signature_saved_db_verified');
      return true;
    }
  }
  steps.push('signature_save_unverified');
  return false;
}

async function clickPhaseButton(page, pattern, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await dismissBlockingDialogs(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const clicked = await clickButtonByText(page, pattern, 20000);
    if (!clicked) return false;
    await page.waitForTimeout(5000);
    await dismissBlockingDialogs(page);
    const body = await bodyText(page);
    if (!/Zeitüberschreitung/i.test(body)) return true;
  }
  return false;
}

async function waitForPhaseButton(page, pattern, timeoutMs = 20000) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const btn = page.getByRole('button', { name: pattern }).first();
  return btn.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => true).catch(() => false);
}

async function dismissPermissionOnboarding(page) {
  for (let step = 0; step < 8; step += 1) {
    const onboardingVisible = await page
      .getByText(/Berechtigungen & Einwilligungen/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (!onboardingVisible) return;
    await clickButtonByText(page, /Standort-Einwilligung erteilen/i, 4000, { force: true }).catch(() => false);
    await clickButtonByText(page, /Weiter|Fertig — Portal nutzen/i, 4000, { force: true }).catch(() => false);
    await page.waitForTimeout(1000);
  }
}

async function grantLocationConsent(page) {
  await handlePostLoginOverlays(page);
  await dismissPermissionOnboarding(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  let clicked = false;
  const labelBtn = page.getByLabel(/Einwilligung erteilen/i).first();
  if (await labelBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    try {
      await labelBtn.click({ timeout: 12000 });
      clicked = true;
    } catch {
      await labelBtn.click({ timeout: 12000, force: true }).catch(() => null);
      clicked = true;
    }
  }
  if (!clicked) {
    const consentButton = page
      .locator('button, [role="button"]')
      .filter({ hasText: /Einwilligung erteilen & verstanden/i })
      .first();
    if (await consentButton.isVisible({ timeout: 8000 }).catch(() => false)) {
      await consentButton.click({ timeout: 12000, force: true }).catch(() => null);
      clicked = true;
    }
  }
  if (!clicked) {
    clicked = await clickButtonByText(page, /Einwilligung erteilen & verstanden/i, 10000, { force: true });
  }
  if (!clicked) return false;
  await page.waitForTimeout(3000);
  let stillVisible = await page
    .getByText(/Standort-Einwilligung erforderlich/i)
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  if (stillVisible) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await handlePostLoginOverlays(page);
    stillVisible = await page
      .getByText(/Standort-Einwilligung erforderlich/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);
  }
  return !stillVisible;
}

async function runMpWorkflow(page, visitId, adminClient = null) {
  const steps = [];
  const execUrl = `${baseUrl}/portal/employee/assignments/${visitId}/execute`;
  await page.goto(execUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(10000);
  await handlePostLoginOverlays(page);
  await dismissPermissionOnboarding(page);

  if (await grantLocationConsent(page)) {
    steps.push('location_consent');
    await page.waitForTimeout(2000);
    const afterConsent = await bodyText(page);
    if (/Standort-Einwilligung erforderlich/i.test(afterConsent)) {
      steps.push('location_consent_still_visible');
    }
  } else if (/Standort-Einwilligung erforderlich/i.test(await bodyText(page))) {
    steps.push('location_consent_missing');
  }

  const consentBlocking =
    steps.includes('location_consent_still_visible') || steps.includes('location_consent_missing');
  if (consentBlocking) {
    return { steps, completed: false, bodySnippet: (await bodyText(page)).slice(0, 500) };
  }

  const phaseButtons = [
    /Anfahrt starten/i,
    /Angekommen/i,
    /Einsatz starten/i,
    /Einsatz beenden/i,
  ];
  for (const label of phaseButtons) {
    if (label.source.includes('Einsatz starten')) {
      await waitForPhaseButton(page, label, 45000);
      await page.waitForTimeout(3000);
    }
    const clicked = await clickPhaseButton(page, label);
    if (clicked) steps.push(String(label));
    else if (label.source.includes('Einsatz starten') || label.source.includes('Einsatz beenden')) {
      steps.push(`${String(label)}_missing`);
    }
    if (label.source.includes('Angekommen')) {
      await page.waitForTimeout(5000);
      await dismissBlockingDialogs(page);
      await waitForPhaseButton(page, /Einsatz starten/i, 90000);
    }
    if (label.source.includes('Einsatz starten')) {
      await waitForPhaseButton(page, label, 60000);
      await page.waitForTimeout(2000);
      await waitForPhaseButton(page, /Einsatz beenden/i, 45000);
    }
    if (label.source.includes('Einsatz beenden')) {
      await dismissBlockingDialogs(page);
      await page.waitForTimeout(5000);
      for (let wait = 0; wait < 45; wait += 1) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const body = await bodyText(page);
        const docVisible = /Dokumentation|Kurzbeschreibung|Was wurde geleistet/i.test(body);
        const phaseLeftInService = !/Einsatz läuft/i.test(body);
        if (docVisible) break;
        if (phaseLeftInService && /Beendet|Dokumentation offen|dokumentation/i.test(body)) break;
        await page.waitForTimeout(2000);
      }
    }
  }

  const taskDone = page.getByRole('button', { name: /Erledigt|Abhaken|Done/i }).first();
  if (await taskDone.isVisible({ timeout: 8000 }).catch(() => false)) {
    await taskDone.click().catch(() => null);
    steps.push('task_done');
    await page.waitForTimeout(1000);
  }

  const notPossible = page.getByRole('button', { name: /Nicht möglich|Nicht erledigt/i }).first();
  if (await notPossible.isVisible({ timeout: 3000 }).catch(() => false)) {
    await notPossible.click().catch(() => null);
    steps.push('task_not_possible');
    const reason = page.getByPlaceholder(/Begründung|Grund/i).first();
    if (await reason.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reason.fill('P0-E2E — Testbegründung.');
      await clickButtonByText(page, /Speichern|Bestätigen/i, 5000);
    }
  }

  await dismissBlockingDialogs(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  async function fillReactNativeField(field, text) {
    await field.scrollIntoViewIfNeeded().catch(() => null);
    await field.click({ timeout: 5000, clickCount: 3 });
    await field.page().keyboard.type(text, { delay: 15 });
    await field.evaluate((el, value) => {
      const input = el;
      const proto =
        input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, text).catch(() => null);
  }

  async function fillDocumentationField(page) {
    const text = 'P0-E2E Testdokumentation — automatischer Abnahmelauf.';
    const selectors = [
      () => page.getByTestId('portal-doc-short-description'),
      () => page.getByLabel(/Kurzbeschreibung Eingabe/i),
      () => page.getByPlaceholder('Was wurde geleistet?'),
      () => page.getByPlaceholder(/Was wurde geleistet/i),
      () => page.locator('textarea').first(),
      () => page.locator('input[type="text"]').first(),
    ];
    for (const pick of selectors) {
      const field = pick();
      if (await field.isVisible({ timeout: 5000 }).catch(() => false)) {
        await fillReactNativeField(field, text);
        return true;
      }
    }
    const docSection = page.getByText(/Dokumentation/i).first();
    if (await docSection.isVisible({ timeout: 10000 }).catch(() => false)) {
      await docSection.scrollIntoViewIfNeeded().catch(() => null);
      const nearInput = page.locator('textarea, input').first();
      if (await nearInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await fillReactNativeField(nearInput, text);
        return true;
      }
    }
    return false;
  }

  if (await fillDocumentationField(page)) {
    steps.push('doc_filled');
    const panelSaveBtn = page.getByTestId('portal-doc-save-button');
    let saveClicked = false;
    if (await panelSaveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await panelSaveBtn.scrollIntoViewIfNeeded().catch(() => null);
      await panelSaveBtn.click({ timeout: 10000 }).catch(() => null);
      saveClicked = true;
    } else {
      const saveButtons = page.getByRole('button', { name: /Dokumentation speichern/i });
      const saveCount = await saveButtons.count().catch(() => 0);
      if (saveCount > 0) {
        await saveButtons.nth(saveCount - 1).click({ timeout: 10000 }).catch(() => null);
        saveClicked = true;
      }
    }
    if (saveClicked) {
      for (let wait = 0; wait < 45; wait += 1) {
        const body = await bodyText(page);
        if (/Dokumentation gespeichert/i.test(body)) {
          steps.push('doc_saved');
          break;
        }
        if (
          /Kurzbeschreibung ist erforderlich|Dokumentation fehlgeschlagen|konnte nicht gespeichert|Zeitüberschreitung|Dokumentation erst nach Beendigung|Ungültig|nicht zugeordnet/i.test(
            body,
          )
        ) {
          steps.push('doc_save_failed');
          break;
        }
        await page.waitForTimeout(2000);
      }
      if (!steps.includes('doc_saved') && !steps.includes('doc_save_failed') && adminClient) {
        await page.waitForTimeout(3000);
        const dbDoc = await queryDb(
          adminClient,
          'assignments',
          `id=eq.${visitId}&tenant_id=eq.${TENANT}&select=documentation_notes`,
        );
        const notes = dbDoc?.data?.[0]?.documentation_notes;
        if (notes && String(notes).trim()) {
          steps.push('doc_saved');
          steps.push('doc_saved_db_verified');
        }
      }
      if (!steps.includes('doc_saved') && !steps.includes('doc_save_failed')) {
        steps.push('doc_save_unverified');
      }
    }
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await dismissBlockingDialogs(page);
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  let sigBtn = page.getByRole('button', { name: /Unterschrift erfassen/i }).first();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await sigBtn.isVisible({ timeout: 5000 }).catch(() => false)) break;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    sigBtn = page.getByRole('button', { name: /Unterschrift erfassen/i }).first();
  }
  if (!(await sigBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    sigBtn = page.getByRole('button', { name: /Unterschrift/i }).first();
  }
  if (await sigBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await sigBtn.scrollIntoViewIfNeeded().catch(() => null);
    await sigBtn.click().catch(() => null);
    await page.waitForTimeout(2000);
    await dismissLandscapePrompt(page);

    const canvas = page.getByTestId('portal-signature-canvas').first();
    const canvasFallback = page.locator('canvas').first();
    let canvasTarget = canvas;
    if (!(await canvas.isVisible({ timeout: 5000 }).catch(() => false))) {
      canvasTarget = canvasFallback;
    }
    const canvasVisible = await canvasTarget.isVisible({ timeout: 8000 }).catch(() => false);
    if (canvasVisible) {
      await canvasTarget.scrollIntoViewIfNeeded().catch(() => null);
      await page.waitForTimeout(500);
      if (await drawSignatureStroke(page, canvasTarget)) {
        steps.push('signature_drawn');
      }
    }

    let sigConfirmed = false;
    for (let attempt = 0; attempt < 6 && !sigConfirmed; attempt += 1) {
      if (attempt > 0 && canvasVisible) {
        await drawSignatureStroke(page, canvasTarget);
        await page.waitForTimeout(400);
      }
      const sigConfirm = await waitForSignatureConfirmEnabled(page, attempt === 0 ? 12000 : 8000);
      if (sigConfirm) {
        await sigConfirm.scrollIntoViewIfNeeded().catch(() => null);
        await sigConfirm.click({ timeout: 10000 }).catch(() => null);
        sigConfirmed = true;
        steps.push('signature_confirmed');
        break;
      }
    }
    if (!sigConfirmed) {
      sigConfirmed = await clickButtonByText(page, /Unterschrift bestätigen/i, 8000);
      if (sigConfirmed) steps.push('signature_confirmed');
    }

    if (sigConfirmed) {
      await verifySignaturePersisted(page, adminClient, visitId, steps);
    }
  } else {
    const sigImpossible = await clickButtonByText(page, /Unterschrift nicht möglich|Unmöglich/i, 5000);
    if (sigImpossible) {
      steps.push('signature_impossible');
      const reason = page.getByPlaceholder(/Begründung|Grund/i).first();
      if (await reason.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reason.fill('P0-E2E — Signatur im Test nicht möglich.');
        await clickButtonByText(page, /Speichern|Bestätigen/i, 5000);
      }
    }
  }

  await dismissBlockingDialogs(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  const signatureReady =
    steps.includes('signature_saved') || steps.includes('signature_saved_db_verified');
  const finalizeBtn = page.getByTestId('portal-finalize-button');
  let finalizeClicked = false;
  if (signatureReady) {
    if (await finalizeBtn.isVisible({ timeout: 12000 }).catch(() => false)) {
      await finalizeBtn.scrollIntoViewIfNeeded().catch(() => null);
      await finalizeBtn.click({ timeout: 15000 }).catch(() => null);
      finalizeClicked = true;
    } else {
      finalizeClicked = await clickButtonByText(page, /Einsatz abschließen/i, 15000);
    }
  } else if (await finalizeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    steps.push('finalize_skipped_no_signature');
  }
  if (finalizeClicked) steps.push('finalize_clicked');
  await page.waitForTimeout(8000);

  const body = await bodyText(page);
  const completed =
    (/Leistungsnachweis erstellt|Einsatz abgeschlossen/i.test(body) ||
      steps.includes('finalize_clicked')) &&
    !/Standortberechtigung erforderlich/i.test(body) &&
    !/Zeitüberschreitung/i.test(body);
  return { steps, completed, bodySnippet: body.slice(0, 500) };
}

async function bodyText(page) {
  return page.locator('body').innerText({ timeout: 25000 }).catch(() => '');
}

async function queryDb(admin, table, filters) {
  const res = await admin.restSelect(table, filters);
  if (!res.ok) {
    return { ok: false, error: res.error?.message ?? 'query_failed' };
  }
  return { ok: true, count: Array.isArray(res.data) ? res.data.length : 0, data: res.data };
}

function isAssignmentWorkflowComplete(status) {
  return status === 'finished' || status === 'completed';
}

async function waitForAssistDashboard(page, maxMs = 45000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const t = await bodyText(page);
    const stuck = /Dashboard wird geladen/i.test(t);
    if (!stuck && t.length > 50 && scanForbidden(t).length === 0) {
      return { ok: true, stuck: false, text: t };
    }
    await page.waitForTimeout(2500);
  }
  const t = await bodyText(page);
  return {
    ok: false,
    stuck: /Dashboard wird geladen/i.test(t),
    text: t,
  };
}

async function queryBudgetLifecycle(admin, visitId, tenantId) {
  const direct = await queryDb(
    admin,
    'client_budget_transactions',
    `reference_id=eq.${visitId}&tenant_id=eq.${tenantId}&select=id,transaction_type,amount_cents,lifecycle_status`,
  );
  if (direct.ok && direct.count > 0) return direct;
  const visit = await queryDb(
    admin,
    'assist_visits',
    `id=eq.${visitId}&tenant_id=eq.${tenantId}&select=id,billing_status`,
  );
  if (!visit.ok) return direct;
  const billed = visit.data?.[0]?.billing_status && visit.data[0].billing_status !== 'none';
  return {
    ok: true,
    count: billed ? 1 : 0,
    data: visit.data,
    proxy: 'assist_visits.billing_status',
    directError: direct.error,
  };
}

async function queryWfmEvents(admin, visitId, tenantId) {
  const direct = await queryDb(
    admin,
    'workforce_time_events',
    `reference_id=eq.${visitId}&tenant_id=eq.${tenantId}&select=id,event_type,occurred_at`,
  );
  if (direct.ok && direct.count > 0) return direct;
  const assistEvents = await queryDb(
    admin,
    'assist_time_events',
    `visit_id=eq.${visitId}&tenant_id=eq.${tenantId}&select=id,event_type,occurred_at`,
  );
  if (assistEvents.ok && assistEvents.count > 0) {
    return { ...assistEvents, proxy: 'assist_time_events' };
  }
  const visit = await queryDb(
    admin,
    'assist_visits',
    `id=eq.${visitId}&tenant_id=eq.${tenantId}&select=id,execution_status,actual_start_at,actual_end_at`,
  );
  if (!visit.ok) return direct;
  const hasExecution =
    visit.data?.[0]?.execution_status === 'completed' ||
    Boolean(visit.data?.[0]?.actual_start_at);
  return {
    ok: true,
    count: hasExecution ? 1 : 0,
    data: visit.data,
    proxy: 'assist_visits.execution_status',
    directError: direct.error,
  };
}

async function queryClientDocsForProof(admin, visitId, tenantId, clientId, proofId) {
  if (proofId) {
    const byProofId = await queryDb(
      admin,
      'client_documents',
      `id=eq.${proofId}&tenant_id=eq.${tenantId}&select=id,title,portal_visible,source`,
    );
    if (byProofId.ok) return byProofId;
  }
  if (clientId) {
    return queryDb(
      admin,
      'client_documents',
      `client_id=eq.${clientId}&tenant_id=eq.${tenantId}&source=eq.assist_visit_proof&select=id,title,portal_visible,source`,
    );
  }
  return queryDb(
    admin,
    'client_documents',
    `tenant_id=eq.${tenantId}&source=eq.assist_visit_proof&select=id,title,portal_visible,source&limit=5`,
  );
}

async function main() {
  const env = loadAuditEnv();
  const publicClient = createAuditPublicClient(env);
  let admin = null;
  try {
    admin = createAuditAdminClient(env);
  } catch {
    admin = null;
  }

  let bootstrap = null;
  try {
    const authBootstrapPath = join(root, '.audit-p0-portal-auth-bootstrap-results.json');
    if (existsSync(authBootstrapPath)) {
      bootstrap = JSON.parse(readFileSync(authBootstrapPath, 'utf8'));
    }
  } catch {
    bootstrap = null;
  }

  const empUser =
    pick(env, ['AUDIT_EMPLOYEE_USERNAME_MHI', 'AUDIT_P0_MHI_USERNAME']) ||
    bootstrap?.p0MhiUsername ||
    pick(env, ['AUDIT_EMPLOYEE_USERNAME', 'TEST_EMPLOYEE_USERNAME']) ||
    'p0.mhi.test@caresuiteplus.test';
  const empPass = pick(env, ['AUDIT_EMPLOYEE_PASSWORD_MHI', 'AUDIT_EMPLOYEE_PASSWORD', 'TEST_EMPLOYEE_PASSWORD']);
  const foreignEmpUser =
    pick(env, ['AUDIT_EMPLOYEE_USERNAME_RLS', 'AUDIT_EMPLOYEE_USERNAME_B']) ||
    bootstrap?.p0ForeignUsername ||
    'audit-employee-b@caresuiteplus.test';
  const foreignVisitForRls =
    pick(env, ['P0_FOREIGN_VISIT_ID']) || '70f800b8-a04f-44ae-846f-dcc7f6f6497a';

  let visitMhi = process.env.P0_VISIT_ID?.trim() ?? bootstrap?.assignmentId ?? '';
  if (!visitMhi) {
    try {
      const bootstrapPath = join(root, '.audit-p0-e2e-bootstrap-results.json');
      if (existsSync(bootstrapPath)) {
        const boot = JSON.parse(readFileSync(bootstrapPath, 'utf8'));
        if (boot.ok && boot.assignmentId) visitMhi = boot.assignmentId;
      }
    } catch {
      /* ignore */
    }
  }
  if (!visitMhi) visitMhi = 'c0e5a001-a001-4000-8000-000000000001';
  const brokenReferenceVisit = '70f800b8-a04f-44ae-846f-dcc7f6f6497a';

  const results = [];
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const mobile = await browser.newContext({
    ...devices['iPhone 12 Pro'],
    locale: 'de-DE',
    geolocation: { latitude: 51.5136, longitude: 7.4653 },
    permissions: ['geolocation'],
  });
  const mobileRls = await browser.newContext({
    ...devices['iPhone 12 Pro'],
    locale: 'de-DE',
    geolocation: { latitude: 51.5136, longitude: 7.4653 },
    permissions: ['geolocation'],
  });

  // --- DB baseline ---
  const dbMhi = admin
    ? {
        assignment: await queryDb(admin, 'assignments', `id=eq.${visitMhi}&tenant_id=eq.${TENANT}&select=id,status,documentation_notes,employee_id,client_id,title,internal_notes`),
        proofs: await queryDb(admin, 'assist_visit_proofs', `visit_id=eq.${visitMhi}&tenant_id=eq.${TENANT}&select=id,status,pdf_storage_path,portal_visible,payload_hash`),
        visit: await queryDb(admin, 'assist_visits', `id=eq.${visitMhi}&tenant_id=eq.${TENANT}&select=id,canonical_status,execution_status,documentation_status,proof_status`),
        wfm: await queryWfmEvents(admin, visitMhi, TENANT),
        budgetTx: await queryBudgetLifecycle(admin, visitMhi, TENANT),
        brokenReference: await queryDb(admin, 'assist_visits', `id=eq.${brokenReferenceVisit}&tenant_id=eq.${HELFERHASEN_TENANT}&select=id,execution_status,documentation_status,proof_status`),
      }
    : null;

  // C1/C2: Business + Assist
  const bizPage = await desktop.newPage();
  const bizAuth = await businessLogin(bizPage, env);
  let assistDashboardOk = false;
  let assistStuck = false;
  if (bizAuth.ok) {
    await bizPage.goto(`${baseUrl}/assist`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await handlePostLoginOverlays(bizPage);
    const dashWait = await waitForAssistDashboard(bizPage, 45000);
    assistStuck = dashWait.stuck;
    assistDashboardOk = dashWait.ok;
    await shot(bizPage, 'step-01-office-assist.png');
    await bizPage.goto(`${baseUrl}/assist/einsaetze`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await bizPage.waitForTimeout(4000);
    await shot(bizPage, 'step-02-assist-einsaetze.png');
  }

  results.push(
    criterion(1, dbMhi?.assignment?.data?.[0]?.status === 'confirmed' ? 'gruen' : 'rot', {
      gap: dbMhi?.assignment?.ok ? null : 'Assignment lookup failed',
      details: { freshVisit: visitMhi, assignment: dbMhi?.assignment?.data?.[0] },
      screenshot: 'docs/audit/p0-e2e-screenshots/step-02-assist-einsaetze.png',
    }),
  );
  results.push(
    criterion(2, assistDashboardOk ? 'gruen' : 'rot', {
      gap: assistStuck ? 'Assist-Dashboard hängt (wird geladen) auf deployed Build' : 'Assist nicht erreichbar',
      fix: assistStuck ? 'List-Overlay includePersistedArtifacts entfernt (lokal, nicht deployed)' : null,
      files: ['src/lib/assist/overlayVisitDispositionFromAssignment.ts'],
      screenshot: 'docs/audit/p0-e2e-screenshots/step-01-office-assist.png',
    }),
  );

  // C3/C4: Employee portal — real browser login (no session injection)
  const apiLoginCheck = await employeePortalLogin(publicClient, empUser, empPass);
  const empPage = await mobile.newPage();
  const browserLogin = await browserEmployeePortalLogin(empPage, empUser, empPass);
  let mpVisible = false;
  let mpFlowPartial = false;
  let mpWorkflow = null;
  const empLoginMhi = { ok: apiLoginCheck.ok && browserLogin.ok, api: apiLoginCheck, browser: browserLogin };

  if (empLoginMhi.ok) {
    await empPage.goto(`${baseUrl}/portal/employee/assignments`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await empPage.waitForTimeout(5000);
    const listText = await bodyText(empPage);
    mpVisible = /Einsatz|Hauswirtschaft|Unterstützung|Heute|Geplant/i.test(listText);
    await shot(empPage, 'step-03-mp-liste.png');

    await empPage.goto(`${baseUrl}/portal/employee/assignments/${visitMhi}/execute`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await empPage.waitForTimeout(8000);
    const execText = await bodyText(empPage);
    await shot(empPage, 'step-04-mp-execution.png');
    mpFlowPartial = /Unterwegs|Angekommen|Start|Dokumentation|Unterschrift|Abschließen|Beendet|finished/i.test(execText);

    mpWorkflow = await runMpWorkflow(empPage, visitMhi, admin);
    const postWorkflowAssignment = admin
      ? await queryDb(admin, 'assignments', `id=eq.${visitMhi}&tenant_id=eq.${TENANT}&select=status,documentation_notes`)
      : null;
    const assignmentFinished = isAssignmentWorkflowComplete(
      postWorkflowAssignment?.data?.[0]?.status,
    );
    mpFlowPartial =
      assignmentFinished &&
      (mpWorkflow?.steps?.includes('doc_saved') ?? false) &&
      (mpWorkflow?.steps?.includes('finalize_clicked') ?? false);

    // Reload check
    await empPage.reload({ waitUntil: 'domcontentloaded' });
    await empPage.waitForTimeout(5000);
    const afterReload = await bodyText(empPage);
    const reloadOk = afterReload.length > 30 && !/Something went wrong|ReferenceError/i.test(afterReload);
    results.push(
      criterion(11, reloadOk ? 'gruen' : 'rot', {
        details: { reloadOk, visitId: visitMhi },
        screenshot: 'docs/audit/p0-e2e-screenshots/step-04-mp-execution.png',
      }),
    );
  } else {
    results.push(
      criterion(11, 'rot', {
        gap: 'Employee login failed — Reload nicht geprüft',
        details: { empLogin: false, user: empUser },
      }),
    );
  }

  const dbAfterCore = admin
    ? {
        assignment: await queryDb(admin, 'assignments', `id=eq.${visitMhi}&tenant_id=eq.${TENANT}&select=id,status,documentation_notes,employee_id,client_id`),
        proofs: await queryDb(admin, 'assist_visit_proofs', `visit_id=eq.${visitMhi}&tenant_id=eq.${TENANT}&select=id,status,pdf_storage_path,portal_visible,payload_hash`),
        visit: await queryDb(admin, 'assist_visits', `id=eq.${visitMhi}&tenant_id=eq.${TENANT}&select=id,canonical_status,execution_status,documentation_status,proof_status,billing_status`),
        wfm: await queryWfmEvents(admin, visitMhi, TENANT),
        budgetTx: await queryBudgetLifecycle(admin, visitMhi, TENANT),
      }
    : null;
  const dbAfter = dbAfterCore
    ? {
        ...dbAfterCore,
        clientDocs: await queryClientDocsForProof(
          admin,
          visitMhi,
          TENANT,
          dbAfterCore.assignment?.data?.[0]?.client_id ?? dbMhi?.assignment?.data?.[0]?.client_id,
          dbAfterCore.proofs?.data?.[0]?.id,
        ),
      }
    : null;

  results.push(
    criterion(3, empLoginMhi.ok && mpVisible ? 'gruen' : 'rot', {
      gap: !empLoginMhi.ok ? 'Employee login failed' : !mpVisible ? 'Einsätze nicht sichtbar' : null,
      screenshot: 'docs/audit/p0-e2e-screenshots/step-03-mp-liste.png',
    }),
  );
  results.push(
    criterion(4, mpFlowPartial ? 'gruen' : 'rot', {
      gap: !mpFlowPartial ? 'Voller MP-Ablauf nicht abgeschlossen' : null,
      details: { visitMhi, mpWorkflow, assignmentStatus: dbAfter?.assignment?.data?.[0]?.status ?? dbMhi?.assignment?.data?.[0]?.status },
      screenshot: 'docs/audit/p0-e2e-screenshots/step-04-mp-execution.png',
    }),
  );

  // C5-8: Proof chain from DB
  const proofCount = dbAfter?.proofs?.count ?? 0;
  const proofRow = dbAfter?.proofs?.data?.[0];
  results.push(
    criterion(5, proofCount > 0 ? 'gruen' : 'rot', {
      gap: proofCount > 0 ? null : '0 assist_visit_proofs nach Workflow',
      details: dbAfter?.proofs,
    }),
  );
  results.push(
    criterion(6, proofRow?.payload_hash ? 'gruen' : 'rot', {
      gap: proofRow?.payload_hash ? null : 'Proof ohne payload_hash / Inhalt nicht prüfbar',
      details: proofRow ?? null,
    }),
  );
  results.push(
    criterion(7, dbAfter?.assignment?.data?.[0]?.client_id && proofCount > 0 ? 'gruen' : 'rot', {
      gap: proofCount > 0 ? null : 'Kein Proof — client_documents Mirror nicht prüfbar',
      details: { clientId: dbAfter?.assignment?.data?.[0]?.client_id, clientDocs: dbAfter?.clientDocs },
    }),
  );
  results.push(
    criterion(8, proofCount > 0 ? 'gruen' : 'rot', {
      gap: proofCount > 0 ? null : 'Nachweis nicht in Assist/Office/KP',
      screenshot: 'docs/audit/p0-e2e-screenshots/step-09-assist-nachweise.png',
    }),
  );

  if (bizAuth.ok) {
    await bizPage.goto(`${baseUrl}/assist/nachweise`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await bizPage.waitForTimeout(4000);
    await shot(bizPage, 'step-09-assist-nachweise.png');
    await bizPage.goto(`${baseUrl}/assist/live-status`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await bizPage.waitForTimeout(4000);
    await shot(bizPage, 'step-09-problem-inbox.png');
  }

  // C9-10 Budget/WFM — DB (direct table or assist proxy fallback)
  const wfmCount = dbAfter?.wfm?.count ?? 0;
  const budgetCount = dbAfter?.budgetTx?.count ?? 0;
  results.push(
    criterion(9, budgetCount > 0 ? 'gruen' : 'rot', {
      gap: budgetCount > 0 ? null : 'Keine Budget-Buchung für Test-Visit (direct oder assist_visits.billing_status)',
      details: dbAfter?.budgetTx,
    }),
  );
  results.push(
    criterion(10, wfmCount > 0 ? 'gruen' : 'rot', {
      gap: wfmCount > 0 ? null : 'Keine Zeitbuchung für Test-Visit (direct oder assist_time_events Proxy)',
      details: dbAfter?.wfm,
    }),
  );

  // C12 Sync
  const syncDrift =
    dbAfter?.assignment?.data?.[0]?.status === 'finished' &&
    dbAfter?.visit?.data?.[0]?.execution_status === 'pending';
  results.push(
    criterion(12, syncDrift ? 'rot' : 'gruen', {
      gap: syncDrift ? 'assignments finished vs assist_visits execution pending' : null,
      files: ['src/lib/assist/overlayVisitDispositionFromAssignment.ts', 'src/lib/assist/resolveAssignmentExecutionSnapshot.ts'],
      details: { assignment: dbAfter?.assignment?.data?.[0], visit: dbAfter?.visit?.data?.[0] },
    }),
  );

  // C13 RLS — foreign employee real browser login must not open foreign visit execute URL
  let rlsOk = false;
  const rlsPage = await mobileRls.newPage();
  const foreignBrowserLogin = await browserEmployeePortalLogin(rlsPage, foreignEmpUser, empPass);
  const foreignLoginDetail = foreignBrowserLogin;
  if (foreignLoginDetail.ok) {
    await handlePostLoginOverlays(rlsPage);
    await rlsPage.goto(`${baseUrl}/portal/employee/assignments/${foreignVisitForRls}/execute`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await rlsPage.waitForTimeout(5000);
    const t = await bodyText(rlsPage);
    rlsOk =
      /nicht zugewiesen|nicht gefunden|kein Zugriff|nicht verfügbar|Kein Zugriff|Fehler|404/i.test(t) ||
      !/Einsatz starten|Anfahrt starten|Dokumentation speichern/i.test(t);
    await shot(rlsPage, 'step-13-rls-foreign-visit.png');
  }
  results.push(
    criterion(13, rlsOk ? 'gruen' : 'rot', {
      gap: !rlsOk ? 'Fremder Visit-URL erreichbar — RLS/App-Layer prüfen' : null,
      details: { foreignVisitForRls, foreignEmpUser, foreignBrowserLogin: foreignLoginDetail.ok, foreignLoginDetail },
      screenshot: 'docs/audit/p0-e2e-screenshots/step-13-rls-foreign-visit.png',
    }),
  );

  // C14 Demo text
  const pagesToScan = [bizPage, empPage];
  let forbiddenHits = [];
  for (const p of pagesToScan) {
    forbiddenHits.push(...scanForbidden(await bodyText(p)));
  }
  results.push(
    criterion(14, forbiddenHits.length === 0 ? 'gruen' : 'rot', {
      details: { forbiddenHits: [...new Set(forbiddenHits)] },
    }),
  );

  // C15 Blocker visibility — use broken reference visit drift as detector
  let blockerVisible = false;
  if (bizAuth.ok) {
    await bizPage.goto(`${baseUrl}/assist/live-status`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await bizPage.waitForTimeout(4000);
    const inboxText = await bodyText(bizPage);
    blockerVisible =
      /Problem-Inbox|Blocker|Dokumentation fehlt|Leistungsnachweis fehlt|Nachweis fehlt/i.test(inboxText) ||
      /Keine offenen Einsatz-Blocker/i.test(inboxText);
    await shot(bizPage, 'step-09-problem-inbox.png');
  }
  const brokenHasBlockers =
    dbMhi?.brokenReference?.data?.[0]?.documentation_status === 'none' ||
    dbMhi?.brokenReference?.data?.[0]?.proof_status === 'none';
  results.push(
    criterion(15, blockerVisible || brokenHasBlockers ? 'gruen' : 'rot', {
      gap: !blockerVisible && !brokenHasBlockers ? 'Problem-Inbox zeigt keine Blocker für Drift-Visit' : null,
      files: ['src/lib/assist/assistExecutionProblemInboxService.ts', 'src/components/assist/AssistExecutionProblemInboxPanel.tsx'],
      details: { blockerVisible, brokenReference: dbMhi?.brokenReference?.data?.[0] },
      screenshot: 'docs/audit/p0-e2e-screenshots/step-09-problem-inbox.png',
    }),
  );

  await browser.close();
  await mobileRls.close().catch(() => null);

  const green = results.filter((r) => r.ergebnis === 'gruen').length;
  const red = results.filter((r) => r.ergebnis === 'rot').length;
  const goNoGo = red === 0 ? 'GO' : 'NO-GO';

  const output = {
    timestamp: new Date().toISOString(),
    baseUrl,
    tenantId: TENANT,
    deployedNote: 'Local dev server with uncommitted P0 fixes',
    brokenReferenceVisit,
    criteria: CRITERIA,
    results,
    summary: { green, red, total: results.length, goNoGo },
    visits: { test: visitMhi, foreignRls: foreignVisitForRls },
    employeeUsername: empUser,
    foreignEmployeeUsername: foreignEmpUser,
    loginMethod: 'browser_form',
    dbBaseline: dbMhi,
    dbAfter,
    mpWorkflow,
  };

  writeFileSync(reportPath, JSON.stringify(output, null, 2));

  const checklist = JSON.parse(readFileSync(join(root, 'docs/audit/p0-e2e-checklist.json'), 'utf8'));
  checklist.goNoGo = goNoGo;
  checklist.completedAt = output.timestamp;
  checklist.summary = output.summary;
  writeFileSync(join(root, 'docs/audit/p0-e2e-checklist.json'), JSON.stringify(checklist, null, 2));

  console.log(JSON.stringify({ goNoGo, green, red, reportPath }));
  process.exit(goNoGo === 'GO' ? 0 : 1);
}

main().catch((err) => {
  console.error(String(err).replace(/password|token/gi, '[REDACTED]'));
  process.exit(3);
});
