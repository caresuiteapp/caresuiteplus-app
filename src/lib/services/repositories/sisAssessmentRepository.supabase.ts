import type { ServiceResult } from '@/types';
import type { SisAssessment } from '@/types/modules/pflege';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  mapSisAssessmentRow,
  mapSisAssessmentRows,
  SIS_ASSESSMENT_SELECT_COLUMNS,
  type SisAssessmentLiveRow,
} from '@/lib/pflege/sisListMapper';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP381 — Live Supabase Repository (SIS via assessment_runs) */
export const sisAssessmentSupabaseRepository = {
  wpNumber: 381,
  table: 'assessment_runs',
  entityLabel: 'SIS-Assessment',

  async listRuns(tenantId: string): Promise<ServiceResult<SisAssessmentLiveRow[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'assessment_runs')
      .select(SIS_ASSESSMENT_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as unknown as SisAssessmentLiveRow[] };
  },

  async listMapped(tenantId: string): Promise<ServiceResult<SisAssessment[]>> {
    const result = await this.listRuns(tenantId);
    if (!result.ok) return result;
    return mapSisAssessmentRows(result.data);
  },

  async getById(tenantId: string, id: string): Promise<ServiceResult<SisAssessmentLiveRow | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'assessment_runs')
      .select(SIS_ASSESSMENT_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data as SisAssessmentLiveRow | null) ?? null };
  },

  async getDetailMapped(tenantId: string, id: string): Promise<ServiceResult<SisAssessment>> {
    const result = await this.getById(tenantId, id);
    if (!result.ok) return result;
    if (!result.data) {
      return { ok: false, error: 'SIS-Assessment nicht gefunden.' };
    }
    return { ok: true, data: mapSisAssessmentRow(result.data) };
  },
};
