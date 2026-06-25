import type { RoleKey, ServiceResult } from '@/types';
import type {
  CreateGeneratedDocumentInput,
  DocumentEngineAuditEntry,
  DocumentEngineBinding,
  DocumentEngineDashboardStats,
  DocumentEngineTemplateListItem,
  FinalizeGeneratedDocumentInput,
  GeneratedDocumentRecord,
} from '@/types/documents/documentEngine';
import { SYSTEM_DOCUMENT_CATALOG_TEMPLATES } from '@/data/seeds/documentCatalog';
import { buildGeneratedDocumentFileName } from '@/lib/documents/documentFileNameService';
import { syncSystemDocumentCatalogToDatabase } from '@/lib/documents/documentCatalogSeedService';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { enforcePermission } from '@/lib/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { writeDocumentAuditLog, listDocumentAuditLog } from './repository/documentAuditRepository.supabase';
import { archiveGeneratedDocumentToClientRecord } from './documentArchiveService';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { renderHtmlToPdfBytes } from './documentPdfService';

function assertDocumentEngineView<T>(actorRoleKey?: RoleKey | null): ServiceResult<T> | null {
  const deniedSettings = enforcePermission<T>(actorRoleKey, 'settings.templates.view');
  if (!deniedSettings) return null;
  const deniedOffice = enforcePermission<T>(actorRoleKey, 'office.catalogs.view');
  if (!deniedOffice) return null;
  return deniedSettings;
}

function assertDocumentCreate<T>(actorRoleKey?: RoleKey | null): ServiceResult<T> | null {
  const denied = enforcePermission<T>(actorRoleKey, 'documents.create');
  if (!denied) return null;
  return denied;
}

const DEMO_GENERATED = new Map<string, GeneratedDocumentRecord>();
const DEMO_BINDINGS = new Map<string, DocumentEngineBinding[]>();

function catalogToListItem(
  tpl: (typeof SYSTEM_DOCUMENT_CATALOG_TEMPLATES)[number],
  id?: string,
): DocumentEngineTemplateListItem {
  return {
    id: id ?? `catalog-${tpl.templateKey}`,
    tenantId: null,
    templateNumber: tpl.templateNumber,
    templateKey: tpl.templateKey,
    name: tpl.name,
    shortName: tpl.shortName,
    category: tpl.category,
    moduleScope: tpl.moduleScope,
    targetRecordType: tpl.targetRecordType,
    defaultStorageArea: tpl.defaultStorageArea,
    templateType: tpl.templateType as DocumentEngineTemplateListItem['templateType'],
    templateStatus: 'active',
    scope: 'system',
    layoutKind: tpl.layoutKind,
    layoutFamily: tpl.layoutFamily,
    isAssistAllowed: tpl.isAssistAllowed,
    isMedicalOrTreatmentRelated: tpl.isMedicalOrTreatmentRelated,
    isFillable: true,
    isPdfEnabled: true,
    isEmailEnabled: true,
    isFaxEnabled: true,
    isSignatureRequired: tpl.templateKey.includes('abtretung') || tpl.templateKey.includes('vertrag'),
    version: 1,
    updatedAt: new Date().toISOString(),
    mappingComplete: true,
    bindingCount: 0,
  };
}

function mapDbTemplate(row: Record<string, unknown>): DocumentEngineTemplateListItem {
  const content = (row.content_json as Record<string, unknown> | null) ?? {};
  const mapping = (row.mapping_schema_json as Record<string, unknown> | null) ?? {};
  return {
    id: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    templateNumber: row.template_number != null ? Number(row.template_number) : null,
    templateKey: String(row.template_key ?? ''),
    name: String(row.template_name ?? row.label ?? ''),
    shortName: row.short_name ? String(row.short_name) : null,
    category: row.category ? String(row.category) : null,
    moduleScope: Array.isArray(row.module_scope) ? row.module_scope.map(String) : [],
    targetRecordType: row.target_record_type ? String(row.target_record_type) : null,
    defaultStorageArea: row.default_storage_area ? String(row.default_storage_area) : null,
    templateType: String(row.template_type) as DocumentEngineTemplateListItem['templateType'],
    templateStatus: String(row.template_status ?? 'draft'),
    scope: row.is_imported_template
      ? 'imported'
      : row.is_system_template
        ? 'system'
        : 'tenant',
    layoutKind: String(row.layout_kind ?? 'premium'),
    layoutFamily: (content.layoutFamily as DocumentEngineTemplateListItem['layoutFamily']) ?? 'generic_form',
    isAssistAllowed: Boolean(row.is_assist_allowed),
    isMedicalOrTreatmentRelated: Boolean(row.is_medical_or_treatment_related),
    isFillable: Boolean(row.is_fillable ?? true),
    isPdfEnabled: Boolean(row.is_pdf_enabled ?? true),
    isEmailEnabled: Boolean(row.is_email_enabled ?? true),
    isFaxEnabled: Boolean(row.is_fax_enabled ?? true),
    isSignatureRequired: Boolean(row.is_signature_required),
    version: Number(row.version ?? 1),
    updatedAt: String(row.updated_at),
    mappingComplete: mapping.complete !== false,
    bindingCount: 0,
  };
}

