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
      signatureStatus: 'captured',
      requiresSignature: true,
      requiresDocumentation: true,
      requiresRoute: true,
      canStartExecution: false,
      canOpenRoute: true,
      canCaptureGps: true,
      allowedTransitions: ['abgeschlossen'],
      isLocked: false,
      enabledModules: { gps: true, route: true, documentation: true, signature: true },
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
    allowedActions: ['finalize_visit'],
    diagnostics: {
      consistencyStatus: 'consistent',
      inconsistencies: [],
      repairOptions: [],
      nextActionHint: null,
    },
    ...overrides,
  };
}

describe('finalizeVisit — proof + completion sync', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it(
    'blocks finalize in supabase mode when Leistungsnachweis persistence fails',
    async () => {
    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/portal/resolveEmployeePortalSignatureRequirement', () => ({
      hasPortalPersistedClientSignature: vi.fn(async () => true),
    }));
    vi.doMock('@/features/assistWorkflow/generateServiceRecord', () => ({
      generateServiceRecord: vi.fn(async () => ({
        ok: true,
        data: { serviceRecordId: null, proofPersisted: false, html: '<p/>' },
      })),
    }));
    vi.doMock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({
      transitionAssistExecutionStatus: vi.fn(),
    }));
    vi.doMock('@/lib/wfm/wfmAssistAdapter', () => ({
      syncAssistVisitTimesToWfm: vi.fn(async () => ({ ok: true })),
    }));

    const { finalizeVisit } = await import('@/features/assistWorkflow/finalizeVisit');
    const result = await finalizeVisit(buildCtx(), 'Erledigt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Leistungsnachweis');
    }
  },
  15000,
  );

  it('completes when proof persisted and transition succeeds', async () => {
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
        data: buildCtx({ assignmentStatus: 'abgeschlossen', derivedStatus: 'abgeschlossen' }),
      })),
    }));
    vi.doMock('@/features/assistWorkflow/assistVisitExecutionStatePersistence', () => ({
      upsertAssistVisitExecutionState: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock('@/lib/wfm/wfmAssistAdapter', () => ({
      syncAssistVisitTimesToWfm: vi.fn(async () => ({ ok: true })),
    }));

    const { finalizeVisit } = await import('@/features/assistWorkflow/finalizeVisit');
    const result = await finalizeVisit(buildCtx(), 'Erledigt');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proofPersisted).toBe(true);
      expect(result.data.ctx.assignmentStatus).toBe('abgeschlossen');
    }
  });

  it('regression: incomplete proof persist blocks finalize (no silent idempotent ok)', async () => {
    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/portal/resolveEmployeePortalSignatureRequirement', () => ({
      hasPortalPersistedClientSignature: vi.fn(async () => true),
    }));
    vi.doMock('@/features/assistWorkflow/generateServiceRecord', () => ({
      generateServiceRecord: vi.fn(async () => ({
        ok: false,
        error: 'Leistungsnachweis unvollständig — payload_hash fehlt.',
      })),
    }));
    vi.doMock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({
      transitionAssistExecutionStatus: vi.fn(),
    }));

    const { finalizeVisit } = await import('@/features/assistWorkflow/finalizeVisit');
    const result = await finalizeVisit(buildCtx(), 'Erledigt');
    expect(result.ok).toBe(false);
  });

  it('regression: idempotent complete proof allows finalize', async () => {
    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/portal/resolveEmployeePortalSignatureRequirement', () => ({
      hasPortalPersistedClientSignature: vi.fn(async () => true),
    }));
    vi.doMock('@/features/assistWorkflow/generateServiceRecord', () => ({
      generateServiceRecord: vi.fn(async () => ({
        ok: true,
        data: {
          serviceRecordId: 'sr-existing',
          proofPersisted: true,
          html: '<p/>',
        },
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

    const { finalizeVisit } = await import('@/features/assistWorkflow/finalizeVisit');
    const result = await finalizeVisit(buildCtx(), 'Erledigt');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proofPersisted).toBe(true);
    }
  });
});
