import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createIntakeCompletionHandler, type IntakeCompletionClient } from '../../../supabase/functions/complete-client-intake/handler';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { listApplicableIntakeTemplates } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { openDocumentPreview, applyDocumentSignature, updateIntakeDocumentInForm } from '@/features/intakeDocuments/intakeDocumentService';
import { INTAKE_DOCUMENT_SYSTEM_TEMPLATES } from '@/features/intakeDocuments/intakeDocumentSystemTemplates';

const id = { tenant: '11111111-1111-4111-8111-111111111111', client: '22222222-2222-4222-8222-222222222222', user: '33333333-3333-4333-8333-333333333333', profile: '44444444-4444-4444-8444-444444444444' };
const now = '2026-10-14T12:00:00.000Z';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const tenant = { name: 'Pflegedienst Beispiel', street: 'Hauptstraße', house_number: '2', postal_code: '10115', city: 'Berlin' };
const tenantDisplay = { name: tenant.name, street: 'Hauptstraße 2', zip: tenant.postal_code, city: tenant.city };
const systemRows = () => INTAKE_DOCUMENT_SYSTEM_TEMPLATES.map((template) => ({ id: template.id, template_key: template.templateKey, title: template.title, document_type: template.documentType, service_type: template.serviceType, version: template.version, is_required: template.isRequired, is_active: template.isActive, requires_client_signature: template.requiresClientSignature, requires_employee_signature: template.requiresEmployeeSignature, requires_representative_signature: template.requiresRepresentativeSignature, allows_custom_template: template.allowsCustomTemplate, html_content: template.htmlContent, plain_text_content: template.plainTextContent, placeholder_schema: template.placeholderSchema, signature_slots: template.signatureSlots, updated_at: now }));
function fixture() {
  let form = { ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), firstName: 'Helga', lastName: 'Beispiel', dateOfBirth: '1950-01-02', street: 'Testweg', houseNumber: '1', zip: '10115', city: 'Berlin', phone: '030123', serviceStart: '2026-10-15', careContexts: ['daily_assistance'] as typeof EMPTY_CLIENT_INTAKE_FORM.careContexts, careLevel: 'pg2', supportWishes: ['gesellschaft'], fundingSources: ['selbstzahler'] as typeof EMPTY_CLIENT_INTAKE_FORM.fundingSources, selfPay: true, billingType: 'selbstzahler', billingTypes: ['selbstzahler'], costBearerTypes: ['selbstzahler'], selbstzahlerName: 'Helga Beispiel', intakeContractType: 'assist', hourlyRate: '42' };
  for (const template of listApplicableIntakeTemplates(form)) {
    let doc = openDocumentPreview(form, template, tenantDisplay);
    for (const slot of template.signatureSlots.filter((item) => item.required)) doc = applyDocumentSignature(doc, template, form, slot.role, { role: slot.role, dataUrl: png, signedAt: now, signerName: slot.role === 'client' ? 'Helga Beispiel' : 'Mitarbeitende' }, tenantDisplay);
    form = updateIntakeDocumentInForm(form, doc) as typeof form;
  }
  return form;
}
let draft: Record<string, unknown>; let denied: boolean; let authInvalid: boolean; let commitError: boolean; let currentTenant: string; let company: Record<string, unknown>;
let tables: string[]; let rpcCalls: { name: string; args: Record<string, unknown> }[];
const success = () => ({ contract: 'client-intake-completion-v1', clientId: id.client, revision: 3, status: 'active', confirmed: true, replayed: false });
function client(): IntakeCompletionClient {
  return { auth: { getUser: async () => ({ data: { user: authInvalid ? null : { id: id.user } }, error: null }) },
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      return { data: name === 'current_tenant_id' ? currentTenant : name === 'client_intake_load_draft' ? draft : !denied, error: null };
    },
    from: (table) => { tables.push(table); const data = table === 'profiles' ? { id: id.profile, tenant_id: id.tenant, auth_user_id: id.user, is_active: true, status: 'active' } : table === 'tenants' ? company : table === 'intake_document_system_templates' ? systemRows() : [];
      const q = { eq: () => q, or: () => q, maybeSingle: async () => ({ data, error: null }), then: (resolve: (result: { data: unknown; error: null }) => unknown) => Promise.resolve({ data, error: null }).then(resolve) };
      return { select: () => q };
    },
  } as IntakeCompletionClient;
}
const commit = vi.fn(async (name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> => { rpcCalls.push({ name, args }); return { data: commitError ? null : success(), error: commitError ? { code: '40001', message: 'conflict' } : null }; });
const invoke = (body: unknown = { tenantId: id.tenant, clientId: id.client, expectedRevision: 3 }, authorization = 'Bearer token') => createIntakeCompletionHandler({ userClient: client, serviceClient: () => ({ rpc: commit }), now: () => Date.parse(now) })(new Request('https://example.test/complete-client-intake', { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); denied = false; authInvalid = false; commitError = false; currentTenant = id.tenant; company = { ...tenant }; tables = []; rpcCalls = []; commit.mockClear(); draft = { contract: 'client-intake-draft-v1', tenantId: id.tenant, clientId: id.client, revision: 3, formHash: `sha256:${'a'.repeat(64)}`, status: 'draft', form: fixture() }; });
afterEach(() => vi.useRealTimers());

describe('complete-client-intake Edge with the generated shared runtime', () => {
  it('verifies the full stored original and forwards unchanged HTML, PNG, SQL hash and current snapshots to one commit', async () => {
    const result = await invoke(); const body = await result.json();
    expect(result.status).toBe(200); expect(body).toEqual({ ok: true, data: success() }); expect(commit).toHaveBeenCalledOnce();
    const args = commit.mock.calls[0]![1];
    expect(args.p_form_hash).toBe(draft.formHash); expect(args.p_actor).toBe(id.profile); expect(args.p_auth_user).toBe(id.user);
    const docs = args.p_documents as Record<string, unknown>[];
    const originals = (draft.form as ReturnType<typeof fixture>).intakeDocuments;
    expect(docs).toHaveLength(originals.length);
    docs.forEach((doc, index) => { expect(doc.finalizedHtml).toBe(originals[index]!.finalizedHtml); expect(doc.signatures).toEqual(originals[index]!.signatures); expect(doc.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/); expect(doc.tenantDisplaySnapshot).toEqual(tenant); expect(doc.systemTemplateSnapshot).toBeTruthy(); });
  });
  it('rejects unauthenticated calls and permission loss before touching the draft', async () => {
    expect((await invoke(undefined, '')).status).toBe(401); authInvalid = true; expect((await invoke()).status).toBe(401);
    authInvalid = false; denied = true; expect((await invoke()).status).toBe(403);
    expect(rpcCalls.some((call) => call.name === 'client_intake_load_draft')).toBe(false); expect(commit).not.toHaveBeenCalled();
  });
  it('rejects tenant crossing, changed revisions and caller-supplied document overrides', async () => {
    currentTenant = id.client; expect((await invoke()).status).toBe(403); currentTenant = id.tenant;
    draft.revision = 4; expect((await invoke()).status).toBe(409);
    expect((await invoke({ tenantId: id.tenant, clientId: id.client, expectedRevision: 3, form: fixture() })).status).toBe(400);
    expect(commit).not.toHaveBeenCalled();
  });
  it('reports externally changed client core fields before verifying or committing the stored documents', async () => {
    draft.coreChanged = true;
    const result = await invoke(); expect(result.status).toBe(409);
    expect(await result.text()).toContain('aktuellen Aktenangaben übernehmen');
    expect(tables).toEqual(['profiles']); expect(commit).not.toHaveBeenCalled();
  });
  it('requires renewed review when company data changed after the document was signed', async () => {
    company.name = 'Geänderte Firma'; const result = await invoke(); expect(result.status).toBe(422); expect(await result.text()).toContain('Original'); expect(commit).not.toHaveBeenCalled();
  });
  it('replays an already completed receipt without interpreting originals against later templates or company data', async () => {
    draft.status = 'completed'; draft.completedReceipt = success(); draft.form = {}; company = {};
    const result = await invoke(); expect(result.status).toBe(200); expect(await result.json()).toEqual({ ok: true, data: { ...success(), replayed: true } });
    expect(tables).toEqual(['profiles']); expect(commit).not.toHaveBeenCalled();
  });
  it('does not accept a completed status without the matching immutable receipt', async () => {
    draft.status = 'completed'; draft.completedReceipt = { ...success(), clientId: id.tenant }; expect((await invoke()).status).toBe(503); expect(commit).not.toHaveBeenCalled();
  });
  it('never claims success after the database rejects a concurrent change', async () => {
    commitError = true; const result = await invoke(); expect(result.status).toBe(409); expect(await result.text()).toContain('ein bereits erfolgter Abschluss wird erkannt');
  });
  it('distinguishes retryable commit failures from a concurrent revision and a revoked permission', async () => {
    commit.mockResolvedValueOnce({ data: null, error: { message: 'fetch failed' } });
    expect((await invoke()).status).toBe(503);
    commit.mockResolvedValueOnce({ data: { ...success(), confirmed: false }, error: null });
    expect((await invoke()).status).toBe(503);
    commit.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission changed' } });
    expect((await invoke()).status).toBe(403);
  });
  it('handles a lost commit response without claiming the draft is still open and recovers the committed receipt', async () => {
    commit.mockImplementationOnce(async () => {
      draft.status = 'completed'; draft.completedReceipt = success();
      throw new Error('response lost after commit');
    });
    const uncertain = await invoke(); const uncertainBody = await uncertain.json();
    expect(uncertain.status).toBe(503); expect(uncertainBody.ok).toBe(false);
    expect(uncertainBody.error).toContain('ein bereits erfolgter Abschluss wird erkannt');
    expect(uncertainBody.error).not.toContain('Entwurf bleibt');
    const recovered = await invoke();
    expect(recovered.status).toBe(200); expect(await recovered.json()).toEqual({ ok: true, data: { ...success(), replayed: true } });
    expect(commit).toHaveBeenCalledOnce();
  });
  it('rejects altered signed originals before invoking the privileged commit', async () => {
    const form = draft.form as ReturnType<typeof fixture>; form.intakeDocuments[0]!.finalizedHtml += '<p>changed</p>';
    expect((await invoke()).status).toBe(422); expect(commit).not.toHaveBeenCalled();
  });
});
