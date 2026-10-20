import type { RoleKey, ServiceResult } from '@/types';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { qmSupabaseRepository } from './qmRepository.supabase';
import { qmDemoRepository } from './qmRepository.demo';
import { getServiceMode } from '@/lib/services/mode';
import { enforceQmPermission, QM_VIEW } from './qmPermissions';
import type { QmDashboardSnapshot } from './qm.types';

export async function fetchQmDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmDashboardSnapshot>> {
  const denied = enforceQmPermission<QmDashboardSnapshot>(actorRoleKey, QM_VIEW);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'demo') {
    const chapters = await qmDemoRepository.listChapters(tenantId);
    if (!chapters.ok) return chapters as ServiceResult<QmDashboardSnapshot>;
    const docs = await qmDemoRepository.listDocuments(tenantId);
    if (!docs.ok) return docs as ServiceResult<QmDashboardSnapshot>;
    const pkgs = await qmDemoRepository.listMdPackages(tenantId);
    if (!pkgs.ok) return pkgs as ServiceResult<QmDashboardSnapshot>;
    const store = qmDemoRepository.getStore();
    return {
      ok: true,
      data: {
        chapterCount: chapters.data.length,
        documentCount: docs.data.length,
        complianceOpenCount: store.compliance.filter((item) => item.status !== 'fulfilled').length,
        mdPackageCount: pkgs.data.length,
        pendingApprovals: docs.data.filter((document) => ['in_review', 'draft'].includes(document.status)).length,
        recentChanges: store.changes.slice(0, 5),
        upcomingAudits: store.audits.slice(0, 5),
      },
    };
  }

  const chapters = await qmSupabaseRepository.listChaptersMapped(tenantId);
  if (!chapters.ok) return chapters as ServiceResult<QmDashboardSnapshot>;
  const docs = await qmSupabaseRepository.listDocumentsMapped(tenantId);
  if (!docs.ok) return docs as ServiceResult<QmDashboardSnapshot>;
  const pkgs = await qmSupabaseRepository.listMdPackages(tenantId);
  if (!pkgs.ok) return pkgs as ServiceResult<QmDashboardSnapshot>;
  const pendingApprovals = docs.data.filter((d) =>
    ['in_review', 'draft'].includes(d.status),
  ).length;
  return {
    ok: true,
    data: {
      chapterCount: chapters.data.length,
      documentCount: docs.data.length,
      complianceOpenCount: 0,
      mdPackageCount: (pkgs.data as unknown[]).length,
      pendingApprovals,
      recentChanges: [],
      upcomingAudits: [],
    },
  };
}

export { qmSupabaseRepository as qmRepo };
