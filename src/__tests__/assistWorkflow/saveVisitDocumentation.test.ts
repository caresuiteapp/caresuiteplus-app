import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

const TENANT = DEMO_TENANT_ID;
const ASSIGNMENT = '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab';
const EMPLOYEE = 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2';

function buildCtx(overrides?: Partial<AssistExecutionContext>): AssistExecutionContext {
  return {
    tenantId: TENANT,
    assignmentId: ASSIGNMENT,
    employeeId: EMPLOYEE,
    profileId: 'profile-1',
    roleKey: 'employee_portal',
    assistVisitId: '',
    assignmentStatus: 'beendet',
    derivedStatus: 'beendet',
    consistencyStatus: 'consistent',
    inconsistencies: [],
    repairOptions: [],
    detail: {
      assignmentId: ASSIGNMENT,
      tenantId: TENANT,
      title: 'Alltagsbegleitung',
      clientId: 'client-1',
      clientName: 'Heinz-Peter Reinhardt',
      locationAddress: 'Musterstraße 1',
      plannedStartAt: '2026-07-01T09:00:00.000Z',
      plannedEndAt: '2026-07-01T11:00:00.000Z',
      actualStartAt: null,
      actualEndAt: null,
      onTheWayAt: null,
      arrivedAt: null,
      status: 'beendet',
      canonicalStatus: 'finished',
      notesForEmployee: '',
      accessHints: null,
      emergencyContact: null,
      tasks: [],
      statusHistory: [],
      pauseEvents: [],
      documentationStatus: 'none',
      signatureStatus: 'none',
      requiresSignature: true,
      requiresDocumentation: true,
      requiresRoute: true,
      canStartExecution: false,
      canOpenRoute: false,
      canCaptureGps: false,
      allowedTransitions: ['dokumentation_offen'],
      isLocked: false,
      enabledModules: [],
    },
    visitTimes: {
      driveSeconds: 60,
      serviceSeconds: 900,
      pauseSeconds: null,
      totalSeconds: 960,
      driveStartedAt: '2026-07-01T08:00:00.000Z',
      serviceStartedAt: '2026-07-01T09:00:00.000Z',
      pauseStartedAt: null,
      arrivedAt: '2026-07-01T08:30:00.000Z',
      serviceEndedAt: '2026-07-01T10:00:00.000Z',
      activeTimer: null,
    },
    timeEvents: [],
    liveContext: null,
    allowedActions: ['save_documentation'],
    diagnostics: {
      isServiceStarted: true,
      isServiceEnded: true,
      isTravelEnded: true,
      canEndService: false,
      inconsistentStatus: false,
      repairHint: null,
    },
    ...overrides,
  };
}

describe('saveVisitDocumentation — visit resolution', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('fails in supabase mode when assist visit id cannot be resolved', async () => {
    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/assist/assistExecutionVisitResolver', () => ({
      resolveAssistVisitIdForPersistence: vi.fn(async () => null),
    }));

    const { saveVisitDocumentation } = await import('@/features/assistWorkflow/saveVisitDocumentation');
    const result = await saveVisitDocumentation({
      ctx: buildCtx(),
      documentation: {
        shortDescription: 'Alles erledigt',
        referralRequired: false,
        emergencyOrProblem: false,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('nicht zugeordnet');
    }
  }, 15000);
  it('requires a fresh signature after an open signed visit is documented again', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
    vi.doMock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => ({ upsert }) }));
    vi.doMock('@/lib/async/deferredTask', () => ({ scheduleDeferredTask: vi.fn() }));
    const ctx = buildCtx({ assistVisitId: ASSIGNMENT, assignmentStatus: 'unterschrift_offen', derivedStatus: 'unterschrift_offen' });
    ctx.detail = { ...ctx.detail, status: 'unterschrift_offen', documentationStatus: 'submitted', signatureStatus: 'captured', actualEndAt: '2026-07-01T10:00:00Z' };
    const { saveVisitDocumentation } = await import('@/features/assistWorkflow/saveVisitDocumentation');
    const result = await saveVisitDocumentation({ ctx, documentation: { shortDescription: 'Leistung ergänzt', referralRequired: false, emergencyOrProblem: false } });
    expect(result.ok).toBe(true);
    expect(upsert).toHaveBeenCalledOnce();
    if (result.ok) {
      expect(result.data.ctx.detail.signatureStatus).toBe('pending');
      expect(result.data.ctx.allowedActions).not.toContain('finalize_visit');
      expect(result.data.ctx.allowedActions).toContain('capture_signature');
    }
  });
  it('does not claim a documentation correction succeeded when persistence rejects it', async () => {
    vi.doMock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => ({ upsert: async () => ({ error: { message: 'Einsatz abgeschlossen', code: 'P0001' } }) }) }));
    const ctx = buildCtx({ assistVisitId: ASSIGNMENT, assignmentStatus: 'unterschrift_offen' });
    ctx.detail.signatureStatus = 'captured';
    const { saveVisitDocumentation } = await import('@/features/assistWorkflow/saveVisitDocumentation');
    const result = await saveVisitDocumentation({ ctx, documentation: { shortDescription: 'Leistung ergänzt', referralRequired: false, emergencyOrProblem: false } });
    expect(result.ok).toBe(false);
    expect(ctx.detail.signatureStatus).toBe('captured');
  });

});
