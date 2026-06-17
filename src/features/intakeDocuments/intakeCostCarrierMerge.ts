import {
  COST_BEARER_TYPE_CONFIG,
  getCostBearerFieldValues,
  isCostBearerTypeKey,
  resolvePrimaryCostBearerName,
  type CostBearerTypeKey,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { formatSalutation } from '@/lib/formatters/unitFormatters';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';

function buildAssignmentSubtitle(selected: CostBearerTypeKey[]): string {
  if (selected.length === 1 && selected[0] === 'beihilfe') {
    return 'zur Direktabrechnung mit der Beihilfe-Stelle';
  }
  if (selected.includes('pflegekasse')) {
    return 'zur Direktabrechnung mit der Pflegekasse gemäß § 13 Abs. 3 SGB XI i. V. m. § 13 SGB V';
  }
  if (selected.includes('krankenkasse')) {
    return 'zur Direktabrechnung mit der Krankenkasse gemäß § 13 SGB V';
  }
  return 'zur Direktabrechnung mit dem Kostenträger';
}

function buildUncoveredCostsClause(selected: CostBearerTypeKey[]): string {
  if (selected.length === 1 && selected[0] === 'beihilfe') {
    return 'Kosten, die nicht oder nicht vollständig von der Beihilfe-Stelle übernommen werden, werden mir gesondert in Rechnung gestellt.';
  }
  if (selected.includes('pflegekasse')) {
    return 'Kosten, die nicht oder nicht vollständig von der Pflegekasse übernommen werden, werden mir gesondert in Rechnung gestellt.';
  }
  if (selected.includes('krankenkasse')) {
    return 'Kosten, die nicht oder nicht vollständig von der Krankenkasse übernommen werden, werden mir gesondert in Rechnung gestellt.';
  }
  return 'Kosten, die nicht oder nicht vollständig vom Kostenträger übernommen werden, werden mir gesondert in Rechnung gestellt.';
}

function selectedCostBearerTypes(form: ClientIntakeFormData): CostBearerTypeKey[] {
  return form.costBearerTypes.filter(isCostBearerTypeKey);
}

function clientAddressLine(form: ClientIntakeFormData): string {
  const streetLine = [form.street, form.houseNumber].filter(Boolean).join(' ').trim();
  return [streetLine, form.zip.trim(), form.city.trim()].filter(Boolean).join(', ');
}

function formatBeihilfeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Beihilfe';
  return trimmed.toLowerCase().startsWith('beihilfe') ? trimmed : `Beihilfe ${trimmed}`;
}

export function buildCostCarrierMergeFields(
  form: ClientIntakeFormData,
  tenantName: string,
): Record<string, string> {
  const selected = selectedCostBearerTypes(form);
  const partyParts: string[] = [];
  const recipientItems: string[] = [];

  for (const type of selected) {
    const config = COST_BEARER_TYPE_CONFIG[type];
    const values = getCostBearerFieldValues(form, type);
    const name = values.name.trim();
    if (!name) continue;

    partyParts.push(`${config.label}: ${name}`);

    let item = `<li><strong>${config.label}:</strong> ${name}`;
    if (values.ikNumber.trim()) {
      item += ` (IK: ${values.ikNumber.trim()})`;
    }
    item += ';</li>';
    recipientItems.push(item);
  }

  const primaryType = selected[0];
  const primaryValues = primaryType ? getCostBearerFieldValues(form, primaryType) : null;
  const primaryLabel = primaryType ? COST_BEARER_TYPE_CONFIG[primaryType].label : '';
  const primaryName = resolvePrimaryCostBearerName(form) ?? primaryValues?.name.trim() ?? '';

  const careFund = getCostBearerFieldValues(form, 'pflegekasse');
  const healthInsurance = getCostBearerFieldValues(form, 'krankenkasse');
  const beihilfe = getCostBearerFieldValues(form, 'beihilfe');

  return {
    'cost_carrier.parties_line': partyParts.join(' · '),
    'cost_carrier.recipients_list': recipientItems.join('\n'),
    'cost_carrier.primary_name': primaryName,
    'cost_carrier.primary_label': primaryLabel,
    'cost_carrier.primary_ik': primaryValues?.ikNumber.trim() ?? '',
    'cost_carrier.care_fund_name': selected.includes('pflegekasse') ? careFund.name.trim() : '',
    'cost_carrier.care_fund_ik': selected.includes('pflegekasse') ? careFund.ikNumber.trim() : '',
    'cost_carrier.health_insurance_name': selected.includes('krankenkasse') ? healthInsurance.name.trim() : '',
    'cost_carrier.beihilfe_name': selected.includes('beihilfe') ? beihilfe.name.trim() : '',
    'cost_carrier.assignment_intro': buildAssignmentIntro(form, tenantName, selected),
    'cost_carrier.assignment_subtitle': buildAssignmentSubtitle(selected),
    'cost_carrier.uncovered_costs_clause': buildUncoveredCostsClause(selected),
    'cost_carrier.billing_clause': buildBillingClause(form, selected),
    'cost_carrier.direct_billing_target': buildDirectBillingTarget(form, selected),
  };
}

