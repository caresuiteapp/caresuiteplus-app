import { useEffect, useState } from 'react';
import { resolveRouteStartAddress } from '@/lib/maps/employeeRouteEndpointResolver';
import { fetchAssignmentTravelTime } from '@/lib/maps/googleMapsTravelService';
import { formatTravelTimeLabel } from '@/lib/maps/transportModeMapping';
import {
  buildDefaultMobilitySettings,
  fetchEmployeeMobilitySettings,
  loadEmployeeAddressContext,
} from '@/lib/office/employeeMobilityService';
import type { AssignmentListItem } from '@/types/modules/assist';
import type { EmployeeTransportMode } from '@/types/modules/employeeMobility';

export type AssignmentTravelTimeDisplay = {
  label: string | null;
  minutes: number | null;
  transportMode: EmployeeTransportMode;
  loading: boolean;
  source: 'google' | 'heuristic' | 'unavailable' | 'demo' | null;
};

export function useAssignmentTravelTime(
  assignment: AssignmentListItem,
  options?: { enabled?: boolean; lastAssignmentAddress?: string | null },
): AssignmentTravelTimeDisplay {
  const [state, setState] = useState<AssignmentTravelTimeDisplay>({
    label: null,
    minutes: null,
    transportMode: 'car',
    loading: false,
    source: null,
  });

  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    if (!assignment.tenantId || !assignment.employeeId || !assignment.location?.trim()) {
      setState({
        label: null,
        minutes: null,
        transportMode: 'car',
        loading: false,
        source: 'unavailable',
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    (async () => {
      const [settingsRes, addressRes] = await Promise.all([
        fetchEmployeeMobilitySettings(assignment.tenantId, assignment.employeeId!),
        loadEmployeeAddressContext(assignment.tenantId, assignment.employeeId!),
      ]);

      const settings = settingsRes.ok
        ? settingsRes.data
        : buildDefaultMobilitySettings(assignment.tenantId, assignment.employeeId!);
      const addressContext = addressRes.ok
        ? addressRes.data
        : { employeeHome: {}, tenantOffice: {} };

      const origin = resolveRouteStartAddress({
        settings,
        employeeHome: addressContext.employeeHome,
        tenantOffice: addressContext.tenantOffice,
        lastAssignmentAddress: options?.lastAssignmentAddress ?? null,
      });

      const travel = await fetchAssignmentTravelTime({
        tenantId: assignment.tenantId,
        assignmentAddress: assignment.location,
        originAddress: origin,
        transportMode: settings.transportMode,
      });

      if (cancelled) return;

      const label = formatTravelTimeLabel(settings.transportMode, travel.durationMinutes);
      setState({
        label,
        minutes: travel.durationMinutes,
        transportMode: settings.transportMode,
        loading: false,
        source: travel.source,
      });
    })().catch(() => {
      if (!cancelled) {
        setState({
          label: null,
          minutes: null,
          transportMode: 'car',
          loading: false,
          source: 'unavailable',
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    assignment.tenantId,
    assignment.employeeId,
    assignment.location,
    options?.lastAssignmentAddress,
  ]);

  return state;
}
