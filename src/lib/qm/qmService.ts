import type { RoleKey, ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { qmDemoRepository } from './qmRepository.demo';
import { qmSupabaseRepository } from './qmRepository.supabase';
import { enforceQmPermission, QM_VIEW } from './qmPermissions';
import type { QmDashboardSnapshot } from './qm.types';

function repo() {
  return getServiceMode() === 'supabase' ? qmSupabaseRepository : qmDemoRepository;
}

export async function fetchQmDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmDashboardSnapshot>> {
  const denied = enforceQmPermission<QmDashboardSnapshot>(actorRoleKey, QM_VIEW);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
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

  await new Promise((r) => setTimeout(r, 150));

  const chapters = await qmDemoRepository.listChapters(tenantId);
  if (!chapters.ok) return chapters;
  const documents = await qmDemoRepository.listDocuments(tenantId);
  if (!documents.ok) return documents;
  const compliance = await qmDemoRepository.listCompliance(tenantId);
  if (!compliance.ok) return compliance;
  const mdPackages = await qmDemoRepository.listMdPackages(tenantId);
  if (!mdPackages.ok) return mdPackages;
  const changes = await qmDemoRepository.listChanges(tenantId);
  if (!changes.ok) return changes;
  const audits = await qmDemoRepository.listAudits(tenantId);
  if (!audits.ok) return audits;

  const openCompliance = compliance.data.filter((c) =>
    ['open', 'in_progress', 'overdue'].includes(c.status),
  ).length;
  const pendingApprovals = documents.data.filter((d) =>
    ['in_review', 'draft'].includes(d.status),
  ).length;

  return {
    ok: true,
    data: {
      chapterCount: chapters.data.length,
      documentCount: documents.data.length,
      complianceOpenCount: openCompliance,
      mdPackageCount: mdPackages.data.length,
      pendingApprovals,
      recentChanges: changes.data.slice(0, 5),
      upcomingAudits: audits.data.filter((a) => a.status === 'planned' || a.status === 'in_progress'),
    },
  };
}

export { repo as qmRepo };