function computeStatsFromList(items: DocumentEngineTemplateListItem[]): DocumentEngineDashboardStats {
  const today = new Date().toISOString().slice(0, 10);
  const generatedToday = [...DEMO_GENERATED.values()].filter((d) => d.createdAt.startsWith(today)).length;
  return {
    totalTemplates: items.length,
    activeTemplates: items.filter((t) => t.templateStatus === 'active').length,
    systemTemplates: items.filter((t) => t.scope === 'system').length,
    tenantTemplates: items.filter((t) => t.scope === 'tenant').length,
    importedTemplates: items.filter((t) => t.scope === 'imported').length,
    assistTemplates: items.filter((t) => t.moduleScope.includes('assist')).length,
    officeTemplates: items.filter((t) => t.moduleScope.includes('office')).length,
    pflegeTemplates: items.filter((t) => t.moduleScope.includes('pflege')).length,
    beratungTemplates: items.filter((t) => t.moduleScope.includes('beratung')).length,
    stationaerTemplates: items.filter((t) => t.moduleScope.includes('stationaer')).length,
    akademieTemplates: items.filter((t) => t.moduleScope.includes('akademie')).length,
    pdfEnabledTemplates: items.filter((t) => t.isPdfEnabled).length,
    emailEnabledTemplates: items.filter((t) => t.isEmailEnabled).length,
    faxEnabledTemplates: items.filter((t) => t.isFaxEnabled).length,
    signatureRequiredTemplates: items.filter((t) => t.isSignatureRequired).length,
    mappingIncompleteTemplates: items.filter((t) => !t.mappingComplete).length,
    pendingApprovalTemplates: items.filter((t) => t.templateStatus === 'draft').length,
    documentsCreatedToday: generatedToday,
    openSignatures: [...DEMO_GENERATED.values()].filter((d) => d.signatureStatus === 'pending').length,
    failedSendCount: [...DEMO_GENERATED.values()].filter(
      (d) => d.emailStatus === 'failed' || d.faxStatus === 'failed',
    ).length,
  };
}

export type DocumentEngineListFilters = {
  tab?: string;
  search?: string;
  moduleScope?: string;
  assistOnly?: boolean;
  category?: string;
};

function filterByTab(items: DocumentEngineTemplateListItem[], tab?: string): DocumentEngineTemplateListItem[] {
  if (!tab || tab === 'all' || tab === 'overview') return items;
  const map: Record<string, (t: DocumentEngineTemplateListItem) => boolean> = {
    system: (t) => t.scope === 'system',
    tenant: (t) => t.scope === 'tenant',
    imported: (t) => t.scope === 'imported',
    module: (t) => t.moduleScope.length > 0,
    client: (t) => t.category === 'klient' || t.targetRecordType === 'client_record',
    employee: (t) => t.category === 'mitarbeiter' || t.targetRecordType?.includes('employee') === true,
    contract: (t) => t.category === 'vertrag',
    service_proof: (t) => t.category === 'leistungsnachweis' || t.layoutFamily === 'service_proof',
    documentation: (t) => t.templateType === 'care_documentation' || t.category === 'dokumentation',
    pflege: (t) => t.moduleScope.includes('pflege'),
    assist: (t) => t.moduleScope.includes('assist') && t.isAssistAllowed,
    beratung: (t) => t.moduleScope.includes('beratung'),
    stationaer: (t) => t.moduleScope.includes('stationaer'),
    akademie: (t) => t.moduleScope.includes('akademie'),
    shift: (t) => t.layoutFamily === 'shift_plan' || t.category === 'dienstplan',
    billing: (t) => t.category === 'rechnung' || t.layoutFamily === 'invoice' || t.layoutFamily === 'dunning',
    vehicle: (t) => t.layoutFamily === 'vehicle_log' || t.category === 'fahrzeug',
  };
  const fn = map[tab];
  return fn ? items.filter(fn) : items;
}

