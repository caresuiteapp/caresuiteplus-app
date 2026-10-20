import { StyleSheet, Text, View } from 'react-native';
import { InfoBanner, PremiumButton, SectionPanel } from '@/components/ui';
import type { ElectronicInvoiceData } from '@/types/documents/invoice';
import { EINVOICE_DISCLAIMER } from '@/types/documents/invoice';
import { colors, spacing, typography } from '@/theme';

type Props = {
  eInvoiceState: {
    engineInfo: { productionAvailable: boolean; message: string };
    canCheck: boolean;
    canGenerateXml: boolean;
    canGeneratePdfPlusXml: boolean;
    status: string;
    validationErrors: string[];
    isComplete?: boolean;
  };
  eInvoiceData?: ElectronicInvoiceData | null;
  onCheck: () => void;
  onGenerateXml?: () => void;
  onGeneratePdfXml?: () => void;
  loading?: boolean;
};

export function InvoiceEInvoicePanel({
  eInvoiceState,
  eInvoiceData,
  onCheck,
  onGenerateXml,
  onGeneratePdfXml,
  loading,
}: Props) {
  return (
    <SectionPanel title="E-Rechnung" subtitle="Strukturell vorbereitet">
      <InfoBanner variant="info" message={EINVOICE_DISCLAIMER} />

      <Text style={styles.status}>
        Status: {eInvoiceState.status}
        {eInvoiceData?.electronicInvoiceFormat ? ` · Format: ${eInvoiceData.electronicInvoiceFormat}` : ''}
      </Text>

      {eInvoiceState.validationErrors.length > 0 ? (
        <View style={styles.errors}>
          {eInvoiceState.validationErrors.map((err) => (
            <Text key={err} style={styles.errorLine}>
              • {err}
            </Text>
          ))}
        </View>
      ) : eInvoiceState.isComplete ? (
        <InfoBanner variant="success" message="E-Rechnungsdaten vollständig (Validator folgt)." />
      ) : null}

      <View style={styles.actions}>
        <PremiumButton title="E-Rechnungsdaten prüfen" onPress={onCheck} loading={loading} />
        <PremiumButton
          title="XML erzeugen"
          variant="secondary"
          onPress={onGenerateXml}
          disabled={!eInvoiceState.canGenerateXml}
        />
        <PremiumButton
          title="PDF + XML erzeugen"
          variant="secondary"
          onPress={onGeneratePdfXml}
          disabled={!eInvoiceState.canGeneratePdfPlusXml}
        />
      </View>

      {!eInvoiceState.engineInfo.productionAvailable ? (
        <Text style={styles.hint}>Export-Buttons deaktiviert — Engine nicht produktiv.</Text>
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  status: { ...typography.body, marginBottom: spacing.sm },
  errors: { gap: spacing.xs, marginBottom: spacing.sm },
  errorLine: { ...typography.caption, color: colors.danger },
  actions: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
