import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';
import type {
  EmployeePortalGpsPermissionStatus,
  EmployeePortalTrackingSnapshot,
} from '@/types/modules/employeePortalTracking';
import {
  buildEmployeePortalRoute,
  fetchEmployeePortalAssignmentDetail,
  transitionEmployeePortalAssignment,
  updateEmployeePortalTask,
} from '@/lib/portal/employeePortalExecutionService';
import {
  persistEmployeePortalLocationConsent,
  persistEmployeePortalLocationPoint,
} from '@/lib/portal/employeePortalVisitTrackingPersistence';
import {
  buildEmployeePortalTrackingSnapshot,
  captureEmployeePortalForegroundPosition,
  computeEmployeePortalLiveTimers,
  getEmployeePortalGpsPermissionStatus,
  getEmployeePortalLocationConsent,
  grantEmployeePortalLocationConsent,
  markEmployeePortalConsentExplained,
  requestEmployeePortalForegroundLocationPermission,
  setEmployeePortalGeofenceOverrideReason,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery, useMutation } from './core';

export function useEmployeePortalVisitExecution(assignmentId: string | undefined) {
  const { profile } = useAuth();
  const { tenantId: portalTenantId, employeeId: portalEmployeeId, roleKey: portalRoleKey } =
    usePortalActor();
  const tenantId = useServiceTenantId() ?? portalTenantId;
  const employeeId = portalEmployeeId ?? profile?.id ?? '';
  const roleKey = profile?.roleKey ?? portalRoleKey ?? null;

  const [gpsPermission, setGpsPermission] = useState<EmployeePortalGpsPermissionStatus>('undetermined');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!assignmentId) return;
    void getEmployeePortalGpsPermissionStatus().then(setGpsPermission);
  }, [assignmentId]);

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !assignmentId || !employeeId) {
        return Promise.resolve({ ok: false as const, error: 'Einsatzdaten unvollständig.' });
      }
      return fetchEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey);
    },
    [tenantId, assignmentId, employeeId, roleKey],
    { enabled: Boolean(tenantId && assignmentId && employeeId) },
  );

  const hasData = query.data != null;
  useEffect(() => {
    if (!hasData) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [hasData]);

  const tracking: EmployeePortalTrackingSnapshot | null = useMemo(() => {
    if (!tenantId || !assignmentId || !query.data) return null;
    void tick;
    return buildEmployeePortalTrackingSnapshot(
      tenantId,
      assignmentId,
      query.data.status,
      gpsPermission,
    );
  }, [tenantId, assignmentId, query.data, gpsPermission, tick]);

  const timers = useMemo(() => {
    if (!tenantId || !assignmentId || !query.data) return null;
    void tick;
    return computeEmployeePortalLiveTimers(tenantId, assignmentId, query.data.status);
  }, [tenantId, assignmentId, query.data, tick]);

  const statusMutation = useMutation(
    (toStatus: AssignmentStatus) => {
      if (!tenantId || !assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID.' });
      }
      return transitionEmployeePortalAssignment(tenantId, assignmentId, employeeId, roleKey, toStatus);
    },
    {
      onSuccess: (detail: EmployeePortalAssignmentDetail) => query.setData(detail),
    },
  );

  const changeStatus = useCallback(
    async (toStatus: AssignmentStatus) => {
      await statusMutation.mutate(toStatus);
    },
    [statusMutation],
  );

  const grantConsent = useCallback(async () => {
    if (!tenantId || !assignmentId) return;
    markEmployeePortalConsentExplained(tenantId, assignmentId);
    grantEmployeePortalLocationConsent(tenantId, assignmentId);
    await persistEmployeePortalLocationConsent({
      tenantId,
      assignmentId,
      employeeId,
      profileId: profile?.id ?? employeeId,
    });
    await query.refresh();
  }, [tenantId, assignmentId, employeeId, profile?.id, query]);

  const requestLocationPermission = useCallback(async () => {
    const status = await requestEmployeePortalForegroundLocationPermission();
    setGpsPermission(status);
    return status;
  }, []);

  const capturePosition = useCallback(async () => {
    if (!tenantId || !assignmentId) {
      return { ok: false as const, error: 'Keine Einsatz-ID.' };
    }
    const result = await captureEmployeePortalForegroundPosition(tenantId, assignmentId);
    if (result.ok) {
      await persistEmployeePortalLocationPoint(
        {
          tenantId,
          assignmentId,
          employeeId,
          profileId: profile?.id ?? employeeId,
        },
        result.data,
      );
      await query.refresh();
    }
    return result;
  }, [tenantId, assignmentId, employeeId, profile?.id, query]);

  const setGeofenceOverride = useCallback(
    (reason: string | null) => {
      if (!tenantId || !assignmentId) return;
      setEmployeePortalGeofenceOverrideReason(tenantId, assignmentId, reason);
    },
    [tenantId, assignmentId],
  );

  const openRoute = useCallback(async () => {
    if (!tenantId || !assignmentId) {
      return { ok: false as const, error: 'Keine Einsatz-ID.' };
    }
    return buildEmployeePortalRoute(tenantId, assignmentId, employeeId, roleKey);
  }, [tenantId, assignmentId, employeeId, roleKey]);

  const updateTask = useCallback(
    async (taskId: string, status: EmployeePortalAssignmentDetail['tasks'][number]['status'], note?: string) => {
      if (!tenantId || !assignmentId) {
        return { ok: false as const, error: 'Keine Einsatz-ID.' };
      }
      const result = await updateEmployeePortalTask(
        tenantId,
        assignmentId,
        employeeId,
        roleKey,
        taskId,
        status,
        note,
      );
      if (result.ok) query.setData(result.data);
      return result;
    },
    [tenantId, assignmentId, employeeId, roleKey, query],
  );

  const consent = useMemo(
    () =>
      tenantId && assignmentId
        ? getEmployeePortalLocationConsent(tenantId, assignmentId)
        : null,
    [tenantId, assignmentId, tick],
  );

  return {
    data: query.data,
    tracking,
    timers,
    consent,
    gpsPermission,
    loading: query.loading,
    error: query.error ?? statusMutation.error,
    actionLoading: statusMutation.loading,
    refresh: query.refresh,
    changeStatus,
    grantConsent,
    requestLocationPermission,
    capturePosition,
    setGeofenceOverride,
    openRoute,
    updateTask,
    notFound: !query.loading && !query.error && !query.data,
  };
}
