import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/types/permissions';

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>, errors: {} as Record<string, string>, calls: [] as { table: string; filters: [string, unknown][]; range: number[] | null }[],
  generate: vi.fn(), proof: vi.fn(), latestProof: vi.fn(), enrich: vi.fn(), sync: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: (tenant: string) => tenant ? null : { ok: false, error: 'Mandant fehlt.' } }));
vi.mock('@/lib/permissions', () => ({
  isAdministrationRole: (role: string) => ['business_admin', 'business_manager', 'dispatch', 'billing'].includes(role),
  enforcePermission: (_role: string, permission: string, context: { effectivePermissions: string[] }) => context.effectivePermissions.includes(permission) ? null : { ok: false, error: 'Keine Berechtigung.' },
}));
vi.mock('@/lib/assist/assistVisitProofPersistenceService', () => ({ fetchVisitProofById: mocks.proof, fetchLatestVisitProof: mocks.latestProof }));
vi.mock('@/lib/assist/assistProofPdfService', () => ({ generateAssistProofPdf: mocks.generate }));
vi.mock('@/lib/assist/visitProofSnapshotPreviewService', () => ({ enrichVisitProofForPreview: mocks.enrich }));
vi.mock('@/lib/wfm/wfmAssistAdapter', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/wfm/wfmAssistAdapter')>(), syncAssistVisitTimesToWfm: mocks.sync }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const filters: [string, unknown][] = [];
  let pagination: number[] | null = null;
  let single = false;
  const resolve = () => {
    mocks.calls.push({ table, filters: [...filters], range: pagination });
    const error = mocks.errors[table] ? { message: mocks.errors[table] } : null;
    let rows = (mocks.tables[table] ?? []).filter(row => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
    if (pagination) rows = rows.slice(pagination[0], pagination[1] + 1);
    return { data: error ? null : single ? rows[0] ?? null : rows, error };
  };
  const query: Record<string, unknown> = {};
  for (const key of ['select', 'order']) query[key] = () => query;
  query.eq = (key: string, value: unknown) => { filters.push([key, value]); return query; };
  query.in = (key: string, value: unknown) => { filters.push([key, value]); return query; };
  query.range = (start: number, end: number) => { pagination = [start, end]; return Promise.resolve(resolve()); };
  query.maybeSingle = () => { single = true; return Promise.resolve(resolve()); };
  return query;
} }));

import { fetchAssistProblemSnapshot, getAssistProblemRepair, runAssistProblemRepair, type AssistProblemActor, type AssistProblemItem } from '@/lib/assist/assistProblemWorkspaceService.web';

const tenantId = 'tenant-test';
const permissions: PermissionKey[] = ['assist.assignments.view', 'assist.records.view', 'assist.records.export', 'office.employee_time.view', 'office.employee_time.manage', 'clients.budgets.transactions.view'];
const actor: AssistProblemActor = { roleKey: 'business_admin', profileId: 'profile-test', permissions };
const row = (values: Record<string, unknown>) => ({ tenant_id: tenantId, ...values });
function seed(id = '1', extra: Record<string, unknown> = {}) {
  const assignment = row({ id: `a${id}`, client_id: 'c1', employee_id: 'e1', status: 'finished', documentation_notes: '', title: 'Testeinsatz', assignment_date: '2026-10-17' });
  const visit = row({ id: `v${id}`, legacy_assignment_id: `a${id}`, client_id: 'c1', employee_id: 'e1', canonical_status: 'finished', execution_status: 'completed', proof_template_key: 'standard', title: 'Testeinsatz', assignment_date: '2026-10-17', ...extra });
  (mocks.tables.assignments ??= []).push(assignment);
  (mocks.tables.assist_visits ??= []).push(visit);
  return visit;
}
function item(overrides: Partial<AssistProblemItem> = {}): AssistProblemItem {
  return { id: 'problem', tenantId, assignmentId: 'a1', visitId: 'v1', proofId: 'p1', clientId: 'c1', employeeId: 'e1', code: 'proof_missing_pdf', category: 'proof', source: 'PDF', title: 'Einsatz', message: 'PDF fehlt', date: '2026-10-17', clientName: 'Klient Test', employeeName: 'Person Test', ...overrides };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.tables = {}; mocks.errors = {}; mocks.calls = [];
  mocks.tables.clients = [row({ id: 'c1', first_name: 'Klient', last_name: 'Test' })];
  mocks.tables.employees = [row({ id: 'e1', first_name: 'Person', last_name: 'Test' })];
  mocks.enrich.mockResolvedValue({ ok: true, data: {} });
  mocks.generate.mockResolvedValue({ ok: true, data: {} });
  mocks.sync.mockResolvedValue({ ok: true, data: undefined });
  mocks.latestProof.mockResolvedValue({ ok: true, data: { id: 'p1', tenantId, visitId: 'v1' } });
});

