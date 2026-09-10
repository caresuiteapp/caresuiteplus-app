// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProofReviewWorkspace } from '@/components/assist/ProofReviewWorkspace.web';
import { buildReviewEntries, completedVisit, DEFAULT_REVIEW_FILTERS, elapsed, filterReviewEntries, matchesReviewState, serviceDay, type ReviewDataset, type ReviewVisit } from '@/lib/assist/proofReviewModel.web';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';

const visit = (extra = {}): ReviewVisit => ({ id: 'visit1', client_id: 'client1', legacy_assignment_id: 'assignment1', planned_start_at: '2026-09-02T10:00:00Z', planned_end_at: '2026-09-02T12:00:00Z', actual_start_at: null, actual_end_at: '2026-09-02T12:00:00Z', canonical_status: 'completed', planning_status: 'confirmed', execution_status: 'completed', title: 'Alltag', service_name: 'Alltagsbegleitung', clients: { first_name: 'Anna', last_name: 'Beispiel' }, employees: { first_name: 'Max', last_name: 'Muster' }, ...extra });
const proof = (extra = {}): AssistVisitProofRow => ({ id: 'proof1', tenantId: 'tenant1', visitId: 'visit1', signatureId: null, proofNumber: 'LN-001', status: 'exported', storagePath: null, payloadSnapshot: {}, payloadHash: null, generatedAt: null, generatedBy: null, approvedAt: null, approvedBy: null, billingReleased: false, portalVisible: true, releasedToPortalAt: '2026-09-03T10:00:00Z', portalReleaseStatus: 'pending_client_signature', approvalNote: null, rejectionReason: null, pdfStoragePath: 'proof.pdf', pdfHash: null, createdAt: '2026-09-02T13:00:00Z', updatedAt: '2026-09-03T10:00:00Z', ...extra });
const data = (extra = {}): ReviewDataset => ({ proofs: [proof()], visits: [visit()], documents: [{ id: 'proof1', client_id: 'client1', portal_visible: true, status: 'aktiv', created_at: '2026-09-03T10:00:02Z', signed_at: null, signature_required: true }], signatures: [], loadedAt: '2026-09-10T10:00:00Z', ...extra });
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('proof review evidence and filtering', () => {
  it('shows availability and wait time independently of a read receipt', () => {
    const [e] = buildReviewEntries(data());
    expect(e.state).toBe('awaiting'); expect(e.availableAt).toBe('2026-09-03T10:00:00Z');
    expect(e.documentAt).toBe('2026-09-03T10:00:02Z'); expect(e.signed).toBe(false);
    expect(elapsed(e.waitSince, '2026-09-10T12:00:00Z')).toBe('7 Tage 2 Std.');
  });
  it('detects missing proofs for completed visits only and never duplicates covered visits', () => {
    const entries = buildReviewEntries(data({ visits: [visit(), visit({ id: 'missing' }), visit({ id: 'future', actual_end_at: null, canonical_status: 'planned', execution_status: 'pending' }), visit({ id: 'cancelled', canonical_status: 'cancelled' })] }));
    expect(entries.map(e => e.id)).toEqual(['proof1', 'missing-missing']);
    expect(completedVisit(visit({ canonical_status: 'cancelled' }))).toBe(false);
    expect(completedVisit(visit({ actual_end_at: null, canonical_status: 'in_progress', execution_status: 'service_running' }))).toBe(false);
  });
  it('uses explicit portal signing evidence and freezes the wait after signature', () => {
    const [e] = buildReviewEntries(data({ proofs: [proof({ portalReleaseStatus: 'released', signatureId: 'sig1', payloadSnapshot: { signedViaClientPortal: true, clientPortalSignedAt: '2026-09-04T12:00:00Z' } })], signatures: [{ id: 'sig1', visit_id: 'visit1', signed_at: '2026-09-04T12:00:00Z', signer_name: 'Anna', is_valid: true, metadata: { signedVia: 'client_portal' } }] }));
    expect(e.state).toBe('signed'); expect(e.signedViaPortal).toBe(true); expect(e.waitSince).toBeNull();
  });
  it('does not infer a portal signature from a generic signature date or signer name alone', () => {
    const [signed] = buildReviewEntries(data({ proofs: [proof({ portalReleaseStatus: 'released', payloadSnapshot: { signedAt: '2026-09-04T12:00:00Z' } })] }));
    expect(signed.signedViaPortal).toBe(false);
    const [nameOnly] = buildReviewEntries(data({ proofs: [proof({ payloadSnapshot: { signerName: 'Anna' } })] }));
    expect(nameOnly.signed).toBe(false);
  });
  it('flags missing mirror documents and invalid signatures rather than claiming success', () => {
    const [missingDocument] = buildReviewEntries(data({ documents: [] }));
    expect(missingDocument.state).toBe('check'); expect(matchesReviewState(missingDocument, 'awaiting')).toBe(true);
    const [invalid] = buildReviewEntries(data({ proofs: [proof({ signatureId: 'sig1', payloadSnapshot: { signedAt: '2026-09-04T12:00:00Z' } })], signatures: [{ id: 'sig1', visit_id: 'visit1', is_valid: false, signed_at: '2026-09-04T12:00:00Z', signer_name: 'Anna', metadata: {} }] }));
    expect(invalid.signed).toBe(false); expect(invalid.state).toBe('check');
  });
  it('shows revoked releases without a current waiting period', () => {
    const [e] = buildReviewEntries(data({ proofs: [proof({ portalVisible: false, portalReleaseStatus: 'revoked' })], documents: [] }));
    expect(e.state).toBe('revoked'); expect(e.waitSince).toBeNull(); expect(e.availableAt).toBeNull(); expect(e.releasedAt).not.toBeNull();
  });
  it('includes signed unsent proofs in both matching filters', () => {
    const entries = buildReviewEntries(data({ proofs: [proof({ portalVisible: false, portalReleaseStatus: 'none', payloadSnapshot: { signedAt: '2026-09-02T12:00:00Z' } })], documents: [] }));
    expect(filterReviewEntries(entries, { ...DEFAULT_REVIEW_FILTERS, state: 'signed' })).toHaveLength(1);
    expect(filterReviewEntries(entries, { ...DEFAULT_REVIEW_FILTERS, state: 'not_sent' })).toHaveLength(1);
  });
  it('filters by the inclusive German service day, client identity and proof number', () => {
    expect(serviceDay('2026-08-31T23:30:00Z')).toBe('2026-09-01');
    const entries = buildReviewEntries(data({ visits: [visit({ actual_start_at: '2026-08-31T23:30:00Z' })] }));
    expect(filterReviewEntries(entries, { ...DEFAULT_REVIEW_FILTERS, from: '2026-09-01', to: '2026-09-01', clientId: 'client1', search: 'LN-001' })).toHaveLength(1);
    expect(filterReviewEntries(entries, { ...DEFAULT_REVIEW_FILTERS, from: '2026-09-02' })).toHaveLength(0);
    expect(filterReviewEntries(entries, { ...DEFAULT_REVIEW_FILTERS, clientId: 'another-client' })).toHaveLength(0);
  });
  it('does not use document generation dates as the service date', () => {
    const entries = buildReviewEntries(data({ visits: [], proofs: [proof({ payloadSnapshot: {} })] }));
    expect(filterReviewEntries(entries, { ...DEFAULT_REVIEW_FILTERS, from: '2026-09-01' })).toHaveLength(0);
  });
  it('sorts clients and waiting time predictably', () => {
    const entries = buildReviewEntries(data({ proofs: [proof(), proof({ id: 'proof2', visitId: 'visit2', releasedToPortalAt: '2026-09-01T10:00:00Z' })], visits: [visit(), visit({ id: 'visit2', clients: { first_name: 'Zara', last_name: 'Test' } })] }));
    expect(filterReviewEntries(entries, { ...DEFAULT_REVIEW_FILTERS, sort: 'waiting' })[0].id).toBe('proof2');
    expect(filterReviewEntries(entries, { ...DEFAULT_REVIEW_FILTERS, sort: 'client' })[0].clientName).toBe('Anna Beispiel');
  });
});

