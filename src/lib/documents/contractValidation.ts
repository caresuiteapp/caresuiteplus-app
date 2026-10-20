import type { ContractRecord, ContractTypeKey } from '@/types/documents/contract';
import { CONTRACT_TYPES_REQUIRING_COMPENSATION } from '@/types/documents/contract';
import type { TemplateValidationIssue, TemplateValidationResult } from '@/features/documents/templateEngine/types';

function requiresCompensation(contractType: ContractTypeKey): boolean {
  return CONTRACT_TYPES_REQUIRING_COMPENSATION.includes(contractType);
}

export function validateContractRecord(contract: ContractRecord): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  if (!contract.contractNumber?.trim()) {
    issues.push({
      code: 'contract_number_missing',
      message: 'Vertragsnummer fehlt.',
      fieldKey: 'contract.number',
      severity: 'error',
    });
  }

  if (!contract.partyA.name?.trim() || !contract.partyB.name?.trim()) {
    issues.push({
      code: 'parties_missing',
      message: 'Vertragsparteien fehlen.',
      fieldKey: 'contract.party_a',
      severity: 'error',
    });
  }

  if (!contract.companyData.legalName?.trim()) {
    issues.push({
      code: 'company_data_missing',
      message: 'Unternehmensdaten fehlen.',
      fieldKey: 'company.legal_name',
      severity: 'error',
    });
  }

  if (!contract.clientData.name?.trim()) {
    issues.push({
      code: 'client_data_missing',
      message: 'Klientendaten fehlen.',
      fieldKey: 'client.full_name',
      severity: 'error',
    });
  }

  if (!contract.serviceDescription?.trim()) {
    issues.push({
      code: 'service_description_missing',
      message: 'Leistungsbeschreibung fehlt.',
      fieldKey: 'contract.service_description',
      severity: 'error',
    });
  }

  if (requiresCompensation(contract.contractType)) {
    if (!contract.compensation?.trim() && !contract.hourlyRate?.trim()) {
      issues.push({
        code: 'compensation_missing',
        message: 'Vergütung oder Stundensatz fehlt.',
        fieldKey: 'contract.hourly_rate',
        severity: 'error',
      });
    }
  }

  if (!contract.noticePeriod?.trim()) {
    issues.push({
      code: 'notice_period_missing',
      message: 'Kündigungsfrist fehlt.',
      fieldKey: 'contract.notice_period',
      severity: 'error',
    });
  }

  if (!contract.privacySection?.trim()) {
    issues.push({
      code: 'privacy_section_missing',
      message: 'Datenschutzabschnitt fehlt.',
      fieldKey: 'contract.privacy_clause',
      severity: 'error',
    });
  }

  if (!contract.termStart?.trim()) {
    issues.push({
      code: 'term_missing',
      message: 'Vertragslaufzeit fehlt.',
      fieldKey: 'contract.start_date',
      severity: 'error',
    });
  }

  if (!contract.previewConfirmed) {
    issues.push({
      code: 'preview_required',
      message: 'Vorschau muss bestätigt sein.',
      severity: 'error',
    });
  }

  return {
    status: issues.some((i) => i.severity === 'error') ? 'error' : 'valid',
    issues,
  };
}

export function contractToDocumentContext(contract: ContractRecord) {
  return {
    company: {
      name: contract.companyData.legalName,
      legal_name: contract.companyData.legalName,
      street: contract.companyData.street,
      zip: contract.companyData.zip,
      city: contract.companyData.city,
      tax_id: contract.companyData.taxId,
      ik_number: contract.companyData.ikNumber,
    },
    client: {
      full_name: contract.clientData.name,
      customer_number: contract.clientData.customerNumber,
      care_level: contract.clientData.careLevel,
      street: contract.clientData.street,
      zip: contract.clientData.zip,
      city: contract.clientData.city,
    },
    contract: {
      number: contract.contractNumber ?? '',
      type: contract.contractType,
      date: contract.contractDate,
      party_a: contract.partyA.name,
      party_b: contract.partyB.name,
      start_date: contract.termStart,
      end_date: contract.termEnd,
      hourly_rate: contract.hourlyRate,
      compensation: contract.compensation,
      billing_type: contract.billingType,
      payment_terms: contract.paymentTerms,
      notice_period: contract.noticePeriod,
      service_description: contract.serviceDescription,
      privacy_clause: contract.privacySection,
      confidentiality: contract.confidentialityConsents,
      liability: contract.liabilityClause,
      final_provisions: contract.finalProvisions,
      place_and_date: contract.placeAndDate,
    },
    signature: {
      company: contract.signatures.companySigned ? 'Unterschrieben' : '',
      client: contract.signatures.clientSigned ? 'Unterschrieben' : '',
      legal_rep: contract.signatures.legalRepSigned ? 'Unterschrieben' : '',
      employee: contract.signatures.employeeSigned ? 'Unterschrieben' : '',
    },
  };
}

export const STANDARD_CONTRACT_HTML_TEMPLATE = `<div class="cs-contract" data-doc-type="contract">
<div class="cs-block-logo">{{company.name}}</div>
<h1>Vertrag {{contract.number}} — {{contract.type}}</h1>
<p>Datum: {{contract.date}} · Ort/Datum: {{contract.place_and_date}}</p>
<section>
<h2>Vertragsparteien</h2>
<p>Partei A: {{contract.party_a}}</p>
<p>Partei B: {{contract.party_b}}</p>
<p>Klient:in: {{client.full_name}} · K-Nr.: {{client.customer_number}}</p>
</section>
<section>
<h2>Leistung & Vergütung</h2>
<p>{{contract.service_description}}</p>
<p>Vergütung: {{contract.compensation}} · Stundensatz: {{contract.hourly_rate}}</p>
<p>Abrechnungsart: {{contract.billing_type}} · Zahlungsbedingungen: {{contract.payment_terms}}</p>
</section>
<section>
<h2>Laufzeit & Kündigung</h2>
<p>Laufzeit: {{contract.start_date}} – {{contract.end_date}}</p>
<p>Kündigungsfrist: {{contract.notice_period}}</p>
</section>
<section>
<h2>Datenschutz & Haftung</h2>
<p>{{contract.privacy_clause}}</p>
<p>{{contract.confidentiality}}</p>
<p>{{contract.liability}}</p>
<p>{{contract.final_provisions}}</p>
</section>
<section class="cs-signatures">
<p>Unternehmen: {{signature.company}}</p>
<p>Klient:in: {{signature.client}}</p>
<p>Vertretungsberechtigt: {{signature.legal_rep}}</p>
<p>Mitarbeitende:r: {{signature.employee}}</p>
</section>
</div>`;

export function getContractTemplateVersionId(contractType: ContractTypeKey): string {
  return `dtplv-contract-${contractType}`;
}

/** Nur registrierte Platzhalter — für Lifecycle-Finalisierung */
export const FINALIZE_CONTRACT_HTML_TEMPLATE = `<h1>Vertrag {{contract.number}}</h1>
<p>{{contract.party_a}} — {{contract.party_b}}</p>
<p>{{client.full_name}}</p>
<p>{{contract.service_description}}</p>
<p>{{contract.hourly_rate}} · {{contract.notice_period}}</p>
<p>{{contract.start_date}} – {{contract.end_date}}</p>
<p>{{contract.privacy_clause}}</p>
<p>{{signature.name}} · {{signature.date}}</p>`;
