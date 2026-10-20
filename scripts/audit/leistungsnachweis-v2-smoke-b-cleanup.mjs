#!/usr/bin/env node
/**
 * Smoke B cleanup — restore draft proof payload_snapshot.tasks to pre-smoke state.
 * Does NOT touch signature, visitTimes, pdf_storage_path, or status.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAuditEnv, pick } from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROOF_ID = '5a7a0a56-6f24-402c-b74e-e4eb199462f1';
const VISIT_ID = '678696dc-0568-4501-aa09-22305f2fa372';
const reportPath = join(root, 'docs/audit/leistungsnachweis-v2/smoke-b-cleanup-results.json');

function loadEnv() {
  const env = loadAuditEnv();
  for (const f of ['.env.local', '.env']) {
    const p = join(root, f);
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

async function rest(env, path, opts = {}) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = pick(env, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY']);
  return fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer ?? 'return=representation',
      ...(opts.headers ?? {}),
    },
  });
}

function snapshotFingerprint(snapshot) {
  if (!snapshot) return {};
  return {
    taskCount: Array.isArray(snapshot.tasks) ? snapshot.tasks.length : 0,
    taskTitles: Array.isArray(snapshot.tasks) ? snapshot.tasks.map((t) => t?.title).filter(Boolean) : [],
    signedAt: snapshot.signedAt ?? snapshot.signature?.signedAt ?? null,
    signerName: snapshot.signerName ?? snapshot.signature?.signerName ?? null,
    visitTimesHash: JSON.stringify(snapshot.visitTimes ?? null),
    documentation: snapshot.documentation ?? null,
    documentationNote: snapshot.documentationNote ?? null,
    statusFields: {
      clientName: snapshot.clientName,
      serviceName: snapshot.serviceName,
    },
  };
}

async function fetchProof(env) {
  const res = await rest(
    env,
    `assist_visit_proofs?id=eq.${PROOF_ID}&select=id,visit_id,status,payload_snapshot,pdf_storage_path,pdf_hash,signature_id,created_at,updated_at`,
  );
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function main() {
  const env = loadEnv();
  const dryRun = process.argv.includes('--dry-run');
  const report = { generatedAt: new Date().toISOString(), proofId: PROOF_ID, visitId: VISIT_ID, dryRun };

  const before = await fetchProof(env);
  if (!before) throw new Error('proof not found');
  if (before.visit_id !== VISIT_ID) throw new Error('visit_id mismatch');
  if (before.status !== 'draft') throw new Error(`unexpected status: ${before.status}`);

  report.before = {
    status: before.status,
    pdfStoragePath: before.pdf_storage_path,
    pdfHash: before.pdf_hash,
    signatureId: before.signature_id,
    fingerprint: snapshotFingerprint(before.payload_snapshot),
  };

  const snapshot = { ...(before.payload_snapshot ?? {}) };
  snapshot.tasks = [];

  report.cleanupVariant = 'B';
  report.cleanupReason =
    'Audit-Entwurf hatte vor Smoke B nachweislich tasks: [] (siehe proof-inventory / pre-smoke scan). Nur Test-Tasks entfernt.';

  report.afterPlanned = {
    taskCount: 0,
    preserved: {
      signedAt: snapshot.signedAt ?? snapshot.signature?.signedAt,
      signerName: snapshot.signerName ?? snapshot.signature?.signerName,
      visitTimes: snapshot.visitTimes ? 'present' : null,
      pdfStoragePath: before.pdf_storage_path,
    },
  };

  if (!dryRun) {
    const patch = await rest(env, `assist_visit_proofs?id=eq.${PROOF_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ payload_snapshot: snapshot }),
    });
    report.patchStatus = patch.status;
    if (!patch.ok) {
      report.patchError = await patch.text();
      throw new Error(`patch failed: ${patch.status}`);
    }
  }

  const after = dryRun ? { ...before, payload_snapshot: snapshot } : await fetchProof(env);
  report.after = {
    status: after.status,
    pdfStoragePath: after.pdf_storage_path,
    pdfHash: after.pdf_hash,
    signatureId: after.signature_id,
    fingerprint: snapshotFingerprint(after.payload_snapshot),
  };

  report.verification = {
    signatureUnchanged:
      report.before.fingerprint.signedAt === report.after.fingerprint.signedAt &&
      report.before.fingerprint.signerName === report.after.fingerprint.signerName,
    visitTimesUnchanged: report.before.fingerprint.visitTimesHash === report.after.fingerprint.visitTimesHash,
    statusUnchanged: report.before.status === report.after.status,
    pdfArtifactUnchanged:
      report.before.pdfStoragePath === report.after.pdfStoragePath &&
      report.before.pdfHash === report.after.pdfHash,
    tasksCleared: report.after.fingerprint.taskCount === 0,
  };
  report.passAll = Object.values(report.verification).every(Boolean);

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passAll: report.passAll, verification: report.verification, dryRun }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
