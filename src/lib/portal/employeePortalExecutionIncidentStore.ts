import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'caresuite.portal.execution-incidents.v1';
const MAX_INCIDENTS = 10;

export type EmployeePortalExecutionIncident = {
  reference: string;
  assignmentId: string | null;
  message: string;
  stack: string | null;
  componentStack: string | null;
  createdAt: string;
};

function parseIncidents(raw: string | null): EmployeePortalExecutionIncident[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is EmployeePortalExecutionIncident =>
          Boolean(entry && typeof entry === 'object' && 'reference' in entry))
      : [];
  } catch {
    return [];
  }
}

/** Keeps enough local diagnostics for support without showing health data in the UI. */
export async function persistEmployeePortalExecutionIncident(
  incident: EmployeePortalExecutionIncident,
): Promise<void> {
  try {
    const existing = parseIncidents(await AsyncStorage.getItem(STORAGE_KEY));
    const next = [incident, ...existing.filter((item) => item.reference !== incident.reference)]
      .slice(0, MAX_INCIDENTS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('[EmployeePortalExecution] incident persistence failed', error);
  }
}

export async function readEmployeePortalExecutionIncidents(): Promise<EmployeePortalExecutionIncident[]> {
  return parseIncidents(await AsyncStorage.getItem(STORAGE_KEY));
}
