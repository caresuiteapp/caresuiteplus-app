import { describe, expect, it } from 'vitest';
import {
  createEmployeeExecutionState,
  InvalidEmployeeExecutionTransition,
  reduceEmployeeExecution,
  type EmployeeTravelLeg,
} from '@/features/employeeExecutionCore';

function leg(id: string, purpose: EmployeeTravelLeg['purpose']): EmployeeTravelLeg {
  return {
    id,
    mode: 'car',
    purpose,
    startedAt: '2026-09-05T08:00:00.000Z',
    endedAt: null,
    gpsDistanceKm: null,
    confirmedDistanceKm: null,
    confirmationReason: null,
  };
}

describe('employee execution core', () => {
  it('covers approach, multiple service trips, documentation, signature and home trip', () => {
    let state = createEmployeeExecutionState('assignment-1');
    state = reduceEmployeeExecution(state, { type: 'LOADED' });
    state = reduceEmployeeExecution(state, { type: 'TRAVEL_STARTED', leg: leg('approach', 'approach') });
    state = reduceEmployeeExecution(state, { type: 'TRAVEL_STOPPED', gpsDistanceKm: 4.2 });
    expect(state.phase).toBe('travel_confirmation');
    state = reduceEmployeeExecution(state, { type: 'TRAVEL_CONFIRMED' });
    state = reduceEmployeeExecution(state, { type: 'SERVICE_STARTED', at: '2026-09-05T08:30:00.000Z' });

    for (const [id, purpose, km] of [['doctor', 'doctor', 2.1], ['shopping', 'shopping', 3.4]] as const) {
      state = reduceEmployeeExecution(state, { type: 'SERVICE_TRAVEL_REQUESTED' });
      state = reduceEmployeeExecution(state, { type: 'TRAVEL_STARTED', leg: leg(id, purpose) });
      state = reduceEmployeeExecution(state, { type: 'TRAVEL_STOPPED', gpsDistanceKm: km });
      state = reduceEmployeeExecution(state, { type: 'TRAVEL_CONFIRMED' });
    }

    state = reduceEmployeeExecution(state, { type: 'SERVICE_ENDED', at: '2026-09-05T10:30:00.000Z' });
    state = reduceEmployeeExecution(state, { type: 'TASKS_COMPLETED' });
    state = reduceEmployeeExecution(state, { type: 'DOCUMENTATION_COMPLETED' });
    state = reduceEmployeeExecution(state, { type: 'SIGNATURE_COMPLETED' });
    state = reduceEmployeeExecution(state, { type: 'TRAVEL_STARTED', leg: leg('home', 'home') });
    state = reduceEmployeeExecution(state, { type: 'TRAVEL_STOPPED', gpsDistanceKm: 6.8 });
    state = reduceEmployeeExecution(state, { type: 'TRAVEL_CONFIRMED' });

    expect(state.phase).toBe('completed');
    expect(state.travelLegs).toHaveLength(4);
    expect(state.travelLegs.every((item) => item.confirmedDistanceKm !== null)).toBe(true);
  });

  it('requires a reason when confirmed car kilometres differ from GPS', () => {
    let state = reduceEmployeeExecution(createEmployeeExecutionState('a'), { type: 'LOADED' });
    state = reduceEmployeeExecution(state, { type: 'TRAVEL_STARTED', leg: leg('l1', 'approach') });
    state = reduceEmployeeExecution(state, { type: 'TRAVEL_STOPPED', gpsDistanceKm: 5 });
    expect(() => reduceEmployeeExecution(state, { type: 'TRAVEL_CONFIRMED', distanceKm: 7 }))
      .toThrow(InvalidEmployeeExecutionTransition);
  });
});
