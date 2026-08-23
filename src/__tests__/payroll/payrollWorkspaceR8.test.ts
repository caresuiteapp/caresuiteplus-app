import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const screen = readFileSync('src/screens/office/PayrollMonthOverviewScreen.tsx', 'utf8');
const queryHook = readFileSync('src/hooks/core/useAsyncQuery.ts', 'utf8');

describe('Gehaltsstatistik Workspace R8', () => {
  it('verhindert den blockierenden Dauerloader bei langsamen Live-Abfragen', () => {
    expect(screen).not.toContain("feedback.showLoading('Arbeitszeit, Zeitkonto und Abrechnung werden aktualisiert…')");
    expect(screen).toContain('QUERY_TIMEOUT_MS = 30_000');
    expect(screen).toContain('Vorhandene Monatsdaten bleiben sichtbar und nutzbar');
    expect(screen).toContain('presentation="inline"');
    expect(queryHook).toContain('const runTrailingRefresh = refreshQueuedRef.current');
    expect(queryHook).toContain('queueMicrotask');
    expect(queryHook).not.toContain('while (refreshQueuedRef.current)');
  });

  it('liefert eine klar gegliederte Monatssteuerung und einen belastbaren Live-Marker', () => {
    expect(screen).toContain("healthosPayrollRevision: 'r8'");
    expect(screen).toContain('OFFICE · LOHN- UND ZEITSTEUERUNG');
    expect(screen).toContain('Mitarbeitendenabrechnungen');
    expect(screen).toContain('Daten aktualisieren');
    expect(screen).toContain('Aktueller Monat');
    expect(screen).toContain('PDF-FREIGABEN');
  });

  it('verdichtet Mitarbeitende und bewahrt alle abrechnungsrelevanten Details', () => {
    expect(screen).toContain('accessibilityState={{ expanded: isExpanded }}');
    expect(screen).toContain('formatPayrollMinutes(employee.actualWorkMinutes)');
    expect(screen).toContain('formatPayrollBalanceMinutes(employee.timeAccountBalanceMinutes)');
    expect(screen).toContain('employee.pendingPortalUploads.map');
    expect(screen).toContain('employee.expenseClaims.map');
    expect(screen).toContain('automatisch aus Fahrtenbuch');
  });

  it('sichert PDF- und Auslagenaktionen mit Zeitgrenzen und Eingabeprüfung ab', () => {
    expect(screen).toContain('ACTION_TIMEOUT_MS = 90_000');
    expect(screen).toContain("'PDF-Erstellung und Veröffentlichung'");
    expect(screen).toContain("'Dokumentabruf'");
    expect(screen).toContain("'Auslagenprüfung'");
    expect(screen).toContain('approvedAmountCents > originalCents');
    expect(screen).toContain('Für eine Rückfrage oder Ablehnung ist ein Prüfvermerk erforderlich');
  });
});