export async function ensureDocumentCatalogSeeded(): Promise<ServiceResult<{ inserted: number }>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { inserted: 0 } };
  }
  const result = await syncSystemDocumentCatalogToDatabase();
  if (!result.ok) return result;
  return { ok: true, data: { inserted: result.data.inserted } };
}

export async function loadDocumentEngineDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentEngineDashboardStats>> {
  const denied = assertDocumentEngineView<DocumentEngineDashboardStats>(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const list = await loadDocumentEngineTemplates(tenantId, {}, actorRoleKey);
  if (!list.ok) return list;
  return { ok: true, data: computeStatsFromList(list.data) };
}

export async function loadDocumentEngineTemplates(
  tenantId: string,
  filters: DocumentEngineListFilters = {},
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentEngineTemplateListItem[]>> {
  const denied = assertDocumentEngineView<DocumentEngineTemplateListItem[]>(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    await ensureDocumentCatalogSeeded();
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    const { data, error } = await fromUnknownTable(supabase, 'document_templates')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order('template_number', { ascending: true });

    if (error) {
      if (isMissingTableError(error)) {
        return {
          ok: true,
          data: filterByTab(
            SYSTEM_DOCUMENT_CATALOG_TEMPLATES.map((t) => catalogToListItem(t)),
            filters.tab,
          ),
        };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    let items = (data ?? []).map((row) => mapDbTemplate(row as Record<string, unknown>));
    if (items.length === 0) {
      items = SYSTEM_DOCUMENT_CATALOG_TEMPLATES.map((t) => catalogToListItem(t));
    }
    items = applyListFilters(items, filters);
    return { ok: true, data: filterByTab(items, filters.tab) };
  }

  let items = SYSTEM_DOCUMENT_CATALOG_TEMPLATES.map((t) => catalogToListItem(t));
  items = applyListFilters(items, filters);
  return { ok: true, data: filterByTab(items, filters.tab) };
}

function applyListFilters(
  items: DocumentEngineTemplateListItem[],
  filters: DocumentEngineListFilters,
): DocumentEngineTemplateListItem[] {
  let rows = items;
  if (filters.moduleScope) {
    rows = rows.filter((t) => t.moduleScope.includes(filters.moduleScope!));
  }
  if (filters.assistOnly) {
    rows = rows.filter((t) => t.isAssistAllowed && !t.isMedicalOrTreatmentRelated);
  }
  if (filters.category) {
    rows = rows.filter((t) => t.category === filters.category);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((t) =>
      `${t.name} ${t.templateKey} ${t.category ?? ''}`.toLowerCase().includes(q),
    );
  }
  return rows;
}

export async function loadTemplatesForModuleContext(input: {
  tenantId: string;
  targetModule: string;
  targetArea: string;
  triggerEvent?: string;
  assistOnly?: boolean;
  actorRoleKey?: RoleKey | null;
}): Promise<ServiceResult<DocumentEngineTemplateListItem[]>> {
  const bindings = await loadDocumentEngineBindings(input.tenantId, input.actorRoleKey);
  const boundTemplateIds = new Set(
    bindings.ok
      ? bindings.data
          .filter(
            (b) =>
              b.isActive &&
              b.targetModule === input.targetModule &&
              b.targetArea === input.targetArea &&
              (!input.triggerEvent || b.triggerEvent === input.triggerEvent),
          )
          .map((b) => b.templateId)
      : [],
  );

  const templates = await loadDocumentEngineTemplates(
    input.tenantId,
    { moduleScope: input.targetModule, assistOnly: input.assistOnly },
    input.actorRoleKey,
  );
  if (!templates.ok) return templates;

  const defaultKeysByArea: Record<string, string[]> = {
    'assist.intake': [
      'stammblatt',
      'interessent_anfrage',
      'abtretung_45b',
      'notfallblatt',
      'kommunikationsnachweis',
      'betreuungswunsch',
    ],
    'assist.assignment': [
      'leistungsnachweis',
      'zeitprotokoll',
      'kommunikationsnachweis',
      'klient_nicht_angetroffen',
      'einsatzabbruch',
    ],
    'assist.visit_complete': ['leistungsnachweis'],
    'office.hr': ['personalstammdaten', 'urlaubsantrag', 'stundenzettel'],
    'office.billing': ['rechnung', 'mahnung', 'leistungsnachweis', 'abtretung_45b'],
    'office.shift': ['dienstplan_soll', 'dienstplan_ist', 'tourenplan_woche', 'tourenplan_tag'],
    'office.vehicle': ['fahrtenbuch', 'fahrzeug_checkliste'],
    'pflege.record': ['pflegeanamnese', 'sis', 'pflegebericht', 'medikationsplan'],
    'stationaer.resident': ['bewohnerstammblatt', 'sis', 'pflegebericht', 'trinkprotokoll'],
    'beratung.case': ['beratungsprotokoll', 'beratungsnachweis_37_3'],
    'akademie.course': ['teilnehmerliste', 'zertifikat', 'anwesenheitsliste'],
  };

  const areaKey = `${input.targetModule}.${input.targetArea}`;
  const defaultKeys = defaultKeysByArea[areaKey] ?? [];

  let rows = templates.data.filter((t) => {
    if (boundTemplateIds.size > 0) return boundTemplateIds.has(t.id) || boundTemplateIds.has(t.templateKey);
    if (defaultKeys.length > 0) return defaultKeys.includes(t.templateKey);
    return t.moduleScope.includes(input.targetModule);
  });

  if (input.assistOnly) {
    rows = rows.filter((t) => t.isAssistAllowed && !t.isMedicalOrTreatmentRelated);
  }

  return { ok: true, data: rows };
}

export async function createGeneratedDocument(
  input: CreateGeneratedDocumentInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<GeneratedDocumentRecord>> {
  const denied = assertDocumentCreate<GeneratedDocumentRecord>(actorRoleKey);
  if (denied) return denied;

  const id = `gen-${Date.now()}`;
  const record: GeneratedDocumentRecord = {
    id,
    tenantId: input.tenantId,
    templateId: input.templateId,
    title: input.title,
    status: 'draft',
    fileName: null,
    pdfPath: null,
    htmlOutput: input.htmlOutput,
    archivedInArea: null,
    clientId: input.clientId ?? null,
    employeeId: input.employeeId ?? null,
    assignmentId: input.assignmentId ?? null,
    signatureStatus: 'none',
    emailStatus: 'none',
    faxStatus: 'none',
    createdAt: new Date().toISOString(),
    finalizedAt: null,
  };

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };
    const { data, error } = await fromUnknownTable(supabase, 'generated_documents')
      .insert({
        tenant_id: input.tenantId,
        template_id: input.templateId.startsWith('catalog-') ? null : input.templateId,
        title: input.title,
        status: 'draft',
        client_id: input.clientId ?? null,
        employee_id: input.employeeId ?? null,
        assignment_id: input.assignmentId ?? null,
        invoice_id: input.invoiceId ?? null,
        consultation_id: input.consultationId ?? null,
        course_id: input.courseId ?? null,
        html_output: input.htmlOutput,
        generated_content_json: { html: input.htmlOutput },
        autofill_snapshot_json: input.autofillSnapshot ?? {},
        manual_overrides_json: input.manualOverrides ?? {},
        related_entity_table: input.relatedEntityTable ?? null,
        related_entity_id: input.relatedEntityId ?? null,
      })
      .select('*')
      .single();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const row = data as Record<string, unknown>;
    record.id = String(row.id);
    await writeDocumentAuditLog({
      tenantId: input.tenantId,
      action: 'document_generated',
      entityType: 'generated_document',
      entityId: record.id,
      actorRole: actorRoleKey ?? null,
      newValue: { title: input.title },
    });
  } else {
    DEMO_GENERATED.set(record.id, record);
  }

  return { ok: true, data: record };
}

export async function finalizeGeneratedDocument(
  input: FinalizeGeneratedDocumentInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<GeneratedDocumentRecord>> {
  const denied = enforcePermission<GeneratedDocumentRecord>(actorRoleKey, 'documents.finalize');
  if (denied) return denied;

  let pdfPath = input.pdfPath ?? null;
  let pdfBase64 = input.pdfBase64;

  const existing = DEMO_GENERATED.get(input.documentId);
  const html = existing?.htmlOutput ?? '';

  if (!pdfPath && html && !pdfBase64) {
    try {
      const bytes = await renderHtmlToPdfBytes(html);
      pdfBase64 = bytesToBase64(bytes);
    } catch {
      /* web-only — fallback edge */
    }
  }

  if (pdfBase64 && !pdfPath && getServiceMode() === 'supabase') {
    const upload = await invokeEdgeFunction<{ pdfPath?: string }>('render-document-pdf', {
      tenantId: input.tenantId,
      documentId: input.documentId,
      htmlOutput: html,
      pdfBase64,
      storeOnly: true,
    });
    if (upload.ok && upload.data.pdfPath) pdfPath = upload.data.pdfPath;
  }

  const fileName = buildGeneratedDocumentFileName({
    templateShortName: 'Dokument',
    clientLastName: null,
    clientFirstName: null,
  });

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };
    const { data, error } = await fromUnknownTable(supabase, 'generated_documents')
      .update({
        status: 'finalized',
        pdf_path: pdfPath,
        file_name: fileName,
        archived_in_area: input.archivedInArea,
        finalized_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.documentId)
      .select('*')
      .single();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const row = data as Record<string, unknown>;
    const record = mapGeneratedRow(row);
    await writeDocumentAuditLog({
      tenantId: input.tenantId,
      action: 'document_finalized',
      entityType: 'generated_document',
      entityId: record.id,
      actorRole: actorRoleKey ?? null,
    });
    if (input.clientId) {
      await archiveGeneratedDocumentToClientRecord({
        tenantId: input.tenantId,
        document: record,
        clientId: input.clientId,
        storageArea: input.archivedInArea,
      });
    }
    return { ok: true, data: record };
  }

  const finalized: GeneratedDocumentRecord = {
    ...(existing ?? {
      id: input.documentId,
      tenantId: input.tenantId,
      templateId: null,
      title: 'Dokument',
      status: 'draft',
      fileName: null,
      pdfPath: null,
      htmlOutput: html,
      archivedInArea: null,
      clientId: input.clientId ?? null,
      employeeId: input.employeeId ?? null,
      assignmentId: null,
      signatureStatus: 'none',
      emailStatus: 'none',
      faxStatus: 'none',
      createdAt: new Date().toISOString(),
      finalizedAt: null,
    }),
    status: 'finalized',
    pdfPath,
    fileName,
    archivedInArea: input.archivedInArea,
    finalizedAt: new Date().toISOString(),
  };
  DEMO_GENERATED.set(finalized.id, finalized);
  return { ok: true, data: finalized };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary);
}

function mapGeneratedRow(row: Record<string, unknown>): GeneratedDocumentRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    templateId: row.template_id ? String(row.template_id) : null,
    title: String(row.title),
    status: String(row.status),
    fileName: row.file_name ? String(row.file_name) : null,
    pdfPath: row.pdf_path ? String(row.pdf_path) : null,
    htmlOutput: row.html_output ? String(row.html_output) : null,
    archivedInArea: row.archived_in_area ? String(row.archived_in_area) : null,
    clientId: row.client_id ? String(row.client_id) : null,
    employeeId: row.employee_id ? String(row.employee_id) : null,
    assignmentId: row.assignment_id ? String(row.assignment_id) : null,
    signatureStatus: String(row.signature_status ?? 'none'),
    emailStatus: String(row.email_status ?? 'none'),
    faxStatus: String(row.fax_status ?? 'none'),
    createdAt: String(row.created_at),
    finalizedAt: row.finalized_at ? String(row.finalized_at) : null,
  };
}

