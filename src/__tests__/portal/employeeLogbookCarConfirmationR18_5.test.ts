import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Fahrtenbuch P0 R18.5', () => {
  it('imports historical GPS only with explicit per-visit car proof', () => {
    const recovery = read('src/lib/employeeLogbook/employeeLogbookAssistGpsRecovery.ts');
    expect(recovery).toContain('employee_visit_mobility_selections');
    expect(recovery).toContain("carSelectionProven: transportMode === 'car'");
    expect(recovery).toContain('!candidate.carSelectionProven');
  });

  it('keeps finished trips blocked until employee confirmation', () => {
    const repository = read('src/lib/employeeLogbook/employeeLogbookRepository.supabase.ts');
    const card = read('src/components/portal/EmployeePortalVisitLogbookCard.tsx');
    expect(repository).toContain("status: 'confirmation_required'");
    expect(repository).toContain('confirmEmployeeLogbookTrip');
    expect(card).toContain('Gefahrene Kilometer bestätigen');
    expect(card).toContain('Begründung der Korrektur');
  });

  it('shows only explicitly car-enabled employees with an active vehicle', () => {
    const hub = read('src/screens/office/EmployeeLogbookHubScreen.tsx');
    expect(hub).toContain('Boolean(mobility.data.id)');
    expect(hub).toContain("mobility.data.transportModes.includes('car')");
    expect(hub).toContain('logbook.vehicles.some((vehicle) => vehicle.active)');
  });

  it('does not mutate protected expense claims', () => {
    const migration = read('supabase/migrations/20260901183000_employee_logbook_car_confirmation_r18_5.sql');
    expect(migration).not.toContain('UPDATE public.employee_expense_claims');
    expect(migration).toContain("trip.source LIKE 'assist_gps_recovery_r18:%'");
  });
});
