/** Employee mobility preferences for Google Maps travel time. */

export type EmployeeTransportMode = 'car' | 'transit' | 'bicycle' | 'escooter' | 'walking';

export type EmployeeRouteStartType = 'home' | 'office' | 'last_assignment' | 'custom';

export type EmployeeRouteEndType = 'home' | 'office' | 'custom';

export const ALL_EMPLOYEE_TRANSPORT_MODES: EmployeeTransportMode[] = [
  'car',
  'transit',
  'bicycle',
  'escooter',
  'walking',
];

/** Ensures a non-empty, de-duplicated list of valid transport modes. */
export function normalizeTransportModes(
  modes: EmployeeTransportMode[] | EmployeeTransportMode | null | undefined,
): EmployeeTransportMode[] {
  const raw = Array.isArray(modes) ? modes : modes ? [modes] : [];
  const valid = raw.filter((mode): mode is EmployeeTransportMode =>
    ALL_EMPLOYEE_TRANSPORT_MODES.includes(mode),
  );
  const unique = [...new Set(valid)];
  return unique.length > 0 ? unique : ['car'];
}

export type EmployeeMobilitySettings = {
  id?: string;
  tenantId: string;
  employeeId: string;
  transportModes: EmployeeTransportMode[];
  routeStartType: EmployeeRouteStartType;
  routeEndType: EmployeeRouteEndType;
  routeStartAddress: string | null;
  routeEndAddress: string | null;
  updatedAt?: string;
};

export const DEFAULT_EMPLOYEE_MOBILITY_SETTINGS: Omit<
  EmployeeMobilitySettings,
  'tenantId' | 'employeeId'
> = {
  transportModes: ['car'],
  routeStartType: 'home',
  routeEndType: 'home',
  routeStartAddress: null,
  routeEndAddress: null,
};

export const EMPLOYEE_TRANSPORT_MODE_LABELS: Record<EmployeeTransportMode, string> = {
  car: 'Auto',
  transit: 'ÖV / Öffentlicher Verkehr',
  bicycle: 'Fahrrad',
  escooter: 'E-Scooter',
  walking: 'Zu Fuß',
};

export const EMPLOYEE_TRANSPORT_MODE_ICONS: Record<EmployeeTransportMode, string> = {
  car: '🚗',
  transit: '🚇',
  bicycle: '🚲',
  escooter: '🛴',
  walking: '🚶',
};

export const EMPLOYEE_ROUTE_START_TYPE_LABELS: Record<EmployeeRouteStartType, string> = {
  home: 'Zuhause',
  office: 'Büro',
  last_assignment: 'Letzter Einsatz',
  custom: 'Eigene Adresse',
};

export const EMPLOYEE_ROUTE_END_TYPE_LABELS: Record<EmployeeRouteEndType, string> = {
  home: 'Zuhause',
  office: 'Büro',
  custom: 'Eigene Adresse',
};

export type GoogleTravelMode = 'driving' | 'transit' | 'bicycling' | 'walking';

export type TravelTimeResult = {
  durationMinutes: number | null;
  distanceMeters: number | null;
  source: 'google' | 'heuristic' | 'unavailable';
  googleMode: GoogleTravelMode | null;
  transportMode: EmployeeTransportMode;
  note: string | null;
  disclaimer: string | null;
};
