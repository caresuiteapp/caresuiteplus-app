import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { approveWfmOfficeTimeSelection, canApproveWfmOfficeTimeEntry, selectedWfmApprovalEntries } from '../../lib/wfm/wfmOfficeTimeApproval';

function entry(overrides: Partial<WfmOfficeTimeEntry> = {}): WfmOfficeTimeEntry {
  return {
    id: 'entry-1', tenantId: 'tenant-1', employeeId: 'employee-1', employeeName: 'Test Mitarbeiter',
    workDate: '2020-09-01', assignmentId: null, visitId: null, clientLabel: null,
    plannedStartAt: '2020-09-01T08:00:00Z', plannedEndAt: '2020-09-01T10:00:00Z',
    actualStartAt: '2020-09-01T08:00:00Z', actualEndAt: '2020-09-01T10:00:00Z',
    startDeviationMinutes: 0, endDeviationMinutes: 0, startAmpel: 'green', endAmpel: 'green', overallAmpel: 'green',
    startJustification: null, endJustification: null, startJustificationAt: null, endJustificationAt: null,
    pauseMinutes: 0, grossMinutes: 120, netMinutes: 120, travelMinutes: null, workKind: 'einsatz',
    status: 'open', source: 'portal', reviewStatus: 'open', exportStatus: 'not_exported',
    sessionId: null, officeComment: null, hasOpenOfficeMessage: false, flags: [], ...overrides,
  };
}

describe('WFM quick and bulk approval', () => {
  it('accepts completed, open actual times, including deviations and corrections', () => {
    for (const reviewStatus of ['open', 'pending_review', 'needs_clarification', 'corrected'] as const) {
      assert.equal(canApproveWfmOfficeTimeEntry(entry({ reviewStatus, overallAmpel: 'red' })), true);
    }
    assert.equal(canApproveWfmOfficeTimeEntry(entry({ actualStartAt: null, actualEndAt: null,
      assignmentActualStartAt: '2020-09-01T08:00:00Z', assignmentActualEndAt: '2020-09-01T10:00:00Z' })), true);
  });

  it('excludes reviewed, exported, locked, rejected and explicitly disabled entries', () => {
    for (const reviewStatus of ['approved', 'exported', 'locked', 'rejected'] as const) {
      assert.equal(canApproveWfmOfficeTimeEntry(entry({ reviewStatus })), false);
    }
    assert.equal(canApproveWfmOfficeTimeEntry(entry({ exportStatus: 'exported' })), false);
    assert.equal(canApproveWfmOfficeTimeEntry(entry({ canApprove: false })), false);
  });

  it('never approves planned-only, missing, invalid, reversed or ongoing work', () => {
    const invalid: Partial<WfmOfficeTimeEntry>[] = [
      { actualStartAt: null, actualEndAt: null },
      { actualStartAt: null }, { actualEndAt: null }, { actualStartAt: 'invalid' },
      { actualEndAt: '2020-09-01T07:00:00Z' }, { actualEndAt: '2020-09-01T08:00:00Z' },
      { actualEndAt: new Date(Date.now() + 86_400_000).toISOString() },
      { actualEndAt: null, assignmentActualStartAt: '2020-09-01T08:00:00Z', assignmentActualEndAt: '2020-09-01T10:00:00Z' },
    ];
    for (const overrides of invalid) assert.equal(canApproveWfmOfficeTimeEntry(entry(overrides)), false);
  });

  it('intersects selection with visible eligible entries and deduplicates them', () => {
    const visible = [entry(), entry(), entry({ id: 'approved', reviewStatus: 'approved' }), entry({ id: 'unselected' })];
    const selected = selectedWfmApprovalEntries(visible, new Set(['entry-1', 'hidden', 'approved']));
    assert.deepEqual(selected.map(row => row.id), ['entry-1']);
  });

  it('reports partial failures, continues after an exception and counts only server-confirmed approvals', async () => {
    const rows = ['success', 'denied', 'throws', 'unconfirmed', 'wrong-id', 'last'].map(id => entry({ id }));
    const calls: string[] = [];
    const progress: number[][] = [];
    let inFlight = 0;
    const outcome = await approveWfmOfficeTimeSelection(rows, async row => {
      assert.equal(inFlight++, 0, 'writes must remain sequential');
      calls.push(row.id);
      await Promise.resolve();
      inFlight--;
      if (row.id === 'denied') return { ok: false, error: 'Keine Berechtigung' };
      if (row.id === 'throws') throw new Error('Netzwerkfehler');
      return { ok: true, data: { ...row, id: row.id === 'wrong-id' ? 'another-entry' : row.id,
        reviewStatus: row.id === 'unconfirmed' ? 'open' : 'approved' } };
    }, (done, total) => progress.push([done, total]));
    assert.deepEqual(calls, rows.map(row => row.id));
    assert.deepEqual(outcome.approvedIds, ['success', 'last']);
    assert.deepEqual(outcome.failed.map(item => item.entry.id), ['denied', 'throws', 'unconfirmed', 'wrong-id']);
    assert.equal(outcome.failed[0].error, 'Keine Berechtigung');
    assert.equal(outcome.failed[1].error, 'Netzwerkfehler');
    assert.deepEqual(progress, rows.map((_, index) => [index + 1, 6]));
  });

  it('rechecks eligibility before each write and never sends duplicate entries', async () => {
    const calls: string[] = [];
    const locked = entry({ id: 'locked', reviewStatus: 'locked' });
    const outcome = await approveWfmOfficeTimeSelection([entry(), entry(), locked], async row => {
      calls.push(row.id);
      return { ok: true, data: { ...row, reviewStatus: 'approved' } };
    });
    assert.deepEqual(calls, ['entry-1']);
    assert.deepEqual(outcome.approvedIds, ['entry-1']);
    assert.deepEqual(outcome.failed.map(item => item.entry.id), ['locked']);
  });

  it('sends no request for an empty selection', async () => {
    const outcome = await approveWfmOfficeTimeSelection([], async () => { throw new Error('must not run'); });
    assert.deepEqual(outcome, { approvedIds: [], failed: [] });
  });
});
