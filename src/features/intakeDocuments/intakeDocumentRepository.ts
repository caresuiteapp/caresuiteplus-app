import type { PostgrestError } from '@supabase/supabase-js';
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSystemIntakeTemplateByKey, INTAKE_DOCUMENT_SYSTEM_TEMPLATES } from './intakeDocumentSystemTemplates';
import type { IntakeDocumentTemplate } from './intakeDocumentTypes';

type SystemTemplateRow = {
  id: string;
  template_key: string;
  title: string;
  document_type: string;
  service_type: string | null;
  version: number;
  is_required: boolean;
  is_active: boolean;
  requires_client_signature: boolean;
  requires_employee_signature: boolean;
  requires_representative_signature: boolean;
  allows_custom_template: boolean;
  html_content: string;
  plain_text_content: string;
  placeholder_schema: Record<string, { label: string; required?: boolean }> | null;
  signature_slots: { role: string; placeholder: string; required: boolean }[] | null;
};

type TenantTemplateRow = {
  id: string;
  tenant_id: string;
  system_template_id: string | null;
  template_key: string;
  title: string | null;
  document_type: string;
  service_type: string | null;
  html_content: string | null;
  is_default: boolean;
  is_active: boolean;
};

type IntakeDbClient = {
  from: (table: string) => {
    select: (query?: string) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => Promise<{ data: unknown; error: PostgrestError | null }>;
      } & Promise<{ data: unknown; error: PostgrestError | null }>;
    };
    upsert: (
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ) => {
      select: (query?: string) => {
        single: () => Promise<{ data: { id: string } | null; error: PostgrestError | null }>;
      };
    };
    insert: (values: Record<string, unknown>) => Promise<{ error: PostgrestError | null }>;
  };
};

function getDb(): IntakeDbClient | null {
  const client = getSupabaseClient();
  if (!client) return null;
  return client as unknown as IntakeDbClient;
}

function unavailable(): ServiceResult<never> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapSystemRow(row: SystemTemplateRow): IntakeDocumentTemplate {
  return {
    id: row.id,
    templateKey: row.template_key,
    title: row.title,
    documentType: row.document_type as IntakeDocumentTemplate['documentType'],
    serviceType: row.service_type,
    version: row.version,
    isSystemTemplate: true,
    isRequired: row.is_required,
    isActive: row.is_active,
    requiresClientSignature: row.requires_client_signature,
    requiresEmployeeSignature: row.requires_employee_signature,
    requiresRepresentativeSignature: row.requires_representative_signature,
    allowsCustomTemplate: row.allows_custom_template,
    htmlContent: row.html_content,
    plainTextContent: row.plain_text_content,
    placeholderSchema: row.placeholder_schema ?? {},
    signatureSlots: (row.signature_slots ?? []).map((s) => ({
      role: s.role as IntakeDocumentTemplate['signatureSlots'][number]['role'],
      placeholder: s.placeholder,
      required: s.required,
    })),
    source: 'system',
  };
}

function mapTenantRow(row: TenantTemplateRow, system?: IntakeDocumentTemplate): IntakeDocumentTemplate | null {
  const base = system ?? getSystemIntakeTemplateByKey(row.template_key);
  if (!base) return null;

  return {
    ...base,
    id: row.id,
    title: row.title ?? base.title,
    serviceType: row.service_type ?? base.serviceType,
    htmlContent: row.html_content ?? base.htmlContent,
    source: 'tenant',
    tenantTemplateId: row.id,
    isActive: row.is_active,
  };
}

export async function listTenantIntakeDocumentTemplates(
  tenantId: string,
): Promise<ServiceResult<IntakeDocumentTemplate[]>> {
  const db = getDb();
  if (!db) return unavailable();

  const systemQuery = db.from('intake_document_system_templates').select('*').eq('is_active', true);
  const { data: systemRows, error: systemError } = await systemQuery;

  if (systemError) {
    return { ok: false, error: toGermanSupabaseError(systemError) };
  }

  const systemTemplates = (systemRows as SystemTemplateRow[] | null)?.map(mapSystemRow)
    ?? INTAKE_DOCUMENT_SYSTEM_TEMPLATES;

  const { data: tenantRows, error: tenantError } = await db
    .from('tenant_document_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (tenantError) {
    return { ok: false, error: toGermanSupabaseError(tenantError) };
  }

  const systemByKey = new Map(systemTemplates.map((t) => [t.templateKey, t]));
  const merged = new Map<string, IntakeDocumentTemplate>(systemByKey);

  for (const row of (tenantRows as TenantTemplateRow[] | null) ?? []) {
    const mapped = mapTenantRow(row, systemByKey.get(row.template_key));
    if (mapped) merged.set(row.template_key, mapped);
  }

  return { ok: true, data: [...merged.values()] };
}

