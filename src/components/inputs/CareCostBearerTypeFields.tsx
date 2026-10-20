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
  tenantId?: string;
  error?: string;
};

export function CareCostBearerTypeFields({ type, form, onChange, tenantId, error }: Props) {
  if (!isCostBearerTypeKey(type)) return null;

  const config = COST_BEARER_TYPE_CONFIG[type];
  const values = getCostBearerFieldValues(form, type);
  const systemTemplateId = form.costBearerTemplateIds[type];
  const dbCarrierType = form.costBearerDbTypes[type];

  const handleChange = (nextValues: typeof values & { systemTemplateId?: string; carrierType?: string }) => {
    const { fields } = config;
    const next: ClientIntakeFormData = {
      ...form,
      [fields.name]: nextValues.name,
      [fields.street]: nextValues.street,
      [fields.zip]: nextValues.zip,
      [fields.city]: nextValues.city,
      costBearerTemplateIds: { ...form.costBearerTemplateIds },
      costBearerDbTypes: { ...form.costBearerDbTypes },
    };
    if (nextValues.systemTemplateId) {
      next.costBearerTemplateIds[type] = nextValues.systemTemplateId;
    } else {
      delete next.costBearerTemplateIds[type];
    }
    if (nextValues.carrierType) {
      next.costBearerDbTypes[type] = nextValues.carrierType;
    } else {
      delete next.costBearerDbTypes[type];
    }
    if (fields.ikNumber) {
      onChange({ ...next, [fields.ikNumber]: nextValues.ikNumber });
      return;
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
        hint={
          type === 'selbstzahler'
            ? 'Rechnungsempfänger und Adresse manuell erfassen.'
            : undefined
        }
      />
    );
  }

  return (
    <CareCostCarrierTemplateSearch
      label={config.label}
      uiCarrierType={type}
      tenantId={tenantId}
      values={{
        ...values,
        systemTemplateId,
        carrierType: dbCarrierType,
      }}
      onChange={handleChange}
      error={error}
    />
  );
}

export function orderedSelectedCostBearerTypes(types: string[]): CostBearerTypeKey[] {
  return types.filter(isCostBearerTypeKey);
}
