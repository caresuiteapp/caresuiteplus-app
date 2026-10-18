import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Architecture/security contracts only. This deliberately does not claim to
// execute PostgreSQL or verify runtime transaction behaviour.
const sourcePath = process.argv[2] || fileURLToPath(new URL('./sql/office-invoice-workspace.sql', import.meta.url));
const sql = readFileSync(sourcePath, 'utf8');
const definitions = new Map([...sql.matchAll(/CREATE OR REPLACE FUNCTION\s+([\w.]+)\(([\s\S]*?)\)\s*\n(RETURNS[\s\S]*?)AS \$body\$([\s\S]*?)\$body\$;/g)]
  .map(match => [match[1], { signature: match[2], declaration: match[3], body: match[4] }]));
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };
check(sql === readFileSync(fileURLToPath(new URL('../supabase/migrations/20261018075737_office_invoice_workspace.sql', import.meta.url)), 'utf8'), 'Reviewed SQL must match the applied migration exactly.');
const fn = name => { const value = definitions.get(name); assert.ok(value, `Missing function ${name}`); return value; };
check(/^\s*--[\s\S]*?\nBEGIN;/.test(sql) && /COMMIT;\s*$/.test(sql), 'Migration must remain one transaction.');
for (const name of ['office_invoice_mutation', 'office_invoice_issue_preview']) {
  const publicFunction = fn(`public.${name}`), privateFunction = fn(`care_security.${name}`);
  check(/SECURITY INVOKER/.test(publicFunction.declaration), `${name} public API must be an invoker.`);
  check(/SELECT care_security\./.test(publicFunction.body), `${name} public API must delegate to its scoped implementation.`);
  check(/SET search_path=pg_catalog/.test(publicFunction.declaration) && /SET search_path=pg_catalog/.test(privateFunction.declaration), `${name} must use a fixed search path.`);
  check(/auth\.uid\(\) IS NULL/.test(privateFunction.body) && /p_tenant_id IS DISTINCT FROM public\.current_tenant_id\(\)/.test(privateFunction.body), `${name} must verify authentication and tenant.`);
  check(/current_portal_type\(\)/.test(privateFunction.body) && /'business'/.test(privateFunction.body), `${name} must reject portal sessions.`);
  check(/office_actor\(p_tenant_id,'office\.invoices\.view'\)/.test(privateFunction.body), `${name} must require invoice read permission.`);
  for (const scope of ['public', 'care_security']) {
    const escaped = `${scope}\\.${name}\\([^;]+\\)`;
    check(new RegExp(`REVOKE ALL ON FUNCTION ${escaped} FROM PUBLIC,anon;`).test(sql), `${scope}.${name} must revoke anonymous/public execution.`);
    check(new RegExp(`GRANT EXECUTE ON FUNCTION ${escaped} TO authenticated;`).test(sql), `${scope}.${name} must grant only the authenticated API.`);
  }
}
const mutation = fn('care_security.office_invoice_mutation').body;
const preview = fn('care_security.office_invoice_issue_preview');
check(/VOLATILE/.test(preview.declaration), 'Issue preview must see current rows after a lock wait.');
check(/p_operation='save_draft' THEN 'office\.invoices\.create' ELSE 'office\.invoices\.status_change'/.test(mutation), 'Mutations must use the operation-specific permission.');
check(/v_request\.actor_id IS DISTINCT FROM auth\.uid\(\)/.test(mutation) && /v_request\.request_hash IS DISTINCT FROM v_hash/.test(mutation), 'Idempotency must bind both actor and complete request.');
check(/pg_advisory_xact_lock[\s\S]*office-invoice-request/.test(mutation), 'Retry requests must serialize.');
check(/v_invoice\.updated_at IS DISTINCT FROM p_expected_updated_at/.test(mutation), 'Every existing invoice mutation needs optimistic concurrency.');
check(/'DRAFT-'\|\|v_id/.test(mutation) && !/generate_invoice_number/.test(sql), 'Saving drafts must not allocate final invoice numbers.');
check(/round\(v_quantity,2\)<>v_quantity/.test(mutation) && /trunc\(v_price\)<>v_price/.test(mutation), 'Quantity scale and integer cents must match storage precision.');
check(/v_net:=round\(v_quantity\*v_price\);v_tax:=round\(v_net\*v_rate\/100\)/.test(mutation), 'Persisted totals must be calculated by the server.');
check(/v_source\.updated_at IS DISTINCT FROM \(v_line->>'source_updated_at'\)::timestamptz/.test(mutation), 'Source revisions must be verified.');
check(/v_source\.billed_invoice_id<>v_id/.test(mutation) && /i\.invoice_id<>v_id AND parent\.status::text<>'cancelled'/.test(mutation), 'Source ownership must check both claim and existing invoice lines.');
check(/office_invoice_assert_source\(v_source,true\)/.test(mutation) && /office_invoice_assert_source\(v_source,true\)/.test(preview.body), 'Real source evidence must be validated on save and issuance.');
check(/\('record:'\|\|id\)=ANY\(v_proofs\)/.test(mutation), 'Proof-only attachments must participate in source locks.');
check(/p_payload->>'source_revision' IS DISTINCT FROM v_preview->>'source_revision'/.test(mutation) && /p_payload->'company_snapshot' IS DISTINCT FROM v_preview->'company_snapshot'/.test(mutation), 'Finalization must verify the preview and company snapshot.');
check(/related_entity_table='invoices'/.test(mutation) && /job_status='completed'/.test(mutation) && /created_by=v_actor/.test(mutation), 'Finalization must require the authenticated completed PDF upload.');
const archiveCheck = mutation.indexOf('Die fertige Rechnungs-PDF');
const counterUpdate = mutation.indexOf('UPDATE public.tenant_billing_settings SET next_invoice_number');
const issueUpdate = mutation.indexOf("UPDATE public.invoices SET status='ready'");
check(archiveCheck > 0 && counterUpdate > archiveCheck && issueUpdate > counterUpdate, 'Final number and issue state must commit only after archive checks.');
check(/delivery_reference/.test(mutation) && /delivery_evidence=jsonb_build_object/.test(mutation), 'Sent status requires retained delivery evidence.');
check(/INSERT INTO public.payments/.test(mutation) && /sum\(amount\)/.test(mutation) && /status::text IN \('booked','matched'\)/.test(mutation), 'Payment state must derive from the payment ledger.');
check(/v_paid\*100\+v_amount>v_invoice\.total_amount\*100/.test(mutation), 'Overpayments must not silently become paid invoices.');
for (const table of ['office_invoice_requests', 'office_invoice_write_context']) {
  check(sql.includes(`ALTER TABLE care_security.${table} ENABLE ROW LEVEL SECURITY;`), `Private ${table} must retain RLS.`);
}
check(/REVOKE ALL ON care_security\.office_invoice_requests, care_security\.office_invoice_write_context FROM PUBLIC, anon, authenticated/.test(sql), 'Clients must not forge retry rows or write capabilities.');
for (const table of ['invoices', 'invoice_items', 'payments', 'service_records']) {
  check(new RegExp(`CREATE TRIGGER office_invoice_[a-z_]+ BEFORE INSERT OR UPDATE OR DELETE ON public\\.${table}`).test(sql), `${table} requires its managed lifecycle guard.`);
}
check(/NOT office_managed OR/.test(sql) && /CREATE POLICY office_invoice_workspace_read/.test(sql), 'Managed read ceilings must preserve legacy records.');
check(/i\.office_managed AND i\.pdf_file_path=name/.test(sql), 'Storage access must reference the exact archived invoice PDF.');
check(/public\.payroll_month_statements/.test(sql) && /care_security\.generated_pdf_reader\(name\)/.test(sql), 'Existing document/payroll read exceptions must remain.');
console.log(`[office-invoice-sql] ${checks} structural security contracts passed (not a PostgreSQL runtime test).`);
