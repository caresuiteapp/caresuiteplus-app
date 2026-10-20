import type { ServiceResult } from '@/types';
import { randomUUID } from 'expo-crypto';
import type {
  OfficeCreateSignatureDocumentInput,
  PortalSignatureCapture,
  PortalSignatureDashboardCounts,
  PortalSignatureDocument,
  PortalSignatureDocumentDetail,
  PortalSignatureFilterTab,
  PortalSignDocumentInput,
} from '@/types/portal/documentSignatures';
import { computeDocumentContentHash } from '@/lib/documents/documentHashService';
import { finalizePortalSignatureDocumentPdf } from '@/lib/portal/portalDocumentSignaturePdfService';
import {
  buildPortalSignatureCaptureStoragePath,
  countPortalSignatureDashboard,
  filterPortalSignatureDocuments,
  isOpenSignatureStatus,
  mapPortalSignatureAuditRow,
  mapPortalSignatureCaptureRow,
  mapPortalSignatureDocumentRow,
  parseSignatureDataUrl,
  PORTAL_SIGNATURE_STORAGE_BUCKET,
  PORTAL_SIGNATURE_TABLES,
  resolveInitialNextSignerRole,
  resolveNextSignerRole,
  resolveStatusAfterCapture,
} from '@/lib/portal/portalDocumentSignatureHelpers';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { isTenantStoragePath, toStorageUploadError } from '@/lib/storage/storagePaths';
import { fetchAllPortalRows } from './portalRowPagination';
import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';
import { fetchPortalEmployeeIdForAuthUser } from './resolvePortalEmployeeLink';

async function getAuthProfileId(tenantId: string): Promise<string | null> {
  const profile = await resolveAuthenticatedProfileId(tenantId);
  return profile.ok ? profile.data : null;
}

