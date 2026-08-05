import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('Office Klient:innen und Arbeitszeit R5', () => {
  it('rendert Klient:innenkarten mit verbindlichen dunklen Textfarben auf hellen Karten', () => {
    const card = read('src/components/office/ClientListCard.tsx');
    const table = read('src/components/office/ClientsListTable.tsx');

    expect(card).toContain("color: '#0B2342'");
    expect(card).toContain("color: '#31597F'");
    expect(card).toContain('styles.factValue');
    expect(card).not.toContain('useTableTextStyles');
    expect(table).toContain("color: '#173B61'");
  });

  it('öffnet Arbeitszeit standardmäßig als Zeitkonto- und Gehaltsvorbereitung', () => {
    const route = read('app/business/office/time-tracking/index.tsx');
    expect(route).toContain('/business/office/time-tracking/zeitkonten');
    expect(route).not.toContain('/business/office/time-tracking/live');
  });

  it('bindet die vollständige Arbeitszeitnavigation in das produktive Layout ein', () => {
    const layout = read('app/business/office/time-tracking/_layout.tsx');
    const shell = read('src/components/wfm/OfficeTimeTrackingShell.tsx');

    expect(layout).toContain('OfficeTimeTrackingShell');
    expect(shell).toContain('OFFICE_TIME_TRACKING_TABS.map');
    expect(shell).toContain('Gehaltsstatistik und Monatsabschluss öffnen');
    expect(shell).toContain("overflow: 'hidden'");
    expect(shell).toContain('showsVerticalScrollIndicator');
    expect(shell).toContain('contentContainerStyle={styles.workspaceScrollContent}');
  });

  it('zeigt die vollständige monatliche Prüfkette und alle Hauptaktionen', () => {
    const screen = read('src/components/wfm/TimeTrackingTeamScreen.tsx');

    expect(screen).toContain('Arbeitszeit- und Gehaltsvorbereitung');
    expect(screen).toContain('Einsatzzeiten & Korrekturen');
    expect(screen).toContain('Urlaub & Abwesenheiten');
    expect(screen).toContain('Offene Prüfungen');
    expect(screen).toContain('Gehaltsstatistik öffnen');
  });

  it('lädt alle aktiven Mitarbeitenden und zeigt Live-Fehler sichtbar an', () => {
    const screen = read('src/components/wfm/TimeTrackingTeamScreen.tsx');
    const service = read('src/lib/wfm/wfmTeamTodayService.ts');
    const layout = read('src/components/wfm/WfmOfficeTimekeepingLayout.tsx');

    expect(service).toContain('fetchActiveEmployeeIds(tenantId)');
    expect(service).toContain('activeEmployeesResult.ok ? activeEmployeesResult.data : []');
    expect(screen).toContain('Arbeitszeitdaten konnten nicht geladen werden');
    expect(layout).toContain("primary: '#0B2342'");
    expect(layout).toContain("secondary: '#31597F'");
  });

  it('priorisiert im Messenger Verlauf und mehrzeilige Texteingabe statt hoher Leisten', () => {
    const screen = read('src/screens/office/OfficeMessengerScreen.tsx');
    const composer = read('src/components/communication/ChatComposer.tsx');

    expect(screen).toContain('minHeight: stackTopChrome ? undefined : 44');
    expect(screen).toContain('compactHeader');
    expect(screen).toContain('<MessengerTabs');
    expect(composer).toContain("textAlignVertical: 'top'");
    expect(composer).toContain('minHeight: 66');
  });
});
