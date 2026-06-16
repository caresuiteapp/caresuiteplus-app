import {
  COST_BEARER_TYPE_CONFIG,
  getCostBearerFieldValues,
  isCostBearerTypeKey,
  type CostBearerTypeKey,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { CareCostBearerManualFields } from '@/components/inputs/CareCostBearerManualFields';
import { CareCostCarrierTemplateSearch } from '@/components/inputs/CareCostCarrierTemplateSearch';

type Props = {
  type: string;
  form: ClientIntakeFormData;
  onChange: (form: ClientIntakeFormData) => void;
  error?: string;
};

export function CareCostBearerTypeFields({ type, form, onChange, error }: Props) {
  if (!isCostBearerTypeKey(type)) return null;

  const config = COST_BEARER_TYPE_CONFIG[type];
  const values = getCostBearerFieldValues(form, type);

  const handleChange = (nextValues: typeof values) => {
    const { fields } = config;
    const next: ClientIntakeFormData = {
      ...form,
      [fields.name]: nextValues.name,
      [fields.street]: nextValues.street,
      [fields.zip]: nextValues.zip,
      [fields.city]: nextValues.city,
    };
    if (fields.ikNumber) {
      next[fields.ikNumber] = nextValues.ikNumber;
    }
    onChange(next);
  };

  if (config.manualOnly) {
    return (
      <CareCostBearerManualFields
        label={config.label}
        values={values}
        onChange={handleChange}
        error={error}
      />
    );
  }

  return (
    <CareCostCarrierTemplateSearch
      label={config.label}
      carrierType={config.templateType!}
      values={values}
      onChange={handleChange}
      error={error}
    />
  );
}

export function orderedSelectedCostBearerTypes(types: string[]): CostBearerTypeKey[] {
  return types.filter(isCostBearerTypeKey);
}
