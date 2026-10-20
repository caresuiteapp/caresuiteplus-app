// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@/types/modules/calendarEvent';

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@/components/calendar/OfficeAssignmentProfileCalendarPlanner', () => ({
  buildAssignmentProfileDropTargetProps: () => ({}),
}));
vi.mock('@/components/calendar/OfficeAssignmentProfileCalendarPlanner.web', () => ({
  buildAssignmentProfileDropTargetProps: () => ({}),
}));

import { OfficeCalendarMonthView } from '@/components/office/calendar/OfficeCalendarMonthView.web';
import { OfficeCalendarWeekView } from '@/components/office/calendar/OfficeCalendarWeekView.web';
import { OfficeCalendarDayView } from '@/components/office/calendar/OfficeCalendarDayView.web';
import { OfficeCalendarYearView } from '@/components/office/calendar/OfficeCalendarYearView.web';
import { CalendarAgendaList } from '@/components/calendar/CalendarAgendaList.web';
import { CalendarListView } from '@/components/calendar/CalendarListView.web';
import { AssignmentProfileDateSelectionContext } from '@/components/calendar/AssignmentProfileDateSelection';

// These are DOM behavior tests. They deliberately make no geometry or visual
// quality assertions: happy-dom does not perform browser layout.
const anchor = new Date(2026, 9, 19, 12);
const instant = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();
const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'event-1', title: 'Hausbesuch Erika Beispiel', type: 'termin',
  start: instant(19, 10), end: instant(19, 11), color: '#247bcc',
  employeeId: 'employee-1', employeeName: 'Alex Team', moduleKey: 'assist',
  ...overrides,
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const click = async (element: Element) => { await act(async () => (element as HTMLElement).click()); };
const buttonWith = (text: string) => [...host.querySelectorAll('button')].find(button => (button.textContent ?? '').includes(text));

