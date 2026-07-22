import { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AssistLiveMap } from '@/components/maps/AssistLiveMap';
import { PremiumButton, LoadingState, ErrorState, SectionPanel } from '@/components/ui';
import { darkGlassSurfaceText } from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { usePortalClientAppointmentDetail } from '@/hooks/usePortalClientAppointmentDetail';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { webSafeAreaPadding } from '@/lib/platform/webSafeArea';

type ClientPortalAssignmentPreviewSheetProps = {
  assignmentId: string | null;
  visible: boolean;
  onClose: () => void;
  detailBasePath?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ClientPortalAssignmentPreviewSheet({
  assignmentId,
  visible,
  onClose,
  detailBasePath = '/portal/client/appointments',
}: ClientPortalAssignmentPreviewSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tenantId = useServiceTenantId();
  const text = darkGlassSurfaceText;
  const { data, loading, error, refresh } = usePortalClientAppointmentDetail(
    visible ? (assignmentId ?? undefined) : undefined,
  );

  const panelStyle = useMemo(
    () => ({
      paddingBottom: webSafeAreaPadding('bottom', insets.bottom + careSpacing.md) as number,
    }),
    [insets.bottom],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      testID="client-assignment-preview-sheet"
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Vorschau schließen" />
        <View
          style={[
            styles.sheet,
            panelStyle,
            { backgroundColor: careLightColors.surface, borderColor: careLightColors.borderStrong },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <Pressable onPress={onClose} style={[styles.closeBtn, webCursor]} accessibilityLabel="Schließen">
              <Text style={[styles.closeText, { color: text.muted }]}>✕</Text>
            </Pressable>
          </View>

          {loading && !data ? (
            <LoadingState message="Einsatz wird geladen…" />
          ) : error && !data ? (
            <ErrorState title="Einsatz" message={error} onRetry={refresh} />
          ) : data ? (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: text.primary }]}>{data.title}</Text>
                {data.caregiverName ? (
                  <Text style={[styles.meta, { color: text.secondary }]}>
                    Mitarbeitende: {data.caregiverName}
                  </Text>
                ) : null}
              </View>

              <View style={styles.section}>
                <Text style={[styles.label, { color: text.muted }]}>Zeit</Text>
                <Text style={[styles.value, { color: text.primary }]}>
                  {formatDateTime(data.startsAt)} – {formatDateTime(data.endsAt)}
                </Text>
              </View>

              {data.location ? (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: text.muted }]}>Adresse</Text>
                  <Text style={[styles.value, { color: text.primary }]}>{data.location}</Text>
                </View>
              ) : null}

              {data.serviceType ? (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: text.muted }]}>Leistungsart</Text>
                  <Text style={[styles.value, { color: text.primary }]}>{data.serviceType}</Text>
                </View>
              ) : null}

              {data.caregiverPhone ? (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: text.muted }]}>Kontakt</Text>
                  <Text style={[styles.value, { color: text.primary }]}>{data.caregiverPhone}</Text>
                </View>
              ) : null}

              {data.preparationNotes ? (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: text.muted }]}>Hinweise</Text>
                  <Text style={[styles.value, { color: text.secondary }]}>{data.preparationNotes}</Text>
                </View>
              ) : null}

              {data.liveVisit ? (
                <SectionPanel
                  title="Live-Standort"
                  subtitle={data.liveVisit.statusLabel ?? 'Aktueller Einsatzstatus'}
                >
                  {data.liveVisit.mapVisible && data.liveVisit.lastPosition ? (
                    <AssistLiveMap
                      position={data.liveVisit.lastPosition}
                      markerLabel={data.caregiverName ?? 'Mitarbeitende:r'}
                      height={200}
                      tenantId={tenantId}
                    />
                  ) : (
                    <Text style={[styles.value, { color: text.secondary }]}>
                      {data.liveVisit.fallbackMessage ??
                        'Live-Karte ist derzeit nicht verfügbar.'}
                    </Text>
                  )}
                </SectionPanel>
              ) : null}

              <View style={styles.actions}>
                <PremiumButton
                  title="Details öffnen"
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    router.push(`${detailBasePath}/${data.id}` as never);
                  }}
                />
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: careSpacing.sm,
    paddingHorizontal: careSpacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.6)',
  },
  closeBtn: {
    position: 'absolute',
    right: careSpacing.md,
    top: careSpacing.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 18, fontWeight: '700' },
  content: { padding: careSpacing.md, gap: careSpacing.md, paddingBottom: careSpacing.xl },
  header: { gap: careSpacing.xs },
  title: { ...careTypography.h3, fontWeight: '800' },
  meta: { ...careTypography.body },
  section: { gap: 4 },
  label: { ...careTypography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { ...careTypography.body },
  actions: { gap: careSpacing.sm, marginTop: careSpacing.sm },
});
