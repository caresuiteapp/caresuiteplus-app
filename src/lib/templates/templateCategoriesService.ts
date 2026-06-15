import type { RoleKey, ServiceResult } from '@/types';
import { SYSTEM_TEMPLATE_CATEGORIES } from '@/data/demo/templates';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export type TemplateCategoryItem = {
  id: string;
  key: string;
  label: string;
  moduleKey: string;
};

export async function fetchTemplateCategories(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TemplateCategoryItem[]>> {
  const denied = enforcePermission<TemplateCategoryItem[]>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  await new Promise((r) => setTimeout(r, 140));
  return {
    ok: true,
    data: SYSTEM_TEMPLATE_CATEGORIES.map((cat) => ({
      id: cat.id,
      key: cat.key,
      label: cat.label,
      moduleKey: cat.moduleKey,
    })),
  };
}
