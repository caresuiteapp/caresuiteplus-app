import type { SystemCostCarrierType } from '@/lib/catalogs/systemCostCarrierTemplates';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';

export const COST_BEARER_TYPE_KEYS = [
  'pflegekasse',
  'krankenkasse',
  'privatversicherung',
  'sozialamt',
  'beihilfe',
  'selbstzahler',
  'berufsgenossenschaft',
  'unfallversicherung',
  'sonstiger',
] as const;

export type CostBearerTypeKey = (typeof COST_BEARER_TYPE_KEYS)[number];

export const MANUAL_COST_BEARER_TYPES: CostBearerTypeKey[] = ['beihilfe', 'selbstzahler', 'sonstiger'];

export const TEMPLATE_COST_BEARER_TYPES: CostBearerTypeKey[] = [
  'pflegekasse',
  'krankenkasse',
  'privatversicherung',
  'sozialamt',
  'berufsgenossenschaft',
  'unfallversicherung',
];

export type CostBearerFieldBinding = {
  name: keyof ClientIntakeFormData;
  street: keyof ClientIntakeFormData;
  zip: keyof ClientIntakeFormData;
  city: keyof ClientIntakeFormData;
  ikNumber?: keyof ClientIntakeFormData;
};

export type CostBearerTypeConfig = {
  label: string;
  manualOnly: boolean;
  templateType?: SystemCostCarrierType;
  fields: CostBearerFieldBinding;
};

export const COST_BEARER_TYPE_CONFIG: Record<CostBearerTypeKey, CostBearerTypeConfig> = {
  pflegekasse: {
    label: 'Pflegekasse',
    manualOnly: false,
    templateType: 'pflegekasse',
    fields: {
      name: 'careFundName',
      street: 'careFundStreet',
      zip: 'careFundZip',
      city: 'careFundCity',
      ikNumber: 'costBearerIk',
    },
  },
  krankenkasse: {
    label: 'Krankenkasse',
    manualOnly: false,
    templateType: 'krankenkasse',
    fields: {
      name: 'healthInsurance',
      street: 'healthInsuranceStreet',
      zip: 'healthInsuranceZip',
      city: 'healthInsuranceCity',
      ikNumber: 'healthInsuranceIk',
    },
  },
  privatversicherung: {
    label: 'Privatversicherung',
    manualOnly: false,
    templateType: 'privatversicherung',
    fields: {
      name: 'privatversicherungName',
      street: 'privatversicherungStreet',
      zip: 'privatversicherungZip',
      city: 'privatversicherungCity',
      ikNumber: 'privatversicherungIk',
    },
  },
  sozialamt: {
    label: 'Sozialamt',
    manualOnly: false,
    templateType: 'sozialamt',
    fields: {
      name: 'sozialamtName',
      street: 'sozialamtStreet',
      zip: 'sozialamtZip',
      city: 'sozialamtCity',
      ikNumber: 'sozialamtIk',
    },
  },
  beihilfe: {
    label: 'Beihilfe',
    manualOnly: true,
    fields: {
      name: 'beihilfeName',
      street: 'beihilfeStreet',
      zip: 'beihilfeZip',
      city: 'beihilfeCity',
    },
  },
  selbstzahler: {
    label: 'Selbstzahler',
    manualOnly: true,
    fields: {
      name: 'selbstzahlerName',
      street: 'selbstzahlerStreet',
      zip: 'selbstzahlerZip',
      city: 'selbstzahlerCity',
    },
  },
  berufsgenossenschaft: {
    label: 'Berufsgenossenschaft',
    manualOnly: false,
    templateType: 'berufsgenossenschaft',
    fields: {
      name: 'berufsgenossenschaftName',
      street: 'berufsgenossenschaftStreet',
      zip: 'berufsgenossenschaftZip',
      city: 'berufsgenossenschaftCity',
      ikNumber: 'berufsgenossenschaftIk',
    },
  },
  unfallversicherung: {
    label: 'Unfallversicherung',
    manualOnly: false,
    templateType: 'unfallversicherung',
    fields: {
      name: 'unfallversicherungName',
      street: 'unfallversicherungStreet',
      zip: 'unfallversicherungZip',
      city: 'unfallversicherungCity',
      ikNumber: 'unfallversicherungIk',
    },
  },
  sonstiger: {
    label: 'Sonstiger Kostenträger',
    manualOnly: true,
    fields: {
      name: 'sonstigerName',
      street: 'sonstigerStreet',
      zip: 'sonstigerZip',
      city: 'sonstigerCity',
    },
  },
};

