import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

const TENANT = DEMO_TENANT_ID;
const VISIT = 'visit-rpc-sync-1';

const rpcMock = vi.fn();
const fetchTimeEventsMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({
  fetchTimeEventsForVisit: (...args: unknown[]) => fetchTimeEventsMock(...args),
}));

vi.mock('@/lib/wfm/wfmWorkSessionRepository', () => ({
  fetchSessionForDate: vi.fn(async () => ({ ok: true as const, data: null })),
  hasAssistWfmEvent: vi.fn(async () => false),
  insertWorkSession: vi.fn(async () => ({ ok: true as const, data: { id: 'session-1' } })),
  insertTimeEvent: vi.fn(async () => ({ ok: true as const, data: { id: 'evt-1' } })),
  resolveAuthUserIdForWfmSession: vi.fn(async () => 'auth-user-1'),
  resolveEmployeeIdForUser: vi.fn(async () => ({ ok: true as const, data: 'employee-1' })),
  updateWorkSession: vi.fn(async (_id: string, patch: Record<string, unknown>) => ({
    ok: true as const,
    data: { id: 'session-1', ...patch },
  })),
  workDateFromIso: (iso: string) => iso.slice(0, 10),
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  rpcMock.mockReset();
  fetchTimeEventsMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('syncAssistVisitTimesToWfm — RPC path', () => {
  it('returns ok when RPC inserts mirrored events', async () => {
    rpcMock.mockResolvedValue({ data: 5, error: null });

    const { syncAssistVisitTimesToWfm } = await import('@/lib/wfm/wfmAssistAdapter');
    const result = await syncAssistVisitTimesToWfm(TENANT, 'employee-1', 'auth-user-1', VISIT);

    expect(result.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('sync_assist_visit_times_to_wfm', {
      p_tenant_id: TENANT,
      p_visit_id: VISIT,
    });
    expect(fetchTimeEventsMock).not.toHaveBeenCalled();
  });

  it('fails when RPC returns 0 but assist events are mappable', async () => {
    rpcMock.mockResolvedValue({ data: 0, error: null });
    fetchTimeEventsMock.mockResolvedValue({
      ok: true,
      data: [
        { eventType: 'service_start', occurredAt: '2026-07-02T08:00:00.000Z' },
        { eventType: 'service_end', occurredAt: '2026-07-02T09:00:00.000Z' },
      ],
    });

    const { syncAssistVisitTimesToWfm } = await import('@/lib/wfm/wfmAssistAdapter');
    const result = await syncAssistVisitTimesToWfm(TENANT, 'employee-1', 'auth-user-1', VISIT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('keine Zeitereignisse gespiegelt');
    }
  });

  it('surfaces tenant access RPC errors without client fallback', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'sync_assist_visit_times_to_wfm: tenant access denied' },
    });

    const { syncAssistVisitTimesToWfm } = await import('@/lib/wfm/wfmAssistAdapter');
    const result = await syncAssistVisitTimesToWfm(TENANT, 'employee-1', 'auth-user-1', VISIT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('tenant access denied');
    }
  });

  it('falls back to client mirror only when RPC migration is missing', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'function sync_assist_visit_times_to_wfm does not exist' },
    });
    fetchTimeEventsMock.mockResolvedValue({
      ok: true,
      data: [{ eventType: 'service_start', occurredAt: '2026-07-02T08:00:00.000Z' }],
    });

    const { syncAssistVisitTimesToWfm } = await import('@/lib/wfm/wfmAssistAdapter');
    const result = await syncAssistVisitTimesToWfm(TENANT, 'employee-1', 'auth-user-1', VISIT);

    expect(result.ok).toBe(true);
  });
});

