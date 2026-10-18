import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Architecture/security contracts. This runs without database writes and does
// not substitute for PostgreSQL execution or authenticated end-to-end evidence.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(resolve(root, 'scripts/sql/office-einvoice-workspace.sql'), 'utf8');
const baseline = readFileSync(resolve(root, 'scripts/sql/office-invoice-workspace.sql'), 'utf8');
const parse = text => new Map([...text.matchAll(/CREATE OR REPLACE FUNCTION\s+([\w.]+)\(([\s\S]*?)\)\s*\n(RETURNS[\s\S]*?)AS \$body\$([\s\S]*?)\$body\$;/g)]
  .map(match => [match[1], { signature: match[2], declaration: match[3], body: match[4] }]));
const definitions = parse(sql);
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const fn = name => { const value = definitions.get(name); assert.ok(value, `Missing function ${name}`); return value; };
check(sql.includes('\nBEGIN;') && /COMMIT;\s*$/.test(sql), 'The migration must commit atomically.');
const migrationDir = resolve(root, 'supabase/migrations');
const migrations = existsSync(migrationDir) ? readdirSync(migrationDir).filter(name => name.endsWith('_office_einvoice_workspace.sql')) : [];
if (process.argv.includes('--require-migration')) check(migrations.length === 1, 'A single generated deployment migration must be present.');
for (const file of migrations) check(readFileSync(resolve(migrationDir, file), 'utf8') === sql, 'The reviewed SQL and generated migration must match exactly.');

for (const name of ['office_einvoice_documents', 'office_einvoice_requests', 'office_einvoice_events', 'office_einvoice_validations']) {
  check(sql.includes(`ALTER TABLE care_security.${name} ENABLE ROW LEVEL SECURITY;`), `${name} requires defense-in-depth RLS.`);
  check(new RegExp(`REVOKE ALL ON [^;]*care_security\\.${name}[^;]* FROM PUBLIC,anon,authenticated;`).test(sql), `${name} must not be accessible to clients.`);
  check(!new RegExp(`GRANT [^;]* ON [^;]*care_security\\.${name}[^;]* TO authenticated`).test(sql), `${name} must not receive client table grants.`);
}
for (const name of ['office_einvoice_inbox_read', 'office_einvoice_inbox_mutation', 'office_einvoice_artifact_read']) {
  const pub = fn(`public.${name}`), impl = fn(`care_security.${name}`);
  check(/SECURITY INVOKER/.test(pub.declaration), `${name} must expose only an invoker.`);
  check(/auth\.uid\(\) IS NULL/.test(impl.body) && /p_tenant_id IS DISTINCT FROM public\.current_tenant_id\(\)/.test(impl.body), `${name} must bind the session tenant.`);
  check(/current_portal_type\(\)/.test(impl.body) && /office_actor\(p_tenant_id,'office\.invoices\.view'\)/.test(impl.body), `${name} must reject portal roles and require invoice read permission.`);
  for (const scope of ['public', 'care_security']) {
    check(new RegExp(`REVOKE ALL ON FUNCTION ${scope}\\.${name}\\([^;]+\\) FROM PUBLIC,anon;`).test(sql), `${scope}.${name} must deny anonymous execution.`);
    check(new RegExp(`GRANT EXECUTE ON FUNCTION ${scope}\\.${name}\\([^;]+\\) TO authenticated;`).test(sql), `${scope}.${name} must explicitly grant its authenticated API.`);
  }
}
for (const name of ['office_einvoice_record_validation', 'office_einvoice_inbox_validation']) {
  for (const scope of ['public', 'care_security']) {
    check(/SECURITY INVOKER/.test(fn(`${scope}.${name}`).declaration), `${scope}.${name} must not elevate privileges.`);
    check(new RegExp(`REVOKE ALL ON FUNCTION ${scope}\\.${name}\\([^;]+\\) FROM PUBLIC,anon,authenticated;`).test(sql), `${scope}.${name} must reject all client callers.`);
    check(new RegExp(`GRANT EXECUTE ON FUNCTION ${scope}\\.${name}\\([^;]+\\) TO service_role;`).test(sql), `${scope}.${name} must be server-only.`);
  }
  check(/office_einvoice_server_actor\(p_tenant_id,p_actor_id,'office\.invoices\.view'\)/.test(fn(`care_security.${name}`).body), `${name} must independently bind its actor.`);
}
for (const [name, definition] of definitions) check(/SET search_path=pg_catalog/.test(definition.declaration), `${name} needs a fixed search path.`);
const actor = fn('care_security.office_einvoice_server_actor').body;
check(actor.includes("auth.jwt()->>'role'='service_role'") && actor.includes('p.auth_user_id=p_actor_id'), 'Trusted actor binding must use the actual Auth ID and service JWT.');
check(actor.includes("lower(r.key) NOT IN ('employee_portal'") && actor.includes('rp.permission_key=p_permission'), 'Service actor checks must preserve business role and permission restrictions.');
check(!/user_metadata|set_config|set local role/i.test(sql), 'Clients must never gain authority through editable claims or role impersonation.');

