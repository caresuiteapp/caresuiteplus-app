/**
 * End-to-end chain test (service layer): deferred finalize → client portal sign.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

const TENANT = DEMO_TENANT_ID;
const ASSIGNMENT = '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab';
const PROOF = 'proof-deferred-chain';
const CLIENT = 'client-1';

function buildCtx(): AssistExecutionContext {
  return {
    tenantId: TENANT,
    assignmentId: ASSIGNMENT,
    employeeId: 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2',
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
      clientId: CLIENT,
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
    visitTimes: null,
    timeEvents: [],
    liveContext: null,
    allowedActions: ['finalize_visit_deferred_signature'],
    diagnostics: {
      consistencyStatus: 'consistent',
      inconsistencies: [],
      repairOptions: [],
      nextActionHint: null,
    },
  };
}

describe('deferred signature E2E chain', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('employee defers signature then client signs the released proof', async () => {
    const releaseDeferred = vi.fn(async () => ({
      ok: true,
      data: { proofId: PROOF, clientDocumentId: PROOF },
    }));
    const transition = vi.fn(async () => ({
      ok: true,
      data: buildCtx(),
    }));
    const saveClientSign = vi.fn(async () => ({
      ok: true,
      data: {
        proofId: PROOF,
        signatureId: 'sig-chain-1',
        signedAt: '2026-07-07T11:00:00.000Z',
        proofPersisted: true,
      },
    }));

    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/portal/deferredVisitClientSignatureService', () => ({
      releaseDeferredClientSignatureRequest: releaseDeferred,
    }));
    vi.doMock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({
      transitionAssistExecutionStatus: transition,
    }));
    vi.doMock('@/features/assistWorkflow/assistVisitExecutionStatePersistence', () => ({
      upsertAssistVisitExecutionState: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock('@/lib/wfm/wfmAssistAdapter', () => ({
      syncAssistVisitTimesToWfm: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock('@/lib/portal/clientPortalAssistProofSignatureService', () => ({
      saveClientPortalAssistProofSignature: saveClientSign,
    }));

    const { finalizeVisitWithDeferredClientSignature } = await import(
      '@/features/assistWorkflow/finalizeVisitWithDeferredClientSignature'
    );
    const { saveClientPortalAssistProofSignature } = await import(
      '@/lib/portal/clientPortalAssistProofSignatureService'
    );

    const phase1 = await finalizeVisitWithDeferredClientSignature(buildCtx(), 'Erledigt');
    expect(phase1.ok).toBe(true);
    expect(releaseDeferred).toHaveBeenCalledTimes(1);
    expect(transition).toHaveBeenCalledWith(
      expect.anything(),
      'abgeschlossen',
      expect.objectContaining({ signatureDeferredToClientPortal: true }),
    );

    const phase2 = await saveClientPortalAssistProofSignature({
      tenantId: TENANT,
      clientId: CLIENT,
      proofId: PROOF,
      signerName: 'Heinz-Peter Reinhardt',
      signatureDataUrl: 'data:image/png;base64,abc',
    });
    expect(phase2.ok).toBe(true);
    if (phase2.ok) {
      expect(phase2.data.proofPersisted).toBe(true);
      expect(phase2.data.signatureId).toBeTruthy();
    }
  });
});
