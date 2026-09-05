import type { TravelRouteType } from '@/types/modules/travelCompensation';
import { lastItem } from '@/lib/runtime/runtimeSafeCollections';

export type AssistGpsRecoveryPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
};

export type AssistGpsRecoveryTimeEvent = {
  eventType: string;
  occurredAt: string;
};

export type AssistGpsRecoveryLegWindow = {
  id: string;
  kind: 'approach' | 'service_drive' | 'unclassified_drive';
  routeType: TravelRouteType;
  purposePrefix: string;
  startedAt: string;
  endedAt: string;
  points: AssistGpsRecoveryPoint[];
};

const MAX_POINT_GAP_SECONDS = 300;
const MAX_STATIONARY_BRIDGE_SECONDS = 180;
const MIN_CAR_SPEED_KMH = 8;
const MAX_CAR_SPEED_KMH = 180;
const MIN_LEG_DISTANCE_METERS = 150;

function time(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function haversineMeters(left: AssistGpsRecoveryPoint, right: AssistGpsRecoveryPoint): number {
  const radius = 6_371_000;
  const dLat = ((right.latitude - left.latitude) * Math.PI) / 180;
  const dLon = ((right.longitude - left.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((left.latitude * Math.PI) / 180) *
      Math.cos((right.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

function eventAt(events: AssistGpsRecoveryTimeEvent[], type: string, afterMs = 0): string | null {
  return events
    .filter((event) => event.eventType === type && time(event.occurredAt) >= afterMs)
    .sort((left, right) => time(left.occurredAt) - time(right.occurredAt))[0]?.occurredAt ?? null;
}

function firstEventAt(events: AssistGpsRecoveryTimeEvent[], types: string[], afterMs = 0): string | null {
  return events
    .filter((event) => types.includes(event.eventType) && time(event.occurredAt) >= afterMs)
    .sort((left, right) => time(left.occurredAt) - time(right.occurredAt))[0]?.occurredAt ?? null;
}

function pointsInWindow(
  points: AssistGpsRecoveryPoint[],
  startedAt: string,
  endedAt: string,
): AssistGpsRecoveryPoint[] {
  const startMs = time(startedAt);
  const endMs = time(endedAt);
  return points.filter((point) => {
    const pointMs = time(point.recordedAt);
    return pointMs >= startMs && pointMs <= endMs;
  });
}

function movementEdges(points: AssistGpsRecoveryPoint[]) {
  return points.slice(1).map((current, index) => {
    const previous = points[index];
    const elapsedSeconds = (time(current.recordedAt) - time(previous.recordedAt)) / 1_000;
    const distanceMeters = haversineMeters(previous, current);
    const speedKmh = elapsedSeconds > 0 ? (distanceMeters / elapsedSeconds) * 3.6 : 0;
    return {
      startIndex: index,
      endIndex: index + 1,
      startedAtMs: time(previous.recordedAt),
      endedAtMs: time(current.recordedAt),
      elapsedSeconds,
      distanceMeters,
      moving:
        elapsedSeconds > 0 &&
        elapsedSeconds <= MAX_POINT_GAP_SECONDS &&
        distanceMeters >= 4 &&
        speedKmh >= MIN_CAR_SPEED_KMH &&
        speedKmh <= MAX_CAR_SPEED_KMH,
    };
  });
}

/**
 * Finds car-like movement windows without turning stationary GPS jitter into a
 * trip. A short traffic-light or parking interruption stays in the same leg;
 * a longer stop creates a new leg.
 */
export function detectCarMovementWindows(
  points: AssistGpsRecoveryPoint[],
): AssistGpsRecoveryPoint[][] {
  const sorted = [...points].sort((left, right) => time(left.recordedAt) - time(right.recordedAt));
  const moving = movementEdges(sorted).filter((edge) => edge.moving);
  if (!moving.length) return [];

  const groups: typeof moving[] = [];
  let group: typeof moving = [];
  for (const edge of moving) {
    const previous = lastItem(group);
    if (
      previous &&
      (edge.startedAtMs - previous.endedAtMs) / 1_000 > MAX_STATIONARY_BRIDGE_SECONDS
    ) {
      groups.push(group);
      group = [];
    }
    group.push(edge);
  }
  if (group.length) groups.push(group);

  return groups.flatMap((edges) => {
    const distanceMeters = edges.reduce((sum, edge) => sum + edge.distanceMeters, 0);
    if (distanceMeters < MIN_LEG_DISTANCE_METERS) return [];
    const startIndex = edges[0].startIndex;
    const endIndex = lastItem(edges)!.endIndex;
    const leg = sorted.slice(startIndex, endIndex + 1);
    return leg.length >= 2 ? [leg] : [];
  });
}

/**
 * Preserves distance across a GPS blackout as its own auditable window. It is
 * deliberately not merged into either neighbouring movement leg: the street
 * route can be calculated, but its business purpose still needs review.
 */
function detectGpsGapWindows(points: AssistGpsRecoveryPoint[]): AssistGpsRecoveryPoint[][] {
  const sorted = [...points].sort((left, right) => time(left.recordedAt) - time(right.recordedAt));
  return sorted.slice(1).flatMap((current, index) => {
    const previous = sorted[index];
    const elapsedSeconds = (time(current.recordedAt) - time(previous.recordedAt)) / 1_000;
    const distanceMeters = haversineMeters(previous, current);
    if (elapsedSeconds <= MAX_POINT_GAP_SECONDS || distanceMeters < MIN_LEG_DISTANCE_METERS) return [];
    return [[previous, current]];
  });
}

/**
 * Splits one Assist tracking session into actual road legs. Canonical workflow
 * events own the approach boundaries; car-like movement during service is
 * emitted as separate business legs instead of treating the whole visit as one
 * drive.
 */
export function buildAssistGpsRecoveryLegWindows(input: {
  sessionId: string;
  points: AssistGpsRecoveryPoint[];
  events: AssistGpsRecoveryTimeEvent[];
  fallbackEndedAt: string | null;
}): AssistGpsRecoveryLegWindow[] {
  const points = [...input.points].sort((left, right) => time(left.recordedAt) - time(right.recordedAt));
  if (points.length < 2) return [];
  const events = [...input.events].sort((left, right) => time(left.occurredAt) - time(right.occurredAt));
  const result: AssistGpsRecoveryLegWindow[] = [];

  const driveStart = eventAt(events, 'drive_start');
  const driveEnd = driveStart
    ? firstEventAt(events, ['drive_end', 'arrive'], time(driveStart))
    : null;
  if (driveStart && driveEnd) {
    const approachPoints = pointsInWindow(points, driveStart, driveEnd);
    if (approachPoints.length >= 2) {
      result.push({
        id: `approach-${time(driveStart)}`,
        kind: 'approach',
        routeType: 'home_to_client',
        purposePrefix: 'Automatisch rekonstruierte Anfahrt',
        startedAt: approachPoints[0].recordedAt,
        endedAt: lastItem(approachPoints)!.recordedAt,
        points: approachPoints,
      });
    }
  }

  const serviceStart = eventAt(events, 'service_start') ?? driveEnd ?? points[0].recordedAt;
  const serviceEnd = eventAt(events, 'service_end', time(serviceStart)) ?? input.fallbackEndedAt ?? lastItem(points)!.recordedAt;
  const servicePoints = pointsInWindow(points, serviceStart, serviceEnd);
  const approachStartMs = driveStart ? time(driveStart) : -1;
  const approachEndMs = driveEnd ? time(driveEnd) : -1;
  detectCarMovementWindows(servicePoints).forEach((legPoints, index) => {
    const startedAtMs = time(legPoints[0].recordedAt);
    const endedAtMs = time(lastItem(legPoints)!.recordedAt);
    if (approachStartMs >= 0 && startedAtMs <= approachEndMs && endedAtMs >= approachStartMs) return;
    result.push({
      id: `service-${startedAtMs}-${index + 1}`,
      kind: serviceStart ? 'service_drive' : 'unclassified_drive',
      routeType: 'other_business',
      purposePrefix: 'Automatisch erkannte Dienstfahrt während des Einsatzes',
      startedAt: legPoints[0].recordedAt,
      endedAt: lastItem(legPoints)!.recordedAt,
      points: legPoints,
    });
  });
  detectGpsGapWindows(servicePoints).forEach((legPoints, index) => {
    const startedAtMs = time(legPoints[0].recordedAt);
    const endedAtMs = time(lastItem(legPoints)!.recordedAt);
    if (approachStartMs >= 0 && startedAtMs <= approachEndMs && endedAtMs >= approachStartMs) return;
    result.push({
      id: `gps-gap-${startedAtMs}-${index + 1}`,
      kind: 'unclassified_drive',
      routeType: 'other_business',
      purposePrefix: 'GPS-Lücke mit Ortswechsel – Zuordnung erforderlich',
      startedAt: legPoints[0].recordedAt,
      endedAt: lastItem(legPoints)!.recordedAt,
      points: legPoints,
    });
  });

  const departAt = serviceEnd
    ? eventAt(events, 'depart', time(serviceEnd)) ?? serviceEnd
    : eventAt(events, 'depart');
  const postServiceEnd = input.fallbackEndedAt ?? lastItem(points)!.recordedAt;
  if (departAt && time(postServiceEnd) > time(departAt)) {
    const postServicePoints = pointsInWindow(points, departAt, postServiceEnd);
    detectCarMovementWindows(postServicePoints).forEach((legPoints, index) => {
      result.push({
        id: `departure-${time(legPoints[0].recordedAt)}-${index + 1}`,
        kind: 'unclassified_drive',
        routeType: 'other_business',
        purposePrefix: 'Rück- oder Weiterfahrt nach dem Einsatz – Zielzuordnung erforderlich',
        startedAt: legPoints[0].recordedAt,
        endedAt: lastItem(legPoints)!.recordedAt,
        points: legPoints,
      });
    });
    detectGpsGapWindows(postServicePoints).forEach((legPoints, index) => {
      result.push({
        id: `departure-gap-${time(legPoints[0].recordedAt)}-${index + 1}`,
        kind: 'unclassified_drive',
        routeType: 'other_business',
        purposePrefix: 'GPS-Lücke auf Rück- oder Weiterfahrt – Zielzuordnung erforderlich',
        startedAt: legPoints[0].recordedAt,
        endedAt: lastItem(legPoints)!.recordedAt,
        points: legPoints,
      });
    });
  }

  if (!result.length) {
    detectCarMovementWindows(points).forEach((legPoints, index) => {
      result.push({
        id: `unclassified-${time(legPoints[0].recordedAt)}-${index + 1}`,
        kind: 'unclassified_drive',
        routeType: 'other_business',
        purposePrefix: 'Automatisch erkannte Dienstfahrt',
        startedAt: legPoints[0].recordedAt,
        endedAt: lastItem(legPoints)!.recordedAt,
        points: legPoints,
      });
    });
    detectGpsGapWindows(points).forEach((legPoints, index) => {
      result.push({
        id: `gps-gap-${time(legPoints[0].recordedAt)}-${index + 1}`,
        kind: 'unclassified_drive',
        routeType: 'other_business',
        purposePrefix: 'GPS-Lücke mit Ortswechsel – Zuordnung erforderlich',
        startedAt: legPoints[0].recordedAt,
        endedAt: lastItem(legPoints)!.recordedAt,
        points: legPoints,
      });
    });
  }

  return result.sort((left, right) => time(left.startedAt) - time(right.startedAt));
}

export function isAssistTrackingSessionEffectivelyActive(input: {
  storedActive: boolean;
  sessionUpdatedAt: string | null;
  lastPointAt: string | null;
  visitClosed: boolean;
  nowMs?: number;
}): boolean {
  if (!input.storedActive || input.visitClosed) return false;
  const nowMs = input.nowMs ?? Date.now();
  const heartbeatFresh = input.sessionUpdatedAt
    ? nowMs - time(input.sessionUpdatedAt) <= 10 * 60 * 1_000
    : false;
  const pointFresh = input.lastPointAt
    ? nowMs - time(input.lastPointAt) <= 15 * 60 * 1_000
    : false;
  return heartbeatFresh && pointFresh;
}
