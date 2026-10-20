import { describe, expect, it } from 'vitest';
import { resolveVisitExecutionPhase } from '@/lib/portal/resolveVisitExecutionPhase';
import { resolveVisitExecutionUiState } from '@/lib/portal/resolveVisitExecutionUiState';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';

function baseVisit(
  overrides: Partial<EmployeePortalAssignmentDetail> = {},
): EmployeePortalAssignmentDetail {
  return {
    assignmentId: 'a1',
    tenantId: 't1',
    title: 'Test',
    clientId: 'c1',
    clientName: 'Klient',
    locationAddress: 'Str. 1',
    plannedStartAt: '2026-07-01T08:00:00Z',
    plannedEndAt: '2026-07-01T09:00:00Z',
    actualStartAt: null,
    actualEndAt: null,
    onTheWayAt: null,
    arrivedAt: null,
    status: 'geplant',
    canonicalStatus: 'confirmed',
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
    canStartExecution: true,
    canOpenRoute: true,
    canCaptureGps: true,
    allowedTransitions: [],
    isLocked: false,
    enabledModules: [],
    ...overrides,
  };
}

describe('resolveVisitExecutionPhase', () => {
  it('maps preview, en_route, arrived, live and post_service', () => {
    const visit = baseVisit();
    expect(
      resolveVisitExecutionPhase({
        effectiveStatus: 'bestaetigt',
        uiState: resolveVisitExecutionUiState({
          visit,
          effectiveStatus: 'bestaetigt',
          consistencyStatus: 'consistent',
          allowedActions: ['start_en_route'],
          awaitingSignature: false,
        }),
        isLocked: false,
      }),
    ).toBe('preview');

    expect(
      resolveVisitExecutionPhase({
        effectiveStatus: 'unterwegs',
        uiState: null,
        isLocked: false,
      }),
    ).toBe('en_route');

    expect(
      resolveVisitExecutionPhase({
        effectiveStatus: 'angekommen',
        uiState: null,
        isLocked: false,
      }),
    ).toBe('arrived');

    expect(
      resolveVisitExecutionPhase({
        effectiveStatus: 'gestartet',
        uiState: null,
        isLocked: false,
      }),
    ).toBe('live');

    expect(
      resolveVisitExecutionPhase({
        effectiveStatus: 'beendet',
        uiState: resolveVisitExecutionUiState({
          visit: baseVisit({ status: 'beendet', documentationStatus: 'draft' }),
          effectiveStatus: 'beendet',
          consistencyStatus: 'consistent',
          allowedActions: ['save_documentation'],
          awaitingSignature: false,
          hasServiceEnded: true,
        }),
        isLocked: false,
      }),
    ).toBe('post_service');
  });
});