describe('proof review interaction', () => {
  it('opens details directly inside the clicked entry, keeps one open, and filters by client', async () => {
    const entries = buildReviewEntries(data({ proofs: [proof(), proof({ id: 'proof2', visitId: 'visit2' })], visits: [visit(), visit({ id: 'visit2', client_id: 'client2', clients: { first_name: 'Berta', last_name: 'Muster' } })] }));
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host); const renderProof = vi.fn(e => <div>Vorschau {e.id}</div>);
    const actGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = actGlobal.IS_REACT_ACT_ENVIRONMENT; actGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    try {
      await act(async () => root.render(<ProofReviewWorkspace entries={entries} loadedAt={data().loadedAt} refreshing={false} error={null} onRefresh={vi.fn()} onOpenVisit={vi.fn()} renderProof={renderProof} />));
      expect(host.querySelectorAll('.pr-detail')).toHaveLength(0);
      const rows = host.querySelectorAll<HTMLButtonElement>('.pr-row');
      await act(async () => rows[0].click());
      expect(rows[0].parentElement?.querySelector('.pr-detail')).not.toBeNull();
      expect(rows[1].parentElement?.querySelector('.pr-detail')).toBeNull();
      await act(async () => rows[1].click());
      expect(host.querySelectorAll('.pr-detail')).toHaveLength(1);
      expect(rows[1].parentElement?.querySelector('.pr-detail')).not.toBeNull();
      const clientSelect = [...host.querySelectorAll('select')].find(select => select.parentElement?.textContent?.startsWith('Klient:in'))!;
      await act(async () => { clientSelect.value = 'client1'; clientSelect.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(host.querySelectorAll('.pr-row')).toHaveLength(1);
      expect(host.querySelector('.pr-row')?.textContent).toContain('Anna Beispiel');
    } finally { await act(async () => root.unmount()); actGlobal.IS_REACT_ACT_ENVIRONMENT = previous; }
  });
});
