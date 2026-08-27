import { Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  PlatformModal,
  type PlatformModalAction,
} from '@/components/layout/platform/platformmodal';
import { PremiumButton, LoadingState, ErrorState } from '@/components/ui';
import { HealthOSStatusBadge } from '@/components/healthos';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalAppointmentDetail } from '@/hooks/usePortalAppointmentDetail';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { portalPremium } from '@/design/tokens/portalPremium';

type EmployeePortalAssignmentPreviewSheetProps = {
  assignmentId: string | null;
  visible: boolean;
  onClose: () => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export function EmployeePortalAssignmentPreviewSheet({
  assignmentId,
  visible,
  onClose,
}: EmployeePortalAssignmentPreviewSheetProps) {
  const router = useRouter();
  const { isPhone } = useDeviceClass();
  const { data, loading, error, refresh, fromCache } = usePortalAppointmentDetail(
    visible ? (assignmentId ?? undefined) : undefined,
  );

  const canStartExecution = data?.canStartExecution ?? false;
  const canOpenExecution = data?.canOpenExecution ?? canStartExecution;
  const executionRoute = data?.executionRoute;

  const openRoute = () => {
    if (!data?.location?.trim()) return;
    const encoded = encodeURIComponent(data.location);
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`);
  };

  const openDetails = () => {
    if (!data) return;
    onClose();
    router.push(`/portal/employee/assignments/${data.id}` as never);
  };

  const openExecution = () => {
    if (!executionRoute) return;
    onClose();
    router.push(executionRoute as never);
  };

  const footerActions: PlatformModalAction[] = data
    ? isPhone
      ? [
          {
            title: 'Details öffnen',
            variant: canOpenExecution ? 'secondary' : 'primary',
            onPress: openDetails,
          },
          ...(canOpenExecution && executionRoute
            ? [
                {
                  title: canStartExecution ? 'Zur Durchführung' : 'Dokumentation fortsetzen',
                  variant: 'primary' as const,
                  onPress: openExecution,
                },
              ]
            : []),
        ]
      : [
          { title: 'Schließen', variant: 'secondary', onPress: onClose },
          { title: 'Details öffnen', variant: 'secondary', onPress: openDetails },
          ...(canOpenExecution && executionRoute
            ? [
                {
                  title: canStartExecution ? 'Zur Durchführung' : 'Dokumentation fortsetzen',
                  variant: 'primary' as const,
                  onPress: openExecution,
                },
              ]
            : []),
        ]
    : [{ title: 'Schließen', variant: 'secondary', onPress: onClose }];

  return (
    <PlatformModal
      visible={visible}
      title={data?.title ?? 'Einsatzvorschau'}
      subtitle={data?.clientName ? `Klient:in: ${data.clientName}` : 'Ihr geplanter Einsatz'}
      onClose={onClose}
      footerActions={footerActions}
      variant={isPhone ? 'bottomSheet' : 'center'}
      maxWidth={780}
      minWidth={0}
      maxHeightRatio={isPhone ? 0.9 : 0.86}
      animationType={isPhone ? 'slide' : 'fade'}
      bodyStyle={[styles.modalBody, isPhone && styles.modalBodyPhone]}
      sheetStyle={styles.modalSheet}
    >
      {loading && !data ? (
        <LoadingState message="Einsatz wird geladen…" />
      ) : error && !data ? (
        <ErrorState title="Einsatz konnte nicht geladen werden" message={error} onRetry={refresh} />
      ) : data ? (
        <View style={styles.content} testID="employee-assignment-preview-readable-content">
          <View style={styles.statusRow}>
            <HealthOSStatusBadge domain="assignment" technicalValue={String(data.status)} />
            {fromCache ? <Text style={styles.cacheHint}>Offline-Ansicht</Text> : null}
          </View>

          <View style={[styles.factGrid, isPhone && styles.factGridPhone]}>
            <PreviewFact label="Datum" value={formatDate(data.startsAt)} />
            <PreviewFact
              label="Einsatzzeit"
              value={`${formatTime(data.startsAt)} – ${formatTime(data.endsAt)} Uhr`}
            />
          </View>

          <View style={styles.informationCard}>
            <Text style={styles.informationEyebrow}>EINSATZINFORMATIONEN</Text>
            <View style={styles.informationRow}>
              <Text style={styles.informationLabel}>Klient:in</Text>
              <Text style={styles.informationValue}>{data.clientName}</Text>
            </View>
            {data.location ? (
              <View style={styles.informationRow}>
                <Text style={styles.informationLabel}>Adresse</Text>
                <Text style={styles.informationValue}>{data.location}</Text>
              </View>
            ) : null}
            {data.clientPhone ? (
              <View style={styles.informationRow}>
                <Text style={styles.informationLabel}>Kontakt</Text>
                <Text style={styles.informationValue}>{data.clientPhone}</Text>
              </View>
            ) : null}
            {data.notes ? (
              <View style={styles.informationRow}>
                <Text style={styles.informationLabel}>Hinweise</Text>
                <Text style={styles.informationValue}>{data.notes}</Text>
              </View>
            ) : null}
          </View>

          {data.tasks.length > 0 ? (
            <View style={styles.taskCard}>
              <Text style={styles.informationEyebrow}>AUFGABEN</Text>
              {data.tasks.map((task) => (
                <View key={task} style={styles.taskRow}>
                  <Text style={styles.taskBullet}>✓</Text>
                  <Text style={styles.taskText}>{task}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {data.location ? (
            <PremiumButton title="Route in Karten öffnen" variant="secondary" onPress={openRoute} fullWidth />
          ) : null}

          {fromCache ? (
            <Text style={styles.cacheText}>
              Diese Angaben stammen aus dem Offline-Speicher. Arbeitsaktionen werden erst nach der Aktualisierung freigegeben.
            </Text>
          ) : null}
        </View>
      ) : null}
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  modalSheet: {
    backgroundColor: portalPremium.surfaceRaised,
    borderColor: portalPremium.borderStrong,
  },
  modalBody: {
    padding: careSpacing.md,
  },
  modalBodyPhone: {
    padding: careSpacing.sm,
  },
  content: {
    width: '100%',
    gap: careSpacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  cacheHint: {
    ...careTypography.caption,
    color: portalPremium.accent.amber,
    fontWeight: '800',
  },
  factGrid: {
    flexDirection: 'row',
    gap: careSpacing.sm,
  },
  factGridPhone: {
    flexDirection: 'column',
  },
  fact: {
    flex: 1,
    minWidth: 0,
    padding: careSpacing.md,
    gap: 4,
    borderRadius: portalPremium.radius.card,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    backgroundColor: portalPremium.surfaceSoft,
  },
  factLabel: {
    ...careTypography.caption,
    color: portalPremium.text.muted,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  factValue: {
    ...careTypography.bodyStrong,
    color: portalPremium.text.primary,
  },
  informationCard: {
    padding: careSpacing.md,
    gap: careSpacing.sm,
    borderRadius: portalPremium.radius.card,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    backgroundColor: portalPremium.surface,
  },
  taskCard: {
    padding: careSpacing.md,
    gap: careSpacing.sm,
    borderRadius: portalPremium.radius.card,
    borderWidth: 1,
    borderColor: portalPremium.border,
    backgroundColor: portalPremium.surfaceSoft,
  },
  informationEyebrow: {
    ...careTypography.caption,
    color: portalPremium.accent.blueDark,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  informationRow: {
    gap: 2,
    paddingTop: careSpacing.xs,
    borderTopWidth: 1,
    borderTopColor: portalPremium.borderSoft,
  },
  informationLabel: {
    ...careTypography.caption,
    color: portalPremium.text.muted,
    fontWeight: '800',
  },
  informationValue: {
    ...careTypography.body,
    color: portalPremium.text.primary,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
  },
  taskBullet: {
    ...careTypography.bodyStrong,
    color: portalPremium.accent.teal,
  },
  taskText: {
    ...careTypography.body,
    color: portalPremium.text.primary,
    flex: 1,
    minWidth: 0,
  },
  cacheText: {
    ...careTypography.caption,
    color: portalPremium.text.secondary,
    fontStyle: 'italic',
  },
});
