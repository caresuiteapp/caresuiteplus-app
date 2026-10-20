import type { ServiceResult } from '@/types';
import type {
  CertificateDetail,
  CertificateListItem,
  EnrollmentDetail,
  EnrollmentListItem,
} from '@/types/modules/akademie';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  CERTIFICATE_LIVE_SELECT_COLUMNS,
  ENROLLMENT_LIVE_SELECT_COLUMNS,
  mapCertificateRowToDetail,
  mapCertificateRowToListItem,
  mapEnrollmentRowToDetail,
  mapEnrollmentRowToListItem,
  type CertificateLiveRow,
  type EnrollmentLiveRow,
} from '@/lib/akademie/enrollmentExtensionMapper';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP390 Extension — Live Supabase (Migration 0036) */
export const akademieExtensionSupabaseRepository = {
  wpNumber: 390,
  migration: '0036_module_extensions_prepared',

  async listEnrollmentsMapped(tenantId: string): Promise<ServiceResult<EnrollmentListItem[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable<EnrollmentListItem[]>();
    const { data, error } = await fromUnknownTable(supabase, 'akademie_enrollments')
      .select(ENROLLMENT_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const rows = (data ?? []) as unknown as EnrollmentLiveRow[];
    return { ok: true, data: rows.map(mapEnrollmentRowToListItem) };
  },

  async getEnrollmentDetailMapped(
    tenantId: string,
    enrollmentId: string,
  ): Promise<ServiceResult<EnrollmentDetail>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable<EnrollmentDetail>();
    const { data, error } = await fromUnknownTable(supabase, 'akademie_enrollments')
      .select(ENROLLMENT_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', enrollmentId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Einschreibung nicht gefunden.' };
    return {
      ok: true,
      data: mapEnrollmentRowToDetail(data as unknown as EnrollmentLiveRow),
    };
  },

  async listCertificatesMapped(tenantId: string): Promise<ServiceResult<CertificateListItem[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable<CertificateListItem[]>();
    const { data, error } = await fromUnknownTable(supabase, 'akademie_certificates')
      .select(CERTIFICATE_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('issued_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const rows = (data ?? []) as unknown as CertificateLiveRow[];
    return { ok: true, data: rows.map(mapCertificateRowToListItem) };
  },

  async getCertificateDetailMapped(
    tenantId: string,
    certificateId: string,
  ): Promise<ServiceResult<CertificateDetail>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable<CertificateDetail>();
    const { data, error } = await fromUnknownTable(supabase, 'akademie_certificates')
      .select(CERTIFICATE_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', certificateId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Zertifikat nicht gefunden.' };
    return {
      ok: true,
      data: mapCertificateRowToDetail(data as unknown as CertificateLiveRow),
    };
  },
};
