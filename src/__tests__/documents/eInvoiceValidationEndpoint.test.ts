import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createEInvoiceValidationHandler } from '../../../supabase/functions/_shared/eInvoiceValidationHandler';
import type { PdfClient } from '../../../supabase/functions/_shared/pdfUploadHandler';

const tenant = '10000000-0000-4000-8000-000000000001';
const invoiceId = '20000000-0000-4000-8000-000000000002';
const userId = '30000000-0000-4000-8000-000000000003';
const profileId = '40000000-0000-4000-8000-000000000004';
const updatedAt = '2026-10-18T08:00:00Z';
const sourceRevision = 'a'.repeat(32);
const invoiceNumber = 'RE-2026-0001';
const xml = new TextEncoder().encode('<Invoice>checked bytes</Invoice>');
const digest = createHash('sha256').update(xml).digest('hex');
const originalDigest = 'c'.repeat(64);
const payload = () => ({ action: 'validate_einvoice_issue', tenantId: tenant, invoiceId, expectedUpdatedAt: updatedAt, sourceRevision, invoiceNumber });
const report = () => ({ schemaVersion: 1, status: 'valid', documentSha256: digest, source: 'server', syntax: 'ubl_invoice', standard: 'xrechnung_3.0',
  profileId: 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0', engine: { name: 'libxml2-wasm+saxon-js', version: '0.7.2+2.7.0' },
  ruleSet: { name: 'KoSIT XRechnung', version: '2026-08-31', sha256: 'd'.repeat(64) }, businessRuleSets: ['en16931-1.3.16', 'xrechnung-2.6.0'],
  checks: [{ kind: 'syntax', status: 'passed' }, { kind: 'xsd', status: 'passed' }, { kind: 'business_rules', status: 'passed' }], findings: [], checkedAt: updatedAt });
function harness() {
  const calls: Array<{ scope: string; name: string; args: Record<string, unknown> }> = [];
  const fetchCalls: Array<{ url: string; options: RequestInit | undefined }> = [];
  const state = {
    actor: { id: profileId, auth_user_id: userId, tenant_id: tenant, role_id: 'office-role', is_active: true, status: 'active' },
    role: { key: 'office_admin', tenant_id: tenant, is_admin_role: false }, permission: true, permissionError: null as unknown,
    preview: { invoice_number: invoiceNumber, source_revision: sourceRevision }, previewError: null as unknown,
    incoming: { id: invoiceId, tenant_id: tenant, original_sha256: originalDigest, extracted_xml_sha256: digest },
    checked: { ok: true, validation: report(), xmlBase64: Buffer.from(xml).toString('base64'), xmlSha256: digest, originalSha256: originalDigest, sourceRevision, invoiceNumber } as Record<string, unknown>,
    recordError: null as unknown, receiptHash: digest, response: null as Response | null,
  };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const client = (scope: 'service' | 'user'): PdfClient => ({
    from: (table: string) => {
      const query = { select: (_fields: string) => query, eq: (_key: string, _value: unknown) => query, or: (_filter: string) => query,
        maybeSingle: async () => ({ data: table === 'profiles' ? state.actor : state.role, error: null }), single: async () => ({ data: state.role, error: null }) };
      return query;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ scope, name, args });
      if (name === 'has_permission') return { data: state.permission, error: state.permissionError };
      if (name === 'office_invoice_issue_preview') return { data: state.preview, error: state.previewError };
      if (name === 'office_einvoice_inbox_read') return { data: { items: [state.incoming] }, error: null };
      return { data: { xml_sha256: state.receiptHash }, error: state.recordError };
    },
  } as unknown as PdfClient);
  const handler = createEInvoiceValidationHandler({ serviceClient: () => client('service'), respond, fetch: async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    return state.response ?? respond(state.checked);
  } });
  return { state, calls, fetchCalls, post: (input: Record<string, unknown> = payload()) => handler(input, 'Bearer genuine-session-token', userId, client('user')),
    writes: () => calls.filter(call => call.name === 'office_einvoice_record_validation' || call.name === 'office_einvoice_inbox_validation') };
}

