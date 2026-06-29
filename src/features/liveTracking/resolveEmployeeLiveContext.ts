/**
 * LT.GMAPS.2 — Canonical employee-portal live context before consent/tracking/location writes.
 */
import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';
import {
  fetchActiveTrackingSession,
  fetchLatestLocationPointForVisit,
  fetchTimeEventsForVisit,
} from '@/lib/assist/assistTrackingPersistenceService';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { formatAddressFromSnapshotOrParts } from '@/lib/formatAddress';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { getServiceMode } from '@/lib/services/mode';
import { isUuid } from '@/lib/validation/uuid';
import {
  createLiveTrackingError,
  liveTrackingErrorFromSupabase,
  liveTrackingErrorToServiceResult,
  logLiveTrackingError,
  type LiveTrackingErrorCode,
} from './liveTrackingErrors';
import { resolveLiveAssignment, type LiveAssignmentResolution } from './resolveLiveAssignment';

export type EmployeeLiveContext = {
  tenantId: string;
  employeeId: string;
  clientId: string;
  assignmentId: string;
  assistVisitId: string;
  serviceTitle: string;
  clientName: string;
  clientAddress: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  assignmentStatus: AssignmentStatus;
  consentStatus: {
    granted: boolean;
    grantedAt: string | null;
    explainedAt: string | null;
  };
  trackingSessionId: string | null;
  trackingSessionActive: boolean;
  lastLocationAt: string | null;
  lastLocationAccuracyMeters: number | null;
  locationPointCount: number;
  canStartTracking: boolean;
  reasonCode: LiveTrackingErrorCode | null;
  resolution: LiveAssignmentResolution;
  detail: EmployeePortalAssignmentDetail | null;
  timeEventsLoaded: boolean;
};

export type ResolveEmployeeLiveContextInput = {
  tenantId: string | null | undefined;
  employeeId: string | null | undefined;
  routeParamId: string | null | undefined;
  portalAccountId?: string | null;
  /** Pre-resolved in-memory consent (employee portal session store). */
  localConsent?: {
    granted: boolean;
    grantedAt: string | null;
    explainedAt: string | null;
  };
};

const PORTAL_ASSIGNMENT_SELECT = `
  id, tenant_id, client_id, employee_id,
  planned_start_at, planned_end_at, actual_start_at, actual_end_at,
  on_the_way_at, arrived_at, finished_at,
  status, title, address_snapshot, client_visible_notes,
  clients(first_name, last_name, street, house_number, postal_code, city),
  employees(first_name, last_name)
`;

type PortalAssignmentRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  employee_id: string | null;
  planned_start_at: string;
  planned_end_at: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  on_the_way_at?: string | null;
  arrived_at?: string | null;
  finished_at?: string | null;
  status: string;
  title: string | null;
  address_snapshot: string | null;
  client_visible_notes?: string | null;
  clients?: {
    first_name: string | null;
    last_name: string | null;
    street?: string | null;
    house_number?: string | null;
    postal_code?: string | null;
    city?: string | null;
  } | null;
};

function personName(row?: { first_name: string | null; last_name: string | null } | null): string {
  if (!row) return 'Unbekannt';
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return name || 'Unbekannt';
}

function addressFromRow(row: PortalAssignmentRow): string {
  const client = row.clients;
  return formatAddressFromSnapshotOrParts(row.address_snapshot, {
    street: client?.street,
    houseNumber: client?.house_number,
    zip: client?.postal_code,
    city: client?.city,
  });
}

async function countLocationPoints(tenantId: string, visitId: string): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  const { count, error } = await fromUnknownTable(supabase, 'assist_location_points')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId);

  if (error) {
    console.warn('[resolveEmployeeLiveContext] location count:', error.message);
    return 0;
  }
  return count ?? 0;
}

