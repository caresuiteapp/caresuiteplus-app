import { useMemo } from 'react';
import {
  Linking,
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
import { PremiumButton, LoadingState, ErrorState } from '@/components/ui';
import { HealthOSStatusBadge } from '@/components/healthos';
import { lightSurfaceText } from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { usePortalAppointmentDetail } from '@/hooks/usePortalAppointmentDetail';
import { webSafeAreaPadding } from '@/lib/platform/webSafeArea';

type EmployeePortalAssignmentPreviewSheetProps = {
  assignmentId: string | null;
  visible: boolean;
  onClose: () => void;
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

export function EmployeePortalAssignmentPreviewSheet({
  assignmentId,
  visible,
  onClose,
}: EmployeePortalAssignmentPreviewSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const text = lightSurfaceText;
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
      testID="employee-assignment-preview-sheet"
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
                <HealthOSStatusBadge domain="assignment" technicalValue={String(data.status)} />
                <Text style={[styles.title, { color: text.primary }]}>{data.title}</Text>
                <Text style={[styles.meta, { color: text.secondary }]}>{data.clientName}</Text>
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

              {data.clientPhone ? (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: text.muted }]}>Kontakt</Text>
                  <Text style={[styles.value, { color: text.primary }]}>{data.clientPhone}</Text>
                </View>
              ) : null}

              {data.notes ? (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: text.muted }]}>Hinweise</Text>
                  <Text style={[styles.value, { color: text.secondary }]}>{data.notes}</Text>
                </View>
              ) : null}

              {data.tasks.length > 0 ? (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: text.muted }]}>Aufgaben</Text>
                  {data.tasks.map((task) => (
                    <Text key={task} style={[styles.task, { color: text.secondary }]}>
                      • {task}
                    </Text>
                  ))}
                </View>
              ) : null}

              {fromCache ? (
                <Text style={[styles.cacheHint, { color: text.muted }]}>
                  Offline-Daten — Aktionen ggf. eingeschränkt.
                </Text>
              ) : null}

              <View style={styles.actions}>
                {data.location ? (
                  <PremiumButton title="Route öffnen" variant="secondary" onPress={openRoute} />
                ) : null}
                {canOpenExecution && executionRoute ? (
                  <PremiumButton
                    title={canStartExecution ? 'Zur Durchführung' : 'Dokumentation fortsetzen'}
                    onPress={() => {
                      onClose();
                      router.push(executionRoute as never);
                    }}
                  />
                ) : null}
                <PremiumButton
                  title="Details öffnen"
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    router.push(`/portal/employee/assignments/${data.id}` as never);
                  }}
                />
              </View>

              {/* TODO: Fahrt starten / Angekommen / Einsatz beenden — Workflow-Aktionen über Assist-Execution-API */}
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
  task: { ...careTypography.body },
  cacheHint: { ...careTypography.caption, fontStyle: 'italic' },
  actions: { gap: careSpacing.sm, marginTop: careSpacing.sm },
});
