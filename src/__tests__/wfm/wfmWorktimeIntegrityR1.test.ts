import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deriveWfmTimelineTotals } from '@/lib/wfm/wfmTimeline';
import type { WfmTimeEvent, WfmWorkSession } from '@/types/modules/wfm';

const read = (file: string) => readFileSync(file, 'utf8');

function event(eventType: WfmTimeEvent['eventType'], occurredAt: string): WfmTimeEvent {
  return {
    id: `${eventType}-${occurredAt}`,
    tenantId: 'tenant',
    employeeId: 'employee',
    userId: 'user',
    eventType,
    workMode: 'office',
    source: 'portal',
    occurredAt,
    sessionId: 'session',
    note: null,
  };
}

const endedSession: WfmWorkSession = {
  id: 'session',
  tenantId: 'tenant',
  employeeId: 'employee',
  userId: 'user',
  workDate: '2026-08-24',
  status: 'ended',
  workMode: 'homeoffice',
  displayStatus: 'feierabend',
  startedAt: '2026-08-24T06:00:00.000Z',
  endedAt: '2026-08-24T11:00:00.000Z',
  lastEventAt: '2026-08-24T11:00:00.000Z',
  grossMinutes: 0,
  pauseMinutes: 0,
  netMinutes: 0,
  isOnline: false,
};

describe('WFM Arbeitszeit-Integrität R1', () => {
  it('leitet zwei Arbeitsblöcke und eine Pause aus der Ereigniskette ab', () => {
    const totals = deriveWfmTimelineTotals([
      event('office_check_in', '2026-08-24T06:00:00.000Z'),
      event('pause_start', '2026-08-24T07:30:00.000Z'),
      event('pause_end', '2026-08-24T08:00:00.000Z'),
      event('clock_out', '2026-08-24T09:00:00.000Z'),
      event('homeoffice_start', '2026-08-24T10:00:00.000Z'),
      event('clock_out', '2026-08-24T11:00:00.000Z'),
    ], { session: endedSession });

    expect(totals).toEqual({
      grossMinutes: 240,
      pauseMinutes: 30,
      netMinutes: 210,
      blockCount: 2,
    });
  });

  it('markiert den gesamten WFM-Arbeitsbereich als helle Oberfläche und hält alle Register scrollbar', () => {
    const shell = read('src/components/wfm/OfficeTimeTrackingShell.tsx');
    expect(shell).toContain("csWfmSurface: 'light'");
    expect(shell).toContain("csPersonalSurface: 'light'");
    expect(shell).toContain('testID="office-time-workspace-scroll"');
    expect(shell).toContain('nestedScrollEnabled');
    expect(shell).toContain('contentContainerStyle={styles.workspaceScrollContent}');
    expect(shell).toContain("overflowY: 'auto'");
    expect(shell).toContain("scrollbarGutter: 'stable'");
  });

  it('deaktiviert den ungeprüften Alt-Export vollständig', () => {
    const screen = read('src/components/wfm/WfmExportScreen.tsx');
    expect(screen).toContain('Alt-Export gesperrt');
    expect(screen).not.toContain('wfm-export-csv');
    expect(screen).not.toContain('DATEV LOHN exportieren');
    expect(screen).not.toContain('createWfmExportJob');
  });

  it('lädt nur aktive Mitarbeiter und schreibt bei Übersichtsabfragen keine Reviews', () => {
    const employees = read('src/lib/wfm/wfmOfficePlannedVisitRepository.ts');
    const overview = read('src/lib/wfm/wfmOfficeTimekeepingService.ts');
    expect(employees).toContain(".status ?? '').trim().toLowerCase() === 'active'");
    expect(overview).not.toContain('ensurePendingReviewForEntry');
    expect(overview).not.toContain('WFM_REVIEW_SYSTEM_ACTOR');
  });

  it('liefert atomare Stempelaktionen und nur eine lesende Dubletten-Diagnose aus', () => {
    const migration = read('supabase/migrations/20260824150000_wfm_worktime_integrity_r1.sql');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.wfm_apply_clock_action');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("'atomic_action', p_action");
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.wfm_employee_identity_conflicts');
    expect(migration).not.toContain('DELETE FROM public.employees');
    expect(migration).not.toContain('UPDATE public.employees');
  });

  it('begrenzt Live-GPS auf aktuelle Daten und lädt Punkte gebündelt', () => {
    const live = read('src/features/liveTracking/getOfficeLiveEmployees.ts');
    expect(live).toContain('LIVE_TRACKING_FRESHNESS_MS');
    expect(live).toContain(".in('visit_id', visitIds)");
    expect(live).not.toContain(".eq('visit_id', session.visit_id)");
  });
});
