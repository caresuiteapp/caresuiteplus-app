import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { TenantTableRow } from './createTenantTableRepository';
import {
  mapCourseRowToDetail,
  COURSE_DETAIL_SELECT_COLUMNS,
  type CourseDetailLiveRow,
} from '@/lib/akademie/courseDetailMapper';
import {
  mapCourseRowsToListItems,
  COURSE_LIVE_SELECT_COLUMNS,
  type CourseLiveRow,
} from '@/lib/akademie/courseListMapper';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP430 — Live Supabase Repository (Akademie) */
export const akademieSupabaseRepository = {
  wpNumber: 430,
  table: 'catalogs',
  entityLabel: 'Akademie',

  async list(tenantId: string): Promise<ServiceResult<TenantTableRow[]>> {
    const result = await this.listForCourses(tenantId);
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        title: row.title,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    };
  },

  async listForCourses(tenantId: string): Promise<ServiceResult<CourseLiveRow[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'catalogs')
      .select(COURSE_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('catalog_type', 'course')
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as unknown as CourseLiveRow[] };
  },

  async listMapped(tenantId: string) {
    const result = await this.listForCourses(tenantId);
    if (!result.ok) return result;
    return mapCourseRowsToListItems(result.data);
  },

  async getByIdForCourse(
    courseId: string,
    tenantId: string,
  ): Promise<ServiceResult<CourseDetailLiveRow | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'catalogs')
      .select(COURSE_DETAIL_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('catalog_type', 'course')
      .eq('id', courseId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data as CourseDetailLiveRow | null) ?? null };
  },

  async getDetailMapped(courseId: string, tenantId: string) {
    const result = await this.getByIdForCourse(courseId, tenantId);
    if (!result.ok) return result;
    if (!result.data) {
      return { ok: false as const, error: 'Kurs nicht gefunden.' };
    }
    return mapCourseRowToDetail(result.data);
  },
};

export type { CourseDetailLiveRow, CourseLiveRow };
