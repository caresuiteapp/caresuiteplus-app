import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const readSrc = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('Fahrtenbuch R2 Rollen- und Zuordnungstrennung', () => {
  it('entfernt Fahrzeugverwaltung und PDF-Gesamtexport aus dem Mitarbeitendenportal', () => {
    const employee = readSrc('src/screens/portal/EmployeeLogbookScreen.tsx');

    expect(employee).not.toContain('title="Fahrzeug & Kilometersatz"');
    expect(employee).not.toContain('Fahrtenbuch als PDF erstellen');
    expect(employee).not.toContain('Fahrzeugdaten speichern');
    expect(employee).not.toContain('Einsatz-ID (wenn vorhanden)');
  });

  it('stellt Fahrzeugverwaltung und PDF ausschließlich in der Personalakte bereit', () => {
    const office = readSrc('src/components/office/EmployeeLogbookOfficePanel.tsx');
    const personnel = readSrc('src/components/office/EmployeePersonnelFilePanel.tsx');

    expect(office).toContain('testID="employee-logbook-office-panel"');
    expect(office).toContain('title="Fahrzeug & Kilometersatz"');
    expect(office).toContain('Fahrtenbuch als PDF erstellen');
    expect(office).toContain('Ausschließlich durch die Verwaltung bearbeitbar');
    expect(personnel).toContain("{ key: 'logbook', label: 'Fahrtenbuch' }");
    expect(personnel).toContain('EmployeeLogbookOfficePanel');
  });

  it('bietet Einsatz, Klient:in und begründete Fahrt ohne Zuordnung an', () => {
    const employee = readSrc('src/screens/portal/EmployeeLogbookScreen.tsx');

    expect(employee).toContain("['assignment', 'Geplanter Einsatz']");
    expect(employee).toContain("['client', 'Klient:in']");
    expect(employee).toContain("['none', 'Ohne Zuordnung']");
    expect(employee).toContain('CareEntitySelect label="Einsatz auswählen"');
    expect(employee).toContain('CareEntitySelect label="Klient:in auswählen"');
    expect(employee).toContain("clientId: linkMode === 'none' ? null : clientId || null");
  });

  it('erlaubt in Datenbank und Repository eine direkte Klient:innenzuordnung', () => {
    const repository = readSrc('src/lib/employeeLogbook/employeeLogbookRepository.supabase.ts');
    const migration = readSrc('supabase/migrations/20260822133000_employee_logbook_office_controls_r2.sql');

    expect(repository).toContain('!input.assignmentId && !input.clientId');
    expect(migration).toContain('OR client_id IS NOT NULL');
    expect(migration).toContain('employee_logbook_vehicles_office_update');
    expect(migration).toContain('protect_employee_logbook_office_profile_fields');
  });
});