describe('Web calendar view interactions', () => {
  it.each(['month', 'week', 'day', 'agenda', 'list'] as const)('shows matching status labels and colors for future tasks and past follow-up in the %s view', async view => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(anchor);
    const events = [
      event({ id: 'future', type: 'einsatz', status: 'bestaetigt', isIncomplete: true, start: instant(19, 15), end: instant(19, 16) }),
      event({ id: 'follow-up', type: 'einsatz', status: 'bestaetigt', isIncomplete: true, start: instant(19, 8), end: instant(19, 9) }),
    ];
    const shared = { events, onEventPress: vi.fn() };
    await render(view === 'month' ? <OfficeCalendarMonthView {...shared} anchor={anchor} weekStartDay={1} maxCollapsedEvents={3} />
      : view === 'week' ? <OfficeCalendarWeekView {...shared} anchor={anchor} weekStartDay={1} weekFullDay dayViewStartHour={6} />
      : view === 'day' ? <OfficeCalendarDayView {...shared} anchor={anchor} dayViewStartHour={6} />
      : view === 'agenda' ? <CalendarAgendaList {...shared} />
      : <CalendarListView {...shared} />);
    for (const [id, label, background] of [['future', 'Geplant / bestätigt', '#D9E7FF'], ['follow-up', 'Nacharbeit offen', '#FFE3BA']]) {
      const chip = host.querySelector(`[data-calendar-event-id="${id}"]`) as HTMLElement;
      expect(chip).toBeTruthy();
      expect(chip.querySelector('.cs-calendar-event-status')?.textContent).toContain(label);
      expect(chip.getAttribute('aria-label')).toContain(label);
      expect(chip.style.getPropertyValue('--event-background')).toBe(background);
    }
  });

  it.each(['month', 'week', 'day', 'agenda', 'list'] as const)('opens the selected event once in the %s view', async view => {
    const selected = event();
    const onEventPress = vi.fn();
    const shared = { events: [selected], onEventPress };
    const content = view === 'month' ? <OfficeCalendarMonthView {...shared} anchor={anchor} weekStartDay={1} maxCollapsedEvents={3} />
      : view === 'week' ? <OfficeCalendarWeekView {...shared} anchor={anchor} weekStartDay={1} weekFullDay dayViewStartHour={6} />
      : view === 'day' ? <OfficeCalendarDayView {...shared} anchor={anchor} dayViewStartHour={6} />
      : view === 'agenda' ? <CalendarAgendaList {...shared} />
      : <CalendarListView {...shared} />;
    await render(content);
    const button = buttonWith('Hausbesuch Erika Beispiel');
    expect(button).toBeTruthy();
    await click(button!);
    expect(onEventPress).toHaveBeenCalledExactlyOnceWith(selected);
  });

  it('opens the selected month from the year overview', async () => {
    const onSelectMonth = vi.fn();
    await render(<OfficeCalendarYearView anchor={anchor} events={[event()]} onSelectMonth={onSelectMonth} />);
    const october = buttonWith('Oktober');
    expect(october).toBeTruthy();
    await click(october!);
    expect(onSelectMonth).toHaveBeenCalledExactlyOnceWith(9);
  });

  it('keeps every event reachable when a month day has more than the collapsed limit', async () => {
    const events = Array.from({ length: 5 }, (_, index) => event({ id: `entry-${index}`, title: `Besuch ${index + 1}` }));
    const onEventPress = vi.fn();
    await render(<OfficeCalendarMonthView anchor={anchor} events={events} weekStartDay={1} maxCollapsedEvents={2} onEventPress={onEventPress} />);
    expect(buttonWith('Besuch 5')).toBeUndefined();
    const expand = [...host.querySelectorAll('button')].find(button => /weitere|mehr|anzeigen/i.test(button.textContent ?? ''));
    expect(expand).toBeTruthy();
    await click(expand!);
    await click(buttonWith('Besuch 5')!);
    expect(onEventPress).toHaveBeenCalledExactlyOnceWith(events[4]);
  });

  it('does not select a profile date when opening a month event', async () => {
    const selectDate = vi.fn();
    const onEventPress = vi.fn();
    await render(<AssignmentProfileDateSelectionContext.Provider value={{ selectedDateKeys: [], disabled: false, selectDate }}>
      <OfficeCalendarMonthView anchor={anchor} events={[event()]} weekStartDay={1} maxCollapsedEvents={3} onEventPress={onEventPress} />
    </AssignmentProfileDateSelectionContext.Provider>);
    await click(buttonWith('Hausbesuch Erika Beispiel')!);
    expect(onEventPress).toHaveBeenCalledOnce();
    expect(selectDate).not.toHaveBeenCalled();
    const dateButton = [...host.querySelectorAll('button')].find(button => /19\..*Oktober|19.*Oktober/.test(button.getAttribute('aria-label') ?? ''));
    expect(dateButton).toBeTruthy();
    await click(dateButton!);
    expect(selectDate).toHaveBeenCalledOnce();
    expect(selectDate.mock.calls[0][0].getDate()).toBe(19);
  });

  it('opens the requested day from the month when no assignment profile is active', async () => {
    const onSelectDate = vi.fn();
    await render(<OfficeCalendarMonthView anchor={anchor} events={[]} weekStartDay={1} maxCollapsedEvents={3} onSelectDate={onSelectDate} />);
    const dateButton = [...host.querySelectorAll('button')].find(button => /19.*Oktober/.test(button.getAttribute('aria-label') ?? ''));
    expect(dateButton).toBeTruthy();
    await click(dateButton!);
    expect(onSelectDate).toHaveBeenCalledOnce();
    expect(onSelectDate.mock.calls[0][0].getDate()).toBe(19);
    expect(onSelectDate.mock.calls[0][0].getMonth()).toBe(9);
  });

  it('keeps overnight appointments on both affected month days but excludes their midnight boundary', async () => {
    const overnight = event({ id: 'overnight', title: 'Nachtbetreuung', start: instant(19, 22), end: instant(20, 6) });
    const midnight = event({ id: 'midnight', title: 'Abendtermin', start: instant(19, 21), end: instant(20, 0) });
    await render(<OfficeCalendarMonthView anchor={anchor} events={[overnight, midnight]} weekStartDay={1} maxCollapsedEvents={3} onEventPress={vi.fn()} />);
    const matching = (title: string) => [...host.querySelectorAll('button')].filter(button => (button.textContent ?? '').includes(title));
    expect(matching('Nachtbetreuung')).toHaveLength(2);
    expect(matching('Abendtermin')).toHaveLength(1);
  });

  it('includes an overnight continuation within the selected agenda range and excludes adjacent days', async () => {
    const overnight = event({ title: 'Nachtbetreuung', start: instant(18, 22), end: instant(19, 6) });
    const later = event({ id: 'later', title: 'Anderer Zeitraum', start: instant(20, 10), end: instant(20, 11) });
    const onEventPress = vi.fn();
    await render(<CalendarAgendaList events={[overnight, later]} rangeStart={new Date(2026, 9, 19)} rangeEnd={new Date(2026, 9, 20)} onEventPress={onEventPress} />);
    expect(host.textContent).toContain('Fortsetzung vom Vortag');
    expect(host.textContent).toContain('00:00');
    expect(buttonWith('Anderer Zeitraum')).toBeUndefined();
    await click(buttonWith('Nachtbetreuung')!);
    expect(onEventPress).toHaveBeenCalledExactlyOnceWith(overnight);
  });

  it.each([true, false])('keeps the early appointment reachable with weekFullDay=%s', async weekFullDay => {
    const early = event({ title: 'Frühtermin', start: instant(19, 5), end: instant(19, 6) });
    const onEventPress = vi.fn();
    await render(<OfficeCalendarWeekView anchor={anchor} events={[early]} weekStartDay={1} weekFullDay={weekFullDay} dayViewStartHour={6} onEventPress={onEventPress} />);
    const earlyButton = buttonWith('Frühtermin');
    expect(earlyButton).toBeTruthy();
    const outside = earlyButton?.closest('details');
    if (outside) {
      expect(outside.querySelector('summary')?.textContent).toContain('außerhalb');
      await click(outside.querySelector('summary')!);
      expect(outside.open).toBe(true);
    }
    await click(earlyButton!);
    expect(onEventPress).toHaveBeenCalledExactlyOnceWith(early);
  });
});
