import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const readSrc = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8');

describe('employee portal assignment integrity contract', () => {
  it('uses the signed-in employee scope instead of the team calendar', () => {
    const source = readSrc('src/lib/calendar/calendarEventService.ts');
    expect(source).toMatch(
      /getEmployeePortalCalendarEvents\([\s\S]*portalType:\s*'employee',\s*employeeId/,
    );
    expect(source).toContain('Meine Einsätze, Termine und Abwesenheiten');
  });

  it('keeps appointment viewing separate from execution mutation permission', () => {
    const detail = readSrc('src/screens/portal/PortalAssignmentDetailScreen.tsx');
    const execution = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(detail).toContain("can('portal.employee.appointments.view')");
    expect(execution).toContain("can('portal.employee.appointments.view')");
    expect(execution).toContain("can('assist.execution.manage')");
    expect(execution).toContain('LockedActionBanner');
  });

  it('fails visibly when a virtual occurrence cannot be materialized', () => {
    const source = readSrc('src/lib/portal/employeePortalExecutionLiveService.ts');
    expect(source).toContain('Dieser Serientermin konnte nicht als eigener Einsatz vorbereitet werden');
    expect(source).not.toMatch(
      /series occurrence materialization:', executable\.error\);\s*}\s*\n\s*const loaded/,
    );
  });

  it('merges live and calendar reads and deduplicates by occurrence identity', () => {
    const source = readSrc('src/lib/portal/appointmentService.ts');
    expect(source).toContain('Promise.all([');
    expect(source).toContain('dedupePortalAppointmentOccurrences');
    expect(source).toContain('fetchLivePortalAppointmentsForEmployee');
    expect(source).toContain('getEmployeeCalendarEvents');
  });
});
