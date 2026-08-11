import type {
  TravelCompensationPolicy,
  TravelPolicyPreset,
  TravelRouteType,
} from '@/types/modules/travelCompensation';

export const ALL_TRAVEL_ROUTE_TYPES: TravelRouteType[] = [
  'home_to_office',
  'office_to_home',
  'home_to_client',
  'client_to_home',
  'office_to_client',
  'client_to_office',
  'client_to_client',
  'with_client',
  'other_business',
  'private_non_business',
];

const ALL_BUSINESS: TravelRouteType[] = ALL_TRAVEL_ROUTE_TYPES.filter(
  (routeType) => routeType !== 'private_non_business',
);

const PRESET_ROUTES: Record<Exclude<TravelPolicyPreset, 'custom'>, TravelRouteType[]> = {
  all_business: ALL_BUSINESS,
  office_roundtrip: [
    'office_to_client',
    'client_to_client',
    'with_client',
    'client_to_office',
    'other_business',
  ],
  home_roundtrip: [
    'home_to_client',
    'client_to_client',
    'with_client',
    'client_to_home',
    'other_business',
  ],
  between_clients_only: ['client_to_client'],
  with_client_only: ['with_client'],
  to_and_with_clients: [
    'home_to_client',
    'office_to_client',
    'client_to_client',
    'with_client',
  ],
};

function uniqueRoutes(value: unknown, fallback: TravelRouteType[]): TravelRouteType[] {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((item): item is TravelRouteType =>
    typeof item === 'string' && ALL_TRAVEL_ROUTE_TYPES.includes(item as TravelRouteType),
  ))];
}

export function createTravelPolicyFromPreset(preset: TravelPolicyPreset): TravelCompensationPolicy {
  const routes = preset === 'custom' ? [] : PRESET_ROUTES[preset];
  return {
    preset,
    logbookRouteTypes: [...routes],
    payrollRouteTypes: [...routes],
    workTimeRouteTypes: [...routes],
    clientBillingRouteTypes: routes.filter((routeType) => routeType === 'with_client'),
  };
}

/**
 * Sicherer Ersteinrichtungsstandard: dienstliche Fahrten dokumentieren, aber
 * erst nach ausdrücklicher Vertrags-/Mandantenentscheidung vergüten.
 */
export const DEFAULT_TRAVEL_COMPENSATION_POLICY: TravelCompensationPolicy = {
  preset: 'custom',
  logbookRouteTypes: [...ALL_BUSINESS],
  payrollRouteTypes: [],
  workTimeRouteTypes: [],
  clientBillingRouteTypes: [],
};

export function normalizeTravelCompensationPolicy(
  value: unknown,
  fallback: TravelCompensationPolicy = DEFAULT_TRAVEL_COMPENSATION_POLICY,
): TravelCompensationPolicy {
  if (!value || typeof value !== 'object') return { ...fallback };
  const raw = value as Partial<TravelCompensationPolicy>;
  const preset = (
    ['all_business', 'office_roundtrip', 'home_roundtrip', 'between_clients_only', 'with_client_only', 'to_and_with_clients', 'custom'] as const
  ).includes(raw.preset as TravelPolicyPreset)
    ? raw.preset as TravelPolicyPreset
    : fallback.preset;
  return {
    preset,
    logbookRouteTypes: uniqueRoutes(raw.logbookRouteTypes, fallback.logbookRouteTypes),
    payrollRouteTypes: uniqueRoutes(raw.payrollRouteTypes, fallback.payrollRouteTypes),
    workTimeRouteTypes: uniqueRoutes(raw.workTimeRouteTypes, fallback.workTimeRouteTypes),
    clientBillingRouteTypes: uniqueRoutes(raw.clientBillingRouteTypes, fallback.clientBillingRouteTypes),
  };
}

export function evaluateTravelCompensation(input: {
  routeType: TravelRouteType;
  distanceKm: number;
  mileageRateCents: number;
  policy: TravelCompensationPolicy;
}) {
  const distanceKm = Number.isFinite(input.distanceKm) ? Math.max(0, input.distanceKm) : 0;
  const rate = Number.isFinite(input.mileageRateCents) ? Math.max(0, Math.round(input.mileageRateCents)) : 0;
  const payrollEligible = input.policy.payrollRouteTypes.includes(input.routeType);
  return {
    logbookEligible: input.policy.logbookRouteTypes.includes(input.routeType),
    payrollEligible,
    workTimeEligible: input.policy.workTimeRouteTypes.includes(input.routeType),
    clientBillingEligible: input.policy.clientBillingRouteTypes.includes(input.routeType),
    mileageAmountCents: payrollEligible ? Math.round(distanceKm * rate) : 0,
  };
}

export function inferTravelRouteType(purpose: string | null | undefined): TravelRouteType {
  const normalized = (purpose ?? '').trim().toLowerCase();
  if (normalized.includes('mit klient')) return 'with_client';
  if (normalized.includes('zwischen') && normalized.includes('klient')) return 'client_to_client';
  if (normalized === 'einsatz' || normalized.includes('anfahrt')) return 'office_to_client';
  if (normalized === 'material' || normalized === 'dienstfahrt') return 'other_business';
  return 'other_business';
}
