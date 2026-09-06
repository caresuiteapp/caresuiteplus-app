import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildAssistLiveRouteSummary } from '@/features/assistLive/getAssistLiveMonitoring';

const read = (file: string) => readFileSync(file, 'utf8');

describe('Fahrtenbuch R16 · GPS-Wahrheit und Bestandsnachholung', () => {
  it('kennzeichnet eine unterbrochene GPS-Spur als unvollständig statt als Gesamtstrecke', () => {
    const route = buildAssistLiveRouteSummary([
      { latitude: 51.5130, longitude: 7.4650, accuracyMeters: 10, capturedAt: '2026-09-01T08:00:00.000Z' },
      { latitude: 51.5140, longitude: 7.4660, accuracyMeters: 10, capturedAt: '2026-09-01T08:01:00.000Z' },
      { latitude: 51.5400, longitude: 7.2200, accuracyMeters: 10, capturedAt: '2026-09-01T09:15:00.000Z' },
      { latitude: 51.5410, longitude: 7.2210, accuracyMeters: 10, capturedAt: '2026-09-01T09:16:00.000Z' },
    ]);
    expect(route.gapCount).toBe(1);
    expect(route.unresolvedGapCount).toBe(1);
    expect(route.distanceStatus).toBe('incomplete');
    expect(route.measuredDistanceKm).toBe(route.totalDistanceKm);
  });

  it('ergänzt Lücken ausschließlich über echte Google-Straßenrouten und nie per Luftlinie', () => {
    const recovery = read('src/features/liveTracking/reconcileAssistLiveRouteGaps.ts');
    expect(recovery).toContain("route.source === 'google'");
    expect(recovery).toContain("transportMode: 'car'");
    expect(recovery).not.toContain('straightLine');
    expect(recovery).not.toContain('haversine');
  });

  it('liest vorhandene Assist-GPS-Sitzungen rückwirkend ab dem 24.08.2026', () => {
    const recovery = read('src/lib/employeeLogbook/employeeLogbookAssistGpsRecovery.ts');
    expect(recovery).toContain("EMPLOYEE_LOGBOOK_RECOVERY_SINCE = '2026-08-24");
    expect(recovery).toContain("'assist_tracking_sessions'");
    expect(recovery).toContain("'assist_location_points'");
    expect(recovery).toContain('assist_gps_recovery:');
  });

  it('übernimmt nur abgeschlossene, vollständige und noch nicht importierte Fahrtabschnitte', () => {
    const recovery = read('src/lib/employeeLogbook/employeeLogbookAssistGpsRecovery.ts');
    expect(recovery).toContain('!leg.imported');
    expect(recovery).toContain('candidate.active || !candidate.endedAt');
    expect(recovery).toContain('leg.unresolvedGapCount === 0');
    expect(recovery).toContain("leg.reviewRequired ? 'review_required' : 'completed'");
  });

  it('zeigt fehlende Fahrzeugzuordnung offen an und verliert die GPS-Daten nicht', () => {
    const visit = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const card = read('src/components/portal/EmployeePortalVisitLogbookCard.tsx');
    expect(visit).toContain("logbook.reason === 'no_active_vehicle'");
    expect(visit).toContain('Live-GPS läuft und bleibt gespeichert');
    expect(card).toContain('muss die Verwaltung ein aktives Fahrzeug zuordnen');
  });

  it('öffnet den Verwaltungszeitraum ab 24.08. und weist ungeklärte Kilometer aus', () => {
    const panel = read('src/components/office/EmployeeLogbookOfficePanel.tsx');
    const live = read('src/screens/assist/AssistLiveStatusScreen.tsx');
    expect(panel).toContain('EMPLOYEE_LOGBOOK_RECOVERY_SINCE.slice(0, 10)');
    expect(panel).toContain('Automatische GPS-Aufzeichnungen seit 24.08.2026');
    expect(live).toContain("row.route.distanceStatus === 'incomplete' ? 'GPS-Teilstrecke'");
    expect(live).toContain('noch unvollständig');
    expect(live).not.toContain('<Text style={styles.routeMetricLabel}>Route gesamt</Text>');
  });
});
