import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Kalender-Detailansicht', () => {
  it('shows resolved participant names instead of internal UUIDs', () => {
    const drawer = read('src/components/calendar/CalendarEventDrawer.tsx');
    const service = read('src/lib/calendar/calendarEventService.ts');
    expect(service).toContain('enrichRelatedEmployeeNames');
    expect(service).toContain('fetchEmployeeNamesById');
    expect(drawer).toContain('employeeDisplayName');
    expect(drawer).not.toContain('value={record.relatedEmployeeId}');
    expect(drawer).not.toContain('value={record.relatedClientId}');
  });

  it('formats all-day periods for people and removes duplicate source actions', () => {
    const drawer = read('src/components/calendar/CalendarEventDrawer.tsx');
    expect(drawer).toContain('formatCalendarEventPeriod');
    expect(drawer).toContain("timeZone: 'UTC'");
    expect(drawer).toContain("const canEdit = sourceType === 'custom_event'");
    expect(drawer).toContain('Mitarbeiterakte öffnen');
    expect(drawer).not.toContain('title="Quelldatensatz"');
  });
});
