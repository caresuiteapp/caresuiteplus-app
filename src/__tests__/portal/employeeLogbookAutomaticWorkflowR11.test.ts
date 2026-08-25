import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { berlinDateKey, isLogbookTripInBerlinRange } from '@/lib/employeeLogbook/employeeLogbookDate';

const read = (file: string) => readFileSync(file, 'utf8');

describe('Digitales Fahrtenbuch R11 · automatischer PKW-Workflow', () => {
  it('verwendet für deutsche Fahrten den Berliner Kalendertag statt UTC', () => {
    expect(berlinDateKey('2026-08-24T22:30:00.000Z')).toBe('2026-08-25');
    expect(isLogbookTripInBerlinRange('2026-08-24T22:30:00.000Z', '2026-08-25', '2026-08-25')).toBe(true);
  });

  it('erlaubt das Fahrtenbuch nur bei PKW-Modus und aktiv zugeordnetem Fahrzeug', () => {
    const automation = read('src/lib/employeeLogbook/employeeLogbookAutomation.ts');
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    expect(automation).toContain("mobility.transportModes.includes('car')");
    expect(automation).toContain("bundle.vehicles.find((vehicle) => vehicle.active)");
    expect(shell).toContain("item.id !== 'logbook' || Boolean(logbookEligibility.data?.eligible)");
  });

  it('bindet Anfahrt und Ankunft an dieselbe Fahrtenbuchkette', () => {
    const visit = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(visit).toContain('startVisitApproachLogbook');
    expect(visit).toContain('finishVisitApproachLogbook');
    expect(visit).toContain('EmployeePortalVisitLogbookCard');
  });

  it('unterstützt Begleitfahrt, Besorgung, Weiterfahrt und mehrere Zwischenziele', () => {
    const card = read('src/components/portal/EmployeePortalVisitLogbookCard.tsx');
    const repository = read('src/lib/employeeLogbook/employeeLogbookRepository.supabase.ts');
    expect(card).toContain('Fahrt mit Klient:in');
    expect(card).toContain('Besorgungsfahrt');
    expect(card).toContain('Weiter zum nächsten Einsatz');
    expect(card).toContain('Nächsten Einsatz auswählen');
    expect(card).toContain('clientId: target.clientId');
    expect(card).toContain('assignmentId: target.assignmentId');
    expect(card).toContain('Zwischenziel erreicht – weiter aufzeichnen');
    expect(repository).toContain(".is('ended_at', null)");
  });

  it('macht Rückfahrt und Datenintegrität reload-sicher', () => {
    const visit = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const migration = read('supabase/migrations/20260825123000_employee_logbook_automatic_workflow_r11.sql');
    expect(visit).not.toContain('sawIncompleteExecutionRef');
    expect(visit).toContain('loadLogbookPromptDecision');
    expect(migration).toContain('employee_logbook_prompt_decisions');
    expect(migration).toContain('idx_employee_logbook_one_recording_trip');
    expect(migration).toContain("OR (status = 'recording' AND source = 'employee_portal')");
    expect(migration).toContain('protect_employee_logbook_segment');
    expect(migration).toContain('employee_logbook_receipts_office_update');
    expect(migration).toContain("'submitted'");
    expect(migration).toContain("AT TIME ZONE 'Europe/Berlin'");
  });
});
