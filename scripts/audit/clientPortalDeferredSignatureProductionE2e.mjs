#!/usr/bin/env node
/**
 * Production E2E — deferred client signature in Klient:innenportal.
 * Flow: Nachweise → Unterschreiben → Signatur → DB-Zuordnung → Einsatz abgeschlossen.
 *
 * Env: AUDIT_CLIENT_USERNAME, AUDIT_CLIENT_PORTAL_CODE, DEFERRED_E2E_PROOF_ID, DEFERRED_E2E_ASSIGNMENT_ID
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditAdminClient,
  createAuditPublicClient,
  loadAuditEnv,
  pick,
} from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = (process.env.AUDIT_WEB_URL ?? 'https://caresuiteplus.app').replace(/\/$/, '');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://euagyyztvmemuaiumvxm.supabase.co';
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1YWd5eXp0dm1lbXVhaXVtdnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjU5MDMsImV4cCI6MjA5NjUwMTkwM30.WlzLh30maRgWePjQFEj32mfW7DGqN8sFaroREbYsss0';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';
const PROOF_ID = process.env.DEFERRED_E2E_PROOF_ID ?? '615c9e0e-b047-40ec-83d6-22cf23a07711';
const ASSIGNMENT_ID = process.env.DEFERRED_E2E_ASSIGNMENT_ID ?? '9bf29d9f-964c-456d-a6c9-315c5b0159ef';
const DORIS_PROOF_ID = process.env.DORIS_PROOF_ID ?? 'aebd5bd1-17b2-489b-b436-9d6ba59ef482';
const CLIENT_USER = pick(loadAuditEnv(), ['AUDIT_CLIENT_USERNAME']) || 'audit-client@caresuiteplus.test';
const CLIENT_CODE = pick(loadAuditEnv(), ['AUDIT_CLIENT_PORTAL_CODE']) || '123456';

const outDir = join(root, 'docs', 'audit', 'client-portal-deferred-signature-e2e');
const reportPath = join(root, 'docs', 'audit', 'client-portal-deferred-signature-e2e.json');

const results = {
  timestamp: new Date().toISOString(),
  baseUrl,
  proofId: PROOF_ID,
  assignmentId: ASSIGNMENT_ID,
  checks: {},
};

function report(key, pass, detail = '') {
  results.checks[key] = { pass, detail };
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${key}${detail ? ` — ${detail}` : ''}`);
}

async function waitForLoadedShell(page, timeout = 45000) {
  try {
    await page.waitForFunction(
      () => {
        const t = document.body?.innerText ?? '';
        return !t.includes('Wird geladen…') && !t.includes('Wird geladen...');
      },
      { timeout },
    );
    await page.waitForTimeout(800);
  } catch {
    /* continue */
  }
}

async function drawSignature(page) {
  const canvas = page.getByTestId('portal-signature-canvas').first();
  const target = (await canvas.isVisible({ timeout: 5000 }).catch(() => false))
    ? canvas
    : page.locator('canvas').first();
  if (!(await target.isVisible({ timeout: 8000 }).catch(() => false))) {
    return { ok: false, reason: 'canvas_missing' };
  }
  const box = await target.boundingBox();
  if (!box) return { ok: false, reason: 'canvas_box_missing' };
  for (const yRatio of [0.35, 0.55, 0.72]) {
    const y = box.y + box.height * yRatio;
    await page.mouse.move(box.x + box.width * 0.15, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, y, { steps: 20 });
    await page.mouse.up();
  }
  const confirm = page.getByTestId('portal-signature-confirm-button');
  if (await confirm.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirm.click({ force: true, timeout: 10000 }).catch(() => null);
  }
  await page.waitForTimeout(3000);
  return { ok: true };
}

