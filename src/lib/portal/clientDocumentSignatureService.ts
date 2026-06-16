import type { ServiceResult } from '@/types';
import type {
  ClientDocumentSignature,
  ClientPortalAuditEvent,
  ClientPortalContext,
  ClientPortalRole,
  ClientVisibleDocument,
} from '@/types/portal/clientPortalDomain';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { computeDocumentContentHash } from '@/lib/documents/documentHashService';
import { enforcePermission } from '@/lib/permissions';
import { buildWorkspaceAccessContext, canViewDocument } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { canAccessClientPortal } from '@/lib/permissions';

const VISIBLE_DOCUMENTS = new Map<string, ClientVisibleDocument>();
const SIGNATURES = new Map<string, ClientDocumentSignature>();
const AUDIT_EVENTS: ClientPortalAuditEvent[] = [];
let signatureCounter = 0;
let auditCounter = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function audit(input: Omit<ClientPortalAuditEvent, 'id' | 'createdAt'>): ClientPortalAuditEvent {
  auditCounter += 1;
  const event: ClientPortalAuditEvent = {
    id: `cp-sig-audit-${auditCounter}`,
    createdAt: nowIso(),
    ...input,
  };
  AUDIT_EVENTS.push(event);
  return event;
}

function seedDemoVisibleDocuments(): void {
  if (VISIBLE_DOCUMENTS.size > 0) return;

  const seeds: ClientVisibleDocument[] = [
    {
      id: 'cvd-001',
      tenantId: DEMO_TENANT_ID,
      clientId: 'client-001',
      documentId: 'doc-003',
      title: 'Pflegeplan Juni 2026',
      category: 'care_plan',
      releasedAt: '2026-05-28T08:00:00.000Z',
      requiresSignature: false,
      signatureRequired: false,
      locked: false,
      processActive: true,
    },
    {
      id: 'cvd-002',
      tenantId: DEMO_TENANT_ID,
      clientId: 'client-001',
      documentId: 'doc-006',
      title: 'Einwilligung Datenschutz',
      category: 'consent',
      releasedAt: '2025-06-01T08:00:00.000Z',
      requiresSignature: true,
      signatureRequired: true,
      locked: false,
      processActive: true,
    },
    {
      id: 'cvd-003',
      tenantId: DEMO_TENANT_ID,
      clientId: 'client-001',
      documentId: 'doc-unreleased',
      title: 'Interner Prüfbericht',
      category: 'report',
      releasedAt: null,
      requiresSignature: false,
      signatureRequired: false,
      locked: true,
      processActive: false,
    },
    {
      id: 'cvd-004',
      tenantId: DEMO_TENANT_ID,
      clientId: 'client-002',
      documentId: 'doc-other-client',
      title: 'Fremdes Dokument',
      category: 'contract',
      releasedAt: '2026-01-01T08:00:00.000Z',
      requiresSignature: false,
      signatureRequired: false,
      locked: false,
      processActive: true,
    },
  ];

  for (const doc of seeds) {
    VISIBLE_DOCUMENTS.set(doc.id, doc);
  }
}

function isReleased(doc: ClientVisibleDocument): boolean {
  return doc.releasedAt != null && !doc.locked && doc.processActive;
}

function canViewReleasedDocument(ctx: ClientPortalContext, doc: ClientVisibleDocument): boolean {
  if (!isReleased(doc)) return false;
  if (doc.tenantId !== ctx.tenantId) return false;

  const decision = canViewDocument(
    buildWorkspaceAccessContext({
      userId: ctx.profileId,
      tenantId: ctx.tenantId,
      roleKey: ctx.roleKey,
      clientId: ctx.clientId,
      sharedClientIds: ctx.sharedClientIds,
    }),
    {
      tenantId: doc.tenantId,
      clientId: doc.clientId,
      visibility: doc.clientId === ctx.clientId ? 'own' : 'shared',
      documentType: doc.category === 'invoice' ? 'invoice' : 'general',
    },
  );

  if (!decision.allowed) return false;
  return doc.clientId === ctx.clientId || ctx.sharedClientIds.includes(doc.clientId);
}

export function listReleasedDocumentsForClient(ctx: ClientPortalContext): ClientVisibleDocument[] {
  seedDemoVisibleDocuments();
  return [...VISIBLE_DOCUMENTS.values()].filter((doc) => canViewReleasedDocument(ctx, doc));
}

export function countDocumentsToSign(ctx: ClientPortalContext): number {
  return listReleasedDocumentsForClient(ctx).filter(
    (doc) => doc.signatureRequired && !hasDocumentSignature(ctx.tenantId, doc.documentId),
  ).length;
}

