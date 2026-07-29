import type { PostgrestError } from '@supabase/supabase-js';
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSystemIntakeTemplateByKey, INTAKE_DOCUMENT_SYSTEM_TEMPLATES } from './intakeDocumentSystemTemplates';
import { resolveOfficeDocumentTitle } from '@/lib/office/officeDocumentDisplay';
import type {
  IntakeDocumentState,
  IntakeDocumentStatus,
  IntakeDocumentTemplate,
  IntakeDocumentType,
  IntakeSignatureRole,
} from './intakeDocumentTypes';

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

type IntakeQueryBuilder = {
  select: (query?: string) => IntakeQueryBuilder;
  eq: (column: string, value: unknown) => IntakeQueryBuilder;
  in: (column: string, values: unknown[]) => IntakeQueryBuilder;
  single: () => Promise<{
    data: Record<string, unknown> | null;
    error: PostgrestError | null;
  }>;
  maybeSingle: () => Promise<{
    data: Record<string, unknown> | null;
    error: PostgrestError | null;
  }>;
} & Promise<{ data: unknown; error: PostgrestError | null }>;

type IntakeDbClient = {
  from: (table: string) => {
    select: (query?: string) => IntakeQueryBuilder;
    upsert: (
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ) => IntakeQueryBuilder;
    insert: (values: Record<string, unknown>) => IntakeQueryBuilder;
    update: (values: Record<string, unknown>) => IntakeQueryBuilder;
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

export async function loadPersistedIntakeDocumentsForClient(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<IntakeDocumentState[]>> {
  const db = getDb();
  if (!db) return unavailable();

  const { data: documentData, error: documentError } = await db
    .from('client_intake_documents')
    .select(
      'id, template_key, document_type, title, status, is_required, version, source, tenant_template_id, preview_html, finalized_html, rendered_pdf_path, missing_placeholders, preview_opened_at, finalized_at',
    )
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);
  if (documentError) {
    return { ok: false, error: toGermanSupabaseError(documentError) };
  }

  const rows = (documentData as {
    id: string;
    template_key: string;
    document_type: string;
    title: string;
    status: string;
    is_required: boolean;
    version: number;
    source: string;
    tenant_template_id: string | null;
    preview_html: string | null;
    finalized_html: string | null;
    rendered_pdf_path: string | null;
    missing_placeholders: unknown;
    preview_opened_at: string | null;
    finalized_at: string | null;
  }[] | null) ?? [];

  if (rows.length === 0) return { ok: true, data: [] };

  const documentIds = rows.map((row) => row.id);
  const { data: signatureData, error: signatureError } = await db
    .from('client_document_signatures')
    .select('document_id, signer_role, signature_data, signed_at, signer_name')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .in('document_id', documentIds);
  if (signatureError) {
    return { ok: false, error: toGermanSupabaseError(signatureError) };
  }

  const signaturesByDocument = new Map<
    string,
    IntakeDocumentState['signatures']
  >();
  for (const row of (signatureData as {
    document_id: string;
    signer_role: string;
    signature_data: string;
    signed_at: string;
    signer_name: string | null;
  }[] | null) ?? []) {
    const role = row.signer_role as IntakeSignatureRole;
    const signatures = signaturesByDocument.get(row.document_id) ?? {};
    signatures[role] = {
      role,
      dataUrl: row.signature_data,
      signedAt: row.signed_at,
      signerName: row.signer_name,
    };
    signaturesByDocument.set(row.document_id, signatures);
  }

  return {
    ok: true,
    data: rows.map((row) => ({
      templateKey: row.template_key,
      documentType: row.document_type as IntakeDocumentType,
      title: row.title,
      isRequired: row.is_required,
      status: row.status as IntakeDocumentStatus,
      source: row.source === 'tenant' ? 'tenant' : 'system',
      tenantTemplateId: row.tenant_template_id,
      version: row.version,
      missingPlaceholders: Array.isArray(row.missing_placeholders)
        ? row.missing_placeholders.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
      unresolvedKeys: [],
      previewHtml: row.preview_html,
      finalizedHtml: row.finalized_html,
      renderedPdfPath: row.rendered_pdf_path,
      signatures: signaturesByDocument.get(row.id) ?? {},
      previewOpenedAt: row.preview_opened_at,
      finalizedAt: row.finalized_at,
    })),
  };
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

  const promoteResult = await promoteFinalizedIntakeDocumentsToClientRecord(
    tenantId,
    clientId,
    form,
    actorProfileId,
  );
  if (!promoteResult.ok) return promoteResult;

  return { ok: true, data: undefined };
}

function mapIntakeDocCategory(documentType: string): string {
  if (documentType === 'privacy_consent' || documentType === 'additional_consent') return 'einwilligung';
  if (documentType === 'client_contract' || documentType === 'assignment_declaration') return 'vertrag';
  return 'sonstige';
}

async function linkOrInsertPromotedIntakeDocument(
  db: NonNullable<ReturnType<typeof getDb>>,
  input: {
    tenantId: string;
    clientId: string;
    intakeDocumentId: string;
    templateKey: string;
    documentType: string;
    title: string;
    intakeStatus: string;
    actorProfileId?: string | null;
  },
): Promise<ServiceResult<void>> {
  const fileName = `${input.templateKey}.html`;
  const clientDocumentStatus =
    input.intakeStatus === 'finalized' ? 'abgeschlossen' : 'bestaetigt';
  const promotedPatch = {
    intake_document_id: input.intakeDocumentId,
    source: 'intake',
    mime_type: 'text/html',
    status: clientDocumentStatus,
    portal_visible: true,
    title: resolveOfficeDocumentTitle({
      title: input.title,
      fileName,
      documentSource: 'intake',
    }),
  };

  const { data: existingByIntake, error: existingByIntakeError } = await db
    .from('client_documents')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('client_id', input.clientId)
    .eq('intake_document_id', input.intakeDocumentId)
    .maybeSingle();
  if (existingByIntakeError) {
    return { ok: false, error: toGermanSupabaseError(existingByIntakeError) };
  }
  if (existingByIntake) {
    const { error: updateError } = await db
      .from('client_documents')
      .update(promotedPatch)
      .eq('id', existingByIntake.id)
      .eq('tenant_id', input.tenantId);
    return updateError
      ? { ok: false, error: toGermanSupabaseError(updateError) }
      : { ok: true, data: undefined };
  }

  const { data: existingByFile, error: existingByFileError } = await db
    .from('client_documents')
    .select('id, intake_document_id, source, mime_type')
    .eq('tenant_id', input.tenantId)
    .eq('client_id', input.clientId)
    .eq('file_name', fileName)
    .maybeSingle();
  if (existingByFileError) {
    return { ok: false, error: toGermanSupabaseError(existingByFileError) };
  }

  if (existingByFile) {
    const { error: linkError } = await db
      .from('client_documents')
      .update(promotedPatch)
      .eq('id', existingByFile.id)
      .eq('tenant_id', input.tenantId);
    if (linkError) {
      return { ok: false, error: toGermanSupabaseError(linkError) };
    }
    return { ok: true, data: undefined };
  }

  const { error } = await db.from('client_documents').insert({
    tenant_id: input.tenantId,
    client_id: input.clientId,
    title: resolveOfficeDocumentTitle({
      title: input.title,
      fileName,
      documentSource: 'intake',
    }),
    file_name: fileName,
    mime_type: 'text/html',
    category: mapIntakeDocCategory(input.documentType),
    status: 'abgeschlossen',
    sensitivity: 'care',
    source: 'intake',
    intake_document_id: input.intakeDocumentId,
    portal_visible: true,
    uploaded_by: input.actorProfileId ?? null,
  });
  if (error && error.code !== '23505') {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: undefined };
}

export async function promoteFinalizedIntakeDocumentsToClientRecord(
  tenantId: string,
  clientId: string,
  form?: ClientIntakeFormData,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  const db = getDb();
  if (!db) return unavailable();

  const finalizedDocs = form?.intakeDocuments.filter((doc) => (
    Boolean(doc.finalizedHtml || doc.previewHtml)
    && (
      doc.status === 'finalized'
      || doc.status === 'signed'
      || (doc.status === 'pending_signature' && Boolean(doc.signatures.client?.dataUrl))
    )
  ))
    ?? [];

  if (form) {
    for (const doc of finalizedDocs) {
      const intakeRowQuery = db.from('client_intake_documents').select('id').eq('tenant_id', tenantId).eq('client_id', clientId).eq('template_key', doc.templateKey);
      const { data: intakeRow } = await intakeRowQuery.single();
      const intakeDocumentId = (intakeRow as { id?: string } | null)?.id ?? null;
      if (!intakeDocumentId) continue;

      const linked = await linkOrInsertPromotedIntakeDocument(db, {
        tenantId,
        clientId,
        intakeDocumentId,
        templateKey: doc.templateKey,
        documentType: doc.documentType,
        title: doc.title,
        intakeStatus: doc.status,
        actorProfileId,
      });
      if (!linked.ok) return linked;
    }
    return { ok: true, data: undefined };
  }

  const { data: intakeRows, error: intakeError } = await db
    .from('client_intake_documents')
    .select('id, template_key, document_type, title, status, finalized_html, preview_html')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .in('status', ['finalized', 'signed', 'pending_signature']);

  if (intakeError) {
    return { ok: false, error: toGermanSupabaseError(intakeError) };
  }

  const rows = (intakeRows as {
    id: string;
    template_key: string;
    document_type: string;
    title: string;
    status: string;
    finalized_html: string | null;
    preview_html: string | null;
  }[] | null) ?? [];

  const pendingIds = rows
    .filter((row) => row.status === 'pending_signature')
    .map((row) => row.id);
  const clientSignedIds = new Set<string>();
  if (pendingIds.length > 0) {
    const { data: signatures, error: signatureError } = await db
      .from('client_document_signatures')
      .select('document_id')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('signer_role', 'client')
      .in('document_id', pendingIds);
    if (signatureError) {
      return { ok: false, error: toGermanSupabaseError(signatureError) };
    }
    for (const signature of (signatures as { document_id: string }[] | null) ?? []) {
      clientSignedIds.add(signature.document_id);
    }
  }

  for (const row of rows) {
    if (row.status === 'pending_signature' && !clientSignedIds.has(row.id)) continue;
    if (!row.finalized_html && !row.preview_html) continue;
    const linked = await linkOrInsertPromotedIntakeDocument(db, {
      tenantId,
      clientId,
      intakeDocumentId: row.id,
      templateKey: row.template_key,
      documentType: row.document_type,
      title: row.title,
      intakeStatus: row.status,
      actorProfileId,
    });
    if (!linked.ok) return linked;
  }

  return { ok: true, data: undefined };
}
