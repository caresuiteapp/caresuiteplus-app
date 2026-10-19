import { woundInstant } from '../pflege/woundCareDomain.ts';

export type ClientContractBasisIssue =
  | 'contract_number_missing'
  | 'contract_partner_missing'
  | 'service_basis_missing'
  | 'contract_start_invalid'
  | 'contract_not_started'
  | 'contract_end_invalid'
  | 'contract_ended'
  | 'contract_not_active'
  | 'signature_time_missing'
  | 'document_reference_missing'
  | 'contract_version_invalid';

export type ClientContractBasisAssessment = {
  state: 'documented_current' | 'incomplete' | 'not_current';
  referenceDate: string;
  issues: ClientContractBasisIssue[];
  summary: string;
};

type ContractBasisInput = {
  contractNumber?: unknown;
  contractPartner?: unknown;
  serviceBasis?: unknown;
  contractStart?: unknown;
  contractEnd?: unknown;
  status?: unknown;
  signedAt?: unknown;
  documentId?: unknown;
  contractVersion?: unknown;
};

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year!, month! - 1, day!));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month! - 1
    && candidate.getUTCDate() === day;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Bewertet nur die dokumentierte, zeitlich aktuelle Vertragsgrundlage.
 * Das Ergebnis ist keine Signaturauthentifizierung und keine rechtliche Wirksamkeitsprüfung.
 */
export function assessClientContractBasis(
  contract: ContractBasisInput,
  referenceDate: string,
): ClientContractBasisAssessment {
  if (!isDate(referenceDate)) throw new Error('Der Prüfzeitpunkt muss ein gültiges Kalenderdatum sein.');

  const issues: ClientContractBasisIssue[] = [];
  if (!hasText(contract.contractNumber)) issues.push('contract_number_missing');
  if (!hasText(contract.contractPartner)) issues.push('contract_partner_missing');
  if (!hasText(contract.serviceBasis)) issues.push('service_basis_missing');

  if (!isDate(contract.contractStart)) issues.push('contract_start_invalid');
  else if (contract.contractStart > referenceDate) issues.push('contract_not_started');

  if (!Object.hasOwn(contract, 'contractEnd')) issues.push('contract_end_invalid');
  else if (contract.contractEnd !== null) {
    if (!isDate(contract.contractEnd)) issues.push('contract_end_invalid');
    else if (contract.contractEnd < referenceDate) issues.push('contract_ended');
  }

  if (contract.status !== 'aktiv') issues.push('contract_not_active');
  if (typeof contract.signedAt !== 'string' || woundInstant(contract.signedAt) === null) {
    issues.push('signature_time_missing');
  }
  if (!hasText(contract.documentId)) issues.push('document_reference_missing');
  if (!Number.isInteger(contract.contractVersion) || Number(contract.contractVersion) < 1) {
    issues.push('contract_version_invalid');
  }

  const outsidePeriod = issues.some((issue) =>
    issue === 'contract_not_started' || issue === 'contract_ended' || issue === 'contract_not_active');
  const state = issues.length === 0 ? 'documented_current' : outsidePeriod ? 'not_current' : 'incomplete';
  return {
    state,
    referenceDate,
    issues,
    summary: state === 'documented_current'
      ? 'Vertragsgrundlage vollständig dokumentiert und zum Prüftag zeitlich aktuell.'
      : state === 'not_current'
        ? 'Die hinterlegte Vertragsgrundlage ist zum Prüftag nicht aktuell.'
        : 'Die hinterlegte Vertragsgrundlage ist unvollständig dokumentiert.',
  };
}
