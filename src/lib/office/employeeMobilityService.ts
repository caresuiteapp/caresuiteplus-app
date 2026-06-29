import type { ServiceResult } from '@/types';
import {
  DEFAULT_EMPLOYEE_MOBILITY_SETTINGS,
  normalizeTransportModes,
  type EmployeeMobilitySettings,
  type EmployeeRouteEndType,
  type EmployeeRouteStartType,
  type EmployeeTransportMode,
} from '@/types/modules/employeeMobility';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { formatGermanAddress } from '@/lib/maps/employeeRouteEndpointResolver';

const TABLE = 'employee_mobility_settings';

const demoStore = new Map<string, EmployeeMobilitySettings>();

function storeKey(tenantId: string, employeeId: string): string {
  return `${tenantId}:${employeeId}`;
}

export function resetEmployeeMobilityDemoStore(): void {
  demoStore.clear();
}

type MobilityRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  transport_mode: EmployeeTransportMode;
  transport_modes?: EmployeeTransportMode[] | null;
  route_start_type: EmployeeRouteStartType;
  route_end_type: EmployeeRouteEndType;
  route_start_address: string | null;
  route_end_address: string | null;
  updated_at: string;
};

function mapRow(row: MobilityRow): EmployeeMobilitySettings {
  const transportModes =
    row.transport_modes != null && row.transport_modes.length > 0
      ? normalizeTransportModes(row.transport_modes)
      : normalizeTransportModes(row.transport_mode);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    transportModes,
    routeStartType: row.route_start_type,
    routeEndType: row.route_end_type,
    routeStartAddress: row.route_start_address,
    routeEndAddress: row.route_end_address,
    updatedAt: row.updated_at,
  };
}

export function buildDefaultMobilitySettings(
  tenantId: string,
  employeeId: string,
): EmployeeMobilitySettings {
  return {
    tenantId,
    employeeId,
    ...DEFAULT_EMPLOYEE_MOBILITY_SETTINGS,
  };
}

export async function fetchEmployeeMobilitySettings(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeeMobilitySettings>> {
  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: demoStore.get(storeKey(tenantId, employeeId)) ?? buildDefaultMobilitySettings(tenantId, employeeId),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .select(
      'id, tenant_id, employee_id, transport_mode, transport_modes, route_start_type, route_end_type, route_start_address, route_end_address, updated_at',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: buildDefaultMobilitySettings(tenantId, employeeId) };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) {
    return { ok: true, data: buildDefaultMobilitySettings(tenantId, employeeId) };
  }

  return { ok: true, data: mapRow(data as MobilityRow) };
}

export async function saveEmployeeMobilitySettings(
  settings: EmployeeMobilitySettings,
): Promise<ServiceResult<EmployeeMobilitySettings>> {
  const transportModes = normalizeTransportModes(settings.transportModes);
  const payload = {
    tenant_id: settings.tenantId,
    employee_id: settings.employeeId,
    transport_mode: transportModes[0],
    transport_modes: transportModes,
    route_start_type: settings.routeStartType,
    route_end_type: settings.routeEndType,
    route_start_address: settings.routeStartAddress?.trim() || null,
    route_end_address: settings.routeEndAddress?.trim() || null,
  };

  if (getServiceMode() !== 'supabase') {
    const saved: EmployeeMobilitySettings = {
      ...settings,
      id: settings.id ?? `demo-mobility-${settings.employeeId}`,
      updatedAt: new Date().toISOString(),
    };
    demoStore.set(storeKey(settings.tenantId, settings.employeeId), saved);
    return { ok: true, data: saved };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .upsert(payload, { onConflict: 'tenant_id,employee_id' })
    .select(
      'id, tenant_id, employee_id, transport_mode, transport_modes, route_start_type, route_end_type, route_start_address, route_end_address, updated_at',
    )
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Mobilitätseinstellungen (0191) noch nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapRow(data as MobilityRow) };
}

export async function loadEmployeeAddressContext(
  tenantId: string,
  employeeId: string,
): Promise<
  ServiceResult<{
    employeeHome: Parameters<typeof formatGermanAddress>[0];
    tenantOffice: Parameters<typeof formatGermanAddress>[0];
  }>
> {
  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: {
        employeeHome: { street: 'Musterstraße', houseNumber: '12', postalCode: '10115', city: 'Berlin' },
        tenantOffice: { street: 'Dienstweg', houseNumber: '1', postalCode: '10117', city: 'Berlin' },
      },
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const [employeeRes, tenantRes] = await Promise.all([
    supabase
      .from('employees')
      .select('street, house_number, postal_code, city')
      .eq('tenant_id', tenantId)
      .eq('id', employeeId)
      .maybeSingle(),
    supabase
      .from('tenants')
      .select('street, house_number, postal_code, city')
      .eq('id', tenantId)
      .maybeSingle(),
  ]);

  if (employeeRes.error) {
    return { ok: false, error: toGermanSupabaseError(employeeRes.error) };
  }
  if (tenantRes.error) {
    return { ok: false, error: toGermanSupabaseError(tenantRes.error) };
  }

  return {
    ok: true,
    data: {
      employeeHome: {
        street: employeeRes.data?.street,
        houseNumber: employeeRes.data?.house_number,
        postalCode: employeeRes.data?.postal_code,
        city: employeeRes.data?.city,
      },
      tenantOffice: {
        street: tenantRes.data?.street,
        houseNumber: tenantRes.data?.house_number,
        postalCode: tenantRes.data?.postal_code,
        city: tenantRes.data?.city,
      },
    },
  };
}
