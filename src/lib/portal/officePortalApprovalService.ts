import type { ServiceResult } from '@/types';
import { listClientPortalAccessRequests } from '@/lib/client/clientPortalSettingsService';
import { listVisitProofs } from '@/lib/assist/assistVisitProofPersistenceService';
import { listPendingPortalUploads } from '@/lib/portal/assist/portalDocumentUploadService';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';

export type PortalApprovalKind = 'proof' | 'upload' | 'access_request';

export type PortalApprovalItem = {
  id: string;
  kind: PortalApprovalKind;
  title: string;
  subtitle: string;
  clientId: string | null;
  createdAt: string;
  status: string;
};

export async function listPendingPortalApprovals(
  tenantId: string,
  options?: { clientId?: string; limit?: number },
): Promise<ServiceResult<PortalApprovalItem[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const limit = options?.limit ?? 50;
    const items: PortalApprovalItem[] = [];

    const [proofsResult, uploadsResult] = await Promise.all([
      listVisitProofs(tenantId, { status: 'pending_review', limit }),
      listPendingPortalUploads(tenantId, { clientId: options?.clientId, limit }),
    ]);

    if (proofsResult.ok) {
      for (const proof of proofsResult.data) {
        items.push({
          id: proof.id,
          kind: 'proof',
          title: proof.proofNumber ?? `Nachweis ${proof.id.slice(0, 8)}`,
          subtitle: `Einsatz ${proof.visitId.slice(0, 8)} · ${proof.status}`,
          clientId: null,
          createdAt: proof.createdAt,
          status: proof.status,
        });
      }
    }

    if (uploadsResult.ok) {
      for (const upload of uploadsResult.data) {
        items.push({
          id: upload.id,
          kind: 'upload',
          title: upload.fileName,
          subtitle: `Portal-Upload · ${upload.status}`,
          clientId: upload.clientId,
          createdAt: upload.createdAt,
          status: upload.status,
        });
      }
    }

    if (options?.clientId) {
      const requestsResult = await listClientPortalAccessRequests(tenantId, options.clientId);
      if (requestsResult.ok) {
        for (const req of requestsResult.data.filter((r) => r.status === 'pending')) {
          items.push({
            id: req.id,
            kind: 'access_request',
            title: req.requesterName,
            subtitle: `Zugangsanfrage · ${req.requestType}`,
            clientId: req.clientId,
            createdAt: req.createdAt,
            status: req.status,
          });
        }
      }
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ok: true, data: items.slice(0, limit) };
  });
}
