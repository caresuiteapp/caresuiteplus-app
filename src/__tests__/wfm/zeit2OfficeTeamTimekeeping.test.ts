import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildTeamRowWarnings,
  formatWfmDurationMinutes,
  formatWfmEventTypeLabel,
  formatWfmTime,
  isWfmAbsenceCoveringDate,
  resolveTeamEmployeeStatusLabel,
  resolveWfmWorkTypeLabel,
  WFM_EVENT_SOURCE_LABELS,
} from '@/lib/wfm/wfmDisplayHelpers';
import type { WfmAbsence, WfmTimeEvent, WfmWorkSession } from '@/types/modules/wfm';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function baseSession(overrides: Partial<WfmWorkSession> = {}): WfmWorkSession {
  return {
    id: 'sess-1',
    tenantId: 'tenant-1',
    employeeId: 'emp-1',
    userId: null,
    workDate: '2026-07-03',
    status: 'office',
    workMode: 'office',
    displayStatus: 'buero',
    startedAt: '2026-07-03T08:00:00.000Z',
    endedAt: null,
    lastEventAt: '2026-07-03T08:00:00.000Z',
    grossMinutes: 120,
    netMinutes: 120,
    pauseMinutes: 0,
    isOnline: true,
    ...overrides,
  };
}

describe('ZEIT.2 wfmDisplayHelpers', () => {
  it('formats times and durations in German locale style', () => {
    expect(formatWfmTime(null)).toBe('—');
    expect(formatWfmDurationMinutes(0)).toBe('—');
    expect(formatWfmDurationMinutes(45)).toBe('45 Min.');
    expect(formatWfmDurationMinutes(125)).toBe('2:05 h');
  });

  it('maps work type labels from session status', () => {
    expect(resolveWfmWorkTypeLabel(baseSession())).toBe('Büro');
    expect(resolveWfmWorkTypeLabel(baseSession({ status: 'on_visit', displayStatus: 'im_einsatz' }))).toBe(
      'Einsatz',
    );
    expect(resolveWfmWorkTypeLabel(baseSession({ status: 'homeoffice', displayStatus: 'homeoffice' }))).toBe(
      'Home Office',
    );
  });

  it('prefers absence status over session status', () => {
    const absence: WfmAbsence = {
      id: 'abs-1',
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      absenceType: 'vacation',
      status: 'approved',
      startsAt: '2026-07-01T00:00:00.000Z',
      endsAt: '2026-07-10T23:59:59.000Z',
      allDay: true,
      requestedDays: 5,
      employeeNote: '',
      internalNote: '',
      createdAt: '',
      updatedAt: '',
    };
    expect(resolveTeamEmployeeStatusLabel(baseSession(), absence)).toBe('Urlaub');
    expect(isWfmAbsenceCoveringDate(absence, '2026-07-03')).toBe(true);
    expect(isWfmAbsenceCoveringDate(absence, '2026-07-15')).toBe(false);
  });

  it('uses human-readable event and source labels', () => {
    expect(formatWfmEventTypeLabel('office_check_in')).toBe('Büro');
    expect(WFM_EVENT_SOURCE_LABELS.portal).toBe('Portal');
    expect(WFM_EVENT_SOURCE_LABELS.assist).toBe('Einsatz');
  });

  it('builds ArbZG-related warnings without raw technical keys', () => {
    const session = baseSession({ netMinutes: 610, pauseMinutes: 0, isOnline: true });
    const warnings = buildTeamRowWarnings(session, [], []);
    expect(warnings.some((w) => w.includes('ArbZG'))).toBe(true);
    expect(warnings.some((w) => w.includes('max_daily_hours'))).toBe(false);
  });
});

