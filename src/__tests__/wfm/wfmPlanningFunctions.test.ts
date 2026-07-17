import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('WFM Fahrzeitregeln und Team-Meetings', () => {
  it('uses real screens instead of the former phase placeholders', () => {
    const travelRoute = read('app/business/office/time-tracking/fahrzeitregeln.tsx');
    const meetingRoute = read('app/business/office/time-tracking/team-meetings.tsx');

    expect(travelRoute).toContain('WfmTravelRulesScreen');
    expect(meetingRoute).toContain('WfmTeamMeetingsScreen');
    expect(travelRoute).not.toContain('WfmPlaceholderTabScreen');
    expect(meetingRoute).not.toContain('WfmPlaceholderTabScreen');
  });

  it('creates tenant-isolated persistent planning tables', () => {
    const migration = read('supabase/migrations/0260_wfm_travel_rules_team_meetings.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.workforce_travel_rules');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.workforce_team_meetings');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.workforce_team_meeting_attendees');
    expect(migration).toContain('tenant_id = public.current_tenant_id()');
    expect(migration).toContain("public.has_permission('time.settings.manage')");
  });

  it('books completed paid meetings into the central WFM event stream exactly once', () => {
    const service = read('src/lib/wfm/wfmPlanningService.ts');
    const migration = read('supabase/migrations/0260_wfm_travel_rules_team_meetings.sql');

    expect(service).toContain("complete_wfm_team_meeting");
    expect(migration).toContain("'meeting_start'::TEXT");
    expect(migration).toContain("'meeting_end'::TEXT");
    expect(migration).toContain('attendee.booked_at IS NULL');
    expect(migration).toContain("attendance_status = 'attended'");
  });
});