/** Resolve employee live context — single source before consent/tracking/time events. */
export async function resolveEmployeeLiveContext(
  input: ResolveEmployeeLiveContextInput,
): Promise<ServiceResult<EmployeeLiveContext>> {
  const tenantId = input.tenantId?.trim();
  const employeeId = input.employeeId?.trim();
  const routeParamId = input.routeParamId?.trim();

  const baseContext = {
    tenantId,
    employeeId,
    routeParam: routeParamId,
    portalAccountId: input.portalAccountId,
    operation: 'resolveEmployeeLiveContext',
  };

  if (!tenantId) {
    const err = createLiveTrackingError('LIVE_TENANT_MISSING', baseContext);
    logLiveTrackingError(err);
    return liveTrackingErrorToServiceResult(err);
  }
  if (!employeeId) {
    const err = createLiveTrackingError('LIVE_EMPLOYEE_MISSING', baseContext);
    logLiveTrackingError(err);
    return liveTrackingErrorToServiceResult(err);
  }
  if (!routeParamId || !isUuid(routeParamId)) {
    const err = createLiveTrackingError('LIVE_ASSIGNMENT_NOT_FOUND', {
      ...baseContext,
      assignmentId: routeParamId,
    });
    logLiveTrackingError(err);
    return liveTrackingErrorToServiceResult(err);
  }

  if (getServiceMode() !== 'supabase') {
    return { ok: false, error: 'Live-Kontext nur im Supabase-Modus verfügbar.' };
  }

  const resolved = await resolveLiveAssignment({
    tenantId,
    rawId: routeParamId,
    employeeId,
  });

  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  if (!resolved.data) {
    const err = createLiveTrackingError('LIVE_ASSIGNMENT_NOT_FOUND', {
      ...baseContext,
      assignmentId: routeParamId,
      tableOrRpc: 'resolveLiveAssignment',
    });
    logLiveTrackingError(err);
    return liveTrackingErrorToServiceResult(err);
  }

  const resolution = resolved.data;
  const assignmentStatus = resolution.detail.assignmentStatus;

  const supabase = getSupabaseClient();
  if (supabase) {
    const { error: verifyError } = await fromUnknownTable(supabase, 'assignments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', resolution.assignmentId)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (verifyError) {
      const err = liveTrackingErrorFromSupabase(verifyError, {
        ...baseContext,
        assignmentId: resolution.assignmentId,
        assistVisitId: resolution.visitId,
        clientId: resolution.clientId,
        tableOrRpc: 'assignments',
        operation: 'resolveEmployeeLiveContext.verify',
      });
      return liveTrackingErrorToServiceResult(err);
    }
  }

  const sessionResult = await fetchActiveTrackingSession(tenantId, resolution.visitId);
  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error };
  }

  const latestLocation = await fetchLatestLocationPointForVisit(tenantId, resolution.visitId);
  const pointCount = await countLocationPoints(tenantId, resolution.visitId);
  const timeEvents = await fetchTimeEventsForVisit(tenantId, resolution.visitId, 100);

  const dbConsentGranted = Boolean(sessionResult.data?.consentGrantedAt);
  const localConsent = input.localConsent;
  const consentGranted = localConsent?.granted || dbConsentGranted;
  const consentGrantedAt =
    localConsent?.grantedAt ?? sessionResult.data?.consentGrantedAt ?? null;
  const consentExplainedAt =
    localConsent?.explainedAt ?? sessionResult.data?.consentExplainedAt ?? null;

  const sessionActive = Boolean(sessionResult.data?.isActive);
  const trackingActive =
    sessionActive ||
    assignmentStatus === 'unterwegs' ||
    assignmentStatus === 'angekommen';

  let canStartTracking = consentGranted;
  let reasonCode: LiveTrackingErrorCode | null = null;

  if (!consentGranted) {
    canStartTracking = false;
    reasonCode = null;
  } else if (!resolution.clientId) {
    canStartTracking = false;
    reasonCode = 'LIVE_CLIENT_MISSING';
  }

  const clientAddress = addressFromRow({
    id: resolution.assignmentId,
    tenant_id: tenantId,
    client_id: resolution.clientId,
    employee_id: resolution.employeeId,
    planned_start_at: resolution.detail.plannedStartAt,
    planned_end_at: resolution.detail.plannedEndAt,
    actual_start_at: resolution.detail.actualStartAt,
    actual_end_at: resolution.detail.actualEndAt,
    status: resolution.detail.assignmentStatus,
    title: resolution.detail.title,
    address_snapshot: resolution.detail.location,
    clients: {
      first_name: resolution.detail.clientName.split(' ')[0] ?? null,
      last_name: resolution.detail.clientName.split(' ').slice(1).join(' ') || null,
    },
  });

  void timeEvents;

  return {
    ok: true,
    data: {
      tenantId,
      employeeId,
      clientId: resolution.clientId,
      assignmentId: resolution.assignmentId,
      assistVisitId: resolution.visitId,
      serviceTitle: resolution.detail.title,
      clientName: resolution.detail.clientName,
      clientAddress:
        formatAddressFromSnapshotOrParts(resolution.detail.location, {}) ||
        clientAddress ||
        '—',
      scheduledStartAt: resolution.detail.plannedStartAt,
      scheduledEndAt: resolution.detail.plannedEndAt,
      assignmentStatus,
      consentStatus: {
        granted: consentGranted,
        grantedAt: consentGrantedAt,
        explainedAt: consentExplainedAt,
      },
      trackingSessionId: sessionResult.data?.id ?? null,
      trackingSessionActive: trackingActive,
      lastLocationAt: latestLocation.ok ? (latestLocation.data?.recordedAt ?? null) : null,
      lastLocationAccuracyMeters: latestLocation.ok
        ? (latestLocation.data?.accuracyMeters ?? null)
        : null,
      locationPointCount: pointCount,
      canStartTracking,
      reasonCode,
      resolution,
      detail: null,
      timeEventsLoaded: timeEvents.ok,
    },
  };
}

/** Portal-safe assignment row fetch (minimal select — avoids nested task RLS failures). */
export async function fetchEmployeePortalAssignmentRow(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
): Promise<ServiceResult<PortalAssignmentRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(supabase, 'assignments')
    .select(PORTAL_ASSIGNMENT_SELECT)
    .eq('tenant_id', tenantId)
    .eq('id', assignmentId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error) {
    const err = liveTrackingErrorFromSupabase(error, {
      tenantId,
      employeeId,
      assignmentId,
      tableOrRpc: 'assignments',
      operation: 'fetchEmployeePortalAssignmentRow',
    });
    return liveTrackingErrorToServiceResult(err);
  }

  if (!data) return { ok: true, data: null };
  return { ok: true, data: data as unknown as PortalAssignmentRow };
}

export function assignmentStatusFromPortalRow(row: PortalAssignmentRow): AssignmentStatus {
  return remoteStatusToAssignment(row.status);
}

export function clientNameFromPortalRow(row: PortalAssignmentRow): string {
  return personName(row.clients);
}

export function clientAddressFromPortalRow(row: PortalAssignmentRow): string {
  return addressFromRow(row);
}