export async function loadDocumentEngineBindings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentEngineBinding[]>> {
  const denied = enforcePermission<DocumentEngineBinding[]>(actorRoleKey, 'settings.templates.mapping');
  if (denied && enforcePermission(actorRoleKey, 'office.catalogs.view')) return denied;

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: true, data: [] };
    const { data } = await fromUnknownTable(supabase, 'document_template_bindings')
      .select('*, document_templates(template_name, label)')
      .eq('tenant_id', tenantId)
      .order('sort_order');
    return {
      ok: true,
      data: (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const tpl = r.document_templates as { template_name?: string; label?: string } | null;
        return {
          id: String(r.id),
          tenantId: String(r.tenant_id),
          templateId: String(r.template_id),
          templateName: tpl?.template_name ?? tpl?.label ?? '',
          targetModule: String(r.target_module),
          targetArea: String(r.target_area),
          targetComponent: r.target_component ? String(r.target_component) : null,
          triggerEvent: r.trigger_event ? String(r.trigger_event) : null,
          bindingType: String(r.binding_type),
          isDefault: Boolean(r.is_default),
          isRequired: Boolean(r.is_required),
          isActive: Boolean(r.is_active),
          sortOrder: Number(r.sort_order ?? 0),
        };
      }),
    };
  }

  return { ok: true, data: DEMO_BINDINGS.get(tenantId) ?? [] };
}

export async function loadDocumentEngineAudit(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentEngineAuditEntry[]>> {
  const denied = enforcePermission<DocumentEngineAuditEntry[]>(actorRoleKey, 'settings.templates.audit');
  if (denied && enforcePermission(actorRoleKey, 'office.catalogs.view')) return denied;
  if (getServiceMode() === 'supabase') {
    return { ok: true, data: await listDocumentAuditLog(tenantId) };
  }
  return { ok: true, data: [] };
}

export function resetDocumentEngineDemoStore(): void {
  DEMO_GENERATED.clear();
  DEMO_BINDINGS.clear();
}
