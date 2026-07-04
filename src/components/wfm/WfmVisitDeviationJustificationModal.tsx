import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import {
  formatDeviationDirectionLabel,
  WFM_DEVIATION_JUSTIFICATION_MIN_LENGTH,
} from '@/lib/wfm/wfmVisitDeviationAmpelService';
import type { WfmDeviationEvaluation, WfmDeviationPhase } from '@/types/modules/wfmOfficeTimekeeping';
import { WFM_DEVIATION_AMPEL_LABELS } from '@/types/modules/wfmOfficeTimekeeping';
import { formatWfmTime } from '@/lib/wfm/wfmDisplayHelpers';
import { typography } from '@/theme';

type Props = {
  visible: boolean;
  phase: WfmDeviationPhase;
  evaluation: WfmDeviationEvaluation;
  loading?: boolean;
  error?: string | null;
  onSubmit: (justification: string) => void;
  onCancel: () => void;
};

export function WfmVisitDeviationJustificationModal({
  visible,
  phase,
  evaluation,
  loading = false,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const text = useAuroraAdaptiveText();
  const [justification, setJustification] = useState('');

  const title =
    phase === 'start'
      ? 'Abweichung zur geplanten Einsatzzeit'
      : 'Abweichung zur geplanten Einsatz-Endzeit';

  const hint =
    phase === 'start'
      ? 'Der Einsatz weicht deutlich von der geplanten Startzeit ab. Bitte geben Sie vor dem Start eine schriftliche Erklärung ab. Ohne Erklärung kann der Einsatz nicht gestartet werden.'
      : 'Das Einsatzende weicht deutlich von der geplanten Endzeit ab. Bitte geben Sie vor dem Abschluss eine schriftliche Erklärung ab. Ohne Erklärung kann der Einsatz nicht abgeschlossen werden.';

  const submitLabel =
    phase === 'start'
      ? 'Erklärung absenden und Einsatz starten'
      : 'Erklärung absenden und Einsatz beenden';

  const handleSubmit = () => {
    onSubmit(justification);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={[styles.title, { color: text.primary }]}>{title}</Text>

          <Text style={{ color: text.secondary, ...typography.caption, marginBottom: careSpacing.sm }}>
            Geplant: {formatWfmTime(evaluation.plannedAt)} · Tatsächlich:{' '}
            {formatWfmTime(evaluation.actualAt)}
          </Text>
          <Text style={{ color: text.secondary, ...typography.caption, marginBottom: careSpacing.sm }}>
            Abweichung: {evaluation.deviationMinutes} Min. ·{' '}
            {formatDeviationDirectionLabel(evaluation.direction, phase)} · Ampel:{' '}
            {WFM_DEVIATION_AMPEL_LABELS[evaluation.ampel]}
          </Text>

          <Text style={{ color: text.secondary, ...typography.body, marginBottom: careSpacing.md }}>
            {hint}
          </Text>

          <Text style={{ color: text.primary, ...typography.caption, marginBottom: 4 }}>
            Begründung (min. {WFM_DEVIATION_JUSTIFICATION_MIN_LENGTH} Zeichen)
          </Text>
          <TextInput
            value={justification}
            onChangeText={setJustification}
            multiline
            style={[styles.input, { color: text.primary, borderColor: text.border }]}
            placeholder="Bitte erklären Sie die Abweichung…"
            placeholderTextColor={text.muted}
          />

          {error ? (
            <Text style={{ color: '#c0392b', ...typography.caption, marginTop: careSpacing.sm }}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <PremiumButton title="Abbrechen" variant="ghost" onPress={onCancel} disabled={loading} />
            <PremiumButton title={submitLabel} onPress={handleSubmit} loading={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: careSpacing.lg,
  },
  card: {
    borderRadius: 12,
    padding: careSpacing.lg,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    ...typography.h3,
    marginBottom: careSpacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 96,
    padding: careSpacing.sm,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: careSpacing.sm,
    marginTop: careSpacing.md,
    flexWrap: 'wrap',
  },
});
