import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Office Arbeitszeit V32.5 Systemprüfung', () => {
  it('keeps demo repositories usable without weakening the live tenant guard', () => {
    const guard = read('src/lib/services/liveServiceGuard.ts');
    expect(guard).toContain("if (getServiceMode() !== 'supabase') return null");
    expect(guard).toContain('assertTenantForMode(tenantId)');
    expect(guard.indexOf("getServiceMode() !== 'supabase'")).toBeLessThan(guard.indexOf('assertTenantForMode(tenantId)'));
  });

  it('loads every active employee for Office manual entries', () => {
    const screen = read('src/components/wfm/WfmNachtraegeOfficeScreen.tsx');
    const planning = read('src/lib/wfm/wfmPlanningService.ts');
    expect(screen).toContain('listWfmActiveEmployees');
    expect(screen).not.toContain('getWfmTeamTodayOverview');
    expect(planning).toContain(".in('status', ['aktiv', 'active'])");
  });

  it('uses structured date, time, pause and rounding controls', () => {
    const history = read('src/components/wfm/WfmOfficeTimeHistoryPanel.tsx');
    const detail = read('src/components/wfm/WfmOfficeTimeReviewDetailPanel.tsx');
    const meetings = read('src/components/wfm/WfmTeamMeetingsScreen.tsx');
    const travel = read('src/components/wfm/WfmTravelRulesScreen.tsx');
    expect(history).toContain('CareDateInput');
    expect(detail).toContain('CareTimeInput');
    expect(detail).toContain('ListFilterSelect');
    expect(detail).not.toContain('placeholder="Start (ISO)"');
    expect(meetings).toContain('CareDateInput');
    expect(meetings).toContain('CareTimeInput');
    expect(travel).toContain('label="Rundung"');
    expect(travel).toContain('ListFilterSelect');
  });

  it('repairs the full planning schema and reloads the API schema cache', () => {
    const migration = read('supabase/migrations/0262_wfm_worktime_system_repair.sql');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.workforce_travel_rules');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.workforce_team_meetings');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.workforce_team_meeting_attendees');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.complete_wfm_team_meeting');
    expect(migration).toContain('attendee.booked_at IS NULL');
    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it('shows actionable schema errors and exposes export audit identifiers', () => {
    const planning = read('src/lib/wfm/wfmPlanningService.ts');
    const exportScreen = read('src/components/wfm/WfmExportScreen.tsx');
    expect(planning).toContain('Arbeitszeit-Systemmigration 0262');
    expect(planning).toContain("error?.code === 'PGRST202'");
    expect(exportScreen).toContain('export_version');
    expect(exportScreen).toContain('changed_after_export');
  });
});
