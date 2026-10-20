import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PremiumButton } from '@/components/ui';
import {
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import { careSpacing } from '@/design/tokens/spacing';
import {
  formatDeviationDirectionLabel,
  WFM_DEVIATION_JUSTIFICATION_MIN_LENGTH,
} from '@/lib/wfm/wfmVisitDeviationAmpelService';
import type { WfmDeviationEvaluation, WfmDeviationPhase } from '@/types/modules/wfmOfficeTimekeeping';
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View style={styles.card} testID="visit-deviation-readable-modal">
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="time-outline" size={25} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>{title}</Text>
            </View>

            <View style={styles.metrics}>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>GEPLANT</Text>
                <Text style={styles.metricValue}>{formatWfmTime(evaluation.plannedAt)}</Text>
                <Text style={styles.metricLabel}>{evaluation.plannedAt ? new Date(evaluation.plannedAt).toLocaleDateString('de-DE') : 'Datum fehlt'}</Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>TATSÄCHLICH</Text>
                <Text style={styles.metricValue}>{formatWfmTime(evaluation.actualAt)}</Text>
                <Text style={styles.metricLabel}>{evaluation.actualAt ? new Date(evaluation.actualAt).toLocaleDateString('de-DE') : 'Datum fehlt'}</Text>
              </View>
            </View>

            <View style={styles.deviationSummary}>
              <Text style={styles.deviationValue}>{evaluation.deviationMinutes} Min. Abweichung</Text>
              <Text style={styles.deviationDetail}>
                {formatDeviationDirectionLabel(evaluation.direction, phase)}
              </Text>
            </View>

            <Text style={styles.hint}>{hint}</Text>

            <Text style={styles.inputLabel}>
              Begründung (mindestens {WFM_DEVIATION_JUSTIFICATION_MIN_LENGTH} Zeichen)
            </Text>
            <TextInput
              accessibilityLabel="Begründung der Einsatzzeitabweichung"
              value={justification}
              onChangeText={setJustification}
              multiline
              style={styles.input}
              placeholder="Bitte erklären Sie die Abweichung…"
              placeholderTextColor={employeePortalExecutionText.muted}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <PremiumButton
                title="Abbrechen"
                variant="ghost"
                onPress={onCancel}
                disabled={loading}
                fullWidth
              />
              <PremiumButton
                title={submitLabel}
                onPress={handleSubmit}
                loading={loading}
                disabled={justification.trim().length < WFM_DEVIATION_JUSTIFICATION_MIN_LENGTH}
                fullWidth
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 27, 51, 0.45)',
    justifyContent: 'center',
    padding: careSpacing.lg,
  },
  card: {
    borderRadius: 24,
    maxWidth: 520,
    maxHeight: '92%',
    alignSelf: 'center',
    width: '100%',
    backgroundColor: employeePortalExecutionSurface.background,
    borderWidth: 1,
    borderColor: employeePortalExecutionSurface.borderStrong,
    overflow: 'hidden',
  },
  content: { padding: careSpacing.lg, gap: careSpacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: careSpacing.sm },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#056CE8',
  },
  title: {
    ...typography.h3,
    color: employeePortalExecutionText.primary,
    flex: 1,
  },
  metrics: {
    flexDirection: 'row',
    gap: careSpacing.sm,
  },
  metricCell: {
    flex: 1,
    padding: careSpacing.sm,
    borderRadius: 14,
    backgroundColor: employeePortalExecutionSurface.subtleBackground,
    borderWidth: 1,
    borderColor: employeePortalExecutionSurface.border,
  },
  metricLabel: {
    ...typography.caption,
    color: employeePortalExecutionText.secondary,
    fontWeight: '800',
  },
  metricValue: {
    ...typography.bodyStrong,
    color: employeePortalExecutionText.primary,
    marginTop: 2,
  },
  deviationSummary: {
    padding: careSpacing.md,
    borderRadius: 14,
    backgroundColor: '#EAF4FF',
    borderWidth: 1,
    borderColor: '#84BEFF',
  },
  deviationValue: {
    ...typography.bodyStrong,
    color: '#061B35',
  },
  deviationDetail: {
    ...typography.caption,
    color: '#365672',
    marginTop: 2,
  },
  hint: {
    ...typography.body,
    color: employeePortalExecutionText.primary,
    lineHeight: 24,
  },
  inputLabel: {
    ...typography.caption,
    color: employeePortalExecutionText.primary,
    fontWeight: '800',
  },
  input: {
    ...typography.body,
    color: employeePortalExecutionText.primary,
    borderWidth: 1,
    borderColor: employeePortalExecutionSurface.borderStrong,
    borderRadius: 14,
    minHeight: 128,
    padding: careSpacing.md,
    textAlignVertical: 'top',
    backgroundColor: employeePortalExecutionSurface.inputBackground,
  },
  error: {
    ...typography.caption,
    color: '#B4233A',
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'column',
    gap: careSpacing.sm,
  },
});
