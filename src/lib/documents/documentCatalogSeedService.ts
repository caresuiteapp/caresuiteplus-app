import type { ServiceResult } from '@/types';
import { SYSTEM_DOCUMENT_CATALOG_TEMPLATES } from '@/data/seeds/documentCatalog';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { writeDocumentAuditLog } from './repository/documentAuditRepository.supabase';

/** Idempotent: legt alle 179 Systemvorlagen in document_templates an (tenant_id NULL). */
export async function syncSystemDocumentCatalogToDatabase(
  actorUserId?: string | null,
): Promise<ServiceResult<{ inserted: number; skipped: number }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data: existing, error: listError } = await fromUnknownTable(supabase, 'document_templates')
    .select('template_key')
    .is('tenant_id', null)
    .eq('is_system_template', true);

  if (listError) {
    if (isMissingTableError(listError)) return { ok: false, error: 'Dokumenten-Tabellen fehlen — Migration 0168 anwenden.' };
    return { ok: false, error: toGermanSupabaseError(listError) };
  }

  const existingKeys = new Set((existing ?? []).map((r) => String((r as { template_key: string }).template_key)));
  let inserted = 0;
  let skipped = 0;

  for (const tpl of SYSTEM_DOCUMENT_CATALOG_TEMPLATES) {
    if (existingKeys.has(tpl.templateKey)) {
      skipped += 1;
      continue;
    }

    const { data: templateRow, error: insertError } = await fromUnknownTable(supabase, 'document_templates')
      .insert({
        tenant_id: null,
        template_key: tpl.templateKey,
        template_type: tpl.templateType,
        label: tpl.name,
        template_name: tpl.name,
        short_name: tpl.shortName,
        description: tpl.description,
        module_scope: tpl.moduleScope,
        template_number: tpl.templateNumber,
        category: tpl.category,
        layout_kind: tpl.layoutKind,
        document_category: tpl.category,
        template_status: 'active',
        is_system_template: true,
        is_tenant_template: false,
        is_imported_template: false,
        is_active: true,
        is_fillable: true,
        is_pdf_enabled: true,
        is_email_enabled: true,
        is_fax_enabled: true,
        is_assist_allowed: tpl.isAssistAllowed,
        is_medical_or_treatment_related: tpl.isMedicalOrTreatmentRelated,
        is_care_related: tpl.isCareRelated ?? false,
        target_record_type: tpl.targetRecordType,
        default_storage_area: tpl.defaultStorageArea,
        default_file_name_pattern: '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
        content_json: { layoutFamily: tpl.layoutFamily ?? 'generic_form' },
        mapping_schema_json: { complete: true },
        version: 1,
      })
      .select('id')
      .single();

    if (insertError || !templateRow) {
      return { ok: false, error: toGermanSupabaseError(insertError ?? { message: 'Insert fehlgeschlagen' }) };
    }

    const templateId = String((templateRow as { id: string }).id);
    const { data: versionRow, error: versionError } = await fromUnknownTable(
      supabase,
      'document_template_versions',
    )
      .insert({
        tenant_id: (await resolveSeedTenantId(supabase)) ?? '00000000-0000-4000-8000-000000000001',
        template_id: templateId,
        version_number: 1,
        html_template: tpl.htmlTemplate,
        css_template: tpl.cssTemplate,
        required_fields: tpl.manualFields ?? [],
        version_status: 'active',
        layout_settings: { layoutFamily: tpl.layoutFamily ?? 'generic_form' },
      })
      .select('id')
      .single();

    if (versionError) {
      return { ok: false, error: toGermanSupabaseError(versionError) };
    }

    await fromUnknownTable(supabase, 'document_templates')
      .update({ current_version_id: (versionRow as { id: string }).id })
      .eq('id', templateId);

    await writeDocumentAuditLog({
      tenantId: null,
      action: 'template_created',
      entityType: 'document_template',
      entityId: templateId,
      actorUserId: actorUserId ?? null,
      newValue: { templateKey: tpl.templateKey, source: 'catalog_seed' },
    });

    inserted += 1;
    existingKeys.add(tpl.templateKey);
  }

  return { ok: true, data: { inserted, skipped } };
}

async function resolveSeedTenantId(supabase: NonNullable<ReturnType<typeof getSupabaseClient>>): Promise<string | null> {
  const { data } = await fromUnknownTable(supabase, 'tenants').select('id').limit(1).maybeSingle();
  return data ? String((data as { id: string }).id) : null;
}