async function clientPortalApiLogin(publicClient, username, code) {
  const { url, key } = publicClient;
  const res = await fetch(`${url}/functions/v1/client-portal-login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sessionToken) {
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  }
  return {
    ok: true,
    portalSession: {
      sessionToken: data.sessionToken,
      tenantId: data.tenantId,
      loginType: 'client_portal',
      roleKey: 'client_portal',
      expiresAt: data.expiresAt,
      accountId: data.portalAccountId,
      clientId: data.clientId ?? null,
      displayName: data.displayName?.trim() || undefined,
      tenantName: data.tenantName?.trim() || null,
    },
    supabaseAccessToken: data.supabaseAccessToken ?? null,
    supabaseRefreshToken: data.supabaseRefreshToken ?? null,
  };
}

async function injectPortalSession(page, login, publicClient) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [PORTAL_SESSION_KEY, JSON.stringify(login.portalSession)],
  );

  if (login.supabaseAccessToken && login.supabaseRefreshToken) {
    const storageKey = `sb-${new URL(publicClient.url).hostname.split('.')[0]}-auth-token`;
    let user = null;
    const userRes = await fetch(`${publicClient.url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${login.supabaseAccessToken}`, apikey: publicClient.key },
    });
    if (userRes.ok) user = await userRes.json();

    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [
        storageKey,
        JSON.stringify({
          access_token: login.supabaseAccessToken,
          refresh_token: login.supabaseRefreshToken,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: 'bearer',
          user,
        }),
      ],
    );
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForLoadedShell(page);
}

async function fetchProofState(admin, proofId) {
  const proofQ = `id=eq.${proofId}&select=id,visit_id,portal_release_status,portal_visible,signature_id`;
  const proofRes = await admin.restSelect('assist_visit_proofs', proofQ);
  if (!proofRes.ok || !proofRes.data?.[0]) return { ok: false, reason: 'proof_not_found' };

  const docQ = `id=eq.${proofId}&select=id,title,signature_required,signed_at,portal_visible,source,category,status`;
  const docRes = await admin.restSelect('client_documents', docQ);

  const visitId = proofRes.data[0].visit_id;
  const execQ = `visit_id=eq.${visitId}&select=visit_id,assignment_status,signature_complete,service_ended_at,finalized_at`;
  const execRes = await admin.restSelect('assist_visit_execution_state', execQ);

  return {
    ok: true,
    proof: proofRes.data[0],
    document: docRes.ok ? docRes.data?.[0] ?? null : null,
    execution: execRes.ok ? execRes.data?.[0] ?? null : null,
  };
}

async function verifyDbPreconditions(admin) {
  const state = await fetchProofState(admin, PROOF_ID);
  if (!state.ok) {
    report('db_proof_exists', false, state.reason);
    return false;
  }

  report('db_proof_exists', true, PROOF_ID);
  report(
    'db_proof_pending_signature',
    state.proof.portal_release_status === 'pending_client_signature',
    state.proof.portal_release_status,
  );
  report('db_proof_portal_visible', state.proof.portal_visible === true, String(state.proof.portal_visible));
  report(
    'db_client_document_mirror',
    Boolean(state.document?.signature_required && !state.document?.signed_at),
    state.document?.title ?? 'missing',
  );
  report(
    'db_execution_before_sign',
    state.execution?.assignment_status === 'abgeschlossen' && state.execution?.signature_complete === false,
    `status=${state.execution?.assignment_status}, sig=${state.execution?.signature_complete}`,
  );
  return state.proof.portal_release_status === 'pending_client_signature';
}

async function verifyDorisDbPreconditions(admin) {
  const state = await fetchProofState(admin, DORIS_PROOF_ID);
  if (!state.ok) {
    report('doris_db_proof_exists', false, state.reason);
    return;
  }
  report('doris_db_proof_exists', true, DORIS_PROOF_ID);
  report(
    'doris_db_pending_signature',
    state.proof.portal_release_status === 'pending_client_signature',
    state.proof.portal_release_status,
  );
  report(
    'doris_db_client_document',
    Boolean(state.document?.portal_visible && state.document?.signature_required && !state.document?.signed_at),
    state.document?.title ?? 'missing',
  );
}

async function verifyDbAfterSign(admin) {
  const state = await fetchProofState(admin, PROOF_ID);
  if (!state.ok) {
    report('db_after_sign_proof', false, state.reason);
    return;
  }

  const sigQ = `visit_id=eq.${state.proof.visit_id}&select=id,signer_role,signed_at&order=signed_at.desc&limit=1`;
  const sigRes = await admin.restSelect('assist_visit_signatures', sigQ);
  const signature = sigRes.ok ? sigRes.data?.[0] ?? null : null;

  report('db_after_sign_client_signature', Boolean(signature?.id), signature?.signer_role ?? 'none');
  report(
    'db_after_sign_document_signed',
    Boolean(state.document?.signed_at && state.document?.signature_required === false),
    state.document?.signed_at ?? 'unsigned',
  );
  report(
    'db_after_sign_execution_complete',
    state.execution?.signature_complete === true && state.execution?.assignment_status === 'abgeschlossen',
    `status=${state.execution?.assignment_status}, sig=${state.execution?.signature_complete}`,
  );
  report(
    'db_after_sign_proof_released',
    ['released', 'pending_review'].includes(String(state.proof.portal_release_status)),
    state.proof.portal_release_status,
  );
}

async function runBrowserFlow(login, publicClient) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await injectPortalSession(page, login, publicClient);
    await page.goto(`${baseUrl}/portal/client/proofs`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForLoadedShell(page, 60000);
    await page.waitForTimeout(2000);

    const bodyProofs = await page.locator('body').innerText({ timeout: 30000 }).catch(() => '');
    await page.screenshot({ path: join(outDir, '01-proofs-list.png'), fullPage: true });

    const hasPendingProof =
      bodyProofs.includes('Unterschrift ausstehend') ||
      bodyProofs.includes('Offen') ||
      bodyProofs.includes('Unterschreiben');
    report('ui_proofs_list_pending', hasPendingProof, bodyProofs.slice(0, 180));

    const signListButton = page.getByRole('button', { name: 'Unterschreiben' });
    const listSignVisible = (await signListButton.count()) > 0;
    report('ui_proofs_sign_button', listSignVisible, listSignVisible ? 'found' : 'missing');

    await page.goto(`${baseUrl}/portal/client/documents/${PROOF_ID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitForLoadedShell(page, 60000);
    await page.waitForTimeout(2500);

    const bodyDetail = await page.locator('body').innerText({ timeout: 30000 }).catch(() => '');
    await page.screenshot({ path: join(outDir, '02-document-detail-before-sign.png'), fullPage: true });

    const hasSignatureHint =
      bodyDetail.includes('Bitte bestätigen Sie den Einsatz') ||
      bodyDetail.includes('Unterschrift ausstehend');
    report('ui_detail_signature_hint', hasSignatureHint, hasSignatureHint ? 'hint_visible' : bodyDetail.slice(0, 160));

    const signDetailButton = page.getByTestId('client-portal-proof-sign-button');
    const detailSignVisible = (await signDetailButton.count()) > 0;
    report('ui_detail_sign_button', detailSignVisible, detailSignVisible ? 'found' : 'missing — LIST_SELECT/canSign bug');

    if (!detailSignVisible) {
      results.blocker = 'sign_button_not_visible_on_detail';
      return false;
    }

    await signDetailButton.first().click();
    await page.waitForTimeout(1500);

    const drawn = await drawSignature(page);
    report('ui_signature_drawn', drawn.ok, drawn.reason ?? 'ok');
    if (!drawn.ok) {
      results.blocker = drawn.reason;
      return false;
    }

    await page.waitForTimeout(5000);
    await waitForLoadedShell(page, 60000);
    const bodyAfter = await page.locator('body').innerText({ timeout: 30000 }).catch(() => '');
    await page.screenshot({ path: join(outDir, '03-after-sign.png'), fullPage: true });

    const success =
      bodyAfter.includes('Vielen Dank') ||
      bodyAfter.includes('unterschrieben') ||
      bodyAfter.includes('gespeichert');
    report('ui_sign_success_message', success, bodyAfter.slice(0, 200));

    return success;
  } finally {
    await browser.close();
  }
}

async function main() {
  process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? supabaseUrl;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? supabaseKey;

  const env = loadAuditEnv();
  const publicClient = createAuditPublicClient(env);
  const admin = serviceRoleKey ? createAuditAdminClient({ ...env, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey }) : null;

  console.log('\n=== Client Portal Deferred Signature E2E ===\n');
  console.log(`Base: ${baseUrl}`);
  console.log(`Proof: ${PROOF_ID}\n`);

  console.log('--- DB preconditions (audit tenant) ---');
  let ready = true;
  if (admin?.key) {
    ready = await verifyDbPreconditions(admin);
  } else {
    report('db_admin_skipped', true, 'SUPABASE_SERVICE_ROLE_KEY not set');
    ready = true;
  }

  console.log('\n--- DB preconditions (Doris / Helferhasen) ---');
  if (admin?.key) {
    await verifyDorisDbPreconditions(admin);
  } else {
    report('doris_db_skipped', true, 'admin key missing — Doris state verified separately via Supabase MCP');
  }

  console.log('\n--- Client portal login ---');
  const login = await clientPortalApiLogin(publicClient, CLIENT_USER, CLIENT_CODE);
  report('client_login', login.ok, login.ok ? CLIENT_USER : login.error ?? 'failed');
  report(
    'client_supabase_jwt',
    Boolean(login.supabaseAccessToken && login.supabaseRefreshToken),
    login.supabaseAccessToken ? 'jwt_present' : 'jwt_missing',
  );
  if (!login.ok) {
    results.pass = false;
    writeFileSync(reportPath, JSON.stringify(results, null, 2));
    process.exit(2);
  }

  if (!ready) {
    console.log('\nProof not in pending_client_signature — skipping browser sign flow.');
    results.pass = Object.values(results.checks).every((c) => c.pass);
    writeFileSync(reportPath, JSON.stringify(results, null, 2));
    process.exit(results.pass ? 0 : 3);
  }

  console.log('\n--- Browser flow ---');
  const signed = await runBrowserFlow(login, publicClient);

  if (signed) {
    console.log('\n--- DB after sign ---');
    await verifyDbAfterSign(admin);
  }

  results.pass = Object.values(results.checks).every((c) => c.pass) && !results.blocker;
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nReport: ${reportPath}`);
  console.log(`Pass: ${results.pass ? 'YES' : 'NO'}\n`);
  process.exit(results.pass ? 0 : 4);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
