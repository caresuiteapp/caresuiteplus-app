import { describe, expect, it } from 'vitest';
import { buildAdministrativeDocumentationText, documentationBlockAlreadyStored, mergeAdministrativeTaskDrafts, visitWorkflowLabel } from '@/lib/assist/administrativeFollowUpState';
import { deriveAssignmentStatusFromVisitDimensions } from '@/lib/assist/visitWorkflow';
import { buildVisitProofPreview } from '@/lib/assist/visitProofPreviewService';
import { mergeVisitDispositionWithExecution } from '@/lib/assist/visitDispositionExecutionEnrichment';
import type { VisitDispositionDetail, VisitTaskItem } from '@/lib/assist/visitTypes';

const task = (id: string, status: VisitTaskItem['status']): VisitTaskItem => ({ id, title: id, status, isRequired: true, notDoneReason: null });
const detail = {
  id: 'visit-qa', title: 'Haushalt', clientName: 'Prüfperson', employeeName: 'Mitarbeitende', location: 'Prüfort',
  scheduledStart: '2026-08-26T07:00:00Z', scheduledEnd: '2026-08-26T09:00:00Z', actualEndAt: '2026-08-26T09:06:00Z',
  assignmentStatus: 'abgeschlossen', executionStatus: 'completed', documentationStatus: 'complete', proofStatus: 'signed', billingStatus: 'ready', portalStatus: 'visible',
  tasks: [task('Bad', 'open')], documentationNotes: 'Haushalt erledigt.',
  persistedSignature: { visitId: 'visit-qa', signerName: 'Prüfperson', signerRole: 'client', signedAt: '2026-08-26T09:06:00Z', dataUrl: '' },
} as VisitDispositionDetail;

describe('administrative follow-up consistency', () => {
  it('keeps a completed signed follow-up complete but never closes a missing signature', () => {
    const states = { canonicalStatus: 'abgeschlossen' as const, executionStatus: 'completed' as const, documentationStatus: 'complete' as const };
    expect(deriveAssignmentStatusFromVisitDimensions({ ...states, proofStatus: 'signed' })).toBe('abgeschlossen');
    expect(deriveAssignmentStatusFromVisitDimensions({ ...states, proofStatus: 'pending' })).toBe('unterschrift_offen');
    expect(deriveAssignmentStatusFromVisitDimensions({ ...states, documentationStatus: 'open', proofStatus: 'signed' })).toBe('dokumentation_offen');
    expect(visitWorkflowLabel('unterschrift_offen', 'signed')).toBe('Unterschrieben · Nachbearbeitung offen');
    expect(visitWorkflowLabel('unterschrift_offen', 'pending')).toBe('Unterschrift offen');
  });

  it('preserves unsaved choices across unrelated refreshes while adopting server changes for untouched tasks', () => {
    const previous = { local: 'open', remote: 'open', removed: 'open' } as const;
    const drafts = { local: 'done', remote: 'open', removed: 'done' } as const;
    expect(mergeAdministrativeTaskDrafts(previous, [task('local', 'open'), task('remote', 'not_requested'), task('new', 'open')], drafts))
      .toEqual({ local: 'done', remote: 'not_requested', new: 'open' });
    expect(mergeAdministrativeTaskDrafts(previous, [task('local', 'done')], drafts)).toEqual({ local: 'done' });
  });

  it('shows timestamped additions once without rewriting repeated historical sentences', () => {
    const original = 'Haushalt erledigt. Haushalt erledigt.';
    const additions = '[Administrative Ergänzung 2026-09-11 14:00] Fenster geschlossen.';
    const combined = buildAdministrativeDocumentationText({ short_description: original, special_notes: `${original}\n\n${additions}` });
    expect(combined).toBe(`${original}\n\n${additions}`);
    expect(buildAdministrativeDocumentationText({ short_description: combined, special_notes: additions })).toBe(combined);
    expect(buildAdministrativeDocumentationText({ short_description: original, special_notes: original })).toBe(original);
    expect(documentationBlockAlreadyStored(combined, 'Fenster   geschlossen.')).toBe(true);
    expect(documentationBlockAlreadyStored(combined, 'Fenster geschlossen. Nachkontrolle durchgeführt.')).toBe(false);
    expect(documentationBlockAlreadyStored(combined, 'Haushalt erledigt.')).toBe(false);
  });

  it('does not call a signed preview ready while a required task is open', () => {
    expect(buildVisitProofPreview(detail).readyForExport).toBe(false);
    expect(buildVisitProofPreview(detail).incompleteHint).toContain('Bad');
    expect(buildVisitProofPreview({ ...detail, tasks: [task('Bad', 'done')] }).readyForExport).toBe(true);
  });

  it('preserves verified proof and financial states when merging an older execution snapshot', () => {
    const merged = mergeVisitDispositionWithExecution({ detail: { ...detail, proofStatus: 'verified' }, assignmentStatus: 'abgeschlossen', assignmentTasks: [],
      documentationText: detail.documentationNotes!, visitTimes: null, executionStateStatus: 'unterschrift_offen', hasSignature: true, hasProof: true,
      persistedSignature: detail.persistedSignature!, assignmentOnTheWayAt: null, assignmentArrivedAt: null, assignmentActualStartAt: null,
      assignmentActualEndAt: null, assignmentFinishedAt: null });
    expect(merged.assignmentStatus).toBe('abgeschlossen');
    expect(merged.proofStatus).toBe('verified');
    expect(merged.billingStatus).toBe('ready');
    expect(merged.portalStatus).toBe('visible');
  });
});
