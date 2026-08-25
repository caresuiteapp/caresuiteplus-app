import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('WFM Mitarbeitenden-Zeitkonto Workspace R10', () => {
  it('ersetzt die rohe Detail-Textliste durch einen vollständigen Arbeitsbereich', () => {
    const team = read('src/components/wfm/TimeTrackingTeamScreen.tsx');
    const workspace = read('src/components/wfm/WfmEmployeeTimeAccountWorkspace.tsx');

    expect(team).toContain('WfmEmployeeTimeAccountWorkspace');
    expect(team).not.toContain("selectedAccount.entries.slice(0, 14).map");
    expect(workspace).toContain('MITARBEITENDENKONTO');
    expect(workspace).toContain('Zeitbuchungen & Bearbeitung');
    expect(workspace).toContain('Fahrtenbuch');
    expect(workspace).toContain('Abwesenheiten');
    expect(workspace).toContain('Gehaltsstatistik & PDF');
    expect(workspace).toContain('Monatsfortschritt');
    expect(workspace).toContain('Handlungsbedarf');
  });

  it('bindet echte Korrektur-, Prüf-, Nachtrags- und Exportwege an', () => {
    const workspace = read('src/components/wfm/WfmEmployeeTimeAccountWorkspace.tsx');
    const history = read('src/components/wfm/WfmOfficeTimeHistoryPanel.tsx');

    expect(workspace).toContain('WfmOfficeTimeHistoryPanel');
    expect(workspace).toContain('lockEmployeeFilter');
    expect(workspace).toContain('/business/office/time-tracking/nachtraege');
    expect(workspace).toContain('/business/office/time-tracking/export');
    expect(history).toContain('applyWfmOfficeTimeCorrection');
    expect(history).toContain('reviewWfmOfficeTimeEntry');
    expect(history).toContain('initialEmployeeId');
  });

  it('zeigt das Verwaltungs-Fahrtenbuch mit Fahrtenliste und begründeter Kilometerkorrektur', () => {
    const workspace = read('src/components/wfm/WfmEmployeeTimeAccountWorkspace.tsx');
    const logbook = read('src/components/office/EmployeeLogbookOfficePanel.tsx');
    const repository = read('src/lib/employeeLogbook/employeeLogbookRepository.supabase.ts');

    expect(workspace).toContain('EmployeeLogbookOfficePanel');
    expect(logbook).toContain('title="Fahrten im Zeitraum"');
    expect(logbook).toContain('TRAVEL_ROUTE_TYPE_LABELS');
    expect(logbook).toContain('correctLogbookTrip');
    expect(logbook).toContain('Pflichtbegründung');
    expect(logbook).toContain('Korrektur speichern');
    expect(logbook).toContain('Fahrtenbuch als PDF erstellen');
    expect(logbook).toContain('title="Fahrt manuell erfassen"');
    expect(logbook).toContain('Manuelle Fahrt speichern');
    expect(logbook).toContain('createManualLogbookTrip');
    expect(repository).toContain('loadAllEmployeeTripRows');
    expect(repository).toContain('.range(offset, offset + pageSize - 1)');
    expect(repository).not.toContain("order('started_at', { ascending: false }).limit(250)");
  });

  it('zeigt negative Salden explizit statt als leeren Gedankenstrich', () => {
    const workspace = read('src/components/wfm/WfmEmployeeTimeAccountWorkspace.tsx');

    expect(workspace).toContain('formatSignedDuration');
    expect(workspace).toContain("const sign = minutes > 0 ? '+' : '−'");
    expect(workspace).toContain('formatSignedDuration(account.saldoMinutes)');
  });
});
