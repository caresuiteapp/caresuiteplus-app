import type { RoleKey, ServiceResult } from '@/types';
import type {
  CsDocumentRequest,
  CsDocumentRequestListItem,
  CsDocumentRequestSignature,
  CsDocumentRequestStatus,
  CsSendDocumentInput,
  CsSignerRole,
  CsTemplateWithActiveVersion,
  DocumentContext,
} from '@/types/documents/csTemplateDatabase';
import { CS_SIGNATURE_REQUIREMENT_LABELS } from '@/types/documents/csTemplateDatabase';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { resolveDocumentContext } from './csDocumentContextResolver';
import { fetchCsTemplatePlaceholders, fetchCsTemplateWithActiveVersion } from './csTemplateQueryService';
import type { CsAssignmentBlockingResult } from '@/types/documents/csDocumentRecipients';
import { logCsDocumentRequestAudit } from './csDocumentRequestAudit';
import { annotateSignatureRegions, injectSignatureIntoHtml, renderCsTemplateHtml } from './csTemplateRenderService';
import { validateTemplateForSend } from './csTemplateValidation';

const DEMO_REQUESTS = new Map<string, CsDocumentRequestListItem>();

/** Test seam — seeds demo requests when service mode is not supabase. */
export function seedDemoCsDocumentRequestForTests(item: CsDocumentRequestListItem): void {
  DEMO_REQUESTS.set(item.id, item);
}

