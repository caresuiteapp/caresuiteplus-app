import { useEffect, useState } from 'react';
import {
  formatGermanAddress,
  resolveRouteStartAddress,
} from '@/lib/maps/employeeRouteEndpointResolver';
import { fetchAssignmentTravelTime } from '@/lib/maps/googleMapsTravelService';
import {
  formatTravelTimeLabel,
  formatTravelTimePlaceholder,
} from '@/lib/maps/transportModeMapping';
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
  error: string | null;
  /** Ready-to-render text for compact cards (icon + minutes or placeholder). */
  displayText: string | null;
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
    error: null,
    displayText: null,
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
        error: null,
        displayText: null,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      displayText: formatTravelTimePlaceholder('car'),
    }));

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

      if (!cancelled) {
        setState((prev) => ({
          ...prev,
          transportMode: settings.transportMode,
          displayText: formatTravelTimePlaceholder(settings.transportMode),
        }));
      }

      let origin = resolveRouteStartAddress({
        settings,
        employeeHome: addressContext.employeeHome,
        tenantOffice: addressContext.tenantOffice,
        lastAssignmentAddress: options?.lastAssignmentAddress ?? null,
      });

      if (!origin?.trim()) {
        origin = formatGermanAddress(addressContext.tenantOffice);
      }

      const travel = await fetchAssignmentTravelTime({
        tenantId: assignment.tenantId,
        assignmentAddress: assignment.location,
        originAddress: origin,
        transportMode: settings.transportMode,
      });

      if (cancelled) return;

      const label = formatTravelTimeLabel(settings.transportMode, travel.durationMinutes);
      const unavailable = travel.source === 'unavailable' || label == null;
      setState({
        label,
        minutes: travel.durationMinutes,
        transportMode: settings.transportMode,
        loading: false,
        source: travel.source,
        error: unavailable ? travel.note : null,
        displayText: label ?? formatTravelTimePlaceholder(settings.transportMode),
      });
    })().catch(() => {
      if (!cancelled) {
        setState({
          label: null,
          minutes: null,
          transportMode: 'car',
          loading: false,
          source: 'unavailable',
          error: 'Fahrzeit konnte nicht geladen werden.',
          displayText: formatTravelTimePlaceholder('car'),
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
