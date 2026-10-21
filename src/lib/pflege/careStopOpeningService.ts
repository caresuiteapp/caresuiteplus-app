import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export type CareStopOpeningContext = Readonly<{
  stopId: string;
  tourId: string;
  clientId: string;
  clientName: string;
  serviceSummary: string;
  plannedStart: string;
  plannedEnd: string;
  identity: Readonly<{ lastNameRequired: true; dateOfBirthRequired: true; dateOfBirthAvailable: boolean }>;
  plan: Readonly<{ id: string; title: string; version: number; validFrom: string; validUntil: string | null; updatedAt: string; items: readonly Readonly<Record<string, unknown>>[] }>;
  warnings: Readonly<Record<string, string>>;
  expected: Readonly<{ stopUpdatedAt: string; clientUpdatedAt: string; planUpdatedAt: string }>;
}>;

type RpcError = { code?: string; message?: string } | null;
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> };

function openingError(error: RpcError): string {
  if (error?.code === 'PGRST202') return 'Die sichere Einsatzöffnung ist in der Datenbank noch nicht freigeschaltet.';
  if (['23514', '40001', 'P0001'].includes(error?.code ?? '') && error?.message) return error.message;
  return toGermanSupabaseError(error);
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<ServiceResult<T>> {
  const client = getSupabaseClient() as unknown as RpcClient | null;
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  try {
    const { data, error } = await client.rpc(name, args);
    if (error || data == null) return { ok: false, error: openingError(error) };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'Verbindung unterbrochen. Einsatz erneut öffnen und den aktuellen Stand prüfen.' };
  }
}

function guard<T>(tenantId: string, role?: RoleKey | null): ServiceResult<T> | null {
  const denied = enforcePermission<T>(role, 'pflege.plans.manage');
  if (denied) return denied;
  const invalid = guardServiceTenant(tenantId);
  if (invalid) return invalid as ServiceResult<T>;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Die sichere Einsatzöffnung ist ausschließlich live verfügbar.' };
  return null;
}

export async function fetchCareStopOpeningContext(tenantId: string, role: RoleKey | null | undefined, stopId: string): Promise<ServiceResult<CareStopOpeningContext>> {
  const blocked = guard<CareStopOpeningContext>(tenantId, role);
  return blocked ?? rpc('get_ambulatory_care_stop_opening_context', { p_stop_id: stopId });
}

export async function confirmCareStopOpening(tenantId: string, role: RoleKey | null | undefined, context: CareStopOpeningContext, lastName: string, dateOfBirth: string): Promise<ServiceResult<{ id: string; openingId: string }>> {
  const blocked = guard<{ id: string; openingId: string }>(tenantId, role);
  return blocked ?? rpc('confirm_ambulatory_care_stop_opening', {
    p_stop_id: context.stopId,
    p_plan_id: context.plan.id,
    p_plan_version: context.plan.version,
    p_expected_stop_updated_at: context.expected.stopUpdatedAt,
    p_expected_client_updated_at: context.expected.clientUpdatedAt,
    p_expected_plan_updated_at: context.expected.planUpdatedAt,
    p_last_name: lastName.trim(),
    p_date_of_birth: dateOfBirth,
  });
}

export async function fetchPortalCareStopOpeningContext(stopId: string): Promise<ServiceResult<CareStopOpeningContext>> {
  return rpc('get_ambulatory_care_stop_opening_context', { p_stop_id: stopId });
}

export async function confirmPortalCareStopOpening(context: CareStopOpeningContext, lastName: string, dateOfBirth: string): Promise<ServiceResult<{ id: string; openingId: string }>> {
  return rpc('confirm_ambulatory_care_stop_opening', {
    p_stop_id: context.stopId,
    p_plan_id: context.plan.id,
    p_plan_version: context.plan.version,
    p_expected_stop_updated_at: context.expected.stopUpdatedAt,
    p_expected_client_updated_at: context.expected.clientUpdatedAt,
    p_expected_plan_updated_at: context.expected.planUpdatedAt,
    p_last_name: lastName.trim(),
    p_date_of_birth: dateOfBirth,
  });
}