function buildAssignmentIntro(
  form: ClientIntakeFormData,
  tenantName: string,
  selected: CostBearerTypeKey[],
): string {
  if (selected.length === 0) return '';

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
  const prefix = `Ich, ${formatSalutation(form.salutation)} ${fullName}, geboren am ${formatDate(form.dateOfBirth)}, wohnhaft ${clientAddressLine(form)}, trete hiermit unwiderruflich — bis auf weiteres und unter Vorbehalt des Widerrufs gemäß § 7 — sämtliche Ansprüche auf Erstattung von Pflege- und Betreuungsleistungen, die mir gegenüber`;

  if (selected.length === 1 && selected[0] === 'beihilfe') {
    const name = formatBeihilfeName(getCostBearerFieldValues(form, 'beihilfe').name);
    return `${prefix} der <strong>${name}</strong> zustehen, an den Leistungserbringer <strong>${tenantName}</strong> ab.`;
  }

  if (selected.includes('pflegekasse')) {
    const pk = getCostBearerFieldValues(form, 'pflegekasse');
    const ik = pk.ikNumber.trim() ? ` (Institutionskennzeichen: ${pk.ikNumber.trim()})` : '';
    return `${prefix} der Pflegekasse <strong>${pk.name.trim()}</strong>${ik} zustehen, an den Leistungserbringer <strong>${tenantName}</strong> ab.`;
  }

  if (selected.includes('krankenkasse')) {
    const kk = getCostBearerFieldValues(form, 'krankenkasse');
    const ik = kk.ikNumber.trim() ? ` (Institutionskennzeichen: ${kk.ikNumber.trim()})` : '';
    return `${prefix} der Krankenkasse <strong>${kk.name.trim()}</strong>${ik} zustehen, an den Leistungserbringer <strong>${tenantName}</strong> ab.`;
  }

  const label = COST_BEARER_TYPE_CONFIG[selected[0]].label;
  const name = getCostBearerFieldValues(form, selected[0]).name.trim();
  return `${prefix} ${label} <strong>${name}</strong> zustehen, an den Leistungserbringer <strong>${tenantName}</strong> ab.`;
}

function buildBillingClause(form: ClientIntakeFormData, selected: CostBearerTypeKey[]): string {
  const billingTypes = form.billingTypes.join(', ') || 'vereinbarte Abrechnungsart';

  if (selected.length === 1 && selected[0] === 'beihilfe') {
    const name = formatBeihilfeName(getCostBearerFieldValues(form, 'beihilfe').name);
    return `Abrechnung über ${billingTypes} mit der <strong>${name}</strong>, soweit erstattungsfähige Leistungen vorliegen.`;
  }

  if (selected.includes('pflegekasse')) {
    const name = getCostBearerFieldValues(form, 'pflegekasse').name.trim();
    return `Abrechnung über ${billingTypes} mit der Pflegekasse <strong>${name}</strong>, sofern eine wirksame Abtretungserklärung vorliegt.`;
  }

  if (selected.includes('krankenkasse')) {
    const name = getCostBearerFieldValues(form, 'krankenkasse').name.trim();
    return `Abrechnung über ${billingTypes} mit der Krankenkasse <strong>${name}</strong>, soweit gesetzliche Erstattungsansprüche bestehen.`;
  }

  const primary = resolvePrimaryCostBearerName(form);
  if (primary) {
    return `Abrechnung über ${billingTypes} mit Kostenträger <strong>${primary}</strong>.`;
  }

  return `Abrechnung über ${billingTypes}.`;
}

function buildDirectBillingTarget(form: ClientIntakeFormData, selected: CostBearerTypeKey[]): string {
  if (selected.length === 1 && selected[0] === 'beihilfe') {
    return 'meiner Beihilfe-Stelle';
  }
  if (selected.includes('pflegekasse')) {
    return 'meiner Pflegekasse';
  }
  if (selected.includes('krankenkasse')) {
    return 'meiner Krankenkasse';
  }
  return 'meinem Kostenträger';
}

export function buildFamilyDoctorClause(form: ClientIntakeFormData): string {
  const gp = form.familyDoctor.trim();
  if (gp) {
    return `meine:n behandelnde:n Hausärzt:in <strong>${gp}</strong>`;
  }
  return 'meine behandelnden Ärzt:innen';
}