async function insertAuditEvent(input: {
  tenantId: string;
  documentId: string;
  eventType: string;
  summary: string;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const actorUserId = await getAuthProfileId(input.tenantId);
  await fromUnknownTable(supabase, PORTAL_SIGNATURE_TABLES.audit).insert({
    tenant_id: input.tenantId,
    document_id: input.documentId,
    actor_user_id: actorUserId,
    actor_name: input.actorName ?? null,
    event_type: input.eventType,
    summary: input.summary,
    metadata_json: input.metadata ?? {},
  });
}

function mapDocumentTypeToClientCategory(
  documentType: PortalSignatureDocument['documentType'],
): string {
  const map: Partial<Record<PortalSignatureDocument['documentType'], string>> = {
    arbeitsvertrag: 'vertrag',
    zusatzvereinbarung: 'vertrag',
    einwilligung: 'einwilligung',
    pflegeunterlage: 'pflegeplan',
    datenschutz: 'einwilligung',
  };
  return map[documentType] ?? 'sonstige';
}

async function archiveCompletedDocument(
  doc: PortalSignatureDocument,
  finalStoragePath: string,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const fileName = `${doc.title.replace(/[^\w\-äöüÄÖÜß ]/g, '').trim() || 'dokument'}.pdf`;

  const archives: { table: string; ownerKey: 'employee_id' | 'client_id'; ownerId: string; row: Record<string, unknown> }[] = [];
  if (doc.recipientType === 'employee' && doc.employeeId) archives.push({ table: 'employee_documents', ownerKey: 'employee_id', ownerId: doc.employeeId, row: {
    id: doc.id, tenant_id: doc.tenantId, employee_id: doc.employeeId, category: doc.documentType,
    title: doc.title, file_name: fileName, storage_path: finalStoragePath, sensitive: false, released_to_portal: true,
  } });
  if (doc.clientId) archives.push({ table: 'client_documents', ownerKey: 'client_id', ownerId: doc.clientId, row: {
    id: doc.id, tenant_id: doc.tenantId, client_id: doc.clientId, title: doc.title, file_name: fileName,
    mime_type: 'application/pdf', storage_path: finalStoragePath, category: mapDocumentTypeToClientCategory(doc.documentType),
    status: 'abgeschlossen', portal_visible: true, sensitivity: 'care',
  } });
  for (const archive of archives) {
    const load = () => fromUnknownTable(supabase, archive.table).select(archive.ownerKey === 'employee_id' ? 'id, employee_id, storage_path' : 'id, client_id, storage_path')
      .eq('tenant_id', doc.tenantId).eq('id', doc.id).maybeSingle();
    const exists = await load();
    const matches = (row: Record<string, unknown> | null) => row?.[archive.ownerKey] === archive.ownerId && row?.storage_path === finalStoragePath;
    if (exists.error || (exists.data && !matches(exists.data))) return { ok: false, error: 'Die Dokumentablage ist nicht eindeutig. Bitte die Verwaltung informieren.' };
    if (exists.data) continue;
    const inserted = await fromUnknownTable(supabase, archive.table).insert(archive.row);
    if (inserted.error) {
      const recovered = await load();
      if (recovered.error || !matches(recovered.data)) return { ok: false, error: 'Die Unterschrift ist gespeichert. Die Dokumentablage konnte noch nicht bestätigt werden. Bitte die Fertigstellung erneut versuchen.' };
    }
  }
  return { ok: true, data: undefined };
}

async function loadDocumentDetail(
  tenantId: string,
  documentId: string,
): Promise<ServiceResult<PortalSignatureDocumentDetail>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data: docRow, error: docError } = await fromUnknownTable(
    supabase,
    PORTAL_SIGNATURE_TABLES.documents,
  )
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', documentId)
    .maybeSingle();

  if (docError) {
    if (isSupabaseMissingTableError(docError)) {
      return { ok: false, error: 'portal_signature_documents (0227) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(docError) };
  }
  if (!docRow) return { ok: false, error: 'Dokument nicht gefunden.' };

  const { data: captureRows, error: captureError } = await fromUnknownTable(
    supabase,
    PORTAL_SIGNATURE_TABLES.captures,
  )
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('document_id', documentId)
    .order('signed_at', { ascending: true });

  if (captureError) {
    return { ok: false, error: toGermanSupabaseError(captureError) };
  }

  const { data: auditRows, error: auditError } = await fromUnknownTable(
    supabase,
    PORTAL_SIGNATURE_TABLES.audit,
  )
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (auditError) {
    return { ok: false, error: toGermanSupabaseError(auditError) };
  }

  const doc = mapPortalSignatureDocumentRow(docRow as Record<string, unknown>);
  return {
    ok: true,
    data: {
      ...doc,
      captures: (captureRows ?? []).map((row) =>
        mapPortalSignatureCaptureRow(row as Record<string, unknown>),
      ),
      auditTrail: (auditRows ?? []).map((row) =>
        mapPortalSignatureAuditRow(row as Record<string, unknown>),
      ),
    },
  };
}

export async function fetchLivePortalSignatureDocuments(
  tenantId: string,
  employeeId: string,
  tab: PortalSignatureFilterTab,
): Promise<ServiceResult<PortalSignatureDocument[]>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (await fetchPortalEmployeeIdForAuthUser(tenantId) !== employeeId) return { ok: false, error: 'Mitarbeitende sehen nur die eigenen Signaturdokumente.' };

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const result = await fetchAllPortalRows<Record<string, unknown> & { id: string }>((from, to) => fromUnknownTable(supabase, PORTAL_SIGNATURE_TABLES.documents)
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .neq('status', 'withdrawn')
    .order('due_date', { ascending: true, nullsFirst: false }).order('id', { ascending: true }).range(from, to));
  if (!result.ok) return result;

  const docs = result.data.map((row) =>
    mapPortalSignatureDocumentRow(row as Record<string, unknown>),
  );
  return { ok: true, data: filterPortalSignatureDocuments(docs, tab) };
}

export async function fetchLivePortalSignatureDocumentDetail(
  tenantId: string,
  employeeId: string,
  documentId: string,
): Promise<ServiceResult<PortalSignatureDocumentDetail>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (await fetchPortalEmployeeIdForAuthUser(tenantId) !== employeeId) return { ok: false, error: 'Mitarbeitende sehen nur die eigenen Signaturdokumente.' };

  const detail = await loadDocumentDetail(tenantId, documentId);
  if (!detail.ok || !detail.data) return detail;
  if (detail.data.employeeId !== employeeId) {
    return { ok: false, error: 'Dokument nicht gefunden.' };
  }

  await insertAuditEvent({
    tenantId,
    documentId,
    eventType: 'document_viewed',
    summary: 'Dokument im Mitarbeiterportal geöffnet.',
  });

  return detail;
}

