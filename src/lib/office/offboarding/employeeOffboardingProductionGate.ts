import { getSupabaseClient } from '@/lib/supabase/client';
import type { ServiceResult } from '@/types';

export type EmployeeOffboardingProductionCheckKey =
  | 'live_gps'
  | 'active_logbook_trip'
  | 'active_work_time'
  | 'future_assignments'
  | 'open_documentation'
  | 'open_signatures'
  | 'open_corrections'
  | 'open_inventory'
  | 'open_expenses'
  | 'active_push_devices';

export type EmployeeOffboardingProductionCheck = {
  key: EmployeeOffboardingProductionCheckKey;
  label: string;
  count: number;
  passed: boolean;
  message: string;
};

export type EmployeeOffboardingProductionGate = {
  checks: EmployeeOffboardingProductionCheck[];
  passed: boolean;
  checkedAt: string;
};

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

function mapGate(value: unknown): ServiceResult<EmployeeOffboardingProductionGate> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Die Produktionsprüfung hat kein gültiges Ergebnis geliefert.' };
  }
  const row = value as Record<string, unknown>;
  const rawChecks = Array.isArray(row.checks) ? row.checks : [];
  const checks = rawChecks.flatMap((entry): EmployeeOffboardingProductionCheck[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    return [{
      key: String(item.key) as EmployeeOffboardingProductionCheckKey,
      label: String(item.label ?? item.key ?? 'Live-Prüfung'),
      count: Number.isFinite(Number(item.count)) ? Number(item.count) : 0,
      passed: item.passed === true,
      message: String(item.message ?? 'Produktionsstatus wurde geprüft.'),
    }];
  });
  if (checks.length !== 10) {
    return { ok: false, error: 'Die Produktionsprüfung ist unvollständig. Die Endfreigabe bleibt gesperrt.' };
  }
  return {
    ok: true,
    data: {
      checks,
      passed: checks.every((entry) => entry.passed),
      checkedAt: typeof row.checked_at === 'string' ? row.checked_at : new Date().toISOString(),
    },
  };
}

/** Kein Demo-Fallback: Fehler oder fehlende Prüftabellen sperren die Endfreigabe. */
export async function fetchEmployeeOffboardingProductionGate(
  tenantId: string,
  employeeId: string,
  exitDate?: string | null,
): Promise<ServiceResult<EmployeeOffboardingProductionGate>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Die sichere Live-Datenbank ist nicht verfügbar.' };
  const result = await (supabase as unknown as RpcClient).rpc('employee_offboarding_production_gate', {
    p_tenant_id: tenantId,
    p_employee_id: employeeId,
    p_exit_date: exitDate || null,
  });
  if (result.error) {
    return {
      ok: false,
      error: `Produktionsprüfung nicht möglich: ${result.error.message ?? 'Unbekannter Datenbankfehler'}. Die Endfreigabe bleibt gesperrt.`,
    };
  }
  return mapGate(result.data);
}

export async function invalidateEmployeeOffboardingPushDevices(
  tenantId: string,
  employeeId: string,
  actorId?: string | null,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Die sichere Live-Datenbank ist nicht verfügbar.' };
  const result = await (supabase as unknown as RpcClient).rpc('employee_offboarding_invalidate_push_devices', {
    p_tenant_id: tenantId,
    p_employee_id: employeeId,
    p_actor_id: actorId || null,
  });
  if (result.error) return { ok: false, error: result.error.message ?? 'Portalgeräte konnten nicht gesperrt werden.' };
  return { ok: true, data: undefined };
}