describe('Trusted e-invoice validation authority', () => {
  it('binds exact server bytes, current revision and authenticated user to the service-only receipt', async () => {
    const test = harness(); const response = await test.post();
    expect(response.status).toBe(200); expect((await response.json()).xmlSha256).toBe(digest);
    expect(test.writes()).toHaveLength(1);
    expect(test.writes()[0]).toMatchObject({ scope: 'service', name: 'office_einvoice_record_validation', args: { p_tenant_id: tenant, p_invoice_id: invoiceId,
      p_expected_updated_at: updatedAt, p_source_revision: sourceRevision, p_invoice_number: invoiceNumber, p_actor_id: userId, p_xml_base64: Buffer.from(xml).toString('base64') } });
    expect(test.calls.find(call => call.name === 'has_permission')?.args).toEqual({ p_permission_key: 'office.invoices.status_change' });
    expect(test.fetchCalls[0].url).toBe('https://www.caresuiteplus.app/api/einvoice/validate');
    expect(test.fetchCalls[0].options?.redirect).toBe('error');
    expect((test.fetchCalls[0].options?.headers as Record<string, string>).Authorization).toBe('Bearer genuine-session-token');
  });
  it('does not forward client bytes, endpoint choices, actor overrides or fake validation reports', async () => {
    const test = harness();
    const response = await test.post({ ...payload(), validatorUrl: 'https://attacker.example/', xmlBase64: 'forged', validation: { status: 'valid', source: 'server' }, actorId: 'attacker' });
    expect(response.status).toBe(200);
    expect(test.fetchCalls).toHaveLength(1);
    expect(JSON.parse(String(test.fetchCalls[0].options?.body))).toEqual({ tenantId: tenant, invoiceId, expectedUpdatedAt: updatedAt, sourceRevision, invoiceNumber });
    expect(test.writes()[0].args.p_actor_id).toBe(userId);
    expect(test.writes()[0].args.p_report).toEqual(report());
  });
  it('rejects tenant, role, active-profile and permission failures before external validation', async () => {
    for (const kind of ['foreign tenant', 'inactive profile', 'inactive status', 'portal role', 'foreign role', 'permission', 'permission service failure']) {
      const test = harness();
      if (kind === 'foreign tenant') test.state.actor.tenant_id = 'foreign';
      if (kind === 'inactive profile') test.state.actor.is_active = false;
      if (kind === 'inactive status') test.state.actor.status = 'disabled';
      if (kind === 'portal role') { test.state.role.key = 'employee_portal'; test.state.role.is_admin_role = true; }
      if (kind === 'foreign role') test.state.role.tenant_id = 'foreign';
      if (kind === 'permission') test.state.permission = false;
      if (kind === 'permission service failure') test.state.permissionError = new Error('RPC unavailable');
      expect((await test.post()).status).toBe(403); expect(test.fetchCalls).toHaveLength(0); expect(test.writes()).toHaveLength(0);
    }
  });
  it('rejects invalid identifiers and stale revisions before external validation', async () => {
    for (const input of [{ ...payload(), tenantId: '../other' }, { ...payload(), invoiceId: 'invalid' }, { ...payload(), expectedUpdatedAt: 'not-a-date' }]) {
      const test = harness(); expect((await test.post(input)).status).toBe(400); expect(test.fetchCalls).toHaveLength(0);
    }
    const test = harness(); test.state.preview.source_revision = 'b'.repeat(32);
    expect((await test.post()).status).toBe(409); expect(test.fetchCalls).toHaveLength(0); expect(test.writes()).toHaveLength(0);
  });
  it('rejects mismatched report hashes, untrusted reports and changed source results', async () => {
    for (const kind of ['browser report', 'different report hash', 'different invoice', 'different revision']) {
      const test = harness();
      if (kind === 'browser report') test.state.checked.validation = { ...report(), source: 'browser' };
      if (kind === 'different report hash') test.state.checked.validation = { ...report(), documentSha256: 'f'.repeat(64) };
      if (kind === 'different invoice') test.state.checked.invoiceNumber = 'RE-OTHER';
      if (kind === 'different revision') test.state.checked.sourceRevision = 'b'.repeat(32);
      const response = await test.post(); expect([409, 503]).toContain(response.status); expect(test.writes()).toHaveLength(0);
    }
  });
  it('hashes the actual returned XML and rejects corrupted, oversized or swapped bytes', async () => {
    for (const value of ['%%%', 'A'.repeat(3500004), Buffer.from('<Invoice>different bytes</Invoice>').toString('base64')]) {
      const test = harness(); test.state.checked.xmlBase64 = value;
      const response = await test.post(); expect([409, 503]).toContain(response.status); expect(test.writes()).toHaveLength(0);
    }
  });
  it('never stores an outgoing failed validation and preserves its useful findings', async () => {
    const test = harness(); test.state.checked.validation = { ...report(), status: 'invalid', findings: [{ code: 'BR-CO-10', severity: 'error', message: 'Die Summe stimmt nicht.' }] };
    const response = await test.post(); expect(response.status).toBe(422); expect((await response.json()).error).toContain('Die Summe stimmt nicht.'); expect(test.writes()).toHaveLength(0);
  });
  it('fails closed when the authoritative database rejects a stale or wrong-version receipt', async () => {
    for (const kind of ['stale revision', 'wrong validator version', 'unconfirmed receipt']) {
      const test = harness();
      if (kind === 'wrong validator version') test.state.checked.validation = { ...report(), engine: { name: 'libxml2-wasm+saxon-js', version: '0.0.0' } };
      if (kind === 'unconfirmed receipt') test.state.receiptHash = 'f'.repeat(64);
      else test.state.recordError = { code: kind === 'stale revision' ? '40001' : '22023' };
      expect([409, 503]).toContain((await test.post()).status);
    }
  });
  it('requires the stored incoming original and extracted XML to match the report', async () => {
    for (const kind of ['original mismatch', 'xml mismatch', 'foreign tenant']) {
      const test = harness();
      if (kind === 'original mismatch') test.state.checked.originalSha256 = 'f'.repeat(64);
      if (kind === 'xml mismatch') test.state.incoming.extracted_xml_sha256 = 'f'.repeat(64);
      if (kind === 'foreign tenant') test.state.incoming.tenant_id = 'foreign';
      const response = await test.post({ action: 'validate_einvoice_inbox', tenantId: tenant, documentId: invoiceId });
      expect([404, 409]).toContain(response.status); expect(test.writes()).toHaveLength(0);
    }
  });
  it('records an incoming failed format check without approving or paying that invoice', async () => {
    const test = harness(); test.state.checked.validation = { ...report(), status: 'invalid', findings: [{ code: 'BR-ERROR', severity: 'error', message: 'Pflichtangabe fehlt.' }] };
    const response = await test.post({ action: 'validate_einvoice_inbox', tenantId: tenant, documentId: invoiceId });
    expect(response.status).toBe(200); expect(test.writes()).toHaveLength(1);
    expect(test.writes()[0]).toMatchObject({ scope: 'service', name: 'office_einvoice_inbox_validation', args: { p_original_sha256: originalDigest, p_actor_id: userId } });
    expect(test.calls.some(call => call.name.includes('payment') || call.name === 'office_invoice_mutation')).toBe(false);
  });
  it('rejects non-JSON, oversized and incomplete validator responses without a receipt', async () => {
    for (const response of [new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }),
      new Response('x'.repeat(4 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }),
      new Response('{', { headers: { 'Content-Type': 'application/json' } }), new Response('null', { headers: { 'Content-Type': 'application/json' } })]) {
      const test = harness(); test.state.response = response;
      expect((await test.post()).status).toBe(503); expect(test.writes()).toHaveLength(0);
    }
  });
  it('preserves actionable validation and stale-source errors from the fixed server without storing a receipt', async () => {
    for (const status of [409, 422]) {
      const test = harness();
      test.state.response = new Response(JSON.stringify({ ok: false, error: 'Bitte den tatsächlichen Leistungsempfänger ergänzen.' }), { status, headers: { 'Content-Type': 'application/json' } });
      const response = await test.post();
      expect(response.status).toBe(status);
      expect((await response.json()).error).toBe('Bitte den tatsächlichen Leistungsempfänger ergänzen.');
      expect(test.writes()).toHaveLength(0);
    }
  });
});
