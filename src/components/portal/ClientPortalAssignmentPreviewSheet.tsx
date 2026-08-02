import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AssistLiveMap } from '@/components/maps/AssistLiveMap';
import { PlatformModal, type PlatformModalAction } from '@/components/layout/platform';
import { ErrorState, LoadingState } from '@/components/ui';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalClientAppointmentDetail } from '@/hooks/usePortalClientAppointmentDetail';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { portalPremium } from '@/design/tokens/portalPremium';

type ClientPortalAssignmentPreviewSheetProps = {
  assignmentId: string | null;
  visible: boolean;
  onClose: () => void;
  detailBasePath?: string;
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

export function ClientPortalAssignmentPreviewSheet({
  assignmentId,
  visible,
  onClose,
  detailBasePath = '/portal/client/appointments',
}: ClientPortalAssignmentPreviewSheetProps) {
  const router = useRouter();
  const { isPhone } = useDeviceClass();
  const tenantId = useServiceTenantId();
  const { data, loading, error, refresh } = usePortalClientAppointmentDetail(
    visible ? (assignmentId ?? undefined) : undefined,
  );

  const openDetails = () => {
    if (!data) return;
    onClose();
    router.push(`${detailBasePath}/${data.id}` as never);
  };

  const footerActions: PlatformModalAction[] = data
    ? [
        { title: 'Schließen', variant: 'secondary', onPress: onClose },
        { title: 'Einsatz vollständig öffnen', variant: 'primary', onPress: openDetails },
      ]
    : [{ title: 'Schließen', variant: 'secondary', onPress: onClose }];

  const livePosition = data?.liveVisit?.mapVisible ? data.liveVisit.lastPosition : null;

  return (
    <PlatformModal
      visible={visible}
      title={data?.title ?? 'Einsatzvorschau'}
      subtitle={data?.caregiverName ? `Ihre Betreuungskraft: ${data.caregiverName}` : 'Ihr geplanter Einsatz'}
      onClose={onClose}
      footerActions={footerActions}
      maxWidth={760}
      minWidth={0}
      maxHeightRatio={isPhone ? 0.9 : 0.86}
      animationType="fade"
      bodyStyle={styles.modalBody}
      sheetStyle={styles.modalSheet}
    >
      {loading && !data ? (
        <LoadingState message="Ihr Einsatz wird geladen…" />
      ) : error && !data ? (
        <ErrorState
          title="Einsatz konnte nicht geladen werden"
          message={error}
          onRetry={refresh}
        />
      ) : data ? (
        <View style={styles.content} testID="client-assignment-preview-readable-content">
          <View style={[styles.factGrid, isPhone && styles.factGridPhone]}>
            <PreviewFact label="Datum" value={formatDate(data.startsAt)} />
            <PreviewFact
              label="Uhrzeit"
              value={`${formatTime(data.startsAt)} – ${formatTime(data.endsAt)} Uhr`}
            />
          </View>

          <View style={styles.informationCard}>
            <Text style={styles.informationEyebrow}>IHR TERMIN</Text>
            {data.location ? (
              <View style={styles.informationRow}>
                <Text style={styles.informationLabel}>Treffpunkt</Text>
                <Text style={styles.informationValue}>{data.location}</Text>
              </View>
            ) : null}
            {data.serviceType ? (
              <View style={styles.informationRow}>
                <Text style={styles.informationLabel}>Unterstützung</Text>
                <Text style={styles.informationValue}>{data.serviceType}</Text>
              </View>
            ) : null}
            {data.preparationNotes ? (
              <View style={styles.informationRow}>
                <Text style={styles.informationLabel}>Hinweis</Text>
                <Text style={styles.informationValue}>{data.preparationNotes}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.liveCard} testID="client-assignment-preview-live-arrival">
            <Text style={styles.liveEyebrow}>LIVE-ANFAHRT</Text>
            <Text style={styles.liveTitle}>Wann ist Ihre Betreuungskraft unterwegs?</Text>
            {data.liveVisit?.statusLabel ? (
              <Text style={styles.liveStatus}>{data.liveVisit.statusLabel}</Text>
            ) : null}
            {livePosition ? (
              <AssistLiveMap
                position={livePosition}
                markerLabel={data.caregiverName ?? 'Betreuungskraft'}
                height={isPhone ? 180 : 220}
                tenantId={tenantId}
              />
            ) : (
              <View style={styles.liveHint}>
                <Text style={styles.liveHintIcon}>i</Text>
                <Text style={styles.liveHintText}>
                  Die Karte erscheint automatisch kurz vor dem Termin, sobald Ihre Betreuungskraft unterwegs ist.
                </Text>
              </View>
            )}
          </View>
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
  content: {
    width: '100%',
    gap: careSpacing.md,
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
  liveCard: {
    padding: careSpacing.md,
    gap: careSpacing.xs,
    borderRadius: portalPremium.radius.card,
    borderWidth: 1,
    borderColor: portalPremium.border,
    backgroundColor: portalPremium.surfaceSoft,
  },
  liveEyebrow: {
    ...careTypography.caption,
    color: portalPremium.accent.teal,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  liveTitle: {
    ...careTypography.h3,
    color: portalPremium.text.primary,
    fontWeight: '900',
  },
  liveStatus: {
    ...careTypography.caption,
    color: portalPremium.text.secondary,
    marginBottom: careSpacing.xs,
  },
  liveHint: {
    marginTop: careSpacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    padding: careSpacing.md,
    borderRadius: portalPremium.radius.control,
    backgroundColor: portalPremium.surfaceRaised,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
  },
  liveHintIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: portalPremium.accent.blue,
    color: portalPremium.text.onStrong,
    fontWeight: '900',
  },
  liveHintText: {
    ...careTypography.body,
    color: portalPremium.text.secondary,
    flex: 1,
    minWidth: 0,
  },
});
