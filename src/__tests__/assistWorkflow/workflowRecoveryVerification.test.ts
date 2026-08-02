import { describe, expect, it } from 'vitest';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
import { didWorkflowActionReachPostcondition } from '@/features/assistWorkflow/workflowRecoveryVerification';

function context(
  status: AssistExecutionContext['assignmentStatus'],
  detailOverrides: Partial<AssistExecutionContext['detail']> = {},
  timeOverrides: Partial<NonNullable<AssistExecutionContext['visitTimes']>> = {},
): AssistExecutionContext {
  return {
    tenantId: 'tenant-1',
    assignmentId: 'assignment-1',
    employeeId: 'employee-1',
    profileId: 'profile-1',
    roleKey: 'employee_portal',
    assistVisitId: 'visit-1',
    assignmentStatus: status,
    derivedStatus: status,
    consistencyStatus: 'consistent',
    inconsistencies: [],
    repairOptions: [],
    detail: {
      assignmentId: 'assignment-1',
      tenantId: 'tenant-1',
      title: 'Alltagsbegleitung',
      clientId: 'client-1',
      clientName: 'Klient',
      locationAddress: 'Musterstraße 1',
      plannedStartAt: '2026-08-02T08:00:00.000Z',
      plannedEndAt: '2026-08-02T10:00:00.000Z',
      actualStartAt: null,
      actualEndAt: null,
      onTheWayAt: null,
      arrivedAt: null,
      status,
      canonicalStatus: 'planned',
      notesForEmployee: '',
      accessHints: null,
      emergencyContact: null,
      tasks: [],
      statusHistory: [],
      pauseEvents: [],
      documentationStatus: 'none',
      signatureStatus: 'pending',
      requiresSignature: true,
      requiresDocumentation: true,
      requiresRoute: true,
      canStartExecution: true,
      canOpenRoute: true,
      canCaptureGps: true,
      allowedTransitions: [],
      isLocked: false,
      enabledModules: [],
      ...detailOverrides,
    },
    liveContext: null,
    visitTimes: {
      driveSeconds: null,
      serviceSeconds: null,
      pauseSeconds: null,
      totalSeconds: null,
      driveStartedAt: null,
      serviceStartedAt: null,
      pauseStartedAt: null,
      arrivedAt: null,
      serviceEndedAt: null,
      activeTimer: null,
      ...timeOverrides,
    },
    timeEvents: [],
    allowedActions: [],
    diagnostics: {
      isServiceStarted: false,
      isServiceEnded: false,
      isTravelEnded: false,
      canEndService: false,
      inconsistentStatus: false,
      repairHint: null,
    },
  };
}

describe('workflow timeout/stale recovery postconditions', () => {
  it('does not report success when a refresh only returns the unchanged context', () => {
    const unchanged = context('angekommen', { arrivedAt: '2026-08-02T07:55:00.000Z' });
    expect(didWorkflowActionReachPostcondition('start_service', unchanged, unchanged)).toBe(false);
  });

  it('confirms service start only with durable start timestamp and status', () => {
    const before = context('angekommen', { arrivedAt: '2026-08-02T07:55:00.000Z' });
    const after = context(
      'gestartet',
      { actualStartAt: '2026-08-02T08:00:00.000Z' },
      { serviceStartedAt: '2026-08-02T08:00:00.000Z', activeTimer: 'service' },
    );
    expect(didWorkflowActionReachPostcondition('start_service', before, after)).toBe(true);
  });

  it('distinguishes an open signature step from an actually captured signature', () => {
    const before = context('dokumentation_offen', { documentationStatus: 'submitted' });
    const pending = context('unterschrift_offen', { documentationStatus: 'submitted', signatureStatus: 'pending' });
    const captured = context('unterschrift_offen', { documentationStatus: 'submitted', signatureStatus: 'captured' });
    expect(didWorkflowActionReachPostcondition('save_signature', before, pending)).toBe(false);
    expect(didWorkflowActionReachPostcondition('save_signature', before, captured)).toBe(true);
  });

  it('confirms pause end only when a previous pause is no longer active', () => {
    const before = context('pausiert', {}, { activeTimer: 'pause', pauseStartedAt: '2026-08-02T09:00:00.000Z' });
    const after = context('gestartet', {}, { activeTimer: 'service', pauseSeconds: 300 });
    expect(didWorkflowActionReachPostcondition('end_pause', before, after)).toBe(true);
    expect(didWorkflowActionReachPostcondition('end_pause', before, before)).toBe(false);
  });

  it('requires the deferred portal marker for deferred finalization recovery', () => {
    const before = context('unterschrift_offen', { documentationStatus: 'submitted' });
    const normal = context('abgeschlossen', { signatureStatus: 'captured', isLocked: true });
    const deferred = context('abgeschlossen', { signatureStatus: 'deferred_to_client_portal', isLocked: true });
    expect(didWorkflowActionReachPostcondition('finalize_deferred', before, normal)).toBe(false);
    expect(didWorkflowActionReachPostcondition('finalize_deferred', before, deferred)).toBe(true);
  });

  it('never treats no-show as a normal or deferred completion', () => {
    const before = context('unterschrift_offen', { documentationStatus: 'submitted' });
    const noShow = context('nicht_erschienen', { isLocked: true });
    expect(didWorkflowActionReachPostcondition('finalize', before, noShow)).toBe(false);
    expect(didWorkflowActionReachPostcondition('finalize_deferred', before, noShow)).toBe(false);
    expect(didWorkflowActionReachPostcondition('report_no_show', before, noShow)).toBe(true);
  });
});