export async function signLivePortalDocument(
  input: PortalSignDocumentInput,
  signerProfileId?: string | null,
): Promise<ServiceResult<PortalSignatureDocumentDetail>> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;
  if (await fetchPortalEmployeeIdForAuthUser(input.tenantId) !== input.employeeId) return { ok: false, error: 'Dieses Signaturdokument gehört nicht zu Ihrem Mitarbeitendenprofil.' };

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const detailResult = await loadDocumentDetail(input.tenantId, input.documentId);
  if (!detailResult.ok || !detailResult.data) return detailResult;

  const doc = detailResult.data;
  if (doc.employeeId !== input.employeeId) {
    return { ok: false, error: 'Dokument nicht gefunden.' };
  }
  if (!isOpenSignatureStatus(doc.status)) {
    return { ok: false, error: 'Dokument ist nicht mehr zur Unterschrift offen.' };
  }
  if (doc.nextSignerRole !== input.signerRole) {
    return { ok: false, error: 'Diese Unterschrift ist aktuell nicht erforderlich.' };
  }
  if (doc.documentSourceType === 'pdf_upload') return { ok: false, error: 'Die hochgeladene Original-PDF kann derzeit noch nicht vollständig mit einer Unterschrift abgeschlossen werden. Bitte wenden Sie sich an die Verwaltung.' };
  if (input.expectedVersionNumber != null && input.expectedVersionNumber !== doc.versionNumber) return { ok: false, error: 'Das Dokument wurde geändert. Bitte laden und prüfen Sie die neue Fassung.' };

  const payloadHash = computeDocumentContentHash(`${doc.id}:${doc.versionNumber}:${doc.previewHtml ?? ''}`);
  const reusable = doc.captures.find(capture => capture.signerRole === input.signerRole && capture.payloadHash === payloadHash);
  if (!reusable && !input.signerName.trim()) return { ok: false, error: 'Bitte den Namen der unterzeichnenden Person angeben.' };
  const parsed = reusable ? null : parseSignatureDataUrl(input.signatureDataUrl);
  if (!reusable && (!parsed || parsed.mimeType !== 'image/png')) return { ok: false, error: 'Signaturbild ungültig — bitte erneut erfassen.' };
  const verifiedProfile = await resolveAuthenticatedProfileId(input.tenantId);
  if (!verifiedProfile.ok) return verifiedProfile;
  const captureId = reusable?.id ?? randomUUID();
  const auditId = reusable?.auditId ?? randomUUID();
  const signedAt = reusable?.signedAt ?? new Date().toISOString();
  const storagePath = reusable?.storagePath ?? buildPortalSignatureCaptureStoragePath(input.tenantId, input.documentId, captureId);
  const signatureHash = reusable?.signatureHash ?? computeDocumentContentHash([input.tenantId, input.documentId, input.signerRole, input.signerName, signedAt, storagePath].join('|'));
  if (!reusable && parsed) {
    const uploaded = await supabase.storage.from(PORTAL_SIGNATURE_STORAGE_BUCKET).upload(storagePath, parsed.bytes.slice().buffer as ArrayBuffer, { contentType: 'image/png', upsert: false });
    if (uploaded.error) return { ok: false, error: toStorageUploadError(uploaded.error.message) };
    let captureError: unknown = null;
    try {
      const persisted = await fromUnknownTable(supabase, PORTAL_SIGNATURE_TABLES.captures).insert({
        id: captureId, tenant_id: input.tenantId, document_id: input.documentId,
        signer_role: input.signerRole, signer_name: input.signerName.trim(), signer_profile_id: verifiedProfile.data,
        storage_path: storagePath, signature_hash: signatureHash, payload_hash: payloadHash,
        signed_at: signedAt, device_info: input.deviceInfo ?? null, browser: input.browser ?? null,
        captured_ip: input.capturedIp ?? null, audit_id: auditId,
      });
      captureError = persisted.error;
    } catch (cause) { captureError = cause; }
    if (captureError) {
      const recovered = await loadDocumentDetail(input.tenantId, input.documentId);
      if (!recovered.ok || !recovered.data.captures.some(capture => capture.id === captureId && capture.payloadHash === payloadHash)) return { ok: false, error: 'Die Unterschrift konnte noch nicht bestätigt werden. Bitte den Dokumentstatus erneut laden.' };
    }
  }

  const updatedDoc: PortalSignatureDocument = {
    ...doc,
    employeeSigned: input.signerRole === 'employee' ? true : doc.employeeSigned,
    clientSigned: input.signerRole === 'client' ? true : doc.clientSigned,
  };
  updatedDoc.status = resolveStatusAfterCapture(updatedDoc);
  updatedDoc.nextSignerRole = resolveNextSignerRole(updatedDoc);

  let finalStoragePath: string | null = doc.previewPdfUrl;
  let finalPdfHash: string | null = null;
  let completedAt: string | null = doc.completedAt;
  let isImmutable = false;

  const newCapture: PortalSignatureCapture = {
    id: captureId,
    documentId: input.documentId,
    tenantId: input.tenantId,
    signerRole: input.signerRole,
    signerName: reusable?.signerName ?? input.signerName.trim(),
    signedAt,
    signatureHash,
    payloadHash,
    auditId,
    deviceInfo: input.deviceInfo ?? null,
    browser: input.browser ?? null,
    capturedIp: input.capturedIp ?? null,
    storagePath,
  };
  const allCaptures = reusable ? doc.captures : [...doc.captures, newCapture];

  if (updatedDoc.status === 'completed') {
    const pdfResult = await finalizePortalSignatureDocumentPdf({
      tenantId: input.tenantId,
      document: updatedDoc,
      captures: allCaptures,
    });
    if (!pdfResult.ok) return pdfResult;
    finalStoragePath = pdfResult.data.storagePath;
    finalPdfHash = pdfResult.data.pdfHash;
    completedAt = signedAt;
    isImmutable = true;
    const archived = await archiveCompletedDocument(updatedDoc, finalStoragePath);
    if (!archived.ok) return archived;
  }

  const { error: updateError } = await fromUnknownTable(
    supabase,
    PORTAL_SIGNATURE_TABLES.documents,
  )
    .update({
      employee_signed: updatedDoc.employeeSigned,
      client_signed: updatedDoc.clientSigned,
      status: updatedDoc.status,
      next_signer_role: updatedDoc.nextSignerRole,
      completed_at: completedAt,
      final_storage_path: finalStoragePath,
      final_pdf_hash: finalPdfHash,
      is_immutable: isImmutable,
      updated_at: signedAt,
    })
    .eq('tenant_id', input.tenantId)
    .eq('id', input.documentId).eq('version_number', doc.versionNumber).eq('status', doc.status)
    .select('id').single();

  if (updateError) {
    return { ok: false, error: toGermanSupabaseError(updateError) };
  }

  await insertAuditEvent({
    tenantId: input.tenantId,
    documentId: input.documentId,
    eventType: 'signature_captured',
    summary: `${input.signerRole === 'employee' ? 'Mitarbeiter' : 'Klient'}-Signatur erfasst.`,
    actorName: input.signerName.trim(),
    metadata: { auditId, signatureHash, signerRole: input.signerRole },
  });

  if (updatedDoc.status === 'completed') {
    await insertAuditEvent({
      tenantId: input.tenantId,
      documentId: input.documentId,
      eventType: 'document_completed',
      summary: 'Dokument vollständig unterschrieben, PDF finalisiert und archiviert.',
      actorName: input.signerName.trim(),
      metadata: { auditId, finalStoragePath, finalPdfHash },
    });
  }

  const confirmed = await loadDocumentDetail(input.tenantId, input.documentId);
  if (!confirmed.ok) return confirmed;
  if (confirmed.data.status !== updatedDoc.status || !confirmed.data.captures.some(capture => capture.id === captureId) ||
      (updatedDoc.status === 'completed' && confirmed.data.previewPdfUrl !== finalStoragePath)) return { ok: false, error: 'Die Fertigstellung wurde noch nicht bestätigt. Bitte den Dokumentstatus erneut laden.' };
  return confirmed;
}

