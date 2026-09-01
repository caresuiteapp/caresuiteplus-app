import type { TravelRouteType } from './travelCompensation';

export type LogbookTripStatus = 'recording' | 'confirmation_required' | 'review_required' | 'completed' | 'corrected' | 'confirmed' | 'cancelled';
export type LogbookDistanceSource = 'gps' | 'google_fallback' | 'manual' | 'office_corrected';
export type LogbookVehicleOwnership = 'private' | 'company';

export type LogbookVehicle = {
  id: string; tenantId: string; employeeId: string; ownership: LogbookVehicleOwnership;
  plate: string; make: string | null; model: string | null; active: boolean;
};

export type LogbookProfile = {
  tenantId: string; employeeId: string; defaultVehicleId: string | null;
  mileageRateCents: number; gpsConsent: boolean;
  licenseFrontPath: string | null; licenseBackPath: string | null;
};

export type LogbookTrip = {
  id: string; tenantId: string; employeeId: string; assignmentId: string | null;
  clientId: string | null; vehicleId: string | null; routeType: TravelRouteType;
  purpose: string; manualReason: string | null; status: LogbookTripStatus;
  startedAt: string; endedAt: string | null; startAddress: string | null;
  endAddress: string | null; distanceGpsKm: number; distanceFinalKm: number;
  durationSeconds: number; countsAsWorkTime: boolean; worktimeDeductionMinutes: number;
  mileageRateCents: number; mileageAmountCents: number; gpsCaptured: boolean;
  distanceSource: LogbookDistanceSource;
  googleRouteDistanceKm: number | null;
  googleRouteDurationMinutes: number | null;
  routeQualityStatus: 'measured' | 'estimated_due_to_gps_gap' | 'manual' | 'corrected';
  correctedAt: string | null; notes: string | null;
};

export type LogbookPoint = {
  latitude: number; longitude: number; accuracy?: number | null; altitude?: number | null;
  speed?: number | null; heading?: number | null; recordedAt: string;
};

export type LogbookSegment = {
  id: string; tripId: string; sequenceNo: number; assignmentId: string | null;
  clientId: string | null; stopKind: 'client' | 'doctor' | 'pharmacy' | 'shopping' | 'office' | 'home' | 'other';
  label: string; startAddress: string | null; endAddress: string | null;
  startedAt: string | null; endedAt: string | null; distanceKm: number;
};

export type LogbookReceipt = {
  id: string; tripId: string | null; category: 'parking' | 'toll' | 'fuel' | 'other';
  amountCents: number; fileName: string; storagePath: string; expenseDate: string;
};

export type LogbookDailyConfirmation = {
  id: string; workDate: string; tripCount: number; distanceKm: number;
  signatureData: string; signerName: string; confirmedAt: string;
};

export type EmployeeLogbookBundle = {
  profile: LogbookProfile; vehicles: LogbookVehicle[]; trips: LogbookTrip[];
  confirmations: LogbookDailyConfirmation[]; segments: LogbookSegment[]; receipts: LogbookReceipt[];
};

export type StartLogbookTripInput = {
  tenantId: string; employeeId: string; vehicleId: string | null; routeType: TravelRouteType;
  assignmentId?: string | null; clientId?: string | null; purpose: string;
  manualReason?: string | null; startAddress?: string | null;
};

export type CreateManualLogbookTripInput = {
  tenantId: string; employeeId: string; vehicleId: string | null;
  assignmentId?: string | null; clientId?: string | null;
  routeType: TravelRouteType; purpose: string; manualReason: string;
  startedAt: string; endedAt: string; startAddress: string; endAddress: string;
  distanceKm: number; notes?: string | null;
};

export type CorrectLogbookTripInput = {
  trip: LogbookTrip; vehicleId: string; routeType: TravelRouteType; purpose: string;
  assignmentId?: string | null; clientId?: string | null; startedAt: string; endedAt: string;
  startAddress: string; endAddress: string; distanceKm: number; reason: string;
};
