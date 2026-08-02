import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssistLiveMap } from '@/components/maps/AssistLiveMap';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { PortalAppointmentDetailHero } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { usePortalClientAppointmentDetail } from '@/hooks/usePortalClientAppointmentDetail';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { colors, spacing, typography } from '@/theme';
import { portalPremium } from '@/design/tokens/portalPremium';

export function PortalClientAppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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

  if (loading) {
    return (
      <PortalTabScreen title="Einsatz" subtitle="Wird geladen…">
        <LoadingState message="Einsatzdetails werden geladen…" />
      </PortalTabScreen>
    );
  }

  if (notFound || error) {
    return (
      <PortalTabScreen title="Einsatz" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Einsatz existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </PortalTabScreen>
    );
  }

  if (!data) return null;

  return (
    <PortalTabScreen
      title={data.title}
      subtitle={data.serviceType}
      scroll={false}
      contentOwnsHero
      actionsSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {successMessage ? <SuccessState message={successMessage} /> : null}

        <PortalAppointmentDetailHero appointment={data} scope="client" />

        <View style={styles.detailsCard}>
          <DetailInfoRow label="Beginn" value={new Date(data.startsAt).toLocaleString('de-DE')} />
          <DetailInfoRow label="Ende" value={new Date(data.endsAt).toLocaleString('de-DE')} />
          {data.location ? <DetailInfoRow label="Ort" value={data.location} /> : null}
          {data.caregiverName ? <DetailInfoRow label="Zuständige Person" value={data.caregiverName} /> : null}
          {data.caregiverPhone ? <DetailInfoRow label="Kontakt" value={data.caregiverPhone} /> : null}
        </View>

        {data.preparationNotes ? (
          <SectionPanel title="Hinweise zur Vorbereitung">
            <Text style={styles.notes}>{data.preparationNotes}</Text>
          </SectionPanel>
        ) : null}

        {data.liveVisit ? (
          <SectionPanel
            title="Live-Standort Ihrer Betreuungskraft"
            subtitle={data.liveVisit.statusLabel ?? 'Aktueller Einsatzstatus'}
          >
            {data.liveVisit.mapVisible && data.liveVisit.lastPosition ? (
              <AssistLiveMap
                position={data.liveVisit.lastPosition}
                markerLabel={data.caregiverName ?? 'Mitarbeitende:r'}
                height={260}
                tenantId={tenantId}
              />
            ) : (
              <Text style={styles.notes}>
                {data.liveVisit.fallbackMessage ??
                  'Live-Karte ist derzeit nicht verfügbar. Der Einsatzstatus wird ohne Standort angezeigt.'}
              </Text>
            )}
          </SectionPanel>
        ) : null}

        {data.canRequestChange && canRequestChange ? (
          <View style={styles.changeBox}>
            <PremiumInput
              label="Einsatzänderung anfragen"
              value={changeReason}
              onChangeText={setChangeReason}
              placeholder="z. B. anderer Wunschtermin, Verschiebung wegen Arzttermin…"
            />
            {changeError ? <Text style={styles.error}>{changeError}</Text> : null}
            <PremiumButton
              title="Änderung anfragen"
              variant="secondary"
              onPress={() => requestChange(changeReason)}
              loading={changeLoading}
              disabled={!changeReason.trim()}
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
      </ScrollView>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  detailsCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: portalPremium.radius.card,
    backgroundColor: portalPremium.surfaceRaised,
  },
  notes: {
    ...typography.body,
    color: portalPremium.text.secondary,
  },
  changeBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: portalPremium.radius.card,
    backgroundColor: portalPremium.surfaceSoft,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