export async function persistIntakeDocumentsForClient(
  tenantId: string,
  clientId: string,
  form: ClientIntakeFormData,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  const db = getDb();
  if (!db) return unavailable();

  const contractType = form.intakeContractType ?? null;

  if (contractType) {
    const { error: selectionError } = await db.from('client_contract_selection').upsert(
      {
        tenant_id: tenantId,
        client_id: clientId,
        contract_type: contractType,
        selected_template_key: form.intakeDocuments.find((d) => d.documentType === 'client_contract')?.templateKey ?? null,
        updated_by: actorProfileId ?? null,
      },
      { onConflict: 'tenant_id,client_id' },
    ).select('id').single();
    if (selectionError) {
      return { ok: false, error: toGermanSupabaseError(selectionError) };
    }
  }

  for (const doc of form.intakeDocuments) {
    const { data: inserted, error: docError } = await db
      .from('client_intake_documents')
      .upsert(
        {
          tenant_id: tenantId,
          client_id: clientId,
          template_key: doc.templateKey,
          document_type: doc.documentType,
          title: doc.title,
          status: doc.status,
          is_required: doc.isRequired,
          version: doc.version,
          source: doc.source,
          tenant_template_id: doc.tenantTemplateId,
          preview_html: doc.previewHtml,
          finalized_html: doc.finalizedHtml,
          rendered_pdf_path: doc.renderedPdfPath,
          missing_placeholders: doc.missingPlaceholders,
          preview_opened_at: doc.previewOpenedAt,
          finalized_at: doc.finalizedAt,
          updated_by: actorProfileId ?? null,
        },
        { onConflict: 'tenant_id,client_id,template_key' },
      )
      .select('id')
      .single();

    if (docError || !inserted) {
      return { ok: false, error: toGermanSupabaseError(docError) };
    }

    await db.from('client_document_events').insert({
      tenant_id: tenantId,
      client_id: clientId,
      document_id: inserted.id,
      event_type: doc.status === 'finalized' ? 'document_finalized' : 'document_updated',
      summary: `${doc.title}: ${doc.status}`,
      actor_profile_id: actorProfileId ?? null,
    });

    for (const [role, signature] of Object.entries(doc.signatures)) {
      if (!signature?.dataUrl) continue;
      const { error: sigError } = await db.from('client_document_signatures').upsert(
        {
          tenant_id: tenantId,
          client_id: clientId,
          document_id: inserted.id,
          signer_role: role,
          signature_data: signature.dataUrl,
          signed_at: signature.signedAt,
          signer_name: signature.signerName ?? null,
        },
        { onConflict: 'document_id,signer_role' },
      ).select('id').single();
      if (sigError) {
        return { ok: false, error: toGermanSupabaseError(sigError) };
      }
    }
  }

  const privacyDoc = form.intakeDocuments.find((d) => d.templateKey === 'privacy_consent_default');
  const contractDoc = form.intakeDocuments.find((d) => d.documentType === 'client_contract');

  const { error: consentError } = await db.from('client_consent_status').upsert(
    {
      tenant_id: tenantId,
      client_id: clientId,
      privacy_status: privacyDoc?.status ?? 'not_started',
      contract_status: contractDoc?.status ?? 'not_started',
      assignment_status: form.intakeAssignmentEnabled
        ? form.intakeDocuments.find((d) => d.templateKey === 'assignment_declaration_care_health_insurance')?.status ?? 'not_started'
        : 'skipped_optional',
      privacy_finalized_at: privacyDoc?.finalizedAt ?? null,
      contract_finalized_at: contractDoc?.finalizedAt ?? null,
      updated_by: actorProfileId ?? null,
    },
    { onConflict: 'tenant_id,client_id' },
  ).select('id').single();

  if (consentError) {
    return { ok: false, error: toGermanSupabaseError(consentError) };
  }

  return { ok: true, data: undefined };
}
