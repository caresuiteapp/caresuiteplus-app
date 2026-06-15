import type { RoleKey, ServiceResult } from '@/types';
import type { PortalDocumentDetail, PortalDocumentListItem } from '@/types/portal/documents';
import type { PortalScope } from '@/types/portal';
import { demoPortalDocuments } from '@/data/demo/documents';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { runService } from '@/lib/services/serviceRunner';
import { filterPortalEntities, resolvePortalScope } from './portalVisibility';

const SIMULATED_DELAY_MS = 350;

function isClientPortalRole(roleKey: RoleKey | null): boolean {
  return roleKey === 'client_portal' || roleKey === 'family_portal';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapDocumentListItem(
  doc: (typeof demoPortalDocuments)[number],
): PortalDocumentListItem {
  return {
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    category: doc.category,
    fileSizeBytes: doc.fileSizeBytes,
    status: doc.status,
    updatedAt: doc.updatedAt,
    visibility: doc.visibility,
    sensitivity: doc.sensitivity,
  };
}

export async function fetchPortalDocuments(
  profileId: string,
  roleKey: RoleKey | null,
  options?: { simulateError?: boolean; simulateEmpty?: boolean },
): Promise<ServiceResult<PortalDocumentListItem[]>> {
  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    if (options?.simulateError) {
      return {
        ok: false,
        error: 'Dokumente konnten nicht geladen werden. Bitte erneut versuchen.',
      };
    }

    if (!profileId || !roleKey) {
      return { ok: false, error: 'Kein Profil für Dokumentenabruf vorhanden.' };
    }

    const employeeDenied = enforcePermission<PortalDocumentListItem[]>(
      roleKey,
      'portal.employee.documents.view',
    );
    if (employeeDenied && roleKey === 'employee_portal') return employeeDenied;

    const clientDenied = enforcePermission<PortalDocumentListItem[]>(
      roleKey,
      'portal.client.documents.view',
    );
    if (clientDenied && isClientPortalRole(roleKey)) return clientDenied;

    if (options?.simulateEmpty) {
      return { ok: true, data: [] };
    }

    const scope: PortalScope = resolvePortalScope(roleKey);
    const portalDocs = demoPortalDocuments.filter((doc) => doc.audienceScope === 'portal');
    const visible = filterPortalEntities(portalDocs, profileId, scope);

    return { ok: true, data: visible.map(mapDocumentListItem) };
  });
}

export async function fetchOfficeDocuments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: { simulateError?: boolean; simulateEmpty?: boolean },
): Promise<ServiceResult<PortalDocumentListItem[]>> {
  const denied = enforcePermission<PortalDocumentListItem[]>(
    actorRoleKey,
    'office.documents.view',
  );
  if (denied) return denied;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    if (options?.simulateError) {
      return {
        ok: false,
        error: 'Office-Dokumente konnten nicht geladen werden. Bitte erneut versuchen.',
      };
    }

    if (tenantId !== DEMO_TENANT_ID) {
      return { ok: false, error: 'Mandant nicht gefunden.' };
    }

    if (options?.simulateEmpty) {
      return { ok: true, data: [] };
    }

    const data = demoPortalDocuments
      .filter((doc) => doc.audienceScope === 'office')
      .map(mapDocumentListItem);

    return { ok: true, data };
  });
}

const DOCUMENT_DESCRIPTIONS: Record<string, string> = {
  'doc-001': 'Zusammenfassung Ihrer Einsätze im Mai — zur eigenen Dokumentation.',
  'doc-002': 'Aktueller Dienstplan für Ihr Team in Kalenderwoche 23.',
  'doc-003': 'Aktueller Pflegeplan — freigegeben für Ihr Klient:innenportal.',
  'doc-004': 'Rechnungsübersicht für den Leistungszeitraum Mai 2026.',
};

export async function fetchPortalDocumentDetail(
  documentId: string,
  profileId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalDocumentDetail>> {
  const employeeDenied = enforcePermission<PortalDocumentDetail>(
    roleKey,
    'portal.employee.documents.view',
  );
  if (employeeDenied && roleKey === 'employee_portal') return employeeDenied;

  const clientDenied = enforcePermission<PortalDocumentDetail>(
    roleKey,
    'portal.client.documents.view',
  );
  if (clientDenied && isClientPortalRole(roleKey)) return clientDenied;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    if (!profileId || !roleKey) {
      return { ok: false, error: 'Kein Profil für Dokumentenabruf vorhanden.' };
    }

    const scope: PortalScope = resolvePortalScope(roleKey);
    const portalDocs = demoPortalDocuments.filter((doc) => doc.audienceScope === 'portal');
    const visible = filterPortalEntities(portalDocs, profileId, scope);
    const doc = visible.find((d) => d.id === documentId);

    if (!doc) {
      return { ok: false, error: 'Dokument nicht gefunden oder nicht freigegeben.' };
    }

    return {
      ok: true,
      data: {
        ...mapDocumentListItem(doc),
        createdAt: doc.createdAt,
        description: DOCUMENT_DESCRIPTIONS[doc.id] ?? null,
        downloadReady: doc.status !== 'gesperrt',
      },
    };
  });
}

export async function downloadPortalDocument(
  documentId: string,
  profileId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<{ fileName: string; mimeType: string }>> {
  if (roleKey === 'employee_portal') {
    const denied = enforcePermission<{ fileName: string; mimeType: string }>(
      roleKey,
      'portal.employee.documents.download',
    );
    if (denied) return denied;
  } else if (isClientPortalRole(roleKey)) {
    const denied = enforcePermission<{ fileName: string; mimeType: string }>(
      roleKey,
      'portal.client.documents.download',
    );
    if (denied) return denied;
  } else {
    return { ok: false, error: 'Keine Berechtigung zum Download.' };
  }

  const detail = await fetchPortalDocumentDetail(documentId, profileId, roleKey);
  if (!detail.ok) return detail;

  if (!detail.data.downloadReady) {
    return { ok: false, error: 'Dieses Dokument steht aktuell nicht zum Download bereit.' };
  }

  return runService(async () => {
    await delay(500);
    return {
      ok: true,
      data: {
        fileName: detail.data.fileName,
        mimeType: detail.data.mimeType,
      },
    };
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
