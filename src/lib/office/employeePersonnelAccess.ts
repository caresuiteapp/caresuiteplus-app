import type { RoleKey } from '@/types/core/auth';
import type {
  EmployeeDocumentRecord,
  EmployeePersonnelFile,
  EmployeePersonnelTabKey,
} from '@/types/modules/employeePersonnelFile';
import {
  ADMIN_ROLES_FOR_SENSITIVE_PERSONNEL,
  getEmployeePersonnelTabsForRole,
  SENSITIVE_DOCUMENT_CATEGORIES,
} from './employeePersonnelFieldRules';
import {
  buildWorkspaceAccessContext,
} from '@/lib/permissions/workspaceAccess';
import type { WorkspaceAccessContext } from '@/types/permissions/workspace';
import { hasPermission } from '@/lib/permissions';
import { isClientPortalRole, isEmployeePortalRole } from '@/lib/permissions/workspaceRoles';

export type PersonnelAccessContext = WorkspaceAccessContext & {
  targetEmployeeId: string;
};

export function buildPersonnelAccessContext(input: {
  tenantId: string;
  roleKey: RoleKey | null;
  userId?: string | null;
  employeeId?: string | null;
  targetEmployeeId: string;
}): PersonnelAccessContext {
  return {
    ...buildWorkspaceAccessContext({
      tenantId: input.tenantId,
      roleKey: input.roleKey,
      userId: input.userId ?? 'demo-user',
      employeeId: input.employeeId ?? null,
    }),
    targetEmployeeId: input.targetEmployeeId,
  };
}

export function assertPersonnelTenantScope(
  ctx: PersonnelAccessContext,
  tenantId: string,
): { allowed: false; reason: string } | null {
  if (ctx.tenantId !== tenantId) {
    return { allowed: false, reason: 'Kein mandantenübergreifender Zugriff auf Personalakten.' };
  }
  return null;
}

/** Regel 6 — Personalakten nicht für Klient:innenportale */
export function canViewEmployeePersonnelFile(ctx: PersonnelAccessContext): {
  allowed: boolean;
  reason?: string;
} {
  if (isClientPortalRole(ctx.roleKey)) {
    return { allowed: false, reason: 'Personalakten sind für Klient:innenportale nicht sichtbar.' };
  }

  if (isEmployeePortalRole(ctx.roleKey) || ctx.roleKey === 'employee_portal') {
    if (ctx.employeeId !== ctx.targetEmployeeId) {
      return { allowed: false, reason: 'Mitarbeitende sehen nur die eigene freigegebene Personalakte.' };
    }
    return { allowed: true };
  }

  if (!hasPermission(ctx.roleKey, 'office.employees.view')) {
    return { allowed: false, reason: 'Keine Berechtigung für Mitarbeitenden-Personalakte.' };
  }

  return { allowed: true };
}

/** Regel 4/8 — Sensible Dokumente nur für autorisierte Admin-Rollen */
export function canViewSensitivePersonnelDocument(
  ctx: PersonnelAccessContext,
  document: Pick<EmployeeDocumentRecord, 'category' | 'sensitive'>,
): boolean {
  if (!SENSITIVE_DOCUMENT_CATEGORIES.has(document.category) && !document.sensitive) return true;
  return ctx.roleKey != null && ADMIN_ROLES_FOR_SENSITIVE_PERSONNEL.includes(ctx.roleKey);
}

export function filterPersonnelDocumentsForViewer(
  ctx: PersonnelAccessContext,
  documents: EmployeeDocumentRecord[],
): EmployeeDocumentRecord[] {
  return documents.filter((doc) => {
    if (isEmployeePortalRole(ctx.roleKey) && !doc.releasedToPortal) return false;
    return canViewSensitivePersonnelDocument(ctx, doc);
  });
}

/** Regel 7 — Portal-Sichtbarkeit */
export function filterPersonnelFileForPortal(
  file: EmployeePersonnelFile,
  ctx: PersonnelAccessContext,
): EmployeePersonnelFile {
  const tabs = getEmployeePersonnelTabsForRole(ctx.roleKey);
  return {
    ...file,
    tabs,
    documents: filterPersonnelDocumentsForViewer(ctx, file.documents),
    backgroundCheck: {
      ...file.backgroundCheck,
      documentId: canViewSensitivePersonnelDocument(ctx, {
        category: 'background_check',
        sensitive: true,
      })
        ? file.backgroundCheck.documentId
        : null,
    },
    auditEvents: isEmployeePortalRole(ctx.roleKey) ? [] : file.auditEvents,
  };
}

export function resolveVisiblePersonnelTabs(roleKey: RoleKey | null): EmployeePersonnelTabKey[] {
  return getEmployeePersonnelTabsForRole(roleKey);
}
