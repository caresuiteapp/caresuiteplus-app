import { describe, expect, it } from 'vitest';
import { berlinCalendarDate, careTourCanComplete, nextCareStopStatus, validateCareTour, type CareTourInput } from '@/lib/pflege/careTourWorkflow';
const input = (): CareTourInput => ({ tourDate: '2026-10-02', name: 'Frühtour', employeeId: 'employee', notes: '', vehicleLabel: '', stops: [{ clientId: 'client', plannedStart: '07:00', plannedEnd: '07:30', serviceSummary: 'Grundpflege' }] });
describe('Ambulante Tour: Eingaben und Abschluss', () => {
  it('accepts valid ordered visits', () => expect(validateCareTour(input())).toBeNull());
  it.each(['2026-02-30', '2026-13-02', '02.10.2026', ''])('rejects invalid date %s', (date) => expect(validateCareTour({ ...input(), tourDate: date })).toBeTruthy());
  it.each(['7:00', '24:00', '07:60', ''])('rejects malformed time %s', (time) => { const value = input(); value.stops[0].plannedStart = time; expect(validateCareTour(value)).toBeTruthy(); });
  it('rejects overlaps and permits travel gaps', () => { const value = input(); value.stops.push({ ...value.stops[0], plannedStart: '07:15', plannedEnd: '08:00' }); expect(validateCareTour(value)).toMatch(/überschneiden/); value.stops[1].plannedStart = '07:45'; expect(validateCareTour(value)).toBeNull(); });
  it('requires a linked client and service', () => { const value = input(); value.stops[0].clientId = ''; expect(validateCareTour(value)).toBeTruthy(); });
  it('requires every visit to be terminal before tour completion', () => { expect(careTourCanComplete([])).toBe(false); expect(careTourCanComplete([{ status: 'completed' }, { status: 'in_progress' }])).toBe(false); expect(careTourCanComplete([{ status: 'completed' }, { status: 'cancelled' }])).toBe(true); });
  it('has no action after a terminal visit', () => { expect(nextCareStopStatus('completed')).toBeNull(); expect(nextCareStopStatus('in_progress')).toBe('completed'); });
  it('uses Berlin calendar date around UTC midnight and DST', () => { expect(berlinCalendarDate(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02'); expect(berlinCalendarDate(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-02'); });
});
