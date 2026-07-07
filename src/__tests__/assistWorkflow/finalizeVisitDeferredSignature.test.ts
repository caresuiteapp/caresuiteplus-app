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
    assistVisitId: ASSIGNMENT,
    assignmentStatus: 'unterschrift_offen',
    derivedStatus: 'unterschrift_offen',
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
      status: 'unterschrift_offen',
      canonicalStatus: 'signature_open',
      notesForEmployee: '',
      accessHints: null,
      emergencyContact: null,
      tasks: [
        {
          id: 't1',
          title: 'Begleitung',
          description: null,
          required: true,
          status: 'done',
          completionNote: null,
          requiresNote: false,
        },
      ],
      statusHistory: [],
      pauseEvents: [],
      documentationStatus: 'submitted',
      signatureStatus: 'pending',
      requiresSignature: true,
      requiresDocumentation: true,
      requiresRoute: true,
      canStartExecution: false,
      canOpenRoute: true,
      canCaptureGps: true,
      allowedTransitions: ['abgeschlossen'],
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
    allowedActions: ['finalize_visit_deferred_signature'],
    diagnostics: {
      consistencyStatus: 'consistent',
      inconsistencies: [],
      repairOptions: [],
      nextActionHint: null,
    },
    ...overrides,
  };
}

describe('finalizeVisitWithDeferredClientSignature', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('blocks when signature is not required', async () => {
    const { finalizeVisitWithDeferredClientSignature } = await import(
      '@/features/assistWorkflow/finalizeVisitWithDeferredClientSignature'
    );
    const result = await finalizeVisitWithDeferredClientSignature(
      buildCtx({
        detail: {
          ...buildCtx().detail,
          requiresSignature: false,
        },
      }),
      'Erledigt',
    );
    expect(result.ok).toBe(false);
  });

  it('completes without on-device signature and releases portal request', async () => {
    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/portal/deferredVisitClientSignatureService', () => ({
      releaseDeferredClientSignatureRequest: vi.fn(async () => ({
        ok: true,
        data: { proofId: 'proof-1', clientDocumentId: 'doc-1' },
      })),
    }));
    vi.doMock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({
      transitionAssistExecutionStatus: vi.fn(async () => ({
        ok: true,
        data: buildCtx({ assignmentStatus: 'abgeschlossen', derivedStatus: 'abgeschlossen' }),
      })),
    }));
    vi.doMock('@/features/assistWorkflow/assistVisitExecutionStatePersistence', () => ({
      upsertAssistVisitExecutionState: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock('@/lib/wfm/wfmAssistAdapter', () => ({
      syncAssistVisitTimesToWfm: vi.fn(async () => ({ ok: true })),
    }));

    const { finalizeVisitWithDeferredClientSignature } = await import(
      '@/features/assistWorkflow/finalizeVisitWithDeferredClientSignature'
    );
    const result = await finalizeVisitWithDeferredClientSignature(buildCtx(), 'Erledigt');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proofId).toBe('proof-1');
      expect(result.data.ctx.detail.signatureStatus).toBe('deferred_to_client_portal');
      expect(result.data.ctx.assignmentStatus).toBe('abgeschlossen');
    }
  });

  it('blocks when portal release fails', async () => {
    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/portal/deferredVisitClientSignatureService', () => ({
      releaseDeferredClientSignatureRequest: vi.fn(async () => ({
        ok: false,
        error: 'Portal-Freigabe fehlgeschlagen.',
      })),
    }));

    const { finalizeVisitWithDeferredClientSignature } = await import(
      '@/features/assistWorkflow/finalizeVisitWithDeferredClientSignature'
    );
    const result = await finalizeVisitWithDeferredClientSignature(buildCtx(), 'Erledigt');
    expect(result.ok).toBe(false);
  });
});

describe('resolveAllowedActions — deferred signature finalize', () => {
  it('offers finalize_visit_deferred_signature when signature pending', async () => {
    const { resolveAllowedActions } = await import('@/features/assistWorkflow/resolveAllowedActions');
    const actions = resolveAllowedActions({
      assignmentStatus: 'unterschrift_offen',
      visitTimes: null,
      detail: {
        assignmentId: 'a1',
        title: 'Test',
        clientId: 'c1',
        clientName: 'Klient',
        locationAddress: 'Str. 1',
        plannedStartAt: '2026-07-01T08:00:00Z',
        plannedEndAt: '2026-07-01T09:00:00Z',
        status: 'unterschrift_offen',
        requiresSignature: true,
        requiresDocumentation: true,
        documentationStatus: 'submitted',
        signatureStatus: 'pending',
        tasks: [],
        allowedTransitions: [],
        isLocked: false,
      } as import('@/types/modules/employeePortalExecution').EmployeePortalAssignmentDetail,
      derivedStatus: 'unterschrift_offen',
    });
    expect(actions).toContain('finalize_visit_deferred_signature');
    expect(actions).toContain('capture_signature');
  });
});