const intake = fn('care_security.office_einvoice_inbox_mutation').body;
check(intake.includes("THEN 'office.invoices.create' ELSE 'office.invoices.status_change'"), 'Import and factual review require separate permissions.');
check(intake.includes('v_request.actor_id IS DISTINCT FROM auth.uid()') && intake.includes('v_request.request_hash IS DISTINCT FROM v_hash'), 'Retry identity must bind actor and complete operation payload.');
check(intake.includes("'office-einvoice-request:'") && intake.includes("'office-einvoice-original:'"), 'Requests and duplicate bytes must serialize separately.');
check(intake.includes("extensions.digest(v_original,'sha256')") && intake.includes("v_original_hash IS DISTINCT FROM p_payload->>'original_sha256'"), 'The server must hash the stored bytes independently.');
check(intake.includes('octet_length(v_original) NOT BETWEEN 1 AND 10485760') && intake.includes('octet_length(v_xml) NOT BETWEEN 1 AND 5242880'), 'Original and extracted XML limits must be enforced server-side.');
check(intake.includes('v_xml:=v_original') && intake.includes("decode(p_payload->>'extracted_xml_base64','base64') IS DISTINCT FROM v_xml"), 'Standalone XML must retain identical original bytes.');
check(intake.includes('v_document.updated_at IS DISTINCT FROM p_expected_updated_at'), 'Factual reviews must reject stale updates.');
check(!/SET format_status|SET inspection|SET original_bytes/.test(intake), 'Clients must not mutate originals, parsing results, or trusted validation status.');
check(intake.includes("'unreviewed','reviewed','rejected'") && !intake.includes("'approved'"), 'Factual review must not be labeled as format approval.');
const read = fn('care_security.office_einvoice_inbox_read').body;
check(read.includes('(p_include_original AND p_document_id IS NULL)'), 'Bulk list requests must not return original byte bodies.');
check(read.includes("encode(v_document.original_bytes,'base64')"), 'Downloads must return preserved bytes, not regenerated output.');
check(!/original_base64|original_bytes.*encode|encode\(/.test(fn('care_security.office_einvoice_metadata').body), 'Metadata must not contain base64 originals.');
const originalGuard = fn('care_security.office_einvoice_original_guard').body;
check(originalGuard.includes("IF TG_OP='DELETE'") && originalGuard.includes('OLD.original_bytes') && originalGuard.includes('OLD.extracted_xml_bytes'), 'Archive guards must prevent original replacement and deletion.');
check(originalGuard.includes("AND current_user<>'service_role'"), 'Only the trusted service may change format results.');

const report = fn('care_security.office_einvoice_check_report').body;
check(report.includes("p_report->>'documentSha256' IS DISTINCT FROM p_xml_sha256"), 'Reports must cover exactly the archived XML bytes.');
for (const evidence of ['libxml2-wasm+saxon-js', '0.7.2+2.7.0', '2026-08-31', 'en16931-1.3.16', 'xrechnung-2.6.0', 'syntax', 'xsd', 'business_rules']) check(report.includes(evidence), `Validation requires pinned ${evidence} evidence.`);
check(report.includes("p_report->>'source' IS DISTINCT FROM 'server'") && report.includes("f->>'severity'='error'"), 'Successful receipts must have server provenance and no errors.');
check(report.includes("p_report->>'standard'='xrechnung_3.0'") && report.includes("jsonb_array_length(p_report->'checks')<>3"), 'A success label alone cannot authorize issuance.');
check(report.includes("ELSIF NOT p_require_valid AND p_report->>'standard'='en16931'") && report.includes("p_report->>'scope' IS DISTINCT FROM 'structured_xml'"), 'Incoming EN 16931 validation must be separate from XRechnung issuance and full PDF/A claims.');
const receipt = fn('care_security.office_einvoice_record_validation').body;
check(receipt.includes("extensions.digest(v_xml,'sha256')") && receipt.includes('office_einvoice_check_report(p_report,v_hash,true)'), 'The service receipt must independently bind bytes to the complete successful report.');
check(receipt.includes('v_invoice.updated_at IS DISTINCT FROM p_expected_updated_at') && receipt.includes("v_invoice.status<>'draft'"), 'A service receipt cannot be attached to a stale or issued invoice.');
check(!/UPDATE public\.invoices/.test(receipt), 'Validation must not change the draft revision before finalization.');
const validation = fn('care_security.office_einvoice_inbox_validation').body;
check(validation.includes('v_document.original_sha256 IS DISTINCT FROM p_original_sha256') && validation.includes('office_einvoice_check_report(p_report,v_document.extracted_xml_sha256,false)'), 'Incoming reports must bind both original identity and stored extracted XML.');
check(!validation.includes('p_xml_base64') && !/SET business_status/.test(validation), 'Incoming validation cannot replace original bytes or approve the invoice factually.');
const issueGuard = fn('care_security.office_einvoice_issue_guard').body;
check(issueGuard.includes('v.source_revision=md5(NEW.issued_snapshot::text)') && issueGuard.includes('v.xml_sha256=NEW.e_invoice_xml_sha256'), 'Issuance guard must check the immutable receipt against the frozen snapshot and artifact.');
check(issueGuard.includes('OLD.issued_at IS NOT NULL') && issueGuard.includes('OLD.e_invoice_validation_id'), 'Issued metadata and artifact references must remain immutable.');
const mutation = fn('care_security.office_invoice_mutation').body;
const issuePreview = fn('care_security.office_invoice_issue_preview').body;
check(issuePreview.includes("AND nullif(btrim(e_invoice_tax->>'exemptionReason'),'') IS NULL") && issuePreview.includes("AND nullif(btrim(e_invoice_tax->>'exemptionReasonCode'),'') IS NULL") && issuePreview.includes("AND nullif(btrim(v_invoice.footer_text),'') IS NULL"), 'Every zero-VAT position needs a reason, reason code, or the legacy shared footer.');
check(mutation.includes('expected_updated_at=p_expected_updated_at') && mutation.includes("source_revision=v_preview->>'source_revision'") && mutation.includes("invoice_number=v_preview->>'invoice_number'"), 'Finalization must use an exact current revision/number receipt.');
check(mutation.indexOf('SELECT * INTO v_einvoice_validation') < mutation.indexOf('UPDATE public.tenant_billing_settings SET next_invoice_number='), 'Invalid validation must fail before allocating a final number.');
check(mutation.includes('e_invoice_xml_sha256=v_einvoice_validation.xml_sha256,e_invoice_validation_id=v_einvoice_validation.id'), 'PDF, XML, snapshot and number must finalize in the existing atomic transaction.');
check(mutation.includes("ELSE coalesce(v_invoice.e_invoice_metadata,'{}'::jsonb)") && mutation.includes("IF NOT v_line ? 'e_invoice_tax'"), 'Older callers must not silently strip saved metadata.');
check(mutation.includes('office_einvoice_check_metadata(') && mutation.includes("v_line->'e_invoice_tax'"), 'Header and line metadata must persist atomically with ordinary draft fields.');
const artifact = fn('care_security.office_einvoice_artifact_read').body;
check(artifact.includes('v_invoice.issued_at IS NULL') && artifact.includes('id=v_invoice.e_invoice_validation_id') && artifact.includes("encode(v_validation.xml_bytes,'base64')"), 'Only exact issued XML originals may be downloaded through the issue archive API.');

// Existing financial protections must survive this additive replacement.
const oldMutation = parse(baseline).get('care_security.office_invoice_mutation').body;
for (const marker of [
  'v_request.actor_id IS DISTINCT FROM auth.uid()', 'v_request.request_hash IS DISTINCT FROM v_hash',
  'v_invoice.updated_at IS DISTINCT FROM p_expected_updated_at', 'care_security.office_invoice_assert_source(v_source,true)',
  "p_payload->>'source_revision' IS DISTINCT FROM v_preview->>'source_revision'", 'care_security.office_invoice_proofs(v_invoice)',
  "'document_render_jobs'", 'v_paid*100+v_amount>v_invoice.total_amount*100',
]) {
  if (oldMutation.includes(marker)) check(mutation.includes(marker), `The existing invoice protection must remain: ${marker}`);
}
check(!/CREATE (?:OR REPLACE )?POLICY|ALTER TABLE storage\.|UPDATE storage\.buckets/.test(sql), 'The private byte archive must not weaken shared Storage or existing table policies.');
console.log(`[office-einvoice-sql] ${checks} security/lifecycle contracts passed. These are structural checks, not database execution tests.`);
