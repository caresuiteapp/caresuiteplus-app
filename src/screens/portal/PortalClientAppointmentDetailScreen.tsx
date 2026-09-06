import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssistLiveMap } from '@/components/maps/AssistLiveMap';
import { LockedActionBanner } from '@/components/permissions';
import { PortalAppointmentDetailHero } from '@/components/portal';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePermissions } from '@/hooks/usePermissions';
import { usePortalClientAppointmentDetail } from '@/hooks/usePortalClientAppointmentDetail';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { portalPremium } from '@/design/tokens/portalPremium';

function ClientDetailFact({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string | null;
  icon: string;
}) {
  return (
    <View style={styles.factCard}>
      <View style={styles.factIcon}>
        <Text style={styles.factIconText}>{icon}</Text>
      </View>
      <View style={styles.factCopy}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
        {hint ? <Text style={styles.factHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

export function PortalClientAppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { isPhone, isDesktopOrWide } = useDeviceClass();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('portal.client.appointments.view');
  const canRequestChange = can('portal.client.appointments.request_change');
  const tenantId = useServiceTenantId();

  const [changeReason, setChangeReason] = useState('');
  const {
    data,
    loading,
    error,
    refresh,
    requestChange,
    changeLoading,
    changeError,
    successMessage,
    notFound,
  } = usePortalClientAppointmentDetail(id);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [id]);

  if (!canView) {
    return (
      <PortalTabScreen title="Einsatz" subtitle={resolvePortalScreenSubtitle(roleLabel, 'client')}>
        <LockedActionBanner
          message={check('portal.client.appointments.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </PortalTabScreen>
    );
  }

  if (loading && !data) {
    return (
      <PortalTabScreen title="Einsatz" subtitle="Ihre Angaben werden vorbereitet">
        <LoadingState message="Ihr Einsatz wird geladen…" />
      </PortalTabScreen>
    );
  }

  if (notFound || error) {
    return (
      <PortalTabScreen title="Einsatz" subtitle="Dieser Einsatz ist gerade nicht erreichbar">
        <ErrorState
          title={notFound ? 'Einsatz nicht gefunden' : 'Einsatz konnte nicht geladen werden'}
          message={error ?? 'Bitte öffnen Sie Ihre Einsätze erneut.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Einsatzübersicht" variant="secondary" onPress={() => router.back()} />
      </PortalTabScreen>
    );
  }

  if (!data) return null;

  const livePosition = data.liveVisit?.mapVisible ? data.liveVisit.lastPosition : null;

  return (
    <PortalTabScreen
      title={data.title}
      subtitle={data.serviceType}
      scroll={false}
      contentOwnsHero
      actionsSlot={
        <PremiumButton
          title={isPhone ? 'Zurück' : 'Zur Einsatzübersicht'}
          size="sm"
          variant="secondary"
          onPress={() => router.back()}
        />
      }
    >
      <ScrollView
        ref={scrollRef}
        key={data.id}
        style={styles.scrollViewport}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        testID="client-appointment-detail-scroll"
      >
        {successMessage ? <SuccessState message={successMessage} /> : null}

        <PortalAppointmentDetailHero appointment={data} scope="client" />

        <View style={[styles.columns, !isDesktopOrWide && styles.columnsStacked]}>
          <View style={styles.primaryColumn}>
            <View style={styles.panel} testID="client-appointment-readable-details">
              <View style={styles.panelHeader}>
                <Text style={styles.panelEyebrow}>AUF EINEN BLICK</Text>
                <Text style={styles.panelTitle}>Alles Wichtige zu Ihrem Einsatz</Text>
                <Text style={styles.panelSubtitle}>
                  Die Angaben sind ausschließlich für Ihren persönlichen Portalzugang bestimmt.
                </Text>
              </View>
              <View style={[styles.factGrid, isPhone && styles.factGridPhone]}>
                <ClientDetailFact
                  label="Treffpunkt"
                  value={data.location ?? 'Wird noch mitgeteilt'}
                  hint="Hier findet der Einsatz statt."
                  icon="⌖"
                />
                <ClientDetailFact
                  label="Ihre Betreuungskraft"
                  value={data.caregiverName ?? 'Wird noch zugeteilt'}
                  hint={data.caregiverPhone ? `Kontakt: ${data.caregiverPhone}` : 'Die Zuordnung erscheint automatisch.'}
                  icon="☺"
                />
              </View>
            </View>

            {data.preparationNotes ? (
              <View style={styles.panel}>
                <View style={styles.panelHeaderCompact}>
                  <Text style={styles.panelEyebrow}>GUT VORBEREITET</Text>
                  <Text style={styles.panelTitle}>Hinweis für Ihren Termin</Text>
                </View>
                <Text style={styles.bodyText}>{data.preparationNotes}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.secondaryColumn}>
            <View style={styles.panel} testID="client-appointment-live-arrival">
              <View style={styles.panelHeaderCompact}>
                <Text style={styles.panelEyebrow}>LIVE-ANFAHRT</Text>
                <Text style={styles.panelTitle}>Ihre Betreuungskraft auf dem Weg</Text>
                {data.liveVisit?.statusLabel ? (
                  <Text style={styles.panelSubtitle}>{data.liveVisit.statusLabel}</Text>
                ) : null}
              </View>
              {livePosition ? (
                <AssistLiveMap
                  position={livePosition}
                  markerLabel={data.caregiverName ?? 'Betreuungskraft'}
                  height={isPhone ? 210 : 260}
                  tenantId={tenantId}
                />
              ) : (
                <ClientPortalGuide
                  compact
                  title="Noch ist keine Live-Anfahrt aktiv"
                  message="Die Karte erscheint automatisch kurz vor Ihrem Termin, sobald Ihre Betreuungskraft unterwegs ist. Sie müssen nichts einstellen."
                />
              )}
            </View>

            {data.canRequestChange && canRequestChange ? (
              <View style={styles.panel} testID="client-appointment-change-request">
                <View style={styles.panelHeaderCompact}>
                  <Text style={styles.panelEyebrow}>ÄNDERUNG MITTEILEN</Text>
                  <Text style={styles.panelTitle}>Passt der Termin nicht?</Text>
                  <Text style={styles.panelSubtitle}>
                    Schreiben Sie uns kurz, was geändert werden soll. Ihre Verwaltung meldet sich bei Ihnen.
                  </Text>
                </View>
                <PremiumInput
                  label="Ihre Nachricht"
                  value={changeReason}
                  onChangeText={setChangeReason}
                  placeholder="Zum Beispiel: Bitte einen anderen Termin vereinbaren."
                  multiline
                  onLightSurface
                  style={styles.changeInput}
                />
                {changeError ? <Text style={styles.error}>{changeError}</Text> : null}
                <PremiumButton
                  title="Änderungswunsch senden"
                  onPress={() => requestChange(changeReason)}
                  loading={changeLoading}
                  disabled={!changeReason.trim()}
                  fullWidth
                />
              </View>
            ) : data.canRequestChange ? (
              <LockedActionBanner
                message={
                  check('portal.client.appointments.request_change').reason ?? 'Keine Berechtigung.'
                }
                roleLabel={roleLabel}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scrollViewport: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehaviorY: 'contain',
          WebkitOverflowScrolling: 'touch',
        } as unknown as ViewStyle)
      : null),
  },
  scroll: {
    gap: careSpacing.md,
    paddingBottom: careSpacing.xxl,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.md,
  },
  columnsStacked: {
    flexDirection: 'column',
  },
  primaryColumn: {
    flex: 1.12,
    width: '100%',
    minWidth: 0,
    gap: careSpacing.md,
  },
  secondaryColumn: {
    flex: 0.88,
    width: '100%',
    minWidth: 0,
    gap: careSpacing.md,
  },
  panel: {
    width: '100%',
    padding: careSpacing.lg,
    gap: careSpacing.md,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: portalPremium.radius.panel,
    backgroundColor: portalPremium.surface,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: portalPremium.shadow.card } as unknown as ViewStyle)
      : { shadowColor: '#00265A', shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 }),
  },
  panelHeader: {
    gap: 4,
    paddingBottom: careSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: portalPremium.borderSoft,
  },
  panelHeaderCompact: {
    gap: 4,
  },
  panelEyebrow: {
    ...careTypography.caption,
    color: portalPremium.accent.blueDark,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  panelTitle: {
    ...careTypography.h3,
    color: portalPremium.text.primary,
    fontWeight: '900',
  },
  panelSubtitle: {
    ...careTypography.body,
    color: portalPremium.text.secondary,
  },
  factGrid: {
    flexDirection: 'row',
    gap: careSpacing.sm,
  },
  factGridPhone: {
    flexDirection: 'column',
  },
  factCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
    padding: careSpacing.md,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: portalPremium.radius.card,
    backgroundColor: portalPremium.surfaceRaised,
  },
  factIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: portalPremium.surfaceSoft,
    borderWidth: 1,
    borderColor: portalPremium.border,
    flexShrink: 0,
  },
  factIconText: {
    fontSize: 20,
    color: portalPremium.accent.blueDark,
    fontWeight: '900',
  },
  factCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
  factHint: {
    ...careTypography.caption,
    color: portalPremium.text.secondary,
  },
  bodyText: {
    ...careTypography.body,
    color: portalPremium.text.primary,
  },
  changeInput: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  error: {
    ...careTypography.caption,
    color: portalPremium.accent.danger,
  },
});
