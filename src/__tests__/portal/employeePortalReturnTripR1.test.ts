import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import {
  formatReturnTripDuration,
  isLastScheduledEmployeeAssignmentOfDay,
  returnTripDestinationFromTrip,
  returnTripRouteType,
} from '@/lib/portal/employeePortalReturnTripRules';

function appointment(
  id: string,
  startsAt: string,
  assignmentStatus: PortalAppointmentItem['assignmentStatus'] = 'bestaetigt',
): PortalAppointmentItem {
  return {
    id,
    title: `Einsatz ${id}`,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 60 * 60_000).toISOString(),
    status: assignmentStatus === 'storniert' ? 'fehlerhaft' : 'aktiv',
    location: 'Teststraße 1',
    clientId: `client-${id}`,
    employeeId: 'employee-1',
    assignmentStatus,
  };
}

describe('Mitarbeiterportal Rückfahrt nach letztem Tageseinsatz', () => {
  const root = path.join(__dirname, '..', '..', '..');

  it('erkennt den chronologisch letzten Einsatz eines lokalen Kalendertages', () => {
    const appointments = [
      appointment('early', '2026-08-24T08:00:00+02:00'),
      appointment('last', '2026-08-24T16:00:00+02:00'),
      appointment('tomorrow', '2026-08-25T08:00:00+02:00'),
    ];
    expect(isLastScheduledEmployeeAssignmentOfDay({
      assignmentId: 'early', plannedStartAt: appointments[0].startsAt, appointments,
    })).toBe(false);
    expect(isLastScheduledEmployeeAssignmentOfDay({
      assignmentId: 'last', plannedStartAt: appointments[1].startsAt, appointments,
    })).toBe(true);
  });

  it('ignoriert einen späteren stornierten oder nicht erschienenen Einsatz', () => {
    const current = appointment('current', '2026-08-24T15:00:00+02:00');
    const cancelled = appointment('cancelled', '2026-08-24T18:00:00+02:00', 'storniert');
    expect(isLastScheduledEmployeeAssignmentOfDay({
      assignmentId: current.id,
      plannedStartAt: current.startsAt,
      appointments: [current, cancelled],
    })).toBe(true);
  });

  it('ordnet Zuhause und Büro den richtigen Fahrtenbucharten zu', () => {
    expect(returnTripRouteType('home')).toBe('client_to_home');
    expect(returnTripRouteType('office')).toBe('client_to_office');
    expect(returnTripDestinationFromTrip({ routeType: 'client_to_home' })).toBe('home');
    expect(returnTripDestinationFromTrip({ routeType: 'client_to_office' })).toBe('office');
    expect(returnTripDestinationFromTrip({ routeType: 'with_client' })).toBeNull();
  });

  it('formatiert die laufende GPS-Zeit stabil', () => {
    expect(formatReturnTripDuration('2026-08-24T16:00:00.000Z', new Date('2026-08-24T16:07:09.000Z'))).toBe('07:09');
    expect(formatReturnTripDuration('2026-08-24T16:00:00.000Z', new Date('2026-08-24T17:07:09.000Z'))).toBe('01:07:09');
  });

  it('verbindet den Einsatzabschluss mit dem verpflichtenden Rückfahrt-Popup', () => {
    const screen = readFileSync(
      path.join(root, 'src/screens/portal/EmployeePortalVisitExecutionScreen.tsx'),
      'utf8',
    );
    const modal = readFileSync(
      path.join(root, 'src/components/portal/EmployeePortalReturnTripModal.tsx'),
      'utf8',
    );
    expect(screen).toContain('isLastScheduledEmployeeAssignmentOfDay');
    expect(screen).toContain('<EmployeePortalReturnTripModal');
    expect(modal).toContain('Ja – nach Hause aufzeichnen');
    expect(modal).toContain('Ja – zum Büro aufzeichnen');
    expect(modal).toContain('Nein – nicht aufzeichnen');
    expect(modal).toContain('ANGEKOMMEN – Rückfahrt abschließen');
  });

  it('aktiviert die tatsächlich wirksame Android-Hintergrundortung', () => {
    const config = readFileSync(path.join(root, 'app.config.ts'), 'utf8');
    expect(config).toContain("'ACCESS_BACKGROUND_LOCATION'");
    expect(config).toContain("'FOREGROUND_SERVICE_LOCATION'");
    expect(config).toContain('isAndroidBackgroundLocationEnabled: true');
    expect(config).toContain('isAndroidForegroundServiceEnabled: true');
  });
});
