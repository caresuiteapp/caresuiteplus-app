import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CareCatalogSelect,
  CareCostBearerTypeFields,
} from '@/components/inputs';
import { PremiumButton, PremiumInput } from '@/components/ui';
import {
  COST_BEARER_FIELD_ERRORS,
  COST_BEARER_TYPE_CONFIG,
  getCostBearerFieldValues,
  hasGkvCostBearerSelected,
  isCostBearerTypeKey,
  type CostBearerTypeKey,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { validateCostBearerEntry } from '@/features/costCarriers/costCarrierService';
import type { ClientIntakeErrors, ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { colors, spacing, typography } from '@/theme';

type Props = {
  form: ClientIntakeFormData;
  errors: ClientIntakeErrors;
  onChange: (form: ClientIntakeFormData) => void;
  onFieldChange: <K extends keyof ClientIntakeFormData>(key: K, value: ClientIntakeFormData[K]) => void;
  onCommitCostBearer: () => void;
  onRemoveCostBearer: (type: CostBearerTypeKey) => void;
};

export function CareCostBearerStepPanel({
  form,
  errors,
  onChange,
  onFieldChange,
  onCommitCostBearer,
  onRemoveCostBearer,
}: Props) {
  const activeType = isCostBearerTypeKey(form.activeCostBearerType) ? form.activeCostBearerType : null;
  const committedTypes = form.costBearerTypes.filter(isCostBearerTypeKey);
  const showInsuranceNumber = hasGkvCostBearerSelected(form.costBearerTypes);

  return (
    <View style={styles.wrap}>
      {committedTypes.length > 0 ? (
        <View style={styles.committedList}>
          <Text style={styles.committedTitle}>Erfasste Kostenträger</Text>
          {committedTypes.map((type) => {
            const config = COST_BEARER_TYPE_CONFIG[type];
            const values = getCostBearerFieldValues(form, type);
            return (
              <View key={type} style={styles.committedRow}>
                <Pressable
                  style={styles.committedMain}
                  onPress={() => onFieldChange('activeCostBearerType', type)}
                >
                  <Text style={styles.committedLabel}>{config.label}</Text>
                  <Text style={styles.committedMeta}>{values.name.trim() || '—'}</Text>
                </Pressable>
                <PremiumButton
                  title="Entfernen"
                  variant="ghost"
                  onPress={() => onRemoveCostBearer(type)}
                />
              </View>
            );
          })}
        </View>
      ) : null}

      <CareCatalogSelect
        catalogKey="cost_bearer_type"
        label="Kostenträgertyp"
        value={form.activeCostBearerType}
        onChange={(value) => onFieldChange('activeCostBearerType', value)}
        error={errors.activeCostBearerType ?? errors.costBearerTypes}
      />

      {activeType ? (
        <>
          <CareCostBearerTypeFields
            type={activeType}
            form={form}
            onChange={onChange}
            error={errors[COST_BEARER_FIELD_ERRORS[activeType]] ?? errors.costBearerDraft}
          />
          <PremiumButton
            title={committedTypes.includes(activeType) ? 'Kostenträger aktualisieren' : 'Kostenträger hinzufügen'}
            variant="secondary"
            onPress={onCommitCostBearer}
          />
        </>
      ) : null}

      {showInsuranceNumber ? (
        <PremiumInput
          label="Versichertennummer / KVNR"
          value={form.insuranceNumber}
          onChangeText={(value) => onFieldChange('insuranceNumber', value)}
          error={errors.insuranceNumber}
        />
      ) : null}
    </View>
  );
}

export function validateActiveCostBearerDraft(form: ClientIntakeFormData): string | null {
  if (!isCostBearerTypeKey(form.activeCostBearerType)) return null;
  return validateCostBearerEntry(
    form.activeCostBearerType,
    getCostBearerFieldValues(form, form.activeCostBearerType),
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  committedList: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  committedTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  committedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  committedMain: { flex: 1, gap: spacing.xs },
  committedLabel: { ...typography.caption, color: colors.textSecondary },
  committedMeta: { ...typography.body, color: colors.textPrimary },
});
