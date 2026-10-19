export type EmployeePortalClientVisitScopeRow = Readonly<{
  id: string;
  tenant_id: string;
  client_id: string;
  employee_id: string;
  employee_portal_visible: boolean;
  planning_status: string;
  planned_start_at: string;
  canonical_status: string | null;
  client_visible_notes: string | null;
  title: string | null;
}>;

export type EmployeePortalClientScope = Readonly<{
  tenantId: string;
  employeeId: string;
  clientIds: readonly string[];
  visits: readonly EmployeePortalClientVisitScopeRow[];
  source: 'own_visible_assignments_only';
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isEmployeePortalScopeId = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value) && value === value.toLowerCase();

/**
 * Treat the server-side assignment result as an authorization boundary, not as
 * a convenient tenant directory. Any foreign, hidden or draft row invalidates
 * the whole snapshot so it can never widen the client-record query.
 */
export function buildEmployeePortalClientScope(
  tenantId: string,
  employeeId: string,
  rows: readonly EmployeePortalClientVisitScopeRow[],
): EmployeePortalClientScope {
  if (!isEmployeePortalScopeId(tenantId) || !isEmployeePortalScopeId(employeeId) || !Array.isArray(rows)) {
    throw Error('Verlässlicher Mitarbeiterportal-Kontext fehlt.');
  }

  const visitIds = new Set<string>();
  const clientIds: string[] = [];
  const clients = new Set<string>();
  const visits = rows.map((row) => {
    if (
      !isEmployeePortalScopeId(row.id) ||
      !isEmployeePortalScopeId(row.tenant_id) ||
      !isEmployeePortalScopeId(row.client_id) ||
      !isEmployeePortalScopeId(row.employee_id) ||
      row.tenant_id !== tenantId ||
      row.employee_id !== employeeId ||
      row.employee_portal_visible !== true ||
      typeof row.planning_status !== 'string' ||
      row.planning_status.trim().toLowerCase() === 'draft' ||
      typeof row.planned_start_at !== 'string' ||
      !Number.isFinite(Date.parse(row.planned_start_at))
    ) {
      throw Error('Mitarbeiterportal-Zuweisung ist fremd, verborgen oder unvollständig.');
    }
    if (visitIds.has(row.id)) throw Error('Mitarbeiterportal-Zuweisung ist doppelt.');
    visitIds.add(row.id);
    if (!clients.has(row.client_id)) {
      clients.add(row.client_id);
      clientIds.push(row.client_id);
    }
    return Object.freeze({ ...row });
  });

  return Object.freeze({
    tenantId,
    employeeId,
    clientIds: Object.freeze(clientIds),
    visits: Object.freeze(visits),
    source: 'own_visible_assignments_only' as const,
  });
}
