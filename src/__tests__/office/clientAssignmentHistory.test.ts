import { describe, expect, it } from 'vitest';
import { clientAssignmentMonthKey, groupClientAssignmentsByMonth, isPastClientAssignment, partitionClientAssignments } from '@/lib/clients/clientAssignmentHistory';
import type { AssignmentListItem } from '@/types/modules/assist';

const now = Date.parse('2026-10-11T08:30:00Z');
function item(id: string, start: string, patch: Partial<AssignmentListItem> = {}): AssignmentListItem {
  return {
    id, tenantId: 'tenant-1', employeeId: 'employee-1', title: 'Hauswirtschaft',
    scheduledStart: start, scheduledEnd: new Date(Date.parse(start) + 3_600_000).toISOString(),
    status: 'aktiv', location: '', clientName: 'Testperson', employeeName: 'Testbegleitung',
    updatedAt: start, ...patch,
  };
}

describe('Monatsarchiv in der Klientenakte', () => {
  it('ordnet UTC-Monatsgrenzen dem angezeigten deutschen Kalendermonat zu', () => {
    expect(clientAssignmentMonthKey('2026-08-31T22:15:00Z')).toBe('2026-09');
    expect(clientAssignmentMonthKey('2025-12-31T23:15:00Z')).toBe('2026-01');
    expect(clientAssignmentMonthKey('2026-10-31T23:15:00Z')).toBe('2026-11');
  });

  it('zeigt vergangene Termine einschließlich fehlender Unterschriften und abgesagter Einsätze', () => {
    const assignments = [
      item('unsigned', '2026-09-11T08:00:00Z', { assignmentStatus: 'unterschrift_offen' }),
      item('draft', '2026-08-11T08:00:00Z', { status: 'entwurf' }),
      item('cancelled', '2026-07-11T08:00:00Z', { assignmentStatus: 'storniert' }),
      item('running', '2026-10-11T08:00:00Z', { assignmentStatus: 'gestartet' }),
      item('future', '2026-10-12T08:00:00Z'),
    ];
    const partition = partitionClientAssignments(assignments, now);
    expect(partition.past.map((entry) => entry.id)).toEqual(['unsigned', 'draft', 'cancelled']);
    expect(partition.upcoming.map((entry) => entry.id)).toEqual(['running', 'future']);
    expect(partition.past.length + partition.upcoming.length).toBe(assignments.length);
  });

  it('erkennt einen bereits beendeten Einsatz auch vor dem geplanten Ende', () => {
    const assignment = item('early', '2026-10-11T08:00:00Z', { actualEndAt: '2026-10-11T08:20:00Z' });
    expect(isPastClientAssignment(assignment, now)).toBe(true);
    expect(isPastClientAssignment({ ...assignment, actualEndAt: null, assignmentStatus: 'dokumentation_offen' }, now)).toBe(true);
  });

  it('trennt gleiche Monate verschiedener Jahre und sortiert das Archiv vom neuesten Termin abwärts', () => {
    const assignments = [
      item('old', '2025-09-11T08:00:00Z'), item('earlier', '2026-09-10T08:00:00Z'),
      item('later', '2026-09-20T08:00:00Z'), item('august', '2026-08-11T08:00:00Z'),
    ];
    const groups = groupClientAssignmentsByMonth(assignments);
    expect(groups.map((group) => group.key)).toEqual(['2026-09', '2026-08', '2025-09']);
    expect(groups[0].label).toBe('September 2026');
    expect(groups[0].assignments.map((entry) => entry.id)).toEqual(['later', 'earlier']);
    expect(assignments.map((entry) => entry.id)).toEqual(['old', 'earlier', 'later', 'august']);
    expect(groupClientAssignmentsByMonth(assignments, 'asc')[0].key).toBe('2025-09');
  });

  it('behält mehr als 1000 Einsätze einschließlich verschiedener Termine zur gleichen Uhrzeit', () => {
    const assignments = Array.from({ length: 1201 }, (_, index) => item(`visit-${index}`, '2026-09-11T08:00:00Z'));
    const groups = groupClientAssignmentsByMonth(assignments);
    expect(groups).toHaveLength(1);
    expect(groups[0].assignments).toHaveLength(1201);
    expect(new Set(groups[0].assignments.map((entry) => entry.id)).size).toBe(1201);
  });

  it('verliert Datensätze mit ungültigem Termin nicht aus der Gesamtansicht', () => {
    const valid = item('valid', '2026-09-11T08:00:00Z');
    const groups = groupClientAssignmentsByMonth([{ ...valid, id: 'invalid', scheduledStart: 'unknown', scheduledEnd: 'unknown' }, valid]);
    expect(groups.map((group) => group.key)).toEqual(['2026-09', 'undated']);
    expect(groups[1].label).toBe('Ohne gültigen Termin');
  });
});
