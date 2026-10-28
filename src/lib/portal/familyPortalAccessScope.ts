export type FamilyPortalCapability =
  | 'appointments'
  | 'documents'
  | 'messages'
  | 'send_messages'
  | 'service_records'
  | 'invoices'
  | 'download_documents'
  | 'confirm_appointments'
  | 'sign_records';

export type FamilyPortalAccessScope = Readonly<{
  tenantId: string;
  accountId: string;
  clientId: string;
  relativeContactId: string;
  validFrom: string;
  expiresAt: string | null;
  permissions: Readonly<Record<FamilyPortalCapability, boolean>>;
  source: 'authenticated_family_portal_scope';
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_MICRO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const id = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const time = (value: unknown): value is string =>
  typeof value === 'string' && ISO_MICRO.test(value) && Number.isFinite(Date.parse(value));

const fields: Record<FamilyPortalCapability, string> = {
  appointments: 'can_view_appointments',
  documents: 'can_view_documents',
  messages: 'can_view_messages',
  send_messages: 'can_send_messages',
  service_records: 'can_view_service_records',
  invoices: 'can_view_invoices',
  download_documents: 'can_download_documents',
  confirm_appointments: 'can_confirm_appointments',
  sign_records: 'can_sign_records',
};

export function decodeFamilyPortalAccessScope(
  row: Record<string, unknown> | null | undefined,
  expected: { tenantId: string; accountId: string },
  nowMs = Date.now(),
): FamilyPortalAccessScope | null {
  if (!row || !id(expected.tenantId) || !id(expected.accountId)) return null;
  if (
    row.tenant_id !== expected.tenantId ||
    row.account_id !== expected.accountId ||
    !id(row.client_id) ||
    !id(row.relative_contact_id) ||
    !time(row.valid_from) ||
    (row.expires_at !== null && !time(row.expires_at))
  ) return null;
  if (Date.parse(row.valid_from) > nowMs) return null;
  if (typeof row.expires_at === 'string' && Date.parse(row.expires_at) <= nowMs) return null;

  const permissions = Object.fromEntries(
    Object.entries(fields).map(([capability, column]) => [capability, row[column] === true]),
  ) as Record<FamilyPortalCapability, boolean>;

  return Object.freeze({
    tenantId: expected.tenantId,
    accountId: expected.accountId,
    clientId: row.client_id,
    relativeContactId: row.relative_contact_id,
    validFrom: row.valid_from,
    expiresAt: row.expires_at as string | null,
    permissions: Object.freeze(permissions),
    source: 'authenticated_family_portal_scope' as const,
  });
}

export function familyPortalScopeIsCurrent(
  scope: FamilyPortalAccessScope | null | undefined,
  nowMs = Date.now(),
): scope is FamilyPortalAccessScope {
  return !!scope && Number.isFinite(nowMs) && time(scope.validFrom) && Date.parse(scope.validFrom) <= nowMs &&
    (scope.expiresAt === null || time(scope.expiresAt) && Date.parse(scope.expiresAt) > nowMs);
}

export const familyPortalAllows = (
  scope: FamilyPortalAccessScope | null | undefined,
  capability: FamilyPortalCapability,
  nowMs = Date.now(),
): boolean => familyPortalScopeIsCurrent(scope, nowMs) && scope.permissions[capability] === true;

/** Presentation/data-loader ceiling; authenticated server rules stay authoritative. */
export function familyPortalFeatureAllowed(
  context: {
    roleKey?: string | null;
    tenantId?: string | null;
    clientId?: string | null;
    familyAccess?: FamilyPortalAccessScope | null;
  },
  feature: string,
): boolean {
  if (context.roleKey !== 'family_portal') return true;
  const scope = context.familyAccess;
  if (!familyPortalScopeIsCurrent(scope) || scope.tenantId !== context.tenantId || scope.clientId !== context.clientId) return false;
  if (feature === 'hilfe') return true;
  const capabilities: Partial<Record<string, FamilyPortalCapability>> = {
    appointments: 'appointments', betreuung: 'appointments', trips: 'appointments', care_team: 'appointments',
    documents: 'documents', messages: 'messages', nachweise: 'service_records', invoices: 'invoices',
  };
  const capability = capabilities[feature];
  // Mixed activity/request feeds, uploads, budgets and clinical modules have
  // no matching individual family grant. They must not inherit a client grant.
  return capability !== undefined && familyPortalAllows(scope, capability);
}
