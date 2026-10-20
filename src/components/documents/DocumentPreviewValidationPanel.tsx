import { StyleSheet, Text, View } from 'react-native';
import { InfoBanner, PremiumButton, SectionPanel } from '@/components/ui';
import type { RenderTemplateResult, TemplateValidationResult } from '@/features/documents/templateEngine';
import { getActionAvailability } from '@/lib/ui/actionAvailability';
import { colors, spacing, typography } from '@/theme';

type Props = {
  renderResult: RenderTemplateResult | null;
  finalizeBlocked?: boolean;
  onFinalize?: () => void;
  finalizeLabel?: string;
};

function ValidationList({ validation }: { validation: TemplateValidationResult }) {
  if (validation.issues.length === 0) {
    return <InfoBanner variant="success" message="Alle Pflichtfelder sind befüllt." />;
  }

  const errors = validation.issues.filter((i) => i.severity === 'error');
  const warnings = validation.issues.filter((i) => i.severity === 'warning');

  return (
    <View style={styles.issueList}>
      {errors.map((issue, idx) => (
        <Text key={`e-${issue.code}-${idx}`} style={styles.error}>
          • {issue.message}
        </Text>
      ))}
      {warnings.map((issue, idx) => (
        <Text key={`w-${issue.code}-${idx}`} style={styles.warning}>
          • {issue.message}
        </Text>
      ))}
    </View>
  );
}

export function DocumentPreviewValidationPanel({
  renderResult,
  finalizeBlocked,
  onFinalize,
  finalizeLabel = 'Dokument finalisieren',
}: Props) {
  if (!renderResult) return null;

  const hasErrors = renderResult.validation.status === 'error';
  const unresolved = renderResult.unresolvedPlaceholders;
  const finalizeAvailability = getActionAvailability('document.finalize', {
    hasRequiredData: !(finalizeBlocked ?? hasErrors),
  });

  return (
    <SectionPanel title="Live-Vorschau — Prüfung">
      {unresolved.length > 0 ? (
        <InfoBanner
          variant="warning"
          message={`${unresolved.length} Platzhalter ohne Wert in der Vorschau markiert.`}
        />
      ) : null}

      <ValidationList validation={renderResult.validation} />

      {renderResult.missingRequiredFields.length > 0 ? (
        <Text style={styles.meta}>
          Fehlende Pflichtfelder: {renderResult.missingRequiredFields.join(', ')}
        </Text>
      ) : null}

      {onFinalize ? (
        <PremiumButton
          title={finalizeLabel}
          onPress={finalizeAvailability.enabled ? onFinalize : undefined}
          disabled={!finalizeAvailability.enabled}
        />
      ) : null}

      {finalizeAvailability.disabledReason && !finalizeAvailability.enabled ? (
        <Text style={styles.blockHint}>{finalizeAvailability.disabledReason}</Text>
      ) : null}

      {hasErrors ? (
        <Text style={styles.blockHint}>Finalisierung blockiert — Pflichtfelder fehlen.</Text>
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  issueList: { gap: spacing.xs },
  error: { ...typography.body, color: colors.danger },
  warning: { ...typography.body, color: colors.warning },
  meta: { ...typography.caption, color: colors.textMuted },
  blockHint: { ...typography.caption, color: colors.danger },
});