describe('ZEIT.2 TimeTrackingTeamScreen UI contract', () => {
  it('shows compact team summary and enriched team rows', () => {
    const source = readSrc('src/components/wfm/TimeTrackingTeamScreen.tsx');
    expect(source).toContain('getWfmTeamTodayOverview');
    expect(source).toContain('Heute erfasst:');
    expect(source).toContain('Aktive MA:');
    expect(source).toContain('In Pause:');
    expect(source).toContain('Im Einsatz:');
    expect(source).toContain('Im Büro:');
    expect(source).toContain('Homeoffice:');
    expect(source).toContain('Offen zur Prüfung:');
    expect(source).toContain('Offene Anträge:');
    expect(source).toContain('WfmTeamTodayEmployeeCard');
    expect(source).toContain('WfmTeamTodayDetailPanel');
  });

  it('routes absence approvals via abwesenheiten tab instead of quick approve', () => {
    const nav = readSrc('src/lib/navigation/officeTimeTrackingNav.ts');
    const source = readSrc('src/components/wfm/TimeTrackingTeamScreen.tsx');
    expect(nav).toContain('abwesenheiten');
    expect(source).toContain('Abwesenheiten');
    expect(source).not.toContain('reviewWfmAbsenceRequest');
    expect(source).not.toContain('Schnellentscheidung');
  });

  it('WfmTeamTodayEmployeeCard shows status, times and source', () => {
    const source = readSrc('src/components/wfm/WfmTeamTodayEmployeeCard.tsx');
    expect(source).toContain('PremiumAvatar');
    expect(source).toContain('statusLabel');
    expect(source).toContain('workTypeLabel');
    expect(source).toContain('lastEventSourceLabel');
    expect(source).toContain('warnings');
  });

  it('requests tab aligns with WfmEmployeeRequestsOfficeScreen', () => {
    const route = readSrc('app/business/office/time-tracking/abwesenheiten.tsx');
    expect(route).toContain('WfmEmployeeRequestsOfficeScreen');
    const screen = readSrc('src/components/wfm/WfmEmployeeRequestsOfficeScreen.tsx');
    expect(screen).toContain('Ablehnungsgrund');
    expect(screen).toContain('reviewWfmAbsenceRequest');
  });

  it('export screen exists without fake placeholder button on team screen', () => {
    const nav = readSrc('src/lib/navigation/officeTimeTrackingNav.ts');
    expect(nav).toContain("key: 'export'");
    const exportScreen = readSrc('src/components/wfm/WfmExportScreen.tsx');
    expect(exportScreen).toContain('createWfmExportJob');
    expect(exportScreen).toContain('testID="wfm-export-screen"');
    expect(exportScreen).not.toContain('buildWfmPdfStub');
  });

  it('export tab renders stable shell and disables actions without session context', () => {
    const exportScreen = readSrc('src/components/wfm/WfmExportScreen.tsx');
    expect(exportScreen).toContain('Arbeitszeit-Export');
    expect(exportScreen).toContain('CSV exportieren');
    expect(exportScreen).toContain('exportReady');
    expect(exportScreen).toContain('disabled={loading || !exportReady}');
    expect(exportScreen).toContain('Sitzung wird geladen');
  });

  it('export web download is guarded for headless browsers', () => {
    const exportScreen = readSrc('src/components/wfm/WfmExportScreen.tsx');
    expect(exportScreen).toContain('triggerWebFileDownload');
    expect(exportScreen).toContain('Headless or restricted browser');
    expect(exportScreen).toContain('triggerCsvDownload');
  });

  it('export service produces CSV without crashing on empty month', async () => {
    const { exportWfmSessionsCsv } = await import('@/lib/wfm/wfmExportService');
    const result = await exportWfmSessionsCsv('tenant-empty-export', 'business_admin', 2099, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.csv.startsWith('Datum;Mitarbeiter-ID')).toBe(true);
    expect(result.data.rowCount).toBeGreaterThanOrEqual(0);
  });

  it('own time entry uses dedicated eigene-erfassung route', () => {
    const nav = readSrc('src/lib/navigation/officeTimeTrackingNav.ts');
    expect(nav).toContain('eigene-erfassung');
    const own = readSrc('src/components/timeTracking/TimeTrackingEmployeeScreen.tsx');
    expect(own).toContain('wfmClockIn');
  });

  it('office time tracking shell defines ten primary tabs', () => {
    const shell = readSrc('src/components/wfm/OfficeTimeTrackingShell.tsx');
    const nav = readSrc('src/lib/navigation/officeTimeTrackingNav.ts');
    expect(shell).toContain('OFFICE_TIME_TRACKING_TABS.map');
    expect(shell).toContain('accessibilityRole="tab"');
    expect(shell).toContain('Eigene Erfassung');
    expect(nav).toContain("key: 'live'");
    expect(nav).toContain("key: 'zeitkonten'");
    expect(nav).toContain("key: 'pruefqueue'");
    expect(nav).toContain("key: 'abwesenheiten'");
    expect(nav).toContain("key: 'nachtraege'");
    expect(nav).toContain("key: 'fahrzeitregeln'");
    expect(nav).toContain("key: 'team-meetings'");
    expect(nav).toContain("key: 'historie'");
    expect(nav).toContain("key: 'export'");
    expect(nav).toContain("key: 'einstellungen'");
  });
});

describe('ZEIT.2 regression guards', () => {
  it('ZEIT.1 portal employee resolver unchanged on MP arbeitszeit', () => {
    const source = readSrc('src/components/timeTracking/TimeTrackingEmployeeScreen.tsx');
    expect(source).toContain('usePortalActor');
    expect(source).toContain('portalEmployeeId ?? profile?.employeeId ?? null');
  });

  it('wfm team service joins sessions and events', () => {
    const source = readSrc('src/lib/wfm/wfmTeamTodayService.ts');
    expect(source).toContain('listSessionsForDate');
    expect(source).toContain('fetchSessionEvents');
    expect(source).toContain('listWfmAbsencesForTeam');
    expect(source).toContain('listWfmTeamRuleViolationsToday');
  });

  it('detail panel shows events and absences without raw event_type keys in UI', () => {
    const source = readSrc('src/components/wfm/WfmTeamTodayDetailPanel.tsx');
    expect(source).toContain('formatWfmEventTypeLabel');
    expect(source).not.toContain('event.event_type');
  });
});

describe('ZEIT.2 event timeline helpers', () => {
  it('flags missing end time warning', () => {
    const session = baseSession({ isOnline: false, endedAt: null, status: 'clocked_in' });
    const events: WfmTimeEvent[] = [
      {
        id: 'e1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        userId: null,
        eventType: 'clock_in',
        workMode: 'office',
        source: 'portal',
        occurredAt: '2026-07-03T08:00:00.000Z',
        sessionId: 'sess-1',
        note: null,
      },
    ];
    const warnings = buildTeamRowWarnings(session, events, []);
    expect(warnings.some((w) => w.includes('Endzeit'))).toBe(true);
  });
});
