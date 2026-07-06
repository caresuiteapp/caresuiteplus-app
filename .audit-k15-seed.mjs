#!/usr/bin/env node
/**
 * K.1.5 — Idempotent audit seed: Signatur-Testdaten + portal-sichtbarer Leistungsnachweis.
 * Tenant: Test Pflege GmbH only (never LIVE whitelist).
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditAdminClient,
  createAuditPublicClient,
  loadAuditEnv,
  pick,
} from './scripts/audit/lib/auditSupabaseClient.mjs';

async function restUpsertAsUser(url, anonKey, userToken, table, row, onConflict) {
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${userToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text.slice(0, 240) };
  }
  return { ok: true };
}

const root = join(dirname(fileURLToPath(import.meta.url)));
const outPath = join(root, '.audit-k15-seed-results.json');

const TENANT = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const CLIENT_A = 'ec4f159f-e794-4326-8b0e-15c0166df1ea';
const LIVE_WHITELIST = ['56180c22-b894-4fab-b55e-a563c94dd6e7'];

const CS_REQUEST = 'c0e5e001-e001-4000-8000-000000000001';
const CS_SIG_CLIENT = 'c0e5e002-e002-4000-8000-000000000001';
const PROOF_ASSIST = 'c0e50003-0003-4000-8000-000000000003';
const PROOF_DOC = PROOF_ASSIST;
const VISIT_TODAY = 'c0e50001-0001-4000-8000-000000000001';

async function main() {
  const env = loadAuditEnv();
  const admin = createAuditAdminClient(env);
  const result = { ok: false, tenantId: TENANT, clientId: CLIENT_A, steps: [] };

  if (LIVE_WHITELIST.includes(TENANT)) {
    result.reason = 'tenant_is_live_whitelist';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    process.exit(3);
  }

  if (!admin.url || !admin.key) {
    result.reason = 'missing_service_role';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    process.exit(2);
  }

  const baseSeed = spawnSync(process.execPath, [join(root, 'scripts/audit/contentPortalE2eSeed.mjs')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
  });
  result.steps.push({
    step: 'content_portal_e2e_seed',
    ok: baseSeed.status === 0,
    detail: baseSeed.status === 0 ? 'ok' : (baseSeed.stderr || baseSeed.stdout || '').slice(0, 240),
  });

  const nowIso = new Date().toISOString();

  const tenantDefaults = await admin.restUpsert(
    'tenant_client_portal_defaults',
    {
      tenant_id: TENANT,
      portal_enabled: true,
      show_proofs: true,
      show_documents: true,
      show_messages: true,
      show_appointments: true,
    },
    'tenant_id',
  );
  result.steps.push({
    step: 'tenant_portal_defaults_proofs',
    ok: tenantDefaults.ok,
    optional: true,
    detail: tenantDefaults.ok ? 'show_proofs=true' : 'skipped_permission_denied',
  });

  const portalSettings = await admin.restUpsert(
    'client_portal_settings',
    {
      tenant_id: TENANT,
      client_id: CLIENT_A,
      portal_enabled: true,
      inherit_tenant_defaults: false,
      show_proofs: true,
      show_documents: true,
      show_messages: true,
      show_appointments: true,
    },
    'tenant_id,client_id',
  );
  result.steps.push({
    step: 'portal_settings_proofs',
    ok: portalSettings.ok,
    detail: portalSettings.ok ? 'show_proofs=true' : JSON.stringify(portalSettings.error ?? '').slice(0, 200),
  });

  const csRequest = await admin.restUpsert(
    'cs_document_requests',
    {
      id: CS_REQUEST,
      owner_tenant_id: TENANT,
      title: 'E2E Einwilligung Klient:innenportal',
      recipient_scope: 'client',
      client_id: CLIENT_A,
      priority: 'normal',
      status: 'sent',
      portal_visible: true,
      source_template_key: 'client_consent_portal',
      rendered_html:
        '<h1>E2E Einwilligung</h1><p>Bitte unterschreiben Sie dieses Testdokument für die K.1.5 Abnahme.</p>',
      context_snapshot: { clientName: 'Erika Mustermann', auditSeed: 'k15' },
      updated_at: nowIso,
    },
    'id',
  );
  result.steps.push({
    step: 'cs_document_request',
    ok: csRequest.ok,
    id: CS_REQUEST,
    detail: csRequest.ok ? 'sent' : JSON.stringify(csRequest.error ?? '').slice(0, 200),
  });

  const csSig = await admin.restUpsert(
    'cs_document_request_signatures',
    {
      id: CS_SIG_CLIENT,
      request_id: CS_REQUEST,
      signer_role: 'client',
      signer_name: 'Erika Mustermann',
      status: 'pending',
      updated_at: nowIso,
    },
    'id',
  );
  result.steps.push({
    step: 'cs_document_signature_pending',
    ok: csSig.ok,
    detail: csSig.ok ? 'client_pending' : JSON.stringify(csSig.error ?? '').slice(0, 200),
  });

  const assistProof = await admin.restUpsert(
    'assist_visit_proofs',
    {
      id: PROOF_ASSIST,
      tenant_id: TENANT,
      visit_id: VISIT_TODAY,
      status: 'approved',
      portal_visible: true,
      portal_release_status: 'released',
      released_to_portal_at: nowIso,
      proof_number: 'E2E-K15-001',
      payload_snapshot: {
        title: 'E2E Leistungsnachweis K.1.5',
        clientName: 'Erika Mustermann',
        note: 'E2E portal proof K.1.5',
        auditSeed: true,
      },
      pdf_storage_path: 'audit/content-portal/e2e-k15-proof.pdf',
      storage_path: 'audit/content-portal/pending-proof.json',
      updated_at: nowIso,
    },
    'id',
  );
  result.steps.push({
    step: 'assist_visit_proof_portal',
    ok: assistProof.ok,
    id: PROOF_ASSIST,
    detail: assistProof.ok ? 'portal_visible_released' : JSON.stringify(assistProof.error ?? '').slice(0, 200),
  });

  const publicClient = createAuditPublicClient(env);
  const businessEmail = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL']);
  const businessPassword = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']);
  let businessToken = null;
  if (publicClient.url && publicClient.key && businessEmail && businessPassword) {
    const auth = await publicClient.passwordLogin(businessEmail, businessPassword);
    businessToken = auth.ok ? auth.token : null;
    result.steps.push({
      step: 'business_login_for_proof_mirror',
      ok: auth.ok,
      detail: auth.ok ? 'ok' : JSON.stringify(auth.error ?? '').slice(0, 120),
    });
  } else {
    result.steps.push({
      step: 'business_login_for_proof_mirror',
      ok: false,
      detail: 'missing_business_creds',
    });
  }

  if (businessToken) {
    const proofDoc = await restUpsertAsUser(
      publicClient.url,
      publicClient.key,
      businessToken,
      'client_documents',
      {
        id: PROOF_DOC,
        tenant_id: TENANT,
        client_id: CLIENT_A,
        title: 'E2E Leistungsnachweis K.1.5',
        file_name: 'Leistungsnachweis-E2E-K15-001.pdf',
        mime_type: 'application/pdf',
        category: 'leistungsnachweis',
        storage_path: 'audit/content-portal/e2e-k15-proof.pdf',
        status: 'aktiv',
        sensitivity: 'care',
        portal_visible: true,
        source: 'assist_visit_proof',
        updated_at: nowIso,
      },
      'id',
    );
    result.steps.push({
      step: 'client_documents_proof_mirror',
      ok: proofDoc.ok,
      id: PROOF_DOC,
      detail: proofDoc.ok ? 'portal_visible_leistungsnachweis' : proofDoc.error,
    });
  } else {
    result.steps.push({
      step: 'client_documents_proof_mirror',
      ok: false,
      detail: 'skipped_no_business_token',
    });
  }

  result.ids = {
    csRequest: CS_REQUEST,
    csSignature: CS_SIG_CLIENT,
    assistProof: PROOF_ASSIST,
    proofDocument: PROOF_DOC,
  };
  result.ok = result.steps.every((s) => s.ok || s.optional);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
