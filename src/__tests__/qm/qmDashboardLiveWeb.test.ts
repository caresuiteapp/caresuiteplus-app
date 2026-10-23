import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  responses: new Map<string, { data: unknown; error: unknown; count?: number | null }>(),
  requests: [] as { table: string; operations: [string, ...unknown[]][] }[],
  rejected: new Set<string>(),
}));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    const request = { table, operations: [] as [string, ...unknown[]][] };
    state.requests.push(request);
    const builder = {
      select(...args: unknown[]) { request.operations.push(['select', ...args]); return builder; },
      eq(...args: unknown[]) { request.operations.push(['eq', ...args]); return builder; },
      in(...args: unknown[]) { request.operations.push(['in', ...args]); return builder; },
      order(...args: unknown[]) { request.operations.push(['order', ...args]); return builder; },
      limit(...args: unknown[]) { request.operations.push(['limit', ...args]); return builder; },
      then(resolve: (result: unknown) => unknown, reject: (reason: unknown) => unknown) {
        const key = table === 'qm_documents' && request.operations.some(op => op[0] === 'eq' && op[1] === 'status') ? 'approvals' : table;
        const promise = state.rejected.has(key) ? Promise.reject(new Error('network')) : Promise.resolve(state.responses.get(key));
        return promise.then(resolve, reject);
      },
    };
    return builder;
  },
}));

import { readQmDashboardSnapshot } from '@/lib/qm/qmDashboardRepository.web';
import { buildQmDashboardKpis } from '@/lib/qm/qmDashboardStats';

const tenant = 'tenant-current';
const audit = {
  id: 'audit-one', tenant_id: tenant, title: 'Internes Audit', audit_type: 'internal', status: 'planned',
  scheduled_at: '2026-11-01T09:00:00Z', completed_at: null, auditor_name: 'QM-Team', findings_count: 2,
  summary: 'Abläufe prüfen', created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-20T09:00:00Z',
};
const change = {
  id: 'change-one', tenant_id: tenant, title: 'Ablauf ergänzt', change_type: 'improvement', status: 'open',
  document_id: null, description: 'Neue Schritte', requested_by: 'QM-Team', completed_at: null,
  created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-20T09:00:00Z',
};

beforeEach(() => {
  state.requests.length = 0; state.responses.clear(); state.rejected.clear();
  state.responses.set('qm_handbook_chapters', { data: null, error: null, count: 1400 });
  state.responses.set('qm_documents', { data: null, error: null, count: 1702 });
  state.responses.set('qm_compliance_requirements', { data: null, error: null, count: 7 });
  state.responses.set('md_audit_packages', { data: null, error: null, count: 3 });
  state.responses.set('approvals', { data: null, error: null, count: 4 });
  state.responses.set('qm_audits', { data: [audit], error: null });
  state.responses.set('qm_changes', { data: [change], error: null });
});

describe('Web QM dashboard live reads', () => {
  it('uses exact tenant-scoped counts beyond the server row limit and maps actual audits and changes', async () => {
    const result = await readQmDashboardSnapshot(tenant);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data).toMatchObject({ chapterCount: 1400, documentCount: 1702, complianceOpenCount: 7, mdPackageCount: 3, pendingApprovals: 4, sectionErrors: {} });
    expect(result.data.upcomingAudits[0]).toMatchObject({ id: 'audit-one', tenantId: tenant, scheduledAt: audit.scheduled_at, auditorName: 'QM-Team', findingsCount: 2 });
    expect(result.data.recentChanges[0]).toMatchObject({ id: 'change-one', changeType: 'improvement', requestedBy: 'QM-Team' });
    expect(state.requests).toHaveLength(7);
    for (const request of state.requests) expect(request.operations).toContainEqual(['eq', 'tenant_id', tenant]);
    for (const request of state.requests.slice(0, 5)) expect(request.operations).toContainEqual(['select', 'id', { count: 'exact', head: true }]);
    expect(state.requests[2]!.operations).toContainEqual(['in', 'status', ['open', 'in_progress', 'overdue']]);
    expect(state.requests[4]!.operations).toContainEqual(['eq', 'status', 'in_review']);
    expect(state.requests[5]!.operations).toContainEqual(['in', 'status', ['planned', 'in_progress', 'follow_up']]);
  });

  it('does not turn a forbidden section into zero or claim a tenant mismatch', async () => {
    state.responses.set('qm_compliance_requirements', { data: null, count: null, error: { code: '42501', message: 'permission denied' } });
    const result = await readQmDashboardSnapshot(tenant);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.documentCount).toBe(1702);
    expect(result.data.sectionErrors?.compliance).toBe('Der Zugriff auf diesen QM-Bereich ist nicht freigegeben.');
    expect(buildQmDashboardKpis(result.data).find(kpi => kpi.id === 'compliance')).toMatchObject({ value: '—', subValue: 'Nicht geladen' });
  });

  it('rejects missing counts even when the API reports no error', async () => {
    state.responses.set('qm_documents', { data: [], count: null, error: null });
    const result = await readQmDashboardSnapshot(tenant);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sectionErrors?.documents).toContain('Anzahl');
    expect(buildQmDashboardKpis(result.data).find(kpi => kpi.id === 'documents')?.value).toBe('—');
  });

  it('preserves valid zero counts and genuinely empty lists', async () => {
    for (const [key] of state.responses) state.responses.set(key, { data: key === 'qm_audits' || key === 'qm_changes' ? [] : null, count: 0, error: null });
    const result = await readQmDashboardSnapshot(tenant);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sectionErrors).toEqual({});
    expect(buildQmDashboardKpis(result.data).every(kpi => kpi.value === '0')).toBe(true);
    expect(result.data.upcomingAudits).toEqual([]);
  });

  it('rejects an entire section when any supplied record belongs to another tenant', async () => {
    state.responses.set('qm_audits', { data: [audit, { ...audit, id: 'foreign', tenant_id: 'other' }], error: null });
    state.responses.set('qm_changes', { data: [{ ...change, tenant_id: 'other' }], error: null });
    const result = await readQmDashboardSnapshot(tenant);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.upcomingAudits).toEqual([]); expect(result.data.recentChanges).toEqual([]);
    expect(result.data.sectionErrors?.audits).toContain('Mandanten'); expect(result.data.sectionErrors?.changes).toContain('Mandanten');
  });

  it('keeps successful sections after a rejected request, but fails if nothing could load', async () => {
    state.rejected.add('qm_audits');
    const partial = await readQmDashboardSnapshot(tenant);
    expect(partial.ok).toBe(true); if (!partial.ok) return;
    expect(partial.data.sectionErrors?.audits).toContain('Verbindung');
    expect(partial.data.documentCount).toBe(1702);
    for (const [key] of state.responses) state.rejected.add(key);
    expect(await readQmDashboardSnapshot(tenant)).toMatchObject({ ok: false });
  });
});
