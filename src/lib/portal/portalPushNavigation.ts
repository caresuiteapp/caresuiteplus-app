import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const employee = new RegExp(
  `^/portal/employee/(?:calendar|offene-einsaetze|announcements|messages(?:/${UUID})?|documents(?:/signatures(?:/${UUID})?|/${UUID})?|assignments/${UUID}/execute|profile(?:\\?pushUpdate=[1-9][0-9]{0,8})?)$`,
  'i',
);
const client = new RegExp(
  `^/portal/client/(?:appointments(?:/${UUID})?|announcements|messages(?:/${UUID})?|documents(?:/signatures(?:/${UUID})?|/${UUID})?|profile(?:\\?pushUpdate=[1-9][0-9]{0,8})?)$`,
  'i',
);
export function isAllowedPortalPushRoute(value: unknown): value is string {
  return typeof value === 'string' && (employee.test(value) || client.test(value));
}
export function portalPushDestination(
  data: Record<string, unknown> | undefined,
  session: PortalSessionRecord | null,
): string | null {
  if (
    !data ||
    !session ||
    session.mustChangePassword ||
    !(new Date(session.expiresAt).getTime() > Date.now())
  )
    return null;
  if (
    data.accountId !== session.accountId ||
    data.tenantId !== session.tenantId ||
    !isAllowedPortalPushRoute(data.route)
  )
    return null;
  if (session.roleKey === 'employee_portal' && employee.test(data.route)) return data.route;
  if (session.roleKey === 'client_portal' && client.test(data.route)) return data.route;
  return null;
}
const consumed = new Set<string>();
export function consumePortalPushResponse(id: string): boolean {
  if (!id || consumed.has(id)) return false;
  consumed.add(id);
  if (consumed.size > 500) consumed.delete(consumed.values().next().value!);
  return true;
}
