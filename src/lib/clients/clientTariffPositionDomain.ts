export type ClientTariffBillingUnit = 'minute' | 'hour' | 'visit' | 'flat' | 'unit' | 'km';
export type ClientTariffRoundingRule = 'half_up_cent' | 'ceil_cent' | 'floor_cent';

export type ClientTariffPosition = {
  id: string;
  logicalPositionId: string;
  tenantId: string;
  clientId: string;
  financingPathId: string;
  regionCode: string;
  regionName: string;
  payerAssignmentId: string | null;
  payerName: string;
  payerIk: string | null;
  serviceCode: string;
  serviceLabel: string;
  billingUnit: ClientTariffBillingUnit;
  unitPriceCents: number;
  currency: 'EUR';
  roundingRule: ClientTariffRoundingRule | null;
  surchargeBasisPoints: number | null;
  fixedSurchargeCents: number | null;
  validFrom: string;
  validUntil: string | null;
  openEnded: boolean;
  agreementReference: string;
  version: number;
  supersedesPositionId: string | null;
  createdAt: string;
};

export type ClientTariffPositionIssue =
  | 'position_identity_missing'
  | 'logical_identity_missing'
  | 'tenant_identity_missing'
  | 'client_identity_missing'
  | 'financing_path_identity_missing'
  | 'region_missing'
  | 'payer_missing'
  | 'service_missing'
  | 'billing_unit_invalid'
  | 'price_invalid'
  | 'currency_invalid'
  | 'valid_from_invalid'
  | 'valid_until_invalid'
  | 'not_started'
  | 'expired'
  | 'agreement_reference_missing'
  | 'version_invalid';

export type ClientTariffPositionAssessment = {
  position: ClientTariffPosition;
  referenceDate: string;
  state: 'applicable' | 'not_applicable' | 'incomplete';
  issues: ClientTariffPositionIssue[];
};

export type ClientTariffSelection = {
  tenantId: string;
  clientId: string;
  financingPathId: string;
  regionCode: string;
  payerAssignmentId: string | null;
  serviceCode: string;
  serviceDate: string;
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

export function assessClientTariffPosition(
  position: ClientTariffPosition,
  referenceDate: string,
): ClientTariffPositionAssessment {
  if (!isDate(referenceDate)) throw new Error('Das Leistungsdatum muss ein gültiges Kalenderdatum sein.');
  const issues: ClientTariffPositionIssue[] = [];
  if (!hasText(position.id)) issues.push('position_identity_missing');
  if (!hasText(position.logicalPositionId)) issues.push('logical_identity_missing');
  if (!hasText(position.tenantId)) issues.push('tenant_identity_missing');
  if (!hasText(position.clientId)) issues.push('client_identity_missing');
  if (!hasText(position.financingPathId)) issues.push('financing_path_identity_missing');
  if (!hasText(position.regionCode) || !hasText(position.regionName)) issues.push('region_missing');
  if (!hasText(position.payerName)) issues.push('payer_missing');
  if (!hasText(position.serviceCode) || !hasText(position.serviceLabel)) issues.push('service_missing');
  if (!['minute', 'hour', 'visit', 'flat', 'unit', 'km'].includes(position.billingUnit)) issues.push('billing_unit_invalid');
  if (!Number.isSafeInteger(position.unitPriceCents) || position.unitPriceCents <= 0) issues.push('price_invalid');
  if (position.currency !== 'EUR') issues.push('currency_invalid');
  if (!isDate(position.validFrom)) issues.push('valid_from_invalid');
  if (typeof position.openEnded !== 'boolean'
    || (position.openEnded && position.validUntil !== null)
    || (!position.openEnded && (!isDate(position.validUntil) || (isDate(position.validFrom) && position.validUntil < position.validFrom)))) {
    issues.push('valid_until_invalid');
  }
  if (isDate(position.validFrom) && position.validFrom > referenceDate) issues.push('not_started');
  if (isDate(position.validUntil) && position.validUntil < referenceDate) issues.push('expired');
  if (!hasText(position.agreementReference)) issues.push('agreement_reference_missing');
  if (!Number.isInteger(position.version) || position.version < 1) issues.push('version_invalid');
  const incomplete = issues.some((issue) => !['not_started', 'expired'].includes(issue));
  return {
    position,
    referenceDate,
    state: issues.length === 0 ? 'applicable' : incomplete ? 'incomplete' : 'not_applicable',
    issues,
  };
}

export function assessClientTariffPositions(
  positions: readonly ClientTariffPosition[],
  referenceDate: string,
): ClientTariffPositionAssessment[] {
  const ids = new Set<string>();
  for (const position of positions) {
    if (ids.has(position.id)) throw new Error('Doppelte Tarifpositionsidentität.');
    ids.add(position.id);
  }
  return positions.map((position) => assessClientTariffPosition(position, referenceDate));
}

export function selectClientTariffPosition(
  positions: readonly ClientTariffPosition[],
  selection: ClientTariffSelection,
): ClientTariffPosition | null {
  if (![selection.tenantId, selection.clientId, selection.financingPathId, selection.regionCode, selection.serviceCode].every(hasText)) {
    throw new Error('Die Tarifauswahl benötigt vollständige native Bezugsdaten.');
  }
  const applicable = assessClientTariffPositions(positions, selection.serviceDate)
    .filter(({ position, state }) => state === 'applicable'
      && position.tenantId === selection.tenantId
      && position.clientId === selection.clientId
      && position.financingPathId === selection.financingPathId
      && position.regionCode === selection.regionCode
      && position.payerAssignmentId === selection.payerAssignmentId
      && position.serviceCode === selection.serviceCode)
    .map(({ position }) => position);
  if (applicable.length > 1) throw new Error('Mehrere Tarifpositionen passen zum Leistungsdatum; keine automatische Auswahl.');
  return applicable[0] ?? null;
}
