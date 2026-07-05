import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumCard } from '@/components/ui';
import { countDoneTasks } from '@/lib/portal/groupEmployeePortalTasks';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import { colors, spacing, typography } from '@/theme';

type EmployeePortalVisitCompletionPanelProps = {
  tasks: EmployeePortalTaskItem[];
  documentationSubmitted: boolean;
  signatureCaptured: boolean;
  requiresSignature: boolean;
  serviceDurationLabel?: string;
  loading?: boolean;
  onFinalize: () => void;
};

type CheckItem = { label: string; done: boolean };

export function EmployeePortalVisitCompletionPanel({
  tasks,
  documentationSubmitted,
  signatureCaptured,
  requiresSignature,
  serviceDurationLabel,
  loading = false,
  onFinalize,
}: EmployeePortalVisitCompletionPanelProps) {
  const text = useAuroraAdaptiveText();
  const tasksDone = tasks.length === 0 || countDoneTasks(tasks) === tasks.length;

  const items: CheckItem[] = [
    { label: 'Aufgaben geprüft', done: tasksDone },
    { label: 'Dokumentation gespeichert', done: documentationSubmitted },
    {
      label: requiresSignature ? 'Unterschrift erfasst' : 'Unterschrift nicht erforderlich',
      done: !requiresSignature || signatureCaptured,
    },
    { label: 'Einsatzzeit vollständig', done: Boolean(serviceDurationLabel) },
    {
      label: 'Leistungsnachweis bereit',
      done: documentationSubmitted && (!requiresSignature || signatureCaptured),
    },
  ];

  const allReady = items.every((item) => item.done);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { padding: spacing.md, gap: spacing.sm },
        title: { ...typography.bodyStrong, color: text.primary },
        row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        check: {
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.success,
        },
        pending: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: auroraGlass.innerBorder,
        },
        checkMark: { color: '#fff', fontWeight: '700', fontSize: 12 },
        label: { ...typography.body, color: text.primary },
        meta: { ...typography.caption, color: text.muted },
      }),
    [text],
  );

  return (
    <PremiumCard style={styles.card}>
      <Text style={styles.title}>Einsatz abschließen</Text>
      {serviceDurationLabel ? <Text style={styles.meta}>Dauer: {serviceDurationLabel}</Text> : null}
      {items.map((item) => (
        <View key={item.label} style={styles.row}>
          <View style={[styles.check, !item.done ? styles.pending : null]}>
            {item.done ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
      <PremiumButton
        title="Einsatz abschließen"
        testID="portal-finalize-button"
        fullWidth
        loading={loading}
        disabled={!allReady}
        onPress={onFinalize}
      />
    </PremiumCard>
  );
}