export function isCostBearerTypeKey(value: string): value is CostBearerTypeKey {
  return (COST_BEARER_TYPE_KEYS as readonly string[]).includes(value);
}

export function getCostBearerFieldValues(
  form: ClientIntakeFormData,
  type: CostBearerTypeKey,
): { name: string; street: string; zip: string; city: string; ikNumber: string } {
  const { fields } = COST_BEARER_TYPE_CONFIG[type];
  return {
    name: String(form[fields.name] ?? ''),
    street: String(form[fields.street] ?? ''),
    zip: String(form[fields.zip] ?? ''),
    city: String(form[fields.city] ?? ''),
    ikNumber: fields.ikNumber ? String(form[fields.ikNumber] ?? '') : '',
  };
}

export function applyCostBearerFieldValues(
  form: ClientIntakeFormData,
  type: CostBearerTypeKey,
  values: { name: string; street: string; zip: string; city: string; ikNumber: string },
): ClientIntakeFormData {
  const { fields } = COST_BEARER_TYPE_CONFIG[type];
  const next = { ...form, [fields.name]: values.name, [fields.street]: values.street, [fields.zip]: values.zip, [fields.city]: values.city };
  if (fields.ikNumber) {
    next[fields.ikNumber] = values.ikNumber;
  }
  return next;
}

export function clearCostBearerTypeFields(
  form: ClientIntakeFormData,
  type: CostBearerTypeKey,
): ClientIntakeFormData {
  return applyCostBearerFieldValues(form, type, { name: '', street: '', zip: '', city: '', ikNumber: '' });
}

export function clearDeselectedCostBearerTypes(
  form: ClientIntakeFormData,
  nextTypes: string[],
): ClientIntakeFormData {
  let next = { ...form, costBearerTypes: nextTypes };
  for (const type of form.costBearerTypes) {
    if (!nextTypes.includes(type) && isCostBearerTypeKey(type)) {
      next = clearCostBearerTypeFields(next, type);
    }
  }
  return next;
}

export function resolvePrimaryCostBearerName(form: ClientIntakeFormData): string | null {
  for (const type of form.costBearerTypes) {
    if (!isCostBearerTypeKey(type)) continue;
    const name = getCostBearerFieldValues(form, type).name.trim();
    if (name) return name;
  }
  return null;
}

export function resolvePrimaryCostBearerReference(form: ClientIntakeFormData): string | null {
  for (const type of form.costBearerTypes) {
    if (!isCostBearerTypeKey(type)) continue;
    const values = getCostBearerFieldValues(form, type);
    if (values.ikNumber.trim()) return `IK ${values.ikNumber.trim()}`;
    const address = [values.street, values.zip, values.city].filter(Boolean).join(', ');
    if (address) return address;
  }
  return null;
}

/** Maps Kostenträgertyp to the primary name field used for validation errors. */
export const COST_BEARER_FIELD_ERRORS: Record<CostBearerTypeKey, keyof ClientIntakeFormData> = {
  pflegekasse: 'careFundName',
  krankenkasse: 'healthInsurance',
  privatversicherung: 'privatversicherungName',
  sozialamt: 'sozialamtName',
  beihilfe: 'beihilfeName',
  selbstzahler: 'selbstzahlerName',
  berufsgenossenschaft: 'berufsgenossenschaftName',
  unfallversicherung: 'unfallversicherungName',
  sonstiger: 'sonstigerName',
};

export function hasGkvCostBearerSelected(types: string[]): boolean {
  return types.includes('pflegekasse') || types.includes('krankenkasse');
}
