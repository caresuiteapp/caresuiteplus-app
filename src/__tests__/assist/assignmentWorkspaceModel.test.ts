import { describe, expect, it } from 'vitest';
import type { AssignmentListItem } from '@/types/modules/assist';
import {
  assignmentBusinessDate, assignmentDateRangeError, buildAssignmentEmployeeOptions,
  filterAssignmentWorkspace, matchesAssignmentWorkspaceDate, resolveAssignmentWorkspaceStatus,
  sortAssignmentWorkspace, summarizeAssignmentWorkspace, UNASSIGNED_EMPLOYEE_FILTER,
  type AssignmentWorkspaceFilters,
} from '@/lib/assist/assignmentWorkspaceModel.web';

const now = new Date('2026-10-16T08:00:00Z');
const row = (changes: Partial<AssignmentListItem> = {}): AssignmentListItem => ({
  id: 'visit-1', tenantId: 'tenant-1', title: 'Alltagsbegleitung', clientName: 'Lena Weiß', employeeId: 'employee-1',
  employeeName: 'Anna Müller', location: 'Herne', status: 'aktiv', scheduledStart: '2026-10-16T08:00:00Z',
  scheduledEnd: '2026-10-16T09:00:00Z', updatedAt: '2026-10-16T08:00:00Z', assignmentStatus: 'bestaetigt',
  planningStatus: 'confirmed', executionStatus: 'pending', documentationStatus: 'none', proofStatus: 'none', ...changes,
});
const filters = (changes: Partial<AssignmentWorkspaceFilters> = {}): AssignmentWorkspaceFilters => ({ search: '', statusFilter: 'all', dateRange: 'all', dateFrom: '', dateTo: '', employeeFilter: 'all', serviceFilter: 'all', ...changes });

describe('Web assignment workspace status and counts', () => {
  it('does not count ended visits with confirmed planning as planned or running', () => {
    const ended = row({ assignmentStatus: 'unterschrift_offen', executionStatus: 'completed', documentationStatus: 'complete', proofStatus: 'pending' });
    const stats = summarizeAssignmentWorkspace([ended], now);
    expect(stats).toMatchObject({ total: 1, planned: 0, running: 0, follow_up: 1, completed: 0 });
  });
  it('keeps distinct running, draft, planned, cancelled, missed, follow-up and completed groups', () => {
    const items = [row(), row({ planningStatus: 'draft', assignmentStatus: 'geplant' }), row({ executionStatus: 'paused' }),
      row({ assignmentStatus: 'storniert', executionStatus: 'in_progress', actualStartAt: now.toISOString() }),
      row({ assignmentStatus: 'nicht_erschienen', executionStatus: 'no_show' }),
      row({ executionStatus: 'completed', documentationStatus: 'open', proofStatus: 'signed' }),
      row({ executionStatus: 'completed', documentationStatus: 'complete', proofStatus: 'verified' })];
    const counts = summarizeAssignmentWorkspace(items, now);
    expect(counts).toEqual({ total: 7, today: 7, unassigned: 0, planned: 1, draft: 1, running: 1, cancelled: 1, no_show: 1, follow_up: 1, completed: 1 });
  });
  it('does not mark a completed canonical status with a missing proof as complete', () => {
    expect(resolveAssignmentWorkspaceStatus(row({ assignmentStatus: 'abgeschlossen', executionStatus: 'completed', documentationStatus: 'complete', proofStatus: 'none' }))).toBe('follow_up');
    expect(resolveAssignmentWorkspaceStatus(row({ assignmentStatus: 'abgeschlossen', executionStatus: 'completed', documentationStatus: 'complete', proofStatus: 'rejected' }))).toBe('follow_up');
  });
  it('respects administrative completion with a signed proof, but keeps pending review open', () => {
    const signed = row({ executionStatus: 'completed', documentationStatus: 'complete', proofStatus: 'signed' });
    expect(resolveAssignmentWorkspaceStatus(signed)).toBe('follow_up');
    expect(resolveAssignmentWorkspaceStatus({ ...signed, assignmentStatus: 'abgeschlossen' })).toBe('completed');
  });
  it('uses real end timestamps before stale running status and does not confuse empty proof on future visits with follow-up', () => {
    expect(resolveAssignmentWorkspaceStatus(row({ executionStatus: 'in_progress', actualEndAt: now.toISOString() }))).toBe('follow_up');
    expect(resolveAssignmentWorkspaceStatus(row({ scheduledStart: '2026-12-01T10:00:00Z', proofStatus: 'none' }))).toBe('planned');
  });
  it('retains legacy completion when detailed dimensions are absent', () => {
    expect(resolveAssignmentWorkspaceStatus(row({ assignmentStatus: undefined, status: 'abgeschlossen', executionStatus: undefined, documentationStatus: undefined, proofStatus: undefined }))).toBe('completed');
  });
});

