import { verifyIntakeCompletionDocuments } from './runtime.generated.js';

type Result = { data: unknown; error: unknown };
type Query = PromiseLike<Result> & { eq(column: string, value: unknown): Query; or(filter: string): Query; maybeSingle(): PromiseLike<Result> };
export type IntakeCompletionClient = {
  auth: { getUser(): PromiseLike<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<Result>;
  from(table: string): { select(columns: string): Query };
};
type Dependencies = { userClient(authorization: string): IntakeCompletionClient; serviceClient(): Pick<IntakeCompletionClient, 'rpc'>; now?: () => number };
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const databaseFailureStatus = (error: unknown) => object(error) && error.code === '40001' ? 409 : object(error) && error.code === '42501' ? 403 : 503;
function receipt(value: unknown, clientId: string, revision: number): value is Record<string, unknown> {
  return object(value) && value.contract === 'client-intake-completion-v1' && value.clientId === clientId && value.revision === revision && value.status === 'active' && value.confirmed === true && typeof value.replayed === 'boolean';
}
async function requestBody(req: Request): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader(); if (!reader) throw new Error('Anfrage fehlt.');
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 4096) { await reader.cancel(); throw new Error('Anfrage zu groß.'); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes)); if (!object(body)) throw new Error('Ungültige Anfrage.'); return body;
}

