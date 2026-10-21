import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  CLIENT_FINANCING_KINDS,
  type ClientFinancingKind,
  type ClientFinancingPath,
} from '@/lib/clients/clientParallelFinancingDomain';

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Ungültiges Feld: ${field}`);
  return value;
}

function nullableText(value: unknown, field: string): string | null {
  if (value === null) return null;
  return text(value, field);
}

export function mapClientFinancingPathRow(row: Record<string, unknown>): ClientFinancingPath {
  const kind = text(row.financing_kind, 'financing_kind');
  if (!(CLIENT_FINANCING_KINDS as readonly string[]).includes(kind)) {
    throw new Error('Unbekannte Finanzierungsgrundlage.');
  }
  const version = row.version;
  if (!Number.isInteger(version) || Number(version) < 1) throw new Error('Ungültige Finanzierungsweg-Version.');
  const status = text(row.status, 'status');
  if (!['draft', 'active', 'ended', 'cancelled'].includes(status)) throw new Error('Unbekannter Finanzierungsstatus.');
  return {
    id: text(row.id, 'id'),
    logicalPathId: text(row.logical_path_id, 'logical_path_id'),
    tenantId: text(row.tenant_id, 'tenant_id'),
    clientId: text(row.client_id, 'client_id'),
    financingKind: kind as ClientFinancingKind,
    payerAssignmentId: nullableText(row.payer_assignment_id, 'payer_assignment_id'),
    payerName: text(row.payer_name, 'payer_name'),
    payerIk: nullableText(row.payer_ik, 'payer_ik'),
    basisReference: text(row.basis_reference, 'basis_reference'),
    validFrom: text(row.valid_from, 'valid_from'),
    validUntil: nullableText(row.valid_until, 'valid_until'),
    status: status as ClientFinancingPath['status'],
    version: Number(version),
    supersedesPathId: nullableText(row.supersedes_path_id, 'supersedes_path_id'),
    createdAt: text(row.created_at, 'created_at'),
  };
}

export async function listClientParallelFinancingPaths(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientFinancingPath[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const { data, error } = await fromUnknownTable(client, 'client_financing_paths')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .is('replaced_at', null)
      .order('valid_from', { ascending: true })
      .order('id', { ascending: true });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    try {
      const paths = (Array.isArray(data) ? data : []).map((row) =>
        mapClientFinancingPathRow(row as Record<string, unknown>));
      if (paths.some((path) => path.tenantId !== tenantId || path.clientId !== clientId)) {
        return { ok: false, error: 'Finanzierungswege konnten nicht mandanten- und falltreu gelesen werden.' };
      }
      return { ok: true, data: paths };
    } catch {
      return { ok: false, error: 'Finanzierungswege enthalten unvollständige oder unbekannte Originaldaten.' };
    }
  });
}
