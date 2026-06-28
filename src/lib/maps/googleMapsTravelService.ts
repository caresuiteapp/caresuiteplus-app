import { estimateHeuristicTravelMinutes } from '@/lib/assist/routePlanningConflictService';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { TRAVEL_TIME_DISCLAIMER } from '@/types/modules/routePlanning';
import type {
  EmployeeTransportMode,
  TravelTimeResult,
} from '@/types/modules/employeeMobility';
import { mapTransportModeToGoogle } from './transportModeMapping';

type CacheEntry = {
  result: TravelTimeResult;
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60_000;
const travelCache = new Map<string, CacheEntry>();

export function resetTravelTimeCache(): void {
  travelCache.clear();
}

function cacheKey(origin: string, destination: string, mode: EmployeeTransportMode): string {
  return `${origin.trim().toLowerCase()}|${destination.trim().toLowerCase()}|${mode}`;
}

function readCache(key: string): TravelTimeResult | null {
  const entry = travelCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    travelCache.delete(key);
    return null;
  }
  return entry.result;
}

function writeCache(key: string, result: TravelTimeResult): void {
  travelCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

type ComputeTravelTimeResponse = {
  ok: true;
  durationMinutes: number | null;
  distanceMeters: number | null;
  googleMode: string | null;
  note: string | null;
  source: 'google' | 'heuristic' | 'unavailable';
};

function buildHeuristicResult(input: {
  origin: string;
  destination: string;
  transportMode: EmployeeTransportMode;
  note?: string | null;
}): TravelTimeResult {
  const mapped = mapTransportModeToGoogle(input.transportMode);
  const minutes = estimateHeuristicTravelMinutes(input.origin, input.destination);
  return {
    durationMinutes: minutes,
    distanceMeters: null,
    source: 'heuristic',
    googleMode: mapped.googleMode,
    transportMode: input.transportMode,
    note: input.note ?? mapped.note ?? null,
    disclaimer: TRAVEL_TIME_DISCLAIMER,
  };
}

export async function fetchTravelTime(input: {
  tenantId: string;
  origin: string;
  destination: string;
  transportMode: EmployeeTransportMode;
  allowHeuristicFallback?: boolean;
}): Promise<TravelTimeResult> {
  const origin = input.origin.trim();
  const destination = input.destination.trim();
  const transportMode = input.transportMode;

  if (!origin || !destination || origin === '—' || destination === '—') {
    return {
      durationMinutes: null,
      distanceMeters: null,
      source: 'unavailable',
      googleMode: null,
      transportMode,
      note: 'Start- oder Zieladresse fehlt.',
      disclaimer: null,
    };
  }

  const key = cacheKey(origin, destination, transportMode);
  const cached = readCache(key);
  if (cached) return cached;

  const edge = await invokeEdgeFunction<ComputeTravelTimeResponse>('compute-travel-time', {
    tenantId: input.tenantId,
    origin,
    destination,
    transportMode,
  });

  if (edge.ok && edge.data?.durationMinutes != null) {
    const mapped = mapTransportModeToGoogle(
      transportMode,
      edge.data.distanceMeters != null ? edge.data.distanceMeters / 1000 : null,
    );
    const result: TravelTimeResult = {
      durationMinutes: edge.data.durationMinutes,
      distanceMeters: edge.data.distanceMeters,
      source: edge.data.source === 'google' ? 'google' : 'heuristic',
      googleMode: (edge.data.googleMode as TravelTimeResult['googleMode']) ?? mapped.googleMode,
      transportMode,
      note: edge.data.note ?? mapped.note ?? null,
      disclaimer: edge.data.source === 'google' ? null : TRAVEL_TIME_DISCLAIMER,
    };
    writeCache(key, result);
    return result;
  }

  if (input.allowHeuristicFallback !== false) {
    const fallback = buildHeuristicResult({ origin, destination, transportMode });
    writeCache(key, fallback);
    return fallback;
  }

  const unavailable: TravelTimeResult = {
    durationMinutes: null,
    distanceMeters: null,
    source: 'unavailable',
    googleMode: mapTransportModeToGoogle(transportMode).googleMode,
    transportMode,
    note: edge.ok ? null : edge.error,
    disclaimer: null,
  };
  return unavailable;
}

export async function fetchAssignmentTravelTime(input: {
  tenantId: string;
  assignmentAddress: string;
  originAddress: string | null;
  transportMode: EmployeeTransportMode;
}): Promise<TravelTimeResult> {
  if (!input.originAddress?.trim()) {
    return {
      durationMinutes: null,
      distanceMeters: null,
      source: 'unavailable',
      googleMode: null,
      transportMode: input.transportMode,
      note: 'Kein Routenstart konfiguriert.',
      disclaimer: null,
    };
  }

  return fetchTravelTime({
    tenantId: input.tenantId,
    origin: input.originAddress,
    destination: input.assignmentAddress,
    transportMode: input.transportMode,
  });
}
