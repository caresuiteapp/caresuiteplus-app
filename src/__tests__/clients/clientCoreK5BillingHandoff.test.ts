import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import {
  getProofBillingSourceSnapshot,
  mapApprovedProofToBillingCandidate,
  mapProofTasksToBillingSnapshot,
  validateProofForBilling,
} from '@/lib/billing/clientProofBillingMapper';
import {
  getBillingBlockingReasons,
  isCandidateDraftable,
  neverFinalizeInvoice,
  resolveCandidateStatus,
} from '@/lib/billing/clientBillingReadinessService';
import { calculateBudgetConsumptionForCandidate } from '@/lib/billing/clientBudgetConsumptionService';
import { sanitizeClientPortalPayload, sanitizeEmployeePortalPayload } from '@/lib/portal/portalVisibilityService';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function sampleProof(overrides: Partial<AssistVisitProofRow> = {}): AssistVisitProofRow {
  return {
    id: 'proof-1',
    tenantId: 'tenant-1',
    visitId: 'visit-1',
    signatureId: 'sig-1',
    proofNumber: 'LN-001',
    status: 'approved',
    storagePath: null,
    payloadSnapshot: {
      clientName: 'Max Mustermann',
      serviceStartAt: '2026-06-01T08:00:00.000Z',
      serviceEndAt: '2026-06-01T09:30:00.000Z',
      signerName: 'Max Mustermann',
      tasks: [{ title: 'Begleitung', status: 'done' }],
    },
    payloadHash: null,
    generatedAt: '2026-06-01T10:00:00.000Z',
    generatedBy: 'user-1',
    approvedAt: '2026-06-01T11:00:00.000Z',
    approvedBy: 'user-2',
    billingReleased: false,
    portalVisible: false,
    releasedToPortalAt: null,
    portalReleaseStatus: 'none',
    approvalNote: null,
    rejectionReason: null,
    pdfStoragePath: null,
    pdfHash: null,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T11:00:00.000Z',
    ...overrides,
  };
}

describe('K.5 — proof billing mapper', () => {
  it('maps tasks from proof snapshot', () => {
    const tasks = mapProofTasksToBillingSnapshot({
      tasks: [{ title: 'Einkauf', status: 'done' }, 'Spaziergang'],
    });
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.title).toBe('Einkauf');
    expect(tasks[1]?.title).toBe('Spaziergang');
  });

  it('validates only approved/exported proofs', () => {
    expect(validateProofForBilling(sampleProof()).ok).toBe(true);
    expect(validateProofForBilling(sampleProof({ status: 'draft' })).ok).toBe(false);
    expect(validateProofForBilling(sampleProof({ status: 'rejected' })).ok).toBe(false);
  });

  it('maps approved proof to billing candidate draft', () => {
    const proof = sampleProof();
    const visit = {
      id: 'visit-1',
      client_id: 'client-1',
      service_key: 'alltagsbegleitung',
      service_name: 'Alltagsbegleitung',
      planned_start_at: '2026-06-01T08:00:00.000Z',
      planned_end_at: '2026-06-01T09:30:00.000Z',
      duration_minutes: 90,
      budget_amount_cents: null,
    };
    const mapped = mapApprovedProofToBillingCandidate('tenant-1', proof, visit, {
      rateAmount: 35,
      serviceTypeId: 'type-1',
    });
    expect('clientId' in mapped && mapped.clientId).toBe('client-1');
    if ('clientId' in mapped) {
      expect(mapped.amountPreviewCents).toBeGreaterThan(0);
      expect(mapped.durationMinutes).toBe(90);
    }
  });

  it('builds source snapshot with signed/approved flags', () => {
    const snap = getProofBillingSourceSnapshot(sampleProof(), null);
    expect(snap.signed).toBe(true);
    expect(snap.approved).toBe(true);
    expect(snap.durationMinutes).toBe(90);
  });
});

