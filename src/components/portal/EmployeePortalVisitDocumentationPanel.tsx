import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import type { EmployeePortalDocumentationInput } from '@/types/modules/employeePortalExecution';
import { spacing, typography } from '@/theme';
import { useAuroraGlass } from '@/design/tokens/auroraGlass';

type EmployeePortalVisitDocumentationPanelProps = {
  disabled?: boolean;
  loading?: boolean;
  onSubmit: (doc: EmployeePortalDocumentationInput) => Promise<{ ok: boolean; error?: string }>;
};

export type EmployeePortalVisitDocumentationPanelHandle = {
  submit: () => Promise<void>;
};

export const EmployeePortalVisitDocumentationPanel = forwardRef<
  EmployeePortalVisitDocumentationPanelHandle,
  EmployeePortalVisitDocumentationPanelProps
>(function EmployeePortalVisitDocumentationPanel(
  {
  disabled = false,
  loading = false,
  onSubmit,
  },
  ref,
) {
  const { colors } = useAuroraGlass();
  const [shortDescription, setShortDescription] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [deviations, setDeviations] = useState('');
  const [deviationJustification, setDeviationJustification] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const shortDescriptionRef = useRef('');

  const resolveShortDescription = () => {
    const fromState = shortDescription.trim() || shortDescriptionRef.current.trim();
    if (fromState) return fromState;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const el = document.querySelector(
        '[data-testid="portal-doc-short-description"]',
      ) as HTMLInputElement | HTMLTextAreaElement | null;
      return el?.value?.trim() ?? '';
    }
    return '';
  };

  const handleSubmit = useCallback(async () => {
    const effectiveShort = resolveShortDescription();
    const effectiveNotes = specialNotes.trim();
    if (!effectiveShort && !effectiveNotes) {
      setLocalError('Kurzbeschreibung ist erforderlich.');
      return;
    }
    if (deviations.trim() && !deviationJustification.trim()) {
      setLocalError('Abweichungen müssen begründet werden.');
      return;
    }
    setLocalError(null);
    const result = await onSubmit({
      shortDescription: effectiveShort || effectiveNotes,
      specialNotes: effectiveNotes || undefined,
      deviations: deviations.trim() || undefined,
      deviationJustification: deviationJustification.trim() || undefined,
      referralRequired: false,
      emergencyOrProblem: false,
    });
    if (!result.ok) {
      setLocalError(result.error ?? 'Dokumentation konnte nicht gespeichert werden.');
    }
  }, [
    deviationJustification,
    deviations,
    onSubmit,
    shortDescription,
    specialNotes,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
    }),
    [handleSubmit],
  );

  return (
    <SectionPanel title="Dokumentation" subtitle="Pflicht vor Abschluss">
      <View style={styles.fields}>
        <PremiumInput
          label="Kurzbeschreibung *"
          testID="portal-doc-short-description"
          accessibilityLabel="Kurzbeschreibung Eingabe"
          value={shortDescription}
          onChangeText={(value) => {
            shortDescriptionRef.current = value;
            setShortDescription(value);
          }}
          placeholder="Was wurde geleistet?"
          multiline
          editable={!disabled}
        />
        <PremiumInput
          label="Besonderheiten"
          value={specialNotes}
          onChangeText={setSpecialNotes}
          multiline
          editable={!disabled}
        />
        <PremiumInput
          label="Abweichungen"
          value={deviations}
          onChangeText={setDeviations}
          multiline
          editable={!disabled}
        />
        {deviations.trim() ? (
          <PremiumInput
            label="Begründung Abweichung *"
            value={deviationJustification}
            onChangeText={setDeviationJustification}
            multiline
            editable={!disabled}
          />
        ) : null}
        {!disabled ? (
          <PremiumButton
            title="Dokumentation speichern"
            testID="portal-doc-save-button"
            fullWidth
            loading={loading}
            onPress={() => {
              void handleSubmit();
            }}
          />
        ) : null}
        {localError ? <Text style={[styles.error, { color: colors.danger }]}>{localError}</Text> : null}
      </View>
    </SectionPanel>
  );
});

const styles = StyleSheet.create({
  fields: { gap: spacing.sm },
  error: { ...typography.caption },
});
