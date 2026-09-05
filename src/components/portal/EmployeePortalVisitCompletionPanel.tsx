import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';
import { countDoneTasks } from '@/lib/portal/groupEmployeePortalTasks';
import {
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import { colors, spacing, typography } from '@/theme';

type EmployeePortalVisitCompletionPanelProps = {
  tasks: EmployeePortalTaskItem[];
  documentationSubmitted: boolean;
  signatureCaptured: boolean;
  signatureDeferred?: boolean;
  signatureApprovalPending?: boolean;
  requiresSignature: boolean;
  serviceDurationLabel?: string;
  loading?: boolean;
  deferredLoading?: boolean;
  canFinalizeDeferred?: boolean;
  onFinalize: () => void;
  onFinalizeDeferred?: (reason: string) => void;
};

type CheckItem = { label: string; done: boolean };

export function EmployeePortalVisitCompletionPanel({
  tasks,
  documentationSubmitted,
  signatureCaptured,
  signatureDeferred = false,
  signatureApprovalPending = false,
  requiresSignature,
  serviceDurationLabel,
  loading = false,
  deferredLoading = false,
  canFinalizeDeferred = false,
  onFinalize,
  onFinalizeDeferred,
}: EmployeePortalVisitCompletionPanelProps) {
  const text = employeePortalExecutionText;
  const [approvalReason, setApprovalReason] = useState('');

  const items: CheckItem[] = [
    { label: `Aufgaben optional · ${countDoneTasks(tasks)} von ${tasks.length} markiert`, done: true },
    { label: 'Dokumentation gespeichert', done: documentationSubmitted },
    {
      label: requiresSignature
        ? signatureApprovalPending
          ? 'Freigabe durch Verwaltung wird geprüft'
          : signatureDeferred
          ? 'Unterschrift ans Klient:innenportal gesendet'
          : 'Unterschrift erfasst'
        : 'Unterschrift nicht erforderlich',
      done: !requiresSignature || signatureCaptured || signatureDeferred,
    },
    { label: 'Einsatzzeit vollständig', done: Boolean(serviceDurationLabel) },
    {
      label: signatureDeferred
        ? 'Klient:in unterschreibt im Portal'
        : 'Leistungsnachweis bereit',
      done:
        signatureDeferred ||
        (documentationSubmitted && (!requiresSignature || signatureCaptured)),
    },
  ];

  const allReady = items.every((item) => item.done);
  const canFinalizeWithSignature = allReady && !signatureDeferred;

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
          backgroundColor: employeePortalExecutionSurface.subtleBackground,
          borderWidth: 1,
          borderColor: employeePortalExecutionSurface.borderStrong,
        },
        checkMark: { color: '#fff', fontWeight: '700', fontSize: 12 },
        label: { ...typography.body, color: text.primary },
        meta: { ...typography.caption, color: text.muted },
      }),
    [text],
  );

  return (
    <PremiumCard contentStyle={styles.card}>
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
        disabled={!canFinalizeWithSignature}
        onPress={onFinalize}
      />
      {canFinalizeDeferred && onFinalizeDeferred ? (
        <>
          <PremiumInput
            label="Hinweis zur Weiterleitung (optional)"
            hint="Falls ausgefüllt, wird der Hinweis mit der Portal-Anfrage dokumentiert."
            value={approvalReason}
            onChangeText={setApprovalReason}
            multiline
            onLightSurface
            placeholder="Begründung für die Weiterleitung"
          />
          <PremiumButton
            title="Direkt ans Klient:innenportal senden"
            testID="portal-finalize-deferred-button"
            variant="secondary"
            fullWidth
            loading={deferredLoading}
            disabled={!documentationSubmitted || deferredLoading || loading}
            onPress={() => onFinalizeDeferred(approvalReason.trim())}
          />
        </>
      ) : null}
      {signatureApprovalPending ? (
        <Text style={styles.meta}>
          Die Anfrage wurde direkt an das Klient:innenportal gesendet und bleibt bis zur Unterschrift offen.
        </Text>
      ) : null}
    </PremiumCard>
  );
}
