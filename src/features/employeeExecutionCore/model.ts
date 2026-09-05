export type EmployeeTravelMode = 'car' | 'public_transport' | 'bicycle' | 'escooter' | 'walking';

export type EmployeeTravelPurpose =
  | 'approach'
  | 'doctor'
  | 'pharmacy'
  | 'shopping'
  | 'client_errand'
  | 'next_assignment'
  | 'office'
  | 'home'
  | 'other';

export type EmployeeTravelLeg = {
  id: string;
  mode: EmployeeTravelMode;
  purpose: EmployeeTravelPurpose;
  startedAt: string;
  endedAt: string | null;
  gpsDistanceKm: number | null;
  confirmedDistanceKm: number | null;
  confirmationReason: string | null;
};

export type EmployeeExecutionPhase =
  | 'loading'
  | 'travel_selection'
  | 'travel_recording'
  | 'travel_confirmation'
  | 'arrived'
  | 'service_active'
  | 'service_paused'
  | 'service_travel_selection'
  | 'service_travel_recording'
  | 'service_travel_confirmation'
  | 'documentation'
  | 'signature'
  | 'completion_destination'
  | 'completion_travel_recording'
  | 'completion_travel_confirmation'
  | 'completed';

export type EmployeeExecutionState = {
  assignmentId: string;
  phase: EmployeeExecutionPhase;
  travelLegs: EmployeeTravelLeg[];
  activeTravelLegId: string | null;
  serviceStartedAt: string | null;
  serviceEndedAt: string | null;
  tasksComplete: boolean;
  documentationComplete: boolean;
  signatureComplete: boolean;
};

export type EmployeeExecutionEvent =
  | { type: 'LOADED' }
  | { type: 'TRAVEL_STARTED'; leg: EmployeeTravelLeg }
  | { type: 'TRAVEL_STOPPED'; gpsDistanceKm: number }
  | { type: 'TRAVEL_CONFIRMED'; distanceKm?: number; reason?: string | null }
  | { type: 'ARRIVED' }
  | { type: 'SERVICE_STARTED'; at: string }
  | { type: 'SERVICE_PAUSED' }
  | { type: 'SERVICE_RESUMED' }
  | { type: 'SERVICE_TRAVEL_REQUESTED' }
  | { type: 'SERVICE_ENDED'; at: string }
  | { type: 'TASKS_COMPLETED' }
  | { type: 'DOCUMENTATION_COMPLETED' }
  | { type: 'SIGNATURE_COMPLETED' }
  | { type: 'COMPLETION_DESTINATION_SELECTED' }
  | { type: 'COMPLETED' };

export function createEmployeeExecutionState(assignmentId: string): EmployeeExecutionState {
  return {
    assignmentId,
    phase: 'loading',
    travelLegs: [],
    activeTravelLegId: null,
    serviceStartedAt: null,
    serviceEndedAt: null,
    tasksComplete: false,
    documentationComplete: false,
    signatureComplete: false,
  };
}