function mapRequest(row: Record<string, unknown>): CsDocumentRequest {
  return {
    id: String(row.id),
    ownerTenantId: String(row.owner_tenant_id),
    templateVersionId: row.template_version_id ? String(row.template_version_id) : null,
    sourceTemplateKey: row.source_template_key ? String(row.source_template_key) : null,
    title: String(row.title),
    recipientScope: String(row.recipient_scope) as CsDocumentRequest['recipientScope'],
    employeeId: row.employee_id ? String(row.employee_id) : null,
    clientId: row.client_id ? String(row.client_id) : null,
    representativeId: row.representative_id ? String(row.representative_id) : null,
    assignmentId: row.assignment_id ? String(row.assignment_id) : null,
    invoiceId: row.invoice_id ? String(row.invoice_id) : null,
    priority: String(row.priority) as CsDocumentRequest['priority'],
    status: String(row.status) as CsDocumentRequestStatus,
    dueDate: row.due_date ? String(row.due_date) : null,
    requiredBeforeService: Boolean(row.required_before_service),
    portalVisible: Boolean(row.portal_visible),
    renderedHtml: row.rendered_html ? String(row.rendered_html) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapSignature(row: Record<string, unknown>): CsDocumentRequestSignature {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    signerRole: String(row.signer_role) as CsSignerRole,
    signerName: row.signer_name ? String(row.signer_name) : null,
    status: String(row.status) as CsDocumentRequestSignature['status'],
    signedAt: row.signed_at ? String(row.signed_at) : null,
  };
}

function enrichListItem(
  request: CsDocumentRequest,
  signatures: CsDocumentRequestSignature[],
): CsDocumentRequestListItem {
  const pendingSignatureRoles = signatures
    .filter((s) => s.status === 'pending')
    .map((s) => s.signerRole);
  return { ...request, signatures, pendingSignatureRoles };
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function openStatuses(): CsDocumentRequestStatus[] {
  return ['sent', 'opened', 'partially_signed'];
}

function completedStatuses(): CsDocumentRequestStatus[] {
  return ['completed', 'archived'];
}

export type CsDocumentRequestTab = 'open' | 'in_progress' | 'completed' | 'all' | 'templates';

export function filterRequestsByTab(
  items: CsDocumentRequestListItem[],
  tab: CsDocumentRequestTab,
): CsDocumentRequestListItem[] {
  switch (tab) {
    case 'open':
      return items.filter((r) => openStatuses().includes(r.status) && r.portalVisible);
    case 'in_progress':
      return items.filter((r) => r.status === 'partially_signed' || r.status === 'opened');
    case 'completed':
      return items.filter((r) => completedStatuses().includes(r.status));
    case 'all':
      return items;
    default:
      return items;
  }
}

export async function fetchCsDocumentRequests(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  tab: CsDocumentRequestTab = 'all',
): Promise<ServiceResult<CsDocumentRequestListItem[]>> {
  const denied = enforcePermission<CsDocumentRequestListItem[]>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() !== 'supabase') {
    const demo = [...DEMO_REQUESTS.values()].filter((r) => r.ownerTenantId === tenantId);
    return { ok: true, data: filterRequestsByTab(demo, tab) };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    const { data, error } = await fromUnknownTable(supabase, 'cs_document_requests')
      .select('*')
      .eq('owner_tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const requests = (data ?? []).map((row) => mapRequest(row as Record<string, unknown>));
    if (requests.length === 0) return { ok: true, data: [] };

    const ids = requests.map((r) => r.id);
    const { data: sigData, error: sigError } = await fromUnknownTable(supabase, 'cs_document_request_signatures')
      .select('id, request_id, signer_role, signer_name, status, signed_at')
      .in('request_id', ids);

    if (sigError) throw sigError;
    const sigByRequest = new Map<string, CsDocumentRequestSignature[]>();
    for (const row of sigData ?? []) {
      const sig = mapSignature(row as Record<string, unknown>);
      const list = sigByRequest.get(sig.requestId) ?? [];
      list.push(sig);
      sigByRequest.set(sig.requestId, list);
    }

    const items = requests.map((r) => enrichListItem(r, sigByRequest.get(r.id) ?? []));
    return { ok: true, data: filterRequestsByTab(items, tab) };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { ok: false, error: 'Vorlagen-Datenbank ist noch nicht migriert (0226).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}

export async function fetchPortalCsDocumentRequests(input: {
  tenantId: string;
  roleKey: RoleKey | null;
  employeeId?: string | null;
  clientId?: string | null;
  includeCompleted?: boolean;
}): Promise<ServiceResult<CsDocumentRequestListItem[]>> {
  const { tenantId, roleKey, employeeId, clientId, includeCompleted = false } = input;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (roleKey === 'employee_portal') {
    const denied = enforcePermission<CsDocumentRequestListItem[]>(roleKey, 'portal.employee.documents.view');
    if (denied) return denied;
  } else if (roleKey === 'client_portal' || roleKey === 'family_portal') {
    const denied = enforcePermission<CsDocumentRequestListItem[]>(roleKey, 'portal.client.documents.view');
    if (denied) return denied;
  } else {
    return { ok: false, error: 'Portalrolle nicht unterstützt.' };
  }

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: [] };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    let query = fromUnknownTable(supabase, 'cs_document_requests')
      .select('*')
      .eq('owner_tenant_id', tenantId)
      .eq('portal_visible', true)
      .order('due_date', { ascending: true });

    if (roleKey === 'employee_portal' && employeeId) {
      query = query.eq('employee_id', employeeId).in('recipient_scope', ['employee', 'both']);
    } else if ((roleKey === 'client_portal' || roleKey === 'family_portal') && clientId) {
      query = query.eq('client_id', clientId).in('recipient_scope', ['client', 'both']);
    } else {
      return { ok: true, data: [] };
    }

    if (!includeCompleted) {
      query = query.in('status', openStatuses());
    } else {
      query = query.in('status', [...openStatuses(), ...completedStatuses()]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const requests = (data ?? []).map((row) => mapRequest(row as Record<string, unknown>));
    const ids = requests.map((r) => r.id);
    if (ids.length === 0) return { ok: true, data: [] };

    const { data: sigData } = await fromUnknownTable(supabase, 'cs_document_request_signatures')
      .select('id, request_id, signer_role, signer_name, status, signed_at')
      .in('request_id', ids);

    const sigByRequest = new Map<string, CsDocumentRequestSignature[]>();
    for (const row of sigData ?? []) {
      const sig = mapSignature(row as Record<string, unknown>);
      const list = sigByRequest.get(sig.requestId) ?? [];
      list.push(sig);
      sigByRequest.set(sig.requestId, list);
    }

    return {
      ok: true,
      data: requests.map((r) => enrichListItem(r, sigByRequest.get(r.id) ?? [])),
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { ok: true, data: [] };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}

export async function fetchCsDocumentRequestDetail(
  tenantId: string,
  requestId: string,
  actorRoleKey?: RoleKey | null,
  options?: { portalMode?: boolean },
): Promise<ServiceResult<CsDocumentRequestListItem>> {
  if (!options?.portalMode) {
    const denied = enforcePermission<CsDocumentRequestListItem>(actorRoleKey, 'office.documents.view');
    if (denied) return denied;
  }

  if (getServiceMode() !== 'supabase') {
    const item = DEMO_REQUESTS.get(requestId);
    if (!item) return { ok: false, error: 'Dokumentanforderung nicht gefunden.' };
    return { ok: true, data: item };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    const { data, error } = await fromUnknownTable(supabase, 'cs_document_requests')
      .select('*')
      .eq('owner_tenant_id', tenantId)
      .eq('id', requestId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, error: 'Dokumentanforderung nicht gefunden.' };

    const request = mapRequest(data as Record<string, unknown>);
    const { data: sigData } = await fromUnknownTable(supabase, 'cs_document_request_signatures')
      .select('id, request_id, signer_role, signer_name, status, signed_at')
      .eq('request_id', requestId);

    const signatures = (sigData ?? []).map((row) => mapSignature(row as Record<string, unknown>));
    return { ok: true, data: enrichListItem(request, signatures) };
  } catch (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}

export async function sendCsDocumentRequest(
  input: CsSendDocumentInput,
  actorRoleKey?: RoleKey | null,
  officeUser?: { name?: string | null; email?: string | null },
): Promise<ServiceResult<CsDocumentRequestListItem>> {
  const denied = enforcePermission<CsDocumentRequestListItem>(actorRoleKey, 'documents.create');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const templateResult = await fetchCsTemplateWithActiveVersion(
    input.tenantId,
    input.templateKey,
    actorRoleKey,
  );
  if (!templateResult.ok) return templateResult;
  if (!templateResult.data) {
    return { ok: false, error: 'Diese Vorlage hat keine aktive Version.' };
  }
  const template = templateResult.data;

  const placeholdersResult = await fetchCsTemplatePlaceholders(input.tenantId, actorRoleKey);
  if (!placeholdersResult.ok) return placeholdersResult;

  const dueDate = input.dueDate ?? addDaysIso(template.dueInDays);
  const contextResult = await resolveDocumentContext({
    tenantId: input.tenantId,
    templateTitle: template.title,
    templateVersion: String(template.activeVersion.versionNo),
    documentType: template.documentType,
    dueDate,
    priority: input.priority ?? template.defaultPriority,
    signatureRequirement: CS_SIGNATURE_REQUIREMENT_LABELS[template.defaultSignatureRequirement],
    employeeId: input.employeeId,
    clientId: input.clientId,
    representativeId: input.representativeId,
    assignmentId: input.assignmentId,
    invoiceId: input.invoiceId,
    payorId: input.payorId,
    officeUserName: officeUser?.name,
    officeUserEmail: officeUser?.email,
  });
  if (!contextResult.ok) return contextResult;

  const issues = validateTemplateForSend({
    template,
    sendRecipientScope: input.recipientScope,
    employeeId: input.employeeId,
    clientId: input.clientId,
    context: contextResult.data,
    placeholders: placeholdersResult.data,
  });
  if (issues.length > 0) {
    return { ok: false, error: issues.map((i) => i.message).join(' ') };
  }

  const renderedHtml = renderCsTemplateHtml(template.activeVersion.bodyHtml, contextResult.data);

  if (getServiceMode() !== 'supabase') {
    const id = `demo-req-${Date.now()}`;
    const signatures: CsDocumentRequestSignature[] = template.signatureFields.map((f, idx) => ({
      id: `demo-sig-${idx}`,
      requestId: id,
      signerRole: f.signerRole,
      signerName: null,
      status: 'pending',
      signedAt: null,
    }));
    const item = enrichListItem(
      {
        id,
        ownerTenantId: input.tenantId,
        templateVersionId: template.activeVersion.id,
        sourceTemplateKey: template.templateKey,
        title: template.title,
        recipientScope: input.recipientScope,
        employeeId: input.employeeId ?? null,
        clientId: input.clientId ?? null,
        representativeId: input.representativeId ?? null,
        assignmentId: input.assignmentId ?? null,
        invoiceId: input.invoiceId ?? null,
        priority: input.priority ?? template.defaultPriority,
        status: 'sent',
        dueDate,
        requiredBeforeService: input.requiredBeforeService ?? template.isRequiredBeforeService,
        portalVisible: true,
        renderedHtml,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      signatures,
    );
    DEMO_REQUESTS.set(id, item);
    return { ok: true, data: item };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    const { data: inserted, error } = await fromUnknownTable(supabase, 'cs_document_requests')
      .insert({
        owner_tenant_id: input.tenantId,
        template_version_id: template.activeVersion.id,
        source_template_key: template.templateKey,
        title: template.title,
        recipient_scope: input.recipientScope,
        employee_id: input.employeeId ?? null,
        client_id: input.clientId ?? null,
        representative_id: input.representativeId ?? null,
        assignment_id: input.assignmentId ?? null,
        invoice_id: input.invoiceId ?? null,
        payor_id: input.payorId ?? null,
        priority: input.priority ?? template.defaultPriority,
        status: 'sent',
        due_date: dueDate,
        required_before_service: input.requiredBeforeService ?? template.isRequiredBeforeService,
        portal_visible: true,
        context_snapshot: contextResult.data,
        rendered_html: renderedHtml,
        created_by: input.createdBy ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    const request = mapRequest(inserted as Record<string, unknown>);

    const signatureRows = template.signatureFields.length
      ? template.signatureFields
      : template.defaultSignatureRequirement === 'none'
        ? []
        : [{ signerRole: 'client' as CsSignerRole, label: 'Unterschrift', required: true, anchorToken: 'client_signature', inputType: 'signature' as const, orderIndex: 1, id: '', versionId: '' }];

    const sigInserts = signatureRows.map((field) => ({
      request_id: request.id,
      signer_role: field.signerRole,
      status: field.required ? 'pending' : 'not_required',
    }));

    let signatures: CsDocumentRequestSignature[] = [];
    if (sigInserts.length > 0) {
      const { data: sigData, error: sigError } = await fromUnknownTable(supabase, 'cs_document_request_signatures')
        .insert(sigInserts)
        .select('id, request_id, signer_role, signer_name, status, signed_at');
      if (sigError) throw sigError;
      signatures = (sigData ?? []).map((row) => mapSignature(row as Record<string, unknown>));
    }

    await logCsDocumentRequestAudit({
      tenantId: input.tenantId,
      requestId: request.id,
      action: 'document_request_sent',
      metadata: {
        template_key: template.templateKey,
        recipient_scope: input.recipientScope,
        employee_id: input.employeeId,
        client_id: input.clientId,
      },
    });

    return { ok: true, data: enrichListItem(request, signatures) };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { ok: false, error: 'Vorlagen-Datenbank ist noch nicht migriert (0226).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}

export async function markCsDocumentRequestOpened(
  tenantId: string,
  requestId: string,
): Promise<ServiceResult<void>> {
  if (getServiceMode() !== 'supabase') return { ok: true, data: undefined };

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    await fromUnknownTable(supabase, 'cs_document_requests')
      .update({ status: 'opened', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('owner_tenant_id', tenantId)
      .eq('status', 'sent');

    await logCsDocumentRequestAudit({
      tenantId,
      requestId,
      action: 'document_request_opened',
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}

export async function signCsDocumentRequest(input: {
  tenantId: string;
  requestId: string;
  signerRole: CsSignerRole;
  signerName: string;
  signatureDataUrl: string;
  anchorToken?: string;
  userAgent?: string | null;
}): Promise<ServiceResult<CsDocumentRequestListItem>> {
  if (getServiceMode() !== 'supabase') {
    const item = DEMO_REQUESTS.get(input.requestId);
    if (!item) return { ok: false, error: 'Dokument nicht gefunden.' };
    const signedAt = new Date().toISOString();
    const signatures = item.signatures.map((s) =>
      s.signerRole === input.signerRole
        ? { ...s, status: 'signed' as const, signerName: input.signerName, signedAt }
        : s,
    );
    const allDone = signatures.every((s) => s.status !== 'pending');
    const nextHtml = injectSignatureIntoHtml(
      item.renderedHtml ?? '',
      input.anchorToken ?? `${input.signerRole}_signature`,
      input.signatureDataUrl,
      input.signerName,
      signedAt,
    );
    const updated = enrichListItem(
      {
        ...item,
        renderedHtml: nextHtml,
        status: allDone ? 'completed' : 'partially_signed',
        portalVisible: !allDone,
        completedAt: allDone ? signedAt : null,
      },
      signatures,
    );
    DEMO_REQUESTS.set(input.requestId, updated);
    return { ok: true, data: updated };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    const detail = await fetchCsDocumentRequestDetail(input.tenantId, input.requestId);
    if (!detail.ok) return detail;

    const signedAt = new Date().toISOString();
    const anchor = input.anchorToken ?? `${input.signerRole}_signature`;
    const nextHtml = injectSignatureIntoHtml(
      detail.data.renderedHtml ?? '',
      anchor,
      input.signatureDataUrl,
      input.signerName,
      signedAt,
    );

    const { error: sigError } = await fromUnknownTable(supabase, 'cs_document_request_signatures')
      .update({
        status: 'signed',
        signer_name: input.signerName,
        signature_data_url: input.signatureDataUrl,
        signed_at: signedAt,
        signed_user_agent: input.userAgent ?? null,
        updated_at: signedAt,
      })
      .eq('request_id', input.requestId)
      .eq('signer_role', input.signerRole)
      .eq('status', 'pending');

    if (sigError) throw sigError;

    const { data: remaining } = await fromUnknownTable(supabase, 'cs_document_request_signatures')
      .select('id')
      .eq('request_id', input.requestId)
      .eq('status', 'pending');

    const allDone = (remaining ?? []).length === 0;
    const nextStatus: CsDocumentRequestStatus = allDone ? 'completed' : 'partially_signed';

    const { error: reqError } = await fromUnknownTable(supabase, 'cs_document_requests')
      .update({
        status: nextStatus,
        rendered_html: nextHtml,
        portal_visible: !allDone,
        completed_at: allDone ? signedAt : null,
        updated_at: signedAt,
      })
      .eq('id', input.requestId)
      .eq('owner_tenant_id', input.tenantId);

    if (reqError) throw reqError;

    await logCsDocumentRequestAudit({
      tenantId: input.tenantId,
      requestId: input.requestId,
      action: 'document_request_signed',
      metadata: { signer_role: input.signerRole, signer_name: input.signerName },
    });

    if (allDone) {
      await logCsDocumentRequestAudit({
        tenantId: input.tenantId,
        requestId: input.requestId,
        action: 'document_request_completed',
      });
    }

    return fetchCsDocumentRequestDetail(input.tenantId, input.requestId, undefined, { portalMode: true });
  } catch (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}

export async function previewCsDocumentSend(input: {
  tenantId: string;
  templateKey: string;
  recipientScope: CsSendDocumentInput['recipientScope'];
  employeeId?: string | null;
  clientId?: string | null;
  assignmentId?: string | null;
  invoiceId?: string | null;
  actorRoleKey?: RoleKey | null;
  officeUser?: { name?: string | null; email?: string | null };
}): Promise<
  ServiceResult<{
    renderedHtml: string;
    context: DocumentContext;
    issues: string[];
    signatureFields: CsTemplateWithActiveVersion['signatureFields'];
  }>
> {
  const denied = enforcePermission<{ renderedHtml: string; context: DocumentContext; issues: string[] }>(
    input.actorRoleKey,
    'office.documents.view',
  );
  if (denied) return denied;

  const templateResult = await fetchCsTemplateWithActiveVersion(
    input.tenantId,
    input.templateKey,
    input.actorRoleKey,
  );
  if (!templateResult.ok) return templateResult;
  if (!templateResult.data) {
    return { ok: false, error: 'Diese Vorlage hat keine aktive Version.' };
  }

  const placeholdersResult = await fetchCsTemplatePlaceholders(input.tenantId, input.actorRoleKey);
  if (!placeholdersResult.ok) return placeholdersResult;

  const template = templateResult.data;
  const dueDate = addDaysIso(template.dueInDays);
  const contextResult = await resolveDocumentContext({
    tenantId: input.tenantId,
    templateTitle: template.title,
    templateVersion: String(template.activeVersion.versionNo),
    documentType: template.documentType,
    dueDate,
    priority: template.defaultPriority,
    signatureRequirement: CS_SIGNATURE_REQUIREMENT_LABELS[template.defaultSignatureRequirement],
    employeeId: input.employeeId,
    clientId: input.clientId,
    assignmentId: input.assignmentId,
    invoiceId: input.invoiceId,
    officeUserName: input.officeUser?.name,
    officeUserEmail: input.officeUser?.email,
  });
  if (!contextResult.ok) return contextResult;

  const issues = validateTemplateForSend({
    template,
    sendRecipientScope: input.recipientScope,
    employeeId: input.employeeId,
    clientId: input.clientId,
    context: contextResult.data,
    placeholders: placeholdersResult.data,
  });

  return {
    ok: true,
    data: {
      renderedHtml: annotateSignatureRegions(
        renderCsTemplateHtml(template.activeVersion.bodyHtml, contextResult.data),
      ),
      context: contextResult.data,
      issues: issues.map((i) => i.message),
      signatureFields: template.signatureFields,
    },
  };
}

export async function inspectBlockingCsDocumentsForAssignment(
  tenantId: string,
  assignmentId: string,
): Promise<ServiceResult<CsAssignmentBlockingResult>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { hasBlockingDocuments: false, blockingRequests: [], reason: null } };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: true, data: { hasBlockingDocuments: false, blockingRequests: [], reason: null } };
    }

    const { data, error } = await fromUnknownTable(supabase, 'cs_document_requests')
      .select('id, title, status')
      .eq('owner_tenant_id', tenantId)
      .eq('assignment_id', assignmentId)
      .eq('required_before_service', true)
      .in('status', openStatuses());

    if (error) throw error;

    const requestRows = data ?? [];
    const blockingRequests: CsAssignmentBlockingResult['blockingRequests'] = [];

    for (const row of requestRows) {
      const r = row as { id: string; title: string; status: string };
      const { data: sigData } = await fromUnknownTable(supabase, 'cs_document_request_signatures')
        .select('signer_role, status')
        .eq('request_id', r.id);
      const required = (sigData ?? [])
        .filter((s) => (s as { status: string }).status === 'pending')
        .map((s) => String((s as { signer_role: string }).signer_role));
      blockingRequests.push({
        requestId: r.id,
        title: r.title,
        status: r.status,
        requiredSignatures: required,
        missingSignatures: required,
      });
    }

    const hasBlockingDocuments = blockingRequests.length > 0;
    return {
      ok: true,
      data: {
        hasBlockingDocuments,
        blockingRequests,
        reason: hasBlockingDocuments
          ? 'Offene Pflichtdokumente müssen vor Einsatzstart abgeschlossen werden.'
          : null,
      },
    };
  } catch {
    return { ok: true, data: { hasBlockingDocuments: false, blockingRequests: [], reason: null } };
  }
}

/** Phase 2: nur vorbereitet — nicht produktiv in Einsatzstart verdrahten. */
export async function hasBlockingCsDocumentForAssignment(
  tenantId: string,
  assignmentId: string,
): Promise<ServiceResult<boolean>> {
  const result = await inspectBlockingCsDocumentsForAssignment(tenantId, assignmentId);
  if (!result.ok) return { ok: true, data: false };
  return { ok: true, data: result.data.hasBlockingDocuments };
}
