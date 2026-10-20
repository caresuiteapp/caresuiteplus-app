import type { RoleKey, ServiceResult } from '@/types';
import type {
  CsDocumentTemplate,
  CsDocumentTemplateVersion,
  CsTemplateCategory,
  CsTemplatePlaceholder,
  CsTemplateSignatureField,
  CsTemplateWithActiveVersion,
} from '@/types/documents/csTemplateDatabase';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';

function mapCategory(row: Record<string, unknown>): CsTemplateCategory {
  return {
    id: String(row.id),
    categoryKey: String(row.category_key),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    displayOrder: Number(row.display_order ?? 100),
  };
}

function mapPlaceholder(row: Record<string, unknown>): CsTemplatePlaceholder {
  return {
    id: String(row.id),
    placeholderKey: String(row.placeholder_key),
    label: String(row.label),
    entity: String(row.entity),
    description: row.description ? String(row.description) : null,
    example: row.example ? String(row.example) : null,
    requiredContext: Boolean(row.required_context),
    dataType: String(row.data_type ?? 'text'),
    piiLevel: String(row.pii_level ?? 'normal'),
  };
}

function mapTemplate(row: Record<string, unknown>): CsDocumentTemplate {
  return {
    id: String(row.id),
    templateKey: String(row.template_key),
    categoryKey: String(row.category_key),
    title: String(row.title),
    shortDescription: row.short_description ? String(row.short_description) : null,
    documentType: String(row.document_type),
    recipientScope: String(row.recipient_scope) as CsDocumentTemplate['recipientScope'],
    defaultSignatureRequirement: String(
      row.default_signature_requirement,
    ) as CsDocumentTemplate['defaultSignatureRequirement'],
    defaultPriority: String(row.default_priority) as CsDocumentTemplate['defaultPriority'],
    isRequiredBeforeService: Boolean(row.is_required_before_service),
    isSystemTemplate: Boolean(row.is_system_template),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  };
}

function mapVersion(row: Record<string, unknown>): CsDocumentTemplateVersion {
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    versionNo: Number(row.version_no ?? 1),
    status: String(row.status) as CsDocumentTemplateVersion['status'],
    title: String(row.title),
    bodyHtml: String(row.body_html ?? ''),
    legalNotice: row.legal_notice ? String(row.legal_notice) : null,
  };
}

function mapSignatureField(row: Record<string, unknown>): CsTemplateSignatureField {
  return {
    id: String(row.id),
    versionId: String(row.version_id),
    signerRole: String(row.signer_role) as CsTemplateSignatureField['signerRole'],
    label: String(row.label),
    required: Boolean(row.required),
    anchorToken: String(row.anchor_token),
    inputType: String(row.input_type) as CsTemplateSignatureField['inputType'],
    orderIndex: Number(row.order_index ?? 1),
  };
}

export async function fetchCsTemplateCategories(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CsTemplateCategory[]>> {
  const denied = enforcePermission<CsTemplateCategory[]>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: [] };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    const { data, error } = await fromUnknownTable(supabase, 'cs_template_categories')
      .select('id, category_key, name, description, display_order')
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return { ok: true, data: (data ?? []).map((row) => mapCategory(row as Record<string, unknown>)) };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { ok: false, error: 'Vorlagen-Datenbank ist noch nicht migriert (0226).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}

export async function fetchCsTemplatePlaceholders(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CsTemplatePlaceholder[]>> {
  const denied = enforcePermission<CsTemplatePlaceholder[]>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: [] };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    const { data, error } = await fromUnknownTable(supabase, 'cs_template_placeholders')
      .select('id, placeholder_key, label, entity, description, example, required_context, data_type, pii_level')
      .eq('active', true)
      .order('entity', { ascending: true });

    if (error) throw error;
    return { ok: true, data: (data ?? []).map((row) => mapPlaceholder(row as Record<string, unknown>)) };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { ok: false, error: 'Vorlagen-Datenbank ist noch nicht migriert (0226).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}

export async function fetchCsDocumentTemplates(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  filters?: { categoryKey?: string; search?: string },
): Promise<ServiceResult<CsDocumentTemplate[]>> {
  const denied = enforcePermission<CsDocumentTemplate[]>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: [] };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    let query = fromUnknownTable(supabase, 'cs_document_templates')
      .select(
        'id, template_key, category_key, title, short_description, document_type, recipient_scope, default_signature_requirement, default_priority, is_required_before_service, is_system_template, tags',
      )
      .eq('active', true)
      .order('title', { ascending: true });

    if (filters?.categoryKey) {
      query = query.eq('category_key', filters.categoryKey);
    }

    const { data, error } = await query;
    if (error) throw error;

    let rows = (data ?? []).map((row) => mapTemplate(row as Record<string, unknown>));
    if (filters?.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter(
        (t) =>
          t.title.toLowerCase().includes(q)
          || t.templateKey.toLowerCase().includes(q)
          || (t.shortDescription ?? '').toLowerCase().includes(q),
      );
    }

    return { ok: true, data: rows };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { ok: false, error: 'Vorlagen-Datenbank ist noch nicht migriert (0226).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}

export async function fetchCsTemplateWithActiveVersion(
  tenantId: string,
  templateKey: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CsTemplateWithActiveVersion | null>> {
  const denied = enforcePermission<CsTemplateWithActiveVersion | null>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: null };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    const { data: templateRow, error: templateError } = await fromUnknownTable(supabase, 'cs_document_templates')
      .select(
        'id, template_key, category_key, title, short_description, document_type, recipient_scope, default_signature_requirement, default_priority, is_required_before_service, is_system_template, tags',
      )
      .eq('template_key', templateKey)
      .eq('active', true)
      .maybeSingle();

    if (templateError) throw templateError;
    if (!templateRow) {
      return { ok: false, error: `Vorlage „${templateKey}“ wurde nicht gefunden.` };
    }

    const template = mapTemplate(templateRow as Record<string, unknown>);

    const { data: versionRow, error: versionError } = await fromUnknownTable(
      supabase,
      'cs_document_template_versions',
    )
      .select('id, template_id, version_no, status, title, body_html, legal_notice')
      .eq('template_id', template.id)
      .eq('status', 'active')
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) throw versionError;
    if (!versionRow) {
      return { ok: false, error: 'Keine aktive Version für diese Vorlage vorhanden.' };
    }

    const activeVersion = mapVersion(versionRow as Record<string, unknown>);

    const { data: sigRows, error: sigError } = await fromUnknownTable(supabase, 'cs_template_signature_fields')
      .select('id, version_id, signer_role, label, required, anchor_token, input_type, order_index')
      .eq('version_id', activeVersion.id)
      .order('order_index', { ascending: true });

    if (sigError) throw sigError;

    const { data: deliveryRow } = await fromUnknownTable(supabase, 'cs_template_delivery_defaults')
      .select('due_in_days')
      .eq('template_id', template.id)
      .maybeSingle();

    return {
      ok: true,
      data: {
        ...template,
        activeVersion,
        signatureFields: (sigRows ?? []).map((row) => mapSignatureField(row as Record<string, unknown>)),
        dueInDays: Number((deliveryRow as Record<string, unknown> | null)?.due_in_days ?? 7),
      },
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { ok: false, error: 'Vorlagen-Datenbank ist noch nicht migriert (0226).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}
