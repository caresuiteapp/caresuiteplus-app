import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';
import { finishActiveVisitLogbookTrip, finishVisitApproachLogbook } from '@/lib/employeeLogbook/employeeLogbookAutomation';
import { createSingleFlight } from '@/lib/services/singleFlight';
import { withWorkflowTimeout } from '@/features/assistWorkflow/internal/withWorkflowTimeout';
import { parseTripKilometres, selectVisitLogbookState } from '@/lib/employeeLogbook/visitLogbookState';

const mocks = vi.hoisted(() => ({ load: vi.fn(), finish: vi.fn(), stop: vi.fn(), start: vi.fn(), point: vi.fn(), flush: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/employeeLogbook/employeeLogbookRepository.supabase', () => ({ loadEmployeeLogbook: mocks.load, finishLogbookTrip: mocks.finish }));
vi.mock('@/lib/employeeLogbook/employeeLogbookTracking', () => ({ getCurrentLogbookPoint: mocks.point, stopNativeBackgroundTracking: mocks.stop, startNativeBackgroundTracking: mocks.start }));
vi.mock('@/lib/employeeLogbook/employeeLogbookPointQueue', () => ({ flushLogbookPointQueue: mocks.flush }));
vi.mock('@/lib/office/employeeMobilityService', () => ({}));
vi.mock('@/features/liveTracking/useSingleGeolocationWatch', () => ({}));

const input = { tenantId: 'tenant-a', employeeId: 'employee-a', assignmentId: 'e950fc62-6962-465b-b7fa-334f84f84ed7' };
function trip(extra: Partial<LogbookTrip> = {}): LogbookTrip {
  return { id: 'trip-a', ...input, routeType: 'home_to_client', status: 'recording', startedAt: '2026-09-06T06:00:00Z', distanceFinalKm: 1.2, ...extra } as LogbookTrip;
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  mocks.point.mockResolvedValue({ latitude: 51, longitude: 7, recordedAt: '2026-09-06T06:30:00Z' });
  mocks.flush.mockResolvedValue({ sent: 0, remaining: 0 });
  mocks.stop.mockResolvedValue(undefined); mocks.start.mockResolvedValue(undefined);
  mocks.finish.mockResolvedValue(undefined);
  mocks.load.mockResolvedValueOnce({ trips: [trip()] }).mockResolvedValue({ trips: [trip({ status: 'confirmation_required' })] });
});
afterEach(() => vi.useRealTimers());

describe('arrival and logbook recovery', () => {
  it('finishes a home approach once even when arrival reconciliation and a second tap overlap', async () => {
    const results = await Promise.all([finishVisitApproachLogbook(input), finishVisitApproachLogbook(input)]);
    expect(mocks.finish).toHaveBeenCalledTimes(1);
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result?.status === 'confirmation_required')).toBe(true);
  });
  it('finishes with stored points when the last GPS fix fails indoors', async () => {
    mocks.point.mockRejectedValue(new Error('Location unavailable'));
    expect((await finishVisitApproachLogbook(input))?.status).toBe('confirmation_required');
    expect(mocks.finish).toHaveBeenCalledWith('trip-a', expect.objectContaining({ points: [], notes: expect.stringContaining('Kein GPS-Endpunkt') }));
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it('bounds a GPS fix which never resolves', async () => {
    mocks.point.mockImplementation(() => new Promise(() => undefined));
    const result = finishVisitApproachLogbook(input);
    await vi.advanceTimersByTimeAsync(1_501);
    expect((await result)?.status).toBe('confirmation_required');
  });
  it('does not resume tracking when a response failed after the trip was persisted', async () => {
    mocks.finish.mockRejectedValue(new Error('segment response lost'));
    expect((await finishVisitApproachLogbook(input))?.status).toBe('confirmation_required');
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it('preserves queued GPS points and does not finalize an incompletely uploaded route', async () => {
    mocks.flush.mockResolvedValue({ sent: 1, remaining: 2 });
    mocks.load.mockReset().mockResolvedValue({ trips: [trip()] });
    await expect(finishVisitApproachLogbook(input)).rejects.toThrow('GPS-Punkte');
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.start).toHaveBeenCalledTimes(1);
  });
  it('does not finish another assignment', async () => {
    mocks.load.mockReset().mockResolvedValue({ trips: [trip({ assignmentId: 'another-assignment' })] });
    expect(await finishActiveVisitLogbookTrip(input)).toBeNull();
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.stop).not.toHaveBeenCalled();
  });
  it('keeps an arrival mutation shared after a caller has timed out', async () => {
    const run = createSingleFlight(); let complete!: (value: string) => void;
    const write = vi.fn(() => new Promise<string>((resolve) => { complete = resolve; }));
    const operation = run('arrival', write);
    const timedOut = expect(withWorkflowTimeout(operation, 100)).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(101); await timedOut;
    expect(run('arrival', write)).toBe(operation);
    expect(write).toHaveBeenCalledTimes(1);
    complete('arrived'); expect(await operation).toBe('arrived');
    expect(await run('arrival', async () => 'readback')).toBe('readback');
  });
  it('allows retry after a failed shared operation', async () => {
    const run = createSingleFlight();
    await expect(run('arrival', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(await run('arrival', async () => true)).toBe(true);
  });
  it('isolates current visit confirmations from future visits and the return-trip dialog', () => {
    const pending = trip({ status: 'confirmation_required' });
    const state = selectVisitLogbookState([
      trip({ id: 'future', assignmentId: 'future', status: 'confirmation_required' }),
      trip({ id: 'return', routeType: 'client_to_home', status: 'confirmation_required' }), pending,
    ], input.assignmentId);
    expect(state.pending?.id).toBe(pending.id);
    expect(state.active).toBeNull();
  });
  it.each(['', ' ', '-1', 'Infinity', '1,2,3', '1e2'])('rejects invalid or empty kilometre input %j', (value) => {
    expect(parseTripKilometres(value)).toBeNull();
  });
  it.each([['1,2', 1.2], [' 12.34 ', 12.34], ['0', 0]])('accepts valid kilometre input %j', (value, expected) => {
    expect(parseTripKilometres(String(value))).toBe(expected);
  });
});