describe('Problem-Inbox Datenprüfung', () => {
  it('prüft auch hinter der ersten Seite und schneidet die Problemliste nicht bei 20 ab', async () => {
    for (let index = 0; index < 421; index++) seed(String(index));
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.complete).toBe(true);
    expect(result.data.checkedAssignments).toBe(421);
    expect(result.data.items.filter(problem => problem.code === 'ended_missing_documentation')).toHaveLength(421);
    expect(new Set(result.data.items.map(problem => problem.id)).size).toBe(result.data.items.length);
    expect(mocks.calls.some(call => call.table === 'assignments' && call.range?.[0] === 400)).toBe(true);
  });
  it('zeigt Namen, Datum und Quellbezug und berücksichtigt Durchführungen ohne Alt-Einsatz', async () => {
    seed(); mocks.tables.assignments = []; mocks.tables.assist_visits[0].legacy_assignment_id = null;
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok && result.data.items[0]).toMatchObject({ assignmentId: 'v1', visitId: 'v1', clientName: 'Klient Test', employeeName: 'Person Test', date: '2026-10-17', category: 'documentation' });
  });
  it('meldet fehlende Basistabellen als Fehler und niemals als leere gesunde Inbox', async () => {
    mocks.errors.assignments = 'relation assignments does not exist'; mocks.errors.assist_visits = 'relation assist_visits does not exist';
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok).toBe(false);
  });
  it('kennzeichnet fehlgeschlagene Unterabfragen und behauptet dann keine fehlende Dokumentation', async () => {
    seed(); mocks.errors.assist_visit_documentation = 'permission denied';
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok && result.data.complete).toBe(false);
    if (!result.ok) return;
    expect(result.data.warnings.some(warning => warning.includes('Dokumentation'))).toBe(true);
    expect(result.data.items.some(problem => problem.code === 'ended_missing_documentation')).toBe(false);
  });
  it('behauptet bei fehlgeschlagener Besuchzuordnung keine fehlende Dokumentation', async () => {
    seed(); mocks.errors.assist_visits = 'network failure';
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok && result.data.complete).toBe(false);
    expect(result.ok && result.data.items.some(problem => problem.code === 'ended_missing_documentation')).toBe(false);
  });
  it('akzeptiert widerrufene oder unvollständige Signaturen nicht als gültig', async () => {
    seed(); mocks.tables.assist_visit_documentation = [row({ id: 'd1', visit_id: 'v1', submitted_at: '2026-10-17' })];
    mocks.tables.assist_visit_signatures = [row({ id: 's1', visit_id: 'v1', is_valid: false, storage_path: 'signature.png' })];
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok && result.data.items.some(problem => problem.code === 'documentation_missing_signature')).toBe(true);
    expect(result.ok && result.data.items.some(problem => problem.code === 'signature_missing_proof')).toBe(false);
  });
  it('prüft exportierte Nachweise, erkennt echte PDF-Lücke und respektiert bewussten Portal-Widerruf', async () => {
    seed(); mocks.tables.assist_visit_proofs = [row({ id: 'p1', visit_id: 'v1', status: 'exported', storage_path: 'snapshot.json', pdf_storage_path: null, portal_visible: false, portal_release_status: 'revoked' })];
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok && result.data.items.some(problem => problem.code === 'proof_missing_pdf')).toBe(true);
    expect(result.ok && result.data.items.some(problem => problem.code === 'proof_not_portal_visible')).toBe(false);
  });
  it('prüft freigegebene exportierte PDFs gegen die richtige Klient:innenakte', async () => {
    seed(); mocks.tables.assist_visit_proofs = [row({ id: 'p1', visit_id: 'v1', status: 'exported', pdf_storage_path: 'proof.pdf', portal_visible: true })];
    mocks.tables.client_documents = [row({ id: 'p1', client_id: 'other-client', storage_path: 'proof.pdf', portal_visible: true })];
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok && result.data.items.some(problem => problem.code === 'proof_missing_client_document')).toBe(true);
  });
  it('erkennt abweichende Personen vor einer fachlichen Prüfung und liefert eindeutige IDs', async () => {
    seed('1', { employee_id: 'e2' });
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok && result.data.items).toHaveLength(1);
    expect(result.ok && result.data.items[0].category).toBe('status');
  });
  it('erkennt Mehrfachzuordnung und führt keinen beliebigen Besuch als zutreffend aus', async () => {
    seed(); mocks.tables.assist_visits.push({ ...mocks.tables.assist_visits[0], id: 'v2' });
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok && result.data.items).toHaveLength(1);
    expect(result.ok && result.data.items[0]).toMatchObject({ visitId: null, code: 'assignment_visit_execution_drift' });
  });
  it('prüft Arbeitszeit nach Person und tatsächlichem Zeitpunkt, nicht nur nach Besuch-ID', async () => {
    seed(); mocks.tables.assist_time_events = [row({ id: 't1', visit_id: 'v1', event_type: 'service_end', occurred_at: '2026-10-17T12:00:00Z' })];
    mocks.tables.workforce_time_events = [row({ id: 'w1', reference_type: 'visit', reference_id: 'v1', employee_id: 'e1', event_type: 'visit_ended', occurred_at: '2026-10-17T11:00:00Z' })];
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok && result.data.items.some(problem => problem.code === 'wfm_sync_failed')).toBe(true);
    expect(mocks.calls.every(call => call.filters.some(([key, value]) => key === 'tenant_id' && value === tenantId))).toBe(true);
  });
  it.each(['drive_start', 'drive_end', 'service_start', 'pause_start', 'pause_end', 'arrive', 'arrived_without_gps', 'arrived_manual', 'depart'])('erkennt einen fehlenden %s-Zeitstempel trotz vorhandenem Einsatzende', async eventType => {
    seed(); mocks.tables.assist_time_events = [row({ id: 't1', visit_id: 'v1', event_type: 'service_end', occurred_at: '2026-10-17T12:00:00Z' }), row({ id: 't2', visit_id: 'v1', event_type: eventType, occurred_at: '2026-10-17T11:00:00Z' })];
    mocks.tables.workforce_time_events = [row({ id: 'w1', reference_type: 'visit', reference_id: 'v1', employee_id: 'e1', event_type: 'visit_ended', occurred_at: '2026-10-17T12:00:00Z' })];
    const result = await fetchAssistProblemSnapshot(tenantId, actor);
    expect(result.ok && result.data.items.some(problem => problem.code === 'wfm_sync_failed')).toBe(true);
  });
  it('verweigert Portalrollen und explizit entzogene Rechte bereits vor der Abfrage', async () => {
    expect((await fetchAssistProblemSnapshot(tenantId, { ...actor, roleKey: 'employee_portal' })).ok).toBe(false);
    expect((await fetchAssistProblemSnapshot(tenantId, { ...actor, permissions: [] })).ok).toBe(false);
    expect(mocks.calls).toHaveLength(0);
  });
  it('kennzeichnet aufgrund fehlender Fachrechte ausgelassene Prüfungen', async () => {
    seed(); const result = await fetchAssistProblemSnapshot(tenantId, { ...actor, permissions: ['assist.assignments.view'] });
    expect(result.ok && result.data.complete).toBe(false);
    expect(mocks.calls.some(call => call.table === 'workforce_time_events' || call.table === 'assist_visit_proofs')).toBe(false);
  });
});