/** Checks the exact stored originals before the single transactional completion. */
export function createIntakeCompletionHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers });
    if (req.method !== 'POST') return reply({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
    const authorization = req.headers.get('Authorization') ?? '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply({ ok: false, error: 'Bitte erneut anmelden.' }, 401);
    let tenantId: string; let clientId: string; let expectedRevision: number;
    try {
      const body = await requestBody(req);
      if (Object.keys(body).some((key) => !['tenantId', 'clientId', 'expectedRevision'].includes(key)) || typeof body.tenantId !== 'string' || typeof body.clientId !== 'string' || !uuid.test(body.tenantId) || !uuid.test(body.clientId) || !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 1) throw new Error();
      tenantId = body.tenantId; clientId = body.clientId; expectedRevision = Number(body.expectedRevision);
    } catch { return reply({ ok: false, error: 'Mandant, Aufnahme oder bestätigter Speicherstand ist ungültig.' }, 400); }
    try {
      const caller = deps.userClient(authorization);
      const verifiedUser = await caller.auth.getUser();
      if (verifiedUser.error || !verifiedUser.data.user || !uuid.test(verifiedUser.data.user.id)) return reply({ ok: false, error: 'Bitte erneut anmelden.' }, 401);
      const authUserId = verifiedUser.data.user.id;
      const checks = await Promise.all([
        caller.rpc('current_tenant_id', {}),
        caller.rpc('is_internal_tenant_actor', { p_tenant_id: tenantId }),
        ...['office.clients.create', 'office.clients.view', 'office.clients.view_sensitive'].map((permission) => caller.rpc('has_permission', { p_permission_key: permission })),
      ]);
      if (checks.some((check) => check.error) || checks[0].data !== tenantId || checks.slice(1).some((check) => check.data !== true)) return reply({ ok: false, error: 'Keine aktuelle Verwaltungsberechtigung für diese Aufnahme.' }, 403);
      const profileResult = await caller.from('profiles').select('id,tenant_id,is_active,status,auth_user_id')
        .eq('tenant_id', tenantId).or(`auth_user_id.eq.${authUserId},and(auth_user_id.is.null,id.eq.${authUserId})`).maybeSingle();
      const profile = profileResult.data;
      if (profileResult.error || !object(profile) || !uuid.test(String(profile.id)) || profile.tenant_id !== tenantId || profile.is_active !== true || profile.status !== 'active' || !(profile.auth_user_id === authUserId || profile.auth_user_id == null && profile.id === authUserId)) return reply({ ok: false, error: 'Ihr aktives Verwaltungsprofil konnte nicht eindeutig bestätigt werden.' }, 403);
      const loaded = await caller.rpc('client_intake_load_draft', { p_tenant: tenantId, p_client: clientId });
      const draft = loaded.data;
      if (loaded.error) return reply({ ok: false, error: 'Der gespeicherte Aufnahmeentwurf konnte gerade nicht bestätigt werden. Bitte erneut versuchen.' }, databaseFailureStatus(loaded.error));
      if (!object(draft) || draft.contract !== 'client-intake-draft-v1' || draft.tenantId !== tenantId || draft.clientId !== clientId || typeof draft.formHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(draft.formHash)) return reply({ ok: false, error: 'Der gespeicherte Aufnahmeentwurf konnte nicht verlässlich geladen werden. Bitte erneut laden.' }, 503);
      if (draft.revision !== expectedRevision) return reply({ ok: false, error: 'Der gespeicherte Aufnahmeentwurf wurde geändert. Bitte den aktuellen Serverstand prüfen.' }, 409);
      if (draft.status === 'completed') {
        // The protected SQL load returns the immutable completion receipt. Never
        // reinterpret a completed original using today's company or templates.
        if (!receipt(draft.completedReceipt, clientId, expectedRevision)) return reply({ ok: false, error: 'Die vorhandene Abschlussquittung konnte nicht bestätigt werden. Bitte erneut versuchen.' }, 503);
        return reply({ ok: true, data: { ...draft.completedReceipt, replayed: true } });
      }
      if (draft.status !== 'draft') return reply({ ok: false, error: 'Die Aufnahme ist nicht mehr als Entwurf verfügbar.' }, 409);
      if (draft.coreChanged === true) return reply({ ok: false, error: 'Die Stammdaten der Klientenakte wurden seit der Entwurfsicherung geändert. Bitte zuerst die aktuellen Aktenangaben übernehmen und die Dokumente erneut prüfen.' }, 409);
      const [systemResult, tenantResult, companyResult] = await Promise.all([
        caller.from(object(draft.form) && draft.form.intakeTemplateEdition === '2027' ? 'intake_document_templates_2027' : 'intake_document_system_templates').select('*').eq('is_active', true),
        caller.from('tenant_document_templates').select('*').eq('tenant_id', tenantId).eq('is_active', true),
        caller.from('tenants').select('name,street,house_number,postal_code,city').eq('id', tenantId).maybeSingle(),
      ]);
      if (systemResult.error || tenantResult.error || companyResult.error || !Array.isArray(systemResult.data) || !systemResult.data.every(object) || !Array.isArray(tenantResult.data) || !tenantResult.data.every(object) || !object(companyResult.data)) return reply({ ok: false, error: 'Die aktuellen Vorlagen oder Unternehmensangaben konnten nicht verlässlich geladen werden.' }, 503);
      if (tenantResult.data.some((row) => row.tenant_id !== tenantId)) return reply({ ok: false, error: 'Die Dokumentvorlage gehört nicht zu dieser Aufnahme.' }, 403);
      const company = companyResult.data;
      const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
      const tenantDisplay = { name: asText(company.name) || 'Ihr Unternehmen', street: [asText(company.street), asText(company.house_number)].filter(Boolean).join(' '), zip: asText(company.postal_code), city: asText(company.city) };
      let documents;
      try { documents = await verifyIntakeCompletionDocuments({ form: draft.form, systemTemplates: systemResult.data, tenantTemplates: tenantResult.data, tenantDisplay, now: deps.now?.() }); }
      catch (error) { return reply({ ok: false, error: error instanceof Error ? error.message : 'Die Originalunterlagen konnten nicht bestätigt werden.' }, 422); }
      const committed = await deps.serviceClient().rpc('client_intake_commit_completion', {
        p_tenant: tenantId, p_client: clientId, p_actor: profile.id, p_auth_user: authUserId,
        p_expected_revision: expectedRevision, p_form_hash: draft.formHash, p_documents: documents.map((document) => ({ ...document, tenantDisplaySnapshot: company })),
      });
      if (committed.error || !receipt(committed.data, clientId, expectedRevision)) return reply({ ok: false, error: 'Der Abschluss konnte nicht bestätigt werden. Bitte denselben Speicherstand erneut versuchen; ein bereits erfolgter Abschluss wird erkannt.' }, committed.error ? databaseFailureStatus(committed.error) : 503);
      return reply({ ok: true, data: committed.data });
    } catch { return reply({ ok: false, error: 'Der Abschluss konnte gerade nicht bestätigt werden. Bitte denselben Speicherstand erneut versuchen; ein bereits erfolgter Abschluss wird erkannt.' }, 503); }
  };
}
