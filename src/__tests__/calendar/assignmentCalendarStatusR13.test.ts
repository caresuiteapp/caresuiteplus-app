import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import {
  ASSIGNMENT_CALENDAR_VISUALS,
  resolveAssignmentCalendarVisual,
} from '@/lib/calendar/assignmentCalendarStatus';
import { visitListItemToCalendarEvent } from '@/lib/calendar/assistVisitCalendarRecurrence';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import { resolveAssignmentCalendarVisual as resolveWebVisual } from '@/lib/calendar/assignmentCalendarPresentation.web';
import { resolveCalendarEventColors, ASSIGNMENT_CALENDAR_COLORS } from '@/lib/calendar/calendarEventColors.web';

const now = new Date('2026-08-26T12:00:00.000Z');
const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

function assignment(status: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: `assignment-${status}`,
    title: 'Alltagsbegleitung',
    start: '2026-08-26T13:00:00.000Z',
    end: '2026-08-26T15:00:00.000Z',
    type: 'einsatz',
    color: '#FFB020',
    status,
    ...overrides,
  };
}

describe('Einsatzstatusfarben im Kalender R13', () => {
  it('unterscheidet Planung, aktive Fahrt, Nacharbeit, Problem, Abschluss und Absage', () => {
    expect(resolveAssignmentCalendarVisual(assignment('bestaetigt'), now)?.state).toBe('scheduled');
    expect(resolveAssignmentCalendarVisual(assignment('unterwegs'), now)?.state).toBe('active');
    expect(resolveAssignmentCalendarVisual(assignment('dokumentation_offen'), now)?.state).toBe('open');
    expect(resolveAssignmentCalendarVisual(assignment('nicht_erschienen'), now)?.state).toBe('problem');
    expect(resolveAssignmentCalendarVisual(assignment('abgeschlossen'), now)?.state).toBe('completed');
    expect(resolveAssignmentCalendarVisual(assignment('storniert'), now)?.state).toBe('cancelled');
  });

  it('markiert Risikoeinsätze und überfällige offene Planung rot', () => {
    expect(resolveAssignmentCalendarVisual(assignment('bestaetigt', { isAtRisk: true }), now)?.state).toBe('problem');
    expect(
      resolveAssignmentCalendarVisual(
        assignment('geplant', {
          start: '2026-08-25T08:00:00.000Z',
          end: '2026-08-25T10:00:00.000Z',
        }),
        now,
      ),
    ).toMatchObject({ state: 'problem', label: 'Überfällig' });
  });

  it('wertet unvollständige beendete Einsätze als offen aus', () => {
    expect(
      resolveAssignmentCalendarVisual(
        assignment('beendet', { isIncomplete: true }),
        now,
      )?.state,
    ).toBe('open');
  });

  it('ändert die Ereignisfarben anderer Kalendertypen nicht', () => {
    expect(
      resolveAssignmentCalendarVisual({
        ...assignment('completed'),
        type: 'urlaub',
        sourceType: 'workforce_absence',
      }),
    ).toBeNull();
  });

  it('reicht Risiko- und Unvollständigkeitsmerkmale aus der Einsatzquelle durch', () => {
    const item = {
      id: 'visit-1',
      tenantId: 'tenant-1',
      title: 'Alltagsbegleitung',
      serviceName: 'Alltagsbegleitung',
      scheduledStart: '2026-08-26T13:00:00.000Z',
      scheduledEnd: '2026-08-26T15:00:00.000Z',
      durationMinutes: 120,
      status: 'aktiv',
      assignmentStatus: 'bestaetigt',
      planningStatus: 'at_risk',
      proofStatus: 'none',
      billingStatus: 'preview',
      location: 'Dortmund',
      clientName: 'Dagmar Ritzenhoff',
      employeeId: 'employee-1',
      employeeName: 'Kathrin Pott',
      isAtRisk: true,
      isIncomplete: true,
      updatedAt: '2026-08-26T11:00:00.000Z',
    } satisfies VisitDispositionListItem;

    expect(visitListItemToCalendarEvent(item)).toMatchObject({
      status: 'bestaetigt',
      isAtRisk: true,
      isIncomplete: true,
    });
  });

  it('verwendet eine barrierearme Text- und Farblegende', () => {
    expect(ASSIGNMENT_CALENDAR_VISUALS.completed).toMatchObject({
      label: 'Abgeschlossen',
      symbol: '✓',
      color: '#15803D',
    });
    expect(ASSIGNMENT_CALENDAR_VISUALS.problem.legendLabel).toContain('Problem');
  });

  it('bindet Statuslegende, Statusbadge und flächige Statusfarbe in den Kalender ein', () => {
    const shell = read('src/components/calendar/CalendarPageShell.tsx');
    const label = read('src/components/calendar/CalendarEventLabel.tsx');
    const chip = read('src/components/office/calendar/OfficeCalendarEventChip.tsx');
    const list = read('src/components/calendar/CalendarListView.tsx');
    expect(shell).toContain('<CalendarAssignmentStatusLegend />');
    expect(label).toContain('assignmentVisual.label.toUpperCase()');
    expect(chip).toContain('assignmentVisual && styles.assignmentChip');
    expect(chip).toContain('backgroundColor: assignmentVisual.tint');
    expect(list).toContain('backgroundColor: assignmentVisual?.tint');
  });
});

