import { describe, expect, it } from 'vitest';
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
    status: 'beendet',
    canonicalStatus: 'in_progress',
    notesForEmployee: '',
    accessHints: null,
    emergencyContact: null,
    tasks: [],
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
    allowedTransitions: [],
    isLocked: false,
    enabledModules: [],
    ...overrides,
  };
}

describe('resolveVisitExecutionUiState', () => {
  it('shows signature when proof required and documentation submitted on confirmed status', () => {
    const state = resolveVisitExecutionUiState({
      visit: baseVisit({
        status: 'bestaetigt',
        documentationStatus: 'submitted',
      }),
      effectiveStatus: 'bestaetigt',
      consistencyStatus: 'consistent',
      allowedActions: ['open_route'],
      awaitingSignature: false,
      hasServiceEnded: false,
    });

    expect(state.showSignature).toBe(true);
  });

  it('shows signature when service ended but DB status still confirmed', () => {
    const state = resolveVisitExecutionUiState({
      visit: baseVisit({
        status: 'bestaetigt',
        documentationStatus: 'submitted',
      }),
      effectiveStatus: 'bestaetigt',
      consistencyStatus: 'consistent',
      allowedActions: ['open_route'],
      awaitingSignature: false,
      hasServiceEnded: true,
    });

    expect(state.showSignature).toBe(true);
  });

  it('shows signature panel when documentation submitted on beendet with requiresSignature', () => {
    const state = resolveVisitExecutionUiState({
      visit: baseVisit({ status: 'beendet' }),
      effectiveStatus: 'beendet',
      consistencyStatus: 'consistent',
      allowedActions: ['capture_signature', 'open_route'],
      awaitingSignature: false,
      hasServiceEnded: true,
    });

    expect(state.showSignature).toBe(true);
    expect(state.showDocumentationForm).toBe(false);
  });

  it('shows signature when awaitingSignature even if allowedActions not yet loaded', () => {
    const state = resolveVisitExecutionUiState({
      visit: baseVisit({ status: 'dokumentation_offen' }),
      effectiveStatus: 'dokumentation_offen',
      consistencyStatus: 'consistent',
      allowedActions: ['open_route'],
      awaitingSignature: true,
      hasServiceEnded: true,
    });

    expect(state.showSignature).toBe(true);
  });

  it('does not block documentation after valid service end despite repairable drift', () => {
    const state = resolveVisitExecutionUiState({
      visit: baseVisit({
        status: 'beendet',
        documentationStatus: 'draft',
      }),
      effectiveStatus: 'beendet',
      consistencyStatus: 'repairable',
      allowedActions: ['save_documentation', 'open_route'],
      awaitingSignature: false,
      hasServiceEnded: true,
    });

    expect(state.statusBlocksDoc).toBe(false);
    expect(state.showDocumentationForm).toBe(true);
  });

  it('blocks post-service doc when service never started and no documentation yet', () => {
    const state = resolveVisitExecutionUiState({
      visit: baseVisit({
        status: 'beendet',
        documentationStatus: 'draft',
      }),
      effectiveStatus: 'beendet',
      consistencyStatus: 'repairable',
      allowedActions: ['open_route'],
      awaitingSignature: false,
      hasServiceEnded: false,
    });

    expect(state.statusBlocksDoc).toBe(true);
    expect(state.showDocumentationForm).toBe(false);
  });

  it('shows finalize when finalize_visit is allowed', () => {
    const state = resolveVisitExecutionUiState({
      visit: baseVisit({
        status: 'dokumentation_offen',
        signatureStatus: 'captured',
      }),
      effectiveStatus: 'dokumentation_offen',
      consistencyStatus: 'consistent',
      allowedActions: ['finalize_visit', 'open_route'],
      awaitingSignature: false,
      hasServiceEnded: true,
    });

    expect(state.showFinalize).toBe(true);
    expect(state.showSignature).toBe(false);
  });

  it('hides finalize when finalize_visit not allowed', () => {
    const state = resolveVisitExecutionUiState({
      visit: baseVisit({
        status: 'dokumentation_offen',
        signatureStatus: 'pending',
      }),
      effectiveStatus: 'dokumentation_offen',
      consistencyStatus: 'consistent',
      allowedActions: ['capture_signature', 'open_route'],
      awaitingSignature: false,
      hasServiceEnded: true,
    });

    expect(state.showFinalize).toBe(false);
    expect(state.canFinalizeDeferred).toBe(false);
    expect(state.showSignature).toBe(true);
  });

  it('shows deferred finalize when finalize_visit_deferred_signature is allowed', () => {
    const state = resolveVisitExecutionUiState({
      visit: baseVisit({
        status: 'unterschrift_offen',
        signatureStatus: 'pending',
      }),
      effectiveStatus: 'unterschrift_offen',
      consistencyStatus: 'consistent',
      allowedActions: ['finalize_visit_deferred_signature', 'capture_signature', 'open_route'],
      awaitingSignature: false,
      hasServiceEnded: true,
    });

    expect(state.canFinalizeDeferred).toBe(true);
    expect(state.showFinalize).toBe(false);
    expect(state.showSignature).toBe(true);
  });

  it('hides signature panel when deferred to client portal', () => {
    const state = resolveVisitExecutionUiState({
      visit: baseVisit({
        status: 'abgeschlossen',
        signatureStatus: 'deferred_to_client_portal',
        isLocked: true,
      }),
      effectiveStatus: 'abgeschlossen',
      consistencyStatus: 'consistent',
      allowedActions: ['open_route'],
      awaitingSignature: false,
      hasServiceEnded: true,
    });

    expect(state.signatureDeferred).toBe(true);
    expect(state.showSignature).toBe(false);
  });
});
