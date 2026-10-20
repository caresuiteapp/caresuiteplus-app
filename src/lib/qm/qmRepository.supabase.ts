import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  CHAPTER_LIVE_SELECT_COLUMNS,
  mapChapterRowToDetail,
  mapChapterRowsToList,
  type QmChapterLiveRow,
} from './qmChapterMapper';
import {
  DOCUMENT_LIVE_SELECT_COLUMNS,
  mapDocumentRowToDetail,
  mapDocumentRowsToList,
  mapVersionRowsToList,
  VERSION_LIVE_SELECT_COLUMNS,
  type QmDocumentLiveRow,
  type QmDocumentVersionLiveRow,
} from './qmDocumentMapper';
import {
  mapReadConfirmationRowsToList,
  READ_CONFIRMATION_LIVE_SELECT_COLUMNS,
  type QmReadConfirmationLiveRow,
} from './qmReadConfirmationMapper';
import {
  HANDBOOK_LIVE_SELECT_COLUMNS,
  mapHandbookRowToDetail,
  type QmHandbookLiveRow,
} from './qmHandbookMapper';
import type { QmDocument, QmDocumentVersion, QmHandbook, QmHandbookChapter, QmReadConfirmation } from './qm.types';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export const qmSupabaseRepository = {
  async listChaptersMapped(tenantId: string): Promise<ServiceResult<QmHandbookChapter[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'qm_handbook_chapters')
      .select(CHAPTER_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('sort_order');
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return mapChapterRowsToList((data ?? []) as unknown as QmChapterLiveRow[]);
  },

  async getChapterMapped(
    tenantId: string,
    chapterId: string,
  ): Promise<ServiceResult<QmHandbookChapter>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'qm_handbook_chapters')
      .select(CHAPTER_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', chapterId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return mapChapterRowToDetail((data as QmChapterLiveRow | null) ?? null);
  },

  async getHandbookMapped(tenantId: string): Promise<ServiceResult<QmHandbook>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'qm_handbooks')
      .select(HANDBOOK_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return mapHandbookRowToDetail((data as QmHandbookLiveRow | null) ?? null);
  },

  async listDocumentsMapped(tenantId: string): Promise<ServiceResult<QmDocument[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'qm_documents')
      .select(DOCUMENT_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('document_number');
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return mapDocumentRowsToList((data ?? []) as unknown as QmDocumentLiveRow[]);
  },

  async getDocumentMapped(
    tenantId: string,
    documentId: string,
  ): Promise<ServiceResult<QmDocument>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'qm_documents')
      .select(DOCUMENT_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', documentId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return mapDocumentRowToDetail((data as QmDocumentLiveRow | null) ?? null);
  },

  async listDocumentVersionsMapped(
    tenantId: string,
    documentId: string,
  ): Promise<ServiceResult<QmDocumentVersion[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'qm_document_versions')
      .select(VERSION_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return mapVersionRowsToList((data ?? []) as unknown as QmDocumentVersionLiveRow[]);
  },

  async listReadConfirmationsMapped(
    tenantId: string,
    documentId: string,
  ): Promise<ServiceResult<QmReadConfirmation[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'qm_read_confirmations')
      .select(READ_CONFIRMATION_LIVE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('document_id', documentId)
      .order('confirmed_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return mapReadConfirmationRowsToList((data ?? []) as unknown as QmReadConfirmationLiveRow[]);
  },

  async listMdPackages(tenantId: string): Promise<ServiceResult<unknown[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'md_audit_packages')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: data ?? [] };
  },
};
