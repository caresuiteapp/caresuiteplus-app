import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EmployeeTransportMode } from '@/types/modules/employeeMobility';

export type EmployeePortalMobilitySelection = {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  mode: EmployeeTransportMode;
  selectedAt: string;
};

const KEY_PREFIX = 'caresuite:employee-portal:mobility-selection:v1';

function key(tenantId: string, employeeId: string, assignmentId: string): string {
  return `${KEY_PREFIX}:${tenantId}:${employeeId}:${assignmentId}`;
}

export async function loadEmployeePortalMobilitySelection(
  tenantId: string,
  employeeId: string,
  assignmentId: string,
): Promise<EmployeePortalMobilitySelection | null> {
  const raw = await AsyncStorage.getItem(key(tenantId, employeeId, assignmentId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EmployeePortalMobilitySelection>;
    if (
      parsed.tenantId !== tenantId ||
      parsed.employeeId !== employeeId ||
      parsed.assignmentId !== assignmentId ||
      !['car', 'transit', 'bicycle', 'escooter', 'walking'].includes(parsed.mode ?? '')
    ) return null;
    return parsed as EmployeePortalMobilitySelection;
  } catch {
    return null;
  }
}

export async function saveEmployeePortalMobilitySelection(input: {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  mode: EmployeeTransportMode;
}): Promise<EmployeePortalMobilitySelection> {
  const saved: EmployeePortalMobilitySelection = {
    ...input,
    selectedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(
    key(input.tenantId, input.employeeId, input.assignmentId),
    JSON.stringify(saved),
  );
  return saved;
}

export function mobilityActivatesEmployeeLogbook(mode: EmployeeTransportMode | null): boolean {
  return mode === 'car';
}
