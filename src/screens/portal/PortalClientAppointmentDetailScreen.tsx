import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { PortalAppointmentDetailHero } from '@/components/portal';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { usePortalClientAppointmentDetail } from '@/hooks/usePortalClientAppointmentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

export function PortalClientAppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('portal.client.appointments.view');
  const canRequestChange = can('portal.client.appointments.request_change');

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
      <ScreenShell title="Termin" subtitle={roleLabel ?? 'Portal'}>
        <LockedActionBanner
          message={check('portal.client.appointments.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading) {
    return (
      <ScreenShell title="Termin" subtitle="Wird geladen…">
        <LoadingState message="Termindetails werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Termin" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Termin existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!data) return null;

  return (
    <ScreenShell
      title={data.title}
      subtitle={data.serviceType}
      rightSlot={
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

        {data.canRequestChange && canRequestChange ? (
          <View style={styles.changeBox}>
            <PremiumInput
              label="Terminänderung anfragen"
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  detailsCard: {
    gap: spacing.xs,
  },
  notes: {
    ...typography.body,
    color: colors.textSecondary,
  },
  changeBox: {
    gap: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