describe('finalizeVisit WFM dual-scoring signal', () => {
  it('sets wfmSyncFailed when RPC returns zero-insert with assist proxy events', async () => {
    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/portal/resolveEmployeePortalSignatureRequirement', () => ({
      hasPortalPersistedClientSignature: vi.fn(async () => true),
    }));
    vi.doMock('@/features/assistWorkflow/generateServiceRecord', () => ({
      generateServiceRecord: vi.fn(async () => ({
        ok: true,
        data: { serviceRecordId: 'sr-1', proofPersisted: true, html: '<p/>' },
      })),
    }));
    vi.doMock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({
      transitionAssistExecutionStatus: vi.fn(async () => ({
        ok: true,
        data: {
          tenantId: TENANT,
          assignmentId: VISIT,
          employeeId: 'employee-1',
          profileId: 'auth-user-1',
          roleKey: 'employee_portal',
          assistVisitId: VISIT,
          assignmentStatus: 'abgeschlossen',
          derivedStatus: 'abgeschlossen',
          consistencyStatus: 'consistent',
          inconsistencies: [],
          repairOptions: [],
          detail: {
            assignmentId: VISIT,
            tenantId: TENANT,
            title: 'Test',
            clientId: 'client-1',
            clientName: 'Test',
            locationAddress: 'X',
            plannedStartAt: null,
            plannedEndAt: null,
            actualStartAt: null,
            actualEndAt: null,
            status: 'abgeschlossen',
            canonicalStatus: 'completed',
            notesForEmployee: '',
            accessHints: null,
            emergencyContact: null,
            tasks: [{ id: 't1', title: 'T', description: null, required: true, status: 'done', completionNote: null, requiresNote: false }],
            statusHistory: [],
            pauseEvents: [],
            documentationStatus: 'submitted',
            signatureStatus: 'captured',
            requiresSignature: true,
            requiresDocumentation: true,
            requiresRoute: false,
            canStartExecution: false,
            canOpenRoute: false,
            canCaptureGps: false,
            allowedTransitions: [],
            isLocked: true,
            enabledModules: { gps: false, route: false, documentation: true, signature: true },
          },
          visitTimes: null,
          timeEvents: [],
          liveContext: null,
          allowedActions: [],
          diagnostics: {
            consistencyStatus: 'consistent',
            inconsistencies: [],
            repairOptions: [],
            nextActionHint: null,
          },
        },
      })),
    }));
    vi.doMock('@/features/assistWorkflow/assistVisitExecutionStatePersistence', () => ({
      upsertAssistVisitExecutionState: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock('@/lib/wfm/wfmAssistAdapter', () => ({
      syncAssistVisitTimesToWfm: vi.fn(async () => ({
        ok: false,
        error: 'WFM-Sync-RPC hat keine Zeitereignisse gespiegelt.',
      })),
    }));

    const { finalizeVisit } = await import('@/features/assistWorkflow/finalizeVisit');
    const result = await finalizeVisit(
      {
        tenantId: TENANT,
        assignmentId: VISIT,
        employeeId: 'employee-1',
        profileId: 'auth-user-1',
        roleKey: 'employee_portal',
        assistVisitId: VISIT,
        assignmentStatus: 'unterschrift_offen',
        derivedStatus: 'unterschrift_offen',
        consistencyStatus: 'consistent',
        inconsistencies: [],
        repairOptions: [],
        detail: {
          assignmentId: VISIT,
          tenantId: TENANT,
          title: 'Test',
          clientId: 'client-1',
          clientName: 'Test',
          locationAddress: 'X',
          plannedStartAt: null,
          plannedEndAt: null,
          actualStartAt: null,
          actualEndAt: null,
          status: 'unterschrift_offen',
          canonicalStatus: 'signature_open',
          notesForEmployee: '',
          accessHints: null,
          emergencyContact: null,
          tasks: [{ id: 't1', title: 'T', description: null, required: true, status: 'done', completionNote: null, requiresNote: false }],
          statusHistory: [],
          pauseEvents: [],
          documentationStatus: 'submitted',
          signatureStatus: 'captured',
          requiresSignature: true,
          requiresDocumentation: true,
          requiresRoute: false,
          canStartExecution: false,
          canOpenRoute: false,
          canCaptureGps: false,
          allowedTransitions: ['abgeschlossen'],
          isLocked: false,
          enabledModules: { gps: false, route: false, documentation: true, signature: true },
        },
        visitTimes: null,
        timeEvents: [{ eventType: 'service_end', occurredAt: '2026-07-02T09:00:00.000Z' }],
        liveContext: null,
        allowedActions: ['finalize_visit'],
        diagnostics: {
          consistencyStatus: 'consistent',
          inconsistencies: [],
          repairOptions: [],
          nextActionHint: null,
        },
      },
      'Erledigt',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.wfmSyncFailed).toBe(true);
    }
  });
});
