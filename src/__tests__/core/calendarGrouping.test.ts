import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  fetchCalendarWeek,
  groupAssignmentsIntoCalendarDays,
} from '@/lib/assist/calendarService';
import { getDemoAssignmentListItems } from '@/data/demo/assistAssignments';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Calendar Grouping', () => {
  it('gruppiert Einsätze nach Datum', () => {
    const groups = groupAssignmentsIntoCalendarDays(getDemoAssignmentListItems());
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(group.label).toBeTruthy();
      expect(group.assignments.length).toBeGreaterThan(0);
      for (const assignment of group.assignments) {
        expect(assignment.scheduledStart.startsWith(group.dateKey)).toBe(true);
      }
    }
  });

  it('verweigert ohne Berechtigung', async () => {
    const result = await fetchCalendarWeek(DEMO_TENANT_ID, 'client_portal');
    expect(result.ok).toBe(false);
  });

  it('calendarService nutzt guardServiceTenant und Live-Assignment-List', () => {
    const source = readSrc('src/lib/assist/calendarService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain("getServiceMode() === 'supabase'");
    expect(source).toContain('fetchAssignmentList');
    expect(source).not.toContain('Mandant nicht gefunden');
  });

  it('AssistCalendarScreen nutzt vollen Kalender und Detail-Modal', () => {
    const source = readSrc('src/screens/assist/AssistCalendarScreen.tsx');
    expect(source).toContain('CareLightPageShell');
    expect(source).toContain('AssistCalendarView');
    expect(source).toContain('AssignmentDetailGlassModal');
    expect(source).toContain('showBack={false}');
    expect(source).not.toContain('AssistCalendarListHero');
  });
});