describe('K.5 — billing readiness', () => {
  it('neverFinalizeInvoice blocks final invoice creation', () => {
    const guard = neverFinalizeInvoice();
    expect(guard.allowed).toBe(false);
    expect(guard.reason).toContain('K.5');
  });

  it('collects blocking reasons for missing budget and rate', () => {
    const source = getProofBillingSourceSnapshot(sampleProof(), null);
    const reasons = getBillingBlockingReasons({
      source,
      budgetSettings: [],
      amountPreviewCents: 0,
    });
    expect(reasons).toContain('missing_budget_setting');
    expect(reasons).toContain('missing_rate');
    expect(reasons).toContain('amount_zero');
  });

  it('resolves candidate status from blockers', () => {
    expect(resolveCandidateStatus([], 5000)).toBe('draftable');
    expect(resolveCandidateStatus(['missing_signature'], 5000)).toBe('blocked');
    expect(resolveCandidateStatus(['missing_cost_carrier'], 5000)).toBe('ready_for_review');
    expect(resolveCandidateStatus([], 0)).toBe('not_ready');
  });

  it('isCandidateDraftable respects blockers and amount', () => {
    expect(
      isCandidateDraftable({
        status: 'draftable',
        blockingReasons: [],
        amountPreviewCents: 1000,
      }),
    ).toBe(true);
    expect(
      isCandidateDraftable({
        status: 'blocked',
        blockingReasons: ['missing_signature'],
        amountPreviewCents: 1000,
      }),
    ).toBe(false);
  });
});

describe('K.5 — budget consumption', () => {
  it('calculates consumption amount from candidate preview', () => {
    const result = calculateBudgetConsumptionForCandidate({
      amountPreviewCents: 3500,
      durationMinutes: 60,
      budgetSettingId: 'bs-1',
    });
    expect(result.amountCents).toBe(3500);
    expect(result.budgetSettingId).toBe('bs-1');
  });
});

describe('K.5 — portal non-disclosure', () => {
  it('strips billing internals from client portal payloads', () => {
    const sanitized = sanitizeClientPortalPayload({
      clientName: 'Max',
      billingCandidate: { id: 'c-1' },
      blockingReasons: ['missing_rate'],
      invoiceDraft: { total: 100 },
    });
    expect(sanitized.clientName).toBe('Max');
    expect(sanitized.billingCandidate).toBeUndefined();
    expect(sanitized.blockingReasons).toBeUndefined();
    expect(sanitized.invoiceDraft).toBeUndefined();
  });

  it('strips billing internals from employee portal payloads', () => {
    const sanitized = sanitizeEmployeePortalPayload({
      displayName: 'Max',
      budgetMovements: [{ amount: 1 }],
      billingCandidates: [],
    });
    expect(sanitized.displayName).toBe('Max');
    expect(sanitized.budgetMovements).toBeUndefined();
    expect(sanitized.billingCandidates).toBeUndefined();
  });

  it('client portal projection does not import billing candidate services', () => {
    const projection = readSrc('src/lib/portal/clientPortalProjectionService.ts');
    expect(projection).not.toContain('clientBillingCandidateService');
    expect(projection).not.toContain('clientBillingPreviewService');
    expect(projection).not.toContain('getBillingCandidatesForClient');
  });
});

describe('K.5 — UI wiring', () => {
  it('ClientBudgetCorePanel includes billing prep panel', () => {
    const panel = readSrc('src/components/office/ClientBudgetCorePanel.tsx');
    expect(panel).toContain('ClientBillingPrepPanel');
    expect(panel).not.toMatch(/Rechnung final|final erstellen/i);
  });

  it('ClientRecordShiftsPanel includes proof billing status', () => {
    const panel = readSrc('src/components/office/ClientRecordShiftsPanel.tsx');
    expect(panel).toContain('ClientProofBillingStatusPanel');
  });

  it('office billing preparation route exists without final invoice action', () => {
    const screen = readSrc('app/office/billing-preparation.tsx');
    expect(screen).toContain('getDraftableBillingCandidates');
    expect(screen).not.toMatch(/Rechnung senden|final erstellen/i);
  });

  it('tenant service types screen loads billing rules', () => {
    const screen = readSrc('app/settings/tenant/client-service-types.tsx');
    expect(screen).toContain('listTenantServiceTypeBillingRules');
    expect(screen).toContain('updateTenantServiceTypeBillingRule');
  });
});

describe('K.5 — candidate service idempotency guard', () => {
  it('upsert uses proof_id unique constraint in migration', () => {
    const migration = readSrc('supabase/migrations/0160_client_billing_handoff_foundation.sql');
    expect(migration).toContain('UNIQUE (tenant_id, proof_id)');
    expect(migration).not.toMatch(/invoice_number|final_invoice/i);
  });
});
