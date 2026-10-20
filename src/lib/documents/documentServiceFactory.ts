import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

export type DomainDocument = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  status: string;
};

export type DomainDocumentService = {
  wpNumber: number;
  domain: string;
  listDocuments: (
    tenantId: string,
    actorRoleKey?: RoleKey | null,
  ) => Promise<ServiceResult<DomainDocument[]>>;
};

export function createDocumentService(
  wpNumber: number,
  domain: string,
  permission: Parameters<typeof enforcePermission>[1],
  documents: DomainDocument[],
): DomainDocumentService {
  return {
    wpNumber,
    domain,
    async listDocuments(tenantId, actorRoleKey) {
      const denied = enforcePermission<DomainDocument[]>(actorRoleKey, permission);
      if (denied) return denied;
      if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Mandant nicht gefunden.' };
      await new Promise((r) => setTimeout(r, 180));
      return { ok: true, data: documents };
    },
  };
}
