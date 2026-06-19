import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';
import {
  mapReportRowsToListItems,
  REPORT_LIVE_SELECT_COLUMNS,
  type ReportLiveRow,
} from '@/lib/reporting/reportListMapper';
import {
  mapReportRowToDetail,
  REPORT_DETAIL_SELECT_COLUMNS,
  type ReportDetailLiveRow,
} from '@/lib/reporting/reportDetailMapper';
import {
  emptyPdlCockpitSnapshot,
  mapPdlCockpitRow,
  PDL_COCKPIT_SELECT_COLUMNS,
  type PdlCockpitLiveRow,
} from '@/lib/reporting/pdlCockpitMapper';

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export type ReportingRow = {
  id: string;
  tenant_id: string;
  title: string;
  category: string;
  period: string;
  status: string;
  updated_at: string;
  created_at: string;
  created_by: string | null;
};

export const REPORTING_TABLE = 'reporting_reports';
export const PDL_COCKPIT_TABLE = 'reporting_pdl_cockpit';

export const REPORTING_RLS_POLICIES = [
  'tenant_isolation',
  'role_reporting_view',
  'role_reporting_create',
] as const;

/** WP510 — Live Supabase Repository (reporting) */
export const reportingSupabaseRepository = {
  wpNumber: 510 as const,
  table: 'reporting_reports' as const,
  entityLabel: 'Bericht',

  async list(tenantId: string): Promise<ServiceResult<ReportingRow[]>> {
    const result = await this.listForReports(tenantId);
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        title: row.title,
        category: row.category ?? 'pdl',
        period: row.period ?? 'Aktuell',
        status: row.status,
        updated_at: row.updated_at,
        created_at: row.created_at,
        created_by: null,
      })),
    };
  },

  async listForReports(tenantId: string): Promise<ServiceResult<ReportLiveRow[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, REPORTING_TABLE)
      .select(REPORT_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as unknown as ReportLiveRow[] };
  },

  async listMapped(tenantId: string) {
    const result = await this.listForReports(tenantId);
    if (!result.ok) return result;
    return mapReportRowsToListItems(result.data);
  },

  async getByIdForReport(
    reportId: string,
    tenantId: string,
  ): Promise<ServiceResult<ReportDetailLiveRow | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, REPORTING_TABLE)
      .select(REPORT_DETAIL_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', reportId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data as ReportDetailLiveRow | null) ?? null };
  },

  async getDetailMapped(reportId: string, tenantId: string) {
    const result = await this.getByIdForReport(reportId, tenantId);
    if (!result.ok) return result;
    if (!result.data) {
      return { ok: false as const, error: 'Bericht nicht gefunden.' };
    }
    return mapReportRowToDetail(result.data);
  },

  async create(
    tenantId: string,
    payload: { title: string; category?: string; period?: string },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, REPORTING_TABLE)
      .insert({
        tenant_id: tenantId,
        title: payload.title,
        category: payload.category ?? 'pdl',
        period: payload.period ?? 'Aktuell',
        status: 'entwurf',
      } as Record<string, unknown>)
      .select('id')
      .single();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: (data as { id: string }).id } };
  },

  async getCockpitForTenant(tenantId: string): Promise<ServiceResult<PdlCockpitLiveRow | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, PDL_COCKPIT_TABLE)
      .select(PDL_COCKPIT_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return { ok: true, data: null, tableMissing: true };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    return { ok: true, data: (data as PdlCockpitLiveRow | null) ?? null };
  },

  async getCockpitMapped(tenantId: string) {
    const result = await this.getCockpitForTenant(tenantId);
    if (!result.ok) return result;
    if (!result.data) {
      return { ok: true as const, data: emptyPdlCockpitSnapshot(tenantId) };
    }
    return mapPdlCockpitRow(result.data);
  },
};

export type { ReportDetailLiveRow, ReportLiveRow };
