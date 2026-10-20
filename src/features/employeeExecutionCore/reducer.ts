import type {
  EmployeeExecutionEvent,
  EmployeeExecutionState,
  EmployeeTravelLeg,
} from './model';

export class InvalidEmployeeExecutionTransition extends Error {}

function fail(state: EmployeeExecutionState, event: EmployeeExecutionEvent): never {
  throw new InvalidEmployeeExecutionTransition(
    `Ungültiger Einsatzübergang: ${state.phase} -> ${event.type}`,
  );
}

function activeLeg(state: EmployeeExecutionState): EmployeeTravelLeg {
  const leg = state.travelLegs.find((item) => item.id === state.activeTravelLegId);
  if (!leg) throw new InvalidEmployeeExecutionTransition('Aktives Fahrtsegment fehlt.');
  return leg;
}

function updateActiveLeg(
  state: EmployeeExecutionState,
  update: (leg: EmployeeTravelLeg) => EmployeeTravelLeg,
): EmployeeTravelLeg[] {
  const current = activeLeg(state);
  return state.travelLegs.map((leg) => (leg.id === current.id ? update(leg) : leg));
}

function recordingPhase(state: EmployeeExecutionState): EmployeeExecutionState['phase'] {
  if (state.phase === 'travel_selection') return 'travel_recording';
  if (state.phase === 'service_travel_selection') return 'service_travel_recording';
  if (state.phase === 'completion_destination') return 'completion_travel_recording';
  return fail(state, { type: 'TRAVEL_STARTED', leg: {} as EmployeeTravelLeg });
}

function confirmationPhase(state: EmployeeExecutionState): EmployeeExecutionState['phase'] {
  if (state.phase === 'travel_recording') return 'travel_confirmation';
  if (state.phase === 'service_travel_recording') return 'service_travel_confirmation';
  if (state.phase === 'completion_travel_recording') return 'completion_travel_confirmation';
  return fail(state, { type: 'TRAVEL_STOPPED', gpsDistanceKm: 0 });
}

export function reduceEmployeeExecution(
  state: EmployeeExecutionState,
  event: EmployeeExecutionEvent,
): EmployeeExecutionState {
  if (event.type === 'LOADED' && state.phase === 'loading') {
    return { ...state, phase: 'travel_selection' };
  }
  if (event.type === 'TRAVEL_STARTED') {
    if (state.activeTravelLegId) return fail(state, event);
    return {
      ...state,
      phase: recordingPhase(state),
      activeTravelLegId: event.leg.id,
      travelLegs: [...state.travelLegs, event.leg],
    };
  }
  if (event.type === 'TRAVEL_STOPPED') {
    const phase = confirmationPhase(state);
    return {
      ...state,
      phase,
      travelLegs: updateActiveLeg(state, (leg) => ({
        ...leg,
        endedAt: new Date().toISOString(),
        gpsDistanceKm: Math.max(0, event.gpsDistanceKm),
      })),
    };
  }
  if (event.type === 'TRAVEL_CONFIRMED') {
    const leg = activeLeg(state);
    const distance = event.distanceKm ?? leg.gpsDistanceKm ?? 0;
    if (!Number.isFinite(distance) || distance < 0) return fail(state, event);
    const corrected = Math.abs(distance - (leg.gpsDistanceKm ?? 0)) >= 0.005;
    if (leg.mode === 'car' && corrected && (event.reason?.trim().length ?? 0) < 3) {
      return fail(state, event);
    }
    const nextPhase =
      state.phase === 'travel_confirmation'
        ? 'arrived'
        : state.phase === 'service_travel_confirmation'
          ? 'service_active'
          : state.phase === 'completion_travel_confirmation'
            ? 'completed'
            : null;
    if (!nextPhase) return fail(state, event);
    return {
      ...state,
      phase: nextPhase,
      activeTravelLegId: null,
      travelLegs: updateActiveLeg(state, (item) => ({
        ...item,
        confirmedDistanceKm: item.mode === 'car' ? distance : null,
        confirmationReason: corrected ? event.reason?.trim() || null : null,
      })),
    };
  }
  if (event.type === 'ARRIVED' && state.phase === 'arrived') return state;
  if (event.type === 'SERVICE_STARTED' && state.phase === 'arrived') {
    return { ...state, phase: 'service_active', serviceStartedAt: event.at };
  }
  if (event.type === 'SERVICE_PAUSED' && state.phase === 'service_active') {
    return { ...state, phase: 'service_paused' };
  }
  if (event.type === 'SERVICE_RESUMED' && state.phase === 'service_paused') {
    return { ...state, phase: 'service_active' };
  }
  if (event.type === 'SERVICE_TRAVEL_REQUESTED' && state.phase === 'service_active') {
    return { ...state, phase: 'service_travel_selection' };
  }
  if (event.type === 'SERVICE_ENDED' && state.phase === 'service_active') {
    return { ...state, phase: 'documentation', serviceEndedAt: event.at };
  }
  if (event.type === 'TASKS_COMPLETED' && state.phase === 'documentation') {
    return { ...state, tasksComplete: true };
  }
  if (event.type === 'DOCUMENTATION_COMPLETED' && state.phase === 'documentation') {
    return { ...state, documentationComplete: true, phase: 'signature' };
  }
  if (event.type === 'SIGNATURE_COMPLETED' && state.phase === 'signature') {
    if (!state.documentationComplete) return fail(state, event);
    return { ...state, signatureComplete: true, phase: 'completion_destination' };
  }
  if (
    event.type === 'COMPLETION_DESTINATION_SELECTED' &&
    state.phase === 'completion_destination'
  ) {
    return state;
  }
  if (event.type === 'COMPLETED' && state.phase === 'completion_destination') {
    return { ...state, phase: 'completed' };
  }
  return fail(state, event);
}