export async function fetchLivePortalSignatureDashboardCounts(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<PortalSignatureDashboardCounts>> {
  const all = await fetchLivePortalSignatureDocuments(tenantId, employeeId, 'open');
  if (!all.ok) return all;
  return { ok: true, data: countPortalSignatureDashboard(all.data ?? []) };
}

export async function fetchLiveOfficeSignatureDocuments(
  tenantId: string,
): Promise<ServiceResult<PortalSignatureDocument[]>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, PORTAL_SIGNATURE_TABLES.documents)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'portal_signature_documents (0227) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => mapPortalSignatureDocumentRow(row as Record<string, unknown>)),
  };
}

export async function createLiveOfficeSignatureDocument(
  input: OfficeCreateSignatureDocumentInput,
): Promise<ServiceResult<PortalSignatureDocument>> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.employeeId) {
    return { ok: false, error: 'Mitarbeiter für Portal-Zustellung erforderlich.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const documentId = input.documentId ?? randomUUID();
  const sentAt = new Date().toISOString();
  const nextSignerRole = resolveInitialNextSignerRole(input.signatureRequirement);

  const { data, error } = await fromUnknownTable(supabase, PORTAL_SIGNATURE_TABLES.documents)
    .insert({
      id: documentId,
      tenant_id: input.tenantId,
      title: input.title.trim(),
      document_type: input.documentType,
      recipient_type: input.recipientType,
      employee_id: input.employeeId,
      client_id: input.clientId ?? null,
      client_name: input.clientName ?? null,
      signature_requirement: input.signatureRequirement,
      due_date: input.dueDate ?? null,
      priority: input.priority ?? 'normal',
      required_before_assignment: input.requiredBeforeAssignment ?? false,
      assignment_id: input.assignmentId ?? null,
      status: 'open',
      preview_html: input.previewHtml ?? null,
      storage_path: input.storagePath ?? null,
      source_document_id: input.sourceDocumentId ?? null,
      document_source_type: input.documentSourceType ?? 'office_write',
      signature_fields_json: input.signatureFields ?? [],
      allow_download: input.allowDownload ?? true,
      created_by: input.creatorProfileId ?? null,
      creator_name: input.creatorName,
      sent_at: sentAt,
      next_signer_role: nextSignerRole,
      employee_signed: false,
      client_signed: false,
      version_number: 1,
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'portal_signature_documents (0227) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const doc = mapPortalSignatureDocumentRow(data as Record<string, unknown>);
  await insertAuditEvent({
    tenantId: input.tenantId,
    documentId: doc.id,
    eventType: 'document_sent',
    summary: `Dokument „${doc.title}" an Portal gesendet.`,
    actorName: input.creatorName,
    metadata: {
      recipientType: input.recipientType,
      employeeId: input.employeeId,
      documentSourceType: input.documentSourceType ?? 'office_write',
      signatureFieldCount: input.signatureFields?.length ?? 0,
    },
  });

  return { ok: true, data: doc };
}

export async function withdrawLiveOfficeSignatureDocument(
  tenantId: string,
  documentId: string,
  actorName: string,
): Promise<ServiceResult<PortalSignatureDocument>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const detail = await loadDocumentDetail(tenantId, documentId);
  if (!detail.ok || !detail.data) return detail;
  if (detail.data.status === 'completed') {
    return { ok: false, error: 'Abgeschlossene Dokumente können nicht zurückgezogen werden.' };
  }

  const withdrawnAt = new Date().toISOString();
  const { data, error } = await fromUnknownTable(supabase, PORTAL_SIGNATURE_TABLES.documents)
    .update({
      status: 'withdrawn',
      next_signer_role: null,
      withdrawn_at: withdrawnAt,
      updated_at: withdrawnAt,
    })
    .eq('tenant_id', tenantId)
    .eq('id', documentId)
    .select('*')
    .single();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  await insertAuditEvent({
    tenantId,
    documentId,
    eventType: 'document_withdrawn',
    summary: 'Dokument aus Portal zurückgezogen.',
    actorName,
  });

  return { ok: true, data: mapPortalSignatureDocumentRow(data as Record<string, unknown>) };
}

export async function recordLivePortalSignatureView(
  tenantId: string,
  documentId: string,
): Promise<void> {
  await insertAuditEvent({
    tenantId,
    documentId,
    eventType: 'document_viewed',
    summary: 'Dokument angesehen.',
  });
}

export async function resolveLivePortalSignatureStorageUrl(
  storagePath: string,
  scope: { tenantId: string; employeeId: string; documentId: string },
): Promise<ServiceResult<string>> {
  if (!isTenantStoragePath(storagePath, scope.tenantId)) {
    return { ok: false, error: 'Keine Datei verfügbar.' };
  }
  const denied = guardServiceTenant(scope.tenantId);
  if (denied) return denied;
  if (await fetchPortalEmployeeIdForAuthUser(scope.tenantId) !== scope.employeeId) return { ok: false, error: 'Dieses Dokument gehört nicht zu Ihrem Mitarbeitendenprofil.' };
  const document = await loadDocumentDetail(scope.tenantId, scope.documentId);
  if (!document.ok) return document;
  if (document.data.employeeId !== scope.employeeId ||
      !((document.data.status === 'completed' && document.data.allowDownload && document.data.previewPdfUrl === storagePath) ||
        (document.data.documentSourceType === 'pdf_upload' && document.data.storagePath === storagePath && document.data.status !== 'withdrawn'))) {
    return { ok: false, error: 'Diese Datei ist nicht für Ihr Dokument freigegeben.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await supabase.storage
    .from(PORTAL_SIGNATURE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, 300);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'Vorschau konnte nicht geladen werden.' };
  }

  return { ok: true, data: data.signedUrl };
}
