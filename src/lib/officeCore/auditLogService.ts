import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';

export type OfficeAuditEntry = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  category: string;
  icon: string;
  timestamp: string;
};

const DEMO_AUDIT: OfficeAuditEntry[] = [
  {
    id: 'audit-001',
    action: 'Klient:in zugeordnet',
    detail: 'Helga Schneider → Pflege',
    actor: 'Anna Krüger',
    category: 'Modul',
    icon: '👥',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'audit-002',
    action: 'Rechnung erstellt',
    detail: 'RE-2026-0341 · 1.245,00 €',
    actor: 'Michael Braun',
    category: 'Abrechnung',
    icon: '🧾',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 'audit-003',
    action: 'Dokument freigegeben',
    detail: 'Pflegeplan Juni 2026 — Modul Sichtbarkeit',
    actor: 'Thomas Keller',
    category: 'Dokument',
    icon: '📄',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: 'audit-004',
    action: 'Mitarbeitende zugeordnet',
    detail: 'Lisa Hartmann → Pflegefachkraft',
    actor: 'Monika Becker',
    category: 'Modul',
    icon: '👤',
    timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
  },
  {
    id: 'audit-005',
    action: 'Berechtigung geändert',
    detail: 'Assist Lesen für employee_portal',
    actor: 'System',
    category: 'Rechte',
    icon: '🔐',
    timestamp: new Date(Date.now() - 72 * 3600000).toISOString(),
  },
];

export async function fetchOfficeAuditLog(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OfficeAuditEntry[]>> {
  const denied = enforcePermission<OfficeAuditEntry[]>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const liveBlock = guardLiveDemoFeature<OfficeAuditEntry[]>(tenantId, 'Office-Audit-Log');
  if (liveBlock) return liveBlock;
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: [...DEMO_AUDIT] };
}
