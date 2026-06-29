import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import type { EmployeePortalDocumentationInput } from '@/types/modules/employeePortalExecution';
import { spacing } from '@/theme';

type EmployeePortalVisitDocumentationPanelProps = {
  disabled?: boolean;
  loading?: boolean;
  onSubmit: (doc: EmployeePortalDocumentationInput) => Promise<{ ok: boolean; error?: string }>;
};

export function EmployeePortalVisitDocumentationPanel({
  disabled = false,
  loading = false,
  onSubmit,
}: EmployeePortalVisitDocumentationPanelProps) {
  const [shortDescription, setShortDescription] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [deviations, setDeviations] = useState('');
  const [deviationJustification, setDeviationJustification] = useState('');

  const handleSubmit = () =>
    onSubmit({
      shortDescription,
      specialNotes: specialNotes || undefined,
      deviations: deviations || undefined,
      deviationJustification: deviationJustification || undefined,
      referralRequired: false,
      emergencyOrProblem: false,
    });

  return (
    <SectionPanel title="Dokumentation" subtitle="Pflicht vor Abschluss">
      <View style={styles.fields}>
        <PremiumInput
          label="Kurzbeschreibung *"
          value={shortDescription}
          onChangeText={setShortDescription}
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
            fullWidth
            loading={loading}
            onPress={handleSubmit}
          />
        ) : null}
      </View>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.sm },
});