describe('Web calendar lifecycle presentation', () => {
  it.each(['geplant', 'bestaetigt'])('keeps future %s visits with outstanding required tasks planned', (status) => {
    const event = assignment(status, { isIncomplete: true });
    expect(resolveWebVisual(event, now)).toMatchObject({ state: 'scheduled', label: 'Geplant / bestätigt' });
    expect(resolveCalendarEventColors(event, now)).toEqual(ASSIGNMENT_CALENDAR_COLORS.scheduled);
    expect(event.isIncomplete).toBe(true);
    // The Web correction does not replace the native/shared presentation.
    expect(resolveAssignmentCalendarVisual(event, now)?.state).toBe('open');
  });

  it.each(['unterwegs', 'angekommen', 'gestartet', 'pausiert'])('keeps %s active even with open tasks after its planned end', (status) => {
    expect(resolveWebVisual(assignment(status, {
      isIncomplete: true, start: '2026-08-25T08:00:00Z', end: '2026-08-25T10:00:00Z',
    }), now)?.state).toBe('active');
  });

  it('distinguishes past incomplete visits from overdue planning and keeps explicit follow-up regardless of date', () => {
    const past = assignment('bestaetigt', { start: '2026-08-25T08:00:00Z', end: '2026-08-25T10:00:00Z' });
    expect(resolveWebVisual({ ...past, isIncomplete: true }, now)).toMatchObject({ state: 'open', label: 'Nacharbeit offen' });
    expect(resolveCalendarEventColors({ ...past, isIncomplete: true }, now)).toEqual(ASSIGNMENT_CALENDAR_COLORS.open);
    expect(resolveWebVisual(past, now)).toMatchObject({ state: 'problem', label: 'Überfällig' });
    for (const status of ['beendet', 'dokumentation_offen', 'unterschrift_offen', 'review']) {
      expect(resolveWebVisual(assignment(status), now)).toMatchObject({ state: 'open', label: 'Nacharbeit offen' });
    }
  });

  it('preserves cancellation, risks and completed states when outstanding-task flags are present', () => {
    for (const [status, expected] of [['storniert', 'cancelled'], ['nicht_erschienen', 'problem'], ['abgeschlossen', 'completed']]) {
      expect(resolveWebVisual(assignment(status, { isIncomplete: true }), now)?.state).toBe(expected);
    }
    expect(resolveWebVisual(assignment('bestaetigt', { isIncomplete: true, isAtRisk: true }), now)?.state).toBe('problem');
    expect(resolveWebVisual(assignment('storniert', { isIncomplete: true, isAtRisk: true }), now)?.state).toBe('cancelled');
  });

  it('does not infer follow-up from an invalid, all-day or not-yet-ended planning slot', () => {
    for (const overrides of [{ end: now.toISOString() }, { end: 'invalid' }, { allDay: true, end: '2026-08-25' }]) {
      expect(resolveWebVisual(assignment('geplant', { isIncomplete: true, ...overrides }), now)?.state).toBe('scheduled');
    }
    expect(resolveWebVisual(assignment('geplant', { type: 'urlaub', sourceType: 'workforce_absence', isIncomplete: true }), now)).toBeNull();
  });
});
