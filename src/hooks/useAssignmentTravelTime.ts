import { useEffect, useState } from 'react';
import {
  formatGermanAddress,
  resolveRouteStartAddress,
} from '@/lib/maps/employeeRouteEndpointResolver';
import { fetchAssignmentTravelTime } from '@/lib/maps/googleMapsTravelService';
import {
  formatTravelTimeLabel,
  formatTravelTimesDisplay,
  formatTravelTimesPlaceholder,
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
  transportModes: EmployeeTransportMode[];
  loading: boolean;
  source: 'google' | 'heuristic' | 'unavailable' | 'demo' | null;
  error: string | null;
  /** Ready-to-render text for compact cards (icons + minutes for all selected modes). */
  displayText: string | null;
};

export function useAssignmentTravelTime(
  assignment: AssignmentListItem,
  options?: { enabled?: boolean; lastAssignmentAddress?: string | null },
): AssignmentTravelTimeDisplay {
  const [state, setState] = useState<AssignmentTravelTimeDisplay>({
    label: null,
    minutes: null,
    transportModes: ['car'],
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
        transportModes: ['car'],
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
      displayText: formatTravelTimesPlaceholder(['car']),
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
      const transportModes = settings.transportModes;

      if (!cancelled) {
        setState((prev) => ({
          ...prev,
          transportModes,
          displayText: formatTravelTimesPlaceholder(transportModes),
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

      const travelResults = await Promise.all(
        transportModes.map(async (mode) => {
          const travel = await fetchAssignmentTravelTime({
            tenantId: assignment.tenantId,
            assignmentAddress: assignment.location,
            originAddress: origin,
            transportMode: mode,
          });
          return { mode, travel };
        }),
      );

      if (cancelled) return;

      const minutesByMode = Object.fromEntries(
        travelResults.map(({ mode, travel }) => [mode, travel.durationMinutes]),
      ) as Partial<Record<EmployeeTransportMode, number | null>>;

      const displayText = formatTravelTimesDisplay(transportModes, minutesByMode);
      const primaryMode = transportModes[0] ?? 'car';
      const primaryTravel = travelResults.find(({ mode }) => mode === primaryMode)?.travel;
      const primaryLabel = formatTravelTimeLabel(primaryMode, primaryTravel?.durationMinutes ?? null);
      const unavailable =
        travelResults.every(
          ({ travel }) => travel.source === 'unavailable' || travel.durationMinutes == null,
        ) && primaryLabel == null;

      setState({
        label: primaryLabel,
        minutes: primaryTravel?.durationMinutes ?? null,
        transportModes,
        loading: false,
        source: primaryTravel?.source ?? 'unavailable',
        error: unavailable ? primaryTravel?.note ?? null : null,
        displayText,
      });
    })().catch(() => {
      if (!cancelled) {
        setState({
          label: null,
          minutes: null,
          transportModes: ['car'],
          loading: false,
          source: 'unavailable',
          error: 'Fahrzeit konnte nicht geladen werden.',
          displayText: formatTravelTimesPlaceholder(['car']),
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
