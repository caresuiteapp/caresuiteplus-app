import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import {
  buildIntakePlaceholderContext,
} from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { renderIntakeDocumentHtml } from '@/features/intakeDocuments/renderIntakeDocumentPreview';
import { listTenantIntakeDocumentTemplates } from '@/features/intakeDocuments/intakeDocumentRepository';

const CARE_LEVEL_DOCUMENT_TYPES = new Set(['client_contract', 'assignment_declaration']);

/**
 * Re-renders care-level dependent documents after a master-data change.
 *
 * Signed/finalized evidence is immutable. For it, a versioned successor is
 * generated automatically and released to the record/portal for confirmation.
 * Unsigned previews are refreshed in place.
 */
export async function syncCareLevelDependentDocuments(input: {
  tenantId: string;
  clientId: string;
  previousCareLevel: string | null;
  form: ClientIntakeFormData;
  actorProfileId?: string | null;
}): Promise<ServiceResult<{ refreshed: number; successors: number }>> {
  const nextCareLevel = input.form.careLevel.trim() || null;
  if ((input.previousCareLevel ?? '') === (nextCareLevel ?? '')) {
    return { ok: true, data: { refreshed: 0, successors: 0 } };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const templatesResult = await listTenantIntakeDocumentTemplates(input.tenantId);
  if (!templatesResult.ok) return templatesResult;
  const templates = new Map(templatesResult.data.map((template) => [template.templateKey, template]));

  const { data: rows, error: rowsError } = await fromUnknownTable(supabase, 'client_intake_documents')
    .select('id, template_key, document_type, title, status, version, finalized_html')
    .eq('tenant_id', input.tenantId)
    .eq('client_id', input.clientId);
  if (rowsError) return { ok: false, error: toGermanSupabaseError(rowsError) };

  const documents = ((rows ?? []) as Record<string, unknown>[]).filter((row) =>
    CARE_LEVEL_DOCUMENT_TYPES.has(String(row.document_type ?? '')),
  );
  if (documents.length === 0) {
    return { ok: true, data: { refreshed: 0, successors: 0 } };
  }

  const documentIds = documents.map((row) => String(row.id));
  const { data: signatures, error: signatureError } = await fromUnknownTable(
    supabase,
    'client_document_signatures',
  )
    .select('document_id')
    .eq('tenant_id', input.tenantId)
    .in('document_id', documentIds);
  if (signatureError) return { ok: false, error: toGermanSupabaseError(signatureError) };
  const signedIds = new Set(
    ((signatures ?? []) as Record<string, unknown>[]).map((row) => String(row.document_id)),
  );

  let refreshed = 0;
  let successors = 0;
  const context = buildIntakePlaceholderContext(input.form);
  const changedAt = new Date().toISOString();

  for (const row of documents) {
    const templateKey = String(row.template_key ?? '');
    const template = templates.get(templateKey);
    if (!template) continue;
    const rendered = renderIntakeDocumentHtml(template, context, {});
    const documentId = String(row.id);
    const immutable =
      signedIds.has(documentId)
      || row.status === 'finalized'
      || row.status === 'signed'
      || Boolean(row.finalized_html);

    if (!immutable) {
      const { error } = await fromUnknownTable(supabase, 'client_intake_documents')
        .update({
          preview_html: rendered.html,
          missing_placeholders: rendered.missingPlaceholders,
          status: 'preview_open',
          version: Number(row.version ?? 1) + 1,
          preview_opened_at: changedAt,
          updated_by: input.actorProfileId ?? null,
        })
        .eq('tenant_id', input.tenantId)
        .eq('id', documentId);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
      refreshed += 1;
      continue;
    }

    const suffix = changedAt.replace(/\D/g, '');
    const successorKey = `${templateKey}__pflegegrad_${suffix}`;
    const successorTitle = `${String(row.title ?? template.title)} – aktualisierter Pflegegrad`;
    const { data: successor, error: successorError } = await fromUnknownTable(
      supabase,
      'client_intake_documents',
    )
      .insert({
        tenant_id: input.tenantId,
        client_id: input.clientId,
        template_key: successorKey,
        document_type: row.document_type,
        title: successorTitle,
        status: 'pending_signature',
        is_required: true,
        version: Number(row.version ?? 1) + 1,
        source: template.source,
        tenant_template_id: template.tenantTemplateId ?? null,
        preview_html: rendered.html,
        missing_placeholders: rendered.missingPlaceholders,
        preview_opened_at: changedAt,
        updated_by: input.actorProfileId ?? null,
      })
      .select('id')
      .single();
    if (successorError || !successor) {
      return { ok: false, error: toGermanSupabaseError(successorError) };
    }

    const successorId = String((successor as Record<string, unknown>).id);
    const { error: canonicalError } = await fromUnknownTable(supabase, 'client_documents').insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      title: successorTitle,
      file_name: `${successorKey}.html`,
      mime_type: 'text/html',
      category: 'vertrag',
      status: 'in_bearbeitung',
      sensitivity: 'care',
      source: 'intake',
      intake_document_id: successorId,
      portal_visible: true,
      uploaded_by: input.actorProfileId ?? null,
    });
    if (canonicalError) return { ok: false, error: toGermanSupabaseError(canonicalError) };

    await fromUnknownTable(supabase, 'client_document_events').insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      document_id: successorId,
      event_type: 'care_level_successor_generated',
      summary:
        `Pflegegrad von ${input.previousCareLevel ?? 'ohne Angabe'} `
        + `auf ${nextCareLevel ?? 'ohne Angabe'} geändert; neue Dokumentversion erzeugt.`,
      metadata_json: {
        previousCareLevel: input.previousCareLevel,
        nextCareLevel,
        replacedDocumentId: documentId,
      },
      actor_profile_id: input.actorProfileId ?? null,
    });
    successors += 1;
  }

  return { ok: true, data: { refreshed, successors } };
}
