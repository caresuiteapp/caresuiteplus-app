import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
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
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await fromUnknownTable(supabase, 'employee_visit_mobility_selections')
      .select('tenant_id,employee_id,assignment_id,transport_mode,selected_at')
      .eq('tenant_id', tenantId).eq('employee_id', employeeId).eq('assignment_id', assignmentId).maybeSingle();
    if (!error && data) {
      const row = data as Record<string, unknown>;
      return { tenantId, employeeId, assignmentId, mode: row.transport_mode as EmployeeTransportMode, selectedAt: String(row.selected_at) };
    }
  }
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
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await fromUnknownTable(supabase, 'employee_visit_mobility_selections').upsert({
      tenant_id: input.tenantId,
      employee_id: input.employeeId,
      assignment_id: input.assignmentId,
      transport_mode: input.mode,
      selected_at: saved.selectedAt,
    }, { onConflict: 'tenant_id,employee_id,assignment_id' });
    if (error) throw new Error(`Mobilitätsauswahl konnte nicht revisionssicher gespeichert werden: ${error.message}`);
  }
  return saved;
}

export function mobilityActivatesEmployeeLogbook(mode: EmployeeTransportMode | null): boolean {
  return mode === 'car';
}