describe('Web assignment business dates', () => {
  it('uses Berlin dates at midnight, regardless of the viewer or test machine timezone', () => {
    expect(assignmentBusinessDate('2026-10-15T22:15:00Z')).toBe('2026-10-16');
    expect(matchesAssignmentWorkspaceDate(row({ scheduledStart: '2026-10-15T22:15:00Z' }), 'today', '', '', now)).toBe(true);
    expect(matchesAssignmentWorkspaceDate(row({ scheduledStart: '2026-10-16T22:00:00Z' }), 'today', '', '', now)).toBe(false);
  });
  it('uses a calendar week from Monday through Sunday instead of the next seven days', () => {
    expect(matchesAssignmentWorkspaceDate(row({ scheduledStart: '2026-10-12T08:00:00Z' }), 'week', '', '', now)).toBe(true);
    expect(matchesAssignmentWorkspaceDate(row({ scheduledStart: '2026-10-18T20:00:00Z' }), 'week', '', '', now)).toBe(true);
    expect(matchesAssignmentWorkspaceDate(row({ scheduledStart: '2026-10-19T08:00:00Z' }), 'week', '', '', now)).toBe(false);
  });
  it('handles tomorrow across the end of daylight saving time', () => {
    const saturday = new Date('2026-10-24T12:00:00Z');
    expect(matchesAssignmentWorkspaceDate(row({ scheduledStart: '2026-10-25T22:30:00Z' }), 'tomorrow', '', '', saturday)).toBe(true);
    expect(matchesAssignmentWorkspaceDate(row({ scheduledStart: '2026-10-25T23:00:00Z' }), 'tomorrow', '', '', saturday)).toBe(false);
  });
  it('validates date input and includes the full custom end date', () => {
    expect(assignmentDateRangeError('custom', '2026-02-30', '')).not.toBeNull();
    expect(assignmentDateRangeError('custom', '2026-10-17', '2026-10-16')).not.toBeNull();
    expect(assignmentDateRangeError('custom', '', '')).not.toBeNull();
    expect(matchesAssignmentWorkspaceDate(row({ scheduledStart: '2026-10-16T21:59:59Z' }), 'custom', '2026-10-16', '2026-10-16', now)).toBe(true);
    expect(matchesAssignmentWorkspaceDate(row(), 'custom', '2026-10-17', '2026-10-16', now)).toBe(false);
  });
  it('leaves invalid dates reachable in all periods, but never includes them in a particular day', () => {
    expect(matchesAssignmentWorkspaceDate(row({ scheduledStart: 'broken' }), 'all')).toBe(true);
    expect(matchesAssignmentWorkspaceDate(row({ scheduledStart: 'broken' }), 'today')).toBe(false);
  });
});

describe('Web assignment search, filters and ordering', () => {
  it('matches all search terms across client, employee and service without accent sensitivity', () => {
    expect(filterAssignmentWorkspace([row()], filters({ search: ' weiss   muller alltags ' }), now)).toHaveLength(1);
    expect(filterAssignmentWorkspace([row()], filters({ search: 'weiss nonexistent' }), now)).toHaveLength(0);
  });
  it('filters same-named staff by stable IDs and offers an unassigned selection', () => {
    const a = row(), b = row({ id: 'visit-2', employeeId: 'employee-2' }), none = row({ id: 'visit-3', employeeId: null });
    expect(filterAssignmentWorkspace([a, b, none], filters({ employeeFilter: 'employee-2' }), now)).toEqual([b]);
    expect(filterAssignmentWorkspace([a, b, none], filters({ employeeFilter: UNASSIGNED_EMPLOYEE_FILTER }), now)).toEqual([none]);
    const options = buildAssignmentEmployeeOptions([a, b, none]);
    expect(options.find(option => option.key === a.employeeId)?.label).not.toEqual(options.find(option => option.key === b.employeeId)?.label);
    expect(options.map(option => option.key)).toEqual(expect.arrayContaining(['all', UNASSIGNED_EMPLOYEE_FILTER, 'employee-1', 'employee-2']));
  });
  it('combines period, service and the true follow-up status', () => {
    const open = row({ serviceName: 'Haushalt', executionStatus: 'completed', proofStatus: 'pending' });
    expect(filterAssignmentWorkspace([row(), open], filters({ dateRange: 'today', serviceFilter: 'Haushalt', statusFilter: 'follow_up' }), now)).toEqual([open]);
  });
  it('sorts actual instants rather than timestamp strings and always keeps invalid dates last', () => {
    const early = row({ id: 'early', scheduledStart: '2026-10-16T10:00:00+02:00' });
    const late = row({ id: 'late', scheduledStart: '2026-10-16T09:00:00Z' });
    const invalid = row({ id: 'invalid', scheduledStart: 'broken' });
    const original = [invalid, late, early];
    expect(sortAssignmentWorkspace(original, 'time_asc').map(item => item.id)).toEqual(['early', 'late', 'invalid']);
    expect(sortAssignmentWorkspace(original, 'time_desc').map(item => item.id)).toEqual(['late', 'early', 'invalid']);
    expect(original[0]).toBe(invalid);
  });
});
