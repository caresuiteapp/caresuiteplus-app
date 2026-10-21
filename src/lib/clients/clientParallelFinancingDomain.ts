export const CLIENT_FINANCING_KINDS = ['sgb_xi', 'sgb_v', 'private', 'other'] as const;

export type ClientFinancingKind = (typeof CLIENT_FINANCING_KINDS)[number];

export const CLIENT_FINANCING_KIND_LABELS: Record<ClientFinancingKind, string> = {
  sgb_xi: 'SGB XI',
  sgb_v: 'SGB V',
  private: 'Privat',
  other: 'Sonstige Grundlage',
};

export type ClientFinancingPathIssue =
  | 'path_identity_missing'
  | 'logical_identity_missing'
  | 'tenant_identity_missing'
  | 'client_identity_missing'
  | 'financing_kind_invalid'
  | 'payer_name_missing'
  | 'basis_reference_missing'
  | 'valid_from_invalid'
  | 'valid_until_invalid'
  | 'not_started'
  | 'expired'
  | 'not_active'
  | 'version_invalid';

export type ClientFinancingPath = {
  id: string;
  logicalPathId: string;
  tenantId: string;
  clientId: string;
  financingKind: ClientFinancingKind;
  payerAssignmentId: string | null;
  payerName: string;
  payerIk: string | null;
  basisReference: string;
  validFrom: string;
  validUntil: string | null;
  status: 'draft' | 'active' | 'ended' | 'cancelled';
  version: number;
  supersedesPathId: string | null;
  createdAt: string;
};

export type ClientFinancingPathAssessment = {
  path: ClientFinancingPath;
  state: 'current' | 'incomplete' | 'not_current';
  referenceDate: string;
  issues: ClientFinancingPathIssue[];
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year!, month! - 1, day!));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month! - 1
    && candidate.getUTCDate() === day;
}

function isFinancingKind(value: unknown): value is ClientFinancingKind {
  return typeof value === 'string'
    && (CLIENT_FINANCING_KINDS as readonly string[]).includes(value);
}

export function assessClientFinancingPath(
  path: ClientFinancingPath,
  referenceDate: string,
): ClientFinancingPathAssessment {
  if (!isDate(referenceDate)) throw new Error('Der Prüftag muss ein gültiges Kalenderdatum sein.');
  const issues: ClientFinancingPathIssue[] = [];
  if (!hasText(path.id)) issues.push('path_identity_missing');
  if (!hasText(path.logicalPathId)) issues.push('logical_identity_missing');
  if (!hasText(path.tenantId)) issues.push('tenant_identity_missing');
  if (!hasText(path.clientId)) issues.push('client_identity_missing');
  if (!isFinancingKind(path.financingKind)) issues.push('financing_kind_invalid');
  if (!hasText(path.payerName)) issues.push('payer_name_missing');
  if (!hasText(path.basisReference)) issues.push('basis_reference_missing');

  if (!isDate(path.validFrom)) issues.push('valid_from_invalid');
  else if (path.validFrom > referenceDate) issues.push('not_started');

  if (!Object.hasOwn(path, 'validUntil')) issues.push('valid_until_invalid');
  else if (path.validUntil !== null) {
    if (!isDate(path.validUntil) || (isDate(path.validFrom) && path.validUntil < path.validFrom)) {
      issues.push('valid_until_invalid');
    } else if (path.validUntil < referenceDate) issues.push('expired');
  }

  if (path.status !== 'active') issues.push('not_active');
  if (!Number.isInteger(path.version) || path.version < 1) issues.push('version_invalid');

  const notCurrent = issues.some((issue) =>
    issue === 'not_started' || issue === 'expired' || issue === 'not_active');
  return {
    path,
    state: issues.length === 0 ? 'current' : notCurrent ? 'not_current' : 'incomplete',
    referenceDate,
    issues,
  };
}

/**
 * Bewertet jeden Finanzierungsweg einzeln und erhält auch zeitgleich gültige Wege.
 * Die Reihenfolge dient nur der Anzeige; sie bestimmt weder Kostenträger noch Abrechnung.
 */
export function assessParallelClientFinancingPaths(
  paths: readonly ClientFinancingPath[],
  referenceDate: string,
): ClientFinancingPathAssessment[] {
  const ids = new Set<string>();
  for (const path of paths) {
    if (ids.has(path.id)) throw new Error('Doppelte Finanzierungsweg-Identität.');
    ids.add(path.id);
  }
  return paths
    .map((path) => assessClientFinancingPath(path, referenceDate))
    .sort((left, right) => left.path.validFrom.localeCompare(right.path.validFrom)
      || left.path.id.localeCompare(right.path.id));
}
