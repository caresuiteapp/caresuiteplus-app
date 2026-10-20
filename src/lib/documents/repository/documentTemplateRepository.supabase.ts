import type { ServiceResult } from '@/types';
import type {
  DocumentTemplateDetail,
  DocumentTemplateRecord,
  DocumentTemplateVersionInput,
  DocumentTemplateVersionRecord,
} from '@/types/documents/documentTemplate';
import type { DocumentTemplateTypeKey } from '@/features/documents/templateEngine/types';
import type { TemplateRequiredFieldInput } from '@/features/documents/templateEngine/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

export type DocumentTemplateListFilters = {
  moduleScope?: string;
  category?: string;
  includeSystem?: boolean;
  search?: string;
  isAssistAllowed?: boolean;
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function parseRequiredFields(raw: unknown): TemplateRequiredFieldInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      fieldKey: String(item.fieldKey ?? item.field_key ?? ''),
      label: String(item.label ?? ''),
      dataPath: String(item.dataPath ?? item.data_path ?? item.fieldKey ?? ''),
      isRequired: Boolean(item.isRequired ?? item.is_required ?? true),
      errorMessage: item.errorMessage ? String(item.errorMessage) : undefined,
    }))
    .filter((f) => f.fieldKey.length > 0);
}

function mapTemplateRow(row: Record<string, unknown>): DocumentTemplateRecord {
  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : '',
    templateKey: row.template_key ? String(row.template_key) : undefined,
    title: String(row.template_name ?? row.label ?? 'Unbenannte Vorlage'),
    description: row.description ? String(row.description) : null,
    templateType: (row.template_type as DocumentTemplateTypeKey) ?? 'generic',
    templateStatus: (row.template_status as DocumentTemplateRecord['templateStatus']) ?? 'draft',
    currentVersionId: row.current_version_id ? String(row.current_version_id) : null,
    moduleScope: Array.isArray(row.module_scope) ? row.module_scope.map(String) : [],
    category: row.category ? String(row.category) : row.document_category ? String(row.document_category) : null,
    shortName: row.short_name ? String(row.short_name) : null,
    templateNumber: row.template_number != null ? Number(row.template_number) : null,
    isSystemTemplate: Boolean(row.is_system_template),
    isAssistAllowed: Boolean(row.is_assist_allowed),
    isMedicalOrTreatmentRelated: Boolean(row.is_medical_or_treatment_related),
    layoutKind: row.layout_kind ? String(row.layout_kind) : 'premium',
    targetRecordType: row.target_record_type ? String(row.target_record_type) : null,
    defaultStorageArea: row.default_storage_area ? String(row.default_storage_area) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapVersionRow(row: Record<string, unknown>): DocumentTemplateVersionRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    templateId: String(row.template_id),
    versionNumber: Number(row.version_number ?? 1),
    htmlTemplate: String(row.html_template ?? ''),
    cssTemplate: String(row.css_template ?? ''),
    requiredFields: parseRequiredFields(row.required_fields),
    versionStatus: (row.version_status as DocumentTemplateVersionRecord['versionStatus']) ?? 'draft',
    lastPreviewAt: null,
    lastPreviewValid: false,
    activatedAt: row.activated_at ? String(row.activated_at) : null,
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.created_at),
  };
}

function buildDetail(
  template: DocumentTemplateRecord,
  versions: DocumentTemplateVersionRecord[],
): DocumentTemplateDetail {
  return {
    ...template,
    versions,
    activeVersion: versions.find((v) => v.versionStatus === 'active') ?? null,
    draftVersion: versions.find((v) => v.versionStatus === 'draft') ?? versions[0] ?? null,
  };
}

export const documentTemplateSupabaseRepository = {
  async list(
    tenantId: string,
    filters: DocumentTemplateListFilters = {},
  ): Promise<ServiceResult<DocumentTemplateRecord[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'document_templates').select('*');

    if (filters.includeSystem !== false) {
      query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    } else {
      query = query.eq('tenant_id', tenantId);
    }

    if (filters.category) query = query.eq('category', filters.category);
    if (filters.isAssistAllowed === true) {
      query = query.eq('is_assist_allowed', true).eq('is_medical_or_treatment_related', false);
    }

    const { data, error } = await query.order('template_number', { ascending: true }).order('label');
    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    let rows = (data ?? []).map(mapTemplateRow);
    if (filters.moduleScope) {
      rows = rows.filter(
        (t) => t.moduleScope?.includes(filters.moduleScope!) || t.isSystemTemplate,
      );
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter((t) =>
        `${t.title} ${t.description ?? ''} ${t.templateKey ?? ''}`.toLowerCase().includes(q),
      );
    }
    return { ok: true, data: rows };
  },

  async getDetail(tenantId: string, templateId: string): Promise<ServiceResult<DocumentTemplateDetail>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data: templateRow, error: templateError } = await fromUnknownTable(supabase, 'document_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();

    if (templateError) {
      if (isMissingTableError(templateError)) return { ok: false, error: 'Dokumentvorlage nicht gefunden.' };
      return { ok: false, error: toGermanSupabaseError(templateError) };
    }
    if (!templateRow) return { ok: false, error: 'Dokumentvorlage nicht gefunden.' };

    const template = mapTemplateRow(templateRow as Record<string, unknown>);
    if (template.tenantId && template.tenantId !== tenantId && !template.isSystemTemplate) {
      return { ok: false, error: 'Dokumentvorlage nicht gefunden.' };
    }

    const { data: versionRows, error: versionError } = await fromUnknownTable(
      supabase,
      'document_template_versions',
    )
      .select('*')
      .eq('template_id', templateId)
      .order('version_number', { ascending: false });

    if (versionError) {
      if (isMissingTableError(versionError)) {
        return { ok: true, data: buildDetail(template, []) };
      }
      return { ok: false, error: toGermanSupabaseError(versionError) };
    }

    const versions = (versionRows ?? []).map((row) =>
      mapVersionRow(row as Record<string, unknown>),
    );
    return { ok: true, data: buildDetail(template, versions) };
  },

  async updateVersion(
    tenantId: string,
    versionId: string,
    input: DocumentTemplateVersionInput,
  ): Promise<ServiceResult<DocumentTemplateVersionRecord>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'document_template_versions')
      .update({
        html_template: input.htmlTemplate,
        css_template: input.cssTemplate ?? '',
        required_fields: input.requiredFields ?? [],
      })
      .eq('id', versionId)
      .eq('tenant_id', tenantId)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) return { ok: false, error: 'Version nicht gefunden.' };
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    if (!data) return { ok: false, error: 'Version nicht gefunden.' };
    return { ok: true, data: mapVersionRow(data as Record<string, unknown>) };
  },

  async markPreviewResult(
    tenantId: string,
    versionId: string,
    valid: boolean,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await fromUnknownTable(supabase, 'document_template_versions')
      .update({ finalized_at: valid ? new Date().toISOString() : null })
      .eq('id', versionId)
      .eq('tenant_id', tenantId);
  },
};