describe('Problem-Inbox Reparaturen', () => {
  it('bietet ausschließlich belegbasierte und erlaubte Reparaturen an', () => {
    expect(getAssistProblemRepair(item(), () => false)).toBeNull();
    expect(getAssistProblemRepair(item({ code: 'documentation_missing_signature' }), () => true)).toBeNull();
    expect(getAssistProblemRepair(item(), key => key === 'assist.records.export')?.id).toBe('generate_pdf');
  });
  it('verhindert Mandantenwechsel, entzogene Rechte und veränderte Zuordnung vor einer Mutation', async () => {
    seed(); const base = { tenantId, item: item(), actionId: 'generate_pdf' as const, actor };
    expect((await runAssistProblemRepair({ ...base, item: item({ tenantId: 'foreign-tenant' }) })).ok).toBe(false);
    expect((await runAssistProblemRepair({ ...base, actor: { ...actor, permissions: ['assist.assignments.view'] } })).ok).toBe(false);
    mocks.tables.assist_visits[0].employee_id = 'different-person';
    expect((await runAssistProblemRepair(base)).ok).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('verhindert Reparaturen im explizit schreibgeschützten Zugang trotz Fachrecht', async () => {
    seed();
    expect(getAssistProblemRepair(item(), () => true, true)).toBeNull();
    expect((await runAssistProblemRepair({ tenantId, item: item(), actionId: 'generate_pdf', actor: { ...actor, isReadOnly: true } })).ok).toBe(false);
    expect(mocks.calls).toHaveLength(0); expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('bricht vor der PDF-Schreibaktion ab, wenn der Zugang während der Vorbereitung wechselt', async () => {
    seed(); let current = true;
    mocks.proof.mockResolvedValue({ ok: true, data: { id: 'p1', tenantId, visitId: 'v1', status: 'approved', pdfStoragePath: null } });
    mocks.enrich.mockImplementation(async () => { current = false; return { ok: true, data: {} }; });
    const result = await runAssistProblemRepair({ tenantId, item: item(), actionId: 'generate_pdf', actor, isCurrent: () => current });
    expect(result.ok).toBe(false); expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('prüft den aktuellen Zugang nochmals unmittelbar vor dem Zeitkonto-Schreibaufruf', async () => {
    seed(); const isCurrent = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    const result = await runAssistProblemRepair({ tenantId, item: item({ code: 'wfm_sync_failed', category: 'timekeeping' }), actionId: 'sync_timekeeping', actor, isCurrent });
    expect(result.ok).toBe(false); expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('weist einen falsch verknüpften Nachweis zurück', async () => {
    seed(); mocks.proof.mockResolvedValue({ ok: true, data: { id: 'p1', tenantId, visitId: 'other-visit', status: 'approved' } });
    expect((await runAssistProblemRepair({ tenantId, item: item(), actionId: 'generate_pdf', actor })).ok).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('ändert keinen inzwischen ersetzten Nachweis', async () => {
    seed(); mocks.latestProof.mockResolvedValue({ ok: true, data: { id: 'new-proof', tenantId, visitId: 'v1' } });
    expect((await runAssistProblemRepair({ tenantId, item: item(), actionId: 'generate_pdf', actor })).ok).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('meldet keine erfolgreiche PDF-Speicherung ohne Lesebestätigung', async () => {
    seed(); mocks.proof.mockResolvedValue({ ok: true, data: { id: 'p1', tenantId, visitId: 'v1', status: 'approved', pdfStoragePath: null } });
    const result = await runAssistProblemRepair({ tenantId, item: item(), actionId: 'generate_pdf', actor });
    expect(mocks.generate).toHaveBeenCalledOnce(); expect(result.ok).toBe(false);
  });
  it('bestätigt die PDF erst nach nachgewiesener Speicherung', async () => {
    seed(); const proof = { id: 'p1', tenantId, visitId: 'v1', status: 'approved', pdfStoragePath: null };
    mocks.proof.mockResolvedValueOnce({ ok: true, data: proof }).mockResolvedValueOnce({ ok: true, data: { ...proof, pdfStoragePath: 'proof.pdf' } });
    expect((await runAssistProblemRepair({ tenantId, item: item(), actionId: 'generate_pdf', actor })).ok).toBe(true);
  });
  it('verlangt auch nach erfolgreicher RPC-Antwort tatsächliche Zeitkontoeinträge', async () => {
    seed(); mocks.tables.assist_time_events = [row({ id: 't1', visit_id: 'v1', event_type: 'service_end', occurred_at: '2026-10-17T12:00:00Z' })];
    const result = await runAssistProblemRepair({ tenantId, item: item({ code: 'wfm_sync_failed', category: 'timekeeping' }), actionId: 'sync_timekeeping', actor });
    expect(mocks.sync).toHaveBeenCalledWith(tenantId, 'e1', null, 'v1'); expect(result.ok).toBe(false);
  });
  it('bestätigt eine Reparatur erst wenn auch Start und Pause übernommen sind', async () => {
    seed(); mocks.tables.assist_time_events = [
      row({ id: 't1', visit_id: 'v1', event_type: 'service_end', occurred_at: '2026-10-17T12:00:00Z' }),
      row({ id: 't2', visit_id: 'v1', event_type: 'service_start', occurred_at: '2026-10-17T10:00:00Z' }),
      row({ id: 't3', visit_id: 'v1', event_type: 'pause_start', occurred_at: '2026-10-17T11:00:00Z' }),
      row({ id: 't4', visit_id: 'v1', event_type: 'pause_end', occurred_at: '2026-10-17T11:15:00Z' }),
    ];
    mocks.tables.workforce_time_events = [row({ id: 'w1', reference_type: 'visit', reference_id: 'v1', employee_id: 'e1', event_type: 'visit_ended', occurred_at: '2026-10-17T12:00:00Z' })];
    const input = { tenantId, item: item({ code: 'wfm_sync_failed', category: 'timekeeping' }), actionId: 'sync_timekeeping' as const, actor };
    expect((await runAssistProblemRepair(input)).ok).toBe(false);
    mocks.tables.workforce_time_events.push(
      row({ id: 'w2', reference_type: 'visit', reference_id: 'v1', employee_id: 'e1', event_type: 'visit_started', occurred_at: '2026-10-17T10:00:00Z' }),
      row({ id: 'w3', reference_type: 'visit', reference_id: 'v1', employee_id: 'e1', event_type: 'pause_start', occurred_at: '2026-10-17T11:00:00Z' }),
      row({ id: 'w4', reference_type: 'visit', reference_id: 'v1', employee_id: 'e1', event_type: 'pause_end', occurred_at: '2026-10-17T11:15:00Z' }),
    );
    expect((await runAssistProblemRepair(input)).ok).toBe(true);
  });
});