export function hasDocumentSignature(tenantId: string, documentId: string): boolean {
  return [...SIGNATURES.values()].some(
    (s) => s.tenantId === tenantId && s.documentId === documentId,
  );
}

export async function signClientDocument(input: {
  ctx: ClientPortalContext;
  documentId: string;
  signerName: string;
  signerRole: ClientPortalRole;
  deviceSession: string;
  capturedIp?: string | null;
}): Promise<ServiceResult<ClientDocumentSignature>> {
  const denied = enforcePermission<ClientDocumentSignature>(
    input.ctx.roleKey,
    'portal.client.documents.download',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.ctx.tenantId);
  if (tenantBlock) return tenantBlock;

  const portalAccess = canAccessClientPortal(
    buildWorkspaceAccessContext({
      userId: input.ctx.profileId,
      tenantId: input.ctx.tenantId,
      roleKey: input.ctx.roleKey,
      clientId: input.ctx.clientId,
    }),
  );
  if (!portalAccess.allowed) {
    return { ok: false, error: portalAccess.message ?? 'Kein Portalzugriff.' };
  }

  seedDemoVisibleDocuments();
  const doc = [...VISIBLE_DOCUMENTS.values()].find(
    (d) => d.documentId === input.documentId && d.tenantId === input.ctx.tenantId,
  );
  if (!doc || !canViewReleasedDocument(input.ctx, doc)) {
    return { ok: false, error: 'Dokument nicht freigegeben oder nicht sichtbar.' };
  }
  if (!doc.signatureRequired) {
    return { ok: false, error: 'Für dieses Dokument ist keine Signatur erforderlich.' };
  }
  if (doc.locked || !doc.processActive) {
    return { ok: false, error: 'Signaturprozess ist nicht aktiv.' };
  }
  if (hasDocumentSignature(input.ctx.tenantId, input.documentId)) {
    return { ok: false, error: 'Dokument wurde bereits signiert.' };
  }

  const signedAt = nowIso();
  const hashPayload = [
    input.ctx.tenantId,
    input.ctx.clientId,
    input.documentId,
    input.signerName,
    input.signerRole,
    signedAt,
    input.deviceSession,
  ].join('|');
  const signatureHash = computeDocumentContentHash(hashPayload);

  signatureCounter += 1;
  const signature: ClientDocumentSignature = {
    id: `cp-sig-${signatureCounter}`,
    tenantId: input.ctx.tenantId,
    clientId: input.ctx.clientId,
    documentId: input.documentId,
    signerName: input.signerName.trim(),
    signerRole: input.signerRole,
    signedAt,
    deviceSession: input.deviceSession,
    signatureHash,
    capturedIp: input.capturedIp ?? null,
  };

  SIGNATURES.set(signature.id, signature);

  audit({
    tenantId: input.ctx.tenantId,
    clientId: input.ctx.clientId,
    action: 'document_signed',
    actorProfileId: input.ctx.profileId,
    summary: `Dokument ${doc.title} signiert.`,
    metadata: { documentId: input.documentId, signatureHash },
  });

  return { ok: true, data: signature };
}

export function getClientDocumentSignatures(tenantId: string, clientId?: string): ClientDocumentSignature[] {
  return [...SIGNATURES.values()].filter(
    (s) => s.tenantId === tenantId && (!clientId || s.clientId === clientId),
  );
}

export function getClientDocumentSignatureAuditTrail(
  tenantId: string,
  clientId?: string,
): ClientPortalAuditEvent[] {
  return AUDIT_EVENTS.filter(
    (e) => e.tenantId === tenantId && (!clientId || e.clientId === clientId),
  );
}

export function resetClientDocumentSignatureStore(): void {
  VISIBLE_DOCUMENTS.clear();
  SIGNATURES.clear();
  AUDIT_EVENTS.length = 0;
  signatureCounter = 0;
  auditCounter = 0;
}

export function registerClientVisibleDocument(doc: ClientVisibleDocument): void {
  VISIBLE_DOCUMENTS.set(doc.id, doc);
}

export function isDocumentReleasedForPortal(
  ctx: ClientPortalContext,
  documentId: string,
): boolean {
  seedDemoVisibleDocuments();
  const doc = [...VISIBLE_DOCUMENTS.values()].find(
    (d) => d.documentId === documentId && d.tenantId === ctx.tenantId,
  );
  if (!doc) return false;
  return canViewReleasedDocument(ctx, doc);
}
